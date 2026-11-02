package web_test

import (
	"encoding/json"
	"encoding/xml"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"testing"

	"wedding-rentals/backend/internal/testutil"
)

var ldJSON = regexp.MustCompile(`<script type="application/ld\+json">(.*?)</script>`)

// structured returns the page's JSON-LD object.
func structured(t *testing.T, body string) map[string]any {
	t.Helper()
	m := ldJSON.FindStringSubmatch(body)
	if m == nil {
		t.Fatalf("no JSON-LD in %s", body)
	}
	var v map[string]any
	if err := json.Unmarshal([]byte(m[1]), &v); err != nil {
		t.Fatalf("JSON-LD: %v in %s", err, m[1])
	}
	return v
}

func TestHomePageSEO(t *testing.T) {
	r, _ := setup(t, true)
	body := testutil.Request(t, r, http.MethodGet, "/", nil, "").Body.String()
	for _, want := range []string{
		`<title>TOÝBUKJA · toý üçin ähli zat`,
		`<meta name="description" content="Türkmenistanyň kireý salonlaryndaky toý köýnekleri`,
		`<link rel="canonical" href="https://toy.example/">`,
		`<meta property="og:image" content="https://toy.example/icons/icon-512.png">`,
	} {
		if !strings.Contains(body, want) {
			t.Errorf("missing %s", want)
		}
	}
	if strings.Contains(body, "noindex") || strings.Count(body, "<title>") != 1 {
		t.Fatalf("home: %s", body)
	}
	if graph, _ := structured(t, body)["@graph"].([]any); len(graph) != 2 {
		t.Fatalf("home graph: %v", graph)
	}
}

func TestCategoryPagesSEO(t *testing.T) {
	r, _ := setup(t, true)
	for p, title := range map[string]string{"/dresses": "Köýnekler kireýine · TOÝBUKJA", "/c/tents": "Çadyrlar kireýine · TOÝBUKJA"} {
		body := testutil.Request(t, r, http.MethodGet, p+"?city=mary", nil, "").Body.String()
		if !strings.Contains(body, "<title>"+title+"</title>") || !strings.Contains(body, `<link rel="canonical" href="https://toy.example`+p+`">`) {
			t.Errorf("%s: %s", p, body)
		}
	}
	for _, p := range []string{"/c/boats", "/c/dresses"} {
		if rec := testutil.Request(t, r, http.MethodGet, p, nil, ""); rec.Code != 404 {
			t.Errorf("%s: %d", p, rec.Code)
		}
	}
}

func TestShopPageSEO(t *testing.T) {
	r, h := setup(t, true)
	shop := testutil.InsertShop(t, h.DB, testutil.ShopFixture{Name: "Ak Gelin", CitySlug: "mary"})
	testutil.InsertDress(t, h.DB, testutil.DressFixture{ShopID: shop.ID})
	testutil.InsertItem(t, h.DB, testutil.ItemFixture{ShopID: shop.ID, Category: "cars", Title: "Limuzin"})
	rec := testutil.Request(t, r, http.MethodGet, "/shops/"+shop.Slug, nil, "")
	body := rec.Body.String()
	for _, want := range []string{
		`<title>Ak Gelin · Mary · TOÝBUKJA</title>`,
		`content="Ak Gelin: köýnekler, maşynlar kireýine, Mary. Salgysy: Test address 1. Telefon: +99365000000."`,
		`<link rel="canonical" href="https://toy.example/shops/` + shop.Slug + `">`,
		`<meta property="og:type" content="business.business">`,
	} {
		if !strings.Contains(body, want) {
			t.Errorf("missing %s in %s", want, body)
		}
	}
	ld := structured(t, body)
	addr, _ := ld["address"].(map[string]any)
	if rec.Code != 200 || ld["@type"] != "LocalBusiness" || ld["telephone"] != "+99365000000" || addr["addressCountry"] != "TM" {
		t.Fatalf("%d %v", rec.Code, ld)
	}
	hidden := testutil.InsertShop(t, h.DB, testutil.ShopFixture{Hidden: true})
	for _, slug := range []string{hidden.Slug, "no-such-shop"} {
		rec := testutil.Request(t, r, http.MethodGet, "/shops/"+slug, nil, "")
		if rec.Code != 404 || !strings.Contains(rec.Body.String(), "noindex") || strings.Contains(rec.Body.String(), "LocalBusiness") {
			t.Errorf("%s: %d %s", slug, rec.Code, rec.Body)
		}
	}
}

