package catalog_test

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"net/url"
	"os"
	"reflect"
	"regexp"
	"slices"
	"testing"

	"wedding-rentals/backend/internal/catalog"
	"wedding-rentals/backend/internal/testutil"
)

var update = flag.Bool("update", false, "rewrite frontend/src/lib/catalog.json")

const frontendFile = "../../../frontend/src/lib/catalog.json"

func cat(t *testing.T, slug string) catalog.Category {
	t.Helper()
	c, ok := catalog.Find(slug)
	if !ok {
		t.Fatalf("no category %q", slug)
	}
	return c
}

// decode turns a JSON object into what handlers pass to Validate.
func decode(t *testing.T, s string) map[string]any {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal([]byte(s), &m); err != nil {
		t.Fatal(err)
	}
	return m
}

func TestValidateCleansGoodAttributes(t *testing.T) {
	clean, errs := catalog.Validate(cat(t, "cars"), decode(t,
		`{"brand_model": "  Mercedes S-Class ", "body": "limousine", "color": "white", "seats": 4, "price_unit": "hour"}`))
	want := map[string]any{"brand_model": "Mercedes S-Class", "body": "limousine", "color": "white", "seats": 4, "price_unit": "hour"}
	if len(errs) > 0 || !reflect.DeepEqual(clean, want) {
		t.Fatalf("clean = %v, errs = %v", clean, errs)
	}
	clean, errs = catalog.Validate(cat(t, "national-clothes"), decode(t, `{"for_whom": "bride", "sizes": ["L", "S", "L"]}`))
	if len(errs) > 0 || !reflect.DeepEqual(clean["sizes"], []string{"S", "L"}) {
		t.Fatalf("sizes = %v, errs = %v", clean["sizes"], errs)
	}
	// An empty optional field is dropped.
	clean, errs = catalog.Validate(cat(t, "tents"), decode(t, `{"guests": 150, "area_m2": null}`))
	if len(errs) > 0 || !reflect.DeepEqual(clean, map[string]any{"guests": 150}) {
		t.Fatalf("clean = %v, errs = %v", clean, errs)
	}
}

func TestValidateReportsEveryKindOfError(t *testing.T) {
	_, errs := catalog.Validate(cat(t, "cars"), decode(t,
		`{"brand_model": "`+string(bytes.Repeat([]byte("x"), 101))+`", "body": "truck", "seats": 0, "colour": "white"}`))
	want := map[string]string{
		"attributes.brand_model": "too_long",
		"attributes.body":        "invalid",
		"attributes.color":       "required",
		"attributes.seats":       "must_be_positive",
		"attributes.price_unit":  "required",
		"attributes.colour":      "unknown",
	}
	if !reflect.DeepEqual(errs, want) {
		t.Fatalf("errs = %v\nwant  %v", errs, want)
	}
	_, errs = catalog.Validate(cat(t, "tents"), decode(t, `{"guests": 5001, "area_m2": 1.5}`))
	if errs["attributes.guests"] != "too_large" || errs["attributes.area_m2"] != "invalid" {
		t.Fatalf("errs = %v", errs)
	}
	_, errs = catalog.Validate(cat(t, "national-clothes"), decode(t, `{"for_whom": 3, "sizes": []}`))
	if errs["attributes.for_whom"] != "invalid" || errs["attributes.sizes"] != "required" {
		t.Fatalf("errs = %v", errs)
	}
	_, errs = catalog.Validate(cat(t, "national-clothes"), decode(t, `{"for_whom": "bride", "sizes": ["M", "XXXL"]}`))
	if errs["attributes.sizes"] != "invalid" {
		t.Fatalf("errs = %v", errs)
	}
}

func TestParseFilters(t *testing.T) {
	conds, errs := catalog.ParseFilters(cat(t, "cars"), url.Values{"body": {"suv"}, "seats_min": {"5"}, "price_unit": {"hour"}})
	if len(errs) > 0 || len(conds) != 2 || conds[0].Value != "suv" || conds[1].Value != 5 {
		t.Fatalf("conds = %+v, errs = %v", conds, errs)
	}
	_, errs = catalog.ParseFilters(cat(t, "cars"), url.Values{"body": {"truck"}, "seats_min": {"61"}})
	if errs["body"] != "invalid" || errs["seats_min"] != "invalid" {
		t.Fatalf("errs = %v", errs)
	}
	conds, _ = catalog.ParseFilters(cat(t, "national-clothes"), url.Values{"size": {"M"}})
	if len(conds) != 1 || conds[0].Value != "M" {
		t.Fatalf("conds = %+v", conds)
	}
}

