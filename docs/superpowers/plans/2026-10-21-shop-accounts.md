# Shop Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rental shops sign up with a phone number and password, and then manage their own shop page by themselves: shop details, dresses, photos and the busy/free calendar. The only new admin tool is setting a new password for an owner.

**Architecture:**
- **Backend:**
  - JWTs gain an audience (`admin` or `shop`).
  - A new package, `internal/owners`, holds:
    - phone normalization;
    - the `shop_owners` repository;
    - sign-up, sign-in and `/api/shop/me`;
    - the shop middleware;
    - the admin set-password handler.
  - The existing dresses, images and busy-days handlers gain an optional `Scope` function. The server mounts them a second time under `/api/shop`, with `Scope: owners.ShopID`, so an owner can reach nothing outside their own shop. No business logic is copied.
- **Frontend:**
  - `createApi` builds the dress, photo and calendar calls once per base path (`/api/admin` and `/api/shop`).
  - A Solid context, `ManageContext` in `lib/manage.ts`, tells the shared editors (`PhotoManager`, `LogoUpload`, `AvailabilityEditor`, the dress editor) which set of calls and links to use. The admin layout provides the admin set and the new "My shop" layout provides the owner set.
  - The new owner pages live in `src/pages/shop/`.

**Tech Stack:** Go 1.27 with Gin, pgx v5, goose migrations, golang-jwt v5 and PostgreSQL 17 (backend); Solid 1.9, @solidjs/router, Vite 7, Tailwind 4 and Deno 2.4 (frontend). There are no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-21-shop-accounts-design.md`

**Where this plan differs from the spec's §8 code structure** (the behaviour is the same):
- The admin token methods keep their names, `Issue` and `Verify`, and now accept only `aud: admin`. The spec calls them `IssueAdmin` and `VerifyAdmin`; keeping the names avoids touching every caller.
- There is no `internal/ownerapi` package. The existing handlers take a `Scope` function instead, which removes the need for wrapper copies.
- `ManageApi` covers dresses, photos, uploads and busy days. The shop details form body is shared as the `ShopFields` component, and "My shop" saves it through `ownerApi.owner.updateShop`.

## Global Constraints

- **Ownership:**
  - Owner endpoints take the shop only from the request context (`owners.ShopID`), never from the request body or query.
  - Any dress, image or busy-day id outside the owner's shop answers 404 `not_found`.
  - Owners can never change `shops.is_published`.
- **Phone:** strip everything except digits. 11 digits starting with `993` keep the last 8; 9 digits starting with `8` drop the `8`. Exactly 8 digits then become `+993` followed by those digits; anything else is invalid. One phone number is one account.
- **Passwords:** bcrypt via the existing `auth.HashPassword`, at least 10 characters (`password: "too_short"`).
- **Tokens:**
  - Admin tokens carry `aud: "admin"`. Shop tokens carry `aud: "shop"` and `ver` = the owner's `token_version`. Each middleware rejects the other's tokens and tokens without an audience.
  - An admin setting a new password increments `token_version`, which signs the owner out everywhere.
  - The frontend stores the shop token under the localStorage key `wr.shop_token` and the admin token under `wr.admin_token`, as before.
- **Rate limit:** shop sign-up and sign-in share one limiter, 5 attempts per minute per IP, separate from the admin limiter.
- **Errors:** they use the existing envelope `{"error":{"code","message","fields?"}}`.
- **Text:**
  - Every user-visible string goes through `frontend/src/i18n/{tk,ru,en}.json`, with identical keys and placeholders, which a test enforces.
  - The keys are typed, so `deno task check` fails on any key missing from `en.json`.
  - New field values: `taken` and `too_short`.
- **Look:** Gyrmyzy tokens only (garnet, blush, veil, silver-ink and so on). There are no new colors, shadows or gradients.
- **Keyboard and reading order:** use the existing `Field.tsx` components, which take care of labels, `aria-invalid` and `aria-describedby`.
- **Backend tests:**
  - Go tests run against the real test database through `internal/testutil`, each inside a rolled-back transaction.
  - Run them from `backend/` with `set -a; . ./.env; set +a`, then `GOPROXY=off go test -count=1 ./internal/<pkg>/`.
  - `proxy.golang.org` is DNS-blocked on this network. Never run `go env -w`.
- **Frontend tools:** they run only through Deno, from `frontend/`: `deno task test`, `deno task check` and `deno task build`. Never run Vite with Node.
- **Data:** never write to the `wedding_dev` database. It holds the product owner's real shops.
- **Commits:** every commit message ends with the `Co-Authored-By:` trailer line the controller gives you.

## File Map

```
backend/internal/auth/tokens.go                    (modify) audiences, IssueShop, VerifyShop
backend/internal/auth/tokens_test.go               (modify) audience tests
backend/migrations/00004_shop_owners.sql           shop_owners table; drop shops.owner_user_id
backend/internal/shops/model.go                    (modify) Shop.Owner, type Owner
backend/internal/shops/repo.go                     (modify) join shop_owners in selectShop/scanShop
backend/internal/shops/handler.go                  (modify) exported Check used by bindInput
backend/internal/owners/phone.go                   NormalizePhone
backend/internal/owners/repo.go                    Owner, create, phoneTaken, byPhone, byID, setPasswordForShop
backend/internal/owners/handler.go                 Handler: signup, login, me, updateShop, setPassword
backend/internal/owners/middleware.go              ShopMiddleware, ShopID
backend/internal/owners/owners_test.go
backend/internal/dresses/handler.go                (modify) Scope, own()
backend/internal/images/handler.go                 (modify) Scope checks in upload, reorder, delete
backend/internal/busydays/handler.go, repo.go      (modify) Scope; dressExists takes shopID
backend/internal/server/server.go                  (modify) owners routes, /api/shop group, ShopLimiter
backend/internal/server/shop_test.go               cross-shop access and token separation
frontend/src/lib/types.ts                          (modify) AdminShop.owner, SignupInput, ShopMe
frontend/src/lib/api.ts                            (modify) manage(base), admin.setOwnerPassword, owner.*, ManageCalls
frontend/src/lib/upload.ts                         (modify) path dependency, Uploader type
frontend/src/lib/auth.ts                           (modify) storage key parameter
frontend/src/lib/shopAuth.ts                       shopAuth (wr.shop_token)
frontend/src/lib/client.ts                         (modify) ownerApi, uploadOwnerImage
frontend/src/lib/manage.ts                         Manage, ManageContext, useManage, adminManage, ownerManage
frontend/src/lib/{api,auth,manage,forms}_test.ts   tests
frontend/src/components/admin/PhotoManager.tsx     (modify) useManage
frontend/src/components/admin/LogoUpload.tsx       (modify) useManage
frontend/src/components/admin/AvailabilityEditor.tsx (modify) useManage
frontend/src/components/admin/ShopFields.tsx       shared shop form body
frontend/src/pages/admin/DressEdit.tsx             (modify) useManage; shop select only for admins
frontend/src/pages/admin/ShopEdit.tsx              (modify) ShopFields; owner box (Task 7)
frontend/src/pages/admin/AdminLayout.tsx           (modify) provides adminManage
frontend/src/lib/forms.ts                          (modify) ownerReturnPath
frontend/src/lib/areas.ts, areas_test.ts           hasOwnChrome
frontend/src/app/App.tsx                           (modify) own chrome for /shop; footer sign-up link
frontend/src/main.tsx                              (modify) /shop routes
frontend/src/pages/shop/ShopLayout.tsx             guard, header, provides ownerManage
frontend/src/pages/shop/ShopLogin.tsx              phone sign-in
frontend/src/pages/shop/ShopSignup.tsx             sign-up
frontend/src/pages/shop/MyShop.tsx                 dashboard: banner, dresses, details, logo
frontend/src/components/admin/OwnerPassword.tsx    admin's Set new password box
frontend/src/pages/admin/Shops.tsx                 (modify) "Managed by owner" badge
frontend/src/i18n/{en,ru,tk}.json, i18n_test.ts    (modify) texts, field values
```

## How to read the steps

- **Full files:** a path in backticks at the start of a line, directly followed by a code block, gives the **whole file**. Create or overwrite it with exactly that content. From the repository root you can extract it with:
  `python3 -I .superpowers/sdd/acct/block.py <brief> <path> > <path>`
- **Replacements:** "In `path`, replace:" gives an exact text to find (it occurs once) and the text to put in its place.
- **Appends:** "Append to `path`:" gives text to add at the very end of the file.

---

### Task 1: Token audiences

**Files:**
- Modify: `backend/internal/auth/tokens.go`
- Test: `backend/internal/auth/tokens_test.go`

**Interfaces:**
- Consumes: the existing `Tokens`, `NewTokens`, `TokenTTL` and `WithClock`.
- Produces:
  - `const AudienceAdmin = "admin"` and `const AudienceShop = "shop"`
  - `(*Tokens).Issue(adminID int64) (string, error)` and `(*Tokens).Verify(token string) (int64, error)`, now admin-only
  - `(*Tokens).IssueShop(ownerID int64, version int) (string, error)`
  - `(*Tokens).VerifyShop(token string) (ownerID int64, version int, err error)`

- [ ] **Step 1: Write the failing tests**

`backend/internal/auth/tokens_test.go`
```go
package auth_test

import (
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"wedding-rentals/backend/internal/auth"
)

var secret = strings.Repeat("k", 32)

func TestIssueAndVerify(t *testing.T) {
	tok := auth.NewTokens(secret, auth.TokenTTL)
	s, err := tok.Issue(42)
	if err != nil {
		t.Fatal(err)
	}
	id, err := tok.Verify(s)
	if err != nil || id != 42 {
		t.Fatalf("Verify = %d, %v", id, err)
	}
}

func TestVerifyRejectsOtherSecret(t *testing.T) {
	s, _ := auth.NewTokens(strings.Repeat("x", 32), auth.TokenTTL).Issue(1)
	if _, err := auth.NewTokens(secret, auth.TokenTTL).Verify(s); err == nil {
		t.Fatal("expected signature error")
	}
}

func TestVerifyRejectsExpired(t *testing.T) {
	past := func() time.Time { return time.Now().Add(-8 * 24 * time.Hour) }
	s, _ := auth.NewTokens(secret, auth.TokenTTL).WithClock(past).Issue(1)
	if _, err := auth.NewTokens(secret, auth.TokenTTL).Verify(s); err == nil {
		t.Fatal("expected expiry error")
	}
}

func TestAudiencesAreSeparate(t *testing.T) {
	tok := auth.NewTokens(secret, auth.TokenTTL)
	admin, _ := tok.Issue(7)
	shop, _ := tok.IssueShop(7, 3)
	if _, err := tok.Verify(shop); err == nil {
		t.Fatal("admin Verify accepted a shop token")
	}
	if _, _, err := tok.VerifyShop(admin); err == nil {
		t.Fatal("VerifyShop accepted an admin token")
	}
	id, ver, err := tok.VerifyShop(shop)
	if err != nil || id != 7 || ver != 3 {
		t.Fatalf("VerifyShop = %d, %d, %v", id, ver, err)
	}
}

// A token minted before audiences existed (no aud claim) is rejected everywhere.
func TestVerifyRejectsTokensWithoutAudience(t *testing.T) {
	legacy := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{
		Subject:   "7",
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
	})
	s, err := legacy.SignedString([]byte(secret))
	if err != nil {
		t.Fatal(err)
	}
	tok := auth.NewTokens(secret, auth.TokenTTL)
	if _, err := tok.Verify(s); err == nil {
		t.Fatal("Verify accepted a token without an audience")
	}
	if _, _, err := tok.VerifyShop(s); err == nil {
		t.Fatal("VerifyShop accepted a token without an audience")
	}
}
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd backend && set -a; . ./.env; set +a; GOPROXY=off go test -count=1 ./internal/auth/`
Expected: FAIL to compile, with `tok.IssueShop undefined` and `tok.VerifyShop undefined`.

- [ ] **Step 3: Implement audiences**

`backend/internal/auth/tokens.go`
```go
package auth

import (
	"errors"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const TokenTTL = 7 * 24 * time.Hour

// Audiences keep admin and shop-owner tokens apart: each middleware accepts only its own.
const (
	AudienceAdmin = "admin"
	AudienceShop  = "shop"
)

type Tokens struct {
	secret []byte
	ttl    time.Duration
	now    func() time.Time
}

func NewTokens(secret string, ttl time.Duration) *Tokens {
	return &Tokens{secret: []byte(secret), ttl: ttl, now: time.Now}
}

// WithClock returns a copy that reads the time from now (tests use it for expiry).
func (t *Tokens) WithClock(now func() time.Time) *Tokens {
	c := *t
	c.now = now
	return &c
}

type claims struct {
	jwt.RegisteredClaims
	// Version is the shop owner's token_version; admin tokens leave it zero.
	Version int `json:"ver,omitempty"`
}

func (t *Tokens) issue(audience string, id int64, version int) (string, error) {
	now := t.now()
	c := claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   strconv.FormatInt(id, 10),
			Audience:  jwt.ClaimStrings{audience},
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(t.ttl)),
		},
		Version: version,
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString(t.secret)
}

func (t *Tokens) verify(audience, token string) (int64, int, error) {
	c := &claims{}
	_, err := jwt.ParseWithClaims(token, c,
		func(*jwt.Token) (any, error) { return t.secret, nil },
		jwt.WithValidMethods([]string{"HS256"}),
		jwt.WithTimeFunc(t.now),
		jwt.WithExpirationRequired(),
		jwt.WithAudience(audience),
	)
	if err != nil {
		return 0, 0, err
	}
	id, err := strconv.ParseInt(c.Subject, 10, 64)
	if err != nil || id <= 0 {
		return 0, 0, errors.New("invalid token subject")
	}
	return id, c.Version, nil
}

// Issue signs an admin token for adminID.
func (t *Tokens) Issue(adminID int64) (string, error) { return t.issue(AudienceAdmin, adminID, 0) }

// Verify accepts only admin tokens and returns the admin's id.
func (t *Tokens) Verify(token string) (int64, error) {
	id, _, err := t.verify(AudienceAdmin, token)
	return id, err
}

// IssueShop signs a shop-owner token carrying the owner's current token version.
func (t *Tokens) IssueShop(ownerID int64, version int) (string, error) {
	return t.issue(AudienceShop, ownerID, version)
}

// VerifyShop accepts only shop-owner tokens and returns the owner's id and token version.
func (t *Tokens) VerifyShop(token string) (ownerID int64, version int, err error) {
	return t.verify(AudienceShop, token)
}
```

- [ ] **Step 4: Run the auth tests and the whole suite**

Run: `GOPROXY=off go test -count=1 ./internal/auth/ && GOPROXY=off go test -count=1 ./... && go vet ./... && gofmt -l .`
Expected:
- every package prints `ok`;
- `gofmt -l` prints nothing.

The admin middleware and login keep working unchanged, because they call `Issue` and `Verify`.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/auth/tokens.go backend/internal/auth/tokens_test.go
git commit -m "feat(backend): token audiences keep admin and shop tokens apart"
```

---

### Task 2: Shop owner accounts: sign-up, sign-in, "me", admin set-password

**Files:**
- Create:
  - `backend/migrations/00004_shop_owners.sql`
  - `backend/internal/owners/phone.go`
  - `backend/internal/owners/repo.go`
  - `backend/internal/owners/handler.go`
  - `backend/internal/owners/middleware.go`
- Modify:
  - `backend/internal/shops/model.go`
  - `backend/internal/shops/repo.go`
  - `backend/internal/shops/handler.go`
  - `backend/internal/server/server.go`
- Test: `backend/internal/owners/owners_test.go`

**Interfaces:**
- Consumes:
  - from Task 1: `auth.Tokens.IssueShop` and `VerifyShop`;
  - existing: `auth.HashPassword` and `auth.CheckPassword`, `auth.Limiter` (`Allow(ip) bool`), `httpx.BindJSON`, `httpx.Abort`, `httpx.Validation`, `httpx.New`, `httpx.ParseID`, `db.DBTX`, `db.InTx`, `shops.Input`, `shops.Create`, `shops.Get` and `shops.Update`;
  - test helpers: `testutil.Tx`, `testutil.Request`, `testutil.Decode`, `testutil.ErrorBody` and `testutil.InsertShop`.
