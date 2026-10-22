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
	testutil.InsertItem(t, tx, testutil.ItemFixture{ShopID: shop.ID, Category: "tents", Title: "Draft tent", Hidden: true})
	other := testutil.InsertShop(t, tx, testutil.ShopFixture{Name: "Other Shop"})
	testutil.InsertDress(t, tx, testutil.DressFixture{ShopID: other.ID, Title: "Elsewhere"})
	hidden := testutil.InsertShop(t, tx, testutil.ShopFixture{Hidden: true})

	rec := testutil.Request(t, r, http.MethodGet, "/api/shops/"+shop.Slug, nil, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body)
	}
	s := testutil.Decode[shops.PublicShop](t, rec)
	if s.Name != "Gelin Öýi" || s.City.Slug != "mary" || s.Items.Total != 2 || len(s.Items.Items) != 2 {
		t.Fatalf("shop = %+v", s)
	}
	// Only categories with published listings get a chip.
	if len(s.Categories) != 1 || s.Categories[0] != "dresses" {
		t.Fatalf("categories = %v", s.Categories)
	}
	testutil.InsertItem(t, tx, testutil.ItemFixture{ShopID: shop.ID, Category: "cars", Title: "Ak limuzin"})
	s = testutil.Decode[shops.PublicShop](t, testutil.Request(t, r, http.MethodGet, "/api/shops/"+shop.Slug+"?category=cars", nil, ""))
	if s.Items.Total != 1 || s.Items.Items[0].Category != "cars" || len(s.Categories) != 2 || s.Categories[1] != "cars" {
		t.Fatalf("cars only: items = %+v, categories = %v", s.Items, s.Categories)
	}
	for _, slug := range []string{hidden.Slug, "no-such-shop"} {
		if rec := testutil.Request(t, r, http.MethodGet, "/api/shops/"+slug, nil, ""); rec.Code != http.StatusNotFound {
			t.Errorf("%s: status = %d", slug, rec.Code)
		}
	}
}
