package web_test

import (
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"wedding-rentals/backend/internal/testutil"
	"wedding-rentals/backend/internal/web"
)

const indexHTML = `<!doctype html><html><head><title>Toý</title></head><body><div id="root"></div></body></html>`

func setup(t *testing.T, withIndex bool) (*gin.Engine, *web.Handler) {
	dir := t.TempDir()
	if withIndex {
		_ = os.WriteFile(filepath.Join(dir, "index.html"), []byte(indexHTML), 0o644)
	}
	_ = os.MkdirAll(filepath.Join(dir, "assets"), 0o755)
	_ = os.WriteFile(filepath.Join(dir, "assets", "app.js"), []byte("console.log(1)"), 0o644)
	h := &web.Handler{Dir: dir, DB: testutil.Tx(t), BaseURL: "https://toy.example"}
	r := gin.New()
	r.NoRoute(h.Serve)
	return r, h
}

func TestServesStaticFilesAndSPAFallback(t *testing.T) {
	r, _ := setup(t, true)
	if rec := testutil.Request(t, r, http.MethodGet, "/assets/app.js", nil, ""); rec.Code != 200 || rec.Body.String() != "console.log(1)" {
		t.Fatalf("asset: %d %q", rec.Code, rec.Body)
	}
	for _, p := range []string{"/", "/dresses", "/admin/shops", "/../../etc/passwd"} {
		rec := testutil.Request(t, r, http.MethodGet, p, nil, "")
		if rec.Code != 200 || !strings.Contains(rec.Body.String(), `<div id="root">`) {
			t.Errorf("%s: %d %q", p, rec.Code, rec.Body)
		}
	}
}

func TestUnknownAPIPathIsJSON404(t *testing.T) {
	r, _ := setup(t, true)
	rec := testutil.Request(t, r, http.MethodGet, "/api/nope", nil, "")
	if rec.Code != 404 || testutil.Decode[testutil.ErrorBody](t, rec).Error.Code != "not_found" {
		t.Fatalf("got %d %q", rec.Code, rec.Body)
	}
}

func TestInjectsOpenGraphForPublishedDress(t *testing.T) {
	r, h := setup(t, true)
	tx := h.DB
	shop := testutil.InsertShop(t, tx, testutil.ShopFixture{Name: "Gelin Öýi & Co"})
	dress := testutil.InsertDress(t, tx, testutil.DressFixture{ShopID: shop.ID, Title: "Princess", Price: 1500})
	testutil.InsertImage(t, tx, dress, 0, "ab/pic")
	hidden := testutil.InsertDress(t, tx, testutil.DressFixture{ShopID: shop.ID, Hidden: true})

	body := testutil.Request(t, r, http.MethodGet, "/dresses/"+strconv.FormatInt(dress, 10), nil, "").Body.String()
	for _, want := range []string{
		`<meta property="og:title" content="Princess · Gelin Öýi &amp; Co">`,
		`<meta property="og:image" content="https://toy.example/uploads/ab/pic_l.jpg">`,
		`<meta property="og:description" content="1500 TMT · Aşgabat">`,
	} {
		if !strings.Contains(body, want) {
			t.Errorf("missing %s in %s", want, body)
		}
	}
	if !strings.Contains(body, `<div id="root">`) {
		t.Fatal("index body missing")
	}
	hiddenBody := testutil.Request(t, r, http.MethodGet, "/dresses/"+strconv.FormatInt(hidden, 10), nil, "").Body.String()
	if strings.Contains(hiddenBody, "og:title") {
		t.Fatal("OG tags leaked for unpublished dress")
	}
}

func TestMissingIndexIs404(t *testing.T) {
	r, _ := setup(t, false)
	if rec := testutil.Request(t, r, http.MethodGet, "/dresses", nil, ""); rec.Code != 404 {
		t.Fatalf("status = %d", rec.Code)
	}
}

func TestMissingUploadIsJSON404(t *testing.T) {
	r, _ := setup(t, true)
	rec := testutil.Request(t, r, http.MethodGet, "/uploads/ab/nope_l.jpg", nil, "")
	if rec.Code != 404 || testutil.Decode[testutil.ErrorBody](t, rec).Error.Code != "not_found" {
		t.Fatalf("got %d %q", rec.Code, rec.Body)
	}
}

