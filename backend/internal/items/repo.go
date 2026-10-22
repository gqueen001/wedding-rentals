package items

import (
	"context"

	"github.com/jackc/pgx/v5"

	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/images"
	"wedding-rentals/backend/internal/listing"
)

// notDress limits a statement to the categories this package manages.
const notDress = `l.category_id <> (SELECT id FROM categories WHERE slug = 'dresses')`

const selectItem = `
	SELECT l.id, l.shop_id, cat.slug, l.title, l.price_manat, l.price_is_from, l.description, l.is_published,
	       l.attributes, l.created_at, l.updated_at
	FROM listings l JOIN categories cat ON cat.id = l.category_id`

func Create(ctx context.Context, d db.DBTX, in Input) (int64, error) {
	var id int64
	err := d.QueryRow(ctx, `
		INSERT INTO listings (shop_id, category_id, title, price_manat, price_is_from, description, is_published, attributes)
		VALUES ($1, (SELECT id FROM categories WHERE slug = $2), $3, $4, $5, $6, $7, $8)
		RETURNING id`,
		in.ShopID, in.Category, in.Title, in.PriceManat, in.PriceIsFrom, listing.NullIfEmpty(in.Description),
		in.IsPublished, in.Attributes).Scan(&id)
	return id, err
}

// Update saves everything but the category; pgx.ErrNoRows if id is no such item.
func Update(ctx context.Context, d db.DBTX, id int64, in Input) error {
	tag, err := d.Exec(ctx, `
		UPDATE listings l SET shop_id = $2, title = $3, price_manat = $4, price_is_from = $5,
		       description = $6, is_published = $7, attributes = $8, updated_at = now()
		WHERE l.id = $1 AND `+notDress,
		id, in.ShopID, in.Title, in.PriceManat, in.PriceIsFrom, listing.NullIfEmpty(in.Description), in.IsPublished,
		in.Attributes)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// Get returns one non-dress item with its images; pgx.ErrNoRows for a dress or no row.
func Get(ctx context.Context, d db.DBTX, id int64) (Item, error) {
	var it Item
	err := d.QueryRow(ctx, selectItem+` WHERE l.id = $1 AND `+notDress, id).Scan(
		&it.ID, &it.ShopID, &it.Category, &it.Title, &it.PriceManat, &it.PriceIsFrom, &it.Description,
		&it.IsPublished, &it.Attributes, &it.CreatedAt, &it.UpdatedAt)
	if err != nil {
		return Item{}, err
	}
	it.Images, err = images.ListForListing(ctx, d, id)
	return it, err
}

// ListAdmin returns every listing in every category (published or not), newest first,
// optionally for one shop and one category.
func ListAdmin(ctx context.Context, d db.DBTX, shopID int64, category string) ([]Summary, error) {
	rows, err := d.Query(ctx, `
		SELECT l.id, l.shop_id, cat.slug, l.title, l.price_manat, l.price_is_from, l.is_published, l.attributes,
		       (SELECT i.path_small FROM images i WHERE i.listing_id = l.id ORDER BY i.position, i.id LIMIT 1),
		       l.created_at, l.updated_at
		FROM listings l JOIN categories cat ON cat.id = l.category_id
		WHERE ($1::bigint = 0 OR l.shop_id = $1) AND ($2 = '' OR cat.slug = $2)
		ORDER BY l.created_at DESC, l.id DESC`, shopID, category)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []Summary{}
	for rows.Next() {
		var s Summary
		var photo *string
		if err := rows.Scan(&s.ID, &s.ShopID, &s.Category, &s.Title, &s.PriceManat, &s.PriceIsFrom, &s.IsPublished,
			&s.Attributes, &photo, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		s.Photo = photoURL(photo)
		list = append(list, s)
	}
	return list, rows.Err()
}

// Delete removes a non-dress item with its photos (files too) and busy days.
func Delete(ctx context.Context, d db.DBTX, st images.Storage, id int64) error {
	paths, err := images.PathsForListing(ctx, d, id)
	if err != nil {
		return err
	}
	tag, err := d.Exec(ctx, `DELETE FROM listings l WHERE l.id = $1 AND `+notDress, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	images.DeleteFiles(st, paths)
	return nil
}
