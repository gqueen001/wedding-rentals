package config

import (
	"errors"
	"fmt"
	"net"
	"net/netip"
	"os"
	"strings"
)

type Config struct {
	DatabaseURL string
	JWTSecret   string
	UploadDir   string
	WebDir      string
	Port        string
	BaseURL     string
	// TrustedProxies lists IPs/CIDRs whose X-Forwarded-For is honoured; empty trusts none.
	TrustedProxies []string
}

func Load() (Config, error) {
	c := Config{
		DatabaseURL: os.Getenv("DATABASE_URL"),
		JWTSecret:   os.Getenv("JWT_SECRET"),
		UploadDir:   getenv("UPLOAD_DIR", "./uploads"),
		WebDir:      getenv("WEB_DIR", "../frontend/dist"),
		Port:        getenv("PORT", "8080"),
		BaseURL:     getenv("PUBLIC_BASE_URL", "http://localhost:8080"),
	}
	if c.DatabaseURL == "" {
		return Config{}, errors.New("DATABASE_URL is required")
	}
	if len(c.JWTSecret) < 32 {
		return Config{}, errors.New("JWT_SECRET must be at least 32 characters")
	}
	proxies, err := parseProxies(os.Getenv("TRUSTED_PROXIES"))
	if err != nil {
		return Config{}, err
	}
	c.TrustedProxies = proxies
	return c, nil
}

func parseProxies(raw string) ([]string, error) {
	var out []string
	for _, e := range strings.Split(raw, ",") {
		e = strings.TrimSpace(e)
		if e == "" {
			continue
		}
		if _, err := netip.ParseAddr(e); err != nil {
			if _, _, err := net.ParseCIDR(e); err != nil {
				return nil, fmt.Errorf("TRUSTED_PROXIES: %q is not a valid IP or CIDR", e)
			}
		}
		out = append(out, e)
	}
	return out, nil
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
