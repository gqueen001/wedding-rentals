# Wedding Rentals Backend API: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Go + Gin + PostgreSQL API for the v1 wedding-dress rental site: public dress search and browsing, the admin CRUD for shops, dresses and photos, JWT admin login, and a server that also serves the built frontend with Open Graph tags.

**Architecture:** There is one Go module in `backend/`. Each feature lives in its own package under `internal/`, which holds that feature's repository functions (SQL via pgx) and its Gin handlers. Every repository function takes a `db.DBTX`, so tests run against a real PostgreSQL database inside a transaction that is rolled back afterwards. `internal/server` wires all packages into one Gin engine, and `cmd/server` runs it.

**Tech Stack:** Go 1.27, Gin v1.12, pgx v5.11 (pgxpool), goose v3.29 (SQL migrations), golang-jwt v5, bcrypt and term from `golang.org/x/crypto`/`x/term`, `disintegration/imaging` and `golang.org/x/image/webp` for photos, and PostgreSQL 17 with `pg_trgm`.

**Spec:** `docs/superpowers/specs/2026-10-18-wedding-rentals-v1-design.md`

## Global Constraints

- Go module path: `wedding-rentals/backend`; all code lives under `backend/`.
- Error format is always `{"error": {"code": "...", "message": "...", "fields": {...}}}`; `fields` appears only for `validation_failed` (HTTP 400).
- Public endpoints return only rows where `listings.is_published` AND `shops.is_published` are both true; anything else returns `404 not_found`.
- Dress enums: color ∈ `white, ivory, champagne, blush, other`; silhouette ∈ `ball_gown, a_line, mermaid, straight, short`; sleeves ∈ `long, short, none`; sizes ⊆ `XS, S, M, L, XL, XXL`.
- `per_page` defaults to 24, with a max of 60. Uploads: max 10 MB, JPEG/PNG/WebP only (sniffed from content). Output is a small image of ≈400px wide and a large one of ≈1200px wide, both JPEG.
- JWTs are HS256, expire after 7 days, and are sent as `Authorization: Bearer <token>`. Login is limited to 5 attempts per minute per IP.
- Shop slugs come from the name with Turkmen letters normalized (`ä→a, ç→c, ň→n, ö→o, ş→s, ü→u, ý→y, ž→z`) and get a `-2`, `-3`, … suffix when taken. A slug never changes after the shop is created.
- Tests use the real PostgreSQL in `TEST_DATABASE_URL` and run with `make test` (`go test -p 1 ./...`).
- Every commit message ends with this trailer line: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## File Map

```
backend/
  go.mod, go.sum
  Makefile                         test / run / admin targets, loads .env
  .env.example
  cmd/server/main.go               wires config → db → server.New → ListenAndServe
  cmd/admin/main.go                "admin create --email" CLI
  migrations/embed.go              //go:embed *.sql
  migrations/00001_init.sql        schema, norm(), trigram indexes
  migrations/00002_seed.sql        cities + "dresses" category
  internal/config/config.go        env config
  internal/httpx/httpx.go          APIError, Abort, Recovery, ParseID, BindJSON
  internal/db/db.go                DBTX, Connect, InTx
  internal/db/migrate.go           Migrate (goose provider + session lock)
  internal/testutil/testutil.go    Pool, Tx, Request, Decode, ErrorBody
  internal/testutil/fixtures.go    InsertShop, InsertDress, InsertImage
  internal/textnorm/textnorm.go    Norm, Slugify, EscapeLike
  internal/auth/password.go        HashPassword, CheckPassword
  internal/auth/tokens.go          Tokens (Issue, Verify), TokenTTL
  internal/auth/ratelimit.go       Limiter
  internal/auth/admins.go          CreateAdmin, findAdminByEmail
  internal/auth/handler.go         Handler.login, Middleware
  internal/cities/cities.go        City, List, Handler
  internal/images/image.go         Image, URL
  internal/images/storage.go       Storage, LocalStorage, DeleteFiles
  internal/images/process.go       Process
  internal/images/repo.go          ListForListing, PathsForListing, PathsForShop
  internal/images/handler.go       upload, reorder, delete
  internal/shops/model.go          Input, Shop, validation
  internal/shops/repo.go           Create, Update, Get, List, Delete, uniqueSlug
  internal/shops/handler.go        admin handlers
  internal/shops/public.go         PublicShop, GetPublicBySlug, public handler
  internal/dresses/model.go        enums, Input, Dress, validation
  internal/dresses/repo.go         admin Create, Update, Get, ListAdmin, Delete
  internal/dresses/handler.go      admin + public handlers
  internal/dresses/filter.go       Filter, ParseFilter
  internal/dresses/public.go       ListPublic, GetPublic, public types
  internal/web/web.go              SPA/static serving + OG injection
  internal/server/server.go        Deps, New
.gitignore                         (repo root)
```

---

### Task 0: Start PostgreSQL and create databases (done by the human; needs a password)

This task is for the human, not an agent: it needs `sudo` and the `postgres` superuser password chosen at install time.

- [ ] **Step 1: Start the PostgreSQL 17 service and enable it at boot**

```bash
sudo launchctl load -w /Library/LaunchDaemons/postgresql-17.plist
/Library/PostgreSQL/17/bin/pg_isready -h localhost
```
Expected: `localhost:5432 - accepting connections`

- [ ] **Step 2: Create the app role and the dev/test databases**

```bash
export PATH=/Library/PostgreSQL/17/bin:$PATH
psql -U postgres -h localhost -c "CREATE ROLE wedding LOGIN PASSWORD 'wedding';"
psql -U postgres -h localhost -c "CREATE DATABASE wedding_dev  OWNER wedding TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'en_US.UTF-8' LC_CTYPE 'en_US.UTF-8';"
psql -U postgres -h localhost -c "CREATE DATABASE wedding_test OWNER wedding TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'en_US.UTF-8' LC_CTYPE 'en_US.UTF-8';"
psql "postgres://wedding:wedding@localhost:5432/wedding_test" -c "select 1;"
```
Expected: the last command prints a single row containing `1`. (`pg_trgm` is a trusted extension, so the database owner can create it in the migration later.)

---

### Task 1: Backend scaffold, config, and the HTTP error helpers

**Files:**
- Create: `.gitignore`, `backend/go.mod`, `backend/Makefile`, `backend/.env.example`
- Create: `backend/internal/config/config.go`, `backend/internal/httpx/httpx.go`
- Test: `backend/internal/config/config_test.go`, `backend/internal/httpx/httpx_test.go`

**Interfaces:**
- Produces: `config.Load() (config.Config, error)` with fields `DatabaseURL, JWTSecret, UploadDir, WebDir, Port, BaseURL string`
- Produces: `httpx.APIError{Status int; Code, Message string; Fields map[string]string}`, `httpx.New(status int, code, message string) *APIError`, `httpx.Validation(fields map[string]string) *APIError`, `httpx.ErrNotFound`, `httpx.Abort(c *gin.Context, err error)`, `httpx.Recovery() gin.HandlerFunc`, `httpx.ParseID(c *gin.Context, name string) (int64, bool)`, `httpx.BindJSON(c *gin.Context, dst any) bool`

- [ ] **Step 1: Create the module and the repo files**

```bash
cd /Users/rado/projects/wedding-rentals
mkdir -p backend && cd backend
go mod init wedding-rentals/backend
go get github.com/gin-gonic/gin@v1.12.0 github.com/jackc/pgx/v5@v5.11.0
```

`/Users/rado/projects/wedding-rentals/.gitignore`:
```gitignore
.DS_Store
backend/.env
backend/uploads/
frontend/dist/
frontend/node_modules/
```

`backend/.env.example`:
```dotenv
DATABASE_URL=postgres://wedding:wedding@localhost:5432/wedding_dev?sslmode=disable
TEST_DATABASE_URL=postgres://wedding:wedding@localhost:5432/wedding_test?sslmode=disable
JWT_SECRET=change-me-to-a-long-random-string-at-least-32-chars
UPLOAD_DIR=./uploads
WEB_DIR=../frontend/dist
PORT=8080
PUBLIC_BASE_URL=http://localhost:8080
```

`backend/Makefile` (recipe lines are indented with a TAB):
```make
-include .env
export

.PHONY: test run admin

test:
	go test -p 1 ./...

run:
	go run ./cmd/server

admin:
	go run ./cmd/admin create --email $(EMAIL)
```

Then: `cp .env.example .env`

- [ ] **Step 2: Write the failing config test**

`backend/internal/config/config_test.go`:
```go
package config_test

import (
	"strings"
	"testing"

	"wedding-rentals/backend/internal/config"
)

func setBase(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/x")
	t.Setenv("JWT_SECRET", strings.Repeat("s", 32))
	t.Setenv("UPLOAD_DIR", "")
	t.Setenv("WEB_DIR", "")
	t.Setenv("PORT", "")
	t.Setenv("PUBLIC_BASE_URL", "")
}

func TestLoadDefaults(t *testing.T) {
	setBase(t)
	c, err := config.Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if c.UploadDir != "./uploads" || c.WebDir != "../frontend/dist" || c.Port != "8080" || c.BaseURL != "http://localhost:8080" {
		t.Fatalf("unexpected defaults: %+v", c)
	}
}

func TestLoadRequiresDatabaseURL(t *testing.T) {
	setBase(t)
	t.Setenv("DATABASE_URL", "")
	if _, err := config.Load(); err == nil {
		t.Fatal("expected error for missing DATABASE_URL")
	}
}

func TestLoadRequiresLongSecret(t *testing.T) {
	setBase(t)
	t.Setenv("JWT_SECRET", "short")
	if _, err := config.Load(); err == nil {
		t.Fatal("expected error for short JWT_SECRET")
	}
}
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd backend && go test ./internal/config/`
Expected: FAIL to compile, with `undefined: config.Load` (or no non-test Go files).

- [ ] **Step 4: Implement config**

`backend/internal/config/config.go`:
```go
package config

import (
	"errors"
	"os"
)

type Config struct {
	DatabaseURL string
	JWTSecret   string
	UploadDir   string
	WebDir      string
	Port        string
	BaseURL     string
}

func Load() (Config, error) {
	c := Config{
		DatabaseURL: os.Getenv("DATABASE_URL"),
		JWTSecret:   os.Getenv("JWT_SECRET"),
		UploadDir:   getenv("UPLOAD_DIR", "./uploads"),
		WebDir:      getenv("WEB_DIR", "../frontend/dist"),
		Port:        getenv("PORT", "8080"),
		BaseURL:     getenv("PUBLIC_BASE_URL", "http://localhost:8080"),
	}
	if c.DatabaseURL == "" {
		return Config{}, errors.New("DATABASE_URL is required")
	}
	if len(c.JWTSecret) < 32 {
		return Config{}, errors.New("JWT_SECRET must be at least 32 characters")
	}
	return c, nil
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
```

- [ ] **Step 5: Write the failing httpx test**

`backend/internal/httpx/httpx_test.go`:
```go
package httpx_test

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"wedding-rentals/backend/internal/httpx"
)

type errBody struct {
	Error struct {
		Code   string            `json:"code"`
		Fields map[string]string `json:"fields"`
	} `json:"error"`
}

func TestAbortMapsErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cases := []struct {
		name   string
		err    error
		status int
		code   string
	}{
		{"validation", httpx.Validation(map[string]string{"phone": "required"}), 400, "validation_failed"},
		{"no rows", fmt.Errorf("get: %w", pgx.ErrNoRows), 404, "not_found"},
		{"unique", &pgconn.PgError{Code: "23505"}, 409, "conflict"},
		{"foreign key", &pgconn.PgError{Code: "23503"}, 400, "invalid_reference"},
		{"unknown", errors.New("boom"), 500, "internal_error"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(rec)
			httpx.Abort(c, tc.err)
			if rec.Code != tc.status {
				t.Fatalf("status = %d, want %d", rec.Code, tc.status)
			}
			var body errBody
			if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
				t.Fatalf("decode: %v", err)
			}
			if body.Error.Code != tc.code {
				t.Fatalf("code = %q, want %q", body.Error.Code, tc.code)
			}
		})
	}
}

func TestValidationIncludesFields(t *testing.T) {
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	httpx.Abort(c, httpx.Validation(map[string]string{"phone": "required"}))
	var body errBody
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if body.Error.Fields["phone"] != "required" {
		t.Fatalf("fields = %v", body.Error.Fields)
	}
}

func TestRecoveryReturnsJSON500(t *testing.T) {
	r := gin.New()
	r.Use(httpx.Recovery())
	r.GET("/panic", func(c *gin.Context) { panic("kaboom") })
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/panic", nil))
	if rec.Code != 500 {
		t.Fatalf("status = %d", rec.Code)
	}
	var body errBody
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if body.Error.Code != "internal_error" {
		t.Fatalf("code = %q", body.Error.Code)
	}
}

func TestParseIDRejectsNonNumeric(t *testing.T) {
	r := gin.New()
	r.GET("/x/:id", func(c *gin.Context) {
		if id, ok := httpx.ParseID(c, "id"); ok {
			c.JSON(200, gin.H{"id": id})
		}
	})
	for path, want := range map[string]int{"/x/12": 200, "/x/abc": 404, "/x/0": 404} {
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		if rec.Code != want {
			t.Errorf("%s: status = %d, want %d", path, rec.Code, want)
		}
	}
}
```

- [ ] **Step 6: Run it to verify it fails**

Run: `go test ./internal/httpx/`
Expected: FAIL to compile, with `undefined: httpx.Validation`.

- [ ] **Step 7: Implement httpx**

`backend/internal/httpx/httpx.go`:
```go
package httpx

import (
	"errors"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// APIError is the single error shape every endpoint returns.
type APIError struct {
	Status  int               `json:"-"`
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Fields  map[string]string `json:"fields,omitempty"`
}

func (e *APIError) Error() string { return e.Code + ": " + e.Message }

func New(status int, code, message string) *APIError {
	return &APIError{Status: status, Code: code, Message: message}
}

func Validation(fields map[string]string) *APIError {
	return &APIError{Status: http.StatusBadRequest, Code: "validation_failed", Message: "some fields are invalid", Fields: fields}
}

var ErrNotFound = New(http.StatusNotFound, "not_found", "resource not found")

// Abort writes err in the standard error format and stops the handler chain.
func Abort(c *gin.Context, err error) {
	var apiErr *APIError
	var pgErr *pgconn.PgError
	switch {
	case errors.As(err, &apiErr):
	case errors.Is(err, pgx.ErrNoRows):
		apiErr = ErrNotFound
	case errors.As(err, &pgErr) && pgErr.Code == "23505":
		apiErr = New(http.StatusConflict, "conflict", "resource already exists")
	case errors.As(err, &pgErr) && pgErr.Code == "23503":
		apiErr = New(http.StatusBadRequest, "invalid_reference", "referenced resource does not exist")
	default:
		log.Printf("internal error: %v", err)
		apiErr = New(http.StatusInternalServerError, "internal_error", "something went wrong")
	}
	c.AbortWithStatusJSON(apiErr.Status, gin.H{"error": apiErr})
}

func Recovery() gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, rec any) {
		log.Printf("panic: %v", rec)
		Abort(c, New(http.StatusInternalServerError, "internal_error", "something went wrong"))
	})
}

// ParseID reads a positive integer path parameter; it answers 404 when invalid.
func ParseID(c *gin.Context, name string) (int64, bool) {
	id, err := strconv.ParseInt(c.Param(name), 10, 64)
	if err != nil || id <= 0 {
		Abort(c, ErrNotFound)
		return 0, false
	}
	return id, true
}

// BindJSON decodes the request body into dst; it answers 400 invalid_json on failure.
func BindJSON(c *gin.Context, dst any) bool {
	if err := c.ShouldBindJSON(dst); err != nil {
		Abort(c, New(http.StatusBadRequest, "invalid_json", "request body is not valid JSON"))
		return false
	}
	return true
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `go mod tidy && go test ./internal/config/ ./internal/httpx/`
Expected: `ok` for both packages.

- [ ] **Step 9: Commit**

```bash
cd /Users/rado/projects/wedding-rentals
git add .gitignore backend
git commit -m "feat(backend): scaffold module, config and error helpers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Database schema, migrations, and the test harness

