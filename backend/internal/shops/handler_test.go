package shops_test

import (
	"context"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"

	"wedding-rentals/backend/internal/images"
	"wedding-rentals/backend/internal/shops"
	"wedding-rentals/backend/internal/testutil"
)

type env struct {
	r      *gin.Engine
	tx     pgx.Tx
	dir    string
	cityID int64
}

func setup(t *testing.T) env {
	e := env{r: gin.New(), tx: testutil.Tx(t), dir: t.TempDir()}
	h := &shops.Handler{DB: e.tx, Storage: images.LocalStorage{Dir: e.dir}}
	h.RegisterAdmin(e.r.Group("/api/admin"))
	if err := e.tx.QueryRow(context.Background(), `SELECT id FROM cities WHERE slug = 'ashgabat'`).Scan(&e.cityID); err != nil {
		t.Fatal(err)
	}
	return e
}

func (e env) validInput() map[string]any {
	return map[string]any{
		"name":          "Gelin Öýi",
		"city_id":       e.cityID,
		"address":       "Magtymguly şaýoly 12",
		"phone":         "+993 65 123456",
		"instagram_url": "https://instagram.com/gelinoyi",
		"aliases":       []string{"Bridal House", " bridal house ", "Гелин Ой", ""},
	}
}

func path(id int64) string { return "/api/admin/shops/" + strconv.FormatInt(id, 10) }

func TestCreateShop(t *testing.T) {
	e := setup(t)
	rec := testutil.Request(t, e.r, http.MethodPost, "/api/admin/shops", e.validInput(), "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body)
	}
	s := testutil.Decode[shops.Shop](t, rec)
	if s.Slug != "gelin-oyi" || s.Name != "Gelin Öýi" || s.IsPublished || s.TikTokURL != nil {
		t.Fatalf("shop = %+v", s)
	}
	if !slices.Equal(s.Aliases, []string{"Bridal House", "Гелин Ой"}) {
		t.Fatalf("aliases = %q", s.Aliases)
	}
}

func TestCreateShopSlugIsUnique(t *testing.T) {
	e := setup(t)
	testutil.Request(t, e.r, http.MethodPost, "/api/admin/shops", e.validInput(), "")
	rec := testutil.Request(t, e.r, http.MethodPost, "/api/admin/shops", e.validInput(), "")
	if s := testutil.Decode[shops.Shop](t, rec); s.Slug != "gelin-oyi-2" {
		t.Fatalf("slug = %q", s.Slug)
	}
}

func TestCreateShopValidation(t *testing.T) {
	e := setup(t)
	rec := testutil.Request(t, e.r, http.MethodPost, "/api/admin/shops", map[string]any{}, "")
	body := testutil.Decode[testutil.ErrorBody](t, rec)
	if rec.Code != 400 || body.Error.Code != "validation_failed" {
		t.Fatalf("got %d %q", rec.Code, body.Error.Code)
	}
	for _, f := range []string{"name", "city_id", "address", "phone"} {
		if body.Error.Fields[f] != "required" {
			t.Errorf("fields[%s] = %q", f, body.Error.Fields[f])
		}
	}

	in := e.validInput()
	in["phone"] = "call me"
	in["instagram_url"] = "http://instagram.com/x"
	in["city_id"] = 999999999
	body = testutil.Decode[testutil.ErrorBody](t, testutil.Request(t, e.r, http.MethodPost, "/api/admin/shops", in, ""))
	for _, f := range []string{"phone", "instagram_url", "city_id"} {
		if body.Error.Fields[f] != "invalid" {
			t.Errorf("fields[%s] = %q", f, body.Error.Fields[f])
		}
	}
}

func TestUpdateShop(t *testing.T) {
	e := setup(t)
	created := testutil.Decode[shops.Shop](t, testutil.Request(t, e.r, http.MethodPost, "/api/admin/shops", e.validInput(), ""))
	in := e.validInput()
	in["name"] = "Gelin Öýi Lux"
	in["is_published"] = true
	in["aliases"] = []string{"GO Lux"}
	rec := testutil.Request(t, e.r, http.MethodPut, path(created.ID), in, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body)
	}
	s := testutil.Decode[shops.Shop](t, rec)
	if s.Slug != "gelin-oyi" || s.Name != "Gelin Öýi Lux" || !s.IsPublished || !slices.Equal(s.Aliases, []string{"GO Lux"}) {
		t.Fatalf("shop = %+v", s)
	}
	if rec := testutil.Request(t, e.r, http.MethodPut, path(999999999), in, ""); rec.Code != http.StatusNotFound {
		t.Fatalf("missing shop: status = %d", rec.Code)
	}
}

func TestGetAndListShops(t *testing.T) {
	e := setup(t)
	created := testutil.Decode[shops.Shop](t, testutil.Request(t, e.r, http.MethodPost, "/api/admin/shops", e.validInput(), ""))
	got := testutil.Decode[shops.Shop](t, testutil.Request(t, e.r, http.MethodGet, path(created.ID), nil, ""))
	if got.ID != created.ID || got.Address != "Magtymguly şaýoly 12" {
		t.Fatalf("get = %+v", got)
	}
	list := testutil.Decode[struct{ Items []shops.Shop }](t, testutil.Request(t, e.r, http.MethodGet, "/api/admin/shops", nil, ""))
	if !slices.ContainsFunc(list.Items, func(s shops.Shop) bool { return s.ID == created.ID }) {
		t.Fatal("created shop missing from list")
	}
}

func TestDeleteShopRemovesImageFiles(t *testing.T) {
	e := setup(t)
	shop := testutil.InsertShop(t, e.tx, testutil.ShopFixture{})
	dress := testutil.InsertDress(t, e.tx, testutil.DressFixture{ShopID: shop.ID})
	testutil.InsertImage(t, e.tx, dress, 0, "pic")
	for _, f := range []string{"pic_s.jpg", "pic_l.jpg"} {
		if err := os.WriteFile(filepath.Join(e.dir, f), []byte("x"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	if rec := testutil.Request(t, e.r, http.MethodDelete, path(shop.ID), nil, ""); rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d", rec.Code)
	}
	if _, err := os.Stat(filepath.Join(e.dir, "pic_s.jpg")); !os.IsNotExist(err) {
		t.Fatal("image file still exists")
	}
	if rec := testutil.Request(t, e.r, http.MethodGet, path(shop.ID), nil, ""); rec.Code != http.StatusNotFound {
		t.Fatalf("get after delete: %d", rec.Code)
	}
}
