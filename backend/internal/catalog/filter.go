package catalog

import (
	"net/url"
	"slices"
	"strconv"
)

// Cond is one SQL condition on l.attributes, with "?" standing for Value.
type Cond struct {
	SQL   string
	Value any
}

// ParseFilters reads the category's filter params from v. Field keys come from the
// definitions above, never from the request, so they are safe to put in the SQL.
func ParseFilters(c Category, v url.Values) ([]Cond, map[string]string) {
	var conds []Cond
	errs := map[string]string{}
	for _, f := range c.Fields {
		if f.Filter == nil {
			continue
		}
		s := v.Get(f.Filter.Param)
		if s == "" {
			continue
		}
		switch f.Filter.Kind {
		case FilterEq:
			if !slices.Contains(f.Options, s) {
				errs[f.Filter.Param] = "invalid"
				continue
			}
			conds = append(conds, Cond{SQL: "l.attributes @> jsonb_build_object('" + f.Key + "', ?::text)", Value: s})
		case FilterHas:
			if !slices.Contains(f.Options, s) {
				errs[f.Filter.Param] = "invalid"
				continue
			}
			conds = append(conds, Cond{
				SQL: "l.attributes @> jsonb_build_object('" + f.Key + "', jsonb_build_array(?::text))", Value: s})
		case FilterMin:
			n, err := strconv.Atoi(s)
			if err != nil || n < f.Min || n > f.Max {
				errs[f.Filter.Param] = "invalid"
				continue
			}
			conds = append(conds, Cond{SQL: "(l.attributes->>'" + f.Key + "')::int >= ?", Value: n})
		}
	}
	return conds, errs
}