**Files:**
- Create: `backend/migrations/embed.go`, `backend/migrations/00001_init.sql`, `backend/migrations/00002_seed.sql`
- Create: `backend/internal/db/db.go`, `backend/internal/db/migrate.go`
- Create: `backend/internal/testutil/testutil.go`, `backend/internal/testutil/fixtures.go`
- Test: `backend/internal/db/migrate_test.go`

**Interfaces:**
- Consumes: nothing from earlier tasks except the module itself
- Produces: `db.DBTX` (interface: `Exec`, `Query`, `QueryRow`, `Begin`, with the pgx signatures), `db.Connect(ctx, url string) (*pgxpool.Pool, error)`, `db.InTx(ctx, d db.DBTX, fn func(tx pgx.Tx) error) error`, `db.Migrate(ctx, pool *pgxpool.Pool) error`
- Produces (tests only): `testutil.Pool(t) *pgxpool.Pool`, `testutil.Tx(t) pgx.Tx`, `testutil.Request(t, h http.Handler, method, path string, body any, token string) *httptest.ResponseRecorder`, `testutil.Decode[T any](t, rec) T`, `testutil.ErrorBody`, `testutil.InsertShop(t, d, testutil.ShopFixture) testutil.ShopRow{ID int64; Slug string}`, `testutil.InsertDress(t, d, testutil.DressFixture) int64`, `testutil.InsertImage(t, d, listingID int64, position int, name string) int64` (paths `name+"_s.jpg"` / `name+"_l.jpg"`)
- SQL: the function `norm(text)` and all tables from spec section 5

- [ ] **Step 1: Write the migrations**

```bash
cd backend && go get github.com/pressly/goose/v3@v3.29.0
```

`backend/migrations/embed.go`:
```go
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
```

`backend/migrations/00001_init.sql`:
```sql
-- +goose Up
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- +goose StatementBegin
CREATE FUNCTION norm(t text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT lower(translate(t, 'ÄÇŇÖŞÜÝŽäçňöşüýž', 'ACNOSUYZacnosuyz'))
$$;
-- +goose StatementEnd

CREATE TABLE admins (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cities (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug       text NOT NULL UNIQUE,
  name_tk    text NOT NULL,
  name_ru    text NOT NULL,
  name_en    text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE shops (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug          text NOT NULL UNIQUE,
  name          text NOT NULL,
  city_id       bigint NOT NULL REFERENCES cities(id),
  address       text NOT NULL,
  phone         text NOT NULL,
  instagram_url text,
  tiktok_url    text,
  description   text,
  logo_image_id bigint,
  is_published  boolean NOT NULL DEFAULT false,
  owner_user_id bigint,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE shop_aliases (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id    bigint NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  alias      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, alias)
);

CREATE TABLE categories (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug       text NOT NULL UNIQUE,
  name_tk    text NOT NULL,
  name_ru    text NOT NULL,
  name_en    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE listings (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id       bigint NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  category_id   bigint NOT NULL REFERENCES categories(id),
  title         text NOT NULL,
  price_manat   int NOT NULL CHECK (price_manat > 0),
  price_is_from boolean NOT NULL DEFAULT false,
  description   text,
  is_published  boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX listings_browse_idx ON listings (category_id, is_published, created_at DESC);
CREATE INDEX listings_shop_idx ON listings (shop_id);

CREATE TABLE dress_details (
  listing_id bigint PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  color      text NOT NULL CHECK (color IN ('white', 'ivory', 'champagne', 'blush', 'other')),
  silhouette text NOT NULL CHECK (silhouette IN ('ball_gown', 'a_line', 'mermaid', 'straight', 'short')),
  sleeves    text NOT NULL CHECK (sleeves IN ('long', 'short', 'none')),
  sizes      text[] NOT NULL CHECK (cardinality(sizes) > 0 AND sizes <@ ARRAY['XS','S','M','L','XL','XXL']::text[]),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE images (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  listing_id bigint REFERENCES listings(id) ON DELETE CASCADE,
  shop_id    bigint REFERENCES shops(id) ON DELETE CASCADE,
  position   int NOT NULL DEFAULT 0,
  path_small text NOT NULL,
  path_large text NOT NULL,
  width      int NOT NULL,
  height     int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((listing_id IS NULL) <> (shop_id IS NULL))
);
CREATE INDEX images_listing_idx ON images (listing_id, position);
CREATE INDEX images_shop_idx ON images (shop_id);

ALTER TABLE shops ADD CONSTRAINT shops_logo_image_fk
  FOREIGN KEY (logo_image_id) REFERENCES images(id) ON DELETE SET NULL;

CREATE INDEX shops_name_trgm ON shops USING gin (norm(name) gin_trgm_ops);
CREATE INDEX shop_aliases_alias_trgm ON shop_aliases USING gin (norm(alias) gin_trgm_ops);
CREATE INDEX listings_title_trgm ON listings USING gin (norm(title) gin_trgm_ops);

-- +goose Down
ALTER TABLE shops DROP CONSTRAINT IF EXISTS shops_logo_image_fk;
DROP TABLE IF EXISTS images, dress_details, listings, categories, shop_aliases, shops, cities, admins;
DROP FUNCTION IF EXISTS norm(text);
```

`backend/migrations/00002_seed.sql`:
```sql
-- +goose Up
INSERT INTO cities (slug, name_tk, name_ru, name_en, sort_order) VALUES
  ('ashgabat',    'Aşgabat',     'Ашхабад',    'Ashgabat',    1),
  ('arkadag',     'Arkadag',     'Аркадаг',    'Arkadag',     2),
  ('mary',        'Mary',        'Мары',       'Mary',        3),
  ('turkmenabat', 'Türkmenabat', 'Туркменабат','Turkmenabat', 4),
  ('dashoguz',    'Daşoguz',     'Дашогуз',    'Dashoguz',    5),
  ('balkanabat',  'Balkanabat',  'Балканабат', 'Balkanabat',  6),
  ('tejen',       'Tejen',       'Теджен',     'Tejen',       7),
  ('serdar',      'Serdar',      'Сердар',     'Serdar',      8),
  ('bayramaly',   'Baýramaly',   'Байрамали',  'Bayramaly',   9);

INSERT INTO categories (slug, name_tk, name_ru, name_en) VALUES
  ('dresses', 'Toý köýnekleri', 'Свадебные платья', 'Wedding dresses');

-- +goose Down
DELETE FROM categories WHERE slug = 'dresses';
DELETE FROM cities;
```

- [ ] **Step 2: Implement the db package**

`backend/internal/db/db.go`:
```go
package db

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DBTX is satisfied by both *pgxpool.Pool and pgx.Tx, so every repository
// function works in production and inside a rolled-back test transaction.
type DBTX interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Begin(ctx context.Context) (pgx.Tx, error)
}

func Connect(ctx context.Context, url string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return pool, nil
}

// InTx runs fn in a transaction (a savepoint when d is already a transaction).
func InTx(ctx context.Context, d DBTX, fn func(tx pgx.Tx) error) error {
	tx, err := d.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op after Commit
	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
```

`backend/internal/db/migrate.go`:
```go
package db

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/pressly/goose/v3/lock"

	"wedding-rentals/backend/migrations"
)

// Migrate applies all pending migrations; a Postgres advisory lock makes it
// safe when several processes start at once.
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	sqlDB := stdlib.OpenDBFromPool(pool)
	locker, err := lock.NewPostgresSessionLocker()
	if err != nil {
		return err
	}
	provider, err := goose.NewProvider(goose.DialectPostgres, sqlDB, migrations.FS, goose.WithSessionLocker(locker))
	if err != nil {
		return err
	}
	_, err = provider.Up(ctx)
	return err
}
```

- [ ] **Step 3: Implement the test harness**

`backend/internal/testutil/testutil.go`:
```go
// Package testutil holds helpers shared by tests. Only _test.go files import it.
package testutil

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"wedding-rentals/backend/internal/db"
)

func init() { gin.SetMode(gin.TestMode) }

var (
	poolOnce sync.Once
	pool     *pgxpool.Pool
	poolErr  error
)

// Pool connects to TEST_DATABASE_URL and migrates it once per test binary.
func Pool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	poolOnce.Do(func() {
		url := os.Getenv("TEST_DATABASE_URL")
		if url == "" {
			poolErr = errors.New("TEST_DATABASE_URL is not set (copy backend/.env.example to backend/.env and run make test)")
			return
		}
		ctx := context.Background()
		pool, poolErr = db.Connect(ctx, url)
		if poolErr != nil {
			return
		}
		poolErr = db.Migrate(ctx, pool)
	})
	if poolErr != nil {
		t.Fatalf("test database: %v", poolErr)
	}
	return pool
}

// Tx returns a transaction that is rolled back when the test ends.
func Tx(t *testing.T) pgx.Tx {
	t.Helper()
	tx, err := Pool(t).Begin(context.Background())
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	t.Cleanup(func() { _ = tx.Rollback(context.Background()) })
	return tx
}

// Request sends a JSON request (body may be nil) with an optional bearer token.
func Request(t *testing.T, h http.Handler, method, path string, body any, token string) *httptest.ResponseRecorder {
	t.Helper()
	var r io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal: %v", err)
		}
		r = bytes.NewReader(b)
	}
	req := httptest.NewRequest(method, path, r)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func Decode[T any](t *testing.T, rec *httptest.ResponseRecorder) T {
	t.Helper()
	var v T
	if err := json.Unmarshal(rec.Body.Bytes(), &v); err != nil {
		t.Fatalf("decode %q: %v", rec.Body.String(), err)
	}
	return v
}

type ErrorBody struct {
	Error struct {
		Code    string            `json:"code"`
		Message string            `json:"message"`
		Fields  map[string]string `json:"fields"`
	} `json:"error"`
}
```

`backend/internal/testutil/fixtures.go`:
```go
package testutil

import (
	"context"
	"fmt"
	"sync/atomic"
	"testing"

	"wedding-rentals/backend/internal/db"
)

var seq atomic.Int64

type ShopFixture struct {
	Name     string
	CitySlug string // default "ashgabat"
	Hidden   bool   // default: published
	Aliases  []string
}

type ShopRow struct {
	ID   int64
	Slug string
}

func InsertShop(t *testing.T, d db.DBTX, f ShopFixture) ShopRow {
	t.Helper()
	ctx := context.Background()
	if f.Name == "" {
		f.Name = "Test Shop"
	}
	if f.CitySlug == "" {
		f.CitySlug = "ashgabat"
	}
	row := ShopRow{Slug: fmt.Sprintf("fixture-shop-%d", seq.Add(1))}
	err := d.QueryRow(ctx, `
		INSERT INTO shops (slug, name, city_id, address, phone, is_published)
		VALUES ($1, $2, (SELECT id FROM cities WHERE slug = $3), 'Test address 1', '+99365000000', $4)
		RETURNING id`, row.Slug, f.Name, f.CitySlug, !f.Hidden).Scan(&row.ID)
	if err != nil {
		t.Fatalf("insert shop: %v", err)
	}
	for _, a := range f.Aliases {
		if _, err := d.Exec(ctx, `INSERT INTO shop_aliases (shop_id, alias) VALUES ($1, $2)`, row.ID, a); err != nil {
			t.Fatalf("insert alias: %v", err)
		}
	}
	return row
}

type DressFixture struct {
	ShopID     int64
	Title      string   // default "Test dress"
	Price      int      // default 1000
	Color      string   // default "white"
	Silhouette string   // default "a_line"
	Sleeves    string   // default "long"
	Sizes      []string // default {"M"}
	Hidden     bool     // default: published
}

func InsertDress(t *testing.T, d db.DBTX, f DressFixture) int64 {
	t.Helper()
	ctx := context.Background()
	if f.Title == "" {
		f.Title = "Test dress"
	}
	if f.Price == 0 {
		f.Price = 1000
	}
	if f.Color == "" {
		f.Color = "white"
	}
	if f.Silhouette == "" {
		f.Silhouette = "a_line"
	}
	if f.Sleeves == "" {
		f.Sleeves = "long"
	}
	if len(f.Sizes) == 0 {
		f.Sizes = []string{"M"}
	}
	var id int64
	err := d.QueryRow(ctx, `
		INSERT INTO listings (shop_id, category_id, title, price_manat, is_published)
		VALUES ($1, (SELECT id FROM categories WHERE slug = 'dresses'), $2, $3, $4)
		RETURNING id`, f.ShopID, f.Title, f.Price, !f.Hidden).Scan(&id)
	if err != nil {
		t.Fatalf("insert listing: %v", err)
	}
	_, err = d.Exec(ctx, `
		INSERT INTO dress_details (listing_id, color, silhouette, sleeves, sizes)
		VALUES ($1, $2, $3, $4, $5)`, id, f.Color, f.Silhouette, f.Sleeves, f.Sizes)
	if err != nil {
		t.Fatalf("insert dress_details: %v", err)
	}
	return id
}

// InsertImage stores image paths name+"_s.jpg" and name+"_l.jpg" for a listing.
func InsertImage(t *testing.T, d db.DBTX, listingID int64, position int, name string) int64 {
	t.Helper()
	var id int64
	err := d.QueryRow(context.Background(), `
		INSERT INTO images (listing_id, position, path_small, path_large, width, height)
		VALUES ($1, $2, $3, $4, 1200, 1600) RETURNING id`,
		listingID, position, name+"_s.jpg", name+"_l.jpg").Scan(&id)
	if err != nil {
		t.Fatalf("insert image: %v", err)
	}
	return id
}
```

- [ ] **Step 4: Write the migration tests**

`backend/internal/db/migrate_test.go`:
```go
package db_test

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

	"wedding-rentals/backend/internal/testutil"
)

func TestSeedData(t *testing.T) {
	tx := testutil.Tx(t)
	ctx := context.Background()
	var cities int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM cities`).Scan(&cities); err != nil {
		t.Fatal(err)
	}
	if cities != 9 {
		t.Fatalf("cities = %d, want 9", cities)
	}
	var slug string
	if err := tx.QueryRow(ctx, `SELECT slug FROM categories`).Scan(&slug); err != nil {
		t.Fatal(err)
	}
	if slug != "dresses" {
		t.Fatalf("category = %q", slug)
	}
}

func TestNormFunction(t *testing.T) {
	tx := testutil.Tx(t)
	var got string
	if err := tx.QueryRow(context.Background(), `SELECT norm('Gelin Öýi ÄÇŇŞÜÝŽ')`).Scan(&got); err != nil {
		t.Fatal(err)
	}
	if got != "gelin oyi acnsuyz" {
		t.Fatalf("norm = %q", got)
	}
}

func TestDressDetailsRejectsUnknownColor(t *testing.T) {
	tx := testutil.Tx(t)
	shop := testutil.InsertShop(t, tx, testutil.ShopFixture{})
	id := testutil.InsertDress(t, tx, testutil.DressFixture{ShopID: shop.ID})
	_, err := tx.Exec(context.Background(), `UPDATE dress_details SET color = 'purple' WHERE listing_id = $1`, id)
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "23514" {
		t.Fatalf("want check violation 23514, got %v", err)
	}
}
```

- [ ] **Step 5: Run the tests**

Run: `go mod tidy && make test`
Expected: `ok` for `internal/db`, `internal/config` and `internal/httpx`. If this fails with a connection error, Task 0 isn't finished yet.

- [ ] **Step 6: Commit**

```bash
cd /Users/rado/projects/wedding-rentals
git add backend
git commit -m "feat(backend): add schema migrations, db helpers and test harness" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Text normalization and slugs

**Files:**
- Create: `backend/internal/textnorm/textnorm.go`
- Test: `backend/internal/textnorm/textnorm_test.go`

**Interfaces:**
- Produces: `textnorm.Norm(s string) string` (must match the SQL `norm()`), `textnorm.Slugify(s string) string` (may return `""`), `textnorm.EscapeLike(s string) string`

- [ ] **Step 1: Write the failing test**