- Produces:
  - `shops.Shop.Owner *shops.Owner` (`json:"owner"`) and `type shops.Owner struct { ID int64; Phone string }`
  - `shops.Check(ctx, d db.DBTX, in *shops.Input) (map[string]string, error)`
  - `owners.NormalizePhone(s string) (string, bool)`
  - `owners.Handler{DB db.DBTX; Tokens *auth.Tokens; Limiter *auth.Limiter}` with:
    - `RegisterPublic(g)`: `POST /shop/signup` and `POST /shop/login`;
    - `RegisterShop(g)`: `GET /me` and `PUT /me/shop`;
    - `RegisterAdmin(g)`: `POST /shops/:id/owner-password`.
  - `owners.Me{ID int64; Phone string; Shop shops.Shop}`
  - `owners.ShopMiddleware(t *auth.Tokens, d db.DBTX) gin.HandlerFunc`
  - `owners.ShopID(c *gin.Context) int64`, which Task 3 uses as the `Scope`
  - `server.Deps.ShopLimiter *auth.Limiter`

- [ ] **Step 1: Add the migration**

`backend/migrations/00004_shop_owners.sql` must be exactly this. The test database may already have it applied, and goose identifies migrations by version number.

`backend/migrations/00004_shop_owners.sql`
```sql
-- +goose Up
CREATE TABLE shop_owners (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id       bigint NOT NULL UNIQUE REFERENCES shops(id) ON DELETE CASCADE,
  phone         text NOT NULL UNIQUE,          -- normalized +993XXXXXXXX
  password_hash text NOT NULL,
  token_version int  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- The v1 placeholder for ownership is replaced by shop_owners.shop_id.
ALTER TABLE shops DROP COLUMN owner_user_id;

-- +goose Down
ALTER TABLE shops ADD COLUMN owner_user_id bigint;
DROP TABLE IF EXISTS shop_owners;
```

- [ ] **Step 2: Show the owner on shops**

In `backend/internal/shops/model.go`, replace:
```go
	Aliases      []string      `json:"aliases"`
	CreatedAt    time.Time     `json:"created_at"`
	UpdatedAt    time.Time     `json:"updated_at"`
}
```
with:
```go
	Aliases      []string      `json:"aliases"`
	Owner        *Owner        `json:"owner"`
	CreatedAt    time.Time     `json:"created_at"`
	UpdatedAt    time.Time     `json:"updated_at"`
}

// Owner is the shop-owner account that manages a shop, if it has one.
type Owner struct {
	ID    int64  `json:"id"`
	Phone string `json:"phone"`
}
```

In `backend/internal/shops/repo.go`, replace:
```go
	       li.id, li.position, li.path_small, li.path_large, li.width, li.height
	FROM shops s
	LEFT JOIN images li ON li.id = s.logo_image_id`
```
with:
```go
	       li.id, li.position, li.path_small, li.path_large, li.width, li.height,
	       o.id, o.phone
	FROM shops s
	LEFT JOIN images li ON li.id = s.logo_image_id
	LEFT JOIN shop_owners o ON o.shop_id = s.id`
```

In `backend/internal/shops/repo.go`, replace:
```go
	var logoSmall, logoLarge *string
	err := row.Scan(&s.ID, &s.Slug, &s.Name, &s.CityID, &s.Address, &s.Phone, &s.InstagramURL, &s.TikTokURL,
		&s.Description, &s.IsPublished, &s.CreatedAt, &s.UpdatedAt, &s.Aliases,
		&logoID, &logoPos, &logoSmall, &logoLarge, &logoW, &logoH)
```
with:
```go
	var logoSmall, logoLarge *string
	var ownerID *int64
	var ownerPhone *string
	err := row.Scan(&s.ID, &s.Slug, &s.Name, &s.CityID, &s.Address, &s.Phone, &s.InstagramURL, &s.TikTokURL,
		&s.Description, &s.IsPublished, &s.CreatedAt, &s.UpdatedAt, &s.Aliases,
		&logoID, &logoPos, &logoSmall, &logoLarge, &logoW, &logoH, &ownerID, &ownerPhone)
```

In `backend/internal/shops/repo.go`, replace:
```go
			Large: images.URL(*logoLarge), Width: *logoW, Height: *logoH}
	}
	return s, nil
```
with:
```go
			Large: images.URL(*logoLarge), Width: *logoW, Height: *logoH}
	}
	if ownerID != nil {
		s.Owner = &Owner{ID: *ownerID, Phone: *ownerPhone}
	}
	return s, nil
```

- [ ] **Step 3: Export the shop checks**

The owner's sign-up and shop-details endpoints must validate exactly like the admin's.

In `backend/internal/shops/handler.go`, replace:
```go
import (
	"net/http"
```
with:
```go
import (
	"context"
	"net/http"
```

In `backend/internal/shops/handler.go`, replace:
```go
	if !httpx.BindJSON(c, &in) {
		return in, false
	}
	in.normalize()
	errs := in.validate()
	if _, bad := errs["city_id"]; !bad {
		var exists bool
		if err := h.DB.QueryRow(c.Request.Context(), `SELECT EXISTS(SELECT 1 FROM cities WHERE id = $1)`, in.CityID).Scan(&exists); err != nil {
			httpx.Abort(c, err)
			return in, false
		}
		if !exists {
			errs["city_id"] = "invalid"
		}
	}
	if len(errs) > 0 {
		httpx.Abort(c, httpx.Validation(errs))
		return in, false
	}
	return in, true
}
```
with:
```go
	if !httpx.BindJSON(c, &in) {
		return in, false
	}
	errs, err := Check(c.Request.Context(), h.DB, &in)
	if err != nil {
		httpx.Abort(c, err)
		return in, false
	}
	if len(errs) > 0 {
		httpx.Abort(c, httpx.Validation(errs))
		return in, false
	}
	return in, true
}

// Check normalizes in and returns its field errors, including whether the city exists.
// Admins and shop owners save shops through the same rules.
func Check(ctx context.Context, d db.DBTX, in *Input) (map[string]string, error) {
	in.normalize()
	errs := in.validate()
	if _, bad := errs["city_id"]; !bad {
		var exists bool
		if err := d.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM cities WHERE id = $1)`, in.CityID).Scan(&exists); err != nil {
			return nil, err
		}
		if !exists {
			errs["city_id"] = "invalid"
		}
	}
	return errs, nil
}
```

Run: `GOPROXY=off go test -count=1 ./internal/shops/ ./internal/dresses/ ./internal/web/`
Expected: `ok` for all three. The migration runs on the test database the first time.

- [ ] **Step 4: Write the failing owner tests**

`backend/internal/owners/owners_test.go`
```go
package owners_test

import (
	"context"
	"net/http"
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
	h := &owners.Handler{DB: e.tx, Tokens: tokens, Limiter: auth.NewLimiter(100, time.Minute)}
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
	h := &owners.Handler{DB: e.tx, Tokens: tokens, Limiter: auth.NewLimiter(5, time.Minute)}
	h.RegisterPublic(e.r.Group("/api"))
	for i := 0; i < 5; i++ {
		testutil.Request(t, e.r, http.MethodPost, "/api/shop/login", map[string]any{"phone": "65123456", "password": "x"}, "")
	}
	rec := testutil.Request(t, e.r, http.MethodPost, "/api/shop/signup", signupBody(t, e.tx, "65123456"), "")
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("6th attempt: status = %d", rec.Code)
	}
}

