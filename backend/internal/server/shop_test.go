package server_test

import (
	"bytes"
	"context"
	"image"
	"image/color"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"

	"wedding-rentals/backend/internal/auth"
	"wedding-rentals/backend/internal/busydays"
	"wedding-rentals/backend/internal/dresses"
	"wedding-rentals/backend/internal/images"
	"wedding-rentals/backend/internal/server"
	"wedding-rentals/backend/internal/testutil"
)

type shopEnv struct {
	r      *gin.Engine
	tx     pgx.Tx
	tokens *auth.Tokens
}

func newShopEnv(t *testing.T) shopEnv { return newShopEnvWith(t, nil) }

func newShopEnvWith(t *testing.T, uploads *auth.Limiter) shopEnv {
	tx := testutil.Tx(t)
	tokens := auth.NewTokens(strings.Repeat("k", 32), auth.TokenTTL)
	r, err := server.New(server.Deps{
		DB:            tx,
		Tokens:        tokens,
		Limiter:       auth.NewLimiter(100, time.Minute),
		ShopLimiter:   auth.NewLimiter(100, time.Minute),
		UploadLimiter: uploads,
		Storage:       images.LocalStorage{Dir: t.TempDir()},
		UploadDir:     t.TempDir(),
		WebDir:        t.TempDir(),
		BaseURL:       "http://localhost:8080",
	})
	if err != nil {
		t.Fatal(err)
	}
	return shopEnv{r: r, tx: tx, tokens: tokens}
}

type owner struct {
	token  string
	shopID int64
}

func signUp(t *testing.T, e shopEnv, name, phone string) owner {
	t.Helper()
	var city int64
	if err := e.tx.QueryRow(context.Background(), `SELECT id FROM cities WHERE slug = 'ashgabat'`).Scan(&city); err != nil {
		t.Fatal(err)
	}
	rec := testutil.Request(t, e.r, http.MethodPost, "/api/shop/signup", map[string]any{
		"shop_name": name, "city_id": city, "address": "Aşgabat 1", "phone": phone, "password": "long-enough-1",
	}, "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("signup %s: %d %s", name, rec.Code, rec.Body)
	}
	token := testutil.Decode[struct {
		Token string `json:"token"`
	}](t, rec).Token
	me := testutil.Decode[struct {
		Shop struct {
			ID int64 `json:"id"`
		} `json:"shop"`
	}](t, testutil.Request(t, e.r, http.MethodGet, "/api/shop/me", nil, token))
	return owner{token: token, shopID: me.Shop.ID}
}

func dressBody(shopID int64) map[string]any {
	return map[string]any{
		"shop_id": shopID, "title": "Lale", "price_manat": 1500, "color": "ivory", "silhouette": "a_line",
		"sleeves": "long", "sizes": []string{"M"}, "is_published": true,
	}
}

func pngBytes(t *testing.T) []byte {
	img := image.NewRGBA(image.Rect(0, 0, 60, 80))
	for x := 0; x < 60; x++ {
		for y := 0; y < 80; y++ {
			img.Set(x, y, color.RGBA{200, 180, 190, 255})
		}
	}
	var b bytes.Buffer
	if err := png.Encode(&b, img); err != nil {
		t.Fatal(err)
	}
	return b.Bytes()
}