`backend/internal/textnorm/textnorm_test.go`:
```go
package textnorm_test

import (
	"context"
	"testing"

	"wedding-rentals/backend/internal/testutil"
	"wedding-rentals/backend/internal/textnorm"
)

func TestNorm(t *testing.T) {
	cases := map[string]string{
		"Gelin Öýi": "gelin oyi",
		"ÄÇŇÖŞÜÝŽ":  "acnosuyz",
		"äçňöşüýž":  "acnosuyz",
		"Bridal":    "bridal",
	}
	for in, want := range cases {
		if got := textnorm.Norm(in); got != want {
			t.Errorf("Norm(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestNormMatchesSQL(t *testing.T) {
	tx := testutil.Tx(t)
	for _, in := range []string{"Gelin Öýi", "ÄÇŇÖŞÜÝŽ äçňöşüýž", "Ak Ýüpek Bridal 2"} {
		var sql string
		if err := tx.QueryRow(context.Background(), `SELECT norm($1)`, in).Scan(&sql); err != nil {
			t.Fatal(err)
		}
		if got := textnorm.Norm(in); got != sql {
			t.Errorf("Norm(%q) = %q, SQL norm = %q", in, got, sql)
		}
	}
}

func TestSlugify(t *testing.T) {
	cases := map[string]string{
		"Gelin Öýi — Bridal House!": "gelin-oyi-bridal-house",
		"  Ak Ýüpek 2 ":             "ak-yupek-2",
		"Гелин":                     "",
		"--a--b--":                  "a-b",
	}
	for in, want := range cases {
		if got := textnorm.Slugify(in); got != want {
			t.Errorf("Slugify(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestEscapeLike(t *testing.T) {
	if got := textnorm.EscapeLike(`50%_a\`); got != `50\%\_a\\` {
		t.Fatalf("EscapeLike = %q", got)
	}
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `make test`
Expected: FAIL in `internal/textnorm`, with `undefined: textnorm.Norm`.

- [ ] **Step 3: Implement**

`backend/internal/textnorm/textnorm.go`:
```go
package textnorm

import "strings"

var turkmen = strings.NewReplacer(
	"ä", "a", "ç", "c", "ň", "n", "ö", "o", "ş", "s", "ü", "u", "ý", "y", "ž", "z",
	"Ä", "a", "Ç", "c", "Ň", "n", "Ö", "o", "Ş", "s", "Ü", "u", "Ý", "y", "Ž", "z",
)

// Norm mirrors the SQL norm() function: Turkmen letters to Latin base letters, lowercased.
func Norm(s string) string { return strings.ToLower(turkmen.Replace(s)) }

// Slugify keeps a-z and 0-9 from Norm(s) and joins the runs with dashes.
// It returns "" when nothing usable is left (e.g. Cyrillic-only names).
func Slugify(s string) string {
	var b strings.Builder
	dash := false
	for _, r := range Norm(s) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
			dash = false
		} else if !dash && b.Len() > 0 {
			b.WriteByte('-')
			dash = true
		}
	}
	return strings.TrimSuffix(b.String(), "-")
}

var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

// EscapeLike escapes LIKE wildcards so user input matches literally.
func EscapeLike(s string) string { return likeEscaper.Replace(s) }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `make test`
Expected: all packages `ok`.

- [ ] **Step 5: Commit**

```bash
cd /Users/rado/projects/wedding-rentals
git add backend
git commit -m "feat(backend): add Turkmen-aware text normalization and slugs" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Admin authentication (passwords, JWT, rate limit, login, middleware, CLI)

**Files:**
- Create: `backend/internal/auth/password.go`, `tokens.go`, `ratelimit.go`, `admins.go`, `handler.go`
- Create: `backend/cmd/admin/main.go`
- Test: `backend/internal/auth/tokens_test.go`, `ratelimit_test.go`, `handler_test.go`

**Interfaces:**
- Consumes: `db.DBTX`, `httpx.*`, `testutil.*`
- Produces: `auth.TokenTTL` (7 days), `auth.NewTokens(secret string, ttl time.Duration) *auth.Tokens`, `(*Tokens).Issue(adminID int64) (string, error)`, `(*Tokens).Verify(token string) (int64, error)`, `(*Tokens).WithClock(now func() time.Time) *Tokens`, `auth.NewLimiter(max int, window time.Duration) *auth.Limiter`, `(*Limiter).Allow(key string) bool`, `auth.CreateAdmin(ctx, d db.DBTX, email, password string) (int64, error)`, `auth.Handler{DB db.DBTX; Tokens *Tokens; Limiter *Limiter}` with `RegisterPublic(g *gin.RouterGroup)` (registers `POST /admin/login`), `auth.Middleware(t *Tokens) gin.HandlerFunc` (sets the context key `"admin_id"` to an int64)

- [ ] **Step 1: Add dependencies**

```bash
cd backend && go get github.com/golang-jwt/jwt/v5@v5.3.1 golang.org/x/crypto@v0.58.0 golang.org/x/term@latest
```

- [ ] **Step 2: Write the failing token and limiter tests**

`backend/internal/auth/tokens_test.go`:
```go
package auth_test

import (
	"strings"
	"testing"
	"time"

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
```

`backend/internal/auth/ratelimit_test.go`:
```go
package auth

import (
	"testing"
	"time"
)

func TestLimiterAllowsMaxPerWindow(t *testing.T) {
	now := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	l := NewLimiter(5, time.Minute)
	l.now = func() time.Time { return now }
	for i := 0; i < 5; i++ {
		if !l.Allow("1.2.3.4") {
			t.Fatalf("attempt %d blocked", i+1)
		}
	}
	if l.Allow("1.2.3.4") {
		t.Fatal("6th attempt allowed")
	}
	if !l.Allow("5.6.7.8") {
		t.Fatal("other IP blocked")
	}
	now = now.Add(61 * time.Second)
	if !l.Allow("1.2.3.4") {
		t.Fatal("not allowed after window passed")
	}
}
```

- [ ] **Step 3: Run them to verify they fail**

Run: `make test`
Expected: FAIL in `internal/auth`, with `undefined: auth.NewTokens` / `NewLimiter`.

- [ ] **Step 4: Implement passwords, tokens and the limiter**

`backend/internal/auth/password.go`:
```go
package auth

import "golang.org/x/crypto/bcrypt"

func HashPassword(pw string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost)
	return string(b), err
}

func CheckPassword(hash, pw string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(pw)) == nil
}
```

`backend/internal/auth/tokens.go`:
```go
package auth

import (
	"errors"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const TokenTTL = 7 * 24 * time.Hour

type Tokens struct {
	secret []byte
	ttl    time.Duration
	now    func() time.Time
}

func NewTokens(secret string, ttl time.Duration) *Tokens {
	return &Tokens{secret: []byte(secret), ttl: ttl, now: time.Now}
}

// WithClock returns a copy that uses now as its clock (for tests).
func (t *Tokens) WithClock(now func() time.Time) *Tokens {
	c := *t
	c.now = now
	return &c
}

func (t *Tokens) Issue(adminID int64) (string, error) {
	now := t.now()
	claims := jwt.RegisteredClaims{
		Subject:   strconv.FormatInt(adminID, 10),
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(t.ttl)),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(t.secret)
}

func (t *Tokens) Verify(token string) (int64, error) {
	claims := &jwt.RegisteredClaims{}
	_, err := jwt.ParseWithClaims(token, claims,
		func(*jwt.Token) (any, error) { return t.secret, nil },
		jwt.WithValidMethods([]string{"HS256"}),
		jwt.WithTimeFunc(t.now),
		jwt.WithExpirationRequired(),
	)
	if err != nil {
		return 0, err
	}
	id, err := strconv.ParseInt(claims.Subject, 10, 64)
	if err != nil || id <= 0 {
		return 0, errors.New("invalid token subject")
	}
	return id, nil
}
```

`backend/internal/auth/ratelimit.go`:
```go
package auth

import (
	"sync"
	"time"
)

// Limiter allows at most max events per key within a sliding window.
type Limiter struct {
	mu     sync.Mutex
	max    int
	window time.Duration
	now    func() time.Time
	hits   map[string][]time.Time
}

func NewLimiter(max int, window time.Duration) *Limiter {
	return &Limiter{max: max, window: window, now: time.Now, hits: map[string][]time.Time{}}
}

func (l *Limiter) Allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	cutoff := now.Add(-l.window)
	recent := l.hits[key][:0]
	for _, h := range l.hits[key] {
		if h.After(cutoff) {
			recent = append(recent, h)
		}
	}
	if len(recent) >= l.max {
		l.hits[key] = recent
		return false
	}
	l.hits[key] = append(recent, now)
	return true
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `make test`
Expected: `internal/auth` is `ok`.

- [ ] **Step 6: Write the failing login and middleware tests**

`backend/internal/auth/handler_test.go`:
```go
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
```

- [ ] **Step 7: Run them to verify they fail**

Run: `make test`
Expected: FAIL in `internal/auth`, with `undefined: auth.CreateAdmin` / `auth.Handler` / `auth.Middleware`.

- [ ] **Step 8: Implement admins, the handler and the middleware**

`backend/internal/auth/admins.go`:
```go
package auth

import (
	"context"
	"errors"
	"strings"

	"wedding-rentals/backend/internal/db"
)

type admin struct {
	ID           int64
	Email        string
	PasswordHash string
}

func normalizeEmail(s string) string { return strings.ToLower(strings.TrimSpace(s)) }

func CreateAdmin(ctx context.Context, d db.DBTX, email, password string) (int64, error) {
	email = normalizeEmail(email)
	if !strings.Contains(email, "@") {
		return 0, errors.New("invalid email")
	}
	if len(password) < 10 {
		return 0, errors.New("password must be at least 10 characters")
	}
	hash, err := HashPassword(password)
	if err != nil {
		return 0, err
	}
	var id int64
	err = d.QueryRow(ctx, `INSERT INTO admins (email, password_hash) VALUES ($1, $2) RETURNING id`, email, hash).Scan(&id)
	return id, err
}

func findAdminByEmail(ctx context.Context, d db.DBTX, email string) (admin, error) {
	var a admin
	err := d.QueryRow(ctx, `SELECT id, email, password_hash FROM admins WHERE email = $1`, email).
		Scan(&a.ID, &a.Email, &a.PasswordHash)
	return a, err
}
```

`backend/internal/auth/handler.go`:
```go
package auth

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"

	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/httpx"
)

const AdminIDKey = "admin_id"

var (
	errInvalidCredentials = httpx.New(http.StatusUnauthorized, "invalid_credentials", "email or password is wrong")
	errUnauthorized       = httpx.New(http.StatusUnauthorized, "unauthorized", "login required")
	errRateLimited        = httpx.New(http.StatusTooManyRequests, "rate_limited", "too many login attempts, try again in a minute")
)

// dummyHash keeps login timing similar whether or not the email exists.
var dummyHash, _ = HashPassword("timing-equalizer-password")

type Handler struct {
	DB      db.DBTX
	Tokens  *Tokens
	Limiter *Limiter
}

func (h *Handler) RegisterPublic(g *gin.RouterGroup) {
	g.POST("/admin/login", h.login)
}

func (h *Handler) login(c *gin.Context) {
	if !h.Limiter.Allow(c.ClientIP()) {
		httpx.Abort(c, errRateLimited)
		return
	}
	var in struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !httpx.BindJSON(c, &in) {
		return
	}
	a, err := findAdminByEmail(c.Request.Context(), h.DB, normalizeEmail(in.Email))
	if errors.Is(err, pgx.ErrNoRows) {
		CheckPassword(dummyHash, in.Password)
		httpx.Abort(c, errInvalidCredentials)
		return
	}
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	if !CheckPassword(a.PasswordHash, in.Password) {
		httpx.Abort(c, errInvalidCredentials)
		return
	}
	token, err := h.Tokens.Issue(a.ID)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token})
}

// Middleware rejects requests without a valid admin bearer token.
func Middleware(t *Tokens) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, ok := strings.CutPrefix(c.GetHeader("Authorization"), "Bearer ")
		if !ok || token == "" {
			httpx.Abort(c, errUnauthorized)
			return
		}
		id, err := t.Verify(token)
		if err != nil {
			httpx.Abort(c, errUnauthorized)
			return
		}
		c.Set(AdminIDKey, id)
		c.Next()
	}
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `make test`
Expected: all packages `ok`.

- [ ] **Step 10: Add the admin CLI**

`backend/cmd/admin/main.go`:
```go
// Command admin creates admin accounts:
//
//	go run ./cmd/admin create --email you@example.com
//
// The password is read from the terminal (hidden) or from stdin when piped.
package main

import (
	"bufio"
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"strings"

	"golang.org/x/term"

	"wedding-rentals/backend/internal/auth"
	"wedding-rentals/backend/internal/db"
)

func main() {
	if len(os.Args) < 2 || os.Args[1] != "create" {
		fmt.Fprintln(os.Stderr, "usage: admin create --email you@example.com")
		os.Exit(2)
	}
	fs := flag.NewFlagSet("create", flag.ExitOnError)
	email := fs.String("email", "", "admin email")
	_ = fs.Parse(os.Args[2:])
	if *email == "" {
		log.Fatal("--email is required")
	}
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		log.Fatal("DATABASE_URL is required")
	}
	pw, err := readPassword()
	if err != nil {
		log.Fatal(err)
	}
	ctx := context.Background()
	pool, err := db.Connect(ctx, url)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool); err != nil {
		log.Fatal(err)
	}
	id, err := auth.CreateAdmin(ctx, pool, *email, pw)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("created admin #%d (%s)\n", id, *email)
}

func readPassword() (string, error) {
	fd := int(os.Stdin.Fd())
	if term.IsTerminal(fd) {
		fmt.Fprint(os.Stderr, "Password (min 10 characters): ")
		b, err := term.ReadPassword(fd)
		fmt.Fprintln(os.Stderr)
		return string(b), err
	}
	line, err := bufio.NewReader(os.Stdin).ReadString('\n')
	if err != nil && !errors.Is(err, io.EOF) {
		return "", err
	}
	return strings.TrimRight(line, "\r\n"), nil
}
```

Run: `go mod tidy && go build ./...`
Expected: no output (it builds).

- [ ] **Step 11: Commit**

```bash
cd /Users/rado/projects/wedding-rentals
git add backend
git commit -m "feat(backend): add admin login with JWT, rate limiting and admin CLI" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Cities endpoint

**Files:**
- Create: `backend/internal/cities/cities.go`
- Test: `backend/internal/cities/cities_test.go`

**Interfaces:**
- Produces: `cities.City{ID int64; Slug, NameTK, NameRU, NameEN string}` (JSON: `id, slug, name_tk, name_ru, name_en`), `cities.List(ctx, d) ([]City, error)`, `cities.Handler{DB}` with `RegisterPublic(g)` → `GET /cities` returning `{"items": [...]}`

- [ ] **Step 1: Write the failing test**

`backend/internal/cities/cities_test.go`:
```go
package cities_test

import (
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"

	"wedding-rentals/backend/internal/cities"
	"wedding-rentals/backend/internal/testutil"
)

func TestListCities(t *testing.T) {
	r := gin.New()
	(&cities.Handler{DB: testutil.Tx(t)}).RegisterPublic(r.Group("/api"))
	rec := testutil.Request(t, r, http.MethodGet, "/api/cities", nil, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	body := testutil.Decode[struct{ Items []cities.City }](t, rec)
	if len(body.Items) != 9 {
		t.Fatalf("got %d cities", len(body.Items))
	}
	first := body.Items[0]
	if first.Slug != "ashgabat" || first.NameTK != "Aşgabat" || first.NameRU != "Ашхабад" {
		t.Fatalf("first city = %+v", first)
	}
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `make test`
Expected: FAIL, with `undefined: cities.Handler`.

- [ ] **Step 3: Implement**

`backend/internal/cities/cities.go`:
```go
package cities

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"

	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/httpx"
)

type City struct {
	ID     int64  `json:"id"`
	Slug   string `json:"slug"`
	NameTK string `json:"name_tk"`
	NameRU string `json:"name_ru"`
	NameEN string `json:"name_en"`
}

func List(ctx context.Context, d db.DBTX) ([]City, error) {
	rows, err := d.Query(ctx, `SELECT id, slug, name_tk, name_ru, name_en FROM cities ORDER BY sort_order, id`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[City])
}

type Handler struct{ DB db.DBTX }

func (h *Handler) RegisterPublic(g *gin.RouterGroup) {
	g.GET("/cities", h.list)
}

