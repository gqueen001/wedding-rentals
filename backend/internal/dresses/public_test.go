package dresses_test

import (
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"testing"

	"github.com/jackc/pgx/v5"

	"wedding-rentals/backend/internal/dresses"
	"wedding-rentals/backend/internal/testutil"
)

type catalog struct {
	d1, d2, d3, d4, d5 int64
	shopA              testutil.ShopRow
}

// seed: d1,d2 (shop A, Ashgabat), d3 (shop B, Mary) are visible;
// d4 is an unpublished dress, d5 belongs to an unpublished shop.
func seed(t *testing.T, tx pgx.Tx) catalog {
	a := testutil.InsertShop(t, tx, testutil.ShopFixture{Name: "Gelin Öýi", Aliases: []string{"Bridal House"}})
	b := testutil.InsertShop(t, tx, testutil.ShopFixture{Name: "Ak Ýüpek", CitySlug: "mary"})
	hidden := testutil.InsertShop(t, tx, testutil.ShopFixture{Name: "Hidden Shop", Hidden: true})
	c := catalog{shopA: a}
	c.d1 = testutil.InsertDress(t, tx, testutil.DressFixture{ShopID: a.ID, Title: "Princess", Price: 1500, Color: "white", Silhouette: "ball_gown", Sleeves: "long", Sizes: []string{"S", "M"}})
	c.d2 = testutil.InsertDress(t, tx, testutil.DressFixture{ShopID: a.ID, Title: "Mermaid Lux", Price: 3000, Color: "ivory", Silhouette: "mermaid", Sleeves: "none", Sizes: []string{"M", "L"}})
	c.d3 = testutil.InsertDress(t, tx, testutil.DressFixture{ShopID: b.ID, Title: "Simple A", Price: 800, Color: "champagne", Silhouette: "a_line", Sleeves: "short", Sizes: []string{"XS", "S"}})
	c.d4 = testutil.InsertDress(t, tx, testutil.DressFixture{ShopID: a.ID, Title: "Draft", Hidden: true})
	c.d5 = testutil.InsertDress(t, tx, testutil.DressFixture{ShopID: hidden.ID, Title: "Secret"})
	return c
}

func ids(p dresses.Page) []int64 {
	out := []int64{}
	for _, it := range p.Items {
		out = append(out, it.ID)
	}
	return out
}

func TestListPublicFilters(t *testing.T) {
	e := setup(t)
	c := seed(t, e.tx)
	cases := map[string][]int64{
		"":                     {c.d3, c.d2, c.d1},
		"city=mary":            {c.d3},
		"price_min=1000":       {c.d2, c.d1},
		"price_max=1500":       {c.d3, c.d1},
		"size=M":               {c.d2, c.d1},
		"color=ivory":          {c.d2},
		"style=ball_gown":      {c.d1},
		"sleeves=short":        {c.d3},
		"city=ashgabat&size=S": {c.d1},
		fmt.Sprintf("ids=%d,%d,%d", c.d1, c.d3, c.d4): {c.d3, c.d1},
	}
	for query, want := range cases {
		rec := testutil.Request(t, e.r, http.MethodGet, "/api/dresses?"+query, nil, "")
		if rec.Code != http.StatusOK {
			t.Fatalf("%q: status = %d: %s", query, rec.Code, rec.Body)
		}
		p := testutil.Decode[dresses.Page](t, rec)
		if got := ids(p); !slices.Equal(got, want) || p.Total != len(want) {
			t.Errorf("%q: ids = %v total = %d, want %v", query, got, p.Total, want)
		}
	}
}

