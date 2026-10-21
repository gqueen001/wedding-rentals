package catalog_test

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"net/url"
	"os"
	"reflect"
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
