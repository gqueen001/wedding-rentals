# Dress Availability Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins mark single busy days per dress, and brides see a read-only month calendar of those days on each dress page.

**Architecture:**
- **Backend:** a new Go package `internal/busydays` holds:
  - the time window (today in Turkmenistan through 12 months ahead);
  - the repository functions for a new `listing_busy_days` table;
  - the public and admin handlers.
  It is wired into the existing server.
- **Frontend:** a pure, tested `src/lib/calendar.ts` builds the month grids. One `MonthCalendar` component serves both modes: read-only on the dress page (`Availability`) and tappable in the admin dress editor (`AvailabilityEditor`).

**Tech Stack:** Go 1.27 with Gin, pgx v5, goose migrations and PostgreSQL 17 (backend); Solid 1.9, Vite 7, Tailwind 4 and Deno 2.4 (frontend). There are no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-20-dress-availability-calendar-design.md`

## Global Constraints

- **Window:** busy days are shown and accepted only inside the window, from = today in Turkmenistan to = today + 12 months (Go `AddDate(0, 12, 0)`), both inclusive.
  - Turkmenistan is a fixed UTC+5 with no daylight saving time.
  - The server returns `from` and `to`, and the frontend uses those instead of its own clock.
- **Days:**
  - Days are `YYYY-MM-DD` strings everywhere.
  - A day is only busy or free: there are no notes and no customer data.
- **Visibility:** the public endpoint follows the v1 rule. It answers 404 `not_found` unless the listing is a dress (it has `dress_details`) and both it and its shop are published. Admin endpoints work for any existing dress.
- **Errors:** they use the existing envelope `{"error":{"code","message","fields?"}}`.
  - A bad `:day` gives 400 `validation_failed` with `fields.day` = `"invalid"` (not a real date) or `"out_of_range"` (outside the window).
  - PUT and DELETE are idempotent and return 204.
- **Text:**
  - Every user-visible string goes through `frontend/src/i18n/{tk,ru,en}.json`. The three files must have identical keys and placeholders, which a test enforces.
  - Month and weekday names come from those files, never from `Intl`.
- **Calendar layout:**
  - Weeks start on Monday.
  - Brides see busy days in `bg-blush text-garnet-deep line-through`, past and out-of-window days faded (`text-silver`), and today with a `ring-1 ring-garnet`.
  - Use Gyrmyzy tokens only: no new colors, shadows or gradients.
- **Keyboard focus:** focus is never lost. A control that becomes unavailable while focused (the month arrows at the ends, a day being saved) uses `aria-disabled` and ignores clicks. It must not use `disabled`, because a focused button that becomes disabled drops focus to `<body>`.
- **Backend tests:** Go tests run against the real test database through `internal/testutil`. Run them from `backend/` with `set -a; . ./.env; set +a` and then `GOPROXY=off go test -count=1 ./internal/<pkg>/`. `proxy.golang.org` is DNS-blocked on this network.
- **Frontend tests:** frontend tools run only through Deno from `frontend/`: `deno task test`, `deno task check` and `deno task build`.
- **Commits:** every commit message ends with the `Co-Authored-By:` trailer line the controller gives you.

## File Map

```
backend/migrations/00003_busy_days.sql      listing_busy_days table
backend/internal/busydays/window.go         Window, WindowAt, Contains, ParseDay
backend/internal/busydays/repo.go           dressExists, List, Mark, Unmark
backend/internal/busydays/handler.go        Handler, Response, routes
backend/internal/busydays/busydays_test.go  window, validation, visibility, idempotency, cascade
backend/internal/server/server.go           (modify) register the handler
backend/internal/server/server_test.go      (modify) route wiring and 401
frontend/src/lib/types.ts                   (modify) BusyDays
frontend/src/lib/calendar.ts                dayKey, parseDayKey, daysInMonth, monthGrid, monthsInWindow, isInWindow
frontend/src/lib/calendar_test.ts
frontend/src/lib/api.ts                     (modify) busyDays, admin.busyDays, admin.markBusy, admin.markFree
frontend/src/lib/api_test.ts                (modify) tests for the four methods
frontend/src/i18n/{en,ru,tk}.json           (modify) cal.* and avail.* keys, field.out_of_range
frontend/src/i18n/i18n_test.ts              (modify) month and weekday names, out_of_range
frontend/src/components/MonthCalendar.tsx   dayLabel, MonthCalendar (view and edit)
frontend/src/components/Availability.tsx    dress-page section
frontend/src/pages/Dress.tsx                (modify) add the section
frontend/src/components/admin/AvailabilityEditor.tsx  admin section
frontend/src/pages/admin/DressEdit.tsx      (modify) add the section
```

---

### Task 1: Backend busy days: table, window, API and wiring

**Files:**
- Create: `backend/migrations/00003_busy_days.sql`, `backend/internal/busydays/window.go`, `backend/internal/busydays/repo.go`, `backend/internal/busydays/handler.go`
- Test: `backend/internal/busydays/busydays_test.go`
- Modify: `backend/internal/server/server.go`, `backend/internal/server/server_test.go`

**Interfaces:**
- Consumes:
  - `db.DBTX`
  - `httpx.ParseID(c, "id") (int64, bool)`, `httpx.Abort(c, err)`, `httpx.Validation(map[string]string)`, `httpx.ErrNotFound`
  - `testutil.Tx`, `testutil.Request`, `testutil.Decode`, `testutil.ErrorBody`, `testutil.InsertShop`, `testutil.InsertDress`, `testutil.ShopFixture{Hidden}`, `testutil.DressFixture{ShopID, Hidden}`
- Produces:
  - `busydays.Window{From, To time.Time}`, `busydays.WindowAt(now time.Time) Window`, `Window.Contains(day time.Time) bool`
  - `busydays.ParseDay(s string) (time.Time, bool)`
  - `busydays.List(ctx, d, listingID int64, w Window) ([]string, error)`, `busydays.Mark(ctx, d, listingID int64, day time.Time) error`, `busydays.Unmark(...)` with the same signature as `Mark`
  - `busydays.Handler{DB db.DBTX; Now func() time.Time}` with `RegisterPublic(g)` and `RegisterAdmin(g)`
  - `busydays.Response{From, To string; Days []string}`, with JSON fields `from`, `to` and `days`
  - Routes:
    - `GET /api/dresses/:id/busy-days`
    - `GET /api/admin/dresses/:id/busy-days`
    - `PUT /api/admin/dresses/:id/busy-days/:day`
    - `DELETE /api/admin/dresses/:id/busy-days/:day`

- [ ] **Step 1: Add the migration**

`backend/migrations/00003_busy_days.sql`:
```sql
-- +goose Up
CREATE TABLE listing_busy_days (
  listing_id bigint NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  day        date   NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_id, day)
);

-- +goose Down
DROP TABLE IF EXISTS listing_busy_days;
```
Migrations are embedded (`migrations/embed.go` uses `//go:embed *.sql`). The test harness applies them on its first connection, so no other wiring is needed.

- [ ] **Step 2: Write the failing tests**

