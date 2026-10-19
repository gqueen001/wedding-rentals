package images_test

import (
	"bytes"
	"context"
	"image/color"
	"io/fs"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"

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
	(&images.Handler{DB: e.tx, Storage: images.LocalStorage{Dir: e.dir}}).RegisterAdmin(e.r.Group("/api/admin"))
	return e
}

func (e env) upload(t *testing.T, fields map[string]string, data []byte) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	for k, v := range fields {
		_ = w.WriteField(k, v)
	}
	if data != nil {
		fw, _ := w.CreateFormFile("file", "photo.png")
		_, _ = fw.Write(data)
	}
	_ = w.Close()
	req := httptest.NewRequest(http.MethodPost, "/api/admin/images", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	rec := httptest.NewRecorder()
	e.r.ServeHTTP(rec, req)
	return rec
}

func (e env) fileExists(url string) bool {
	_, err := os.Stat(filepath.Join(e.dir, strings.TrimPrefix(url, "/uploads/")))
	return err == nil
}

func (e env) fileCount(t *testing.T) int {
	n := 0
	_ = filepath.WalkDir(e.dir, func(_ string, d fs.DirEntry, _ error) error {
		if d != nil && !d.IsDir() {
			n++
		}
		return nil
	})
	return n
}

func id(n int64) string { return strconv.FormatInt(n, 10) }

func TestUploadListingImage(t *testing.T) {
	e := setup(t)
	shop := testutil.InsertShop(t, e.tx, testutil.ShopFixture{})
	dress := testutil.InsertDress(t, e.tx, testutil.DressFixture{ShopID: shop.ID})

	rec := e.upload(t, map[string]string{"listing_id": id(dress)}, pngBytes(t, 2000, 1500, color.White))
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body)
	}
	img := testutil.Decode[images.Image](t, rec)
	if img.Width != 1200 || img.Height != 900 || img.Position != 0 {
		t.Fatalf("image = %+v", img)
	}
	if !strings.HasPrefix(img.Small, "/uploads/") || !e.fileExists(img.Small) || !e.fileExists(img.Large) {
		t.Fatalf("files missing for %+v", img)
	}
	second := testutil.Decode[images.Image](t, e.upload(t, map[string]string{"listing_id": id(dress)}, pngBytes(t, 100, 100, color.White)))
	if second.Position != 1 {
		t.Fatalf("second position = %d", second.Position)
	}
}

func TestUploadShopLogoReplacesOld(t *testing.T) {
	e := setup(t)
	shop := testutil.InsertShop(t, e.tx, testutil.ShopFixture{})
	first := testutil.Decode[images.Image](t, e.upload(t, map[string]string{"shop_id": id(shop.ID)}, pngBytes(t, 100, 100, color.White)))
	second := testutil.Decode[images.Image](t, e.upload(t, map[string]string{"shop_id": id(shop.ID)}, pngBytes(t, 100, 100, color.White)))
	if e.fileExists(first.Small) || !e.fileExists(second.Small) {
		t.Fatal("old logo files should be gone, new ones present")
	}
	var logoID int64
	_ = e.tx.QueryRow(context.Background(), `SELECT logo_image_id FROM shops WHERE id = $1`, shop.ID).Scan(&logoID)
	if logoID != second.ID {
		t.Fatalf("logo_image_id = %d, want %d", logoID, second.ID)
	}
}

