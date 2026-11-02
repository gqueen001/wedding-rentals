package web

import (
	"encoding/json"
	"os"
	"strings"
	"testing"

	"wedding-rentals/backend/internal/catalog"
)

// The server's category names must be the frontend's Turkmen ones, for every category.
func TestCategoryNamesMatchFrontend(t *testing.T) {
	raw, err := os.ReadFile("../../../frontend/src/i18n/tk.json")
	if err != nil {
		t.Fatal(err)
	}
	var tk map[string]string
	if err := json.Unmarshal(raw, &tk); err != nil {
		t.Fatal(err)
	}
	for _, c := range catalog.Categories {
		if catNames[c.Slug] == "" || catNames[c.Slug] != tk["cat."+c.Slug] {
			t.Errorf("%s: server %q, frontend %q", c.Slug, catNames[c.Slug], tk["cat."+c.Slug])
		}
	}
	if len(catNames) != len(catalog.Categories) {
		t.Errorf("%d names for %d categories", len(catNames), len(catalog.Categories))
	}
}

func TestTruncate(t *testing.T) {
	if got := truncate("short", 10); got != "short" {
		t.Fatal(got)
	}
	got := truncate("Ak Gelin: köýnekler kireýine, Mary. Salgysy: uzyn köçe", 30)
	if !strings.HasSuffix(got, "…") || len([]rune(got)) > 30 || strings.Contains(got, " …") {
		t.Fatalf("%q", got)
	}
}
