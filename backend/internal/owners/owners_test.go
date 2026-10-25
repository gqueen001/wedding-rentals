package owners_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"

	"wedding-rentals/backend/internal/auth"
	"wedding-rentals/backend/internal/owners"
	"wedding-rentals/backend/internal/shops"
	"wedding-rentals/backend/internal/testutil"
)

var tokens = auth.NewTokens(strings.Repeat("k", 32), auth.TokenTTL)

type env struct {
	r  *gin.Engine
	tx pgx.Tx
}

func setup(t *testing.T) env {
	e := env{r: gin.New(), tx: testutil.Tx(t)}
	h := &owners.Handler{DB: e.tx, Tokens: tokens, Limiter: auth.NewLimiter(100, time.Minute), PhoneLimiter: auth.NewLimiter(10, 15*time.Minute)}
	h.RegisterPublic(e.r.Group("/api"))
	h.RegisterShop(e.r.Group("/api/shop", owners.ShopMiddleware(tokens, e.tx)))
	h.RegisterAdmin(e.r.Group("/api/admin"))
	return e
}

func ashgabat(t *testing.T, tx pgx.Tx) int64 {
	var id int64
	if err := tx.QueryRow(context.Background(), `SELECT id FROM cities WHERE slug = 'ashgabat'`).Scan(&id); err != nil {
		t.Fatal(err)
	}
	return id
}

func signupBody(t *testing.T, tx pgx.Tx, phone string) map[string]any {
	return map[string]any{
		"shop_name": "Ak Gelin", "city_id": ashgabat(t, tx), "address": "Aşgabat, Magtymguly 5",
		"phone": phone, "password": "long-enough-1",
	}
}

func signup(t *testing.T, e env, phone string) string {
	t.Helper()
	rec := testutil.Request(t, e.r, http.MethodPost, "/api/shop/signup", signupBody(t, e.tx, phone), "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("signup: status = %d: %s", rec.Code, rec.Body)
	}
	return testutil.Decode[struct {
		Token string `json:"token"`
	}](t, rec).Token
}

func me(t *testing.T, e env, token string) owners.Me {
	t.Helper()
	rec := testutil.Request(t, e.r, http.MethodGet, "/api/shop/me", nil, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("me: status = %d: %s", rec.Code, rec.Body)
	}
	return testutil.Decode[owners.Me](t, rec)
}

func TestNormalizePhone(t *testing.T) {
	for in, want := range map[string]string{
		"+993 65 12-34-56": "+99365123456",
		"993 65 123456":    "+99365123456",
		"8 65 123456":      "+99365123456",
		"8(65)12-34-56":    "+99365123456",
		"65123456":         "+99365123456",
	} {
		if got, ok := owners.NormalizePhone(in); !ok || got != want {
			t.Errorf("NormalizePhone(%q) = %q, %v; want %q", in, got, ok, want)
		}
	}
	for _, in := range []string{"", "12345", "+7 912 345 67 89", "9 65 123456", "993651234567", "phone"} {
		if got, ok := owners.NormalizePhone(in); ok {
			t.Errorf("NormalizePhone(%q) = %q, want invalid", in, got)
		}
	}
}

func TestSignupCreatesOwnerAndPublicShop(t *testing.T) {
	e := setup(t)
	m := me(t, e, signup(t, e, "+993 65 12-34-56"))
	if m.Phone != "+99365123456" || m.Shop.Name != "Ak Gelin" || !m.Shop.IsPublished {
		t.Fatalf("me = %+v", m)
	}
	if m.Shop.Phone != "+99365123456" || m.Shop.Owner == nil || m.Shop.Owner.ID != m.ID {
		t.Fatalf("shop phone/owner = %q %+v", m.Shop.Phone, m.Shop.Owner)
	}
}

func TestSignupPasswordNeedsSixCharacters(t *testing.T) {
	e := setup(t)
	short := signupBody(t, e.tx, "+99365111111")
	short["password"] = "ab3d5"
	body := testutil.Decode[testutil.ErrorBody](t, testutil.Request(t, e.r, http.MethodPost, "/api/shop/signup", short, ""))
	if body.Error.Fields["password"] != "too_short" {
		t.Fatalf("5 characters: fields = %v, want password too_short", body.Error.Fields)
	}
	ok := signupBody(t, e.tx, "+99365111112")
	ok["password"] = "ab3d5ü"
	if rec := testutil.Request(t, e.r, http.MethodPost, "/api/shop/signup", ok, ""); rec.Code != http.StatusCreated {
		t.Fatalf("6 characters: status = %d: %s", rec.Code, rec.Body)
	}
}

