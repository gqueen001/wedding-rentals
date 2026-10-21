// Package items serves every category except dresses (which keep their own package):
// cars, national clothes, tents and car decorations, with fields from internal/catalog.
// Its public list and search cover all categories, dresses included.
package items

import (
	"time"

	"wedding-rentals/backend/internal/images"
	"wedding-rentals/backend/internal/listing"
)

// Input is the admin or owner request body. On update, Category is ignored: an item
// keeps the category it was created with.
type Input struct {
	listing.Basics
	Category   string         `json:"category"`
	Attributes map[string]any `json:"attributes"`
}

// Item is one non-dress listing as admins and owners edit it.
type Item struct {
	ID          int64          `json:"id"`
	ShopID      int64          `json:"shop_id"`
	Category    string         `json:"category"`
	Title       string         `json:"title"`
	PriceManat  int            `json:"price_manat"`
	PriceIsFrom bool           `json:"price_is_from"`
	Description *string        `json:"description"`
	IsPublished bool           `json:"is_published"`
	Attributes  map[string]any `json:"attributes"`
	Images      []images.Image `json:"images"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

// Summary is one row of the admin and owner listing lists, in any category.
type Summary struct {
	ID          int64          `json:"id"`
	ShopID      int64          `json:"shop_id"`
	Category    string         `json:"category"`
	Title       string         `json:"title"`
	PriceManat  int            `json:"price_manat"`
	PriceIsFrom bool           `json:"price_is_from"`
	IsPublished bool           `json:"is_published"`
	Attributes  map[string]any `json:"attributes"`
	Photo       *string        `json:"photo"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

// ListItem is one public list result, in any category (dresses have empty attributes).
type ListItem struct {
	ID          int64           `json:"id"`
	Category    string          `json:"category"`
	Title       string          `json:"title"`
	PriceManat  int             `json:"price_manat"`
	PriceIsFrom bool            `json:"price_is_from"`
	Attributes  map[string]any  `json:"attributes"`
	Photo       *string         `json:"photo"`
	Shop        listing.ShopRef `json:"shop"`
	City        listing.CityRef `json:"city"`
}

type Page = listing.Page[ListItem]

// PublicItem is one published listing for its public page.
type PublicItem struct {
	ID          int64            `json:"id"`
	Category    string           `json:"category"`
	Title       string           `json:"title"`
	PriceManat  int              `json:"price_manat"`
	PriceIsFrom bool             `json:"price_is_from"`
	Description *string          `json:"description"`
	Attributes  map[string]any   `json:"attributes"`
	Images      []images.Image   `json:"images"`
	Shop        listing.ShopCard `json:"shop"`
}
