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

func TestLimiterFullAndAddCountOnlyAddedEvents(t *testing.T) {
	now := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	l := NewLimiter(3, 15*time.Minute)
	l.now = func() time.Time { return now }
	for i := 0; i < 3; i++ {
		if l.Full("+99365000001") {
			t.Fatalf("full after %d events", i)
		}
		l.Add("+99365000001")
	}
	if !l.Full("+99365000001") {
		t.Fatal("not full after 3 events")
	}
	// Checking does not record anything, and other keys are separate.
	for i := 0; i < 5; i++ {
		l.Full("+99365000002")
	}
	if l.Full("+99365000002") {
		t.Fatal("Full recorded events")
	}
	now = now.Add(15*time.Minute + time.Second)
	if l.Full("+99365000001") {
		t.Fatal("still full after the window passed")
	}
}