func (h *Handler) list(c *gin.Context) {
	list, err := List(c.Request.Context(), h.DB)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": list})
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `make test`
Expected: all `ok`.

- [ ] **Step 5: Commit**

```bash
cd /Users/rado/projects/wedding-rentals
git add backend
git commit -m "feat(backend): add cities endpoint" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Images (processing, storage, upload, reorder, delete)

**Files:**
- Create: `backend/internal/images/image.go`, `storage.go`, `process.go`, `repo.go`, `handler.go`
- Test: `backend/internal/images/process_test.go`, `handler_test.go`

**Interfaces:**
- Consumes: `db.DBTX`, `db.InTx`, `httpx.*`, `testutil.InsertShop/InsertDress/InsertImage`
- Produces: `images.Image{ID int64; Position int; Small, Large string; Width, Height int}` (JSON `id, position, small, large, width, height`; `Small`/`Large` are public URLs), `images.URL(path string) string` (= `"/uploads/" + path`), `images.Storage` interface `{Save(name string, data []byte) error; Delete(name string) error}`, `images.LocalStorage{Dir string}`, `images.DeleteFiles(st Storage, names []string)`, `images.Process(data []byte) (images.Processed, error)`, `images.ErrUnsupported`, `images.ListForListing(ctx, d, listingID int64) ([]Image, error)` (never nil), `images.PathsForListing(ctx, d, listingID int64) ([]string, error)`, `images.PathsForShop(ctx, d, shopID int64) ([]string, error)` (the logo plus all photos of the shop's listings), `images.Handler{DB db.DBTX; Storage Storage}` with `RegisterAdmin(g)` → `POST /images`, `PATCH /images/order`, `DELETE /images/:id`

- [ ] **Step 1: Add dependencies**

```bash
cd backend && go get github.com/disintegration/imaging@v1.6.2 golang.org/x/image@v0.47.0
```

- [ ] **Step 2: Write the failing processing test**

`backend/internal/images/process_test.go`:
```go
package images_test

import (
	"bytes"
	"errors"
	"image"
	"image/color"
	"image/gif"
	"image/jpeg"
	"image/png"
	"testing"

	"wedding-rentals/backend/internal/images"
)

func pngBytes(t *testing.T, w, h int, c color.Color) []byte {
	t.Helper()
	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, c)
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func decodeJPEG(t *testing.T, b []byte) image.Image {
	t.Helper()
	img, err := jpeg.Decode(bytes.NewReader(b))
	if err != nil {
		t.Fatalf("output is not JPEG: %v", err)
	}
	return img
}

func TestProcessResizesToTwoWidths(t *testing.T) {
	p, err := images.Process(pngBytes(t, 2000, 1000, color.NRGBA{200, 100, 50, 255}))
	if err != nil {
		t.Fatal(err)
	}
	if p.Width != 1200 || p.Height != 600 {
		t.Fatalf("large = %dx%d", p.Width, p.Height)
	}
	if b := decodeJPEG(t, p.Large).Bounds(); b.Dx() != 1200 || b.Dy() != 600 {
		t.Fatalf("large bytes = %v", b)
	}
	if b := decodeJPEG(t, p.Small).Bounds(); b.Dx() != 400 || b.Dy() != 200 {
		t.Fatalf("small bytes = %v", b)
	}
}

func TestProcessDoesNotUpscale(t *testing.T) {
	p, err := images.Process(pngBytes(t, 300, 200, color.White))
	if err != nil {
		t.Fatal(err)
	}
	if p.Width != 300 || decodeJPEG(t, p.Small).Bounds().Dx() != 300 {
		t.Fatalf("upscaled: %d", p.Width)
	}
}

func TestProcessFlattensTransparencyToWhite(t *testing.T) {
	p, err := images.Process(pngBytes(t, 50, 50, color.NRGBA{0, 0, 0, 0}))
	if err != nil {
		t.Fatal(err)
	}
	r, g, b, _ := decodeJPEG(t, p.Small).At(10, 10).RGBA()
	if r>>8 < 240 || g>>8 < 240 || b>>8 < 240 {
		t.Fatalf("pixel = %d,%d,%d; want white", r>>8, g>>8, b>>8)
	}
}

func TestProcessRejectsUnsupported(t *testing.T) {
	var gifBuf bytes.Buffer
	_ = gif.Encode(&gifBuf, image.NewPaletted(image.Rect(0, 0, 10, 10), []color.Color{color.White}), nil)
	for name, data := range map[string][]byte{"text": []byte("hello, not an image"), "gif": gifBuf.Bytes()} {
		if _, err := images.Process(data); !errors.Is(err, images.ErrUnsupported) {
			t.Errorf("%s: err = %v, want ErrUnsupported", name, err)
		}
	}
}
```

- [ ] **Step 3: Run it to verify it fails**

Run: `make test`
Expected: FAIL, with `undefined: images.Process`.

- [ ] **Step 4: Implement image.go, storage.go and process.go**

`backend/internal/images/image.go`:
```go
package images

type Image struct {
	ID       int64  `json:"id"`
	Position int    `json:"position"`
	Small    string `json:"small"`
	Large    string `json:"large"`
	Width    int    `json:"width"`
	Height   int    `json:"height"`
}

// URL turns a stored relative path into the public URL served under /uploads.
func URL(path string) string { return "/uploads/" + path }
```

`backend/internal/images/storage.go`:
```go
package images

import (
	"errors"
	"io/fs"
	"log"
	"os"
	"path/filepath"
)

// Storage keeps image files; names are server-generated relative paths.
type Storage interface {
	Save(name string, data []byte) error
	Delete(name string) error
}

type LocalStorage struct{ Dir string }

func (s LocalStorage) Save(name string, data []byte) error {
	p := filepath.Join(s.Dir, filepath.FromSlash(name))
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		return err
	}
	return os.WriteFile(p, data, 0o644)
}

func (s LocalStorage) Delete(name string) error {
	err := os.Remove(filepath.Join(s.Dir, filepath.FromSlash(name)))
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	return err
}

// DeleteFiles removes files best-effort; failures are logged, not returned.
func DeleteFiles(st Storage, names []string) {
	for _, n := range names {
		if err := st.Delete(n); err != nil {
			log.Printf("delete image file %s: %v", n, err)
		}
	}
}
```

`backend/internal/images/process.go`:
```go
package images

import (
	"bytes"
	"errors"
	"fmt"
	"image"
	"image/color"
	"net/http"

	"github.com/disintegration/imaging"
	_ "golang.org/x/image/webp" // registers the WebP decoder
)

const (
	SmallWidth  = 400
	LargeWidth  = 1200
	jpegQuality = 82
)

var ErrUnsupported = errors.New("unsupported image")

type Processed struct {
	Small, Large  []byte
	Width, Height int // dimensions of Large
}

// Process validates an upload by content, fixes EXIF rotation, flattens
// transparency onto white and returns small and large JPEG versions.
func Process(data []byte) (Processed, error) {
	switch http.DetectContentType(data) {
	case "image/jpeg", "image/png", "image/webp":
	default:
		return Processed{}, ErrUnsupported
	}
	img, err := imaging.Decode(bytes.NewReader(data), imaging.AutoOrientation(true))
	if err != nil {
		return Processed{}, fmt.Errorf("%w: %v", ErrUnsupported, err)
	}
	img = flatten(img)
	large := fitWidth(img, LargeWidth)
	lb, err := encode(large)
	if err != nil {
		return Processed{}, err
	}
	sb, err := encode(fitWidth(img, SmallWidth))
	if err != nil {
		return Processed{}, err
	}
	return Processed{Small: sb, Large: lb, Width: large.Bounds().Dx(), Height: large.Bounds().Dy()}, nil
}

func fitWidth(img image.Image, w int) image.Image {
	if img.Bounds().Dx() <= w {
		return img
	}
	return imaging.Resize(img, w, 0, imaging.Lanczos)
}

func flatten(img image.Image) image.Image {
	b := img.Bounds()
	bg := imaging.New(b.Dx(), b.Dy(), color.White)
	return imaging.Overlay(bg, img, image.Pt(0, 0), 1.0)
}

