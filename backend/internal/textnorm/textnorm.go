package textnorm

import "strings"

var turkmen = strings.NewReplacer(
	"ä", "a", "ç", "c", "ň", "n", "ö", "o", "ş", "s", "ü", "u", "ý", "y", "ž", "z",
	"Ä", "a", "Ç", "c", "Ň", "n", "Ö", "o", "Ş", "s", "Ü", "u", "Ý", "y", "Ž", "z",
)

// Norm mirrors the SQL norm() function: Turkmen letters to Latin base letters, lowercased.
func Norm(s string) string { return strings.ToLower(turkmen.Replace(s)) }

// Slugify keeps a-z and 0-9 from Norm(s) and joins the runs with dashes.
// It returns "" when nothing usable is left (e.g. Cyrillic-only names).
func Slugify(s string) string {
	var b strings.Builder
	dash := false
	for _, r := range Norm(s) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
			dash = false
		} else if !dash && b.Len() > 0 {
			b.WriteByte('-')
			dash = true
		}
	}
	return strings.TrimSuffix(b.String(), "-")
}

var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

// EscapeLike escapes LIKE wildcards so user input matches literally.
func EscapeLike(s string) string { return likeEscaper.Replace(s) }
