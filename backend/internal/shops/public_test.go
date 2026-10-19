package shops_test

import (
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"

	"wedding-rentals/backend/internal/images"
	"wedding-rentals/backend/internal/shops"
	"wedding-rentals/backend/internal/testutil"
)

func TestGetPublicShop(t *testing.T) {
	tx := testutil.Tx(t)
	r := gin.New()
	(&shops.Handler{DB: tx, Storage: images.LocalStorage{Dir: t.TempDir()}}).RegisterPublic(r.Group("/api"))

	shop := testutil.InsertShop(t, tx, testutil.ShopFixture{Name: "Gelin Öýi", CitySlug: "mary"})
	testutil.InsertDress(t, tx, testutil.DressFixture{ShopID: shop.ID, Title: "One"})
	testutil.InsertDress(t, tx, testutil.DressFixture{ShopID: shop.ID, Title: "Two"})
	testutil.InsertDress(t, tx, testutil.DressFixture{ShopID: shop.ID, Title: "Draft", Hidden: true})
	other := testutil.InsertShop(t, tx, testutil.ShopFixture{Name: "Other Shop"})
	testutil.InsertDress(t, tx, testutil.DressFixture{ShopID: other.ID, Title: "Elsewhere"})
	hidden := testutil.InsertShop(t, tx, testutil.ShopFixture{Hidden: true})

	rec := testutil.Request(t, r, http.MethodGet, "/api/shops/"+shop.Slug, nil, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body)
	}
	s := testutil.Decode[shops.PublicShop](t, rec)
	if s.Name != "Gelin Öýi" || s.City.Slug != "mary" || s.Dresses.Total != 2 || len(s.Dresses.Items) != 2 {
		t.Fatalf("shop = %+v", s)
	}
	for _, slug := range []string{hidden.Slug, "no-such-shop"} {
		if rec := testutil.Request(t, r, http.MethodGet, "/api/shops/"+slug, nil, ""); rec.Code != http.StatusNotFound {
			t.Errorf("%s: status = %d", slug, rec.Code)
		}
	}
}
