package listing

import (
	"fmt"
	"math"
	"net/url"
	"strconv"
	"strings"
	"unicode/utf8"

	"wedding-rentals/backend/internal/textnorm"
)

const (
	defaultPerPage = 24
	maxPerPage     = 60
	maxIDs         = 100
	maxPage        = 10000
)

// Query is the part of a public list request that every category shares.
type Query struct {
	City     string
	PriceMin int
	PriceMax int
	Q        string
	IDs      []int64
	ShopSlug string // set internally by the shop page, not a query param
	Page     int
	PerPage  int
}

// ParseQuery reads city, price_min, price_max, q, ids, page and per_page.
func ParseQuery(v url.Values) (Query, map[string]string) {
	q := Query{
		City:    strings.TrimSpace(v.Get("city")),
		Q:       strings.TrimSpace(v.Get("q")),
		Page:    1,
		PerPage: defaultPerPage,
	}
	errs := map[string]string{}
	intParam := func(key string, dst *int, lo, hi int) {
		if s := v.Get(key); s != "" {
			n, err := strconv.Atoi(s)
			if err != nil || n < lo || n > hi {
				errs[key] = "invalid"
				return
			}
			*dst = n
		}
	}
	intParam("price_min", &q.PriceMin, 0, math.MaxInt32)
	intParam("price_max", &q.PriceMax, 0, math.MaxInt32)
	intParam("page", &q.Page, 1, maxPage)
	intParam("per_page", &q.PerPage, 1, math.MaxInt32)
	q.PerPage = min(q.PerPage, maxPerPage)
	if s := v.Get("ids"); s != "" {
		for _, part := range strings.Split(s, ",") {
			n, err := strconv.ParseInt(strings.TrimSpace(part), 10, 64)
			if err != nil || n <= 0 {
				errs["ids"] = "invalid"
				break
			}
			q.IDs = append(q.IDs, n)
		}
		if len(q.IDs) > maxIDs {
			errs["ids"] = "too_many"
		}
	}
	if utf8.RuneCountInString(q.Q) > 100 {
		errs["q"] = "too_long"
	}
	return q, errs
}

// Where builds a public list's WHERE clause over listings l, shops s and cities ci.
// It always requires the listing and its shop to be published.
type Where struct {
	conds  []string
	args   []any
	qParam string
}

// Add appends a condition; each "?" in cond becomes the placeholder of val.
func (w *Where) Add(cond string, val any) {
	w.args = append(w.args, val)
	w.conds = append(w.conds, strings.ReplaceAll(cond, "?", "$"+strconv.Itoa(len(w.args))))
}

// Apply adds the shared query's conditions, including the search.
func (w *Where) Apply(q Query) {
	if q.City != "" {
		w.Add("ci.slug = ?", q.City)
	}
	if q.PriceMin > 0 {
		w.Add("l.price_manat >= ?", q.PriceMin)
	}
	if q.PriceMax > 0 {
		w.Add("l.price_manat <= ?", q.PriceMax)
	}
	if len(q.IDs) > 0 {
		w.Add("l.id = ANY(?)", q.IDs)
	}
	if q.ShopSlug != "" {
		w.Add("s.slug = ?", q.ShopSlug)
	}
	if q.Q != "" {
		qn := textnorm.Norm(q.Q)
		w.args = append(w.args, qn, "%"+textnorm.EscapeLike(qn)+"%")
		w.qParam = "$" + strconv.Itoa(len(w.args)-1)
		like := "$" + strconv.Itoa(len(w.args))
		w.conds = append(w.conds, fmt.Sprintf(`(
			%[1]s <%% norm(l.title) OR %[1]s <%% norm(s.name)
			OR norm(l.title) LIKE %[2]s OR norm(s.name) LIKE %[2]s
			OR EXISTS (SELECT 1 FROM shop_aliases a WHERE a.shop_id = s.id
			           AND (%[1]s <%% norm(a.alias) OR norm(a.alias) LIKE %[2]s)))`, w.qParam, like))
	}
}

// SQL is " WHERE …" with the published rules first.
func (w *Where) SQL() string {
	return " WHERE " + strings.Join(append([]string{"l.is_published", "s.is_published"}, w.conds...), " AND ")
}

func (w *Where) Args() []any { return w.args }

// OrderBy ranks search results by how well they match, otherwise newest first.
func (w *Where) OrderBy() string {
	if w.qParam == "" {
		return " ORDER BY l.created_at DESC, l.id DESC"
	}
	return fmt.Sprintf(` ORDER BY GREATEST(
		word_similarity(%[1]s, norm(l.title)),
		word_similarity(%[1]s, norm(s.name)),
		COALESCE((SELECT max(word_similarity(%[1]s, norm(a.alias))) FROM shop_aliases a WHERE a.shop_id = s.id), 0)
	) DESC, l.created_at DESC, l.id DESC`, w.qParam)
}

// Limit is " LIMIT … OFFSET …" for the query's page, with its two args appended.
func (w *Where) Limit(q Query) (string, []any) {
	args := append(append([]any{}, w.args...), q.PerPage, (q.Page-1)*q.PerPage)
	return fmt.Sprintf(" LIMIT $%d OFFSET $%d", len(args)-1, len(args)), args
}
