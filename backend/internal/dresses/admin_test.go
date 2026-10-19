package dresses_test

import (
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"

	"wedding-rentals/backend/internal/dresses"
	"wedding-rentals/backend/internal/images"
	"wedding-rentals/backend/internal/testutil"
)

type env struct {
	r   *gin.Engine
	tx  pgx.Tx
	dir string
}

func setup(t *testing.T) env {
	e := env{r: gin.New(), tx: testutil.Tx(t), dir: t.TempDir()}
	h := &dresses.Handler{DB: e.tx, Storage: images.LocalStorage{Dir: e.dir}}
	h.RegisterAdmin(e.r.Group("/api/admin"))
	h.RegisterPublic(e.r.Group("/api"))
	return e
}

func adminPath(id int64) string { return "/api/admin/dresses/" + strconv.FormatInt(id, 10) }

func validDress(shopID int64) map[string]any {
	return map[string]any{
		"shop_id": shopID, "title": " Princess A-112 ", "price_manat": 1500, "price_is_from": true,
		"color": "ivory", "silhouette": "ball_gown", "sleeves": "long", "sizes": []string{"M", "S", "M"},
	}
}

func TestCreateDress(t *testing.T) {
	e := setup(t)
	shop := testutil.InsertShop(t, e.tx, testutil.ShopFixture{})
	rec := testutil.Request(t, e.r, http.MethodPost, "/api/admin/dresses", validDress(shop.ID), "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body)
	}
	d := testutil.Decode[dresses.Dress](t, rec)
	if d.Title != "Princess A-112" || d.PriceManat != 1500 || !d.PriceIsFrom || d.Color != "ivory" || d.IsPublished {
		t.Fatalf("dress = %+v", d)
	}
	if !slices.Equal(d.Sizes, []string{"S", "M"}) || d.Images == nil || len(d.Images) != 0 {
		t.Fatalf("sizes = %q images = %v", d.Sizes, d.Images)
	}
}

func TestCreateDressValidation(t *testing.T) {
	e := setup(t)
	body := testutil.Decode[testutil.ErrorBody](t, testutil.Request(t, e.r, http.MethodPost, "/api/admin/dresses", map[string]any{}, ""))
	want := map[string]string{
		"shop_id": "required", "title": "required", "price_manat": "must_be_positive",
		"color": "invalid", "silhouette": "invalid", "sleeves": "invalid", "sizes": "required",
	}
	for f, v := range want {
		if body.Error.Fields[f] != v {
			t.Errorf("fields[%s] = %q, want %q", f, body.Error.Fields[f], v)
		}
	}
	huge := validDress(1)
	huge["price_manat"] = 2147483648
	body = testutil.Decode[testutil.ErrorBody](t, testutil.Request(t, e.r, http.MethodPost, "/api/admin/dresses", huge, ""))
	if body.Error.Fields["price_manat"] != "too_large" {
		t.Errorf("price overflow: fields = %v", body.Error.Fields)
	}
	in := validDress(999999999)
	in["sizes"] = []string{"M", "XXXL"}
	body = testutil.Decode[testutil.ErrorBody](t, testutil.Request(t, e.r, http.MethodPost, "/api/admin/dresses", in, ""))
	if body.Error.Fields["shop_id"] != "invalid" || body.Error.Fields["sizes"] != "invalid" {
		t.Fatalf("fields = %v", body.Error.Fields)
	}
}

func TestUpdateDress(t *testing.T) {
	e := setup(t)
	shop := testutil.InsertShop(t, e.tx, testutil.ShopFixture{})
	created := testutil.Decode[dresses.Dress](t, testutil.Request(t, e.r, http.MethodPost, "/api/admin/dresses", validDress(shop.ID), ""))
	in := validDress(shop.ID)
	in["price_manat"] = 2000
	in["color"] = "blush"
	in["is_published"] = true
	in["description"] = "Lace, long train"
	rec := testutil.Request(t, e.r, http.MethodPut, adminPath(created.ID), in, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body)
	}
	d := testutil.Decode[dresses.Dress](t, rec)
	if d.PriceManat != 2000 || d.Color != "blush" || !d.IsPublished || d.Description == nil || *d.Description != "Lace, long train" {
		t.Fatalf("dress = %+v", d)
	}
	if rec := testutil.Request(t, e.r, http.MethodPut, adminPath(999999999), in, ""); rec.Code != http.StatusNotFound {
		t.Fatalf("missing: %d", rec.Code)
	}
}

func TestListAdminFiltersByShop(t *testing.T) {
	e := setup(t)
	a := testutil.InsertShop(t, e.tx, testutil.ShopFixture{})
	b := testutil.InsertShop(t, e.tx, testutil.ShopFixture{})
	da := testutil.InsertDress(t, e.tx, testutil.DressFixture{ShopID: a.ID, Hidden: true})
	testutil.InsertDress(t, e.tx, testutil.DressFixture{ShopID: b.ID})
	rec := testutil.Request(t, e.r, http.MethodGet, "/api/admin/dresses?shop_id="+strconv.FormatInt(a.ID, 10), nil, "")
	list := testutil.Decode[struct{ Items []dresses.Dress }](t, rec)
	if len(list.Items) != 1 || list.Items[0].ID != da {
		t.Fatalf("items = %+v", list.Items)
	}
	if rec := testutil.Request(t, e.r, http.MethodGet, "/api/admin/dresses?shop_id=abc", nil, ""); rec.Code != http.StatusBadRequest {
		t.Fatalf("bad shop_id: %d", rec.Code)
	}
}

func TestDeleteDressRemovesFiles(t *testing.T) {
	e := setup(t)
	shop := testutil.InsertShop(t, e.tx, testutil.ShopFixture{})
	id := testutil.InsertDress(t, e.tx, testutil.DressFixture{ShopID: shop.ID})
	testutil.InsertImage(t, e.tx, id, 0, "d")
	_ = os.WriteFile(filepath.Join(e.dir, "d_s.jpg"), []byte("x"), 0o644)
	if rec := testutil.Request(t, e.r, http.MethodDelete, adminPath(id), nil, ""); rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d", rec.Code)
	}
	if _, err := os.Stat(filepath.Join(e.dir, "d_s.jpg")); !os.IsNotExist(err) {
		t.Fatal("file still exists")
	}
	if rec := testutil.Request(t, e.r, http.MethodGet, adminPath(id), nil, ""); rec.Code != http.StatusNotFound {
		t.Fatalf("get after delete: %d", rec.Code)
	}
}
