package shops

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"

	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/images"
	"wedding-rentals/backend/internal/textnorm"
)

const selectShop = `
	SELECT s.id, s.slug, s.name, s.city_id, s.address, s.phone, s.instagram_url, s.tiktok_url,
	       s.description, s.is_published, s.created_at, s.updated_at,
	       COALESCE((SELECT array_agg(a.alias ORDER BY a.id) FROM shop_aliases a WHERE a.shop_id = s.id), '{}'),
	       li.id, li.position, li.path_small, li.path_large, li.width, li.height,
	       o.id, o.phone
	FROM shops s
	LEFT JOIN images li ON li.id = s.logo_image_id
	LEFT JOIN shop_owners o ON o.shop_id = s.id`

func scanShop(row pgx.Row) (Shop, error) {
	var s Shop
	var logoID *int64
	var logoPos, logoW, logoH *int
	var logoSmall, logoLarge *string
	var ownerID *int64
	var ownerPhone *string
	err := row.Scan(&s.ID, &s.Slug, &s.Name, &s.CityID, &s.Address, &s.Phone, &s.InstagramURL, &s.TikTokURL,
		&s.Description, &s.IsPublished, &s.CreatedAt, &s.UpdatedAt, &s.Aliases,
		&logoID, &logoPos, &logoSmall, &logoLarge, &logoW, &logoH, &ownerID, &ownerPhone)
	if err != nil {
		return Shop{}, err
	}
	if logoID != nil {
		s.Logo = &images.Image{ID: *logoID, Position: *logoPos, Small: images.URL(*logoSmall),
			Large: images.URL(*logoLarge), Width: *logoW, Height: *logoH}
	}
	if ownerID != nil {
		s.Owner = &Owner{ID: *ownerID, Phone: *ownerPhone}
	}
	return s, nil
}

func Create(ctx context.Context, d db.DBTX, in Input) (int64, error) {
	var id int64
	err := db.InTx(ctx, d, func(tx pgx.Tx) error {
		slug, err := uniqueSlug(ctx, tx, in.Name)
		if err != nil {
			return err
		}
		err = tx.QueryRow(ctx, `
			INSERT INTO shops (slug, name, city_id, address, phone, instagram_url, tiktok_url, description, is_published)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
			slug, in.Name, in.CityID, in.Address, in.Phone, nullIfEmpty(in.InstagramURL),
			nullIfEmpty(in.TikTokURL), nullIfEmpty(in.Description), in.IsPublished).Scan(&id)
		if err != nil {
			return err
		}
		return replaceAliases(ctx, tx, id, in.Aliases)
	})
	return id, err
}

// Update changes everything except the slug, which stays stable for shared links.
func Update(ctx context.Context, d db.DBTX, id int64, in Input) error {
	return db.InTx(ctx, d, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `
			UPDATE shops SET name = $2, city_id = $3, address = $4, phone = $5, instagram_url = $6,
			       tiktok_url = $7, description = $8, is_published = $9, updated_at = now()
			WHERE id = $1`,
			id, in.Name, in.CityID, in.Address, in.Phone, nullIfEmpty(in.InstagramURL),
			nullIfEmpty(in.TikTokURL), nullIfEmpty(in.Description), in.IsPublished)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return pgx.ErrNoRows
		}
		return replaceAliases(ctx, tx, id, in.Aliases)
	})
}

func replaceAliases(ctx context.Context, tx pgx.Tx, shopID int64, aliases []string) error {
	if _, err := tx.Exec(ctx, `DELETE FROM shop_aliases WHERE shop_id = $1`, shopID); err != nil {
		return err
	}
	if len(aliases) == 0 {
		return nil
	}
	_, err := tx.Exec(ctx, `INSERT INTO shop_aliases (shop_id, alias) SELECT $1, unnest($2::text[])`, shopID, aliases)
	return err
}

func Get(ctx context.Context, d db.DBTX, id int64) (Shop, error) {
	return scanShop(d.QueryRow(ctx, selectShop+` WHERE s.id = $1`, id))
}

func List(ctx context.Context, d db.DBTX) ([]Shop, error) {
	rows, err := d.Query(ctx, selectShop+` ORDER BY s.name, s.id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []Shop{}
	for rows.Next() {
		s, err := scanShop(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, s)
	}
	return list, rows.Err()
}

// Delete removes the shop (its listings, aliases and images cascade) and its files.
func Delete(ctx context.Context, d db.DBTX, st images.Storage, id int64) error {
	paths, err := images.PathsForShop(ctx, d, id)
	if err != nil {
		return err
	}
	tag, err := d.Exec(ctx, `DELETE FROM shops WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	images.DeleteFiles(st, paths)
	return nil
}

func uniqueSlug(ctx context.Context, d db.DBTX, name string) (string, error) {
	base := textnorm.Slugify(name)
	if base == "" {
		base = "shop"
	}
	slug := base
	for i := 2; ; i++ {
		var exists bool
		if err := d.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM shops WHERE slug = $1)`, slug).Scan(&exists); err != nil {
			return "", err
		}
		if !exists {
			return slug, nil
		}
		slug = fmt.Sprintf("%s-%d", base, i)
	}
}
