// Package owners lets rental shops sign up and manage their own shop.
package owners

import "strings"

// NormalizePhone turns a Turkmen phone number as people type it ("+993 65 12-34-56",
// "8 65 123456", "65123456") into "+99365123456". It reports false for anything else.
func NormalizePhone(s string) (string, bool) {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	digits := b.String()
	switch {
	case len(digits) == 11 && strings.HasPrefix(digits, "993"):
		digits = digits[3:]
	case len(digits) == 9 && strings.HasPrefix(digits, "8"):
		digits = digits[1:]
	}
	if len(digits) != 8 {
		return "", false
	}
	return "+993" + digits, true
}
