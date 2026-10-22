package items_test

import (
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"

	"wedding-rentals/backend/internal/images"
	"wedding-rentals/backend/internal/items"
	"wedding-rentals/backend/internal/testutil"
)

type env struct {
	r  *gin.Engine
	tx pgx.Tx
}

func setup(t *testing.T) env {
	e := env{r: gin.New(), tx: testutil.Tx(t)}
	h := &items.Handler{DB: e.tx, Storage: images.LocalStorage{Dir: t.TempDir()}}
	h.RegisterPublic(e.r.Group("/api"))
	h.RegisterAdmin(e.r.Group("/api/admin"))
	return e
}

func car(shopID int64) map[string]any {
	return map[string]any{
		"shop_id": shopID, "category": "cars", "title": "Ak Mercedes", "price_manat": 800, "is_published": true,
		"attributes": map[string]any{"brand_model": "Mercedes S-Class", "body": "sedan", "color": "white", "price_unit": "hour"},
	}
}

func path(id int64) string { return "/api/admin/items/" + strconv.FormatInt(id, 10) }

func TestCreateReadUpdateDelete(t *testing.T) {
	e := setup(t)
	shop := testutil.InsertShop(t, e.tx, testutil.ShopFixture{})
	rec := testutil.Request(t, e.r, http.MethodPost, "/api/admin/items", car(shop.ID), "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", rec.Code, rec.Body)
	}
	it := testutil.Decode[items.Item](t, rec)
	if it.Category != "cars" || it.ShopID != shop.ID || it.Attributes["body"] != "sedan" || it.Images == nil {
		t.Fatalf("created = %+v", it)
	}
	// Update: category cannot change, attributes are re-checked against the stored one.
	body := car(shop.ID)
	body["category"] = "tents"
	body["attributes"].(map[string]any)["body"] = "limousine"
	body["attributes"].(map[string]any)["seats"] = 4
	rec = testutil.Request(t, e.r, http.MethodPut, path(it.ID), body, "")
	got := testutil.Decode[items.Item](t, rec)
	if rec.Code != http.StatusOK || got.Category != "cars" || got.Attributes["body"] != "limousine" || got.Attributes["seats"] != float64(4) {
		t.Fatalf("update: %d %+v", rec.Code, got)
	}
	if rec := testutil.Request(t, e.r, http.MethodGet, path(it.ID), nil, ""); rec.Code != http.StatusOK {
		t.Fatalf("get: %d", rec.Code)
	}
	if rec := testutil.Request(t, e.r, http.MethodDelete, path(it.ID), nil, ""); rec.Code != http.StatusNoContent {
		t.Fatalf("delete: %d", rec.Code)
	}
	if rec := testutil.Request(t, e.r, http.MethodGet, path(it.ID), nil, ""); rec.Code != http.StatusNotFound {
		t.Fatalf("get after delete: %d", rec.Code)
	}
}

func TestValidation(t *testing.T) {
	e := setup(t)
	shop := testutil.InsertShop(t, e.tx, testutil.ShopFixture{})
	cases := []struct {
		name  string
		edit  func(map[string]any)
		field string
		code  string
	}{
		{"no category", func(b map[string]any) { delete(b, "category") }, "category", "required"},
		{"unknown category", func(b map[string]any) { b["category"] = "boats" }, "category", "invalid"},
		{"dresses go through /dresses", func(b map[string]any) { b["category"] = "dresses" }, "category", "invalid"},
		{"bad shop", func(b map[string]any) { b["shop_id"] = 999999999 }, "shop_id", "invalid"},
		{"no title", func(b map[string]any) { b["title"] = " " }, "title", "required"},
		{"no price", func(b map[string]any) { b["price_manat"] = 0 }, "price_manat", "must_be_positive"},
		{"missing attribute", func(b map[string]any) { delete(b["attributes"].(map[string]any), "body") }, "attributes.body", "required"},
		{"bad attribute", func(b map[string]any) { b["attributes"].(map[string]any)["color"] = "green" }, "attributes.color", "invalid"},
		{"unknown attribute", func(b map[string]any) { b["attributes"].(map[string]any)["wheels"] = 4 }, "attributes.wheels", "unknown"},
	}
	for _, tc := range cases {
		body := car(shop.ID)
		tc.edit(body)
		rec := testutil.Request(t, e.r, http.MethodPost, "/api/admin/items", body, "")
		got := testutil.Decode[testutil.ErrorBody](t, rec)
		if rec.Code != http.StatusBadRequest || got.Error.Fields[tc.field] != tc.code {
			t.Errorf("%s: %d %v, want %s=%s", tc.name, rec.Code, got.Error.Fields, tc.field, tc.code)
		}
	}
}

func TestDressesAreNotItems(t *testing.T) {
	e := setup(t)
	shop := testutil.InsertShop(t, e.tx, testutil.ShopFixture{})
	dress := testutil.InsertDress(t, e.tx, testutil.DressFixture{ShopID: shop.ID})
	for _, method := range []string{http.MethodGet, http.MethodPut, http.MethodDelete} {
		if rec := testutil.Request(t, e.r, method, path(dress), car(shop.ID), ""); rec.Code != http.StatusNotFound {
			t.Errorf("%s dress on /items: %d, want 404", method, rec.Code)
		}
	}
	// The admin list still shows every category, dresses included.
	list := testutil.Decode[struct{ Items []items.Summary }](t, testutil.Request(t, e.r, http.MethodGet, "/api/admin/items?shop_id="+strconv.FormatInt(shop.ID, 10), nil, ""))
	if len(list.Items) != 1 || list.Items[0].Category != "dresses" {
		t.Fatalf("admin list = %+v", list.Items)
	}
}