func TestListingStructuredData(t *testing.T) {
	r, h := setup(t, true)
	shop := testutil.InsertShop(t, h.DB, testutil.ShopFixture{Name: "Toý Maşyn"})
	car := testutil.InsertItem(t, h.DB, testutil.ItemFixture{ShopID: shop.ID, Category: "cars", Title: "Ak limuzin", Price: 900})
	id := strconv.FormatInt(car, 10)
	ld := structured(t, testutil.Request(t, r, http.MethodGet, "/items/"+id, nil, "").Body.String())
	offer, _ := ld["offers"].(map[string]any)
	if ld["@type"] != "Product" || ld["name"] != "Ak limuzin" || offer["price"] != float64(900) || offer["priceCurrency"] != "TMT" {
		t.Fatalf("%v", ld)
	}
	// A listing has one address: a car is not a dress.
	if rec := testutil.Request(t, r, http.MethodGet, "/dresses/"+id, nil, ""); rec.Code != 404 {
		t.Fatalf("car under /dresses: %d", rec.Code)
	}
}

func TestPrivatePagesAreNotIndexed(t *testing.T) {
	r, _ := setup(t, true)
	for _, p := range []string{"/admin", "/admin/shops", "/shop", "/shop/profile", "/search?q=gelin", "/favorites", "/more"} {
		rec := testutil.Request(t, r, http.MethodGet, p, nil, "")
		body := rec.Body.String()
		if rec.Code != 200 || !strings.Contains(body, `<meta name="robots" content="noindex">`) || strings.Contains(body, "canonical") {
			t.Errorf("%s: %d %s", p, rec.Code, body)
		}
	}
}

func TestRobotsTxt(t *testing.T) {
	r, _ := setup(t, true)
	rec := testutil.Request(t, r, http.MethodGet, "/robots.txt", nil, "")
	body := rec.Body.String()
	if rec.Code != 200 || !strings.HasPrefix(rec.Header().Get("Content-Type"), "text/plain") {
		t.Fatalf("%d %s", rec.Code, rec.Header().Get("Content-Type"))
	}
	for _, want := range []string{"Disallow: /admin\n", "Disallow: /shop/\n", "Disallow: /shop$\n", "Disallow: /api/\n", "Sitemap: https://toy.example/sitemap.xml\n"} {
		if !strings.Contains(body, want) {
			t.Errorf("missing %q in %s", want, body)
		}
	}
	if strings.Contains(body, "Disallow: /shops") {
		t.Fatal("public shop pages must stay crawlable")
	}
}

func TestSitemapListsPublicPagesOnly(t *testing.T) {
	r, h := setup(t, true)
	shop := testutil.InsertShop(t, h.DB, testutil.ShopFixture{Name: "Ak Gelin"})
	dress := testutil.InsertDress(t, h.DB, testutil.DressFixture{ShopID: shop.ID})
	car := testutil.InsertItem(t, h.DB, testutil.ItemFixture{ShopID: shop.ID, Category: "cars", Title: "Limuzin"})
	draft := testutil.InsertDress(t, h.DB, testutil.DressFixture{ShopID: shop.ID, Hidden: true})
	hiddenShop := testutil.InsertShop(t, h.DB, testutil.ShopFixture{Hidden: true})
	orphan := testutil.InsertDress(t, h.DB, testutil.DressFixture{ShopID: hiddenShop.ID})

	rec := testutil.Request(t, r, http.MethodGet, "/sitemap.xml", nil, "")
	if rec.Code != 200 || !strings.HasPrefix(rec.Header().Get("Content-Type"), "application/xml") {
		t.Fatalf("%d %s", rec.Code, rec.Header().Get("Content-Type"))
	}
	var doc struct {
		URLs []struct {
			Loc     string `xml:"loc"`
			LastMod string `xml:"lastmod"`
		} `xml:"url"`
	}
	if err := xml.Unmarshal(rec.Body.Bytes(), &doc); err != nil {
		t.Fatalf("sitemap is not XML: %v", err)
	}
	locs := map[string]string{}
	for _, u := range doc.URLs {
		locs[u.Loc] = u.LastMod
	}
	base := "https://toy.example"
	for _, want := range []string{"/", "/dresses", "/c/cars", "/c/car-decorations", "/shops/" + shop.Slug,
		"/dresses/" + strconv.FormatInt(dress, 10), "/items/" + strconv.FormatInt(car, 10)} {
		if _, ok := locs[base+want]; !ok {
			t.Errorf("missing %s", want)
		}
	}
	if locs[base+"/shops/"+shop.Slug] == "" {
		t.Error("shop has no lastmod")
	}
	for _, not := range []string{"/shops/" + hiddenShop.Slug, "/dresses/" + strconv.FormatInt(draft, 10), "/dresses/" + strconv.FormatInt(orphan, 10)} {
		if _, ok := locs[base+not]; ok {
			t.Errorf("listed %s", not)
		}
	}
}
