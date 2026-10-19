package auth_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"wedding-rentals/backend/internal/auth"
	"wedding-rentals/backend/internal/testutil"
)

const password = "correct-horse-1"

func setupLogin(t *testing.T) (*gin.Engine, *auth.Tokens, int64) {
	tx := testutil.Tx(t)
	id, err := auth.CreateAdmin(context.Background(), tx, "Admin@Example.com", password)
	if err != nil {
		t.Fatal(err)
	}
	tokens := auth.NewTokens(secret, auth.TokenTTL)
	r := gin.New()
	h := &auth.Handler{DB: tx, Tokens: tokens, Limiter: auth.NewLimiter(5, time.Minute)}
	h.RegisterPublic(r.Group("/api"))
	return r, tokens, id
}

func login(t *testing.T, r http.Handler, email, pw string) (int, testutil.ErrorBody, string) {
	rec := testutil.Request(t, r, http.MethodPost, "/api/admin/login", map[string]string{"email": email, "password": pw}, "")
	if rec.Code == http.StatusOK {
		return rec.Code, testutil.ErrorBody{}, testutil.Decode[struct{ Token string }](t, rec).Token
	}
	return rec.Code, testutil.Decode[testutil.ErrorBody](t, rec), ""
}

func TestLoginSuccess(t *testing.T) {
	r, tokens, id := setupLogin(t)
	code, _, token := login(t, r, " admin@example.com ", password)
	if code != http.StatusOK {
		t.Fatalf("status = %d", code)
	}
	got, err := tokens.Verify(token)
	if err != nil || got != id {
		t.Fatalf("token for %d, %v; want %d", got, err, id)
	}
}

func TestLoginWrongPasswordOrEmail(t *testing.T) {
	r, _, _ := setupLogin(t)
	for _, c := range []struct{ email, pw string }{
		{"admin@example.com", "wrong-password"},
		{"nobody@example.com", password},
	} {
		code, body, _ := login(t, r, c.email, c.pw)
		if code != http.StatusUnauthorized || body.Error.Code != "invalid_credentials" {
			t.Fatalf("%s: got %d %q", c.email, code, body.Error.Code)
		}
	}
}

func TestLoginRateLimited(t *testing.T) {
	r, _, _ := setupLogin(t)
	for i := 0; i < 5; i++ {
		if code, _, _ := login(t, r, "admin@example.com", "nope-nope-nope"); code != http.StatusUnauthorized {
			t.Fatalf("attempt %d: %d", i+1, code)
		}
	}
	code, body, _ := login(t, r, "admin@example.com", password)
	if code != http.StatusTooManyRequests || body.Error.Code != "rate_limited" {
		t.Fatalf("6th attempt: %d %q", code, body.Error.Code)
	}
}

func TestMiddleware(t *testing.T) {
	tokens := auth.NewTokens(secret, auth.TokenTTL)
	r := gin.New()
	r.GET("/protected", auth.Middleware(tokens), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"admin_id": c.GetInt64("admin_id")})
	})
	valid, _ := tokens.Issue(7)
	expired, _ := tokens.WithClock(func() time.Time { return time.Now().Add(-8 * 24 * time.Hour) }).Issue(7)
	cases := map[string]int{"": 401, "garbage": 401, expired: 401, valid: 200}
	for token, want := range cases {
		rec := testutil.Request(t, r, http.MethodGet, "/protected", nil, token)
		if rec.Code != want {
			t.Errorf("token %.10q: status = %d, want %d", token, rec.Code, want)
		}
	}
	rec := testutil.Request(t, r, http.MethodGet, "/protected", nil, valid)
	if got := testutil.Decode[struct {
		AdminID int64 `json:"admin_id"`
	}](t, rec).AdminID; got != 7 {
		t.Fatalf("admin_id = %d", got)
	}
}