func TestSignupValidation(t *testing.T) {
	e := setup(t)
	body := testutil.Decode[testutil.ErrorBody](t, testutil.Request(t, e.r, http.MethodPost, "/api/shop/signup", map[string]any{}, ""))
	want := map[string]string{"shop_name": "required", "city_id": "required", "address": "required", "phone": "invalid", "password": "too_short"}
	for field, code := range want {
		if body.Error.Fields[field] != code {
			t.Errorf("fields[%s] = %q, want %q (all: %v)", field, body.Error.Fields[field], code, body.Error.Fields)
		}
	}
	bad := signupBody(t, e.tx, "65123456")
	bad["city_id"] = 999999
	body = testutil.Decode[testutil.ErrorBody](t, testutil.Request(t, e.r, http.MethodPost, "/api/shop/signup", bad, ""))
	if body.Error.Fields["city_id"] != "invalid" {
		t.Errorf("unknown city: fields = %v", body.Error.Fields)
	}
}

func TestSignupRejectsATakenPhoneInAnyFormat(t *testing.T) {
	e := setup(t)
	signup(t, e, "+993 65 12-34-56")
	rec := testutil.Request(t, e.r, http.MethodPost, "/api/shop/signup", signupBody(t, e.tx, "8 65 123456"), "")
	body := testutil.Decode[testutil.ErrorBody](t, rec)
	if rec.Code != http.StatusBadRequest || body.Error.Fields["phone"] != "taken" {
		t.Fatalf("status = %d, fields = %v", rec.Code, body.Error.Fields)
	}
}

func TestLogin(t *testing.T) {
	e := setup(t)
	signup(t, e, "+99365123456")
	login := func(phone, password string) int {
		return testutil.Request(t, e.r, http.MethodPost, "/api/shop/login", map[string]any{"phone": phone, "password": password}, "").Code
	}
	if code := login("8 65 12 34 56", "long-enough-1"); code != http.StatusOK {
		t.Errorf("right password: status = %d", code)
	}
	if code := login("+99365123456", "wrong-password"); code != http.StatusUnauthorized {
		t.Errorf("wrong password: status = %d", code)
	}
	if code := login("+99362000000", "long-enough-1"); code != http.StatusUnauthorized {
		t.Errorf("unknown phone: status = %d", code)
	}
}

func TestSignupAndLoginAreRateLimited(t *testing.T) {
	e := env{r: gin.New(), tx: testutil.Tx(t)}
	h := &owners.Handler{DB: e.tx, Tokens: tokens, Limiter: auth.NewLimiter(5, time.Minute), PhoneLimiter: auth.NewLimiter(10, 15*time.Minute)}
	h.RegisterPublic(e.r.Group("/api"))
	for i := 0; i < 5; i++ {
		testutil.Request(t, e.r, http.MethodPost, "/api/shop/login", map[string]any{"phone": "65123456", "password": "x"}, "")
	}
	rec := testutil.Request(t, e.r, http.MethodPost, "/api/shop/signup", signupBody(t, e.tx, "65123456"), "")
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("6th attempt: status = %d", rec.Code)
	}
	if code := testutil.Decode[testutil.ErrorBody](t, rec).Error.Code; code != "rate_limited" {
		t.Fatalf("6th attempt: code = %q, want rate_limited (the per-IP limit)", code)
	}
}

func TestShopMiddlewareRejectsOtherTokens(t *testing.T) {
	e := setup(t)
	good := signup(t, e, "+99365123456")
	id := me(t, e, good).ID
	adminToken, _ := tokens.Issue(id)
	otherSecret, _ := auth.NewTokens(strings.Repeat("x", 32), auth.TokenTTL).IssueShop(id, 0)
	for name, token := range map[string]string{"none": "", "garbage": "abc", "admin token": adminToken, "other secret": otherSecret} {
		if rec := testutil.Request(t, e.r, http.MethodGet, "/api/shop/me", nil, token); rec.Code != http.StatusUnauthorized {
			t.Errorf("%s: status = %d, want 401", name, rec.Code)
		}
	}
	valid, _ := tokens.IssueShop(id, 0)
	if rec := testutil.Request(t, e.r, http.MethodGet, "/api/shop/me", nil, valid); rec.Code != http.StatusOK {
		t.Errorf("valid shop token: status = %d, want 200", rec.Code)
	}
}