func encode(img image.Image) ([]byte, error) {
	var buf bytes.Buffer
	err := imaging.Encode(&buf, img, imaging.JPEG, imaging.JPEGQuality(jpegQuality))
	return buf.Bytes(), err
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `go mod tidy && make test`
Expected: `internal/images` is `ok`.

- [ ] **Step 6: Write the failing handler tests**

`backend/internal/images/handler_test.go`:
```go
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
```

- [ ] **Step 7: Run them to verify they fail**

Run: `make test`
Expected: FAIL, with `undefined: images.Handler` / `images.ListForListing`.

- [ ] **Step 8: Implement repo.go and handler.go**

`backend/internal/images/repo.go`:
```go
package images

import (
	"context"

	"github.com/jackc/pgx/v5"

	"wedding-rentals/backend/internal/db"
)

func ListForListing(ctx context.Context, d db.DBTX, listingID int64) ([]Image, error) {
	rows, err := d.Query(ctx, `
		SELECT id, position, path_small, path_large, width, height
		FROM images WHERE listing_id = $1 ORDER BY position, id`, listingID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []Image{}
	for rows.Next() {
		var img Image
		var small, large string
		if err := rows.Scan(&img.ID, &img.Position, &small, &large, &img.Width, &img.Height); err != nil {
			return nil, err
		}
		img.Small, img.Large = URL(small), URL(large)
		list = append(list, img)
	}
	return list, rows.Err()
}

func PathsForListing(ctx context.Context, d db.DBTX, listingID int64) ([]string, error) {
	rows, err := d.Query(ctx, `SELECT path_small, path_large FROM images WHERE listing_id = $1`, listingID)
	if err != nil {
		return nil, err
	}
	return collectPaths(rows)
}

// PathsForShop returns the files of the shop logo and of all its listings.
func PathsForShop(ctx context.Context, d db.DBTX, shopID int64) ([]string, error) {
	rows, err := d.Query(ctx, `
		SELECT path_small, path_large FROM images
		WHERE shop_id = $1 OR listing_id IN (SELECT id FROM listings WHERE shop_id = $1)`, shopID)
	if err != nil {
		return nil, err
	}
	return collectPaths(rows)
}

func collectPaths(rows pgx.Rows) ([]string, error) {
	defer rows.Close()
	var paths []string
	for rows.Next() {
		var small, large string
		if err := rows.Scan(&small, &large); err != nil {
			return nil, err
		}
		paths = append(paths, small, large)
	}
	return paths, rows.Err()
}
```

`backend/internal/images/handler.go`:
```go
package images

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"

	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/httpx"
)

const MaxUploadBytes = 10 << 20

var (
	errTooLarge     = httpx.New(http.StatusRequestEntityTooLarge, "file_too_large", "image must be 10 MB or smaller")
	errInvalidImage = httpx.New(http.StatusUnprocessableEntity, "invalid_image", "file must be a JPEG, PNG or WebP image")
)

type Handler struct {
	DB      db.DBTX
	Storage Storage
}

func (h *Handler) RegisterAdmin(g *gin.RouterGroup) {
	g.POST("/images", h.upload)
	g.PATCH("/images/order", h.reorder)
	g.DELETE("/images/:id", h.delete)
}

type owner struct{ listingID, shopID int64 }

func (h *Handler) upload(c *gin.Context) {
	const slack = 1 << 20 // room for multipart headers and fields
	if c.Request.ContentLength > MaxUploadBytes+slack {
		httpx.Abort(c, errTooLarge)
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, MaxUploadBytes+slack)
	fh, err := c.FormFile("file")
	if err != nil {
		var mbe *http.MaxBytesError
		if errors.As(err, &mbe) {
			httpx.Abort(c, errTooLarge)
			return
		}
		httpx.Abort(c, httpx.Validation(map[string]string{"file": "required"}))
		return
	}
	if fh.Size > MaxUploadBytes {
		httpx.Abort(c, errTooLarge)
		return
	}
	ctx := c.Request.Context()
	o, ok := h.parseOwner(c)
	if !ok {
		return
	}
	f, err := fh.Open()
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	data, err := io.ReadAll(f)
	f.Close()
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	p, err := Process(data)
	if errors.Is(err, ErrUnsupported) {
		httpx.Abort(c, errInvalidImage)
		return
	}
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	small, large := newNames()
	if err := h.Storage.Save(small, p.Small); err != nil {
		httpx.Abort(c, err)
		return
	}
	if err := h.Storage.Save(large, p.Large); err != nil {
		DeleteFiles(h.Storage, []string{small})
		httpx.Abort(c, err)
		return
	}
	img, oldFiles, err := insert(ctx, h.DB, o, small, large, p)
	if err != nil {
		DeleteFiles(h.Storage, []string{small, large})
		httpx.Abort(c, err)
		return
	}
	DeleteFiles(h.Storage, oldFiles)
	c.JSON(http.StatusCreated, img)
}

// parseOwner requires exactly one existing listing_id or shop_id.
func (h *Handler) parseOwner(c *gin.Context) (owner, bool) {
	l, _ := strconv.ParseInt(c.PostForm("listing_id"), 10, 64)
	s, _ := strconv.ParseInt(c.PostForm("shop_id"), 10, 64)
	if (l > 0) == (s > 0) {
		httpx.Abort(c, httpx.Validation(map[string]string{"owner": "exactly_one_of_listing_id_or_shop_id"}))
		return owner{}, false
	}
	table, field, id := "listings", "listing_id", l
	if s > 0 {
		table, field, id = "shops", "shop_id", s
	}
	var exists bool
	if err := h.DB.QueryRow(c.Request.Context(), `SELECT EXISTS(SELECT 1 FROM `+table+` WHERE id = $1)`, id).Scan(&exists); err != nil {
		httpx.Abort(c, err)
		return owner{}, false
	}
	if !exists {
		httpx.Abort(c, httpx.Validation(map[string]string{field: "invalid"}))
		return owner{}, false
	}
	return owner{listingID: l, shopID: s}, true
}

func newNames() (small, large string) {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	id := hex.EncodeToString(b)
	return id[:2] + "/" + id + "_s.jpg", id[:2] + "/" + id + "_l.jpg"
}

// insert stores the image row. For a shop it replaces the previous logo and
// returns the old logo's files so the caller can delete them after commit.
func insert(ctx context.Context, d db.DBTX, o owner, small, large string, p Processed) (Image, []string, error) {
	img := Image{Small: URL(small), Large: URL(large), Width: p.Width, Height: p.Height}
	var oldFiles []string
	err := db.InTx(ctx, d, func(tx pgx.Tx) error {
		if o.listingID > 0 {
			return tx.QueryRow(ctx, `
				INSERT INTO images (listing_id, position, path_small, path_large, width, height)
				VALUES ($1, (SELECT COALESCE(max(position) + 1, 0) FROM images WHERE listing_id = $1), $2, $3, $4, $5)
				RETURNING id, position`, o.listingID, small, large, p.Width, p.Height).Scan(&img.ID, &img.Position)
		}
		rows, err := tx.Query(ctx, `DELETE FROM images WHERE shop_id = $1 RETURNING path_small, path_large`, o.shopID)
		if err != nil {
			return err
		}
		if oldFiles, err = collectPaths(rows); err != nil {
			return err
		}
		err = tx.QueryRow(ctx, `
			INSERT INTO images (shop_id, position, path_small, path_large, width, height)
			VALUES ($1, 0, $2, $3, $4, $5) RETURNING id, position`,
			o.shopID, small, large, p.Width, p.Height).Scan(&img.ID, &img.Position)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `UPDATE shops SET logo_image_id = $2, updated_at = now() WHERE id = $1`, o.shopID, img.ID)
		return err
	})
	return img, oldFiles, err
}

func (h *Handler) reorder(c *gin.Context) {
	var in struct {
		IDs []int64 `json:"ids"`
	}
	if !httpx.BindJSON(c, &in) {
		return
	}
	invalid := httpx.Validation(map[string]string{"ids": "must_list_all_images_of_one_listing"})
	if len(in.IDs) == 0 {
		httpx.Abort(c, invalid)
		return
	}
	ctx := c.Request.Context()
	err := db.InTx(ctx, h.DB, func(tx pgx.Tx) error {
		var listings, found int
		var listingID *int64
		err := tx.QueryRow(ctx, `
			SELECT count(DISTINCT listing_id), count(*), min(listing_id)
			FROM images WHERE id = ANY($1) AND listing_id IS NOT NULL`, in.IDs).Scan(&listings, &found, &listingID)
		if err != nil {
			return err
		}
		if listings != 1 || found != len(in.IDs) {
			return invalid
		}
		var total int
		if err := tx.QueryRow(ctx, `SELECT count(*) FROM images WHERE listing_id = $1`, *listingID).Scan(&total); err != nil {
			return err
		}
		if total != len(in.IDs) {
			return invalid
		}
		_, err = tx.Exec(ctx, `
			UPDATE images SET position = x.ord - 1, updated_at = now()
			FROM unnest($1::bigint[]) WITH ORDINALITY AS x(id, ord)
			WHERE images.id = x.id`, in.IDs)
		return err
	})
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) delete(c *gin.Context) {
	id, ok := httpx.ParseID(c, "id")
	if !ok {
		return
	}
	var small, large string
	err := h.DB.QueryRow(c.Request.Context(), `DELETE FROM images WHERE id = $1 RETURNING path_small, path_large`, id).Scan(&small, &large)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	DeleteFiles(h.Storage, []string{small, large})
	c.Status(http.StatusNoContent)
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `make test`
Expected: all `ok`.

- [ ] **Step 10: Commit**

```bash
cd /Users/rado/projects/wedding-rentals
git add backend
git commit -m "feat(backend): add image upload, resizing, reordering and deletion" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Shops admin CRUD

**Files:**
- Create: `backend/internal/shops/model.go`, `repo.go`, `handler.go`
- Test: `backend/internal/shops/handler_test.go`

**Interfaces:**
- Consumes: `db.DBTX`, `db.InTx`, `httpx.*`, `textnorm.Slugify`, `images.Image`, `images.URL`, `images.Storage`, `images.PathsForShop`, `images.DeleteFiles`
- Produces: `shops.Input` (JSON `name, city_id, address, phone, instagram_url, tiktok_url, description, is_published, aliases`), `shops.Shop` (JSON `id, slug, name, city_id, address, phone, instagram_url, tiktok_url, description, is_published, logo, aliases, created_at, updated_at`), `shops.Create(ctx, d, in Input) (int64, error)`, `shops.Update(ctx, d, id int64, in Input) error`, `shops.Get(ctx, d, id int64) (Shop, error)`, `shops.List(ctx, d) ([]Shop, error)`, `shops.Delete(ctx, d, st images.Storage, id int64) error`, `shops.Handler{DB db.DBTX; Storage images.Storage}` with `RegisterAdmin(g)` → `GET/POST /shops`, `GET/PUT/DELETE /shops/:id`

- [ ] **Step 1: Write the failing tests**

`backend/internal/shops/handler_test.go`:
```go
package shops_test

import (
	"context"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"

	"wedding-rentals/backend/internal/images"
	"wedding-rentals/backend/internal/shops"
	"wedding-rentals/backend/internal/testutil"
)

type env struct {
	r      *gin.Engine
	tx     pgx.Tx
	dir    string
	cityID int64
}

func setup(t *testing.T) env {
	e := env{r: gin.New(), tx: testutil.Tx(t), dir: t.TempDir()}
	h := &shops.Handler{DB: e.tx, Storage: images.LocalStorage{Dir: e.dir}}
	h.RegisterAdmin(e.r.Group("/api/admin"))
	if err := e.tx.QueryRow(context.Background(), `SELECT id FROM cities WHERE slug = 'ashgabat'`).Scan(&e.cityID); err != nil {
		t.Fatal(err)
	}
	return e
}

func (e env) validInput() map[string]any {
	return map[string]any{
		"name":          "Gelin Öýi",
		"city_id":       e.cityID,
		"address":       "Magtymguly şaýoly 12",
		"phone":         "+993 65 123456",
		"instagram_url": "https://instagram.com/gelinoyi",
		"aliases":       []string{"Bridal House", " bridal house ", "Гелин Ой", ""},
	}
}

func path(id int64) string { return "/api/admin/shops/" + strconv.FormatInt(id, 10) }

func TestCreateShop(t *testing.T) {
	e := setup(t)
	rec := testutil.Request(t, e.r, http.MethodPost, "/api/admin/shops", e.validInput(), "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body)
	}
	s := testutil.Decode[shops.Shop](t, rec)
	if s.Slug != "gelin-oyi" || s.Name != "Gelin Öýi" || s.IsPublished || s.TikTokURL != nil {
		t.Fatalf("shop = %+v", s)
	}
	if !slices.Equal(s.Aliases, []string{"Bridal House", "Гелин Ой"}) {
		t.Fatalf("aliases = %q", s.Aliases)
	}
}

func TestCreateShopSlugIsUnique(t *testing.T) {
	e := setup(t)
	testutil.Request(t, e.r, http.MethodPost, "/api/admin/shops", e.validInput(), "")
	rec := testutil.Request(t, e.r, http.MethodPost, "/api/admin/shops", e.validInput(), "")
	if s := testutil.Decode[shops.Shop](t, rec); s.Slug != "gelin-oyi-2" {
		t.Fatalf("slug = %q", s.Slug)
	}
}

func TestCreateShopValidation(t *testing.T) {
	e := setup(t)
	rec := testutil.Request(t, e.r, http.MethodPost, "/api/admin/shops", map[string]any{}, "")
	body := testutil.Decode[testutil.ErrorBody](t, rec)
	if rec.Code != 400 || body.Error.Code != "validation_failed" {
		t.Fatalf("got %d %q", rec.Code, body.Error.Code)
	}
	for _, f := range []string{"name", "city_id", "address", "phone"} {
		if body.Error.Fields[f] != "required" {
			t.Errorf("fields[%s] = %q", f, body.Error.Fields[f])
		}
	}

	in := e.validInput()
	in["phone"] = "call me"
	in["instagram_url"] = "http://instagram.com/x"
	in["city_id"] = 999999999
	body = testutil.Decode[testutil.ErrorBody](t, testutil.Request(t, e.r, http.MethodPost, "/api/admin/shops", in, ""))
	for _, f := range []string{"phone", "instagram_url", "city_id"} {
		if body.Error.Fields[f] != "invalid" {
			t.Errorf("fields[%s] = %q", f, body.Error.Fields[f])
		}
	}
}

func TestUpdateShop(t *testing.T) {
	e := setup(t)
	created := testutil.Decode[shops.Shop](t, testutil.Request(t, e.r, http.MethodPost, "/api/admin/shops", e.validInput(), ""))
	in := e.validInput()
	in["name"] = "Gelin Öýi Lux"
	in["is_published"] = true
	in["aliases"] = []string{"GO Lux"}
	rec := testutil.Request(t, e.r, http.MethodPut, path(created.ID), in, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body)
	}
	s := testutil.Decode[shops.Shop](t, rec)
	if s.Slug != "gelin-oyi" || s.Name != "Gelin Öýi Lux" || !s.IsPublished || !slices.Equal(s.Aliases, []string{"GO Lux"}) {
		t.Fatalf("shop = %+v", s)
	}
	if rec := testutil.Request(t, e.r, http.MethodPut, path(999999999), in, ""); rec.Code != http.StatusNotFound {
		t.Fatalf("missing shop: status = %d", rec.Code)
	}
}

func TestGetAndListShops(t *testing.T) {
	e := setup(t)
	created := testutil.Decode[shops.Shop](t, testutil.Request(t, e.r, http.MethodPost, "/api/admin/shops", e.validInput(), ""))
	got := testutil.Decode[shops.Shop](t, testutil.Request(t, e.r, http.MethodGet, path(created.ID), nil, ""))
	if got.ID != created.ID || got.Address != "Magtymguly şaýoly 12" {
		t.Fatalf("get = %+v", got)
	}
	list := testutil.Decode[struct{ Items []shops.Shop }](t, testutil.Request(t, e.r, http.MethodGet, "/api/admin/shops", nil, ""))
	if !slices.ContainsFunc(list.Items, func(s shops.Shop) bool { return s.ID == created.ID }) {
		t.Fatal("created shop missing from list")
	}
}

func TestDeleteShopRemovesImageFiles(t *testing.T) {
	e := setup(t)
	shop := testutil.InsertShop(t, e.tx, testutil.ShopFixture{})
	dress := testutil.InsertDress(t, e.tx, testutil.DressFixture{ShopID: shop.ID})
	testutil.InsertImage(t, e.tx, dress, 0, "pic")
	for _, f := range []string{"pic_s.jpg", "pic_l.jpg"} {
		if err := os.WriteFile(filepath.Join(e.dir, f), []byte("x"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	if rec := testutil.Request(t, e.r, http.MethodDelete, path(shop.ID), nil, ""); rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d", rec.Code)
	}
	if _, err := os.Stat(filepath.Join(e.dir, "pic_s.jpg")); !os.IsNotExist(err) {
		t.Fatal("image file still exists")
	}
	if rec := testutil.Request(t, e.r, http.MethodGet, path(shop.ID), nil, ""); rec.Code != http.StatusNotFound {
		t.Fatalf("get after delete: %d", rec.Code)
	}
}
```

- [ ] **Step 2: Run them to verify they fail**

Run: `make test`
Expected: FAIL, with `undefined: shops.Handler`.

- [ ] **Step 3: Implement model.go**

`backend/internal/shops/model.go`:
```go
package shops

import (
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"wedding-rentals/backend/internal/images"
)

type Input struct {
	Name         string   `json:"name"`
	CityID       int64    `json:"city_id"`
	Address      string   `json:"address"`
	Phone        string   `json:"phone"`
	InstagramURL string   `json:"instagram_url"`
	TikTokURL    string   `json:"tiktok_url"`
	Description  string   `json:"description"`
	IsPublished  bool     `json:"is_published"`
	Aliases      []string `json:"aliases"`
}

type Shop struct {
	ID           int64         `json:"id"`
	Slug         string        `json:"slug"`
	Name         string        `json:"name"`
	CityID       int64         `json:"city_id"`
	Address      string        `json:"address"`
	Phone        string        `json:"phone"`
	InstagramURL *string       `json:"instagram_url"`
	TikTokURL    *string       `json:"tiktok_url"`
	Description  *string       `json:"description"`
	IsPublished  bool          `json:"is_published"`
	Logo         *images.Image `json:"logo"`
	Aliases      []string      `json:"aliases"`
	CreatedAt    time.Time     `json:"created_at"`
	UpdatedAt    time.Time     `json:"updated_at"`
}

var phoneRe = regexp.MustCompile(`^\+?[0-9 ()-]{6,20}$`)

// normalize trims strings and de-duplicates aliases case-insensitively.
func (in *Input) normalize() {
	in.Name = strings.TrimSpace(in.Name)
	in.Address = strings.TrimSpace(in.Address)
	in.Phone = strings.TrimSpace(in.Phone)
	in.InstagramURL = strings.TrimSpace(in.InstagramURL)
	in.TikTokURL = strings.TrimSpace(in.TikTokURL)
	in.Description = strings.TrimSpace(in.Description)
	seen := map[string]bool{}
	aliases := []string{}
	for _, a := range in.Aliases {
		a = strings.TrimSpace(a)
		key := strings.ToLower(a)
		if a == "" || seen[key] {
			continue
		}
		seen[key] = true
		aliases = append(aliases, a)
	}
	in.Aliases = aliases
}

func (in Input) validate() map[string]string {
	errs := map[string]string{}
	if in.Name == "" {
		errs["name"] = "required"
	} else if utf8.RuneCountInString(in.Name) > 200 {
		errs["name"] = "too_long"
	}
	if in.CityID <= 0 {
		errs["city_id"] = "required"
	}
	if in.Address == "" {
		errs["address"] = "required"
	}
	if in.Phone == "" {
		errs["phone"] = "required"
	} else if !phoneRe.MatchString(in.Phone) {
		errs["phone"] = "invalid"
	}
	if in.InstagramURL != "" && !strings.HasPrefix(in.InstagramURL, "https://") {
		errs["instagram_url"] = "invalid"
	}
	if in.TikTokURL != "" && !strings.HasPrefix(in.TikTokURL, "https://") {
		errs["tiktok_url"] = "invalid"
	}
	if len(in.Aliases) > 20 {
		errs["aliases"] = "too_many"
	}
	return errs
}

func nullIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
```

- [ ] **Step 4: Implement repo.go**

`backend/internal/shops/repo.go`:
```go
package shops

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"

	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/images"
	"wedding-rentals/backend/internal/textnorm"
)

const selectShop = `
	SELECT s.id, s.slug, s.name, s.city_id, s.address, s.phone, s.instagram_url, s.tiktok_url,
	       s.description, s.is_published, s.created_at, s.updated_at,
	       COALESCE((SELECT array_agg(a.alias ORDER BY a.id) FROM shop_aliases a WHERE a.shop_id = s.id), '{}'),
	       li.id, li.position, li.path_small, li.path_large, li.width, li.height
	FROM shops s
	LEFT JOIN images li ON li.id = s.logo_image_id`

func scanShop(row pgx.Row) (Shop, error) {
	var s Shop
	var logoID *int64
	var logoPos, logoW, logoH *int
	var logoSmall, logoLarge *string
	err := row.Scan(&s.ID, &s.Slug, &s.Name, &s.CityID, &s.Address, &s.Phone, &s.InstagramURL, &s.TikTokURL,
		&s.Description, &s.IsPublished, &s.CreatedAt, &s.UpdatedAt, &s.Aliases,
		&logoID, &logoPos, &logoSmall, &logoLarge, &logoW, &logoH)
	if err != nil {
		return Shop{}, err
	}
	if logoID != nil {
		s.Logo = &images.Image{ID: *logoID, Position: *logoPos, Small: images.URL(*logoSmall),
			Large: images.URL(*logoLarge), Width: *logoW, Height: *logoH}
	}
	return s, nil
}

func Create(ctx context.Context, d db.DBTX, in Input) (int64, error) {
	var id int64
	err := db.InTx(ctx, d, func(tx pgx.Tx) error {
		slug, err := uniqueSlug(ctx, tx, in.Name)
		if err != nil {
			return err
		}
		err = tx.QueryRow(ctx, `
			INSERT INTO shops (slug, name, city_id, address, phone, instagram_url, tiktok_url, description, is_published)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
			slug, in.Name, in.CityID, in.Address, in.Phone, nullIfEmpty(in.InstagramURL),
			nullIfEmpty(in.TikTokURL), nullIfEmpty(in.Description), in.IsPublished).Scan(&id)
		if err != nil {
			return err
		}
		return replaceAliases(ctx, tx, id, in.Aliases)
	})
	return id, err
}

// Update changes everything except the slug, which stays stable for shared links.
func Update(ctx context.Context, d db.DBTX, id int64, in Input) error {
	return db.InTx(ctx, d, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `
			UPDATE shops SET name = $2, city_id = $3, address = $4, phone = $5, instagram_url = $6,
			       tiktok_url = $7, description = $8, is_published = $9, updated_at = now()
			WHERE id = $1`,
			id, in.Name, in.CityID, in.Address, in.Phone, nullIfEmpty(in.InstagramURL),
			nullIfEmpty(in.TikTokURL), nullIfEmpty(in.Description), in.IsPublished)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return pgx.ErrNoRows
		}
		return replaceAliases(ctx, tx, id, in.Aliases)
	})
}

func replaceAliases(ctx context.Context, tx pgx.Tx, shopID int64, aliases []string) error {
	if _, err := tx.Exec(ctx, `DELETE FROM shop_aliases WHERE shop_id = $1`, shopID); err != nil {
		return err
	}
	if len(aliases) == 0 {
		return nil
	}
	_, err := tx.Exec(ctx, `INSERT INTO shop_aliases (shop_id, alias) SELECT $1, unnest($2::text[])`, shopID, aliases)
	return err
}

func Get(ctx context.Context, d db.DBTX, id int64) (Shop, error) {
	return scanShop(d.QueryRow(ctx, selectShop+` WHERE s.id = $1`, id))
}