func TestListPublicSearch(t *testing.T) {
	e := setup(t)
	c := seed(t, e.tx)
	wh := testutil.InsertShop(t, e.tx, testutil.ShopFixture{Name: "Ak Gelin Wedding House"})
	dWH := testutil.InsertDress(t, e.tx, testutil.DressFixture{ShopID: wh.ID, Title: "Classic"})
	sd := testutil.InsertShop(t, e.tx, testutil.ShopFixture{Name: "Dream Salon", Aliases: []string{"Свадебный дом"}})
	dSD := testutil.InsertDress(t, e.tx, testutil.DressFixture{ShopID: sd.ID, Title: "Lace"})
	cases := map[string][]int64{
		"ak+gelyn": {dWH}, // typo in one word of a multi-word shop name
		"%D0%A1%D0%92%D0%90%D0%94%D0%95%D0%91%D0%9D%D0%AB%D0%99": {dSD}, // Cyrillic alias, one word
		"gelin+oyi":           {c.d2, c.d1, dWH}, // dWH: word-similar to "Ak Gelin Wedding House", ranked last; Latin spelling of the Turkmen name
		"GELIN+%C3%96%C3%9DI": {c.d2, c.d1, dWH}, // "GELIN ÖÝI": case and Turkmen letters ignored
		"bridal":              {c.d2, c.d1},      // alias substring
		"gelim+oyi":           {c.d2, c.d1},      // typo tolerance
		"mermaid":             {c.d2},            // dress title
		"secret":              {},                // hidden shop never matches
		"zzzzqqq":             {},
	}
	for q, want := range cases {
		rec := testutil.Request(t, e.r, http.MethodGet, "/api/dresses?q="+q, nil, "")
		if rec.Code != http.StatusOK {
			t.Fatalf("q=%s: status = %d: %s", q, rec.Code, rec.Body)
		}
		p := testutil.Decode[dresses.Page](t, rec)
		if got := ids(p); !slices.Equal(got, want) {
			t.Errorf("q=%s: ids = %v, want %v", q, got, want)
		}
	}
}

func TestListPublicPagination(t *testing.T) {
	e := setup(t)
	c := seed(t, e.tx)
	p1 := testutil.Decode[dresses.Page](t, testutil.Request(t, e.r, http.MethodGet, "/api/dresses?per_page=2", nil, ""))
	p2 := testutil.Decode[dresses.Page](t, testutil.Request(t, e.r, http.MethodGet, "/api/dresses?per_page=2&page=2", nil, ""))
	if !slices.Equal(ids(p1), []int64{c.d3, c.d2}) || !slices.Equal(ids(p2), []int64{c.d1}) || p1.Total != 3 || p1.PerPage != 2 || p2.Page != 2 {
		t.Fatalf("p1 = %+v, p2 = %+v", p1, p2)
	}
	big := testutil.Decode[dresses.Page](t, testutil.Request(t, e.r, http.MethodGet, "/api/dresses?per_page=500", nil, ""))
	if big.PerPage != 60 {
		t.Fatalf("per_page cap = %d", big.PerPage)
	}
}

func TestListPublicInvalidParams(t *testing.T) {
	e := setup(t)
	for _, q := range []string{"size=XXXL", "price_min=abc", "color=purple", "page=0", "ids=1,x", "page=99999999999999999", "page=10001", "price_min=3000000000"} {
		rec := testutil.Request(t, e.r, http.MethodGet, "/api/dresses?"+q, nil, "")
		if rec.Code != http.StatusBadRequest {
			t.Errorf("%s: status = %d", q, rec.Code)
		}
	}
}

func TestListItemShape(t *testing.T) {
	e := setup(t)
	c := seed(t, e.tx)
	testutil.InsertImage(t, e.tx, c.d1, 1, "second")
	testutil.InsertImage(t, e.tx, c.d1, 0, "first")
	p := testutil.Decode[dresses.Page](t, testutil.Request(t, e.r, http.MethodGet, "/api/dresses?style=ball_gown", nil, ""))
	if len(p.Items) != 1 {
		t.Fatalf("items = %+v, want exactly one", p.Items)
	}
	it := p.Items[0]
	if it.Photo == nil || *it.Photo != "/uploads/first_s.jpg" {
		t.Fatalf("photo = %v", it.Photo)
	}
	if it.Shop.Name != "Gelin Öýi" || it.Shop.Slug != c.shopA.Slug || it.City.NameTK != "Aşgabat" || it.PriceManat != 1500 {
		t.Fatalf("item = %+v", it)
	}
}

func TestGetPublicDress(t *testing.T) {
	e := setup(t)
	c := seed(t, e.tx)
	testutil.InsertImage(t, e.tx, c.d1, 0, "p")
	rec := testutil.Request(t, e.r, http.MethodGet, "/api/dresses/"+strconv.FormatInt(c.d1, 10), nil, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	d := testutil.Decode[dresses.PublicDress](t, rec)
	if d.Title != "Princess" || len(d.Images) != 1 || d.Shop.Phone != "+99365000000" || d.Shop.City.Slug != "ashgabat" {
		t.Fatalf("dress = %+v", d)
	}
	for _, id := range []string{strconv.FormatInt(c.d4, 10), strconv.FormatInt(c.d5, 10), "999999999", "abc"} {
		if rec := testutil.Request(t, e.r, http.MethodGet, "/api/dresses/"+id, nil, ""); rec.Code != http.StatusNotFound {
			t.Errorf("id %s: status = %d", id, rec.Code)
		}
	}
}