`backend/internal/busydays/busydays_test.go`:
```go
package busydays_test

import (
	"context"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"

	"wedding-rentals/backend/internal/busydays"
	"wedding-rentals/backend/internal/testutil"
)

// 2026-10-20 10:00 UTC is 15:00 the same day in Turkmenistan.
var now = time.Date(2026, 10, 20, 10, 0, 0, 0, time.UTC)

type env struct {
	r  *gin.Engine
	tx pgx.Tx
}

func setup(t *testing.T) env {
	e := env{r: gin.New(), tx: testutil.Tx(t)}
	h := &busydays.Handler{DB: e.tx, Now: func() time.Time { return now }}
	h.RegisterPublic(e.r.Group("/api"))
	h.RegisterAdmin(e.r.Group("/api/admin"))
	return e
}

func path(prefix string, id int64, day string) string {
	p := prefix + "/dresses/" + strconv.FormatInt(id, 10) + "/busy-days"
	if day != "" {
		p += "/" + day
	}
	return p
}

func mustDay(t *testing.T, s string) time.Time {
	t.Helper()
	d, ok := busydays.ParseDay(s)
	if !ok {
		t.Fatalf("bad day %q", s)
	}
	return d
}

func newDress(t *testing.T, tx pgx.Tx) int64 {
	shop := testutil.InsertShop(t, tx, testutil.ShopFixture{})
	return testutil.InsertDress(t, tx, testutil.DressFixture{ShopID: shop.ID})
}

func TestWindowAt(t *testing.T) {
	cases := []struct {
		now      time.Time
		from, to string
	}{
		{now, "2026-10-20", "2027-10-20"},
		// 19:30 UTC is already 00:30 the next day in Turkmenistan (UTC+5).
		{time.Date(2026, 10, 19, 19, 30, 0, 0, time.UTC), "2026-10-20", "2027-10-20"},
		{time.Date(2026, 10, 19, 18, 59, 0, 0, time.UTC), "2026-10-19", "2027-10-19"},
		// A leap day rolls over to 1 March a year later.
		{time.Date(2028, 2, 29, 12, 0, 0, 0, time.UTC), "2028-02-29", "2029-03-01"},
	}
	for _, c := range cases {
		w := busydays.WindowAt(c.now)
		if got := w.From.Format("2006-01-02"); got != c.from {
			t.Errorf("%v: from = %s, want %s", c.now, got, c.from)
		}
		if got := w.To.Format("2006-01-02"); got != c.to {
			t.Errorf("%v: to = %s, want %s", c.now, got, c.to)
		}
	}
}

func TestParseDay(t *testing.T) {
	for _, s := range []string{"2026-11-14", "2028-02-29"} {
		if _, ok := busydays.ParseDay(s); !ok {
			t.Errorf("%q rejected", s)
		}
	}
	for _, s := range []string{"", "abc", "2026-1-5", "2026-02-30", "2027-02-29", "2026-11-14T00:00:00Z", "14.11.2026"} {
		if _, ok := busydays.ParseDay(s); ok {
			t.Errorf("%q accepted", s)
		}
	}
}

func TestPublicFollowsVisibility(t *testing.T) {
	e := setup(t)
	shop := testutil.InsertShop(t, e.tx, testutil.ShopFixture{})
	hidden := testutil.InsertShop(t, e.tx, testutil.ShopFixture{Hidden: true})
	visible := testutil.InsertDress(t, e.tx, testutil.DressFixture{ShopID: shop.ID})
	draft := testutil.InsertDress(t, e.tx, testutil.DressFixture{ShopID: shop.ID, Hidden: true})
	inHidden := testutil.InsertDress(t, e.tx, testutil.DressFixture{ShopID: hidden.ID})

	if rec := testutil.Request(t, e.r, http.MethodGet, path("/api", visible, ""), nil, ""); rec.Code != http.StatusOK {
		t.Fatalf("visible: status = %d: %s", rec.Code, rec.Body)
	}
	for name, id := range map[string]int64{"draft dress": draft, "hidden shop": inHidden, "missing": 999999999} {
		if rec := testutil.Request(t, e.r, http.MethodGet, path("/api", id, ""), nil, ""); rec.Code != http.StatusNotFound {
			t.Errorf("%s: status = %d, want 404", name, rec.Code)
		}
	}
	if rec := testutil.Request(t, e.r, http.MethodGet, "/api/dresses/abc/busy-days", nil, ""); rec.Code != http.StatusNotFound {
		t.Errorf("non-numeric id: status = %d, want 404", rec.Code)
	}
	// Admins see the calendar of a draft too.
	if rec := testutil.Request(t, e.r, http.MethodGet, path("/api/admin", draft, ""), nil, ""); rec.Code != http.StatusOK {
		t.Errorf("admin draft: status = %d, want 200", rec.Code)
	}
}

func TestListReturnsOnlyWindowDaysSorted(t *testing.T) {
	e := setup(t)
	dress := newDress(t, e.tx)
	for _, s := range []string{"2026-12-31", "2026-10-19", "2026-11-14", "2027-10-21", "2026-10-20", "2027-10-20"} {
		if err := busydays.Mark(context.Background(), e.tx, dress, mustDay(t, s)); err != nil {
			t.Fatal(err)
		}
	}
	got := testutil.Decode[busydays.Response](t, testutil.Request(t, e.r, http.MethodGet, path("/api", dress, ""), nil, ""))
	want := []string{"2026-10-20", "2026-11-14", "2026-12-31", "2027-10-20"}
	if got.From != "2026-10-20" || got.To != "2027-10-20" || !slices.Equal(got.Days, want) {
		t.Fatalf("got %+v, want from 2026-10-20 to 2027-10-20 days %v", got, want)
	}
}

func TestEmptyCalendarIsAnEmptyList(t *testing.T) {
	e := setup(t)
	rec := testutil.Request(t, e.r, http.MethodGet, path("/api", newDress(t, e.tx), ""), nil, "")
	if !strings.Contains(rec.Body.String(), `"days":[]`) {
		t.Fatalf("body = %s, want days as an empty list", rec.Body)
	}
}

func TestMarkAndUnmarkAreIdempotent(t *testing.T) {
	e := setup(t)
	dress := newDress(t, e.tx)
	days := func() []string {
		return testutil.Decode[busydays.Response](t, testutil.Request(t, e.r, http.MethodGet, path("/api/admin", dress, ""), nil, "")).Days
	}
	for i := 0; i < 2; i++ {
		if rec := testutil.Request(t, e.r, http.MethodPut, path("/api/admin", dress, "2026-11-14"), nil, ""); rec.Code != http.StatusNoContent {
			t.Fatalf("PUT #%d: status = %d: %s", i+1, rec.Code, rec.Body)
		}
	}
	if got := days(); !slices.Equal(got, []string{"2026-11-14"}) {
		t.Fatalf("after PUT: days = %v", got)
	}
	for i := 0; i < 2; i++ {
		if rec := testutil.Request(t, e.r, http.MethodDelete, path("/api/admin", dress, "2026-11-14"), nil, ""); rec.Code != http.StatusNoContent {
			t.Fatalf("DELETE #%d: status = %d: %s", i+1, rec.Code, rec.Body)
		}
	}
	if got := days(); len(got) != 0 {
		t.Fatalf("after DELETE: days = %v", got)
	}
}

func TestDayValidation(t *testing.T) {
	e := setup(t)
	dress := newDress(t, e.tx)
	cases := map[string]struct {
		code  int
		field string
	}{
		"2026-11-31": {http.StatusBadRequest, "invalid"},
		"14-11-2026": {http.StatusBadRequest, "invalid"},
		"tomorrow":   {http.StatusBadRequest, "invalid"},
		"2026-10-19": {http.StatusBadRequest, "out_of_range"},
		"2027-10-21": {http.StatusBadRequest, "out_of_range"},
		"2026-10-20": {http.StatusNoContent, ""},
		"2027-10-20": {http.StatusNoContent, ""},
	}
	for day, want := range cases {
		for _, method := range []string{http.MethodPut, http.MethodDelete} {
			rec := testutil.Request(t, e.r, method, path("/api/admin", dress, day), nil, "")
			if rec.Code != want.code {
				t.Errorf("%s %s: status = %d, want %d", method, day, rec.Code, want.code)
				continue
			}
			if want.field != "" {
				body := testutil.Decode[testutil.ErrorBody](t, rec)
				if body.Error.Code != "validation_failed" || body.Error.Fields["day"] != want.field {
					t.Errorf("%s %s: error = %+v, want day %q", method, day, body.Error, want.field)
				}
			}
		}
	}
}

func TestUnknownOrNonDressListing(t *testing.T) {
	e := setup(t)
	shop := testutil.InsertShop(t, e.tx, testutil.ShopFixture{})
	var bare int64 // a listing with no dress_details row is not a dress
	err := e.tx.QueryRow(context.Background(), `
		INSERT INTO listings (shop_id, category_id, title, price_manat, is_published)
		VALUES ($1, (SELECT id FROM categories WHERE slug = 'dresses'), 'No details', 1000, true)
		RETURNING id`, shop.ID).Scan(&bare)
	if err != nil {
		t.Fatal(err)
	}
	for name, id := range map[string]int64{"missing": 999999999, "no dress details": bare} {
		for _, req := range []struct{ method, path string }{
			{http.MethodGet, path("/api", id, "")},
			{http.MethodGet, path("/api/admin", id, "")},
			{http.MethodPut, path("/api/admin", id, "2026-11-14")},
			{http.MethodDelete, path("/api/admin", id, "2026-11-14")},
		} {
			if rec := testutil.Request(t, e.r, req.method, req.path, nil, ""); rec.Code != http.StatusNotFound {
				t.Errorf("%s: %s %s: status = %d, want 404", name, req.method, req.path, rec.Code)
			}
		}
	}
}

func TestDeletingADressRemovesItsDays(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	dress := newDress(t, e.tx)
	if err := busydays.Mark(ctx, e.tx, dress, mustDay(t, "2026-11-14")); err != nil {
		t.Fatal(err)
	}
	if _, err := e.tx.Exec(ctx, `DELETE FROM listings WHERE id = $1`, dress); err != nil {
		t.Fatal(err)
	}
	var n int
	if err := e.tx.QueryRow(ctx, `SELECT count(*) FROM listing_busy_days WHERE listing_id = $1`, dress).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("busy days left after delete: %d", n)
	}
}
```

