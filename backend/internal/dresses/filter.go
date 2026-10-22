package dresses

import (
	"net/url"
	"slices"

	"wedding-rentals/backend/internal/listing"
)

type Filter struct {
	listing.Query
	Size    string
	Color   string
	Style   string // matches dress_details.silhouette
	Sleeves string
}

func ParseFilter(v url.Values) (Filter, map[string]string) {
	q, errs := listing.ParseQuery(v)
	f := Filter{Query: q, Size: v.Get("size"), Color: v.Get("color"), Style: v.Get("style"), Sleeves: v.Get("sleeves")}
	enum := func(key, val string, allowed []string) {
		if val != "" && !slices.Contains(allowed, val) {
			errs[key] = "invalid"
		}
	}
	enum("size", f.Size, Sizes)
	enum("color", f.Color, Colors)
	enum("style", f.Style, Silhouettes)
	enum("sleeves", f.Sleeves, SleeveTypes)
	return f, errs
}