func TestPasswordOverBcryptLimitGetsAFieldError(t *testing.T) {
	e := setup(t)
	long := strings.Repeat("я", 37) // 74 bytes
	body := signupBody(t, e.tx, "+99365123456")
	body["password"] = long
	rec := testutil.Request(t, e.r, http.MethodPost, "/api/shop/signup", body, "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("signup: status = %d: %s", rec.Code, rec.Body)
	}
	if f := testutil.Decode[testutil.ErrorBody](t, rec).Error.Fields["password"]; f != "too_long" {
		t.Fatalf("signup: password = %q, want too_long", f)
	}
	token := signup(t, e, "+99365123457")
	path := "/api/admin/shops/" + strconv.FormatInt(me(t, e, token).Shop.ID, 10) + "/owner-password"
	rec = testutil.Request(t, e.r, http.MethodPost, path, map[string]any{"password": long}, "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("set password: status = %d: %s", rec.Code, rec.Body)
	}
	if f := testutil.Decode[testutil.ErrorBody](t, rec).Error.Fields["password"]; f != "too_long" {
		t.Fatalf("set password: password = %q, want too_long", f)
	}
}

func TestAdminSetPasswordSignsTheOwnerOut(t *testing.T) {
	e := setup(t)
	old := signup(t, e, "+99365123456")
	shopID := me(t, e, old).Shop.ID
	path := "/api/admin/shops/" + strconv.FormatInt(shopID, 10) + "/owner-password"
	if rec := testutil.Request(t, e.r, http.MethodPost, path, map[string]any{"password": "short"}, ""); rec.Code != http.StatusBadRequest {
		t.Fatalf("short password: status = %d", rec.Code)
	}
	// Exactly 6 characters: the shortest password an admin may set for an owner.
	if rec := testutil.Request(t, e.r, http.MethodPost, path, map[string]any{"password": "newpw6"}, ""); rec.Code != http.StatusNoContent {
		t.Fatalf("set password: status = %d: %s", rec.Code, rec.Body)
	}
	if rec := testutil.Request(t, e.r, http.MethodGet, "/api/shop/me", nil, old); rec.Code != http.StatusUnauthorized {
		t.Fatalf("old token after reset: status = %d, want 401", rec.Code)
	}
	rec := testutil.Request(t, e.r, http.MethodPost, "/api/shop/login", map[string]any{"phone": "65123456", "password": "newpw6"}, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("login with new password: status = %d", rec.Code)
	}
}

func TestAdminSetPasswordForAShopWithoutOwner(t *testing.T) {
	e := setup(t)
	shop := testutil.InsertShop(t, e.tx, testutil.ShopFixture{})
	path := "/api/admin/shops/" + strconv.FormatInt(shop.ID, 10) + "/owner-password"
	if rec := testutil.Request(t, e.r, http.MethodPost, path, map[string]any{"password": "brand-new-pass"}, ""); rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}

func TestOwnerCannotChangeWhetherTheShopIsPublished(t *testing.T) {
	e := setup(t)
	token := signup(t, e, "+99365123456")
	m := me(t, e, token)
	update := map[string]any{
		"name": "Ak Gelin Täze", "city_id": m.Shop.CityID, "address": "Täze salgy 1", "phone": "+99365123456",
		"aliases": []string{"Ак Гелин"}, "is_published": false,
	}
	rec := testutil.Request(t, e.r, http.MethodPut, "/api/shop/me/shop", update, token)
	got := testutil.Decode[shops.Shop](t, rec)
	if rec.Code != http.StatusOK || got.Name != "Ak Gelin Täze" || !got.IsPublished || got.Slug != m.Shop.Slug {
		t.Fatalf("status = %d, shop = %+v", rec.Code, got)
	}
	// An admin hides the shop; the owner cannot bring it back.
	if _, err := e.tx.Exec(context.Background(), `UPDATE shops SET is_published = false WHERE id = $1`, m.Shop.ID); err != nil {
		t.Fatal(err)
	}
	update["is_published"] = true
	rec = testutil.Request(t, e.r, http.MethodPut, "/api/shop/me/shop", update, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("second update: status = %d: %s", rec.Code, rec.Body)
	}
	got = testutil.Decode[shops.Shop](t, rec)
	if got.IsPublished {
		t.Fatal("owner re-published a hidden shop")
	}
	bad := testutil.Decode[testutil.ErrorBody](t, testutil.Request(t, e.r, http.MethodPut, "/api/shop/me/shop", map[string]any{}, token))
	if bad.Error.Fields["name"] != "required" {
		t.Fatalf("empty update: fields = %v", bad.Error.Fields)
	}
}

