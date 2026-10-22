// Package catalog defines the rental categories and each one's own fields.
//
// This list is the one place to change when shops ask for different fields: it drives
// validation, the public filters, and (through frontend/src/lib/catalog.json, which
// TestFrontendCatalogIsUpToDate regenerates with -update) the forms and filter panels.
// Every key and option also needs texts in the frontend i18n files.
package catalog

// Field kinds.
const (
	Text    = "text"    // a string up to MaxLen characters
	Choice  = "choice"  // one of Options
	Choices = "choices" // one or more of Options, stored in Options order
	Number  = "number"  // a whole number from Min to Max
)

// How a field filters the public list.
const (
	FilterEq  = "eq"  // param=<option>: the field equals it
	FilterHas = "has" // param=<option>: the field's choices include it
	FilterMin = "min" // param=<n>: the field is at least n
)

type Filter struct {
	Param string `json:"param"`
	Kind  string `json:"kind"`
}

type Field struct {
	Key      string   `json:"key"`
	Kind     string   `json:"kind"`
	Required bool     `json:"required"`
	Options  []string `json:"options,omitempty"`
	Min      int      `json:"min,omitempty"`
	Max      int      `json:"max,omitempty"`
	MaxLen   int      `json:"max_len,omitempty"`
	Filter   *Filter  `json:"filter,omitempty"`
}

type Category struct {
	Slug string `json:"slug"`
	// OwnPages: dresses keep their own pages, API and dress_details; Fields is empty.
	OwnPages bool    `json:"own_pages"`
	Fields   []Field `json:"fields"`
}

var sizes = []string{"XS", "S", "M", "L", "XL", "XXL"}

// Categories in display order. Slugs match the categories table.
var Categories = []Category{
	{Slug: "dresses", OwnPages: true, Fields: []Field{}},
	{Slug: "cars", Fields: []Field{
		{Key: "brand_model", Kind: Text, Required: true, MaxLen: 100},
		{Key: "body", Kind: Choice, Required: true, Options: []string{"sedan", "suv", "limousine", "minivan"},
			Filter: &Filter{Param: "body", Kind: FilterEq}},
		{Key: "color", Kind: Choice, Required: true, Options: []string{"white", "black", "silver", "other"},
			Filter: &Filter{Param: "color", Kind: FilterEq}},
		{Key: "seats", Kind: Number, Min: 1, Max: 60, Filter: &Filter{Param: "seats_min", Kind: FilterMin}},
		{Key: "price_unit", Kind: Choice, Required: true, Options: []string{"hour", "day"}},
	}},
	{Slug: "national-clothes", Fields: []Field{
		{Key: "for_whom", Kind: Choice, Required: true, Options: []string{"bride", "groom", "woman", "man", "child"},
			Filter: &Filter{Param: "for_whom", Kind: FilterEq}},
		{Key: "sizes", Kind: Choices, Required: true, Options: sizes, Filter: &Filter{Param: "size", Kind: FilterHas}},
	}},
	{Slug: "tents", Fields: []Field{
		{Key: "guests", Kind: Number, Required: true, Min: 1, Max: 5000,
			Filter: &Filter{Param: "guests_min", Kind: FilterMin}},
		{Key: "area_m2", Kind: Number, Min: 1, Max: 10000},
	}},
	{Slug: "car-decorations", Fields: []Field{
		{Key: "color", Kind: Choice, Required: true, Options: []string{"white", "red", "pink", "gold", "other"},
			Filter: &Filter{Param: "color", Kind: FilterEq}},
	}},
}

// Find returns the category with this slug.
func Find(slug string) (Category, bool) {
	for _, c := range Categories {
		if c.Slug == slug {
			return c, true
		}
	}
	return Category{}, false
}
