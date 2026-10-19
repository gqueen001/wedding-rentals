package server_test

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"

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
	r := server.New(server.Deps{
		DB:        tx,
		Tokens:    auth.NewTokens(strings.Repeat("k", 32), auth.TokenTTL),
		Limiter:   auth.NewLimiter(5, time.Minute),
		Storage:   images.LocalStorage{Dir: t.TempDir()},
		UploadDir: t.TempDir(),
		WebDir:    t.TempDir(),
		BaseURL:   "http://localhost:8080",
	})

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