func TestShopMiddlewareRejectsOtherTokens(t *testing.T) {
	e := setup(t)
	signup(t, e, "+99365123456")
	adminToken, _ := tokens.Issue(1)
	otherSecret, _ := auth.NewTokens(strings.Repeat("x", 32), auth.TokenTTL).IssueShop(1, 0)
	for name, token := range map[string]string{"none": "", "garbage": "abc", "admin token": adminToken, "other secret": otherSecret} {
		if rec := testutil.Request(t, e.r, http.MethodGet, "/api/shop/me", nil, token); rec.Code != http.StatusUnauthorized {
			t.Errorf("%s: status = %d, want 401", name, rec.Code)
		}
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
	if rec := testutil.Request(t, e.r, http.MethodPost, path, map[string]any{"password": "brand-new-pass"}, ""); rec.Code != http.StatusNoContent {
		t.Fatalf("set password: status = %d: %s", rec.Code, rec.Body)
	}
	if rec := testutil.Request(t, e.r, http.MethodGet, "/api/shop/me", nil, old); rec.Code != http.StatusUnauthorized {
		t.Fatalf("old token after reset: status = %d, want 401", rec.Code)
	}
	rec := testutil.Request(t, e.r, http.MethodPost, "/api/shop/login", map[string]any{"phone": "65123456", "password": "brand-new-pass"}, "")
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
	got = testutil.Decode[shops.Shop](t, testutil.Request(t, e.r, http.MethodPut, "/api/shop/me/shop", update, token))
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
```

Run: `GOPROXY=off go test -count=1 ./internal/owners/`
Expected: FAIL to compile, because package `owners` has no non-test files yet.

- [ ] **Step 5: Implement the owners package**

`backend/internal/owners/phone.go`
```go
// Package owners lets rental shops sign up and manage their own shop.
package owners

import "strings"

// NormalizePhone turns a Turkmen phone number as people type it ("+993 65 12-34-56",
// "8 65 123456", "65123456") into "+99365123456". It reports false for anything else.
func NormalizePhone(s string) (string, bool) {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	digits := b.String()
	switch {
	case len(digits) == 11 && strings.HasPrefix(digits, "993"):
		digits = digits[3:]
	case len(digits) == 9 && strings.HasPrefix(digits, "8"):
		digits = digits[1:]
	}
	if len(digits) != 8 {
		return "", false
	}
	return "+993" + digits, true
}
```

`backend/internal/owners/repo.go`
```go
package owners

import (
	"context"

	"github.com/jackc/pgx/v5"

	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/shops"
)

// Owner is a shop-owner account. Each owner manages exactly one shop.
type Owner struct {
	ID           int64
	ShopID       int64
	Phone        string
	PasswordHash string
	TokenVersion int
}

const selectOwner = `SELECT id, shop_id, phone, password_hash, token_version FROM shop_owners`

func scanOwner(row pgx.Row) (Owner, error) {
	var o Owner
	err := row.Scan(&o.ID, &o.ShopID, &o.Phone, &o.PasswordHash, &o.TokenVersion)
	return o, err
}

// create makes the shop (public at once) and its owner in one transaction.
func create(ctx context.Context, d db.DBTX, shop shops.Input, phone, passwordHash string) (Owner, error) {
	var o Owner
	err := db.InTx(ctx, d, func(tx pgx.Tx) error {
		shopID, err := shops.Create(ctx, tx, shop)
		if err != nil {
			return err
		}
		o, err = scanOwner(tx.QueryRow(ctx, `
			INSERT INTO shop_owners (shop_id, phone, password_hash) VALUES ($1, $2, $3)
			RETURNING id, shop_id, phone, password_hash, token_version`, shopID, phone, passwordHash))
		return err
	})
	return o, err
}

func phoneTaken(ctx context.Context, d db.DBTX, phone string) (bool, error) {
	var taken bool
	err := d.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM shop_owners WHERE phone = $1)`, phone).Scan(&taken)
	return taken, err
}

func byPhone(ctx context.Context, d db.DBTX, phone string) (Owner, error) {
	return scanOwner(d.QueryRow(ctx, selectOwner+` WHERE phone = $1`, phone))
}

func byID(ctx context.Context, d db.DBTX, id int64) (Owner, error) {
	return scanOwner(d.QueryRow(ctx, selectOwner+` WHERE id = $1`, id))
}

// setPasswordForShop replaces the password of the shop's owner and bumps the token
// version, which signs the owner out everywhere. pgx.ErrNoRows means the shop has no owner.
func setPasswordForShop(ctx context.Context, d db.DBTX, shopID int64, passwordHash string) error {
	tag, err := d.Exec(ctx, `
		UPDATE shop_owners SET password_hash = $2, token_version = token_version + 1, updated_at = now()
		WHERE shop_id = $1`, shopID, passwordHash)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}
```

`backend/internal/owners/middleware.go`
```go
package owners

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"

	"wedding-rentals/backend/internal/auth"
	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/httpx"
)

const (
	ownerIDKey    = "shop_owner_id"
	ownerPhoneKey = "shop_owner_phone"
	shopIDKey     = "shop_owner_shop_id"
)

var errUnauthorized = httpx.New(http.StatusUnauthorized, "unauthorized", "login required")

// ShopMiddleware accepts only a valid shop-owner token whose version matches the owner's
// current token_version (a new password signs old sessions out), and remembers the owner's shop.
func ShopMiddleware(t *auth.Tokens, d db.DBTX) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, ok := strings.CutPrefix(c.GetHeader("Authorization"), "Bearer ")
		if !ok || token == "" {
			httpx.Abort(c, errUnauthorized)
			return
		}
		id, version, err := t.VerifyShop(token)
		if err != nil {
			httpx.Abort(c, errUnauthorized)
			return
		}
		o, err := byID(c.Request.Context(), d, id)
		if errors.Is(err, pgx.ErrNoRows) || (err == nil && o.TokenVersion != version) {
			httpx.Abort(c, errUnauthorized)
			return
		}
		if err != nil {
			httpx.Abort(c, err)
			return
		}
		c.Set(ownerIDKey, o.ID)
		c.Set(ownerPhoneKey, o.Phone)
		c.Set(shopIDKey, o.ShopID)
		c.Next()
	}
}

// ShopID is the signed-in owner's shop, or 0 outside ShopMiddleware. The scoped dresses,
// images and busy-days handlers use it to touch nothing but the owner's own shop.
func ShopID(c *gin.Context) int64 { return c.GetInt64(shopIDKey) }
```

`backend/internal/owners/handler.go`
```go
package owners

import (
	"errors"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"wedding-rentals/backend/internal/auth"
	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/httpx"
	"wedding-rentals/backend/internal/shops"
)

const minPassword = 10

var (
	errInvalidCredentials = httpx.New(http.StatusUnauthorized, "invalid_credentials", "phone or password is wrong")
	errRateLimited        = httpx.New(http.StatusTooManyRequests, "rate_limited", "too many attempts, try again in a minute")
)

// dummyHash keeps sign-in timing similar whether or not the phone exists.
var dummyHash, _ = auth.HashPassword("timing-equalizer-password")

type Handler struct {
	DB      db.DBTX
	Tokens  *auth.Tokens
	Limiter *auth.Limiter
}

// RegisterPublic adds sign-up and sign-in under /shop.
func (h *Handler) RegisterPublic(g *gin.RouterGroup) {
	g.POST("/shop/signup", h.signup)
	g.POST("/shop/login", h.login)
}

// RegisterShop adds the signed-in owner's own endpoints; g must use ShopMiddleware.
func (h *Handler) RegisterShop(g *gin.RouterGroup) {
	g.GET("/me", h.me)
	g.PUT("/me/shop", h.updateShop)
}

// RegisterAdmin adds the admin's owner tools; g must use the admin middleware.
func (h *Handler) RegisterAdmin(g *gin.RouterGroup) {
	g.POST("/shops/:id/owner-password", h.setPassword)
}

type signupInput struct {
	ShopName string `json:"shop_name"`
	CityID   int64  `json:"city_id"`
	Address  string `json:"address"`
	Phone    string `json:"phone"`
	Password string `json:"password"`
}

func (h *Handler) signup(c *gin.Context) {
	if !h.Limiter.Allow(c.ClientIP()) {
		httpx.Abort(c, errRateLimited)
		return
	}
	var in signupInput
	if !httpx.BindJSON(c, &in) {
		return
	}
	ctx := c.Request.Context()
	phone, phoneOK := NormalizePhone(in.Phone)
	shop := shops.Input{Name: in.ShopName, CityID: in.CityID, Address: in.Address, Phone: phone, IsPublished: true}
	shopErrs, err := shops.Check(ctx, h.DB, &shop)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	// The phone is checked below with its own, stricter rule.
	errs := map[string]string{}
	for field, code := range shopErrs {
		switch field {
		case "name":
			errs["shop_name"] = code
		case "city_id", "address":
			errs[field] = code
		}
	}
	if !phoneOK {
		errs["phone"] = "invalid"
	} else if taken, err := phoneTaken(ctx, h.DB, phone); err != nil {
		httpx.Abort(c, err)
		return
	} else if taken {
		errs["phone"] = "taken"
	}
	if utf8.RuneCountInString(in.Password) < minPassword {
		errs["password"] = "too_short"
	}
	if len(errs) > 0 {
		httpx.Abort(c, httpx.Validation(errs))
		return
	}
	hash, err := auth.HashPassword(in.Password)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	o, err := create(ctx, h.DB, shop, phone, hash)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" && strings.Contains(pgErr.ConstraintName, "phone") {
		// Two sign-ups raced for the same phone.
		httpx.Abort(c, httpx.Validation(map[string]string{"phone": "taken"}))
		return
	}
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	h.respondWithToken(c, http.StatusCreated, o)
}

func (h *Handler) login(c *gin.Context) {
	if !h.Limiter.Allow(c.ClientIP()) {
		httpx.Abort(c, errRateLimited)
		return
	}
	var in struct {
		Phone    string `json:"phone"`
		Password string `json:"password"`
	}
	if !httpx.BindJSON(c, &in) {
		return
	}
	phone, _ := NormalizePhone(in.Phone)
	o, err := byPhone(c.Request.Context(), h.DB, phone)
	if errors.Is(err, pgx.ErrNoRows) {
		auth.CheckPassword(dummyHash, in.Password)
		httpx.Abort(c, errInvalidCredentials)
		return
	}
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	if !auth.CheckPassword(o.PasswordHash, in.Password) {
		httpx.Abort(c, errInvalidCredentials)
		return
	}
	h.respondWithToken(c, http.StatusOK, o)
}

func (h *Handler) respondWithToken(c *gin.Context, status int, o Owner) {
	token, err := h.Tokens.IssueShop(o.ID, o.TokenVersion)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(status, gin.H{"token": token})
}

// Me is the signed-in owner and their shop.
type Me struct {
	ID    int64      `json:"id"`
	Phone string     `json:"phone"`
	Shop  shops.Shop `json:"shop"`
}

func (h *Handler) me(c *gin.Context) {
	s, err := shops.Get(c.Request.Context(), h.DB, ShopID(c))
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusOK, Me{ID: c.GetInt64(ownerIDKey), Phone: c.GetString(ownerPhoneKey), Shop: s})
}

// updateShop saves the owner's shop details. Whether the shop is published stays as it is:
// only admins can hide or show a shop.
func (h *Handler) updateShop(c *gin.Context) {
	var in shops.Input
	if !httpx.BindJSON(c, &in) {
		return
	}
	ctx := c.Request.Context()
	current, err := shops.Get(ctx, h.DB, ShopID(c))
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	in.IsPublished = current.IsPublished
	errs, err := shops.Check(ctx, h.DB, &in)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	if len(errs) > 0 {
		httpx.Abort(c, httpx.Validation(errs))
		return
	}
	if err := shops.Update(ctx, h.DB, current.ID, in); err != nil {
		httpx.Abort(c, err)
		return
	}
	s, err := shops.Get(ctx, h.DB, current.ID)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusOK, s)
}

func (h *Handler) setPassword(c *gin.Context) {
	shopID, ok := httpx.ParseID(c, "id")
	if !ok {
		return
	}
	var in struct {
		Password string `json:"password"`
	}
	if !httpx.BindJSON(c, &in) {
		return
	}
	if utf8.RuneCountInString(in.Password) < minPassword {
		httpx.Abort(c, httpx.Validation(map[string]string{"password": "too_short"}))
		return
	}
	hash, err := auth.HashPassword(in.Password)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	if err := setPasswordForShop(c.Request.Context(), h.DB, shopID, hash); err != nil {
		httpx.Abort(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
```

Run: `GOPROXY=off go test -count=1 ./internal/owners/`
Expected: `ok`, with all 11 tests passing.

- [ ] **Step 6: Wire the routes**

In `backend/internal/server/server.go`, replace:
```go
import (
	"net/http"

	"github.com/gin-gonic/gin"
```
with:
```go
import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
```

In `backend/internal/server/server.go`, replace:
```go
	"wedding-rentals/backend/internal/images"
	"wedding-rentals/backend/internal/shops"
```
with:
```go
	"wedding-rentals/backend/internal/images"
	"wedding-rentals/backend/internal/owners"
	"wedding-rentals/backend/internal/shops"
```

In `backend/internal/server/server.go`, replace:
```go
type Deps struct {
	DB        db.DBTX
	Tokens    *auth.Tokens
	Limiter   *auth.Limiter
	Storage   images.Storage
	UploadDir string
	WebDir    string
	BaseURL   string
```
with:
```go
type Deps struct {
	DB      db.DBTX
	Tokens  *auth.Tokens
	Limiter *auth.Limiter
	// ShopLimiter rate-limits shop sign-up and sign-in; nil gets its own 5-per-minute limiter.
	ShopLimiter *auth.Limiter
	Storage     images.Storage
	UploadDir   string
	WebDir      string
	BaseURL     string
```

In `backend/internal/server/server.go`, replace:
```go
	busyH := &busydays.Handler{DB: d.DB}

	authH.RegisterPublic(api)
	citiesH.RegisterPublic(api)
	shopsH.RegisterPublic(api)
	dressesH.RegisterPublic(api)
	busyH.RegisterPublic(api)

	admin := api.Group("/admin", auth.Middleware(d.Tokens))
	shopsH.RegisterAdmin(admin)
	dressesH.RegisterAdmin(admin)
	imagesH.RegisterAdmin(admin)
	busyH.RegisterAdmin(admin)
```
with:
```go
	busyH := &busydays.Handler{DB: d.DB}
	if d.ShopLimiter == nil {
		d.ShopLimiter = auth.NewLimiter(5, time.Minute)
	}
	ownersH := &owners.Handler{DB: d.DB, Tokens: d.Tokens, Limiter: d.ShopLimiter}

	authH.RegisterPublic(api)
	citiesH.RegisterPublic(api)
	shopsH.RegisterPublic(api)
	dressesH.RegisterPublic(api)
	busyH.RegisterPublic(api)
	ownersH.RegisterPublic(api)

	admin := api.Group("/admin", auth.Middleware(d.Tokens))
	shopsH.RegisterAdmin(admin)
	dressesH.RegisterAdmin(admin)
	imagesH.RegisterAdmin(admin)
	busyH.RegisterAdmin(admin)
	ownersH.RegisterAdmin(admin)

	shop := api.Group("/shop", owners.ShopMiddleware(d.Tokens, d.DB))
	ownersH.RegisterShop(shop)
```

- [ ] **Step 7: Run the whole backend suite, vet and fmt**

Run: `GOPROXY=off go test -count=1 ./... && go vet ./... && gofmt -l .`
Expected:
- every package prints `ok`;
- `gofmt -l` prints nothing.

- [ ] **Step 8: Commit**

```bash
git add backend/migrations/00004_shop_owners.sql backend/internal/owners backend/internal/shops backend/internal/server/server.go
git commit -m "feat(backend): shop owners sign up with a phone and manage their shop details"
```

---

### Task 3: Owners manage dresses, photos and busy days of their own shop only

**Files:**
- Modify:
  - `backend/internal/dresses/handler.go`
  - `backend/internal/images/handler.go`
  - `backend/internal/busydays/handler.go`
  - `backend/internal/busydays/repo.go`
  - `backend/internal/server/server.go`
- Test: `backend/internal/server/shop_test.go`

**Interfaces:**
- Consumes:
  - from Task 2: `owners.ShopID`, `server.Deps.ShopLimiter`, and `POST /api/shop/signup` with `GET /api/shop/me`;
  - existing: `httpx.ErrNotFound`, `dresses.ListAdmin` and `images.LocalStorage`.
- Produces:
  - a `Scope func(*gin.Context) int64` field on `dresses.Handler`, `images.Handler` and `busydays.Handler`. When it is nil, the handler behaves exactly as before.
  - the routes under `/api/shop`, the same as the admin ones: `/dresses`, `/dresses/:id`, `/images`, `/images/order`, `/images/:id` and `/dresses/:id/busy-days[/:day]`.

- [ ] **Step 1: Write the failing cross-shop test**

`backend/internal/server/shop_test.go`
```go
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
	"wedding-rentals/backend/internal/images"
	"wedding-rentals/backend/internal/server"
	"wedding-rentals/backend/internal/testutil"
)

type shopEnv struct {
	r      *gin.Engine
	tx     pgx.Tx
	tokens *auth.Tokens
}

func newShopEnv(t *testing.T) shopEnv {
	tx := testutil.Tx(t)
	tokens := auth.NewTokens(strings.Repeat("k", 32), auth.TokenTTL)
	r, err := server.New(server.Deps{
		DB:          tx,
		Tokens:      tokens,
		Limiter:     auth.NewLimiter(100, time.Minute),
		ShopLimiter: auth.NewLimiter(100, time.Minute),
		Storage:     images.LocalStorage{Dir: t.TempDir()},
		UploadDir:   t.TempDir(),
		WebDir:      t.TempDir(),
		BaseURL:     "http://localhost:8080",
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
	if rec := upload(t, e, a.token, "shop_id", a.shopID); rec.Code != http.StatusCreated {
		t.Fatalf("own logo: %d %s", rec.Code, rec.Body)
	}
	if rec := testutil.Request(t, e.r, http.MethodPut, dressPath+"/busy-days/"+time.Now().Add(48*time.Hour).Format("2006-01-02"), nil, a.token); rec.Code != http.StatusNoContent {
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
```

Run: `GOPROXY=off go test -count=1 -run 'TestShop|TestAdminAndShop' ./internal/server/`
Expected: FAIL. The `/api/shop/dresses` routes do not exist yet, so `create` gets 404.

- [ ] **Step 2: Scope the dresses handler**

In `backend/internal/dresses/handler.go`, replace:
```go
type Handler struct {
	DB      db.DBTX
	Storage images.Storage
}
```
with:
```go
type Handler struct {
	DB      db.DBTX
	Storage images.Storage
	// Scope, when set, limits the admin routes to one shop: it returns the signed-in shop
	// owner's shop id. Admins leave it nil and may touch every shop.
	Scope func(*gin.Context) int64
}

func (h *Handler) scope(c *gin.Context) int64 {
	if h.Scope == nil {
		return 0
	}
	return h.Scope(c)
}

// own answers 404 unless the dress id belongs to the scoped shop (always true for admins).
func (h *Handler) own(c *gin.Context, id int64) bool {
	shopID := h.scope(c)
	if shopID == 0 {
		return true
	}
	var mine bool
	err := h.DB.QueryRow(c.Request.Context(),
		`SELECT EXISTS(SELECT 1 FROM listings WHERE id = $1 AND shop_id = $2)`, id, shopID).Scan(&mine)
	if err != nil {
		httpx.Abort(c, err)
		return false
	}
	if !mine {
		httpx.Abort(c, httpx.ErrNotFound)
		return false
	}
	return true
}
```

In `backend/internal/dresses/handler.go`, replace:
```go
	if !httpx.BindJSON(c, &in) {
		return in, false
	}
	in.normalize()
```
with:
```go
	if !httpx.BindJSON(c, &in) {
		return in, false
	}
	if shopID := h.scope(c); shopID != 0 {
		in.ShopID = shopID // a shop owner always saves into their own shop
	}
	in.normalize()
```

In `backend/internal/dresses/handler.go`, replace:
```go
		shopID = n
	}
	list, err := ListAdmin(c.Request.Context(), h.DB, shopID)
```
with:
```go
		shopID = n
	}
	if scoped := h.scope(c); scoped != 0 {
		shopID = scoped
	}
	list, err := ListAdmin(c.Request.Context(), h.DB, shopID)
```

In `backend/internal/dresses/handler.go`, replace:
```go
func (h *Handler) getAdmin(c *gin.Context) {
	id, ok := httpx.ParseID(c, "id")
	if !ok {
		return
	}
```
with:
```go
func (h *Handler) getAdmin(c *gin.Context) {
	id, ok := httpx.ParseID(c, "id")
	if !ok || !h.own(c, id) {
		return
	}
```

In `backend/internal/dresses/handler.go`, replace:
```go
func (h *Handler) update(c *gin.Context) {
	id, ok := httpx.ParseID(c, "id")
	if !ok {
		return
	}
```
with:
```go
func (h *Handler) update(c *gin.Context) {
	id, ok := httpx.ParseID(c, "id")
	if !ok || !h.own(c, id) {
		return
	}
```

In `backend/internal/dresses/handler.go`, replace:
```go
func (h *Handler) delete(c *gin.Context) {
	id, ok := httpx.ParseID(c, "id")
	if !ok {
		return
	}
```
with:
```go
func (h *Handler) delete(c *gin.Context) {
	id, ok := httpx.ParseID(c, "id")
	if !ok || !h.own(c, id) {
		return
	}
```

- [ ] **Step 3: Scope the images handler**

In `backend/internal/images/handler.go`, replace:
```go
type Handler struct {
	DB      db.DBTX
	Storage Storage
}
```
with:
```go
type Handler struct {
	DB      db.DBTX
	Storage Storage
	// Scope, when set, limits the admin routes to the signed-in shop owner's shop:
	// only that shop's logo and its own dresses' photos can be changed.
	Scope func(*gin.Context) int64
}

func (h *Handler) scope(c *gin.Context) int64 {
	if h.Scope == nil {
		return 0
	}
	return h.Scope(c)
}
```

In `backend/internal/images/handler.go`, replace:
```go
		httpx.Abort(c, httpx.Validation(map[string]string{"owner": "exactly_one_of_listing_id_or_shop_id"}))
		return owner{}, false
	}
```
with:
```go
		httpx.Abort(c, httpx.Validation(map[string]string{"owner": "exactly_one_of_listing_id_or_shop_id"}))
		return owner{}, false
	}
	if scoped := h.scope(c); scoped != 0 {
		// A shop owner may only add their own logo or photos of their own dresses.
		var mine bool
		err := h.DB.QueryRow(c.Request.Context(), `
			SELECT CASE WHEN $1::bigint > 0 THEN EXISTS(SELECT 1 FROM listings WHERE id = $1 AND shop_id = $3)
			            ELSE $2::bigint = $3 END`, l, s, scoped).Scan(&mine)
		if err != nil {
			httpx.Abort(c, err)
			return owner{}, false
		}
		if !mine {
			httpx.Abort(c, httpx.ErrNotFound)
			return owner{}, false
		}
		return owner{listingID: l, shopID: s}, true
	}
```

In `backend/internal/images/handler.go`, replace:
```go
	ctx := c.Request.Context()
	err := db.InTx(ctx, h.DB, func(tx pgx.Tx) error {
```
with:
```go
	ctx := c.Request.Context()
	scoped := h.scope(c)
	err := db.InTx(ctx, h.DB, func(tx pgx.Tx) error {
```

In `backend/internal/images/handler.go`, replace:
```go
		if listings != 1 || found != len(in.IDs) {
			return invalid
		}
```
with:
```go
		if listings != 1 || found != len(in.IDs) {
			return invalid
		}
		if scoped != 0 {
			var mine bool
			if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM listings WHERE id = $1 AND shop_id = $2)`,
				*listingID, scoped).Scan(&mine); err != nil {
				return err
			}
			if !mine {
				return httpx.ErrNotFound
			}
		}
```

In `backend/internal/images/handler.go`, replace:
```go
	err := h.DB.QueryRow(c.Request.Context(), `DELETE FROM images WHERE id = $1 RETURNING path_small, path_large`, id).Scan(&small, &large)
```
with:
```go
	// For a shop owner, only images of their own shop (its logo or its dresses' photos) match.
	err := h.DB.QueryRow(c.Request.Context(), `
		DELETE FROM images WHERE id = $1 AND ($2::bigint = 0
			OR shop_id = $2 OR listing_id IN (SELECT id FROM listings WHERE shop_id = $2))
		RETURNING path_small, path_large`, id, h.scope(c)).Scan(&small, &large)