func List(ctx context.Context, d db.DBTX) ([]Shop, error) {
	rows, err := d.Query(ctx, selectShop+` ORDER BY s.name, s.id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []Shop{}
	for rows.Next() {
		s, err := scanShop(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, s)
	}
	return list, rows.Err()
}

// Delete removes the shop (its listings, aliases and images cascade) and its files.
func Delete(ctx context.Context, d db.DBTX, st images.Storage, id int64) error {
	paths, err := images.PathsForShop(ctx, d, id)
	if err != nil {
		return err
	}
	tag, err := d.Exec(ctx, `DELETE FROM shops WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	images.DeleteFiles(st, paths)
	return nil
}

func uniqueSlug(ctx context.Context, d db.DBTX, name string) (string, error) {
	base := textnorm.Slugify(name)
	if base == "" {
		base = "shop"
	}
	slug := base
	for i := 2; ; i++ {
		var exists bool
		if err := d.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM shops WHERE slug = $1)`, slug).Scan(&exists); err != nil {
			return "", err
		}
		if !exists {
			return slug, nil
		}
		slug = fmt.Sprintf("%s-%d", base, i)
	}
}
```

- [ ] **Step 5: Implement handler.go**

`backend/internal/shops/handler.go`:
```go
package shops

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/httpx"
	"wedding-rentals/backend/internal/images"
)

type Handler struct {
	DB      db.DBTX
	Storage images.Storage
}

func (h *Handler) RegisterAdmin(g *gin.RouterGroup) {
	g.GET("/shops", h.list)
	g.POST("/shops", h.create)
	g.GET("/shops/:id", h.get)
	g.PUT("/shops/:id", h.update)
	g.DELETE("/shops/:id", h.delete)
}

func (h *Handler) bindInput(c *gin.Context) (Input, bool) {
	var in Input
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

func (h *Handler) list(c *gin.Context) {
	list, err := List(c.Request.Context(), h.DB)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": list})
}

func (h *Handler) create(c *gin.Context) {
	in, ok := h.bindInput(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()
	id, err := Create(ctx, h.DB, in)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	s, err := Get(ctx, h.DB, id)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusCreated, s)
}

func (h *Handler) get(c *gin.Context) {
	id, ok := httpx.ParseID(c, "id")
	if !ok {
		return
	}
	s, err := Get(c.Request.Context(), h.DB, id)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusOK, s)
}

func (h *Handler) update(c *gin.Context) {
	id, ok := httpx.ParseID(c, "id")
	if !ok {
		return
	}
	in, ok := h.bindInput(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()
	if err := Update(ctx, h.DB, id, in); err != nil {
		httpx.Abort(c, err)
		return
	}
	s, err := Get(ctx, h.DB, id)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusOK, s)
}

func (h *Handler) delete(c *gin.Context) {
	id, ok := httpx.ParseID(c, "id")
	if !ok {
		return
	}
	if err := Delete(c.Request.Context(), h.DB, h.Storage, id); err != nil {
		httpx.Abort(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `make test`
Expected: all `ok`.

- [ ] **Step 7: Commit**

```bash
cd /Users/rado/projects/wedding-rentals
git add backend
git commit -m "feat(backend): add admin shop CRUD with aliases and unique slugs" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Dresses admin CRUD

**Files:**
- Create: `backend/internal/dresses/model.go`, `repo.go`, `handler.go`
- Test: `backend/internal/dresses/admin_test.go`

**Interfaces:**
- Consumes: `db.*`, `httpx.*`, `images.Image`, `images.ListForListing`, `images.PathsForListing`, `images.DeleteFiles`, `images.Storage`
- Produces: `dresses.Colors`, `dresses.Silhouettes`, `dresses.SleeveTypes`, `dresses.Sizes` (`[]string`), `dresses.Input` (JSON `shop_id, title, price_manat, price_is_from, description, is_published, color, silhouette, sleeves, sizes`), `dresses.Dress` (the same fields plus `id, images, created_at, updated_at`; `description` is `*string`), `dresses.Create(ctx, d, in) (int64, error)`, `dresses.Update(ctx, d, id, in) error`, `dresses.Get(ctx, d, id) (Dress, error)`, `dresses.ListAdmin(ctx, d, shopID int64) ([]Dress, error)` (shopID 0 = all), `dresses.Delete(ctx, d, st, id) error`, `dresses.Handler{DB db.DBTX; Storage images.Storage}` with `RegisterAdmin(g)` → `GET/POST /dresses`, `GET/PUT/DELETE /dresses/:id`

- [ ] **Step 1: Write the failing tests**

`backend/internal/dresses/admin_test.go`:
```go
package dresses_test

import (
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"

	"wedding-rentals/backend/internal/dresses"
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
	h := &dresses.Handler{DB: e.tx, Storage: images.LocalStorage{Dir: e.dir}}
	h.RegisterAdmin(e.r.Group("/api/admin"))
	h.RegisterPublic(e.r.Group("/api"))
	return e
}

func adminPath(id int64) string { return "/api/admin/dresses/" + strconv.FormatInt(id, 10) }

func validDress(shopID int64) map[string]any {
	return map[string]any{
		"shop_id": shopID, "title": " Princess A-112 ", "price_manat": 1500, "price_is_from": true,
		"color": "ivory", "silhouette": "ball_gown", "sleeves": "long", "sizes": []string{"M", "S", "M"},
	}
}

func TestCreateDress(t *testing.T) {
	e := setup(t)
	shop := testutil.InsertShop(t, e.tx, testutil.ShopFixture{})
	rec := testutil.Request(t, e.r, http.MethodPost, "/api/admin/dresses", validDress(shop.ID), "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body)
	}
	d := testutil.Decode[dresses.Dress](t, rec)
	if d.Title != "Princess A-112" || d.PriceManat != 1500 || !d.PriceIsFrom || d.Color != "ivory" || d.IsPublished {
		t.Fatalf("dress = %+v", d)
	}
	if !slices.Equal(d.Sizes, []string{"S", "M"}) || d.Images == nil || len(d.Images) != 0 {
		t.Fatalf("sizes = %q images = %v", d.Sizes, d.Images)
	}
}

func TestCreateDressValidation(t *testing.T) {
	e := setup(t)
	body := testutil.Decode[testutil.ErrorBody](t, testutil.Request(t, e.r, http.MethodPost, "/api/admin/dresses", map[string]any{}, ""))
	want := map[string]string{
		"shop_id": "required", "title": "required", "price_manat": "must_be_positive",
		"color": "invalid", "silhouette": "invalid", "sleeves": "invalid", "sizes": "required",
	}
	for f, v := range want {
		if body.Error.Fields[f] != v {
			t.Errorf("fields[%s] = %q, want %q", f, body.Error.Fields[f], v)
		}
	}
	in := validDress(999999999)
	in["sizes"] = []string{"M", "XXXL"}
	body = testutil.Decode[testutil.ErrorBody](t, testutil.Request(t, e.r, http.MethodPost, "/api/admin/dresses", in, ""))
	if body.Error.Fields["shop_id"] != "invalid" || body.Error.Fields["sizes"] != "invalid" {
		t.Fatalf("fields = %v", body.Error.Fields)
	}
}

func TestUpdateDress(t *testing.T) {
	e := setup(t)
	shop := testutil.InsertShop(t, e.tx, testutil.ShopFixture{})
	created := testutil.Decode[dresses.Dress](t, testutil.Request(t, e.r, http.MethodPost, "/api/admin/dresses", validDress(shop.ID), ""))
	in := validDress(shop.ID)
	in["price_manat"] = 2000
	in["color"] = "blush"
	in["is_published"] = true
	in["description"] = "Lace, long train"
	rec := testutil.Request(t, e.r, http.MethodPut, adminPath(created.ID), in, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body)
	}
	d := testutil.Decode[dresses.Dress](t, rec)
	if d.PriceManat != 2000 || d.Color != "blush" || !d.IsPublished || d.Description == nil || *d.Description != "Lace, long train" {
		t.Fatalf("dress = %+v", d)
	}
	if rec := testutil.Request(t, e.r, http.MethodPut, adminPath(999999999), in, ""); rec.Code != http.StatusNotFound {
		t.Fatalf("missing: %d", rec.Code)
	}
}

func TestListAdminFiltersByShop(t *testing.T) {
	e := setup(t)
	a := testutil.InsertShop(t, e.tx, testutil.ShopFixture{})
	b := testutil.InsertShop(t, e.tx, testutil.ShopFixture{})
	da := testutil.InsertDress(t, e.tx, testutil.DressFixture{ShopID: a.ID, Hidden: true})
	testutil.InsertDress(t, e.tx, testutil.DressFixture{ShopID: b.ID})
	rec := testutil.Request(t, e.r, http.MethodGet, "/api/admin/dresses?shop_id="+strconv.FormatInt(a.ID, 10), nil, "")
	list := testutil.Decode[struct{ Items []dresses.Dress }](t, rec)
	if len(list.Items) != 1 || list.Items[0].ID != da {
		t.Fatalf("items = %+v", list.Items)
	}
	if rec := testutil.Request(t, e.r, http.MethodGet, "/api/admin/dresses?shop_id=abc", nil, ""); rec.Code != http.StatusBadRequest {
		t.Fatalf("bad shop_id: %d", rec.Code)
	}
}

func TestDeleteDressRemovesFiles(t *testing.T) {
	e := setup(t)
	shop := testutil.InsertShop(t, e.tx, testutil.ShopFixture{})
	id := testutil.InsertDress(t, e.tx, testutil.DressFixture{ShopID: shop.ID})
	testutil.InsertImage(t, e.tx, id, 0, "d")
	_ = os.WriteFile(filepath.Join(e.dir, "d_s.jpg"), []byte("x"), 0o644)
	if rec := testutil.Request(t, e.r, http.MethodDelete, adminPath(id), nil, ""); rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d", rec.Code)
	}
	if _, err := os.Stat(filepath.Join(e.dir, "d_s.jpg")); !os.IsNotExist(err) {
		t.Fatal("file still exists")
	}
	if rec := testutil.Request(t, e.r, http.MethodGet, adminPath(id), nil, ""); rec.Code != http.StatusNotFound {
		t.Fatalf("get after delete: %d", rec.Code)
	}
}
```

- [ ] **Step 2: Run them to verify they fail**

Run: `make test`
Expected: FAIL, with `undefined: dresses.Handler`.

- [ ] **Step 3: Implement model.go**

`backend/internal/dresses/model.go`:
```go
package dresses

import (
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"wedding-rentals/backend/internal/images"
)

var (
	Colors      = []string{"white", "ivory", "champagne", "blush", "other"}
	Silhouettes = []string{"ball_gown", "a_line", "mermaid", "straight", "short"}
	SleeveTypes = []string{"long", "short", "none"}
	Sizes       = []string{"XS", "S", "M", "L", "XL", "XXL"}
)

type Input struct {
	ShopID      int64    `json:"shop_id"`
	Title       string   `json:"title"`
	PriceManat  int      `json:"price_manat"`
	PriceIsFrom bool     `json:"price_is_from"`
	Description string   `json:"description"`
	IsPublished bool     `json:"is_published"`
	Color       string   `json:"color"`
	Silhouette  string   `json:"silhouette"`
	Sleeves     string   `json:"sleeves"`
	Sizes       []string `json:"sizes"`
}

type Dress struct {
	ID          int64          `json:"id"`
	ShopID      int64          `json:"shop_id"`
	Title       string         `json:"title"`
	PriceManat  int            `json:"price_manat"`
	PriceIsFrom bool           `json:"price_is_from"`
	Description *string        `json:"description"`
	IsPublished bool           `json:"is_published"`
	Color       string         `json:"color"`
	Silhouette  string         `json:"silhouette"`
	Sleeves     string         `json:"sleeves"`
	Sizes       []string       `json:"sizes"`
	Images      []images.Image `json:"images"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

func (in *Input) normalize() {
	in.Title = strings.TrimSpace(in.Title)
	in.Description = strings.TrimSpace(in.Description)
}

func (in Input) validate() map[string]string {
	errs := map[string]string{}
	if in.ShopID <= 0 {
		errs["shop_id"] = "required"
	}
	if in.Title == "" {
		errs["title"] = "required"
	} else if utf8.RuneCountInString(in.Title) > 200 {
		errs["title"] = "too_long"
	}
	if in.PriceManat <= 0 {
		errs["price_manat"] = "must_be_positive"
	}
	if !slices.Contains(Colors, in.Color) {
		errs["color"] = "invalid"
	}
	if !slices.Contains(Silhouettes, in.Silhouette) {
		errs["silhouette"] = "invalid"
	}
	if !slices.Contains(SleeveTypes, in.Sleeves) {
		errs["sleeves"] = "invalid"
	}
	if len(in.Sizes) == 0 {
		errs["sizes"] = "required"
	}
	for _, s := range in.Sizes {
		if !slices.Contains(Sizes, s) {
			errs["sizes"] = "invalid"
		}
	}
	return errs
}

// canonicalSizes de-duplicates valid sizes and orders them XS..XXL.
func canonicalSizes(in []string) []string {
	out := []string{}
	for _, s := range Sizes {
		if slices.Contains(in, s) {
			out = append(out, s)
		}
	}
	return out
}

func nullIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
```

- [ ] **Step 4: Implement repo.go**

`backend/internal/dresses/repo.go`:
```go
package dresses

import (
	"context"

	"github.com/jackc/pgx/v5"

	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/images"
)

const selectAdmin = `
	SELECT l.id, l.shop_id, l.title, l.price_manat, l.price_is_from, l.description, l.is_published,
	       d.color, d.silhouette, d.sleeves, d.sizes, l.created_at, l.updated_at
	FROM listings l
	JOIN dress_details d ON d.listing_id = l.id`

func scanAdmin(row pgx.Row) (Dress, error) {
	var d Dress
	err := row.Scan(&d.ID, &d.ShopID, &d.Title, &d.PriceManat, &d.PriceIsFrom, &d.Description, &d.IsPublished,
		&d.Color, &d.Silhouette, &d.Sleeves, &d.Sizes, &d.CreatedAt, &d.UpdatedAt)
	return d, err
}

func Create(ctx context.Context, d db.DBTX, in Input) (int64, error) {
	var id int64
	err := db.InTx(ctx, d, func(tx pgx.Tx) error {
		err := tx.QueryRow(ctx, `
			INSERT INTO listings (shop_id, category_id, title, price_manat, price_is_from, description, is_published)
			VALUES ($1, (SELECT id FROM categories WHERE slug = 'dresses'), $2, $3, $4, $5, $6)
			RETURNING id`,
			in.ShopID, in.Title, in.PriceManat, in.PriceIsFrom, nullIfEmpty(in.Description), in.IsPublished).Scan(&id)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO dress_details (listing_id, color, silhouette, sleeves, sizes)
			VALUES ($1, $2, $3, $4, $5)`, id, in.Color, in.Silhouette, in.Sleeves, in.Sizes)
		return err
	})
	return id, err
}

func Update(ctx context.Context, d db.DBTX, id int64, in Input) error {
	return db.InTx(ctx, d, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `
			UPDATE listings SET shop_id = $2, title = $3, price_manat = $4, price_is_from = $5,
			       description = $6, is_published = $7, updated_at = now()
			WHERE id = $1 AND category_id = (SELECT id FROM categories WHERE slug = 'dresses')`,
			id, in.ShopID, in.Title, in.PriceManat, in.PriceIsFrom, nullIfEmpty(in.Description), in.IsPublished)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return pgx.ErrNoRows
		}
		_, err = tx.Exec(ctx, `
			UPDATE dress_details SET color = $2, silhouette = $3, sleeves = $4, sizes = $5, updated_at = now()
			WHERE listing_id = $1`, id, in.Color, in.Silhouette, in.Sleeves, in.Sizes)
		return err
	})
}

func Get(ctx context.Context, d db.DBTX, id int64) (Dress, error) {
	dress, err := scanAdmin(d.QueryRow(ctx, selectAdmin+` WHERE l.id = $1`, id))
	if err != nil {
		return Dress{}, err
	}
	dress.Images, err = images.ListForListing(ctx, d, id)
	return dress, err
}

// ListAdmin returns all dresses (published or not), optionally for one shop.
func ListAdmin(ctx context.Context, d db.DBTX, shopID int64) ([]Dress, error) {
	rows, err := d.Query(ctx, selectAdmin+` WHERE ($1::bigint = 0 OR l.shop_id = $1) ORDER BY l.created_at DESC, l.id DESC`, shopID)
	if err != nil {
		return nil, err
	}
	list := []Dress{}
	for rows.Next() {
		dress, err := scanAdmin(rows)
		if err != nil {
			rows.Close()
			return nil, err
		}
		list = append(list, dress)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i := range list {
		if list[i].Images, err = images.ListForListing(ctx, d, list[i].ID); err != nil {
			return nil, err
		}
	}
	return list, nil
}

func Delete(ctx context.Context, d db.DBTX, st images.Storage, id int64) error {
	paths, err := images.PathsForListing(ctx, d, id)
	if err != nil {
		return err
	}
	tag, err := d.Exec(ctx, `DELETE FROM listings WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	images.DeleteFiles(st, paths)
	return nil
}
```

- [ ] **Step 5: Implement handler.go (admin part, plus a public stub so the test file compiles)**

`backend/internal/dresses/handler.go`:
```go
package dresses

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/httpx"
	"wedding-rentals/backend/internal/images"
)

type Handler struct {
	DB      db.DBTX
	Storage images.Storage
}

func (h *Handler) RegisterAdmin(g *gin.RouterGroup) {
	g.GET("/dresses", h.listAdmin)
	g.POST("/dresses", h.create)
	g.GET("/dresses/:id", h.getAdmin)
	g.PUT("/dresses/:id", h.update)
	g.DELETE("/dresses/:id", h.delete)
}

// RegisterPublic is filled in by Task 9.
func (h *Handler) RegisterPublic(g *gin.RouterGroup) {}

func (h *Handler) bindInput(c *gin.Context) (Input, bool) {
	var in Input
	if !httpx.BindJSON(c, &in) {
		return in, false
	}
	in.normalize()
	errs := in.validate()
	if _, bad := errs["shop_id"]; !bad {
		var exists bool
		if err := h.DB.QueryRow(c.Request.Context(), `SELECT EXISTS(SELECT 1 FROM shops WHERE id = $1)`, in.ShopID).Scan(&exists); err != nil {
			httpx.Abort(c, err)
			return in, false
		}
		if !exists {
			errs["shop_id"] = "invalid"
		}
	}
	if len(errs) > 0 {
		httpx.Abort(c, httpx.Validation(errs))
		return in, false
	}
	in.Sizes = canonicalSizes(in.Sizes)
	return in, true
}

func (h *Handler) listAdmin(c *gin.Context) {
	var shopID int64
	if s := c.Query("shop_id"); s != "" {
		n, err := strconv.ParseInt(s, 10, 64)
		if err != nil || n <= 0 {
			httpx.Abort(c, httpx.Validation(map[string]string{"shop_id": "invalid"}))
			return
		}
		shopID = n
	}
	list, err := ListAdmin(c.Request.Context(), h.DB, shopID)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": list})
}

func (h *Handler) create(c *gin.Context) {
	in, ok := h.bindInput(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()
	id, err := Create(ctx, h.DB, in)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	d, err := Get(ctx, h.DB, id)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusCreated, d)
}

func (h *Handler) getAdmin(c *gin.Context) {
	id, ok := httpx.ParseID(c, "id")
	if !ok {
		return
	}
	d, err := Get(c.Request.Context(), h.DB, id)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusOK, d)
}

func (h *Handler) update(c *gin.Context) {
	id, ok := httpx.ParseID(c, "id")
	if !ok {
		return
	}
	in, ok := h.bindInput(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()
	if err := Update(ctx, h.DB, id, in); err != nil {
		httpx.Abort(c, err)
		return
	}
	d, err := Get(ctx, h.DB, id)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusOK, d)
}

func (h *Handler) delete(c *gin.Context) {
	id, ok := httpx.ParseID(c, "id")
	if !ok {
		return
	}
	if err := Delete(c.Request.Context(), h.DB, h.Storage, id); err != nil {
		httpx.Abort(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `make test`
Expected: all `ok`.

- [ ] **Step 7: Commit**

```bash
cd /Users/rado/projects/wedding-rentals
git add backend
git commit -m "feat(backend): add admin dress CRUD" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Public dress browsing, search, and the shop page

**Files:**
- Create: `backend/internal/dresses/filter.go`, `backend/internal/dresses/public.go`, `backend/internal/shops/public.go`
- Modify: `backend/internal/dresses/handler.go` (replace the `RegisterPublic` stub, add the public handlers)
- Modify: `backend/internal/shops/handler.go` (add `RegisterPublic`)
- Test: `backend/internal/dresses/public_test.go`, `backend/internal/shops/public_test.go`

**Interfaces:**
- Consumes: `textnorm.Norm`, `textnorm.EscapeLike`, `images.URL`, `images.ListForListing`, `images.Image`
- Produces: `dresses.Filter{City string; PriceMin, PriceMax int; Size, Color, Style, Sleeves, Q string; IDs []int64; ShopSlug string; Page, PerPage int}`, `dresses.ParseFilter(v url.Values) (Filter, map[string]string)`, `dresses.ListPublic(ctx, d, f Filter) (dresses.Page, error)`, `dresses.Page{Items []ListItem; Page, PerPage, Total int}` (JSON `items, page, per_page, total`), `dresses.ListItem{ID; Title; PriceManat; PriceIsFrom; Photo *string; Shop ShopRef; City CityRef}`, `dresses.ShopRef{Name, Slug}`, `dresses.CityRef{Slug, NameTK, NameRU, NameEN}` (JSON `slug, name_tk, name_ru, name_en`), `dresses.PublicDress{ID; Title; PriceManat; PriceIsFrom; Description *string; Color; Silhouette; Sleeves; Sizes; Images []images.Image; Shop ShopCard}`, `dresses.ShopCard{Name, Slug, Address, Phone string; InstagramURL, TikTokURL, Logo *string; City CityRef}`, `dresses.GetPublic(ctx, d, id) (PublicDress, error)`, public routes `GET /dresses`, `GET /dresses/:id`; `shops.PublicShop`, `shops.GetPublicBySlug(ctx, d, slug) (PublicShop, error)`, `(*shops.Handler).RegisterPublic(g)` → `GET /shops/:slug`

- [ ] **Step 1: Write the failing public dress tests**

`backend/internal/dresses/public_test.go`:
```go
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
		"":                         {c.d3, c.d2, c.d1},
		"city=mary":                {c.d3},
		"price_min=1000":           {c.d2, c.d1},
		"price_max=1500":           {c.d3, c.d1},
		"size=M":                   {c.d2, c.d1},
		"color=ivory":              {c.d2},
		"style=ball_gown":          {c.d1},
		"sleeves=short":            {c.d3},
		"city=ashgabat&size=S":     {c.d1},
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
	cases := map[string][]int64{
		"gelin+oyi": {c.d2, c.d1}, // Latin spelling of the Turkmen name
		"GELIN+%C3%96%C3%9DI": {c.d2, c.d1}, // "GELIN ÖÝI": case and Turkmen letters ignored
		"bridal":    {c.d2, c.d1}, // alias substring
		"gelim+oyi": {c.d2, c.d1}, // typo tolerance
		"mermaid":   {c.d2},       // dress title
		"secret":    {},           // hidden shop never matches
		"zzzzqqq":   {},
	}
	for q, want := range cases {
		p := testutil.Decode[dresses.Page](t, testutil.Request(t, e.r, http.MethodGet, "/api/dresses?q="+q, nil, ""))
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
	for _, q := range []string{"size=XXXL", "price_min=abc", "color=purple", "page=0", "ids=1,x"} {
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
```

- [ ] **Step 2: Run them to verify they fail**

Run: `make test`
Expected: FAIL, with `undefined: dresses.Page` / `dresses.PublicDress`.

- [ ] **Step 3: Implement filter.go**

`backend/internal/dresses/filter.go`:
```go
package dresses

import (
	"net/url"
	"slices"
	"strconv"
	"strings"
	"unicode/utf8"
)

const (
	defaultPerPage = 24
	maxPerPage     = 60
	maxIDs         = 100
)

type Filter struct {
	City     string
	PriceMin int
	PriceMax int
	Size     string
	Color    string
	Style    string // matches dress_details.silhouette
	Sleeves  string
	Q        string
	IDs      []int64
	ShopSlug string // set internally by the shop page, not a query param
	Page     int
	PerPage  int
}

func ParseFilter(v url.Values) (Filter, map[string]string) {
	f := Filter{
		City:    strings.TrimSpace(v.Get("city")),
		Size:    v.Get("size"),
		Color:   v.Get("color"),
		Style:   v.Get("style"),
		Sleeves: v.Get("sleeves"),
		Q:       strings.TrimSpace(v.Get("q")),
		Page:    1,
		PerPage: defaultPerPage,
	}
	errs := map[string]string{}
	intParam := func(key string, dst *int, min int) {
		if s := v.Get(key); s != "" {
			n, err := strconv.Atoi(s)
			if err != nil || n < min {
				errs[key] = "invalid"
				return
			}
			*dst = n
		}
	}
	intParam("price_min", &f.PriceMin, 0)
	intParam("price_max", &f.PriceMax, 0)
	intParam("page", &f.Page, 1)
	intParam("per_page", &f.PerPage, 1)
	f.PerPage = min(f.PerPage, maxPerPage)

	enum := func(key, val string, allowed []string) {
		if val != "" && !slices.Contains(allowed, val) {
			errs[key] = "invalid"
		}
	}
	enum("size", f.Size, Sizes)
	enum("color", f.Color, Colors)
	enum("style", f.Style, Silhouettes)
	enum("sleeves", f.Sleeves, SleeveTypes)

	if s := v.Get("ids"); s != "" {
		for _, part := range strings.Split(s, ",") {
			n, err := strconv.ParseInt(strings.TrimSpace(part), 10, 64)
			if err != nil || n <= 0 {
				errs["ids"] = "invalid"
				break
			}
			f.IDs = append(f.IDs, n)
		}
		if len(f.IDs) > maxIDs {
			errs["ids"] = "too_many"
		}
	}
	if utf8.RuneCountInString(f.Q) > 100 {
		errs["q"] = "too_long"
	}
	return f, errs
}
```

- [ ] **Step 4: Implement public.go**

`backend/internal/dresses/public.go`:
```go
package dresses

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/images"
	"wedding-rentals/backend/internal/textnorm"
)

type CityRef struct {
	Slug   string `json:"slug"`
	NameTK string `json:"name_tk"`
	NameRU string `json:"name_ru"`
	NameEN string `json:"name_en"`
}

type ShopRef struct {
	Name string `json:"name"`
	Slug string `json:"slug"`
}

type ListItem struct {
	ID          int64   `json:"id"`
	Title       string  `json:"title"`
	PriceManat  int     `json:"price_manat"`
	PriceIsFrom bool    `json:"price_is_from"`
	Photo       *string `json:"photo"`
	Shop        ShopRef `json:"shop"`
	City        CityRef `json:"city"`
}

type Page struct {
	Items   []ListItem `json:"items"`
	Page    int        `json:"page"`
	PerPage int        `json:"per_page"`
	Total   int        `json:"total"`
}

type ShopCard struct {
	Name         string  `json:"name"`
	Slug         string  `json:"slug"`
	Address      string  `json:"address"`
	Phone        string  `json:"phone"`
	InstagramURL *string `json:"instagram_url"`
	TikTokURL    *string `json:"tiktok_url"`
	Logo         *string `json:"logo"`
	City         CityRef `json:"city"`
}

type PublicDress struct {
	ID          int64          `json:"id"`
	Title       string         `json:"title"`
	PriceManat  int            `json:"price_manat"`
	PriceIsFrom bool           `json:"price_is_from"`
	Description *string        `json:"description"`
	Color       string         `json:"color"`
	Silhouette  string         `json:"silhouette"`
	Sleeves     string         `json:"sleeves"`
	Sizes       []string       `json:"sizes"`
	Images      []images.Image `json:"images"`
	Shop        ShopCard       `json:"shop"`
}

const publicFrom = `
	FROM listings l
	JOIN dress_details d ON d.listing_id = l.id
	JOIN shops s ON s.id = l.shop_id
	JOIN cities ci ON ci.id = s.city_id`

// buildWhere returns the WHERE clause, its args and the placeholder of the
// normalized search query ("" when there is no search).
func buildWhere(f Filter) (string, []any, string) {
	where := []string{"l.is_published", "s.is_published"}
	var args []any
	add := func(cond string, val any) {
		args = append(args, val)
		where = append(where, strings.ReplaceAll(cond, "?", "$"+strconv.Itoa(len(args))))
	}
	if f.City != "" {
		add("ci.slug = ?", f.City)
	}
	if f.PriceMin > 0 {
		add("l.price_manat >= ?", f.PriceMin)
	}
	if f.PriceMax > 0 {
		add("l.price_manat <= ?", f.PriceMax)
	}
	if f.Size != "" {
		add("? = ANY(d.sizes)", f.Size)
	}
	if f.Color != "" {
		add("d.color = ?", f.Color)
	}
	if f.Style != "" {
		add("d.silhouette = ?", f.Style)
	}
	if f.Sleeves != "" {
		add("d.sleeves = ?", f.Sleeves)
	}
	if len(f.IDs) > 0 {
		add("l.id = ANY(?)", f.IDs)
	}
	if f.ShopSlug != "" {
		add("s.slug = ?", f.ShopSlug)
	}
	qParam := ""
	if f.Q != "" {
		qn := textnorm.Norm(f.Q)
		args = append(args, qn, "%"+textnorm.EscapeLike(qn)+"%")
		qParam = "$" + strconv.Itoa(len(args)-1)
		like := "$" + strconv.Itoa(len(args))
		where = append(where, fmt.Sprintf(`(
			norm(l.title) %% %[1]s OR norm(s.name) %% %[1]s
			OR norm(l.title) LIKE %[2]s OR norm(s.name) LIKE %[2]s
			OR EXISTS (SELECT 1 FROM shop_aliases a WHERE a.shop_id = s.id
			           AND (norm(a.alias) %% %[1]s OR norm(a.alias) LIKE %[2]s)))`, qParam, like))
	}
	return " WHERE " + strings.Join(where, " AND "), args, qParam
}

func orderBy(qParam string) string {
	if qParam == "" {
		return " ORDER BY l.created_at DESC, l.id DESC"
	}
	return fmt.Sprintf(` ORDER BY GREATEST(
		similarity(norm(l.title), %[1]s),
		similarity(norm(s.name), %[1]s),
		COALESCE((SELECT max(similarity(norm(a.alias), %[1]s)) FROM shop_aliases a WHERE a.shop_id = s.id), 0)
	) DESC, l.created_at DESC, l.id DESC`, qParam)
}

func ListPublic(ctx context.Context, dbx db.DBTX, f Filter) (Page, error) {
	where, args, qParam := buildWhere(f)
	page := Page{Items: []ListItem{}, Page: f.Page, PerPage: f.PerPage}
	if err := dbx.QueryRow(ctx, `SELECT count(*)`+publicFrom+where, args...).Scan(&page.Total); err != nil {
		return Page{}, err
	}
	args = append(args, f.PerPage, (f.Page-1)*f.PerPage)
	sql := `SELECT l.id, l.title, l.price_manat, l.price_is_from,
		       (SELECT i.path_small FROM images i WHERE i.listing_id = l.id ORDER BY i.position, i.id LIMIT 1),
		       s.name, s.slug, ci.slug, ci.name_tk, ci.name_ru, ci.name_en` +
		publicFrom + where + orderBy(qParam) +
		fmt.Sprintf(" LIMIT $%d OFFSET $%d", len(args)-1, len(args))
	rows, err := dbx.Query(ctx, sql, args...)
	if err != nil {
		return Page{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var it ListItem
		var photo *string
		if err := rows.Scan(&it.ID, &it.Title, &it.PriceManat, &it.PriceIsFrom, &photo,
			&it.Shop.Name, &it.Shop.Slug, &it.City.Slug, &it.City.NameTK, &it.City.NameRU, &it.City.NameEN); err != nil {
			return Page{}, err
		}
		if photo != nil {
			u := images.URL(*photo)
			it.Photo = &u
		}
		page.Items = append(page.Items, it)
	}
	return page, rows.Err()
}

func GetPublic(ctx context.Context, dbx db.DBTX, id int64) (PublicDress, error) {
	var d PublicDress
	var logo *string
	err := dbx.QueryRow(ctx, `
		SELECT l.id, l.title, l.price_manat, l.price_is_from, l.description,
		       d.color, d.silhouette, d.sleeves, d.sizes,
		       s.name, s.slug, s.address, s.phone, s.instagram_url, s.tiktok_url,
		       (SELECT path_small FROM images WHERE id = s.logo_image_id),
		       ci.slug, ci.name_tk, ci.name_ru, ci.name_en`+publicFrom+`
		WHERE l.id = $1 AND l.is_published AND s.is_published`, id).Scan(
		&d.ID, &d.Title, &d.PriceManat, &d.PriceIsFrom, &d.Description,
		&d.Color, &d.Silhouette, &d.Sleeves, &d.Sizes,
		&d.Shop.Name, &d.Shop.Slug, &d.Shop.Address, &d.Shop.Phone, &d.Shop.InstagramURL, &d.Shop.TikTokURL,
		&logo, &d.Shop.City.Slug, &d.Shop.City.NameTK, &d.Shop.City.NameRU, &d.Shop.City.NameEN)
	if err != nil {
		return PublicDress{}, err
	}
	if logo != nil {
		u := images.URL(*logo)
		d.Shop.Logo = &u
	}
	d.Images, err = images.ListForListing(ctx, dbx, id)
	return d, err
}
```

- [ ] **Step 5: Wire the public dress routes**

In `backend/internal/dresses/handler.go`, replace the stub

```go
// RegisterPublic is filled in by Task 9.
func (h *Handler) RegisterPublic(g *gin.RouterGroup) {}
```

with:

```go
func (h *Handler) RegisterPublic(g *gin.RouterGroup) {
	g.GET("/dresses", h.listPublic)
	g.GET("/dresses/:id", h.getPublic)
}

func (h *Handler) listPublic(c *gin.Context) {
	f, errs := ParseFilter(c.Request.URL.Query())
	if len(errs) > 0 {
		httpx.Abort(c, httpx.Validation(errs))
		return
	}
	page, err := ListPublic(c.Request.Context(), h.DB, f)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusOK, page)
}

func (h *Handler) getPublic(c *gin.Context) {
	id, ok := httpx.ParseID(c, "id")
	if !ok {
		return
	}
	d, err := GetPublic(c.Request.Context(), h.DB, id)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusOK, d)
}
```

- [ ] **Step 6: Run the dress tests to verify they pass**

Run: `make test`
Expected: `internal/dresses` is `ok`. (If `q=gelim+oyi` fails, print `SELECT similarity('gelim oyi','gelin oyi')`; it should be ≈0.54, above the default 0.3 threshold.)

- [ ] **Step 7: Write the failing public shop test**

`backend/internal/shops/public_test.go`:
```go
package shops_test

import (
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"

	"wedding-rentals/backend/internal/images"
	"wedding-rentals/backend/internal/shops"
	"wedding-rentals/backend/internal/testutil"
)

func TestGetPublicShop(t *testing.T) {
	tx := testutil.Tx(t)
	r := gin.New()
	(&shops.Handler{DB: tx, Storage: images.LocalStorage{Dir: t.TempDir()}}).RegisterPublic(r.Group("/api"))

	shop := testutil.InsertShop(t, tx, testutil.ShopFixture{Name: "Gelin Öýi", CitySlug: "mary"})
	testutil.InsertDress(t, tx, testutil.DressFixture{ShopID: shop.ID, Title: "One"})
	testutil.InsertDress(t, tx, testutil.DressFixture{ShopID: shop.ID, Title: "Two"})
	testutil.InsertDress(t, tx, testutil.DressFixture{ShopID: shop.ID, Title: "Draft", Hidden: true})
	hidden := testutil.InsertShop(t, tx, testutil.ShopFixture{Hidden: true})

	rec := testutil.Request(t, r, http.MethodGet, "/api/shops/"+shop.Slug, nil, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body)
	}
	s := testutil.Decode[shops.PublicShop](t, rec)
	if s.Name != "Gelin Öýi" || s.City.Slug != "mary" || s.Dresses.Total != 2 || len(s.Dresses.Items) != 2 {
		t.Fatalf("shop = %+v", s)
	}
	for _, slug := range []string{hidden.Slug, "no-such-shop"} {
		if rec := testutil.Request(t, r, http.MethodGet, "/api/shops/"+slug, nil, ""); rec.Code != http.StatusNotFound {
			t.Errorf("%s: status = %d", slug, rec.Code)
		}
	}
}
```

- [ ] **Step 8: Run it to verify it fails**

Run: `make test`
Expected: FAIL in `internal/shops`, with `undefined: shops.PublicShop`.

- [ ] **Step 9: Implement shops/public.go and register the route**

`backend/internal/shops/public.go`:
```go
package shops

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"

	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/dresses"
	"wedding-rentals/backend/internal/httpx"
	"wedding-rentals/backend/internal/images"
)

type PublicShop struct {
	Name         string          `json:"name"`
	Slug         string          `json:"slug"`
	Address      string          `json:"address"`
	Phone        string          `json:"phone"`
	InstagramURL *string         `json:"instagram_url"`
	TikTokURL    *string         `json:"tiktok_url"`
	Description  *string         `json:"description"`
	Logo         *string         `json:"logo"`
	City         dresses.CityRef `json:"city"`
	Dresses      dresses.Page    `json:"dresses"`
}

func GetPublicBySlug(ctx context.Context, d db.DBTX, slug string) (PublicShop, error) {
	var s PublicShop
	var logo *string
	err := d.QueryRow(ctx, `
		SELECT s.name, s.slug, s.address, s.phone, s.instagram_url, s.tiktok_url, s.description,
		       (SELECT path_small FROM images WHERE id = s.logo_image_id),
		       ci.slug, ci.name_tk, ci.name_ru, ci.name_en
		FROM shops s JOIN cities ci ON ci.id = s.city_id
		WHERE s.slug = $1 AND s.is_published`, slug).Scan(
		&s.Name, &s.Slug, &s.Address, &s.Phone, &s.InstagramURL, &s.TikTokURL, &s.Description,
		&logo, &s.City.Slug, &s.City.NameTK, &s.City.NameRU, &s.City.NameEN)
	if err != nil {
		return PublicShop{}, err
	}
	if logo != nil {
		u := images.URL(*logo)
		s.Logo = &u
	}
	return s, nil
}

func (h *Handler) RegisterPublic(g *gin.RouterGroup) {
	g.GET("/shops/:slug", h.getPublic)
}

// getPublic returns the shop and a page of its published dresses
// (supports the same query params as GET /dresses).
func (h *Handler) getPublic(c *gin.Context) {
	f, errs := dresses.ParseFilter(c.Request.URL.Query())
	if len(errs) > 0 {
		httpx.Abort(c, httpx.Validation(errs))
		return
	}
	ctx := c.Request.Context()
	s, err := GetPublicBySlug(ctx, h.DB, c.Param("slug"))
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	f.ShopSlug = s.Slug
	if s.Dresses, err = dresses.ListPublic(ctx, h.DB, f); err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusOK, s)
}
```

- [ ] **Step 10: Run all the tests to verify they pass**

Run: `make test`
Expected: all packages `ok`.

- [ ] **Step 11: Commit**

```bash
cd /Users/rado/projects/wedding-rentals
git add backend
git commit -m "feat(backend): add public dress browsing, multilingual search and shop page" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Web serving with Open Graph tags, server wiring, and main

**Files:**
- Create: `backend/internal/web/web.go`, `backend/internal/server/server.go`, `backend/cmd/server/main.go`
- Test: `backend/internal/web/web_test.go`, `backend/internal/server/server_test.go`

**Interfaces:**
- Consumes: all of the above; `dresses.GetPublic` for OG tags
- Produces: `web.Handler{Dir string; DB db.DBTX; BaseURL string}` with `Serve(c *gin.Context)` (used as `NoRoute`), `server.Deps{DB db.DBTX; Tokens *auth.Tokens; Limiter *auth.Limiter; Storage images.Storage; UploadDir, WebDir, BaseURL string}`, `server.New(d server.Deps) *gin.Engine`

- [ ] **Step 1: Write the failing web test**

`backend/internal/web/web_test.go`:
```go
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `make test`
Expected: FAIL, with `undefined: web.Handler`.

- [ ] **Step 3: Implement web.go**

`backend/internal/web/web.go`:
```go
package web

import (
	"bytes"
	"context"
	"fmt"
	"html"
	"io/fs"
	"net/http"
	"os"
	"path"
	"regexp"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/dresses"
	"wedding-rentals/backend/internal/httpx"
)

// Handler serves the built SPA: real files as-is, every other GET gets
// index.html. Dress pages get Open Graph tags for link previews.
type Handler struct {
	Dir     string
	DB      db.DBTX
	BaseURL string
}

var dressPath = regexp.MustCompile(`^/dresses/(\d+)/?$`)

func (h *Handler) Serve(c *gin.Context) {
	p := c.Request.URL.Path
	if p == "/api" || strings.HasPrefix(p, "/api/") ||
		(c.Request.Method != http.MethodGet && c.Request.Method != http.MethodHead) {
		httpx.Abort(c, httpx.ErrNotFound)
		return
	}
	fsys := os.DirFS(h.Dir)
	name := strings.TrimPrefix(path.Clean("/"+p), "/")
	if name != "" && name != "index.html" {
		if st, err := fs.Stat(fsys, name); err == nil && !st.IsDir() {
			c.FileFromFS(name, http.FS(fsys))
			return
		}
	}
	index, err := fs.ReadFile(fsys, "index.html")
	if err != nil {
		c.String(http.StatusNotFound, "frontend not built: run the frontend build first")
		return
	}
	if m := dressPath.FindStringSubmatch(p); m != nil {
		if id, err := strconv.ParseInt(m[1], 10, 64); err == nil {
			index = h.injectOG(c.Request.Context(), index, id)
		}
	}
	c.Data(http.StatusOK, "text/html; charset=utf-8", index)
}

func (h *Handler) injectOG(ctx context.Context, index []byte, id int64) []byte {
	d, err := dresses.GetPublic(ctx, h.DB, id)
	if err != nil {
		return index
	}
	var b strings.Builder
	meta := func(prop, content string) {
		fmt.Fprintf(&b, `<meta property="%s" content="%s">`+"\n", prop, html.EscapeString(content))
	}
	meta("og:type", "product")
	meta("og:title", d.Title+" · "+d.Shop.Name)
	meta("og:description", fmt.Sprintf("%d TMT · %s", d.PriceManat, d.Shop.City.NameTK))
	meta("og:url", h.BaseURL+"/dresses/"+strconv.FormatInt(id, 10))
	if len(d.Images) > 0 {
		meta("og:image", h.BaseURL+d.Images[0].Large)
	}
	return bytes.Replace(index, []byte("</head>"), []byte(b.String()+"</head>"), 1)
}
```

- [ ] **Step 4: Run the web tests to verify they pass**

Run: `make test`
Expected: `internal/web` is `ok`.

- [ ] **Step 5: Write the failing server test**

`backend/internal/server/server_test.go`:
```go
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
```

- [ ] **Step 6: Run it to verify it fails**

Run: `make test`
Expected: FAIL, with `undefined: server.New`.

- [ ] **Step 7: Implement server.go and main.go**

`backend/internal/server/server.go`:
```go
package server

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"wedding-rentals/backend/internal/auth"
	"wedding-rentals/backend/internal/cities"
	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/dresses"
	"wedding-rentals/backend/internal/httpx"
	"wedding-rentals/backend/internal/images"
	"wedding-rentals/backend/internal/shops"
	"wedding-rentals/backend/internal/web"
)

type Deps struct {
	DB        db.DBTX
	Tokens    *auth.Tokens
	Limiter   *auth.Limiter
	Storage   images.Storage
	UploadDir string
	WebDir    string
	BaseURL   string
}

func New(d Deps) *gin.Engine {
	r := gin.New()
	r.Use(gin.Logger(), httpx.Recovery())
	_ = r.SetTrustedProxies(nil)
	r.MaxMultipartMemory = 16 << 20

	api := r.Group("/api")
	api.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })

	authH := &auth.Handler{DB: d.DB, Tokens: d.Tokens, Limiter: d.Limiter}
	citiesH := &cities.Handler{DB: d.DB}
	shopsH := &shops.Handler{DB: d.DB, Storage: d.Storage}
	dressesH := &dresses.Handler{DB: d.DB, Storage: d.Storage}
	imagesH := &images.Handler{DB: d.DB, Storage: d.Storage}

	authH.RegisterPublic(api)
	citiesH.RegisterPublic(api)
	shopsH.RegisterPublic(api)
	dressesH.RegisterPublic(api)

	admin := api.Group("/admin", auth.Middleware(d.Tokens))
	shopsH.RegisterAdmin(admin)
	dressesH.RegisterAdmin(admin)
	imagesH.RegisterAdmin(admin)

	r.Static("/uploads", d.UploadDir)
	webH := &web.Handler{Dir: d.WebDir, DB: d.DB, BaseURL: d.BaseURL}
	r.NoRoute(webH.Serve)
	return r
}
```

`backend/cmd/server/main.go`:
```go
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"wedding-rentals/backend/internal/auth"
	"wedding-rentals/backend/internal/config"
	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/images"
	"wedding-rentals/backend/internal/server"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	ctx := context.Background()
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	if err := os.MkdirAll(cfg.UploadDir, 0o755); err != nil {
		log.Fatal(err)
	}
	r := server.New(server.Deps{
		DB:        pool,
		Tokens:    auth.NewTokens(cfg.JWTSecret, auth.TokenTTL),
		Limiter:   auth.NewLimiter(5, time.Minute),
		Storage:   images.LocalStorage{Dir: cfg.UploadDir},
		UploadDir: cfg.UploadDir,
		WebDir:    cfg.WebDir,
		BaseURL:   cfg.BaseURL,
	})
	srv := &http.Server{Addr: ":" + cfg.Port, Handler: r, ReadHeaderTimeout: 10 * time.Second}
	log.Printf("listening on http://localhost:%s", cfg.Port)
	log.Fatal(srv.ListenAndServe())
}
```

- [ ] **Step 8: Run all the tests to verify they pass**

Run: `go mod tidy && go vet ./... && make test`
Expected: `go vet` prints nothing, and every package is `ok`.

- [ ] **Step 9: Smoke-test the real server**

In one terminal: `cd backend && make run`
Expected log: `listening on http://localhost:8080`

