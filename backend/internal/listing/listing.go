// Package listing holds what every kind of listing shares: the public card types,
// the browse query (city, price, search, ids, paging) and the basic field checks.
package listing

import (
	"math"
	"strings"
	"unicode/utf8"
)

type CityRef struct {
	Slug   string `json:"slug"`
	NameTK string `json:"name_tk"`
	NameRU string `json:"name_ru"`
	NameEN string `json:"name_en"`
}

type ShopRef struct {
	Name string `json:"name"`
	Slug string `json:"slug"`
}

type ShopCard struct {
	Name         string  `json:"name"`
	Slug         string  `json:"slug"`
	Address      string  `json:"address"`
	Phone        string  `json:"phone"`
	InstagramURL *string `json:"instagram_url"`
	TikTokURL    *string `json:"tiktok_url"`
	Logo         *string `json:"logo"`
	City         CityRef `json:"city"`
}

// Page is one page of public list results.
type Page[T any] struct {
	Items   []T `json:"items"`
	Page    int `json:"page"`
	PerPage int `json:"per_page"`
	Total   int `json:"total"`
}

// Basics are the fields every listing has.
type Basics struct {
	ShopID      int64  `json:"shop_id"`
	Title       string `json:"title"`
	PriceManat  int    `json:"price_manat"`
	PriceIsFrom bool   `json:"price_is_from"`
	Description string `json:"description"`
	IsPublished bool   `json:"is_published"`
}

func (b *Basics) Normalize() {
	b.Title = strings.TrimSpace(b.Title)
	b.Description = strings.TrimSpace(b.Description)
}

// Validate adds the basic fields' errors to errs.
func (b Basics) Validate(errs map[string]string) {
	if b.ShopID <= 0 {
		errs["shop_id"] = "required"
	}
	if b.Title == "" {
		errs["title"] = "required"
	} else if utf8.RuneCountInString(b.Title) > 200 {
		errs["title"] = "too_long"
	}
	if b.PriceManat <= 0 {
		errs["price_manat"] = "must_be_positive"
	} else if b.PriceManat > math.MaxInt32 {
		errs["price_manat"] = "too_large"
	}
}

func NullIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