```

- [ ] **Step 4: Scope the busy-days handler**

In `backend/internal/busydays/handler.go`, replace:
```go
	// Now returns the current time; nil means time.Now. Tests set a fixed clock.
	Now func() time.Time
}
```
with:
```go
	// Now returns the current time; nil means time.Now. Tests set a fixed clock.
	Now func() time.Time
	// Scope, when set, limits the admin routes to the signed-in shop owner's shop.
	Scope func(*gin.Context) int64
}
```

In `backend/internal/busydays/handler.go`, replace:
```go
	exists, err := dressExists(c.Request.Context(), h.DB, id, publicOnly)
```
with:
```go
	var shopID int64
	if h.Scope != nil && !publicOnly {
		shopID = h.Scope(c)
	}
	exists, err := dressExists(c.Request.Context(), h.DB, id, publicOnly, shopID)
```

In `backend/internal/busydays/repo.go`, replace:
```go
// dressExists reports whether id is a dress (a listing with dress details). With
// publicOnly it must also be published in a published shop, the v1 visibility rule.
func dressExists(ctx context.Context, d db.DBTX, id int64, publicOnly bool) (bool, error) {
```
with:
```go
// dressExists reports whether id is a dress (a listing with dress details). With
// publicOnly it must also be published in a published shop, the v1 visibility rule;
// with a non-zero shopID it must belong to that shop.
func dressExists(ctx context.Context, d db.DBTX, id int64, publicOnly bool, shopID int64) (bool, error) {
```

In `backend/internal/busydays/repo.go`, replace:
```go
			WHERE l.id = $1 AND (NOT $2 OR (l.is_published AND s.is_published)))`, id, publicOnly).Scan(&ok)
```
with:
```go
			WHERE l.id = $1 AND (NOT $2 OR (l.is_published AND s.is_published))
			  AND ($3::bigint = 0 OR l.shop_id = $3))`, id, publicOnly, shopID).Scan(&ok)
```

- [ ] **Step 5: Mount the scoped handlers under /api/shop**

In `backend/internal/server/server.go`, replace:
```go
	shop := api.Group("/shop", owners.ShopMiddleware(d.Tokens, d.DB))
	ownersH.RegisterShop(shop)
```
with:
```go
	// Shop owners reuse the admin handlers, scoped to their own shop.
	shop := api.Group("/shop", owners.ShopMiddleware(d.Tokens, d.DB))
	ownersH.RegisterShop(shop)
	(&dresses.Handler{DB: d.DB, Storage: d.Storage, Scope: owners.ShopID}).RegisterAdmin(shop)
	(&images.Handler{DB: d.DB, Storage: d.Storage, Scope: owners.ShopID}).RegisterAdmin(shop)
	(&busydays.Handler{DB: d.DB, Scope: owners.ShopID}).RegisterAdmin(shop)
