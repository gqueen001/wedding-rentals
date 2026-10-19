package textnorm_test

import (
	"context"
	"testing"

	"wedding-rentals/backend/internal/testutil"
	"wedding-rentals/backend/internal/textnorm"
)

func TestNorm(t *testing.T) {
	cases := map[string]string{
		"Gelin Öýi": "gelin oyi",
		"ÄÇŇÖŞÜÝŽ":  "acnosuyz",
		"äçňöşüýž":  "acnosuyz",
		"Bridal":    "bridal",
	}
	for in, want := range cases {
		if got := textnorm.Norm(in); got != want {
			t.Errorf("Norm(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestNormMatchesSQL(t *testing.T) {
	tx := testutil.Tx(t)
	for _, in := range []string{"Gelin Öýi", "ÄÇŇÖŞÜÝŽ äçňöşüýž", "Ak Ýüpek Bridal 2"} {
		var sql string
		if err := tx.QueryRow(context.Background(), `SELECT norm($1)`, in).Scan(&sql); err != nil {
			t.Fatal(err)
		}
		if got := textnorm.Norm(in); got != sql {
			t.Errorf("Norm(%q) = %q, SQL norm = %q", in, got, sql)
		}
	}
}

func TestSlugify(t *testing.T) {
	cases := map[string]string{
		"Gelin Öýi — Bridal House!": "gelin-oyi-bridal-house",
		"  Ak Ýüpek 2 ":             "ak-yupek-2",
		"Гелин":                     "",
		"--a--b--":                  "a-b",
	}
	for in, want := range cases {
		if got := textnorm.Slugify(in); got != want {
			t.Errorf("Slugify(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestEscapeLike(t *testing.T) {
	if got := textnorm.EscapeLike(`50%_a\`); got != `50\%\_a\\` {
		t.Fatalf("EscapeLike = %q", got)
	}
}
