package busydays_test

import (
	"context"
	"fmt"
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

func TestUnknownListing(t *testing.T) {
	e := setup(t)
	for _, req := range []struct{ method, path string }{
		{http.MethodGet, path("/api", 999999999, "")},
		{http.MethodGet, path("/api/admin", 999999999, "")},
		{http.MethodPut, path("/api/admin", 999999999, "2026-11-14")},
		{http.MethodDelete, path("/api/admin", 999999999, "2026-11-14")},
	} {
		if rec := testutil.Request(t, e.r, req.method, req.path, nil, ""); rec.Code != http.StatusNotFound {
			t.Errorf("%s %s: status = %d, want 404", req.method, req.path, rec.Code)
		}
	}
}

// Every category has busy days, under /items and (for older links) /dresses alike.
func TestAnyListingHasBusyDays(t *testing.T) {
	e := setup(t)
	shop := testutil.InsertShop(t, e.tx, testutil.ShopFixture{})
	var tent int64
	err := e.tx.QueryRow(context.Background(), `
		INSERT INTO listings (shop_id, category_id, title, price_manat, is_published, attributes)
		VALUES ($1, (SELECT id FROM categories WHERE slug = 'tents'), 'Ak çadyr', 5000, true, '{"guests": 150}')
		RETURNING id`, shop.ID).Scan(&tent)
	if err != nil {
		t.Fatal(err)
	}
	items := fmt.Sprintf("/api/admin/items/%d/busy-days/2026-11-14", tent)
	if rec := testutil.Request(t, e.r, http.MethodPut, items, nil, ""); rec.Code != http.StatusNoContent {
		t.Fatalf("PUT %s: status = %d", items, rec.Code)
	}
	for _, p := range []string{fmt.Sprintf("/api/items/%d/busy-days", tent), path("/api", tent, "")} {
		got := testutil.Decode[busydays.Response](t, testutil.Request(t, e.r, http.MethodGet, p, nil, ""))
		if len(got.Days) != 1 || got.Days[0] != "2026-11-14" {
			t.Errorf("GET %s: days = %v", p, got.Days)
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
