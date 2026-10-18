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
