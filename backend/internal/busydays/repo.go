package busydays

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"

	"wedding-rentals/backend/internal/db"
)

// listingExists reports whether id is a listing of any category. With publicOnly it
// must also be published in a published shop, the v1 visibility rule; with a non-zero
// shopID it must belong to that shop.
func listingExists(ctx context.Context, d db.DBTX, id int64, publicOnly bool, shopID int64) (bool, error) {
	var ok bool
	err := d.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM listings l
			JOIN shops s ON s.id = l.shop_id
			WHERE l.id = $1 AND (NOT $2 OR (l.is_published AND s.is_published))
			  AND ($3::bigint = 0 OR l.shop_id = $3))`, id, publicOnly, shopID).Scan(&ok)
	return ok, err
}

// List returns the listing's busy days inside w as sorted YYYY-MM-DD strings, never nil.
func List(ctx context.Context, d db.DBTX, listingID int64, w Window) ([]string, error) {
	rows, err := d.Query(ctx, `
		SELECT to_char(day, 'YYYY-MM-DD') FROM listing_busy_days
		WHERE listing_id = $1 AND day BETWEEN $2::date AND $3::date
		ORDER BY day`, listingID, formatDay(w.From), formatDay(w.To))
	if err != nil {
		return nil, err
	}
	days, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		return nil, err
	}
	if days == nil {
		days = []string{}
	}
	return days, nil
}

// Mark makes day busy; marking a busy day again changes nothing.
func Mark(ctx context.Context, d db.DBTX, listingID int64, day time.Time) error {
	_, err := d.Exec(ctx, `
		INSERT INTO listing_busy_days (listing_id, day) VALUES ($1, $2::date)
		ON CONFLICT DO NOTHING`, listingID, formatDay(day))
	return err
}

// Unmark makes day free; unmarking a free day changes nothing.
func Unmark(ctx context.Context, d db.DBTX, listingID int64, day time.Time) error {
	_, err := d.Exec(ctx, `DELETE FROM listing_busy_days WHERE listing_id = $1 AND day = $2::date`,
		listingID, formatDay(day))
	return err
}
