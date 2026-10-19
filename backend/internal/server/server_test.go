package server_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"wedding-rentals/backend/internal/auth"
	"wedding-rentals/backend/internal/images"
	"wedding-rentals/backend/internal/server"
	"wedding-rentals/backend/internal/testutil"
)

func TestServerWiring(t *testing.T) {
	tx := testutil.Tx(t)
	if _, err := auth.CreateAdmin(context.Background(), tx, "admin@example.com", "super-secret-1"); err != nil {
		t.Fatal(err)
	}
	r, err := server.New(server.Deps{
		DB:        tx,
		Tokens:    auth.NewTokens(strings.Repeat("k", 32), auth.TokenTTL),
		Limiter:   auth.NewLimiter(5, time.Minute),
		Storage:   images.LocalStorage{Dir: t.TempDir()},
		UploadDir: t.TempDir(),
		WebDir:    t.TempDir(),
		BaseURL:   "http://localhost:8080",
	})
	if err != nil {
		t.Fatal(err)
	}

	for path, want := range map[string]int{"/api/health": 200, "/api/cities": 200, "/api/dresses": 200, "/api/admin/shops": 401} {
		if rec := testutil.Request(t, r, http.MethodGet, path, nil, ""); rec.Code != want {
			t.Errorf("%s: status = %d, want %d", path, rec.Code, want)
		}
	}

	rec := testutil.Request(t, r, http.MethodPost, "/api/admin/login",
		map[string]string{"email": "admin@example.com", "password": "super-secret-1"}, "")
	token := testutil.Decode[struct{ Token string }](t, rec).Token
	for _, path := range []string{"/api/admin/shops", "/api/admin/dresses"} {
		if rec := testutil.Request(t, r, http.MethodGet, path, nil, token); rec.Code != 200 {
			t.Errorf("%s with token: status = %d", path, rec.Code)
		}
	}
}

func clientIPFor(t *testing.T, trusted []string) string {
	t.Helper()
	r, err := server.New(server.Deps{
		DB:             testutil.Tx(t),
		Tokens:         auth.NewTokens(strings.Repeat("k", 32), auth.TokenTTL),
		Limiter:        auth.NewLimiter(5, time.Minute),
		Storage:        images.LocalStorage{Dir: t.TempDir()},
		UploadDir:      t.TempDir(),
		WebDir:         t.TempDir(),
		BaseURL:        "http://localhost:8080",
		TrustedProxies: trusted,
	})
	if err != nil {
		t.Fatal(err)
	}
	r.GET("/api/_ip", func(c *gin.Context) { c.String(200, c.ClientIP()) })
	req := httptest.NewRequest(http.MethodGet, "/api/_ip", nil) // RemoteAddr 192.0.2.1:1234
	req.Header.Set("X-Forwarded-For", "203.0.113.9")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	return rec.Body.String()
}

func TestForwardedForIgnoredWithoutTrustedProxies(t *testing.T) {
	if got := clientIPFor(t, nil); got != "192.0.2.1" {
		t.Fatalf("ClientIP = %q", got)
	}
}

func TestForwardedForHonouredFromTrustedProxy(t *testing.T) {
	if got := clientIPFor(t, []string{"192.0.2.0/24"}); got != "203.0.113.9" {
		t.Fatalf("ClientIP = %q", got)
	}
}
