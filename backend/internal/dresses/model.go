package dresses

import (
	"math"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"wedding-rentals/backend/internal/images"
)

var (
	Colors      = []string{"white", "ivory", "champagne", "blush", "other"}
	Silhouettes = []string{"ball_gown", "a_line", "mermaid", "straight", "short"}
	SleeveTypes = []string{"long", "short", "none"}
	Sizes       = []string{"XS", "S", "M", "L", "XL", "XXL"}
)

type Input struct {
	ShopID      int64    `json:"shop_id"`
	Title       string   `json:"title"`
	PriceManat  int      `json:"price_manat"`
	PriceIsFrom bool     `json:"price_is_from"`
	Description string   `json:"description"`
	IsPublished bool     `json:"is_published"`
	Color       string   `json:"color"`
	Silhouette  string   `json:"silhouette"`
	Sleeves     string   `json:"sleeves"`
	Sizes       []string `json:"sizes"`
}

type Dress struct {
	ID          int64          `json:"id"`
	ShopID      int64          `json:"shop_id"`
	Title       string         `json:"title"`
	PriceManat  int            `json:"price_manat"`
	PriceIsFrom bool           `json:"price_is_from"`
	Description *string        `json:"description"`
	IsPublished bool           `json:"is_published"`
	Color       string         `json:"color"`
	Silhouette  string         `json:"silhouette"`
	Sleeves     string         `json:"sleeves"`
	Sizes       []string       `json:"sizes"`
	Images      []images.Image `json:"images"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

func (in *Input) normalize() {
	in.Title = strings.TrimSpace(in.Title)
	in.Description = strings.TrimSpace(in.Description)
}

func (in Input) validate() map[string]string {
	errs := map[string]string{}
	if in.ShopID <= 0 {
		errs["shop_id"] = "required"
	}
	if in.Title == "" {
		errs["title"] = "required"
	} else if utf8.RuneCountInString(in.Title) > 200 {
		errs["title"] = "too_long"
	}
	if in.PriceManat <= 0 {
		errs["price_manat"] = "must_be_positive"
	} else if in.PriceManat > math.MaxInt32 {
		errs["price_manat"] = "too_large"
	}
	if !slices.Contains(Colors, in.Color) {
		errs["color"] = "invalid"
	}
	if !slices.Contains(Silhouettes, in.Silhouette) {
		errs["silhouette"] = "invalid"
	}
	if !slices.Contains(SleeveTypes, in.Sleeves) {
		errs["sleeves"] = "invalid"
	}
	if len(in.Sizes) == 0 {
		errs["sizes"] = "required"
	}
	for _, s := range in.Sizes {
		if !slices.Contains(Sizes, s) {
			errs["sizes"] = "invalid"
		}
	}
	return errs
}

// canonicalSizes de-duplicates valid sizes and orders them XS..XXL.
func canonicalSizes(in []string) []string {
	out := []string{}
	for _, s := range Sizes {
		if slices.Contains(in, s) {
			out = append(out, s)
		}
	}
	return out
}

func nullIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
