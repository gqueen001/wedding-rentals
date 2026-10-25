package owners

import (
	"strings"
	"unicode"
)

// commonList holds passwords guessed first, whatever the rules below already cover.
var commonList = map[string]bool{}

func init() {
	for _, p := range strings.Fields(`
		123456 1234567 12345678 123456789 1234567890 654321 123123 112233 121212 1q2w3e 1q2w3e4r
		qwerty qwerty1 qwerty123 qwertyu asdfgh zxcvbn йцукен
		password password1 parol parol123 пароль abc123 abcdef iloveyou
		gelin gelin123 salon salon123 toy123 turkmenistan`) {
		commonList[p] = true
	}
}

// commonPassword reports whether a new password is too easy to guess: on the list, one repeated
// character, a run of digits (up or down), or, when phone is given, the phone number itself (its
// digits, however they are spaced, in full, local or 8-prefixed form).
func commonPassword(password, phone string) bool {
	p := strings.ToLower(strings.TrimSpace(password))
	if commonList[p] {
		return true
	}
	r := []rune(p)
	same, up, down := true, true, true
	for i := 1; i < len(r); i++ {
		same = same && r[i] == r[0]
		up = up && unicode.IsDigit(r[i]) && r[i] == r[i-1]+1
		down = down && unicode.IsDigit(r[i]) && r[i] == r[i-1]-1
	}
	if len(r) > 1 && (same || (unicode.IsDigit(r[0]) && (up || down))) {
		return true
	}
	if digits := onlyDigits(phone); digits != "" && strings.Trim(p, "0123456789+-() ") == "" {
		local := digits
		if len(local) > 8 {
			local = local[len(local)-8:]
		}
		if pd := onlyDigits(p); pd == digits || pd == local || pd == "8"+local {
			return true
		}
	}
	return false
}

func onlyDigits(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}