func TestDeletingTheShopDeletesTheOwner(t *testing.T) {
	e := setup(t)
	token := signup(t, e, "+99365123456")
	if _, err := e.tx.Exec(context.Background(), `DELETE FROM shops WHERE id = $1`, me(t, e, token).Shop.ID); err != nil {
		t.Fatal(err)
	}
	if rec := testutil.Request(t, e.r, http.MethodGet, "/api/shop/me", nil, token); rec.Code != http.StatusUnauthorized {
		t.Fatalf("token after shop deletion: status = %d, want 401", rec.Code)
	}
}

func TestLoginStopsAfterTenWrongPasswordsForOneNumber(t *testing.T) {
	e := setup(t)
	signup(t, e, "+99365123456")
	login := func(phone, password string) *httptest.ResponseRecorder {
		return testutil.Request(t, e.r, http.MethodPost, "/api/shop/login", map[string]any{"phone": phone, "password": password}, "")
	}
	// A correct password does not count towards the limit.
	if rec := login("65123456", "long-enough-1"); rec.Code != http.StatusOK {
		t.Fatalf("right password: status = %d", rec.Code)
	}
	for i := 0; i < 10; i++ {
		if rec := login("+993 65 12-34-56", "wrong-pass"); rec.Code != http.StatusUnauthorized {
			t.Fatalf("wrong password %d: status = %d", i+1, rec.Code)
		}
	}
	// Locked for this number (however it is typed), even with the right password.
	rec := login("65123456", "long-enough-1")
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("after 10 wrong: status = %d, want 429", rec.Code)
	}
	if code := testutil.Decode[testutil.ErrorBody](t, rec).Error.Code; code != "too_many_attempts" {
		t.Fatalf("code = %q, want too_many_attempts", code)
	}
	// Another number is not affected. An unknown number locks the same way, so the answer never tells
	// whether an account exists.
	for i := 0; i < 10; i++ {
		if rec := login("65999999", "whatever-1"); rec.Code != http.StatusUnauthorized {
			t.Fatalf("unknown number, try %d: status = %d, want 401", i+1, rec.Code)
		}
	}
	rec = login("65999999", "whatever-1")
	if rec.Code != http.StatusTooManyRequests || testutil.Decode[testutil.ErrorBody](t, rec).Error.Code != "too_many_attempts" {
		t.Fatalf("unknown number after 10: status = %d: %s", rec.Code, rec.Body)
	}
	// Input that is not a phone number can't match an account and isn't counted.
	for i := 0; i < 12; i++ {
		if rec := login("not a phone", "whatever-1"); rec.Code != http.StatusUnauthorized {
			t.Fatalf("not a phone, try %d: status = %d, want 401", i+1, rec.Code)
		}
	}
}

func TestCommonPasswordsAreRefused(t *testing.T) {
	e := setup(t)
	for _, pw := range []string{"123456", "qwerty", "111111", "65111222"} {
		body := signupBody(t, e.tx, "+99365111222")
		body["password"] = pw
		got := testutil.Decode[testutil.ErrorBody](t, testutil.Request(t, e.r, http.MethodPost, "/api/shop/signup", body, ""))
		if got.Error.Fields["password"] != "too_common" {
			t.Errorf("signup with %q: fields = %v, want password too_common", pw, got.Error.Fields)
		}
	}
	token := signup(t, e, "+99365123457")
	path := "/api/admin/shops/" + strconv.FormatInt(me(t, e, token).Shop.ID, 10) + "/owner-password"
	rec := testutil.Request(t, e.r, http.MethodPost, path, map[string]any{"password": "password"}, "")
	if rec.Code != http.StatusBadRequest || testutil.Decode[testutil.ErrorBody](t, rec).Error.Fields["password"] != "too_common" {
		t.Fatalf("admin set common password: status = %d: %s", rec.Code, rec.Body)
	}
}