func TestEveryCategoryIsInTheDatabase(t *testing.T) {
	tx := testutil.Tx(t)
	for _, c := range catalog.Categories {
		var ok bool
		if err := tx.QueryRow(context.Background(), `SELECT EXISTS(SELECT 1 FROM categories WHERE slug = $1)`, c.Slug).Scan(&ok); err != nil || !ok {
			t.Errorf("category %q missing from the categories table (err %v)", c.Slug, err)
		}
	}
}

// The frontend builds its forms and filters from this file. Run
// `go test ./internal/catalog/ -update` after changing the definitions.
func TestFrontendCatalogIsUpToDate(t *testing.T) {
	want, err := json.MarshalIndent(map[string]any{"categories": catalog.Categories}, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	want = append(want, '\n')
	if *update {
		if err := os.WriteFile(frontendFile, want, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	got, err := os.ReadFile(frontendFile)
	if err != nil {
		t.Fatalf("%v (run go test ./internal/catalog/ -update)", err)
	}
	if !bytes.Equal(got, want) {
		t.Fatal("frontend/src/lib/catalog.json is out of date: run go test ./internal/catalog/ -update")
	}
}

func TestDefinitionsAreWellFormed(t *testing.T) {
	keyRe := regexp.MustCompile(`^[a-z0-9_]+$`)
	slugRe := regexp.MustCompile(`^[a-z0-9-]+$`)
	shared := []string{"q", "city", "price_min", "price_max", "ids", "page", "per_page", "category"}
	kinds := map[string]string{} // field key -> kind, across categories
	for _, c := range catalog.Categories {
		if !slugRe.MatchString(c.Slug) {
			t.Errorf("category slug %q must match %s", c.Slug, slugRe)
		}
		params := map[string]string{}
		for _, f := range c.Fields {
			where := c.Slug + "." + f.Key
			if !keyRe.MatchString(f.Key) {
				t.Errorf("%s: key must match %s (keys go into SQL text)", where, keyRe)
			}
			if prev, ok := kinds[f.Key]; ok && prev != f.Kind {
				t.Errorf("%s: key has kind %q here but %q in another category", where, f.Kind, prev)
			}
			kinds[f.Key] = f.Kind
			switch f.Kind {
			case catalog.Text:
				if f.MaxLen <= 0 {
					t.Errorf("%s: text field needs MaxLen > 0", where)
				}
			case catalog.Number:
				if f.Min < 1 || f.Max <= f.Min {
					t.Errorf("%s: number field needs Min >= 1 and Max > Min, got %d..%d", where, f.Min, f.Max)
				}
			case catalog.Choice, catalog.Choices:
				if len(f.Options) == 0 {
					t.Errorf("%s: choice field needs at least one option", where)
				}
				seen := map[string]bool{}
				for _, o := range f.Options {
					if seen[o] {
						t.Errorf("%s: duplicate option %q", where, o)
					}
					seen[o] = true
				}
			default:
				t.Errorf("%s: unknown field kind %q", where, f.Kind)
			}
			if f.Filter == nil {
				continue
			}
			p := f.Filter.Param
			if p == "" {
				t.Errorf("%s: filter has an empty Param", where)
			}
			if slices.Contains(shared, p) {
				t.Errorf("%s: filter param %q is a shared param", where, p)
			}
			if other, dup := params[p]; dup {
				t.Errorf("%s: filter param %q is already used by %s", where, p, other)
			}
			params[p] = where
			switch f.Filter.Kind {
			case catalog.FilterMin:
				if f.Kind != catalog.Number {
					t.Errorf("%s: a min filter needs a Number field, got %q", where, f.Kind)
				}
			case catalog.FilterEq, catalog.FilterHas:
				if f.Kind != catalog.Choice && f.Kind != catalog.Choices {
					t.Errorf("%s: an %s filter needs a Choice or Choices field, got %q", where, f.Filter.Kind, f.Kind)
				}
			default:
				t.Errorf("%s: unknown filter kind %q", where, f.Filter.Kind)
			}
		}
	}
}
