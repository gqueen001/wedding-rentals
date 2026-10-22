package testutil

import (
	"context"
	"fmt"
	"sync/atomic"
	"testing"

	"wedding-rentals/backend/internal/db"
)

var seq atomic.Int64

type ShopFixture struct {
	Name     string
	CitySlug string // default "ashgabat"
	Hidden   bool   // default: published
	Aliases  []string
}

type ShopRow struct {
	ID   int64
	Slug string
}

func InsertShop(t *testing.T, d db.DBTX, f ShopFixture) ShopRow {
	t.Helper()
	ctx := context.Background()
	if f.Name == "" {
		f.Name = "Test Shop"
	}
	if f.CitySlug == "" {
		f.CitySlug = "ashgabat"
	}
	row := ShopRow{Slug: fmt.Sprintf("fixture-shop-%d", seq.Add(1))}
	err := d.QueryRow(ctx, `
		INSERT INTO shops (slug, name, city_id, address, phone, is_published)
		VALUES ($1, $2, (SELECT id FROM cities WHERE slug = $3), 'Test address 1', '+99365000000', $4)
		RETURNING id`, row.Slug, f.Name, f.CitySlug, !f.Hidden).Scan(&row.ID)
	if err != nil {
		t.Fatalf("insert shop: %v", err)
	}
	for _, a := range f.Aliases {
		if _, err := d.Exec(ctx, `INSERT INTO shop_aliases (shop_id, alias) VALUES ($1, $2)`, row.ID, a); err != nil {
			t.Fatalf("insert alias: %v", err)
		}
	}
	return row
}

type DressFixture struct {
	ShopID     int64
	Title      string   // default "Test dress"
	Price      int      // default 1000
	Color      string   // default "white"
	Silhouette string   // default "a_line"
	Sleeves    string   // default "long"
	Sizes      []string // default {"M"}
	Hidden     bool     // default: published
}

func InsertDress(t *testing.T, d db.DBTX, f DressFixture) int64 {
	t.Helper()
	ctx := context.Background()
	if f.Title == "" {
		f.Title = "Test dress"
	}
	if f.Price == 0 {
		f.Price = 1000
	}
	if f.Color == "" {
		f.Color = "white"
	}
	if f.Silhouette == "" {
		f.Silhouette = "a_line"
	}
	if f.Sleeves == "" {
		f.Sleeves = "long"
	}
	if len(f.Sizes) == 0 {
		f.Sizes = []string{"M"}
	}
	var id int64
	err := d.QueryRow(ctx, `
		INSERT INTO listings (shop_id, category_id, title, price_manat, is_published)
		VALUES ($1, (SELECT id FROM categories WHERE slug = 'dresses'), $2, $3, $4)
		RETURNING id`, f.ShopID, f.Title, f.Price, !f.Hidden).Scan(&id)
	if err != nil {
		t.Fatalf("insert listing: %v", err)
	}
	_, err = d.Exec(ctx, `
		INSERT INTO dress_details (listing_id, color, silhouette, sleeves, sizes)
		VALUES ($1, $2, $3, $4, $5)`, id, f.Color, f.Silhouette, f.Sleeves, f.Sizes)
	if err != nil {
		t.Fatalf("insert dress_details: %v", err)
	}
	return id
}

// InsertImage stores image paths name+"_s.jpg" and name+"_l.jpg" for a listing.
func InsertImage(t *testing.T, d db.DBTX, listingID int64, position int, name string) int64 {
	t.Helper()
	var id int64
	err := d.QueryRow(context.Background(), `
		INSERT INTO images (listing_id, position, path_small, path_large, width, height)
		VALUES ($1, $2, $3, $4, 1200, 1600) RETURNING id`,
		listingID, position, name+"_s.jpg", name+"_l.jpg").Scan(&id)
	if err != nil {
		t.Fatalf("insert image: %v", err)
	}
	return id
}

type ItemFixture struct {
	ShopID     int64
	Category   string         // a non-dress category slug, e.g. "cars"
	Title      string         // default "Test item"
	Price      int            // default 1000
	Attributes map[string]any // stored as given, not validated
	Hidden     bool           // default: published
}

// InsertItem stores a non-dress listing with its attributes.
func InsertItem(t *testing.T, d db.DBTX, f ItemFixture) int64 {
	t.Helper()
	if f.Title == "" {
		f.Title = "Test item"
	}
	if f.Price == 0 {
		f.Price = 1000
	}
	if f.Attributes == nil {
		f.Attributes = map[string]any{}
	}
	var id int64
	err := d.QueryRow(context.Background(), `
		INSERT INTO listings (shop_id, category_id, title, price_manat, is_published, attributes)
		VALUES ($1, (SELECT id FROM categories WHERE slug = $2), $3, $4, $5, $6)
		RETURNING id`, f.ShopID, f.Category, f.Title, f.Price, !f.Hidden, f.Attributes).Scan(&id)
	if err != nil {
		t.Fatalf("insert item: %v", err)
	}
	return id
}
