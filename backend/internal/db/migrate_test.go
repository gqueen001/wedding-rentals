package db_test

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

	"wedding-rentals/backend/internal/testutil"
)

func TestSeedData(t *testing.T) {
	tx := testutil.Tx(t)
	ctx := context.Background()
	var cities int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM cities`).Scan(&cities); err != nil {
		t.Fatal(err)
	}
	if cities != 9 {
		t.Fatalf("cities = %d, want 9", cities)
	}
	var slug string
	if err := tx.QueryRow(ctx, `SELECT slug FROM categories`).Scan(&slug); err != nil {
		t.Fatal(err)
	}
	if slug != "dresses" {
		t.Fatalf("category = %q", slug)
	}
}

func TestNormFunction(t *testing.T) {
	tx := testutil.Tx(t)
	var got string
	if err := tx.QueryRow(context.Background(), `SELECT norm('Gelin Öýi ÄÇŇŞÜÝŽ')`).Scan(&got); err != nil {
		t.Fatal(err)
	}
	if got != "gelin oyi acnsuyz" {
		t.Fatalf("norm = %q", got)
	}
}

func TestDressDetailsRejectsUnknownColor(t *testing.T) {
	tx := testutil.Tx(t)
	shop := testutil.InsertShop(t, tx, testutil.ShopFixture{})
	id := testutil.InsertDress(t, tx, testutil.DressFixture{ShopID: shop.ID})
	_, err := tx.Exec(context.Background(), `UPDATE dress_details SET color = 'purple' WHERE listing_id = $1`, id)
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "23514" {
		t.Fatalf("want check violation 23514, got %v", err)
	}
}
