package owners

import "testing"

func TestCommonPassword(t *testing.T) {
	for _, tc := range []struct {
		password, phone string
		want            bool
	}{
		{"123456", "", true},
		{"QWERTY", "", true},      // case does not matter
		{"  Gelin123 ", "", true}, // nor surrounding spaces
		{"пароль", "", true},
		{"111111", "", true}, // one repeated character
		{"aaaaaaa", "", true},
		{"234567", "", true},                  // digits going up
		{"987654", "", true},                  // digits going down
		{"65123456", "+99365123456", true},    // the phone's last 8 digits
		{"99365123456", "+99365123456", true}, // the whole phone number
		{"+99365123456", "+99365123456", true},
		{"65123456", "", false}, // fine when no phone is given (admin path)
		{"ak-gelin-24", "", false},
		{"abcdeg", "", false},
		{"135790", "", false},
		{"ab3d5ü", "+99365111112", false},
		{"bezeg7", "+99365123456", false},
	} {
		if got := commonPassword(tc.password, tc.phone); got != tc.want {
			t.Errorf("commonPassword(%q, %q) = %v, want %v", tc.password, tc.phone, got, tc.want)
		}
	}
}