In another terminal:
```bash
cd /Users/rado/projects/wedding-rentals/backend
curl -s localhost:8080/api/health
printf 'super-secret-1\n' | make admin EMAIL=dev@example.com
curl -s -X POST localhost:8080/api/admin/login -H 'Content-Type: application/json' \
  -d '{"email":"dev@example.com","password":"super-secret-1"}'
curl -s localhost:8080/api/cities | head -c 120
```
Expected: `{"status":"ok"}`, then `created admin #1 (dev@example.com)`, then `{"token":"eyJ..."}`, then JSON that starts with `{"items":[{"id":1,"slug":"ashgabat"`. Stop the server with Ctrl+C afterwards.

- [ ] **Step 10: Commit**

```bash
cd /Users/rado/projects/wedding-rentals
git add backend
git commit -m "feat(backend): serve SPA with Open Graph tags and wire the HTTP server" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Spec coverage (self-check)

| Spec section | Task |
|---|---|
| §3 stack, §4 structure (backend) | 1, 2, 10 |
| §5 data model incl. future `owner_user_id`, CHECK enums, image owner check | 2 |
| §6 search (pg_trgm, norm, aliases, typo, ordering) | 2, 3, 9 |
| §7 public API (cities, dresses list/detail, shop page, `ids`) | 5, 9 |
| §7 admin API (login, rate limit, shops, dresses, images, order, delete) | 4, 6, 7, 8 |
| §7 slugs | 3, 7 |
| §4 production serving + OG tags | 10 |
| §9 error handling (format, recovery, 409, 413, 422, file cleanup) | 1, 6, 7, 8 |
| §10 backend tests | every task |
| §8 frontend, PWA, i18n, frontend tests | **Plan 2 (frontend)** |
