package images

import (
	"context"

	"github.com/jackc/pgx/v5"

	"wedding-rentals/backend/internal/db"
)

func ListForListing(ctx context.Context, d db.DBTX, listingID int64) ([]Image, error) {
	rows, err := d.Query(ctx, `
		SELECT id, position, path_small, path_large, width, height
		FROM images WHERE listing_id = $1 ORDER BY position, id`, listingID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []Image{}
	for rows.Next() {
		var img Image
		var small, large string
		if err := rows.Scan(&img.ID, &img.Position, &small, &large, &img.Width, &img.Height); err != nil {
			return nil, err
		}
		img.Small, img.Large = URL(small), URL(large)
		list = append(list, img)
	}
	return list, rows.Err()
}

func PathsForListing(ctx context.Context, d db.DBTX, listingID int64) ([]string, error) {
	rows, err := d.Query(ctx, `SELECT path_small, path_large FROM images WHERE listing_id = $1`, listingID)
	if err != nil {
		return nil, err
	}
	return collectPaths(rows)
}

// PathsForShop returns the files of the shop logo and of all its listings.
func PathsForShop(ctx context.Context, d db.DBTX, shopID int64) ([]string, error) {
	rows, err := d.Query(ctx, `
		SELECT path_small, path_large FROM images
		WHERE shop_id = $1 OR listing_id IN (SELECT id FROM listings WHERE shop_id = $1)`, shopID)
	if err != nil {
		return nil, err
	}
	return collectPaths(rows)
}

func collectPaths(rows pgx.Rows) ([]string, error) {
	defer rows.Close()
	var paths []string
	for rows.Next() {
		var small, large string
		if err := rows.Scan(&small, &large); err != nil {
			return nil, err
		}
		paths = append(paths, small, large)
	}
	return paths, rows.Err()
}
