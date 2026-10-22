package items

import (
	"net/url"

	"wedding-rentals/backend/internal/catalog"
	"wedding-rentals/backend/internal/listing"
)

type Filter struct {
	listing.Query
	Category string
	attrs    []catalog.Cond
}

// ParseFilter reads the shared list params, category, and that category's own filters.
func ParseFilter(v url.Values) (Filter, map[string]string) {
	q, errs := listing.ParseQuery(v)
	f := Filter{Query: q, Category: v.Get("category")}
	if f.Category == "" {
		return f, errs
	}
	c, ok := catalog.Find(f.Category)
	if !ok {
		errs["category"] = "invalid"
		return f, errs
	}
	conds, attrErrs := catalog.ParseFilters(c, v)
	f.attrs = conds
	for k, code := range attrErrs {
		errs[k] = code
	}
	return f, errs
}
