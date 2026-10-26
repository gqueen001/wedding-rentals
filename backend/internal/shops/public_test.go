package shops_test

import (
	"net/http"
	"net/url"
	"slices"
	"strings"
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

func TestListPublicShops(t *testing.T) {
	tx := testutil.Tx(t)
	r := gin.New()
	(&shops.Handler{DB: tx, Storage: images.LocalStorage{Dir: t.TempDir()}}).RegisterPublic(r.Group("/api"))

	zer := testutil.InsertShop(t, tx, testutil.ShopFixture{Name: "Zer Toý", CitySlug: "mary"})
	bagul := testutil.InsertShop(t, tx, testutil.ShopFixture{Name: "Bägül salon", Aliases: []string{"Багуль"}})
	ak := testutil.InsertShop(t, tx, testutil.ShopFixture{Name: "ak gelin"})
	testutil.InsertShop(t, tx, testutil.ShopFixture{Name: "Bägül hidden", Hidden: true})
	testutil.InsertDress(t, tx, testutil.DressFixture{ShopID: bagul.ID, Title: "One"})
	testutil.InsertItem(t, tx, testutil.ItemFixture{ShopID: bagul.ID, Category: "cars", Title: "Ak limuzin"})
	testutil.InsertDress(t, tx, testutil.DressFixture{ShopID: bagul.ID, Title: "Draft", Hidden: true})

	list := func(query string) shops.SummaryPage {
		t.Helper()
		rec := testutil.Request(t, r, http.MethodGet, "/api/shops"+query, nil, "")
		if rec.Code != http.StatusOK {
			t.Fatalf("%s: status = %d: %s", query, rec.Code, rec.Body)
		}
		return testutil.Decode[shops.SummaryPage](t, rec)
	}
	slugs := func(p shops.SummaryPage) []string {
		out := []string{}
		for _, s := range p.Items {
			out = append(out, s.Slug)
		}
		return out
	}

	// No query: every published shop A to Z (by the Latin-folded name), with its published listing count.
	all := list("")
	if got, want := slugs(all), []string{ak.Slug, bagul.Slug, zer.Slug}; !slices.Equal(got, want) || all.Total != 3 {
		t.Fatalf("all = %v (total %d), want %v", got, all.Total, want)
	}
	if all.Items[1].ListingCount != 2 || all.Items[0].ListingCount != 0 || all.Items[2].City.Slug != "mary" {
		t.Fatalf("rows = %+v", all.Items)
	}
	if p := list("?per_page=2&page=2"); !slices.Equal(slugs(p), []string{zer.Slug}) || p.Total != 3 {
		t.Fatalf("page 2 = %v (total %d)", slugs(p), p.Total)
	}

	// A query matches the name (Turkmen letters folded, small typos allowed) or an alias.
	for q, want := range map[string]string{"bagul": bagul.Slug, "Bägül": bagul.Slug, "bagl": bagul.Slug, "Багуль": bagul.Slug, "zer": zer.Slug} {
		if got := slugs(list("?q=" + url.QueryEscape(q))); !slices.Equal(got, []string{want}) {
			t.Errorf("q=%s: %v, want [%s]", q, got, want)
		}
	}
	if p := list("?q=limuzin"); len(p.Items) != 0 || p.Total != 0 {
		t.Errorf("a product word finds no shop: %+v", p)
	}
	if rec := testutil.Request(t, r, http.MethodGet, "/api/shops?q="+strings.Repeat("a", 101), nil, ""); rec.Code != http.StatusBadRequest {
		t.Errorf("long q: status = %d", rec.Code)
	}
}
