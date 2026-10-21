package auth

import (
	"errors"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const TokenTTL = 7 * 24 * time.Hour

// Audiences keep admin and shop-owner tokens apart: each middleware accepts only its own.
const (
	AudienceAdmin = "admin"
	AudienceShop  = "shop"
)

type Tokens struct {
	secret []byte
	ttl    time.Duration
	now    func() time.Time
}

func NewTokens(secret string, ttl time.Duration) *Tokens {
	return &Tokens{secret: []byte(secret), ttl: ttl, now: time.Now}
}

// WithClock returns a copy that reads the time from now (tests use it for expiry).
func (t *Tokens) WithClock(now func() time.Time) *Tokens {
	c := *t
	c.now = now
	return &c
}

type claims struct {
	jwt.RegisteredClaims
	// Version is the shop owner's token_version; admin tokens leave it zero.
	Version int `json:"ver,omitempty"`
}

func (t *Tokens) issue(audience string, id int64, version int) (string, error) {
	now := t.now()
	c := claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   strconv.FormatInt(id, 10),
			Audience:  jwt.ClaimStrings{audience},
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(t.ttl)),
		},
		Version: version,
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString(t.secret)
}

func (t *Tokens) verify(audience, token string) (int64, int, error) {
	c := &claims{}
	_, err := jwt.ParseWithClaims(token, c,
		func(*jwt.Token) (any, error) { return t.secret, nil },
		jwt.WithValidMethods([]string{"HS256"}),
		jwt.WithTimeFunc(t.now),
		jwt.WithExpirationRequired(),
		jwt.WithAudience(audience),
	)
	if err != nil {
		return 0, 0, err
	}
	id, err := strconv.ParseInt(c.Subject, 10, 64)
	if err != nil || id <= 0 {
		return 0, 0, errors.New("invalid token subject")
	}
	return id, c.Version, nil
}

// Issue signs an admin token for adminID.
func (t *Tokens) Issue(adminID int64) (string, error) { return t.issue(AudienceAdmin, adminID, 0) }

// Verify accepts only admin tokens and returns the admin's id.
func (t *Tokens) Verify(token string) (int64, error) {
	id, _, err := t.verify(AudienceAdmin, token)
	return id, err
}

// IssueShop signs a shop-owner token carrying the owner's current token version.
func (t *Tokens) IssueShop(ownerID int64, version int) (string, error) {
	return t.issue(AudienceShop, ownerID, version)
}

// VerifyShop accepts only shop-owner tokens and returns the owner's id and token version.
func (t *Tokens) VerifyShop(token string) (ownerID int64, version int, err error) {
	return t.verify(AudienceShop, token)
}
