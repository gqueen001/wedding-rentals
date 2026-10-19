package auth

import (
	"testing"
	"time"
)

func TestLimiterAllowsMaxPerWindow(t *testing.T) {
	now := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	l := NewLimiter(5, time.Minute)
	l.now = func() time.Time { return now }
	for i := 0; i < 5; i++ {
		if !l.Allow("1.2.3.4") {
			t.Fatalf("attempt %d blocked", i+1)
		}
	}
	if l.Allow("1.2.3.4") {
		t.Fatal("6th attempt allowed")
	}
	if !l.Allow("5.6.7.8") {
		t.Fatal("other IP blocked")
	}
	now = now.Add(61 * time.Second)
	if !l.Allow("1.2.3.4") {
		t.Fatal("not allowed after window passed")
	}
}
