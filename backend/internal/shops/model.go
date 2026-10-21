package shops

import (
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"wedding-rentals/backend/internal/images"
)

type Input struct {
	Name         string   `json:"name"`
	CityID       int64    `json:"city_id"`
	Address      string   `json:"address"`
	Phone        string   `json:"phone"`
	InstagramURL string   `json:"instagram_url"`
	TikTokURL    string   `json:"tiktok_url"`
	Description  string   `json:"description"`
	IsPublished  bool     `json:"is_published"`
	Aliases      []string `json:"aliases"`
}

type Shop struct {
	ID           int64         `json:"id"`
	Slug         string        `json:"slug"`
	Name         string        `json:"name"`
	CityID       int64         `json:"city_id"`
	Address      string        `json:"address"`
	Phone        string        `json:"phone"`
	InstagramURL *string       `json:"instagram_url"`
	TikTokURL    *string       `json:"tiktok_url"`
	Description  *string       `json:"description"`
	IsPublished  bool          `json:"is_published"`
	Logo         *images.Image `json:"logo"`
	Aliases      []string      `json:"aliases"`
	Owner        *Owner        `json:"owner"`
	CreatedAt    time.Time     `json:"created_at"`
	UpdatedAt    time.Time     `json:"updated_at"`
}

// Owner is the shop-owner account that manages a shop, if it has one.
type Owner struct {
	ID    int64  `json:"id"`
	Phone string `json:"phone"`
}

var phoneRe = regexp.MustCompile(`^\+?[0-9 ()-]{6,20}$`)

// normalize trims strings and de-duplicates aliases case-insensitively.
func (in *Input) normalize() {
	in.Name = strings.TrimSpace(in.Name)
	in.Address = strings.TrimSpace(in.Address)
	in.Phone = strings.TrimSpace(in.Phone)
	in.InstagramURL = strings.TrimSpace(in.InstagramURL)
	in.TikTokURL = strings.TrimSpace(in.TikTokURL)
	in.Description = strings.TrimSpace(in.Description)
	seen := map[string]bool{}
	aliases := []string{}
	for _, a := range in.Aliases {
		a = strings.TrimSpace(a)
		key := strings.ToLower(a)
		if a == "" || seen[key] {
			continue
		}
		seen[key] = true
		aliases = append(aliases, a)
	}
	in.Aliases = aliases
}

func (in Input) validate() map[string]string {
	errs := map[string]string{}
	if in.Name == "" {
		errs["name"] = "required"
	} else if utf8.RuneCountInString(in.Name) > 200 {
		errs["name"] = "too_long"
	}
	if in.CityID <= 0 {
		errs["city_id"] = "required"
	}
	if in.Address == "" {
		errs["address"] = "required"
	}
	if in.Phone == "" {
		errs["phone"] = "required"
	} else if !phoneRe.MatchString(in.Phone) {
		errs["phone"] = "invalid"
	}
	if in.InstagramURL != "" && !strings.HasPrefix(in.InstagramURL, "https://") {
		errs["instagram_url"] = "invalid"
	}
	if in.TikTokURL != "" && !strings.HasPrefix(in.TikTokURL, "https://") {
		errs["tiktok_url"] = "invalid"
	}
	if len(in.Aliases) > 20 {
		errs["aliases"] = "too_many"
	}
	return errs
}

func nullIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
