package listing_test

import (
	"net/url"
	"strings"
	"testing"

	"wedding-rentals/backend/internal/listing"
)

func TestParseQuery(t *testing.T) {
	q, errs := listing.ParseQuery(url.Values{"city": {" mary "}, "price_min": {"100"}, "ids": {"3, 4"}, "per_page": {"500"}})
	if len(errs) > 0 || q.City != "mary" || q.PriceMin != 100 || len(q.IDs) != 2 || q.PerPage != 60 || q.Page != 1 {
		t.Fatalf("q = %+v, errs = %v", q, errs)
	}
	_, errs = listing.ParseQuery(url.Values{
		"price_max": {"-1"}, "page": {"0"}, "ids": {"1,x"}, "q": {strings.Repeat("a", 101)},
	})
	for _, key := range []string{"price_max", "page", "ids", "q"} {
		if errs[key] == "" {
			t.Errorf("no error for %s (all: %v)", key, errs)
		}
	}
	ids := make([]string, 101)
	for i := range ids {
		ids[i] = "1"
	}
	if _, errs := listing.ParseQuery(url.Values{"ids": {strings.Join(ids, ",")}}); errs["ids"] != "too_many" {
		t.Errorf("101 ids: errs = %v", errs)
	}
}

func TestWhereNumbersItsPlaceholders(t *testing.T) {
	w := &listing.Where{}
	w.Add("cat.slug = ?", "cars")
	w.Apply(listing.Query{City: "mary", Q: "ak", Page: 2, PerPage: 24})
	sql := w.SQL()
	for _, want := range []string{"l.is_published AND s.is_published", "cat.slug = $1", "ci.slug = $2", "$3 <% norm(l.title)", "LIKE $4"} {
		if !strings.Contains(sql, want) {
			t.Errorf("missing %q in %s", want, sql)
		}
	}
	if !strings.Contains(w.OrderBy(), "word_similarity($3") {
		t.Errorf("order by = %s", w.OrderBy())
	}
	limit, args := w.Limit(listing.Query{Page: 2, PerPage: 24})
	if limit != " LIMIT $5 OFFSET $6" || len(args) != 6 || args[4] != 24 || args[5] != 24 || len(w.Args()) != 4 {
		t.Fatalf("limit = %q, args = %v", limit, args)
	}
}