func upload(t *testing.T, e shopEnv, token, field string, id int64) *httptest.ResponseRecorder {
	t.Helper()
	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	fw, _ := w.CreateFormFile("file", "photo.png")
	_, _ = fw.Write(pngBytes(t))
	_ = w.WriteField(field, strconv.FormatInt(id, 10))
	_ = w.Close()
	req := httptest.NewRequest(http.MethodPost, "/api/shop/images", &body)
	req.Header.Set("Content-Type", w.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	e.r.ServeHTTP(rec, req)
	return rec
}

func TestShopOwnersOnlyReachTheirOwnShop(t *testing.T) {
	e := newShopEnv(t)
	a := signUp(t, e, "Ak Gelin", "+99365111111")
	b := signUp(t, e, "Gelin Öýi", "+99365222222")

	// A dress is always created in the owner's own shop, whatever shop_id says.
	rec := testutil.Request(t, e.r, http.MethodPost, "/api/shop/dresses", dressBody(b.shopID), a.token)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", rec.Code, rec.Body)
	}
	dress := testutil.Decode[struct {
		ID     int64 `json:"id"`
		ShopID int64 `json:"shop_id"`
	}](t, rec)
	if dress.ShopID != a.shopID {
		t.Fatalf("dress landed in shop %d, want %d", dress.ShopID, a.shopID)
	}
	dressPath := "/api/shop/dresses/" + strconv.FormatInt(dress.ID, 10)

	// Owner A manages the dress: photo, calendar, update.
	photo := upload(t, e, a.token, "listing_id", dress.ID)
	if photo.Code != http.StatusCreated {
		t.Fatalf("own photo: %d %s", photo.Code, photo.Body)
	}
	imageID := testutil.Decode[struct {
		ID int64 `json:"id"`
	}](t, photo).ID
	logo := upload(t, e, a.token, "shop_id", a.shopID)
	if logo.Code != http.StatusCreated {
		t.Fatalf("own logo: %d %s", logo.Code, logo.Body)
	}
	logoID := testutil.Decode[struct {
		ID int64 `json:"id"`
	}](t, logo).ID
	busyDay := dressPath + "/busy-days/" + time.Now().Add(48*time.Hour).Format("2006-01-02")
	if rec := testutil.Request(t, e.r, http.MethodPut, busyDay, nil, a.token); rec.Code != http.StatusNoContent {
		t.Fatalf("own busy day: %d %s", rec.Code, rec.Body)
	}
	if rec := testutil.Request(t, e.r, http.MethodPut, dressPath, dressBody(a.shopID), a.token); rec.Code != http.StatusOK {
		t.Fatalf("own update: %d %s", rec.Code, rec.Body)
	}

	// Owner B reaches none of it.
	imagePath := "/api/shop/images/" + strconv.FormatInt(imageID, 10)
	for _, req := range []struct{ method, path string }{
		{http.MethodGet, dressPath},
		{http.MethodPut, dressPath},
		{http.MethodDelete, dressPath},
		{http.MethodGet, dressPath + "/busy-days"},
		{http.MethodPut, dressPath + "/busy-days/" + time.Now().Add(72*time.Hour).Format("2006-01-02")},
		{http.MethodDelete, imagePath},
		{http.MethodDelete, "/api/shop/images/" + strconv.FormatInt(logoID, 10)},
		{http.MethodDelete, busyDay},
	} {
		var body any
		if req.method == http.MethodPut && !strings.Contains(req.path, "busy-days") {
			body = dressBody(b.shopID)
		}
		if rec := testutil.Request(t, e.r, req.method, req.path, body, b.token); rec.Code != http.StatusNotFound {
			t.Errorf("B %s %s: status = %d, want 404", req.method, req.path, rec.Code)
		}
	}
	if rec := testutil.Request(t, e.r, http.MethodPatch, "/api/shop/images/order", map[string]any{"ids": []int64{imageID}}, b.token); rec.Code != http.StatusNotFound {
		t.Errorf("B reorder A's photos: status = %d, want 404", rec.Code)
	}
	if rec := upload(t, e, b.token, "listing_id", dress.ID); rec.Code != http.StatusNotFound {
		t.Errorf("B photo on A's dress: status = %d, want 404", rec.Code)
	}
	if rec := upload(t, e, b.token, "shop_id", a.shopID); rec.Code != http.StatusNotFound {
		t.Errorf("B logo on A's shop: status = %d, want 404", rec.Code)
	}

	var logos int
	if err := e.tx.QueryRow(context.Background(), `SELECT count(*) FROM images WHERE id = $1 AND shop_id = $2`, logoID, a.shopID).Scan(&logos); err != nil || logos != 1 {
		t.Errorf("A's logo after B's attempts: count = %d, err = %v", logos, err)
	}

	// Each owner's list shows only their own dresses, even when asking for another shop.
	listB := testutil.Decode[struct {
		Items []struct{} `json:"items"`
	}](t, testutil.Request(t, e.r, http.MethodGet, "/api/shop/dresses?shop_id="+strconv.FormatInt(a.shopID, 10), nil, b.token))
	if len(listB.Items) != 0 {
		t.Errorf("B sees %d of A's dresses", len(listB.Items))
	}

	// Brides see A's published dress; A can delete it.
	pub := testutil.Decode[struct {
		Total int `json:"total"`
	}](t, testutil.Request(t, e.r, http.MethodGet, "/api/dresses", nil, ""))
	if pub.Total != 1 {
		t.Errorf("public dresses = %d, want 1", pub.Total)
	}
	if rec := testutil.Request(t, e.r, http.MethodDelete, dressPath, nil, a.token); rec.Code != http.StatusNoContent {
		t.Errorf("own delete: %d %s", rec.Code, rec.Body)
	}
}