type seeded struct{ limo, suv, tent, gown, robe int64 }

func seed(t *testing.T, tx pgx.Tx) seeded {
	a := testutil.InsertShop(t, tx, testutil.ShopFixture{Name: "Ak Gelin Wedding House"})
	b := testutil.InsertShop(t, tx, testutil.ShopFixture{Name: "Toý Maşyn", CitySlug: "mary"})
	hidden := testutil.InsertShop(t, tx, testutil.ShopFixture{Hidden: true})
	var s seeded
	s.gown = testutil.InsertDress(t, tx, testutil.DressFixture{ShopID: a.ID, Title: "Princess", Price: 1500})
	s.limo = testutil.InsertItem(t, tx, testutil.ItemFixture{ShopID: b.ID, Category: "cars", Title: "Lincoln limuzin", Price: 900,
		Attributes: map[string]any{"brand_model": "Lincoln", "body": "limousine", "color": "white", "seats": 8, "price_unit": "hour"}})
	s.suv = testutil.InsertItem(t, tx, testutil.ItemFixture{ShopID: a.ID, Category: "cars", Title: "Gara Lexus", Price: 600,
		Attributes: map[string]any{"brand_model": "Lexus LX", "body": "suv", "color": "black", "seats": 4, "price_unit": "day"}})
	s.tent = testutil.InsertItem(t, tx, testutil.ItemFixture{ShopID: b.ID, Category: "tents", Title: "Uly çadyr", Price: 5000,
		Attributes: map[string]any{"guests": 300}})
	s.robe = testutil.InsertItem(t, tx, testutil.ItemFixture{ShopID: a.ID, Category: "national-clothes", Title: "Gelin kürte", Price: 400,
		Attributes: map[string]any{"for_whom": "bride", "sizes": []string{"S", "M"}}})
	testutil.InsertItem(t, tx, testutil.ItemFixture{ShopID: a.ID, Category: "cars", Title: "Draft car", Hidden: true,
		Attributes: map[string]any{"body": "sedan"}})
	testutil.InsertItem(t, tx, testutil.ItemFixture{ShopID: hidden.ID, Category: "tents", Title: "Hidden tent",
		Attributes: map[string]any{"guests": 1000}})
	return s
}

func ids(p items.Page) []int64 {
	out := []int64{}
	for _, it := range p.Items {
		out = append(out, it.ID)
	}
	return out
}

func TestListPublic(t *testing.T) {
	e := setup(t)
	s := seed(t, e.tx)
	cases := map[string][]int64{
		"":                                       {s.robe, s.tent, s.suv, s.limo, s.gown},
		"category=cars":                          {s.suv, s.limo},
		"category=cars&body=limousine":           {s.limo},
		"category=cars&color=black":              {s.suv},
		"category=cars&seats_min=5":              {s.limo},
		"category=cars&seats_min=8":              {s.limo},
		"category=cars&seats_min=9":              {},
		"category=tents&guests_min=300":          {s.tent},
		"category=tents&guests_min=301":          {},
		"category=national-clothes&size=M":       {s.robe},
		"category=national-clothes&size=L":       {},
		"category=dresses":                       {s.gown},
		"city=mary":                              {s.tent, s.limo},
		"price_max=900":                          {s.robe, s.suv, s.limo},
		"q=ak+gelyn":                             {s.robe, s.suv, s.gown}, // shop name, with a typo
		"q=limuzin":                              {s.limo},
		fmt.Sprintf("ids=%d,%d", s.gown, s.tent): {s.tent, s.gown},
	}
	for query, want := range cases {
		rec := testutil.Request(t, e.r, http.MethodGet, "/api/items?"+query, nil, "")
		if rec.Code != http.StatusOK {
			t.Fatalf("%q: status = %d: %s", query, rec.Code, rec.Body)
		}
		p := testutil.Decode[items.Page](t, rec)
		got := ids(p)
		if query == "q=ak+gelyn" {
			slices.Sort(got) // ranked by match, not by date
			slices.Sort(want)
		}
		if !slices.Equal(got, want) || p.Total != len(want) {
			t.Errorf("%q: ids = %v total = %d, want %v", query, got, p.Total, want)
		}
	}
	for _, query := range []string{"category=boats", "category=cars&body=truck", "category=tents&guests_min=0"} {
		if rec := testutil.Request(t, e.r, http.MethodGet, "/api/items?"+query, nil, ""); rec.Code != http.StatusBadRequest {
			t.Errorf("%q: status = %d, want 400", query, rec.Code)
		}
	}
}

func TestGetPublic(t *testing.T) {
	e := setup(t)
	s := seed(t, e.tx)
	rec := testutil.Request(t, e.r, http.MethodGet, "/api/items/"+strconv.FormatInt(s.limo, 10), nil, "")
	it := testutil.Decode[items.PublicItem](t, rec)
	if rec.Code != http.StatusOK || it.Category != "cars" || it.Attributes["price_unit"] != "hour" || it.Shop.City.Slug != "mary" {
		t.Fatalf("limo: %d %+v", rec.Code, it)
	}
	dress := testutil.Decode[items.PublicItem](t, testutil.Request(t, e.r, http.MethodGet, "/api/items/"+strconv.FormatInt(s.gown, 10), nil, ""))
	if dress.Category != "dresses" || len(dress.Attributes) != 0 {
		t.Fatalf("dress: %+v", dress)
	}
	if rec := testutil.Request(t, e.r, http.MethodGet, "/api/items/999999999", nil, ""); rec.Code != http.StatusNotFound {
		t.Fatalf("missing: %d", rec.Code)
	}
}
