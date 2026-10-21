package auth_test

import (
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

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

func TestAudiencesAreSeparate(t *testing.T) {
	tok := auth.NewTokens(secret, auth.TokenTTL)
	admin, _ := tok.Issue(7)
	shop, _ := tok.IssueShop(7, 3)
	if _, err := tok.Verify(shop); err == nil {
		t.Fatal("admin Verify accepted a shop token")
	}
	if _, _, err := tok.VerifyShop(admin); err == nil {
		t.Fatal("VerifyShop accepted an admin token")
	}
	id, ver, err := tok.VerifyShop(shop)
	if err != nil || id != 7 || ver != 3 {
		t.Fatalf("VerifyShop = %d, %d, %v", id, ver, err)
	}
}

// A token minted before audiences existed (no aud claim) is rejected everywhere.
func TestVerifyRejectsTokensWithoutAudience(t *testing.T) {
	legacy := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{
		Subject:   "7",
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
	})
	s, err := legacy.SignedString([]byte(secret))
	if err != nil {
		t.Fatal(err)
	}
	tok := auth.NewTokens(secret, auth.TokenTTL)
	if _, err := tok.Verify(s); err == nil {
		t.Fatal("Verify accepted a token without an audience")
	}
	if _, _, err := tok.VerifyShop(s); err == nil {
		t.Fatal("VerifyShop accepted a token without an audience")
	}
}
