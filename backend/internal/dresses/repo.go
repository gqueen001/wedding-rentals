package dresses

import (
	"context"

	"github.com/jackc/pgx/v5"

	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/images"
	"wedding-rentals/backend/internal/listing"
)

const selectAdmin = `
	SELECT l.id, l.shop_id, l.title, l.price_manat, l.price_is_from, l.description, l.is_published,
	       d.color, d.silhouette, d.sleeves, d.sizes, l.created_at, l.updated_at
	FROM listings l
	JOIN dress_details d ON d.listing_id = l.id`

func scanAdmin(row pgx.Row) (Dress, error) {
	var d Dress
	err := row.Scan(&d.ID, &d.ShopID, &d.Title, &d.PriceManat, &d.PriceIsFrom, &d.Description, &d.IsPublished,
		&d.Color, &d.Silhouette, &d.Sleeves, &d.Sizes, &d.CreatedAt, &d.UpdatedAt)
	return d, err
}

func Create(ctx context.Context, d db.DBTX, in Input) (int64, error) {
	var id int64
	err := db.InTx(ctx, d, func(tx pgx.Tx) error {
		err := tx.QueryRow(ctx, `
			INSERT INTO listings (shop_id, category_id, title, price_manat, price_is_from, description, is_published)
			VALUES ($1, (SELECT id FROM categories WHERE slug = 'dresses'), $2, $3, $4, $5, $6)
			RETURNING id`,
			in.ShopID, in.Title, in.PriceManat, in.PriceIsFrom, listing.NullIfEmpty(in.Description), in.IsPublished).Scan(&id)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO dress_details (listing_id, color, silhouette, sleeves, sizes)
			VALUES ($1, $2, $3, $4, $5)`, id, in.Color, in.Silhouette, in.Sleeves, in.Sizes)
		return err
	})
	return id, err
}

func Update(ctx context.Context, d db.DBTX, id int64, in Input) error {
	return db.InTx(ctx, d, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `
			UPDATE listings SET shop_id = $2, title = $3, price_manat = $4, price_is_from = $5,
			       description = $6, is_published = $7, updated_at = now()
			WHERE id = $1 AND category_id = (SELECT id FROM categories WHERE slug = 'dresses')`,
			id, in.ShopID, in.Title, in.PriceManat, in.PriceIsFrom, listing.NullIfEmpty(in.Description), in.IsPublished)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return pgx.ErrNoRows
		}
		_, err = tx.Exec(ctx, `
			UPDATE dress_details SET color = $2, silhouette = $3, sleeves = $4, sizes = $5, updated_at = now()
			WHERE listing_id = $1`, id, in.Color, in.Silhouette, in.Sleeves, in.Sizes)
		return err
	})
}

func Get(ctx context.Context, d db.DBTX, id int64) (Dress, error) {
	dress, err := scanAdmin(d.QueryRow(ctx, selectAdmin+` WHERE l.id = $1`, id))
	if err != nil {
		return Dress{}, err
	}
	dress.Images, err = images.ListForListing(ctx, d, id)
	return dress, err
}

// ListAdmin returns all dresses (published or not), optionally for one shop.
func ListAdmin(ctx context.Context, d db.DBTX, shopID int64) ([]Dress, error) {
	rows, err := d.Query(ctx, selectAdmin+` WHERE ($1::bigint = 0 OR l.shop_id = $1) ORDER BY l.created_at DESC, l.id DESC`, shopID)
	if err != nil {
		return nil, err
	}
	list := []Dress{}
	for rows.Next() {
		dress, err := scanAdmin(rows)
		if err != nil {
			rows.Close()
			return nil, err
		}
		list = append(list, dress)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i := range list {
		if list[i].Images, err = images.ListForListing(ctx, d, list[i].ID); err != nil {
			return nil, err
		}
	}
	return list, nil
}

func Delete(ctx context.Context, d db.DBTX, st images.Storage, id int64) error {
	paths, err := images.PathsForListing(ctx, d, id)
	if err != nil {
		return err
	}
	tag, err := d.Exec(ctx, `
		DELETE FROM listings WHERE id = $1 AND category_id = (SELECT id FROM categories WHERE slug = 'dresses')`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	images.DeleteFiles(st, paths)
	return nil
}