```

- [ ] **Step 6: Run the cross-shop tests, then prove they bite**

Run: `GOPROXY=off go test -count=1 -run 'TestShop|TestAdminAndShop' ./internal/server/`
Expected: `ok`.

Now break the ownership check on purpose to prove the test catches it:
1. In `getAdmin` in `backend/internal/dresses/handler.go`, change `if !ok || !h.own(c, id) {` to `if !ok {`.
2. Run the same command. Expected: FAIL with `B GET /api/shop/dresses/…: status = 200, want 404`.
3. Restore the line and run again. Expected: `ok`.

- [ ] **Step 7: Run the whole backend suite, vet and fmt**

Run: `GOPROXY=off go test -count=1 ./... && go vet ./... && gofmt -l .`
Expected:
- every package prints `ok`;
- `gofmt -l` prints nothing.

The existing admin tests still pass, because `Scope` is nil for admins.

- [ ] **Step 8: Commit**

```bash
git add backend/internal/dresses/handler.go backend/internal/images/handler.go backend/internal/busydays backend/internal/server
git commit -m "feat(backend): shop owners manage their own dresses, photos and busy days"
```

---
### Task 4: Frontend API layer: owner calls, shared manage calls, sessions

**Files:**
- Create:
  - `frontend/src/lib/shopAuth.ts`
  - `frontend/src/lib/manage.ts`
  - `frontend/src/lib/manage_test.ts`
- Modify:
  - `frontend/src/lib/types.ts`
  - `frontend/src/lib/api.ts`
  - `frontend/src/lib/upload.ts`
  - `frontend/src/lib/auth.ts`
  - `frontend/src/lib/client.ts`
- Test:
  - `frontend/src/lib/api_test.ts`
  - `frontend/src/lib/auth_test.ts`
  - `frontend/src/lib/forms_test.ts`

**Interfaces:**
- Consumes:
  - the existing `createApi` (`request`, `withQuery`), `createUploader`, `createAuth`, `safeKV` and `memoryKV`;
  - the `setup`, `json` and `shopInput` helpers in `api_test.ts`.
- Produces:
  - Types:
    - `AdminShop.owner: { id: number; phone: string } | null`
    - `interface SignupInput { shop_name; city_id; address; phone; password }`
    - `interface ShopMe { id: number; phone: string; shop: AdminShop }`
  - API calls:
    - `api.admin.*`: the existing method names, unchanged, plus `setOwnerPassword(shopId, password)`.
    - `api.owner.signup(input): Promise<string>` (token), `api.owner.login(phone, password): Promise<string>`, `api.owner.me(): Promise<ShopMe>` and `api.owner.updateShop(input): Promise<AdminShop>`.
    - `api.owner` also has `dresses()`, `dress`, `createDress`, `updateDress`, `deleteDress`, `reorderImages`, `deleteImage`, `busyDays`, `markBusy` and `markFree`, which go to `/api/shop/...`.
    - `type ManageCalls` is the shared dress, photo and calendar calls.
  - Uploads, sessions and clients:
    - `UploadDeps.path`, plus `type Uploader`
    - `createAuth(kv, key = "wr.admin_token")`
    - `SHOP_TOKEN_KEY = "wr.shop_token"` and `shopAuth`
    - `ownerApi` and `uploadOwnerImage` in `client.ts`
  - The manage context:
    - `interface Manage { calls; upload; dressesHref(shopId?); dressHref(id); shops? }`
    - `ManageContext` and `useManage()`
    - `adminManage(api, upload)` and `ownerManage(api, upload)`

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/lib/api_test.ts`:
```ts

Deno.test("owner sign-up and sign-in send no token and return the token", async () => {
  const { api, calls } = setup(() => json(200, { token: "shop-jwt" }));
  const input = { shop_name: "Ak Gelin", city_id: 1, address: "Aşgabat", phone: "65123456", password: "long-enough-1" };
  assertEquals(await api.owner.signup(input), "shop-jwt");
  assertEquals(await api.owner.login("65123456", "long-enough-1"), "shop-jwt");
  assertEquals(calls.map((c) => `${c.init.method} ${c.url}`), ["POST /api/shop/signup", "POST /api/shop/login"]);
  assertEquals(JSON.parse(String(calls[0].init.body)), input);
  assertEquals(JSON.parse(String(calls[1].init.body)), { phone: "65123456", password: "long-enough-1" });
  for (const c of calls) assertEquals((c.init.headers as Record<string, string>).Authorization, undefined);
});

Deno.test("a failed owner sign-in does not trigger onUnauthorized, an expired owner session does", async () => {
  const s = setup(() => json(401, { error: { code: "invalid_credentials", message: "wrong" } }));
  await assertRejects(() => s.api.owner.login("65123456", "x"), ApiError);
  assertEquals(s.unauthorized(), 0);
  await assertRejects(() => s.api.owner.me(), ApiError);
  assertEquals(s.unauthorized(), 1);
});

Deno.test("owner calls go to /api/shop with the bearer token", async () => {
  const { api, calls } = setup((_url, init) =>
    init.method === "GET" ? json(200, { items: [] }) : new Response(null, { status: 204 })
  );
  await api.owner.me();
  await api.owner.updateShop(shopInput);
  await api.owner.dresses();
  await api.owner.deleteDress(5);
  await api.owner.reorderImages([2, 1]);
  await api.owner.deleteImage(9);
  await api.owner.markBusy(5, "2026-11-14");
  await api.owner.markFree(5, "2026-11-14");
  assertEquals(calls.map((c) => `${c.init.method} ${c.url}`), [
    "GET /api/shop/me",
    "PUT /api/shop/me/shop",
    "GET /api/shop/dresses",
    "DELETE /api/shop/dresses/5",
    "PATCH /api/shop/images/order",
    "DELETE /api/shop/images/9",
    "PUT /api/shop/dresses/5/busy-days/2026-11-14",
    "DELETE /api/shop/dresses/5/busy-days/2026-11-14",
  ]);
  for (const c of calls) assertEquals((c.init.headers as Record<string, string>).Authorization, "Bearer tok");
});

Deno.test("an admin sets a shop owner's password", async () => {
  const { api, calls } = setup(() => new Response(null, { status: 204 }));
  assertEquals(await api.admin.setOwnerPassword(4, "brand-new-pass"), undefined);
  assertEquals(`${calls[0].init.method} ${calls[0].url}`, "POST /api/admin/shops/4/owner-password");
  assertEquals(JSON.parse(String(calls[0].init.body)), { password: "brand-new-pass" });
});
```

`frontend/src/lib/manage_test.ts`
```ts
import { assertEquals } from "@std/assert";
import { createApi } from "./api.ts";
import { adminManage, ownerManage } from "./manage.ts";
import type { Uploader } from "./upload.ts";

function setup() {
  const urls: string[] = [];
  const fetchFn = ((input: RequestInfo | URL) => {
    urls.push(String(input));
    return Promise.resolve(new Response(JSON.stringify({ items: [] }), { status: 200 }));
  }) as typeof fetch;
  const api = createApi({ fetch: fetchFn, token: () => "tok", onUnauthorized: () => {} });
  const upload = (() => Promise.reject(new Error("unused"))) as Uploader;
  return { api, upload, urls };
}

Deno.test("the admin editors reach /api/admin and link inside /admin", async () => {
  const { api, upload, urls } = setup();
  const m = adminManage(api, upload);
  await m.calls.dresses(3);
  await m.calls.busyDays(7);
  await m.shops?.();
  assertEquals(urls, ["/api/admin/dresses?shop_id=3", "/api/admin/dresses/7/busy-days", "/api/admin/shops"]);
  assertEquals(m.upload, upload);
  assertEquals([m.dressesHref(), m.dressesHref(3), m.dressHref(7)], ["/admin/dresses", "/admin/dresses?shop_id=3", "/admin/dresses/7"]);
});

Deno.test("the owner editors reach /api/shop, link inside /shop and never choose a shop", async () => {
  const { api, upload, urls } = setup();
  const m = ownerManage(api, upload);
  await m.calls.dresses();
  await m.calls.busyDays(7);
  assertEquals(urls, ["/api/shop/dresses", "/api/shop/dresses/7/busy-days"]);
  assertEquals([m.dressesHref(), m.dressesHref(3), m.dressHref(7)], ["/shop", "/shop", "/shop/dresses/7"]);
  assertEquals(m.shops, undefined);
});
```

In `frontend/src/lib/auth_test.ts`, replace:
```ts
import { createAuth } from "./auth.ts";
```
with:
```ts
import { createAuth } from "./auth.ts";
import { SHOP_TOKEN_KEY } from "./shopAuth.ts";
```

Append to `frontend/src/lib/auth_test.ts`:
```ts

Deno.test("a shop owner's session is stored apart from the admin's", () => {
  const kv = memoryKV({ "wr.admin_token": "admin-jwt" });
  const shop = createAuth(kv, SHOP_TOKEN_KEY);
  assertEquals(shop.token(), null);
  shop.set("shop-jwt");
  assertEquals(kv.get("wr.shop_token"), "shop-jwt");
  shop.clear();
  assertEquals(kv.get("wr.admin_token"), "admin-jwt");
});
```

The new `owner` field on `AdminShop` is required. In `frontend/src/lib/forms_test.ts`, replace:
```ts
  logo: null, aliases: ["Ак Гелин"], created_at: "2026-10-19T00:00:00Z", updated_at: "2026-10-19T00:00:00Z",
```
with:
```ts
  logo: null, aliases: ["Ак Гелин"], owner: null, created_at: "2026-10-19T00:00:00Z", updated_at: "2026-10-19T00:00:00Z",
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd frontend && deno task test`
Expected: FAIL in type-checking. The errors include:
- `Property 'owner' does not exist`;
- `Cannot find module './manage.ts'`;
- `Cannot find module './shopAuth.ts'`;
- `'owner' does not exist in type 'AdminShop'`.

- [ ] **Step 3: Add the types**

In `frontend/src/lib/types.ts`, replace:
```ts
  logo: Image | null;
  aliases: string[];
  created_at: string;
```
with:
```ts
  logo: Image | null;
  aliases: string[];
  /** The shop-owner account that runs this shop, if any. */
  owner: { id: number; phone: string } | null;
  created_at: string;
```

In `frontend/src/lib/types.ts`, replace:
```ts
export interface DressInput {
```
with:
```ts
export interface SignupInput {
  shop_name: string;
  city_id: number;
  address: string;
  phone: string;
  password: string;
}

/** The signed-in shop owner and their shop. */
export interface ShopMe {
  id: number;
  phone: string;
  shop: AdminShop;
}

export interface DressInput {
```

- [ ] **Step 4: Build the calls once per base path**

`frontend/src/lib/api.ts`
```ts
import type {
  AdminDress, AdminShop, BusyDays, City, DressInput, Page, PublicDress, PublicShop, ShopInput, ShopMe, SignupInput,
} from "./types.ts";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string>;

  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string; fields?: Record<string, string> };
}

/** Turns an error response body (or anything else) into an ApiError. */
export function toApiError(
  status: number,
  data: unknown,
  fallbackMessage: string,
  tooLargeCode = "body_too_large",
): ApiError {
  const e = (data as ErrorBody | null)?.error;
  // A proxy rejects an oversized body with its own page, not our JSON envelope.
  const fallbackCode = status === 413 ? tooLargeCode : "internal_error";
  return new ApiError(status, e?.code ?? fallbackCode, e?.message ?? fallbackMessage, e?.fields ?? {});
}

export interface ApiDeps {
  fetch: typeof fetch;
  token: () => string | null;
  onUnauthorized: () => void;
  /** How long a request may take before it is abandoned; defaults to 20 s. */
  timeoutMs?: number;
}

interface RequestOptions {
  body?: unknown;
  auth?: boolean;
}

const REQUEST_TIMEOUT_MS = 20_000;

function withQuery(path: string, query?: URLSearchParams): string {
  const qs = query?.toString() ?? "";
  return qs ? `${path}?${qs}` : path;
}

export function createApi(deps: ApiDeps) {
  async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    if (opts.auth) {
      const token = deps.token();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    // AbortSignal.timeout needs Safari 16; a controller works everywhere.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? REQUEST_TIMEOUT_MS);
    try {
      let res: Response;
      try {
        res = await deps.fetch(path, {
          method,
          headers,
          body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
          signal: controller.signal,
        });
      } catch {
        throw new ApiError(0, "network_error", "network request failed");
      }
      if (res.status === 204) return undefined as T;
      let data: unknown;
      try {
        data = await res.json();
      } catch {
        // An error page from a proxy is fine to report by status; a cut-off success is not.
        if (res.ok) throw new ApiError(0, "network_error", "response could not be read");
        data = null;
      }
      if (!res.ok) {
        if (opts.auth && res.status === 401) deps.onUnauthorized();
        throw toApiError(res.status, data, res.statusText);
      }
      return data as T;
    } finally {
      clearTimeout(timer);
    }
  }

  const signedIn = { auth: true } as const;

  /** Dresses, photos and busy days: the same calls under /api/admin and /api/shop. */
  function manage(base: string) {
    return {
      dresses: (shopId?: number) =>
        request<{ items: AdminDress[] }>(
          "GET",
          withQuery(`${base}/dresses`, shopId ? new URLSearchParams({ shop_id: String(shopId) }) : undefined),
          signedIn,
        ).then((r) => r.items),
      dress: (id: number) => request<AdminDress>("GET", `${base}/dresses/${id}`, signedIn),
      createDress: (input: DressInput) => request<AdminDress>("POST", `${base}/dresses`, { ...signedIn, body: input }),
      updateDress: (id: number, input: DressInput) =>
        request<AdminDress>("PUT", `${base}/dresses/${id}`, { ...signedIn, body: input }),
      deleteDress: (id: number) => request<void>("DELETE", `${base}/dresses/${id}`, signedIn),
      reorderImages: (ids: number[]) => request<void>("PATCH", `${base}/images/order`, { ...signedIn, body: { ids } }),
      deleteImage: (id: number) => request<void>("DELETE", `${base}/images/${id}`, signedIn),
      busyDays: (dressId: number) => request<BusyDays>("GET", `${base}/dresses/${dressId}/busy-days`, signedIn),
      markBusy: (dressId: number, day: string) =>
        request<void>("PUT", `${base}/dresses/${dressId}/busy-days/${day}`, signedIn),
      markFree: (dressId: number, day: string) =>
        request<void>("DELETE", `${base}/dresses/${dressId}/busy-days/${day}`, signedIn),
    };
  }

  return {
    cities: () => request<{ items: City[] }>("GET", "/api/cities").then((r) => r.items),
    dresses: (query?: URLSearchParams) => request<Page>("GET", withQuery("/api/dresses", query)),
    dress: (id: number | string) => request<PublicDress>("GET", `/api/dresses/${encodeURIComponent(String(id))}`),
    busyDays: (dressId: number) => request<BusyDays>("GET", `/api/dresses/${dressId}/busy-days`),
    shop: (slug: string, query?: URLSearchParams) =>
      request<PublicShop>("GET", withQuery(`/api/shops/${encodeURIComponent(slug)}`, query)),
    login: (email: string, password: string) =>
      request<{ token: string }>("POST", "/api/admin/login", { body: { email, password } }).then((r) => r.token),
    admin: {
      shops: () => request<{ items: AdminShop[] }>("GET", "/api/admin/shops", signedIn).then((r) => r.items),
      shop: (id: number) => request<AdminShop>("GET", `/api/admin/shops/${id}`, signedIn),
      createShop: (input: ShopInput) => request<AdminShop>("POST", "/api/admin/shops", { ...signedIn, body: input }),
      updateShop: (id: number, input: ShopInput) =>
        request<AdminShop>("PUT", `/api/admin/shops/${id}`, { ...signedIn, body: input }),
      deleteShop: (id: number) => request<void>("DELETE", `/api/admin/shops/${id}`, signedIn),
      setOwnerPassword: (shopId: number, password: string) =>
        request<void>("POST", `/api/admin/shops/${shopId}/owner-password`, { ...signedIn, body: { password } }),
      ...manage("/api/admin"),
    },
    /** A shop owner's own account; every call acts on the signed-in owner's shop only. */
    owner: {
      signup: (input: SignupInput) =>
        request<{ token: string }>("POST", "/api/shop/signup", { body: input }).then((r) => r.token),
      login: (phone: string, password: string) =>
        request<{ token: string }>("POST", "/api/shop/login", { body: { phone, password } }).then((r) => r.token),
      me: () => request<ShopMe>("GET", "/api/shop/me", signedIn),
      updateShop: (input: ShopInput) => request<AdminShop>("PUT", "/api/shop/me/shop", { ...signedIn, body: input }),
      ...manage("/api/shop"),
    },
  };
}

export type Api = ReturnType<typeof createApi>;
/** The calls the shared dress, photo and calendar editors make, for an admin or an owner. */
export type ManageCalls = Omit<Api["owner"], "signup" | "login" | "me" | "updateShop">;
```

- [ ] **Step 5: Give the uploader its path, and the session its key**

In `frontend/src/lib/upload.ts`, replace:
```ts
export interface UploadDeps {
  token: () => string | null;
```
with:
```ts
export interface UploadDeps {
  /** The upload endpoint, e.g. "/api/admin/images". */
  path: string;
  token: () => string | null;
```

In `frontend/src/lib/upload.ts`, replace:
```ts
const UPLOAD_TIMEOUT_MS = 180_000;

```
with:
```ts
const UPLOAD_TIMEOUT_MS = 180_000;

export type Uploader = ReturnType<typeof createUploader>;

```

In `frontend/src/lib/upload.ts`, replace:
```ts
      xhr.open("POST", "/api/admin/images");
```
with:
```ts
      xhr.open("POST", deps.path);
```

`frontend/src/lib/auth.ts`
```ts
import { type Accessor, createSignal } from "solid-js";
import { type KV, safeKV } from "./storage.ts";

const ADMIN_TOKEN_KEY = "wr.admin_token";

export interface Auth {
  token: Accessor<string | null>;
  set(token: string): void;
  clear(): void;
}

/** A signed-in session kept in storage under key; admins and shop owners each have their own. */
export function createAuth(kv: KV, key = ADMIN_TOKEN_KEY): Auth {
  const [token, setToken] = createSignal<string | null>(kv.get(key));
  return {
    token,
    set(next) {
      kv.set(key, next);
      setToken(next);
    },
    clear() {
      kv.remove(key);
      setToken(null);
    },
  };
}

export const auth = createAuth(safeKV());
```

`frontend/src/lib/shopAuth.ts`
```ts
import { createAuth } from "./auth.ts";
import { safeKV } from "./storage.ts";

export const SHOP_TOKEN_KEY = "wr.shop_token";

/** The shop owner's session, kept apart from the admin's. */
export const shopAuth = createAuth(safeKV(), SHOP_TOKEN_KEY);
```

`frontend/src/lib/client.ts`
```ts
import { createApi } from "./api.ts";
import { auth } from "./auth.ts";
import { shopAuth } from "./shopAuth.ts";
import { createUploader } from "./upload.ts";

/** The session expired or was revoked: drop the token and ask to sign in again, then come back. */
function signInAgain(clear: () => void, loginPath: string) {
  return () => {
    clear();
    if (!location.pathname.startsWith(loginPath)) {
      location.assign(`${loginPath}?next=${encodeURIComponent(location.pathname + location.search)}`);
    }
  };
}

const fetchFn: typeof fetch = (input, init) => fetch(input, init);
const onAdminUnauthorized = signInAgain(() => auth.clear(), "/admin/login");
const onOwnerUnauthorized = signInAgain(() => shopAuth.clear(), "/shop/login");

/** Public calls and the admin's calls (admin token). */
export const api = createApi({ fetch: fetchFn, token: auth.token, onUnauthorized: onAdminUnauthorized });
export const uploadImage = createUploader({
  path: "/api/admin/images",
  token: auth.token,
  onUnauthorized: onAdminUnauthorized,
});

/** A shop owner's calls (shop token); use ownerApi.owner.*. */
export const ownerApi = createApi({ fetch: fetchFn, token: shopAuth.token, onUnauthorized: onOwnerUnauthorized });
export const uploadOwnerImage = createUploader({
  path: "/api/shop/images",
  token: shopAuth.token,
  onUnauthorized: onOwnerUnauthorized,
});
```

- [ ] **Step 6: Add the manage context**

`frontend/src/lib/manage.ts`
```ts
import { createContext, useContext } from "solid-js";
import type { Api, ManageCalls } from "./api.ts";
import type { AdminShop } from "./types.ts";
import type { Uploader } from "./upload.ts";

/**
 * What the shared dress, photo and calendar editors need: the admin panel provides one for
 * every shop, "My shop" provides one that only ever reaches the owner's own shop.
 */
export interface Manage {
  calls: ManageCalls;
  upload: Uploader;
  /** The dress list to go back to, optionally for one shop. */
  dressesHref: (shopId?: number) => string;
  /** The editor page of one dress. */
  dressHref: (id: number) => string;
  /** Admins choose a dress's shop from this list; an owner's dresses always go to their own shop. */
  shops?: () => Promise<AdminShop[]>;
}

export const ManageContext = createContext<Manage>();

export function useManage(): Manage {
  const m = useContext(ManageContext);
  if (!m) throw new Error("useManage outside a ManageContext provider");
  return m;
}

/** The admin panel: every shop, under /admin. */
export function adminManage(api: Api, upload: Uploader): Manage {
  return {
    calls: api.admin,
    upload,
    dressesHref: (shopId) => (shopId ? `/admin/dresses?shop_id=${shopId}` : "/admin/dresses"),
    dressHref: (id) => `/admin/dresses/${id}`,
    shops: () => api.admin.shops(),
  };
}

/** "My shop": the signed-in owner's own shop, under /shop. */
export function ownerManage(api: Api, upload: Uploader): Manage {
  return {
    calls: api.owner,
    upload,
    dressesHref: () => "/shop",
    dressHref: (id) => `/shop/dresses/${id}`,
  };
}
```

- [ ] **Step 7: Run all frontend checks**

Run: `deno task test && deno task check && deno task build`
Expected:
- the tests pass;
- `check` reports no errors;
- the build prints `✓ built`.

The admin pages still call `api.admin.*`, whose names are unchanged.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib
git commit -m "feat(frontend): API calls for shop owners and a shared manage context"
```

---

### Task 5: The shared editors use the manage context

The admin panel must look and behave exactly as before after this task. Only where the editors get their calls from changes.

**Files:**
- Create: `frontend/src/components/admin/ShopFields.tsx`
- Modify:
  - `frontend/src/components/admin/PhotoManager.tsx`
  - `frontend/src/components/admin/LogoUpload.tsx`
  - `frontend/src/components/admin/AvailabilityEditor.tsx`
  - `frontend/src/pages/admin/DressEdit.tsx`
  - `frontend/src/pages/admin/ShopEdit.tsx`
  - `frontend/src/pages/admin/AdminLayout.tsx`

**Interfaces:**
- Consumes:
  - from Task 4: `useManage`, `ManageContext`, `adminManage`, `api` and `uploadImage`;
  - existing: `TextField`, `SelectField`, `TextArea`, `AliasEditor`, `useCities` and `cityName`.
- Produces:
  - `ShopFields(props: { form: ShopInput; setForm: SetStoreFunction<ShopInput>; errors: Record<string, string> })`
  - `DressEdit`, the default export of `pages/admin/DressEdit.tsx`, works under any `ManageContext` provider. Task 6 mounts it under `/shop` too.
  - `AdminLayout` provides `adminManage(api, uploadImage)` to every `/admin` page.

- [ ] **Step 1: PhotoManager**

In `frontend/src/components/admin/PhotoManager.tsx`, replace:
```tsx
import { api, uploadImage } from "../../lib/client.ts";
import { errorMessage } from "../../lib/errors.ts";
```
with:
```tsx
import { errorMessage } from "../../lib/errors.ts";
import { useManage } from "../../lib/manage.ts";
```

In `frontend/src/components/admin/PhotoManager.tsx`, replace:
```tsx
}) {
  const [uploads, setUploads] = createStore<Upload[]>([]);
```
with:
```tsx
}) {
  const m = useManage();
  const [uploads, setUploads] = createStore<Upload[]>([]);
```

In `frontend/src/components/admin/PhotoManager.tsx`, replace:
```tsx
          const img = await uploadImage(
```
with:
```tsx
          const img = await m.upload(
```

In `frontend/src/components/admin/PhotoManager.tsx`, replace:
```tsx
      await api.admin.reorderImages(next.map((i) => i.id));
```
with:
```tsx
      await m.calls.reorderImages(next.map((i) => i.id));
```

In `frontend/src/components/admin/PhotoManager.tsx`, replace:
```tsx
      await api.admin.deleteImage(img.id);
```
with:
```tsx
      await m.calls.deleteImage(img.id);
```

- [ ] **Step 2: LogoUpload**

In `frontend/src/components/admin/LogoUpload.tsx`, replace:
```tsx
import { uploadImage } from "../../lib/client.ts";
import { errorMessage } from "../../lib/errors.ts";
```
with:
```tsx
import { errorMessage } from "../../lib/errors.ts";
import { useManage } from "../../lib/manage.ts";
```

In `frontend/src/components/admin/LogoUpload.tsx`, replace:
```tsx
}) {
  const [progress, setProgress] = createSignal<number | null>(null);
```
with:
```tsx
}) {
  const m = useManage();
  const [progress, setProgress] = createSignal<number | null>(null);
```

In `frontend/src/components/admin/LogoUpload.tsx`, replace:
```tsx
      props.onUploaded(await uploadImage(file, { shopId: props.shopId }, setProgress));
```
with:
```tsx
      props.onUploaded(await m.upload(file, { shopId: props.shopId }, setProgress));
```

- [ ] **Step 3: AvailabilityEditor**

In `frontend/src/components/admin/AvailabilityEditor.tsx`, replace:
```tsx
import { api } from "../../lib/client.ts";
```
with:
```tsx
import { useManage } from "../../lib/manage.ts";
```

In `frontend/src/components/admin/AvailabilityEditor.tsx`, replace:
```tsx
export default function AvailabilityEditor(props: { dressId: number }) {
  const [data, { refetch }] = createResource(() => props.dressId, (id) => api.admin.busyDays(id));
```
with:
```tsx
export default function AvailabilityEditor(props: { dressId: number }) {
  const m = useManage();
  const [data, { refetch }] = createResource(() => props.dressId, (id) => m.calls.busyDays(id));
```

In `frontend/src/components/admin/AvailabilityEditor.tsx`, replace:
```tsx
      await (makeBusy ? api.admin.markBusy(props.dressId, day) : api.admin.markFree(props.dressId, day));
```
with:
```tsx
      await (makeBusy ? m.calls.markBusy(props.dressId, day) : m.calls.markFree(props.dressId, day));
```

- [ ] **Step 4: The dress editor**

Admins choose the shop from a select. An owner's dresses always go to their own shop, because the server forces it, so owners get no select.

In `frontend/src/pages/admin/DressEdit.tsx`, replace:
```tsx
import { api } from "../../lib/client.ts";
import { fieldMessage, validationFields } from "../../lib/errors.ts";
import { type DressForm, dressFormToInput, dressToForm, EMPTY_DRESS_FORM, firstParam } from "../../lib/forms.ts";
```
with:
```tsx
import { fieldMessage, validationFields } from "../../lib/errors.ts";
import { type DressForm, dressFormToInput, dressToForm, EMPTY_DRESS_FORM, firstParam } from "../../lib/forms.ts";
import { useManage } from "../../lib/manage.ts";
```

In `frontend/src/pages/admin/DressEdit.tsx`, replace:
```tsx
/** The editor for one dress (or a new one); remounted per dress by DressEdit below. */
function DressEditor(props: { id: number | null }) {
  const navigate = useNavigate();
```
with:
```tsx
/**
 * The editor for one dress (or a new one); remounted per dress by DressEdit below.
 * Admins and shop owners share it: useManage() says where it saves and links to.
 */
function DressEditor(props: { id: number | null }) {
  const m = useManage();
  const navigate = useNavigate();
```

In `frontend/src/pages/admin/DressEdit.tsx`, replace:
```tsx
  const [dress, { mutate, refetch }] = createResource(id, (dressId) => api.admin.dress(dressId));
  const [shops] = createResource(() => api.admin.shops());
```
with:
```tsx
  const [dress, { mutate, refetch }] = createResource(id, (dressId) => m.calls.dress(dressId));
  const [shops] = createResource(() => m.shops?.() ?? Promise.resolve([]));
```

In `frontend/src/pages/admin/DressEdit.tsx`, replace:
```tsx
      const result = current ? await api.admin.updateDress(current, input) : await api.admin.createDress(input);
```
with:
```tsx
      const result = current ? await m.calls.updateDress(current, input) : await m.calls.createDress(input);
```

In `frontend/src/pages/admin/DressEdit.tsx`, replace:
```tsx
      else navigate(`/admin/dresses/${result.id}`, { replace: true });
```
with:
```tsx
      else navigate(m.dressHref(result.id), { replace: true });
```

In `frontend/src/pages/admin/DressEdit.tsx`, replace:
```tsx
      await api.admin.deleteDress(current);
      navigate(`/admin/dresses?shop_id=${form.shop_id}`, { replace: true });
```
with:
```tsx
      await m.calls.deleteDress(current);
      navigate(m.dressesHref(form.shop_id), { replace: true });
```

In `frontend/src/pages/admin/DressEdit.tsx`, replace:
```tsx
      <A href="/admin/dresses" class="text-sm text-silver-ink hover:text-ink">{t("common.back")}</A>
```
with:
```tsx
      <A href={m.dressesHref()} class="text-sm text-silver-ink hover:text-ink">{t("common.back")}</A>
```

In `frontend/src/pages/admin/DressEdit.tsx`, replace:
```tsx
            <SelectField
              label={t("admin.shop")}
              value={form.shop_id ? String(form.shop_id) : ""}
              options={shopOptions()}
              onChange={(v) => setForm("shop_id", Number(v) || 0)}
              error={err("shop_id")}
            />
```
with:
```tsx
            <Show when={m.shops}>
              <SelectField
                label={t("admin.shop")}
                value={form.shop_id ? String(form.shop_id) : ""}
                options={shopOptions()}
                onChange={(v) => setForm("shop_id", Number(v) || 0)}
                error={err("shop_id")}
              />
            </Show>
```

In `frontend/src/pages/admin/DressEdit.tsx`, replace:
```tsx
/** Both /admin/dresses/new (optionally ?shop_id=) and /admin/dresses/:id; a fresh editor per dress. */
```
with:
```tsx
/**
 * /admin/dresses/new (optionally ?shop_id=), /admin/dresses/:id, /shop/dresses/new and
 * /shop/dresses/:id; a fresh editor per dress.
 */
```

- [ ] **Step 5: The shared shop form body**

`frontend/src/components/admin/ShopFields.tsx`
```tsx
import type { SetStoreFunction } from "solid-js/store";
import { i18n, t } from "../../i18n/i18n.ts";
import { useCities } from "../../lib/cities.ts";
import { cityName } from "../../lib/format.ts";
import type { ShopInput } from "../../lib/types.ts";
import AliasEditor from "./AliasEditor.tsx";
import { SelectField, TextArea, TextField } from "./Field.tsx";

/** The shop details form body, shared by the admin shop editor and "My shop". */
export default function ShopFields(props: {
  form: ShopInput;
  setForm: SetStoreFunction<ShopInput>;
  /** Raw API field values by field name, e.g. { name: "required" }. */
  errors: Record<string, string>;
}) {
  const cities = useCities();
  const err = (field: string) => props.errors[field];
  const cityOptions = () => [
    { value: "", label: t("admin.choose") },
    ...cities().map((c) => ({ value: String(c.id), label: cityName(c, i18n.lang()) })),
  ];
  return (
    <>
      <TextField
        label={t("shopform.name")}
        value={props.form.name}
        onInput={(v) => props.setForm("name", v)}
        error={err("name")}
      />
      <SelectField
        label={t("shopform.city")}
        value={props.form.city_id ? String(props.form.city_id) : ""}
        options={cityOptions()}
        onChange={(v) => props.setForm("city_id", Number(v) || 0)}
        error={err("city_id")}
      />
      <TextField
        label={t("shopform.address")}
        value={props.form.address}
        onInput={(v) => props.setForm("address", v)}
        error={err("address")}
      />
      <TextField
        label={t("shopform.phone")}
        type="tel"
        inputmode="tel"
        value={props.form.phone}
        onInput={(v) => props.setForm("phone", v)}
        error={err("phone")}
      />
      <div class="grid gap-5 sm:grid-cols-2">
        <TextField
          label={t("shopform.instagram_url")}
          type="url"
          inputmode="url"
          hint={t("shopform.url_hint")}
          value={props.form.instagram_url}
          onInput={(v) => props.setForm("instagram_url", v)}
          error={err("instagram_url")}
        />
        <TextField
          label={t("shopform.tiktok_url")}
          type="url"
          inputmode="url"
          hint={t("shopform.url_hint")}
          value={props.form.tiktok_url}
          onInput={(v) => props.setForm("tiktok_url", v)}
          error={err("tiktok_url")}
        />
      </div>
      <TextArea
        label={t("shopform.description")}
        value={props.form.description}
        onInput={(v) => props.setForm("description", v)}
        error={err("description")}
      />
      <AliasEditor
        aliases={props.form.aliases}
        onChange={(list) => props.setForm("aliases", list)}
        error={err("aliases")}
      />
    </>
  );
}
```

`frontend/src/pages/admin/ShopEdit.tsx` now uses it, and nothing else changes:
`frontend/src/pages/admin/ShopEdit.tsx`
```tsx
import { A, useNavigate, useParams } from "@solidjs/router";
import { createEffect, createResource, createSignal, Match, on, Show, Switch } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { CheckboxField, FormActions } from "../../components/admin/Field.tsx";
import LogoUpload from "../../components/admin/LogoUpload.tsx";
import ShopFields from "../../components/admin/ShopFields.tsx";
import ErrorState from "../../components/ErrorState.tsx";
import { t } from "../../i18n/i18n.ts";
import { api } from "../../lib/client.ts";
import { validationFields } from "../../lib/errors.ts";
import { cleanShopInput, EMPTY_SHOP_INPUT, shopToInput } from "../../lib/forms.ts";
import { usePageTitle } from "../../lib/title.ts";
import type { ShopInput } from "../../lib/types.ts";

/** The editor for one shop (or a new one); remounted per shop by ShopEdit below. */
function ShopEditor(props: { id: number | null }) {
  const navigate = useNavigate();
  const id = () => props.id;
  const [shop, { mutate, refetch }] = createResource(id, (shopId) => api.admin.shop(shopId));
  const [form, setForm] = createStore<ShopInput>({ ...EMPTY_SHOP_INPUT, aliases: [] });
  // Refill the form only when the saved shop changes, not when just its logo does.
  createEffect(on(() => (shop.state === "ready" ? shop()?.updated_at : undefined), (stamp) => {
    const s = shop.state === "ready" ? shop() : undefined;
    if (stamp && s) setForm(reconcile(shopToInput(s)));
  }));
  const [errors, setErrors] = createSignal<Record<string, string>>({});
  const [error, setError] = createSignal<unknown>(null);
  const [saving, setSaving] = createSignal(false);
  const [saved, setSaved] = createSignal(false);
  usePageTitle(() => (id() ? form.name || t("admin.edit") : t("admin.new_shop")));

  async function save(e: SubmitEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setErrors({});
    setError(null);
    try {
      const input = cleanShopInput({ ...form, aliases: [...form.aliases] });
      const current = id();
      const result = current ? await api.admin.updateShop(current, input) : await api.admin.createShop(input);
      setSaved(true);
      if (current) mutate(result);
      else navigate(`/admin/shops/${result.id}`, { replace: true });
    } catch (e) {
      setErrors(validationFields(e));
      setError(() => e);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const current = id();
    if (!current || !confirm(t("admin.delete_shop_confirm"))) return;
    try {
      await api.admin.deleteShop(current);
      navigate("/admin/shops", { replace: true });
    } catch (e) {
      setError(() => e);
    }
  }

  return (
    <div class="max-w-2xl">
      <A href="/admin/shops" class="text-sm text-silver-ink hover:text-ink">{t("common.back")}</A>
      <h1 class="mt-2 text-3xl">{id() ? form.name || t("admin.edit") : t("admin.new_shop")}</h1>
      <Switch>
        <Match when={shop.error}>
          <ErrorState error={shop.error} onRetry={() => void refetch()} />
        </Match>
        <Match when={id() !== null && !shop()}>
          <p class="mt-6 text-silver-ink">{t("common.loading")}</p>
        </Match>
        <Match when={id() === null || shop()}>
          <form class="mt-6 space-y-5 rounded-lg bg-white p-5" novalidate onSubmit={save}>
            <ShopFields form={form} setForm={setForm} errors={errors()} />
            <CheckboxField
              label={t("admin.published")}
              hint={t("admin.published_hint")}
              checked={form.is_published}
              onChange={(v) => setForm("is_published", v)}
            />
            <FormActions saving={saving()} saved={saved()} error={error()} onDelete={id() ? remove : undefined} />
          </form>
          <Show when={id() !== null && shop()}>
            {(s) => (
              <section class="mt-8 rounded-lg bg-white p-5">
                <LogoUpload
                  shopId={s().id}
                  name={s().name}
                  logo={s().logo}
                  onUploaded={(logo) => mutate({ ...s(), logo })}
                />
              </section>
            )}
          </Show>
        </Match>
      </Switch>
    </div>
  );
}

/** Both /admin/shops/new and /admin/shops/:id; a fresh editor per shop, so no state leaks between shops. */
export default function ShopEdit() {
  const params = useParams();
  return (
    <Show when={params.id ?? "new"} keyed>
      {(key) => <ShopEditor id={key === "new" ? null : Number(key)} />}
    </Show>
  );
}
```

- [ ] **Step 6: The admin layout provides the admin calls**

In `frontend/src/pages/admin/AdminLayout.tsx`, replace:
```tsx
import { auth } from "../../lib/auth.ts";
import { mainRef } from "../../lib/dom.ts";
```
with:
```tsx
import { auth } from "../../lib/auth.ts";
import { api, uploadImage } from "../../lib/client.ts";
import { mainRef } from "../../lib/dom.ts";
import { adminManage, ManageContext } from "../../lib/manage.ts";
```

In `frontend/src/pages/admin/AdminLayout.tsx`, replace:
```tsx
const NAV_LINK = "inline-flex min-h-11 items-center rounded-full px-3 hover:bg-veil";
```
with:
```tsx
const manage = adminManage(api, uploadImage);

const NAV_LINK = "inline-flex min-h-11 items-center rounded-full px-3 hover:bg-veil";
```

In `frontend/src/pages/admin/AdminLayout.tsx`, replace:
```tsx
        <main ref={mainRef} id="main" tabindex="-1" class="mx-auto max-w-6xl px-4 py-8 outline-none">{props.children}</main>
```
with:
```tsx
        <main ref={mainRef} id="main" tabindex="-1" class="mx-auto max-w-6xl px-4 py-8 outline-none">
          <ManageContext.Provider value={manage}>{props.children}</ManageContext.Provider>
        </main>
```

- [ ] **Step 7: Run all frontend checks**

Run: `deno task test && deno task check && deno task build`
Expected:
- the tests pass;
- `check` reports no errors;
- the build prints `✓ built`.

Also run `grep -rn "api.admin\|uploadImage" src/components/admin src/pages/admin/DressEdit.tsx`. Expected: no matches. The shared editors reach the API only through `useManage()`.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/admin frontend/src/pages/admin
git commit -m "refactor(frontend): shared editors take their API from the manage context"
```

---

### Task 6: "My shop": sign-up, sign-in, dashboard, routes and texts

**Files:**
- Create:
  - `frontend/src/lib/areas.ts`
  - `frontend/src/lib/areas_test.ts`
  - `frontend/src/pages/shop/ShopLayout.tsx`
  - `frontend/src/pages/shop/ShopLogin.tsx`
  - `frontend/src/pages/shop/ShopSignup.tsx`
  - `frontend/src/pages/shop/MyShop.tsx`
- Modify:
  - `frontend/src/lib/forms.ts`
  - `frontend/src/app/App.tsx`
  - `frontend/src/main.tsx`
  - `frontend/src/i18n/en.json`, `frontend/src/i18n/ru.json` and `frontend/src/i18n/tk.json`
- Test:
  - `frontend/src/lib/forms_test.ts`
  - `frontend/src/i18n/i18n_test.ts`

**Interfaces:**
- Consumes:
  - from Task 4: `ownerApi`, `uploadOwnerImage`, `shopAuth`, `ownerManage`, `ManageContext`, `SignupInput` and `ApiError`;
  - from Task 5: `ShopFields`, `LogoUpload` and `DressEdit`;
  - existing: `Field.tsx` components, `GolBand`, `LanguageSwitch`, `ErrorState`, `StatusBadge`, `PlusIcon`, `priceText`, `usePageTitle`, `mainRef`, `cleanShopInput`, `shopToInput` and `EMPTY_SHOP_INPUT`.
- Produces:
  - Helpers:
    - `ownerReturnPath(next: string): string`, in `lib/forms.ts`
    - `hasOwnChrome(pathname: string): boolean`, in `lib/areas.ts`
  - Routes:
    - `/shop/signup` and `/shop/login`;
    - `/shop` (MyShop), `/shop/dresses/new` and `/shop/dresses/:id`, all inside `ShopLayout`.
  - i18n keys:
    - `field.taken` and `field.too_short`
    - `footer.add_shop`
    - `signup.*`, `shoplogin.*` and `myshop.*`

- [ ] **Step 1: Write the failing tests**

In `frontend/src/lib/forms_test.ts`, replace:
```ts
import { cleanShopInput, EMPTY_SHOP_INPUT, firstParam, shopToInput } from "./forms.ts";
```
with:
```ts
import { cleanShopInput, EMPTY_SHOP_INPUT, firstParam, ownerReturnPath, shopToInput } from "./forms.ts";
```

Append to `frontend/src/lib/forms_test.ts`:
```ts

Deno.test("ownerReturnPath stays inside My shop", () => {
  for (const path of ["/shop", "/shop/dresses/4", "/shop/dresses/new", "/shop?x=1"]) {
    assertEquals(ownerReturnPath(path), path);
  }
  for (const path of ["", "/shops/ak-gelin", "/shopping", "/admin/shops", "https://evil.example/shop", "//evil.example", "/shop/login", "/shop/signup"]) {
    assertEquals(ownerReturnPath(path), "/shop", path);
  }
});
```

`frontend/src/lib/areas_test.ts`
```ts
import { assertEquals } from "@std/assert";
import { hasOwnChrome } from "./areas.ts";

Deno.test("admin and My shop pages bring their own chrome, public shop pages do not", () => {
  for (const path of ["/admin", "/admin/shops/3", "/shop", "/shop/login", "/shop/dresses/4"]) {
    assertEquals(hasOwnChrome(path), true, path);
  }
  for (const path of ["/", "/shops/ak-gelin", "/shopping", "/dresses/4", "/administrator"]) {
    assertEquals(hasOwnChrome(path), false, path);
  }
});
```

In `frontend/src/i18n/i18n_test.ts`, replace:
```ts
  "required", "invalid", "too_long", "too_many", "too_large", "must_be_positive", "out_of_range",
```
with:
```ts
  "required", "invalid", "too_long", "too_many", "too_large", "must_be_positive", "out_of_range", "taken",
  "too_short",
```

Run: `deno task test`
Expected: FAIL. The type-check reports that `ownerReturnPath` is not exported and that `./areas.ts` cannot be found.

- [ ] **Step 2: The two helpers**

In `frontend/src/lib/forms.ts`, replace:
```ts
/** Router search params can hold one value or a list; take the first. */
```
with:
```ts
/** Where a shop owner goes after signing in: only back into "My shop", never to another site. */
export function ownerReturnPath(next: string): string {
  const inside = next === "/shop" || next.startsWith("/shop/") || next.startsWith("/shop?");
  return inside && !next.startsWith("/shop/login") && !next.startsWith("/shop/signup") ? next : "/shop";
}

/** Router search params can hold one value or a list; take the first. */
```

`frontend/src/lib/areas.ts`
```ts
/** /admin and /shop ("My shop", not the public /shops/:slug) bring their own chrome. */
export function hasOwnChrome(pathname: string): boolean {
  return ["/admin", "/shop"].some((area) => pathname === area || pathname.startsWith(`${area}/`));
}
```

- [ ] **Step 3: The texts**

Add these entries at the end of each language file, after `"avail.save_first"`. Add a comma to that line, because it is no longer the last one. Keep the closing `}` on its own line at the end.

**en.json**
```json
  "field.taken": "This number is already in use",
  "field.too_short": "At least 10 characters",
  "footer.add_shop": "Rent out dresses? Add your shop",
  "signup.title": "Add your shop",
  "signup.lead": "Create an account and add your dresses yourself. Your shop page goes live at once.",
  "signup.phone_hint": "You sign in with this number. Brides call it too.",
  "signup.password_hint": "At least 10 characters",
  "signup.submit": "Create account",
  "signup.creating": "Creating…",
  "signup.have_account": "Already have an account?",
  "shoplogin.title": "Shop sign-in",
  "shoplogin.phone": "Phone number",
  "shoplogin.wrong": "Incorrect phone number or password.",
  "shoplogin.forgot": "Forgot your password?",
  "shoplogin.forgot_body": "Call us, and we'll set a new one for you.",
  "shoplogin.no_account": "No account yet?",
  "myshop.title": "My shop",
  "myshop.hidden": "Your shop is hidden from the site. Call us.",
  "myshop.view_page": "See your shop page",
  "myshop.dresses": "My dresses",
  "myshop.no_dresses": "No dresses yet. Add your first one and tick Published so brides can see it.",
  "myshop.details": "Shop details"
```

**ru.json**
```json
  "field.taken": "Этот номер уже используется",
  "field.too_short": "Не короче 10 символов",
  "footer.add_shop": "Сдаёте платья в аренду? Добавьте свой салон",
  "signup.title": "Добавьте свой салон",
  "signup.lead": "Создайте аккаунт и добавляйте платья сами. Страница салона появится сразу.",
  "signup.phone_hint": "По этому номеру вы входите. Невесты тоже будут звонить на него.",
  "signup.password_hint": "Не короче 10 символов",
  "signup.submit": "Создать аккаунт",
  "signup.creating": "Создаём…",
  "signup.have_account": "Уже есть аккаунт?",
  "shoplogin.title": "Вход для салонов",
  "shoplogin.phone": "Номер телефона",
  "shoplogin.wrong": "Неверный номер телефона или пароль.",
  "shoplogin.forgot": "Забыли пароль?",
  "shoplogin.forgot_body": "Позвоните нам, и мы установим новый пароль.",
  "shoplogin.no_account": "Нет аккаунта?",
  "myshop.title": "Мой салон",
  "myshop.hidden": "Ваш салон скрыт с сайта. Позвоните нам.",
  "myshop.view_page": "Открыть страницу салона",
  "myshop.dresses": "Мои платья",
  "myshop.no_dresses": "Платьев пока нет. Добавьте первое и отметьте «Опубликовано», чтобы невесты его увидели.",
  "myshop.details": "О салоне"
```

**tk.json**
```json
  "field.taken": "Bu belgi eýýäm ulanylýar",
  "field.too_short": "Azyndan 10 belgi bolmaly",
  "footer.add_shop": "Köýnek kärendesine berýärsiňizmi? Salonyňyzy goşuň",
  "signup.title": "Salonyňyzy goşuň",
  "signup.lead": "Hasap açyň we köýnekleriňizi özüňiz goşuň. Salonyňyzyň sahypasy derrew açylýar.",
  "signup.phone_hint": "Bu belgi bilen girersiňiz. Gelinler hem şu belgä jaň eder.",
  "signup.password_hint": "Azyndan 10 belgi",
  "signup.submit": "Hasap aç",
  "signup.creating": "Döredilýär…",
  "signup.have_account": "Hasabyňyz barmy?",
  "shoplogin.title": "Salona giriş",
  "shoplogin.phone": "Telefon belgisi",
  "shoplogin.wrong": "Telefon belgisi ýa-da açar söz nädogry.",
  "shoplogin.forgot": "Açar sözüňizi ýatdan çykardyňyzmy?",
  "shoplogin.forgot_body": "Bize jaň ediň, size täze açar söz goýarys.",
  "shoplogin.no_account": "Hasabyňyz ýokmy?",
  "myshop.title": "Meniň salonym",
  "myshop.hidden": "Salonyňyz saýtda gizlenildi. Bize jaň ediň.",
  "myshop.view_page": "Salonyň sahypasyny gör",
  "myshop.dresses": "Meniň köýneklerim",
  "myshop.no_dresses": "Heniz köýnek ýok. Ilkinjisini goşuň we «Çap edildi» belläň, şonda gelinler ony görer.",
  "myshop.details": "Salon barada"
```

Run: `deno task test`
Expected: PASS. This includes `tk, ru and en have exactly the same keys` and the field-value test.

- [ ] **Step 4: The pages**

`frontend/src/pages/shop/ShopLayout.tsx`
```tsx
import { A, Navigate, type RouteSectionProps, useLocation, useNavigate } from "@solidjs/router";
import { Show } from "solid-js";
import GolBand from "../../components/GolBand.tsx";
import LanguageSwitch from "../../components/LanguageSwitch.tsx";
import { t } from "../../i18n/i18n.ts";
import { ownerApi, uploadOwnerImage } from "../../lib/client.ts";
import { mainRef } from "../../lib/dom.ts";
import { ManageContext, ownerManage } from "../../lib/manage.ts";
import { shopAuth } from "../../lib/shopAuth.ts";
import { usePageTitle } from "../../lib/title.ts";

const manage = ownerManage(ownerApi, uploadOwnerImage);

/** Every "My shop" page: requires a shop owner's token, otherwise goes to sign-in and comes back. */
export default function ShopLayout(props: RouteSectionProps) {
  usePageTitle(() => t("myshop.title"));
  const location = useLocation();
  const navigate = useNavigate();
  const signOut = () => {
    shopAuth.clear();
    navigate("/shop/login", { replace: true });
  };
  return (
    <Show
      when={shopAuth.token()}
      fallback={<Navigate href={`/shop/login?next=${encodeURIComponent(location.pathname + location.search)}`} />}
    >
      <div class="min-h-screen bg-veil">
        <header class="bg-white">
          <GolBand />
          <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
            <A href="/" class="font-display text-2xl text-garnet">{t("app.name")}</A>
            <A href="/shop" end class="text-sm text-silver-ink hover:text-ink" activeClass="font-semibold">
              {t("myshop.title")}
            </A>
            <div class="ml-auto flex items-center gap-1">
              <LanguageSwitch />
              <button type="button" class="btn btn-quiet" onClick={signOut}>{t("admin.sign_out")}</button>
            </div>
          </div>
        </header>
        <main ref={mainRef} id="main" tabindex="-1" class="mx-auto max-w-6xl px-4 py-8 outline-none">
          <ManageContext.Provider value={manage}>{props.children}</ManageContext.Provider>
        </main>
      </div>
    </Show>
  );
}
```

`frontend/src/pages/shop/ShopLogin.tsx`
```tsx
import { A, useNavigate, useSearchParams } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import { TextField } from "../../components/admin/Field.tsx";
import GolBand from "../../components/GolBand.tsx";
import LanguageSwitch from "../../components/LanguageSwitch.tsx";
import { t, tr } from "../../i18n/i18n.ts";
import { ApiError } from "../../lib/api.ts";
import { ownerApi } from "../../lib/client.ts";
import { errorMessage } from "../../lib/errors.ts";
import { firstParam, ownerReturnPath } from "../../lib/forms.ts";
import { shopAuth } from "../../lib/shopAuth.ts";
import { usePageTitle } from "../../lib/title.ts";

export default function ShopLogin() {
  usePageTitle(() => t("shoplogin.title"));
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const [phone, setPhone] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal<unknown>(null);
  const [busy, setBusy] = createSignal(false);
  const message = () => {
    const e = error();
    // The admin message says "email"; owners sign in with a phone number.
    return e instanceof ApiError && e.code === "invalid_credentials" ? t("shoplogin.wrong") : errorMessage(e, tr);
  };

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      shopAuth.set(await ownerApi.owner.login(phone().trim(), password()));
      navigate(ownerReturnPath(firstParam(search.next)), { replace: true });
    } catch (err) {
      setError(() => err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="min-h-screen bg-veil">
      <GolBand />
      <main class="mx-auto max-w-sm px-4 py-16">
        <div class="flex items-center justify-between gap-3">
          <A href="/" class="font-display text-3xl text-garnet">{t("app.name")}</A>
          <LanguageSwitch />
        </div>
        <form class="mt-8 space-y-4 rounded-lg bg-white p-6" onSubmit={submit}>
          <h1 class="text-3xl">{t("shoplogin.title")}</h1>
          <TextField
            label={t("shoplogin.phone")}
            type="tel"
            inputmode="tel"
            autocomplete="username"
            value={phone()}
            onInput={setPhone}
          />
          <TextField
            label={t("admin.password")}
            type="password"
            autocomplete="current-password"
            value={password()}
            onInput={setPassword}
          />
          <Show when={error()}>
            <p role="alert" class="text-sm text-garnet">{message()}</p>
          </Show>
          <button type="submit" class="btn btn-primary w-full" disabled={busy()}>{t("admin.sign_in")}</button>
          <details class="text-sm">
            <summary class="cursor-pointer text-silver-ink hover:text-ink">{t("shoplogin.forgot")}</summary>
            <p class="mt-2">{t("shoplogin.forgot_body")}</p>
          </details>
        </form>
        <p class="mt-6 text-center text-sm">
          {t("shoplogin.no_account")} <A href="/shop/signup" class="font-semibold text-garnet">{t("signup.title")}</A>
        </p>
      </main>
    </div>
  );
}
```

`frontend/src/pages/shop/ShopSignup.tsx`
```tsx
import { A, useNavigate } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { SelectField, TextField } from "../../components/admin/Field.tsx";
import GolBand from "../../components/GolBand.tsx";
import LanguageSwitch from "../../components/LanguageSwitch.tsx";
import { i18n, t, tr } from "../../i18n/i18n.ts";
import { useCities } from "../../lib/cities.ts";
import { ownerApi } from "../../lib/client.ts";
import { errorMessage, validationFields } from "../../lib/errors.ts";
import { cityName } from "../../lib/format.ts";
import { shopAuth } from "../../lib/shopAuth.ts";
import { usePageTitle } from "../../lib/title.ts";
import type { SignupInput } from "../../lib/types.ts";

/** A rental shop creates its account and its public shop page in one step. */
export default function ShopSignup() {
  usePageTitle(() => t("signup.title"));
  const navigate = useNavigate();
  const cities = useCities();
  const [form, setForm] = createStore<SignupInput>({ shop_name: "", city_id: 0, address: "", phone: "", password: "" });
  const [errors, setErrors] = createSignal<Record<string, string>>({});
  const [error, setError] = createSignal<unknown>(null);
  const [busy, setBusy] = createSignal(false);
  const err = (field: string) => errors()[field];
  const cityOptions = () => [
    { value: "", label: t("admin.choose") },
    ...cities().map((c) => ({ value: String(c.id), label: cityName(c, i18n.lang()) })),
  ];

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      shopAuth.set(
        await ownerApi.owner.signup({
          ...form,
          shop_name: form.shop_name.trim(),
          address: form.address.trim(),
          phone: form.phone.trim(),
        }),
      );
      navigate("/shop", { replace: true });
    } catch (err) {
      setErrors(validationFields(err));
      setError(() => err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="min-h-screen bg-veil">
      <GolBand />
      <main class="mx-auto max-w-md px-4 py-12">
        <div class="flex items-center justify-between gap-3">
          <A href="/" class="font-display text-3xl text-garnet">{t("app.name")}</A>
          <LanguageSwitch />
        </div>
        <form class="mt-8 space-y-5 rounded-lg bg-white p-6" novalidate onSubmit={submit}>
          <div>
            <h1 class="text-3xl">{t("signup.title")}</h1>
            <p class="mt-2 text-sm text-silver-ink">{t("signup.lead")}</p>
          </div>
          <TextField
            label={t("shopform.name")}
            autocomplete="organization"
            value={form.shop_name}
            onInput={(v) => setForm("shop_name", v)}
            error={err("shop_name")}
          />
          <SelectField
            label={t("shopform.city")}
            value={form.city_id ? String(form.city_id) : ""}
            options={cityOptions()}
            onChange={(v) => setForm("city_id", Number(v) || 0)}
            error={err("city_id")}
          />
          <TextField
            label={t("shopform.address")}
            value={form.address}
            onInput={(v) => setForm("address", v)}
            error={err("address")}
          />
          <TextField
            label={t("shoplogin.phone")}
            type="tel"
            inputmode="tel"
            autocomplete="username"
            hint={t("signup.phone_hint")}
            value={form.phone}
            onInput={(v) => setForm("phone", v)}
            error={err("phone")}
          />
          <TextField
            label={t("admin.password")}
            type="password"
            autocomplete="new-password"
            hint={t("signup.password_hint")}
            value={form.password}
            onInput={(v) => setForm("password", v)}
            error={err("password")}
          />
          <Show when={error()}>
            <p role="alert" class="text-sm text-garnet">{errorMessage(error(), tr)}</p>
          </Show>
          <button type="submit" class="btn btn-primary w-full" disabled={busy()}>
            {busy() ? t("signup.creating") : t("signup.submit")}
          </button>
        </form>
        <p class="mt-6 text-center text-sm">
          {t("signup.have_account")} <A href="/shop/login" class="font-semibold text-garnet">{t("shoplogin.title")}</A>
        </p>
      </main>
    </div>
  );
}
```

`frontend/src/pages/shop/MyShop.tsx`
```tsx
import { A } from "@solidjs/router";
import { createEffect, createResource, createSignal, For, Match, on, Show, Switch } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { FormActions } from "../../components/admin/Field.tsx";
import LogoUpload from "../../components/admin/LogoUpload.tsx";
import ShopFields from "../../components/admin/ShopFields.tsx";
import StatusBadge from "../../components/admin/StatusBadge.tsx";
import ErrorState from "../../components/ErrorState.tsx";
import { PlusIcon } from "../../components/icons.tsx";
import { priceText } from "../../components/price.ts";
import { t } from "../../i18n/i18n.ts";
import { ownerApi } from "../../lib/client.ts";
import { validationFields } from "../../lib/errors.ts";
import { cleanShopInput, EMPTY_SHOP_INPUT, shopToInput } from "../../lib/forms.ts";
import type { ShopInput } from "../../lib/types.ts";

/** "My shop": the owner's dresses and shop details. */
export default function MyShop() {
  const [me, { mutate, refetch }] = createResource(() => ownerApi.owner.me());
  const [dresses, dressList] = createResource(() => ownerApi.owner.dresses());
  const shop = () => (me.state === "ready" ? me()?.shop : undefined);
  const [form, setForm] = createStore<ShopInput>({ ...EMPTY_SHOP_INPUT, aliases: [] });
  // Refill the form only when the saved shop changes, not when just its logo does.
  createEffect(on(() => shop()?.updated_at, (stamp) => {
    const s = shop();
    if (stamp && s) setForm(reconcile(shopToInput(s)));
  }));
  const [errors, setErrors] = createSignal<Record<string, string>>({});
  const [error, setError] = createSignal<unknown>(null);
  const [saving, setSaving] = createSignal(false);
  const [saved, setSaved] = createSignal(false);

  async function save(e: SubmitEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setErrors({});
    setError(null);
    try {
      const result = await ownerApi.owner.updateShop(cleanShopInput({ ...form, aliases: [...form.aliases] }));
      setSaved(true);
      mutate((prev) => (prev ? { ...prev, shop: result } : prev));
    } catch (e) {
      setErrors(validationFields(e));
      setError(() => e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Switch>
      <Match when={me.error}>
        <ErrorState error={me.error} onRetry={() => void refetch()} />
      </Match>
      <Match when={!shop()}>
        <p class="text-silver-ink">{t("common.loading")}</p>
      </Match>
      <Match when={shop()}>
        {(s) => (
          <div class="max-w-2xl">
            <h1 class="text-3xl">{s().name}</h1>
            <Show
              when={s().is_published}
              fallback={<p class="mt-4 rounded-lg bg-blush p-4 text-garnet-deep">{t("myshop.hidden")}</p>}
            >
              <A href={`/shops/${s().slug}`} class="mt-2 inline-block text-sm font-semibold text-garnet">
                {t("myshop.view_page")}
              </A>
            </Show>

            <section class="mt-8">
              <div class="flex flex-wrap items-center gap-3">
                <h2 class="text-2xl">{t("myshop.dresses")}</h2>
                <A href="/shop/dresses/new" class="btn btn-primary ml-auto">
                  <PlusIcon />
                  {t("admin.new_dress")}
                </A>
              </div>
              <div class="mt-4">
                <Switch>
                  <Match when={dresses.error}>
                    <ErrorState error={dresses.error} onRetry={() => void dressList.refetch()} />
                  </Match>
                  <Match when={!dresses()}>
                    <p class="text-silver-ink">{t("common.loading")}</p>
                  </Match>
                  <Match when={dresses()?.length === 0}>
                    <p class="rounded-lg bg-white p-5 text-silver-ink">{t("myshop.no_dresses")}</p>
                  </Match>
                  <Match when={dresses()}>
                    {(list) => (
                      <ul class="divide-y divide-veil overflow-hidden rounded-lg bg-white">
                        <For each={list()}>
                          {(d) => (
                            <li>
                              <A href={`/shop/dresses/${d.id}`} class="flex items-center gap-4 px-4 py-3 hover:bg-veil/60">
                                <div class="h-16 w-12 shrink-0 overflow-hidden rounded-xs bg-veil">
                                  <Show when={d.images[0]}>
                                    {(img) => <img src={img().small} alt="" class="h-full w-full object-cover" />}
                                  </Show>
                                </div>
                                <div class="min-w-0 flex-1">
                                  <p class="truncate font-semibold">{d.title}</p>
                                  <p class="text-sm text-garnet">{priceText(d)}</p>
                                </div>
                                <StatusBadge published={d.is_published} />
                              </A>
                            </li>
                          )}
                        </For>
                      </ul>
                    )}
                  </Match>
                </Switch>
              </div>
            </section>

            <section class="mt-10">
              <h2 class="text-2xl">{t("myshop.details")}</h2>
              <form class="mt-4 space-y-5 rounded-lg bg-white p-5" novalidate onSubmit={save}>
                <ShopFields form={form} setForm={setForm} errors={errors()} />
                <FormActions saving={saving()} saved={saved()} error={error()} />
              </form>
              <div class="mt-6 rounded-lg bg-white p-5">
                <LogoUpload
                  shopId={s().id}
                  name={s().name}
                  logo={s().logo}
                  onUploaded={(logo) => mutate((prev) => (prev ? { ...prev, shop: { ...prev.shop, logo } } : prev))}
                />
              </div>
            </section>
          </div>
        )}
      </Match>
    </Switch>
  );
}
```

- [ ] **Step 5: Routes, own chrome for /shop, and the footer link**

Do not use `startsWith("/shop")` for the chrome rule: the public shop page `/shops/:slug` must keep the public header and footer. `hasOwnChrome` checks `/shop` and `/shop/…` only.

`frontend/src/app/App.tsx`
```tsx
import { A, type RouteSectionProps, useLocation } from "@solidjs/router";
import { createEffect, ErrorBoundary, type JSX, on, Show } from "solid-js";
import ErrorState from "../components/ErrorState.tsx";
import Header from "../components/Header.tsx";
import { t } from "../i18n/i18n.ts";
import { hasOwnChrome } from "../lib/areas.ts";
import { focusMain, mainRef } from "../lib/dom.ts";

/**
 * A render or chunk-load failure shows a message with a retry button, never a blank page.
 * Retry reloads the page: it recovers from a stale lazy chunk in every browser, whatever its message.
 */
function Guard(props: { children: JSX.Element }) {
  const where = useLocation();
  return (
    <ErrorBoundary
      fallback={(err, reset) => {
        // Following a link to another page clears the error.
        createEffect(on(() => where.pathname, reset, { defer: true }));
        return <ErrorState error={err} onRetry={() => location.reload()} />;
      }}
    >
      {props.children}
    </ErrorBoundary>
  );
}

/** Public pages get the header and footer; admin and "My shop" pages bring their own. */
export default function App(props: RouteSectionProps) {
  const location = useLocation();
  // Not on first load, and not when only the search string changes.
  createEffect(on(() => location.pathname, () => focusMain(), { defer: true }));
  return (
    <Show when={!hasOwnChrome(location.pathname)} fallback={<Guard>{props.children}</Guard>}>
      <a
        href="#main"
        rel="external" // keeps the router out of it, so the browser focuses <main> itself
        class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2"
      >
        {t("common.skip")}
      </a>
      <Header />
      <main ref={mainRef} id="main" tabindex="-1" class="mx-auto w-full max-w-6xl px-4 pb-20 outline-none">
        <Guard>{props.children}</Guard>
      </main>
      <footer class="border-t border-veil">
        <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-6 text-sm">
          <p class="text-silver-ink">{t("app.tagline")}</p>
          <A href="/shop/signup" class="font-semibold text-garnet">{t("footer.add_shop")}</A>
        </div>
      </footer>
    </Show>
  );
}
```

In `frontend/src/main.tsx`, replace:
```tsx
// Admin pages load on demand so brides never download them.
```
with:
```tsx
// Admin and "My shop" pages load on demand so brides never download them.
```

In `frontend/src/main.tsx`, replace:
```tsx
const DressEdit = lazy(() => import("./pages/admin/DressEdit.tsx"));
```
with:
```tsx
const DressEdit = lazy(() => import("./pages/admin/DressEdit.tsx"));
const ShopLayout = lazy(() => import("./pages/shop/ShopLayout.tsx"));
const ShopLogin = lazy(() => import("./pages/shop/ShopLogin.tsx"));
const ShopSignup = lazy(() => import("./pages/shop/ShopSignup.tsx"));
const MyShop = lazy(() => import("./pages/shop/MyShop.tsx"));
```

In `frontend/src/main.tsx`, replace:
```tsx
        <Route path="/dresses/:id" component={DressEdit} />
      </Route>
      <Route path="*404" component={NotFound} />
```
with:
```tsx
        <Route path="/dresses/:id" component={DressEdit} />
      </Route>
      <Route path="/shop/signup" component={ShopSignup} />
      <Route path="/shop/login" component={ShopLogin} />
      <Route path="/shop" component={ShopLayout}>
        <Route path="/" component={MyShop} />
        <Route path="/dresses/new" component={DressEdit} />
        <Route path="/dresses/:id" component={DressEdit} />
      </Route>
      <Route path="*404" component={NotFound} />
```

- [ ] **Step 6: Run all frontend checks**

Run: `deno task test && deno task check && deno task build`
Expected:
- the tests pass;
- `check` reports no errors;
- the build prints `✓ built`, with separate chunks for `ShopLayout`, `ShopLogin`, `ShopSignup` and `MyShop`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): shops sign up and manage their dresses in My shop"
```

---

### Task 7: Admin: owner box with Set new password, and the "Managed by owner" badge

**Files:**
- Create: `frontend/src/components/admin/OwnerPassword.tsx`
- Modify:
  - `frontend/src/pages/admin/ShopEdit.tsx`
  - `frontend/src/pages/admin/Shops.tsx`
  - `frontend/src/i18n/en.json`, `frontend/src/i18n/ru.json` and `frontend/src/i18n/tk.json`

**Interfaces:**
- Consumes:
  - from Task 4: `api.admin.setOwnerPassword` and `AdminShop.owner`;
  - from Task 6: `field.too_short`;
  - existing: `TextField`, `errorMessage` and `validationFields`.
- Produces:
  - `OwnerPassword(props: { shopId: number; phone: string })`
  - i18n keys: `owner.title`, `owner.phone`, `owner.new_password`, `owner.new_password_hint`, `owner.set_password`, `owner.password_set` and `owner.badge`.

- [ ] **Step 1: The texts**

Add these entries at the end of each language file, after `"myshop.details"`. Add a comma to that line, and keep the closing `}` last.

**en.json**
```json
  "owner.title": "Owner account",
  "owner.phone": "Sign-in phone",
  "owner.new_password": "New password",
  "owner.new_password_hint": "At least 10 characters. The owner is signed out on every device.",
  "owner.set_password": "Set new password",
  "owner.password_set": "New password set",
  "owner.badge": "Managed by owner"
```

**ru.json**
```json
  "owner.title": "Аккаунт владельца",
  "owner.phone": "Телефон для входа",
  "owner.new_password": "Новый пароль",
  "owner.new_password_hint": "Не короче 10 символов. Владелец выйдет из аккаунта на всех устройствах.",
  "owner.set_password": "Установить новый пароль",
  "owner.password_set": "Новый пароль установлен",
  "owner.badge": "Ведёт владелец"
```

**tk.json**
```json
  "owner.title": "Eýesiniň hasaby",
  "owner.phone": "Giriş telefony",
  "owner.new_password": "Täze açar söz",
  "owner.new_password_hint": "Azyndan 10 belgi. Eýesi ähli enjamlarda hasabyndan çykar.",
  "owner.set_password": "Täze açar söz goý",
  "owner.password_set": "Täze açar söz goýuldy",
  "owner.badge": "Eýesi dolandyrýar"
```

- [ ] **Step 2: The owner box**

`frontend/src/components/admin/OwnerPassword.tsx`
```tsx
import { createSignal, Show } from "solid-js";
import { t, tr } from "../../i18n/i18n.ts";
import { api } from "../../lib/client.ts";
import { errorMessage, validationFields } from "../../lib/errors.ts";
import { TextField } from "./Field.tsx";

/** The admin's only owner tool: a new password for a shop owner who forgot theirs. */
export default function OwnerPassword(props: { shopId: number; phone: string }) {
  const [password, setPassword] = createSignal("");
  const [fieldError, setFieldError] = createSignal<string | undefined>();
  const [error, setError] = createSignal<unknown>(null);
  const [saving, setSaving] = createSignal(false);
  const [saved, setSaved] = createSignal(false);

  async function save(e: SubmitEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setFieldError(undefined);
    setError(null);
    try {
      await api.admin.setOwnerPassword(props.shopId, password());
      setPassword("");
      setSaved(true);
    } catch (err) {
      setFieldError(validationFields(err).password);
      setError(() => err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form class="space-y-4" novalidate onSubmit={save}>
      <h2 class="text-2xl">{t("owner.title")}</h2>
      <p class="text-sm">
        {t("owner.phone")}: <a href={`tel:${props.phone}`} class="font-semibold text-garnet">{props.phone}</a>
      </p>
      <TextField
        label={t("owner.new_password")}
        type="password"
        autocomplete="new-password"
        hint={t("owner.new_password_hint")}
        value={password()}
        onInput={setPassword}
        error={fieldError()}
      />
      <div class="flex flex-wrap items-center gap-3">
        <button type="submit" class="btn btn-primary" disabled={saving()}>
          {saving() ? t("admin.saving") : t("owner.set_password")}
        </button>
        <span role="status" class="text-sm text-silver-ink">{saved() ? t("owner.password_set") : ""}</span>
        <Show when={error() && !fieldError()}>
          <p role="alert" class="w-full text-sm text-garnet">{errorMessage(error(), tr)}</p>
        </Show>
      </div>
    </form>
  );
}
```

In `frontend/src/pages/admin/ShopEdit.tsx`, replace:
```tsx
import LogoUpload from "../../components/admin/LogoUpload.tsx";
```
with:
```tsx
import LogoUpload from "../../components/admin/LogoUpload.tsx";
import OwnerPassword from "../../components/admin/OwnerPassword.tsx";
```

In `frontend/src/pages/admin/ShopEdit.tsx`, replace:
```tsx
          <Show when={id() !== null && shop()}>
            {(s) => (
              <section class="mt-8 rounded-lg bg-white p-5">
                <LogoUpload
                  shopId={s().id}
                  name={s().name}
                  logo={s().logo}
                  onUploaded={(logo) => mutate({ ...s(), logo })}
                />
              </section>
            )}
          </Show>
```
with:
```tsx
          <Show when={id() !== null && shop()}>
            {(s) => (
              <>
                <section class="mt-8 rounded-lg bg-white p-5">
                  <LogoUpload
                    shopId={s().id}
                    name={s().name}
                    logo={s().logo}
                    onUploaded={(logo) => mutate({ ...s(), logo })}
                  />
                </section>
                <Show when={s().owner}>
                  {(owner) => (
                    <section class="mt-8 rounded-lg bg-white p-5">
                      <OwnerPassword shopId={s().id} phone={owner().phone} />
                    </section>
                  )}
                </Show>
              </>
            )}
          </Show>
```

- [ ] **Step 3: The badge**

In `frontend/src/pages/admin/Shops.tsx`, replace:
```tsx
import { createResource, For, Match, Switch } from "solid-js";
```
with:
```tsx
import { createResource, For, Match, Show, Switch } from "solid-js";
```

In `frontend/src/pages/admin/Shops.tsx`, replace:
```tsx
                        <StatusBadge published={s.is_published} />
```
with:
```tsx
                        <Show when={s.owner}>
                          <span class="shrink-0 rounded-full bg-veil px-2.5 py-0.5 text-xs font-semibold text-ink">
                            {t("owner.badge")}
                          </span>
                        </Show>
                        <StatusBadge published={s.is_published} />
```

- [ ] **Step 4: Run all frontend checks, and the backend suite once more**

Run: `cd frontend && deno task test && deno task check && deno task build`
Expected:
- the tests pass;
- `check` reports no errors;
- the build prints `✓ built`.

Run: `cd ../backend && set -a; . ./.env; set +a; GOPROXY=off go test -count=1 ./...`
Expected: every package prints `ok`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): admins set a new password for a shop owner"
```

---

## Final verification (controller)

The controller does this after Task 7, in headless Chrome, against a server built from the branch. It uses the **test** database (`TEST_DATABASE_URL`), never `wedding_dev`, and deletes every row it created afterwards.

1. **Sign-up:**
   - Submitting an empty form shows "Required" ×3, "Check this value" (phone) and "At least 10 characters".
   - A real sign-up with `8 65 11 22 33` lands on `/shop`.
   - Signing up again with `+993 65 112233` shows "This number is already in use".
2. **Adding a dress:**
   - There is no shop select.
   - Saving the dress leads to `/shop/dresses/:id`.
   - One photo uploads, two busy days save, and the dress appears in "My dresses".
   - A logo uploads.
3. **A bride's view:** the public `/api/dresses` total is 1, and `/dresses/:id` shows the dress. `/shops/:slug` has the public header and footer.
4. **Admin password reset:**
   - The shops list shows "Managed by owner", and the shop editor shows "Owner account".
   - "short" is rejected.
   - A new password shows "New password set".
   - The owner's `/shop` then redirects to `/shop/login?next=%2Fshop`. The old password shows "Incorrect phone number or password.", and the new one signs in.
5. **Hidden shop:** after the admin unpublishes the shop:
   - "My shop" shows "Your shop is hidden from the site. Call us.";
   - `/api/shops/:slug` answers 404;
   - the public dress total is 0.
6. **No sideways overflow:** at 320px in tk, ru and en, on `/shop/signup`, `/shop/login`, `/shop`, `/shop/dresses/:id`, `/shop/dresses/new`, `/admin/shops`, `/admin/shops/:id` and `/`.
7. **Deleting a dress:** the owner deletes the dress and lands on `/shop`. The dress then answers 404.

## Spec coverage

| Spec | Where |
|---|---|
| §3.1 sign-up fields, normalization, `taken`, rate limit, lands on My shop | Task 2 (`signup`, `NormalizePhone`, `Limiter`), Task 6 (`ShopSignup`) |
| §3.2 shop details, slug unchanged, dress list, editor, delete, hidden banner | Task 2 (`updateShop`), Task 3, Task 5 (`DressEdit` and `ShopFields`), Task 6 (`MyShop`) |
| §3.3 sign-in, `invalid_credentials`, "Forgot your password?" | Task 2 (`login`), Task 6 (`ShopLogin`) |
| §3.4 sign out, 7-day session | Task 6 (`ShopLayout`), Task 1 (`TokenTTL`) |
| §4 owner box and Set new password, which signs out everywhere; "Managed by owner" badge; deleting a shop cascades | Task 2 (`setPassword`, `token_version`, `ON DELETE CASCADE`), Task 7 |
| §5 migration 00004 | Task 2 Step 1 |
| §6.1 audiences, `ver` | Task 1, Task 2 (`ShopMiddleware`) |
| §6.2 phone normalization | Task 2 (`NormalizePhone`, `TestNormalizePhone`) |
| §6.3 middleware steps | Task 2 (`ShopMiddleware`) |
| §6.4 shop only from the context, foreign ids get 404, no self-publishing | Task 3 (`Scope`, `TestShopOwnersOnlyReachTheirOwnShop`), Task 2 (`TestOwnerCannotChangeWhetherTheShopIsPublished`) |
| §6.5 bcrypt, ≥10 characters, `wr.shop_token` | Task 2, Task 4 (`shopAuth`) |
| §7 API tables, `AdminShop.owner` | Tasks 2–4 |
| §8.2 ManageApi context, lazy owner pages, admin additions, texts | Tasks 4–7 (see "Where this plan differs" above) |
| §9 Go, Deno and browser tests | Tasks 1–7, Final verification |