- [ ] **Step 3: Run them to see them fail**

Run: `cd backend && set -a; . ./.env; set +a; GOPROXY=off go test -count=1 ./internal/busydays/`
Expected: FAIL with a build error, because `wedding-rentals/backend/internal/busydays` has no non-test Go files.

- [ ] **Step 4: Implement the window, repository and handler**

`backend/internal/busydays/window.go`:
```go
// Package busydays keeps the days a listing is rented, which the dress page shows as a calendar.
package busydays

import "time"

// turkmenistan is UTC+5 all year; the country has no daylight saving time.
var turkmenistan = time.FixedZone("TMT", 5*60*60)

const dayLayout = "2006-01-02"

// Window is the span of days a calendar shows and accepts: today in Turkmenistan
// through the same date 12 months later, both inclusive. Both ends are midnight UTC.
type Window struct {
	From time.Time
	To   time.Time
}

// WindowAt returns the window for the moment now.
func WindowAt(now time.Time) Window {
	y, m, d := now.In(turkmenistan).Date()
	from := time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
	return Window{From: from, To: from.AddDate(0, 12, 0)}
}

// Contains reports whether day (a date from ParseDay) lies inside the window.
func (w Window) Contains(day time.Time) bool {
	return !day.Before(w.From) && !day.After(w.To)
}

// ParseDay parses a real YYYY-MM-DD calendar date and rejects anything else.
func ParseDay(s string) (time.Time, bool) {
	t, err := time.Parse(dayLayout, s)
	if err != nil {
		return time.Time{}, false
	}
	return t, true
}

func formatDay(t time.Time) string { return t.Format(dayLayout) }
```

`backend/internal/busydays/repo.go`:
```go
package busydays

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"

	"wedding-rentals/backend/internal/db"
)

// dressExists reports whether id is a dress (a listing with dress details). With
// publicOnly it must also be published in a published shop, the v1 visibility rule.
func dressExists(ctx context.Context, d db.DBTX, id int64, publicOnly bool) (bool, error) {
	var ok bool
	err := d.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM listings l
			JOIN dress_details dd ON dd.listing_id = l.id
			JOIN shops s ON s.id = l.shop_id
			WHERE l.id = $1 AND (NOT $2 OR (l.is_published AND s.is_published)))`, id, publicOnly).Scan(&ok)
	return ok, err
}

// List returns the listing's busy days inside w as sorted YYYY-MM-DD strings, never nil.
func List(ctx context.Context, d db.DBTX, listingID int64, w Window) ([]string, error) {
	rows, err := d.Query(ctx, `
		SELECT to_char(day, 'YYYY-MM-DD') FROM listing_busy_days
		WHERE listing_id = $1 AND day BETWEEN $2::date AND $3::date
		ORDER BY day`, listingID, formatDay(w.From), formatDay(w.To))
	if err != nil {
		return nil, err
	}
	days, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		return nil, err
	}
	if days == nil {
		days = []string{}
	}
	return days, nil
}

// Mark makes day busy; marking a busy day again changes nothing.
func Mark(ctx context.Context, d db.DBTX, listingID int64, day time.Time) error {
	_, err := d.Exec(ctx, `
		INSERT INTO listing_busy_days (listing_id, day) VALUES ($1, $2::date)
		ON CONFLICT DO NOTHING`, listingID, formatDay(day))
	return err
}

// Unmark makes day free; unmarking a free day changes nothing.
func Unmark(ctx context.Context, d db.DBTX, listingID int64, day time.Time) error {
	_, err := d.Exec(ctx, `DELETE FROM listing_busy_days WHERE listing_id = $1 AND day = $2::date`,
		listingID, formatDay(day))
	return err
}
```

`backend/internal/busydays/handler.go`:
```go
package busydays

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/httpx"
)

type Handler struct {
	DB db.DBTX
	// Now returns the current time; nil means time.Now. Tests set a fixed clock.
	Now func() time.Time
}

// Response is one dress's calendar: the window and the busy days inside it.
type Response struct {
	From string   `json:"from"`
	To   string   `json:"to"`
	Days []string `json:"days"`
}

func (h *Handler) RegisterPublic(g *gin.RouterGroup) {
	g.GET("/dresses/:id/busy-days", h.listPublic)
}

func (h *Handler) RegisterAdmin(g *gin.RouterGroup) {
	g.GET("/dresses/:id/busy-days", h.listAdmin)
	g.PUT("/dresses/:id/busy-days/:day", h.mark)
	g.DELETE("/dresses/:id/busy-days/:day", h.unmark)
}

func (h *Handler) window() Window {
	now := time.Now
	if h.Now != nil {
		now = h.Now
	}
	return WindowAt(now())
}

