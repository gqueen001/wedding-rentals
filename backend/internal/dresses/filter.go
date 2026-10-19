package dresses

import (
	"math"
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
	maxPage        = 10000
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
	intParam("price_min", &f.PriceMin, 0, math.MaxInt32)
	intParam("price_max", &f.PriceMax, 0, math.MaxInt32)
	intParam("page", &f.Page, 1, maxPage)
	intParam("per_page", &f.PerPage, 1, math.MaxInt32)
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