func TestOpenGraphEscapesMarkup(t *testing.T) {
	r, h := setup(t, true)
	shop := testutil.InsertShop(t, h.DB, testutil.ShopFixture{Name: `Shop"><script>alert(2)</script>`})
	dress := testutil.InsertDress(t, h.DB, testutil.DressFixture{ShopID: shop.ID, Title: `"><script>alert(1)</script>`, Price: 100})
	body := testutil.Request(t, r, http.MethodGet, "/dresses/"+strconv.FormatInt(dress, 10), nil, "").Body.String()
	if strings.Contains(body, "<script>") {
		t.Fatalf("raw script in output: %s", body)
	}
	if !strings.Contains(body, "&#34;&gt;&lt;script&gt;alert(1)&lt;/script&gt;") {
		t.Fatalf("escaped title missing: %s", body)
	}
}

func TestMissingAssetIsJSON404(t *testing.T) {
	r, _ := setup(t, true)
	for _, p := range []string{"/assets/gone-abc123.js", "/assets/", "/assets"} {
		rec := testutil.Request(t, r, http.MethodGet, p, nil, "")
		if rec.Code != 404 || testutil.Decode[testutil.ErrorBody](t, rec).Error.Code != "not_found" {
			t.Errorf("%s: got %d %q", p, rec.Code, rec.Body)
		}
	}
}

func TestAssetsAreCachedForever(t *testing.T) {
	r, _ := setup(t, true)
	rec := testutil.Request(t, r, http.MethodGet, "/assets/app.js", nil, "")
	if got := rec.Header().Get("Cache-Control"); rec.Code != 200 || got != "public, max-age=31536000, immutable" {
		t.Fatalf("asset: %d Cache-Control %q", rec.Code, got)
	}
	if got := testutil.Request(t, r, http.MethodGet, "/", nil, "").Header().Get("Cache-Control"); got == "public, max-age=31536000, immutable" {
		t.Fatalf("index must not be immutable: %q", got)
	}
}

func TestIndexIsNotCached(t *testing.T) {
	r, _ := setup(t, true)
	for _, p := range []string{"/", "/dresses", "/index.html"} {
		rec := testutil.Request(t, r, http.MethodGet, p, nil, "")
		if got := rec.Header().Get("Cache-Control"); rec.Code != 200 || got != "no-cache" {
			t.Errorf("%s: %d Cache-Control %q", p, rec.Code, got)
		}
	}
}

func TestInjectsContactPhoneMeta(t *testing.T) {
	r, h := setup(t, true)
	h.ContactPhone = "+993 12 34 56 78"
	body := testutil.Request(t, r, http.MethodGet, "/shop/login", nil, "").Body.String()
	if !strings.Contains(body, `<meta name="wr-contact-phone" content="+993 12 34 56 78">`) {
		t.Fatalf("meta missing: %s", body)
	}
	shop := testutil.InsertShop(t, h.DB, testutil.ShopFixture{Name: "Gelin"})
	dress := testutil.InsertDress(t, h.DB, testutil.DressFixture{ShopID: shop.ID, Title: "Princess", Price: 1500})
	body = testutil.Request(t, r, http.MethodGet, "/dresses/"+strconv.FormatInt(dress, 10), nil, "").Body.String()
	if !strings.Contains(body, "wr-contact-phone") || !strings.Contains(body, "og:title") {
		t.Fatalf("dress page needs both: %s", body)
	}
}

func TestContactPhoneMetaIsEscaped(t *testing.T) {
	r, h := setup(t, true)
	h.ContactPhone = `1"><script>x</script>`
	body := testutil.Request(t, r, http.MethodGet, "/shop/login", nil, "").Body.String()
	if strings.Contains(body, "<script>") || !strings.Contains(body, `content="1&#34;&gt;&lt;script&gt;x&lt;/script&gt;"`) {
		t.Fatalf("not escaped: %s", body)
	}
}

func TestNoContactPhoneMetaWhenEmpty(t *testing.T) {
	r, _ := setup(t, true)
	body := testutil.Request(t, r, http.MethodGet, "/shop/login", nil, "").Body.String()
	if strings.Contains(body, "wr-contact-phone") {
		t.Fatalf("unexpected meta: %s", body)
	}
}