func (h *Handler) listPublic(c *gin.Context) { h.list(c, true) }
func (h *Handler) listAdmin(c *gin.Context)  { h.list(c, false) }

func (h *Handler) list(c *gin.Context, publicOnly bool) {
	id, ok := h.dress(c, publicOnly)
	if !ok {
		return
	}
	w := h.window()
	days, err := List(c.Request.Context(), h.DB, id, w)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusOK, Response{From: formatDay(w.From), To: formatDay(w.To), Days: days})
}

// dress reads :id and answers 404 unless it names a dress (a visible one when publicOnly).
func (h *Handler) dress(c *gin.Context, publicOnly bool) (int64, bool) {
	id, ok := httpx.ParseID(c, "id")
	if !ok {
		return 0, false
	}
	exists, err := dressExists(c.Request.Context(), h.DB, id, publicOnly)
	if err != nil {
		httpx.Abort(c, err)
		return 0, false
	}
	if !exists {
		httpx.Abort(c, httpx.ErrNotFound)
		return 0, false
	}
	return id, true
}

func (h *Handler) mark(c *gin.Context)   { h.change(c, Mark) }
func (h *Handler) unmark(c *gin.Context) { h.change(c, Unmark) }

func (h *Handler) change(c *gin.Context, apply func(context.Context, db.DBTX, int64, time.Time) error) {
	id, ok := h.dress(c, false)
	if !ok {
		return
	}
	day, ok := ParseDay(c.Param("day"))
	if !ok {
		httpx.Abort(c, httpx.Validation(map[string]string{"day": "invalid"}))
		return
	}
	if !h.window().Contains(day) {
		httpx.Abort(c, httpx.Validation(map[string]string{"day": "out_of_range"}))
		return
	}
	if err := apply(c.Request.Context(), h.DB, id, day); err != nil {
		httpx.Abort(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
```

- [ ] **Step 5: Run the package tests**

Run: `cd backend && set -a; . ./.env; set +a; GOPROXY=off go test -count=1 ./internal/busydays/`
Expected: `ok  	wedding-rentals/backend/internal/busydays`, with all 9 tests passing.

- [ ] **Step 6: Wire it into the server, with a route test first**

In `backend/internal/server/server_test.go`, extend the route-status map in the test that builds the server. Replace:
```go
	for path, want := range map[string]int{"/api/health": 200, "/api/cities": 200, "/api/dresses": 200, "/api/admin/shops": 401} {
```
with:
```go
	for path, want := range map[string]int{
		"/api/health": 200, "/api/cities": 200, "/api/dresses": 200, "/api/admin/shops": 401,
		"/api/dresses/999999999/busy-days": 404, "/api/admin/dresses/1/busy-days": 401,
	} {
```
Run: `cd backend && set -a; . ./.env; set +a; GOPROXY=off go test -count=1 ./internal/server/`
Expected: FAIL. The busy-days paths get the SPA or 404 fallback instead of the expected status.

In `backend/internal/server/server.go`:
- Add `"wedding-rentals/backend/internal/busydays"` to the imports, in alphabetical order after `auth`.
- After `imagesH := &images.Handler{DB: d.DB, Storage: d.Storage}`, add:
  ```go
  	busyH := &busydays.Handler{DB: d.DB}
  ```
- After `dressesH.RegisterPublic(api)`, add:
  ```go
  	busyH.RegisterPublic(api)
  ```
- After `imagesH.RegisterAdmin(admin)`, add:
  ```go
  	busyH.RegisterAdmin(admin)
  ```

Run: `cd backend && set -a; . ./.env; set +a; GOPROXY=off go test -count=1 ./internal/server/ ./internal/busydays/`
Expected: both packages pass.

- [ ] **Step 7: Run the whole backend suite, vet and fmt**

Run: `cd backend && GOPROXY=off make test && GOPROXY=off go vet ./... && gofmt -l .`
Expected: every package is `ok`, vet prints nothing, and `gofmt -l` prints nothing.

- [ ] **Step 8: Commit**

```bash
cd /Users/rado/projects/wedding-rentals
git add backend/migrations/00003_busy_days.sql backend/internal/busydays backend/internal/server
git commit -m "feat(backend): busy days per dress with a public calendar and admin marking"
```

---

### Task 2: Frontend calendar logic, API methods and texts

**Files:**
- Create: `frontend/src/lib/calendar.ts`
- Test: `frontend/src/lib/calendar_test.ts`
- Modify: `frontend/src/lib/types.ts`, `frontend/src/lib/api.ts`, `frontend/src/lib/api_test.ts`, `frontend/src/i18n/en.json`, `frontend/src/i18n/ru.json`, `frontend/src/i18n/tk.json`, `frontend/src/i18n/i18n_test.ts`

**Interfaces:**
- Consumes: the existing `createApi`, `request`, `admin` options and the `setup`/`json` test helpers in `api_test.ts`.
- Produces:
  - `interface BusyDays { from: string; to: string; days: string[] }`
  - `interface YearMonth { year: number; month: number }`, with `month` in 1–12
  - `dayKey(year, month, day): string`
  - `parseDayKey(key): { year; month; day }`
  - `daysInMonth(year, month): number`
  - `monthGrid(year, month): (number | null)[][]`, Monday first
  - `monthsInWindow(from, to): YearMonth[]`
  - `isInWindow(day, from, to): boolean`
  - `api.busyDays(dressId)`, `api.admin.busyDays(dressId)`, `api.admin.markBusy(dressId, day)`, `api.admin.markFree(dressId, day)`
  - i18n keys: `cal.month.1..12`, `cal.month_of.1..12` (the month as used inside a date), `cal.weekday.1..7` (Monday first, short), `cal.prev`, `cal.next`, `cal.day` (`{day} {month}`), `avail.*` and `field.out_of_range`

- [ ] **Step 1: Write the failing calendar test**

`frontend/src/lib/calendar_test.ts`:
```ts
import { assertEquals } from "@std/assert";
import { dayKey, daysInMonth, isInWindow, monthGrid, monthsInWindow, parseDayKey } from "./calendar.ts";

Deno.test("dayKey and parseDayKey round-trip with zero padding", () => {
  assertEquals(dayKey(2026, 11, 4), "2026-11-04");
  assertEquals(parseDayKey("2026-11-04"), { year: 2026, month: 11, day: 4 });
});

Deno.test("daysInMonth knows leap years", () => {
  assertEquals(daysInMonth(2027, 2), 28);
  assertEquals(daysInMonth(2028, 2), 29);
  assertEquals(daysInMonth(2026, 11), 30);
  assertEquals(daysInMonth(2026, 12), 31);
});

Deno.test("monthGrid starts weeks on Monday and pads with null", () => {
  // 1 November 2026 is a Sunday: six blanks, then 1; 30 days fill six weeks.
  const nov = monthGrid(2026, 11);
  assertEquals(nov.length, 6);
  assertEquals(nov[0], [null, null, null, null, null, null, 1]);
  assertEquals(nov[5], [30, null, null, null, null, null, null]);
  // 1 February 2027 is a Monday and the month has 28 days: exactly four full weeks.
  const feb = monthGrid(2027, 2);
  assertEquals(feb.length, 4);
  assertEquals(feb[0], [1, 2, 3, 4, 5, 6, 7]);
  assertEquals(feb[3], [22, 23, 24, 25, 26, 27, 28]);
  // February 2028 (leap) starts on a Tuesday and ends on the 29th.
  const leap = monthGrid(2028, 2);
  assertEquals(leap[0][0], null);
  assertEquals(leap[0][1], 1);
  assertEquals(leap.at(-1)!.filter((d) => d !== null).at(-1), 29);
  for (const week of [...nov, ...feb, ...leap]) assertEquals(week.length, 7);
});

Deno.test("monthsInWindow lists every month across a year boundary", () => {
  const months = monthsInWindow("2026-10-20", "2027-10-20");
  assertEquals(months.length, 13);
  assertEquals(months[0], { year: 2026, month: 10 });
  assertEquals(months[2], { year: 2026, month: 12 });
  assertEquals(months[3], { year: 2027, month: 1 });
  assertEquals(months[12], { year: 2027, month: 10 });
  assertEquals(monthsInWindow("2026-10-20", "2026-10-31"), [{ year: 2026, month: 10 }]);
});

Deno.test("isInWindow includes both ends", () => {
  assertEquals(isInWindow("2026-10-20", "2026-10-20", "2027-10-20"), true);
  assertEquals(isInWindow("2027-10-20", "2026-10-20", "2027-10-20"), true);
  assertEquals(isInWindow("2026-10-19", "2026-10-20", "2027-10-20"), false);
  assertEquals(isInWindow("2027-10-21", "2026-10-20", "2027-10-20"), false);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd frontend && deno test src/lib/calendar_test.ts`
Expected: FAIL with a module-not-found error for `./calendar.ts`.

- [ ] **Step 3: Implement calendar.ts and the BusyDays type**

`frontend/src/lib/calendar.ts`:
```ts
/** A month of a year; month is 1–12. */
export interface YearMonth {
  year: number;
  month: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-11-04" for 4 November 2026. */
export function dayKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Splits a YYYY-MM-DD key into numbers. */
export function parseDayKey(key: string): { year: number; month: number; day: number } {
  const [year, month, day] = key.split("-").map(Number);
  return { year, month, day };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The weeks of a month, Monday first; null pads before the 1st and after the last day. */
export function monthGrid(year: number, month: number): (number | null)[][] {
  const offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const cells: (number | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= daysInMonth(year, month); d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Every month from the one containing `from` to the one containing `to`. */
export function monthsInWindow(from: string, to: string): YearMonth[] {
  const start = parseDayKey(from);
  const end = parseDayKey(to);
  const months: YearMonth[] = [];
  let { year, month } = start;
  while (year < end.year || (year === end.year && month <= end.month)) {
    months.push({ year, month });
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

/** Whether a day lies within from…to, both inclusive; YYYY-MM-DD keys compare as strings. */
export function isInWindow(day: string, from: string, to: string): boolean {
  return day >= from && day <= to;
}
```

In `frontend/src/lib/types.ts`, add at the end of the file:
```ts

/** One dress's calendar: the window (today in Turkmenistan to 12 months ahead) and its busy days. */
export interface BusyDays {
  from: string;
  to: string;
  days: string[];
}
```

Run: `cd frontend && deno test src/lib/calendar_test.ts`
Expected: `ok | 5 passed | 0 failed`.

- [ ] **Step 4: Write the failing API tests**

Add to the end of `frontend/src/lib/api_test.ts`:
```ts

Deno.test("busy days: public and admin reads, and marking a day busy or free", async () => {
  const { api, calls } = setup((url, init) =>
    init.method === "GET"
      ? json(200, { from: "2026-10-20", to: "2027-10-20", days: ["2026-11-14"] })
      : new Response(null, { status: 204 })
  );
  assertEquals((await api.busyDays(7)).days, ["2026-11-14"]);
  assertEquals((await api.admin.busyDays(7)).to, "2027-10-20");
  assertEquals(await api.admin.markBusy(7, "2026-11-14"), undefined);
  assertEquals(await api.admin.markFree(7, "2026-11-14"), undefined);
  assertEquals(calls.map((c) => `${c.init.method} ${c.url}`), [
    "GET /api/dresses/7/busy-days",
    "GET /api/admin/dresses/7/busy-days",
    "PUT /api/admin/dresses/7/busy-days/2026-11-14",
    "DELETE /api/admin/dresses/7/busy-days/2026-11-14",
  ]);
  assertEquals((calls[0].init.headers as Record<string, string>).Authorization, undefined);
  assertEquals((calls[2].init.headers as Record<string, string>).Authorization, "Bearer tok");
});
```

Run: `cd frontend && deno test src/lib/api_test.ts`
Expected: FAIL with a type error, because `busyDays`, `markBusy` and `markFree` don't exist.

- [ ] **Step 5: Add the API methods**

In `frontend/src/lib/api.ts`:
- Add `BusyDays` to the type import from `./types.ts`, keeping the import list in alphabetical order.
- In the returned object, after the `dress:` line, add:
  ```ts
      busyDays: (dressId: number) => request<BusyDays>("GET", `/api/dresses/${dressId}/busy-days`),
  ```
- Inside `admin: {`, after the `deleteImage:` line, add:
  ```ts
        busyDays: (dressId: number) => request<BusyDays>("GET", `/api/admin/dresses/${dressId}/busy-days`, admin),
        markBusy: (dressId: number, day: string) =>
          request<void>("PUT", `/api/admin/dresses/${dressId}/busy-days/${day}`, admin),
        markFree: (dressId: number, day: string) =>
          request<void>("DELETE", `/api/admin/dresses/${dressId}/busy-days/${day}`, admin),
  ```

Run: `cd frontend && deno test src/lib/api_test.ts`
Expected: all API tests pass.

- [ ] **Step 6: Write the failing i18n test additions**

In `frontend/src/i18n/i18n_test.ts`:
- Add `"out_of_range"` to the `FIELD_VALUES` array.
- Add this test at the end of the file:
```ts

Deno.test("every month and weekday has a name", () => {
  for (let n = 1; n <= 12; n++) {
    for (const key of [`cal.month.${n}`, `cal.month_of.${n}`]) assert(key in en, `missing ${key}`);
  }
  for (let n = 1; n <= 7; n++) assert(`cal.weekday.${n}` in en, `missing cal.weekday.${n}`);
});
```

Run: `cd frontend && deno test src/i18n/`
Expected: FAIL, with `missing field.out_of_range` and `missing cal.month.1`.

- [ ] **Step 7: Add the texts in all three languages**

Each JSON file currently ends with the `"photos.deleted": …` line followed by `}`. In each file, put a comma at the end of that `"photos.deleted"` line, then insert the matching block between it and the closing `}`.

`frontend/src/i18n/en.json`:
```json
  "field.out_of_range": "Outside the allowed dates",
  "cal.month.1": "January",
  "cal.month.2": "February",
  "cal.month.3": "March",
  "cal.month.4": "April",
  "cal.month.5": "May",
  "cal.month.6": "June",
  "cal.month.7": "July",
  "cal.month.8": "August",
  "cal.month.9": "September",
  "cal.month.10": "October",
  "cal.month.11": "November",
  "cal.month.12": "December",
  "cal.month_of.1": "January",
  "cal.month_of.2": "February",
  "cal.month_of.3": "March",
  "cal.month_of.4": "April",
  "cal.month_of.5": "May",
  "cal.month_of.6": "June",
  "cal.month_of.7": "July",
  "cal.month_of.8": "August",
  "cal.month_of.9": "September",
  "cal.month_of.10": "October",
  "cal.month_of.11": "November",
  "cal.month_of.12": "December",
  "cal.weekday.1": "Mon",
  "cal.weekday.2": "Tue",
  "cal.weekday.3": "Wed",
  "cal.weekday.4": "Thu",
  "cal.weekday.5": "Fri",
  "cal.weekday.6": "Sat",
  "cal.weekday.7": "Sun",
  "cal.prev": "Previous month",
  "cal.next": "Next month",
  "cal.day": "{day} {month}",
  "avail.title": "Availability",
  "avail.busy": "Busy",
  "avail.free": "Free",
  "avail.note": "Busy days are updated by the shop. Call to confirm your date.",
  "avail.day_busy": "{date}, busy",
  "avail.day_free": "{date}, free",
  "avail.mark_busy": "Mark as busy",
  "avail.mark_free": "Mark as free",
  "avail.marked_busy": "{date} marked busy",
  "avail.marked_free": "{date} marked free",
  "avail.save_failed": "Couldn't save {date}. Try again.",
  "avail.save_first": "Save the dress first, then mark busy days."
```

`frontend/src/i18n/ru.json`:
```json
  "field.out_of_range": "Вне допустимых дат",
  "cal.month.1": "Январь",
  "cal.month.2": "Февраль",
  "cal.month.3": "Март",
  "cal.month.4": "Апрель",
  "cal.month.5": "Май",
  "cal.month.6": "Июнь",
  "cal.month.7": "Июль",
  "cal.month.8": "Август",
  "cal.month.9": "Сентябрь",
  "cal.month.10": "Октябрь",
  "cal.month.11": "Ноябрь",
  "cal.month.12": "Декабрь",
  "cal.month_of.1": "января",
  "cal.month_of.2": "февраля",
  "cal.month_of.3": "марта",
  "cal.month_of.4": "апреля",
  "cal.month_of.5": "мая",
  "cal.month_of.6": "июня",
  "cal.month_of.7": "июля",
  "cal.month_of.8": "августа",
  "cal.month_of.9": "сентября",
  "cal.month_of.10": "октября",
  "cal.month_of.11": "ноября",
  "cal.month_of.12": "декабря",
  "cal.weekday.1": "Пн",
  "cal.weekday.2": "Вт",
  "cal.weekday.3": "Ср",
  "cal.weekday.4": "Чт",
  "cal.weekday.5": "Пт",
  "cal.weekday.6": "Сб",
  "cal.weekday.7": "Вс",
  "cal.prev": "Предыдущий месяц",
  "cal.next": "Следующий месяц",
  "cal.day": "{day} {month}",
  "avail.title": "Занятые дни",
  "avail.busy": "Занято",
  "avail.free": "Свободно",
  "avail.note": "Занятые дни отмечает салон. Позвоните, чтобы подтвердить вашу дату.",
  "avail.day_busy": "{date}, занято",
  "avail.day_free": "{date}, свободно",
  "avail.mark_busy": "Отметить как занятый",
  "avail.mark_free": "Отметить как свободный",
  "avail.marked_busy": "{date}: отмечено как занято",
  "avail.marked_free": "{date}: отмечено как свободно",
  "avail.save_failed": "Не удалось сохранить {date}. Попробуйте ещё раз.",
  "avail.save_first": "Сначала сохраните платье, потом отмечайте занятые дни."
```

`frontend/src/i18n/tk.json`:
```json
  "field.out_of_range": "Rugsat berlen seneleriň daşynda",
  "cal.month.1": "Ýanwar",
  "cal.month.2": "Fewral",
  "cal.month.3": "Mart",
  "cal.month.4": "Aprel",
  "cal.month.5": "Maý",
  "cal.month.6": "Iýun",
  "cal.month.7": "Iýul",
  "cal.month.8": "Awgust",
  "cal.month.9": "Sentýabr",
  "cal.month.10": "Oktýabr",
  "cal.month.11": "Noýabr",
  "cal.month.12": "Dekabr",
  "cal.month_of.1": "ýanwar",
  "cal.month_of.2": "fewral",
  "cal.month_of.3": "mart",
  "cal.month_of.4": "aprel",
  "cal.month_of.5": "maý",
  "cal.month_of.6": "iýun",
  "cal.month_of.7": "iýul",
  "cal.month_of.8": "awgust",
  "cal.month_of.9": "sentýabr",
  "cal.month_of.10": "oktýabr",
  "cal.month_of.11": "noýabr",
  "cal.month_of.12": "dekabr",
  "cal.weekday.1": "Du",
  "cal.weekday.2": "Si",
  "cal.weekday.3": "Ça",
  "cal.weekday.4": "Pe",
  "cal.weekday.5": "An",
  "cal.weekday.6": "Şe",
  "cal.weekday.7": "Ýe",
  "cal.prev": "Öňki aý",
  "cal.next": "Indiki aý",
  "cal.day": "{day} {month}",
  "avail.title": "Boş günler",
  "avail.busy": "Band",
  "avail.free": "Boş",
  "avail.note": "Band günleri salon belleýär. Seneňizi tassyklamak üçin jaň ediň.",
  "avail.day_busy": "{date}, band",
  "avail.day_free": "{date}, boş",
  "avail.mark_busy": "Band diýip belle",
  "avail.mark_free": "Boş diýip belle",
  "avail.marked_busy": "{date} band diýlip bellendi",
  "avail.marked_free": "{date} boş diýlip bellendi",
  "avail.save_failed": "{date} saklanmady. Gaýtadan synanyşyň.",
  "avail.save_first": "Ilki köýnegi saklaň, soň band günleri belläň."
```
Copy these blocks with the brief helper or another mechanical method, so that the Turkmen and Cyrillic letters stay exact. Afterwards, check that all three files still parse as JSON:
`deno eval 'for (const l of ["en","ru","tk"]) JSON.parse(Deno.readTextFileSync(`src/i18n/${l}.json`))'`

- [ ] **Step 8: Run all frontend checks**

Run: `cd frontend && deno task test && deno task check && deno task build`
Expected: all tests pass (5 calendar, 1 new API and 1 new i18n test, plus the existing ones), the type check is clean, and the build succeeds.

- [ ] **Step 9: Commit**

```bash
cd /Users/rado/projects/wedding-rentals
git add frontend/src/lib frontend/src/i18n
git commit -m "feat(frontend): calendar month logic, busy-days API client and calendar texts"
```

---

### Task 3: Month calendar and the dress-page Availability section

**Files:**
- Create: `frontend/src/components/MonthCalendar.tsx`, `frontend/src/components/Availability.tsx`
- Modify: `frontend/src/pages/Dress.tsx`

**Interfaces:**
- Consumes: from Task 2, `dayKey`, `isInWindow`, `monthGrid`, `monthsInWindow`, `parseDayKey`, `BusyDays`, `api.busyDays` and the `cal.*`/`avail.*` keys; also `t` and `tr` from i18n, `ErrorState`, and `ChevronLeftIcon`/`ChevronRightIcon`.
- Produces:
  - `dayLabel(key: string): string`, returning for example "14 November", "14 ноября" or "14 noýabr"
  - `MonthCalendar` with props:
    - `window: { from: string; to: string }`
    - `busy: ReadonlySet<string>`
    - `pending?: ReadonlySet<string>`
    - `onToggle?: (day: string) => void`; when present, days in the window become toggle buttons
  - `Availability({ dressId: number })`

- [ ] **Step 1: Add the calendar component**

`frontend/src/components/MonthCalendar.tsx`:
```tsx
import { createSignal, createUniqueId, For, Show } from "solid-js";
import { t, tr } from "../i18n/i18n.ts";
import { dayKey, isInWindow, monthGrid, monthsInWindow, parseDayKey } from "../lib/calendar.ts";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons.tsx";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

/** "14 November" / "14 ноября" / "14 noýabr" for a YYYY-MM-DD key. */
export function dayLabel(key: string): string {
  const { month, day } = parseDayKey(key);
  return tr("cal.day", { day, month: tr(`cal.month_of.${month}`) });
}

interface DayProps {
  date: string;
  today: string;
  inWindow: boolean;
  busy: boolean;
  pending: boolean;
  onToggle?: (day: string) => void;
}

function Day(props: DayProps) {
  const number = () => parseDayKey(props.date).day;
  const label = () =>
    props.inWindow
      ? tr(props.busy ? "avail.day_busy" : "avail.day_free", { date: dayLabel(props.date) })
      : dayLabel(props.date);
  const look = () => ({
    "flex h-10 w-full items-center justify-center rounded-md tabular-nums": true,
    "bg-blush text-garnet-deep line-through": props.inWindow && props.busy,
    "text-silver": !props.inWindow,
    "ring-1 ring-garnet": props.date === props.today,
    "opacity-50": props.pending,
  });
  return (
    <Show
      when={props.onToggle && props.inWindow}
      fallback={
        <span classList={look()}>
          <span class="sr-only">{label()}</span>
          <span aria-hidden="true">{number()}</span>
        </span>
      }
    >
      <button
        type="button"
        classList={{ ...look(), "hover:bg-veil": !props.busy }}
        aria-pressed={props.busy}
        aria-busy={props.pending}
        aria-label={`${label()}. ${t(props.busy ? "avail.mark_free" : "avail.mark_busy")}`}
        onClick={() => {
          if (!props.pending) props.onToggle?.(props.date);
        }}
      >
        {number()}
      </button>
    </Show>
  );
}

/**
 * One month at a time, Monday first, limited to the server's window.
 * Read-only by default; with onToggle every day in the window becomes a toggle button.
 */
export default function MonthCalendar(props: {
  window: { from: string; to: string };
  busy: ReadonlySet<string>;
  pending?: ReadonlySet<string>;
  onToggle?: (day: string) => void;
}) {
  const months = () => monthsInWindow(props.window.from, props.window.to);
  const [index, setIndex] = createSignal(0);
  const current = () => months()[Math.min(index(), months().length - 1)];
  const atStart = () => index() === 0;
  const atEnd = () => index() >= months().length - 1;
  const captionId = createUniqueId();

  return (
    <div>
      <div class="flex items-center justify-between">
        <button
          type="button"
          class="btn-icon aria-disabled:opacity-40"
          aria-label={t("cal.prev")}
          aria-disabled={atStart()}
          onClick={() => !atStart() && setIndex(index() - 1)}
        >
          <ChevronLeftIcon />
        </button>
        <p id={captionId} class="font-display text-xl" aria-live="polite">
          {tr(`cal.month.${current().month}`)} {current().year}
        </p>
        <button
          type="button"
          class="btn-icon aria-disabled:opacity-40"
          aria-label={t("cal.next")}
          aria-disabled={atEnd()}
          onClick={() => !atEnd() && setIndex(index() + 1)}
        >
          <ChevronRightIcon />
        </button>
      </div>
      <table class="mt-2 w-full table-fixed border-collapse text-center text-sm" aria-labelledby={captionId}>
        <thead>
          <tr>
            <For each={WEEKDAYS}>
              {(n) => <th scope="col" class="pb-1 text-xs font-normal text-silver-ink">{tr(`cal.weekday.${n}`)}</th>}
            </For>
          </tr>
        </thead>
        <tbody>
          <For each={monthGrid(current().year, current().month)}>
            {(week) => (
              <tr>
                <For each={week}>
                  {(day) => (
                    <td class="p-0.5">
                      <Show when={day}>
                        {(d) => {
                          const date = () => dayKey(current().year, current().month, d());
                          return (
                            <Day
                              date={date()}
                              today={props.window.from}
                              inWindow={isInWindow(date(), props.window.from, props.window.to)}
                              busy={props.busy.has(date())}
                              pending={props.pending?.has(date()) ?? false}
                              onToggle={props.onToggle}
                            />
                          );
                        }}
                      </Show>
                    </td>
                  )}
                </For>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Add the dress-page section**

`frontend/src/components/Availability.tsx`:
```tsx
import { createResource, Match, Switch } from "solid-js";
import { t } from "../i18n/i18n.ts";
import { api } from "../lib/client.ts";
import ErrorState from "./ErrorState.tsx";
import MonthCalendar from "./MonthCalendar.tsx";

/** The dress page's read-only calendar of busy days, with a legend and a reminder to call. */
export default function Availability(props: { dressId: number }) {
  const [data, { refetch }] = createResource(() => props.dressId, (id) => api.busyDays(id));
  return (
    <section aria-labelledby="availability-title" class="border-t border-veil pt-6">
      <h2 id="availability-title" class="text-2xl">{t("avail.title")}</h2>
      <div class="mt-4 max-w-sm">
        <Switch>
          <Match when={data.error}>
            <ErrorState error={data.error} onRetry={refetch} />
          </Match>
          <Match when={!data()}>
            <div class="h-80 animate-pulse rounded-lg bg-veil" aria-busy="true" aria-label={t("common.loading")} />
          </Match>
          <Match when={data()}>
            {(d) => (
              <>
                <MonthCalendar window={d()} busy={new Set(d().days)} />
                <ul class="mt-3 flex gap-5 text-sm">
                  <li class="flex items-center gap-2">
                    <span aria-hidden="true" class="h-4 w-4 rounded bg-blush" />
                    {t("avail.busy")}
                  </li>
                  <li class="flex items-center gap-2">
                    <span aria-hidden="true" class="h-4 w-4 rounded border border-silver" />
                    {t("avail.free")}
                  </li>
                </ul>
                <p class="mt-3 text-sm text-silver-ink">{t("avail.note")}</p>
              </>
            )}
          </Match>
        </Switch>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Put the section on the dress page**

In `frontend/src/pages/Dress.tsx`:
- Add `import Availability from "../components/Availability.tsx";` as the first component import, before `ColorSwatch`.
- Replace:
  ```tsx
          <div class="mt-10">
            <ShopCardSection shop={d().shop} />
  ```
  with:
  ```tsx
          <div class="mt-10">
            <Availability dressId={d().id} />
          </div>

          <div class="mt-10">
            <ShopCardSection shop={d().shop} />
  ```

- [ ] **Step 4: Type-check, test and build**

Run: `cd frontend && deno task check && deno task test && deno task build`
Expected: all three are clean.

- [ ] **Step 5: Commit**

```bash
cd /Users/rado/projects/wedding-rentals
git add frontend/src/components/MonthCalendar.tsx frontend/src/components/Availability.tsx frontend/src/pages/Dress.tsx
git commit -m "feat(frontend): show each dress's busy days on its page"
```

---

### Task 4: Admin availability editor

**Files:**
- Create: `frontend/src/components/admin/AvailabilityEditor.tsx`
- Modify: `frontend/src/pages/admin/DressEdit.tsx`

**Interfaces:**
- Consumes: `MonthCalendar` and `dayLabel` from Task 3; `api.admin.busyDays`, `api.admin.markBusy` and `api.admin.markFree` from Task 2; `ErrorState`; `t`.
- Produces: `AvailabilityEditor({ dressId: number })`, and an "Availability" section in the admin dress editor.

- [ ] **Step 1: Add the editor component**

`frontend/src/components/admin/AvailabilityEditor.tsx`:
```tsx
import { createEffect, createResource, createSignal, Match, Show, Switch } from "solid-js";
import { t } from "../../i18n/i18n.ts";
import { api } from "../../lib/client.ts";
import ErrorState from "../ErrorState.tsx";
import MonthCalendar, { dayLabel } from "../MonthCalendar.tsx";

const withDay = (set: ReadonlySet<string>, day: string, on: boolean): ReadonlySet<string> => {
  const next = new Set(set);
  if (on) next.add(day);
  else next.delete(day);
  return next;
};

/** Tap a day to mark it busy or free; every tap saves at once and reverts if the save fails. */
export default function AvailabilityEditor(props: { dressId: number }) {
  const [data, { refetch }] = createResource(() => props.dressId, (id) => api.admin.busyDays(id));
  const [busy, setBusy] = createSignal<ReadonlySet<string>>(new Set());
  const [pending, setPending] = createSignal<ReadonlySet<string>>(new Set());
  const [status, setStatus] = createSignal("");
  const [failure, setFailure] = createSignal("");
  createEffect(() => {
    if (data.state === "ready") setBusy(new Set(data()?.days ?? []));
  });

  async function toggle(day: string) {
    if (pending().has(day)) return;
    const makeBusy = !busy().has(day);
    setBusy((s) => withDay(s, day, makeBusy));
    setPending((s) => withDay(s, day, true));
    setFailure("");
    try {
      await (makeBusy ? api.admin.markBusy(props.dressId, day) : api.admin.markFree(props.dressId, day));
      setStatus(t(makeBusy ? "avail.marked_busy" : "avail.marked_free", { date: dayLabel(day) }));
    } catch {
      setBusy((s) => withDay(s, day, !makeBusy));
      setFailure(t("avail.save_failed", { date: dayLabel(day) }));
    } finally {
      setPending((s) => withDay(s, day, false));
    }
  }

  return (
    <Switch>
      <Match when={data.error}>
        <ErrorState error={data.error} onRetry={refetch} />
      </Match>
      <Match when={!data()}>
        <p class="text-sm text-silver-ink">{t("common.loading")}</p>
      </Match>
      <Match when={data()}>
        {(d) => (
          <div class="max-w-sm">
            <MonthCalendar window={d()} busy={busy()} pending={pending()} onToggle={(day) => void toggle(day)} />
            <p role="status" aria-live="polite" class="sr-only">{status()}</p>
            <Show when={failure()}>
              <p role="alert" class="mt-3 text-sm text-garnet">{failure()}</p>
            </Show>
          </div>
        )}
      </Match>
    </Switch>
  );
}
```

- [ ] **Step 2: Add the section to the dress editor**

In `frontend/src/pages/admin/DressEdit.tsx`:
- Add `import AvailabilityEditor from "../../components/admin/AvailabilityEditor.tsx";` as the first admin component import, before the `Field.tsx` import.
- The Photos section ends like this, just before the closing `</Match>` of the form branch:
  ```tsx
              </Show>
            </div>
          </section>
        </Match>
      </Switch>
  ```
  Replace that with:
  ```tsx
              </Show>
            </div>
          </section>

          <section class="mt-8 rounded-lg bg-white p-5">
            <h2 class="text-2xl">{t("avail.title")}</h2>
            <div class="mt-4">
              <Show
                when={id() !== null && dress()}
                fallback={<p class="text-sm text-silver-ink">{t("avail.save_first")}</p>}
              >
                {(d) => <AvailabilityEditor dressId={d().id} />}
              </Show>
            </div>
          </section>
        </Match>
      </Switch>
  ```

- [ ] **Step 3: Type-check, test and build**

Run: `cd frontend && deno task check && deno task test && deno task build`
Expected: all three are clean.

- [ ] **Step 4: Check it against the running API**

Do this from `backend/`.

1. Start the API on a spare port so a running dev server is not disturbed:
   ```bash
   set -a; . ./.env; set +a; WEB_DIR=../frontend/dist PORT=18093 GOPROXY=off go run ./cmd/server &
   ```
2. Sign in, then mark and unmark a day:
   ```bash
   B=http://localhost:18093
   TOKEN=$(curl -s -H 'Content-Type: application/json' -d '{"email":"dev@example.com","password":"super-secret-1"}' $B/api/admin/login | sed -E 's/.*"token":"([^"]+)".*/\1/')
   ID=$(curl -s "$B/api/dresses?per_page=1" | sed -E 's/.*"items":\[\{"id":([0-9]+).*/\1/')
   DAY=$(curl -s $B/api/dresses/$ID/busy-days | sed -E 's/.*"from":"([^"]+)".*/\1/')
   curl -s -o /dev/null -w '%{http_code}\n' -X PUT -H "Authorization: Bearer $TOKEN" $B/api/admin/dresses/$ID/busy-days/$DAY
   curl -s $B/api/dresses/$ID/busy-days
   curl -s -o /dev/null -w '%{http_code}\n' -X DELETE -H "Authorization: Bearer $TOKEN" $B/api/admin/dresses/$ID/busy-days/$DAY
   ```
3. Stop the server: `kill %1`.

Expected:
- `204`;
- then JSON whose `days` contains today's date;
- then `204`.

If the dev database has no published dress, or no `dev@example.com` admin, report that instead of creating data.

The browser checklist is run by the controller with headless Chrome:
- marking days in the admin, and their accessible names;
- the dress page showing the same days;
- the month arrows stopping at the window edges;
- no sideways overflow at 320px in all three languages.

- [ ] **Step 5: Commit**

```bash
cd /Users/rado/projects/wedding-rentals
git add frontend/src/components/admin/AvailabilityEditor.tsx frontend/src/pages/admin/DressEdit.tsx
git commit -m "feat(frontend): mark a dress's busy days in the admin editor"
```

---

## Spec coverage (self-check)

| Spec section | Task |
|---|---|
| §2: admins mark single days; no notes; dress page only; 12-month window; UTC+5 | 1 (window, API), 3, 4 |
| §3: bride's month calendar, Monday first, busy/free/past/today looks, legend, note, i18n names, a11y names, ErrorState on failure | 2 (texts), 3 |
| §4: admin section after save only, tap toggles with instant save, in-flight state, revert and message on failure, past days not buttons, a11y names and live region, drafts allowed, cascade on delete | 1 (cascade), 4 |
| §5: `listing_busy_days` table on listings with PK and cascade | 1 |
| §6: server window returned as `from`/`to`; frontend uses it | 1, 3 |
| §7: four endpoints, visibility, idempotency, `day` validation (`invalid`, `out_of_range`), 404s | 1 |
| §8: `calendar.ts`, `BusyDays`, API methods, `MonthCalendar`, `Availability`, `AvailabilityEditor`, i18n keys incl. `field.out_of_range` | 2, 3, 4 |
| §9: Go tests (visibility, window, validation, idempotency, 401, 404, cascade), Deno tests (calendar maths, API), browser check | 1, 2, controller after 4 |