func TestUploadRejections(t *testing.T) {
	e := setup(t)
	shop := testutil.InsertShop(t, e.tx, testutil.ShopFixture{})
	dress := testutil.InsertDress(t, e.tx, testutil.DressFixture{ShopID: shop.ID})
	img := pngBytes(t, 10, 10, color.White)
	cases := []struct {
		name   string
		fields map[string]string
		data   []byte
		status int
		code   string
	}{
		{"not an image", map[string]string{"listing_id": id(dress)}, []byte("plain text, not an image"), 422, "invalid_image"},
		{"too large", map[string]string{"listing_id": id(dress)}, bytes.Repeat([]byte{0}, 10<<20+512<<10), 413, "file_too_large"},
		{"no owner", map[string]string{}, img, 400, "validation_failed"},
		{"two owners", map[string]string{"listing_id": id(dress), "shop_id": id(shop.ID)}, img, 400, "validation_failed"},
		{"unknown listing", map[string]string{"listing_id": "999999999"}, img, 400, "validation_failed"},
		{"no file", map[string]string{"listing_id": id(dress)}, nil, 400, "validation_failed"},
	}
	for _, tc := range cases {
		rec := e.upload(t, tc.fields, tc.data)
		body := testutil.Decode[testutil.ErrorBody](t, rec)
		if rec.Code != tc.status || body.Error.Code != tc.code {
			t.Errorf("%s: got %d %q, want %d %q", tc.name, rec.Code, body.Error.Code, tc.status, tc.code)
		}
	}
	if n := e.fileCount(t); n != 0 {
		t.Fatalf("%d files left on disk after rejected uploads", n)
	}
}

func TestReorderImages(t *testing.T) {
	e := setup(t)
	shop := testutil.InsertShop(t, e.tx, testutil.ShopFixture{})
	dress := testutil.InsertDress(t, e.tx, testutil.DressFixture{ShopID: shop.ID})
	a := testutil.InsertImage(t, e.tx, dress, 0, "a")
	b := testutil.InsertImage(t, e.tx, dress, 1, "b")
	c := testutil.InsertImage(t, e.tx, dress, 2, "c")

	rec := testutil.Request(t, e.r, http.MethodPatch, "/api/admin/images/order", map[string]any{"ids": []int64{c, a, b}}, "")
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body)
	}
	list, err := images.ListForListing(context.Background(), e.tx, dress)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 3 || list[0].ID != c || list[1].ID != a || list[2].ID != b {
		t.Fatalf("order = %+v", list)
	}
	if list[0].Small != "/uploads/c_s.jpg" {
		t.Fatalf("small url = %q", list[0].Small)
	}
}

func TestReorderRejectsIncompleteOrMixedLists(t *testing.T) {
	e := setup(t)
	shop := testutil.InsertShop(t, e.tx, testutil.ShopFixture{})
	d1 := testutil.InsertDress(t, e.tx, testutil.DressFixture{ShopID: shop.ID})
	d2 := testutil.InsertDress(t, e.tx, testutil.DressFixture{ShopID: shop.ID})
	a := testutil.InsertImage(t, e.tx, d1, 0, "a")
	testutil.InsertImage(t, e.tx, d1, 1, "b")
	x := testutil.InsertImage(t, e.tx, d2, 0, "x")
	for name, ids := range map[string][]int64{"mixed": {a, x}, "incomplete": {a}, "empty": {}} {
		rec := testutil.Request(t, e.r, http.MethodPatch, "/api/admin/images/order", map[string]any{"ids": ids}, "")
		if rec.Code != http.StatusBadRequest {
			t.Errorf("%s: status = %d", name, rec.Code)
		}
	}
}

func TestDeleteImage(t *testing.T) {
	e := setup(t)
	shop := testutil.InsertShop(t, e.tx, testutil.ShopFixture{})
	dress := testutil.InsertDress(t, e.tx, testutil.DressFixture{ShopID: shop.ID})
	img := testutil.Decode[images.Image](t, e.upload(t, map[string]string{"listing_id": id(dress)}, pngBytes(t, 50, 50, color.White)))

	if rec := testutil.Request(t, e.r, http.MethodDelete, "/api/admin/images/"+id(img.ID), nil, ""); rec.Code != http.StatusNoContent {
		t.Fatalf("delete status = %d", rec.Code)
	}
	if e.fileExists(img.Small) || e.fileExists(img.Large) {
		t.Fatal("files still on disk")
	}
	if rec := testutil.Request(t, e.r, http.MethodDelete, "/api/admin/images/"+id(img.ID), nil, ""); rec.Code != http.StatusNotFound {
		t.Fatalf("second delete status = %d", rec.Code)
	}
}