func TestAdminAndShopTokensDoNotCross(t *testing.T) {
	e := newShopEnv(t)
	a := signUp(t, e, "Ak Gelin", "+99365111111")
	adminToken, _ := e.tokens.Issue(1)
	if rec := testutil.Request(t, e.r, http.MethodGet, "/api/admin/shops", nil, a.token); rec.Code != http.StatusUnauthorized {
		t.Errorf("shop token on admin route: status = %d, want 401", rec.Code)
	}
	if rec := testutil.Request(t, e.r, http.MethodGet, "/api/shop/me", nil, adminToken); rec.Code != http.StatusUnauthorized {
		t.Errorf("admin token on shop route: status = %d, want 401", rec.Code)
	}
	if rec := testutil.Request(t, e.r, http.MethodGet, "/api/shop/dresses", nil, ""); rec.Code != http.StatusUnauthorized {
		t.Errorf("no token on shop route: status = %d, want 401", rec.Code)
	}
}

func TestUploadsAreLimitedPerOwner(t *testing.T) {
	e := newShopEnvWith(t, auth.NewLimiter(1, time.Minute))
	a := signUp(t, e, "Ak Gelin", "+99365111111")
	b := signUp(t, e, "Gelin Öýi", "+99365222222")
	if rec := upload(t, e, a.token, "shop_id", a.shopID); rec.Code != http.StatusCreated {
		t.Fatalf("A first upload: %d %s", rec.Code, rec.Body)
	}
	if rec := upload(t, e, a.token, "shop_id", a.shopID); rec.Code != http.StatusTooManyRequests {
		t.Errorf("A second upload: status = %d, want 429", rec.Code)
	}
	if rec := upload(t, e, b.token, "shop_id", b.shopID); rec.Code != http.StatusCreated {
		t.Errorf("B first upload: %d %s", rec.Code, rec.Body)
	}
	// Only uploads are counted: A can still read and edit.
	if rec := testutil.Request(t, e.r, http.MethodGet, "/api/shop/dresses", nil, a.token); rec.Code != http.StatusOK {
		t.Errorf("A list after limit: %d", rec.Code)
	}
}

func TestScopeThatReturnsNoShopFailsClosed(t *testing.T) {
	e := newShopEnv(t)
	r := gin.New()
	zero := func(*gin.Context) int64 { return 0 }
	g := r.Group("/x")
	(&dresses.Handler{DB: e.tx, Storage: images.LocalStorage{Dir: t.TempDir()}, Scope: zero}).RegisterAdmin(g)
	(&images.Handler{DB: e.tx, Storage: images.LocalStorage{Dir: t.TempDir()}, Scope: zero}).RegisterAdmin(g)
	(&busydays.Handler{DB: e.tx, Scope: zero}).RegisterAdmin(g)
	for _, req := range []struct{ method, path string }{
		{http.MethodGet, "/x/dresses"},
		{http.MethodDelete, "/x/dresses/1"},
		{http.MethodDelete, "/x/images/1"},
		{http.MethodGet, "/x/dresses/1/busy-days"},
	} {
		if rec := testutil.Request(t, r, req.method, req.path, nil, ""); rec.Code != http.StatusUnauthorized {
			t.Errorf("%s %s: status = %d, want 401", req.method, req.path, rec.Code)
		}
	}
}
