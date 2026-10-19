package auth_test

import (
	"strings"
	"testing"
	"time"

	"wedding-rentals/backend/internal/auth"
)

var secret = strings.Repeat("k", 32)

func TestIssueAndVerify(t *testing.T) {
	tok := auth.NewTokens(secret, auth.TokenTTL)
	s, err := tok.Issue(42)
	if err != nil {
		t.Fatal(err)
	}
	id, err := tok.Verify(s)
	if err != nil || id != 42 {
		t.Fatalf("Verify = %d, %v", id, err)
	}
}

func TestVerifyRejectsOtherSecret(t *testing.T) {
	s, _ := auth.NewTokens(strings.Repeat("x", 32), auth.TokenTTL).Issue(1)
	if _, err := auth.NewTokens(secret, auth.TokenTTL).Verify(s); err == nil {
		t.Fatal("expected signature error")
	}
}

func TestVerifyRejectsExpired(t *testing.T) {
	past := func() time.Time { return time.Now().Add(-8 * 24 * time.Hour) }
	s, _ := auth.NewTokens(secret, auth.TokenTTL).WithClock(past).Issue(1)
	if _, err := auth.NewTokens(secret, auth.TokenTTL).Verify(s); err == nil {
		t.Fatal("expected expiry error")
	}
}
