package config_test

import (
	"strings"
	"testing"

	"wedding-rentals/backend/internal/config"
)

func setBase(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/x")
	t.Setenv("JWT_SECRET", strings.Repeat("s", 32))
	t.Setenv("UPLOAD_DIR", "")
	t.Setenv("WEB_DIR", "")
	t.Setenv("PORT", "")
	t.Setenv("PUBLIC_BASE_URL", "")
	t.Setenv("TRUSTED_PROXIES", "")
	t.Setenv("CONTACT_PHONE", "")
}

func TestLoadDefaults(t *testing.T) {
	setBase(t)
	c, err := config.Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if c.UploadDir != "./uploads" || c.WebDir != "../frontend/dist" || c.Port != "8080" || c.BaseURL != "http://localhost:8080" {
		t.Fatalf("unexpected defaults: %+v", c)
	}
}

func TestLoadRequiresDatabaseURL(t *testing.T) {
	setBase(t)
	t.Setenv("DATABASE_URL", "")
	if _, err := config.Load(); err == nil {
		t.Fatal("expected error for missing DATABASE_URL")
	}
}

func TestLoadRequiresLongSecret(t *testing.T) {
	setBase(t)
	t.Setenv("JWT_SECRET", "short")
	if _, err := config.Load(); err == nil {
		t.Fatal("expected error for short JWT_SECRET")
	}
}

func TestLoadTrustedProxies(t *testing.T) {
	setBase(t)
	c, err := config.Load()
	if err != nil || len(c.TrustedProxies) != 0 {
		t.Fatalf("empty: %v %v", c.TrustedProxies, err)
	}
	t.Setenv("TRUSTED_PROXIES", "10.0.0.1, 172.16.0.0/12 ,::1")
	c, err = config.Load()
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"10.0.0.1", "172.16.0.0/12", "::1"}
	if strings.Join(c.TrustedProxies, "|") != strings.Join(want, "|") {
		t.Fatalf("got %v", c.TrustedProxies)
	}
	t.Setenv("TRUSTED_PROXIES", "10.0.0.1,not-an-ip")
	if _, err := config.Load(); err == nil {
		t.Fatal("expected error for invalid proxy entry")
	}
}

func TestLoadContactPhone(t *testing.T) {
	setBase(t)
	c, err := config.Load()
	if err != nil || c.ContactPhone != "" {
		t.Fatalf("empty: %+v %v", c, err)
	}
	t.Setenv("CONTACT_PHONE", "  +993 12 34 56 78 ")
	c, err = config.Load()
	if err != nil || c.ContactPhone != "+993 12 34 56 78" {
		t.Fatalf("set: %q %v", c.ContactPhone, err)
	}
}
