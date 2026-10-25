package owners

import (
	"context"

	"github.com/jackc/pgx/v5"

	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/shops"
)

// Owner is a shop-owner account. Each owner manages exactly one shop.
type Owner struct {
	ID           int64
	ShopID       int64
	Phone        string
	PasswordHash string
	TokenVersion int
}

const selectOwner = `SELECT id, shop_id, phone, password_hash, token_version FROM shop_owners`

func scanOwner(row pgx.Row) (Owner, error) {
	var o Owner
	err := row.Scan(&o.ID, &o.ShopID, &o.Phone, &o.PasswordHash, &o.TokenVersion)
	return o, err
}

// create makes the shop (public at once) and its owner in one transaction.
func create(ctx context.Context, d db.DBTX, shop shops.Input, phone, passwordHash string) (Owner, error) {
	var o Owner
	err := db.InTx(ctx, d, func(tx pgx.Tx) error {
		shopID, err := shops.Create(ctx, tx, shop)
		if err != nil {
			return err
		}
		o, err = scanOwner(tx.QueryRow(ctx, `
			INSERT INTO shop_owners (shop_id, phone, password_hash) VALUES ($1, $2, $3)
			RETURNING id, shop_id, phone, password_hash, token_version`, shopID, phone, passwordHash))
		return err
	})
	return o, err
}

func phoneTaken(ctx context.Context, d db.DBTX, phone string) (bool, error) {
	var taken bool
	err := d.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM shop_owners WHERE phone = $1)`, phone).Scan(&taken)
	return taken, err
}

func byPhone(ctx context.Context, d db.DBTX, phone string) (Owner, error) {
	return scanOwner(d.QueryRow(ctx, selectOwner+` WHERE phone = $1`, phone))
}

func byID(ctx context.Context, d db.DBTX, id int64) (Owner, error) {
	return scanOwner(d.QueryRow(ctx, selectOwner+` WHERE id = $1`, id))
}

// setPasswordForShop replaces the password of the shop's owner and bumps the token
// version, which signs the owner out everywhere. It returns the owner's sign-in phone.
// pgx.ErrNoRows means the shop has no owner.
func setPasswordForShop(ctx context.Context, d db.DBTX, shopID int64, passwordHash string) (string, error) {
	var phone string
	err := d.QueryRow(ctx, `
		UPDATE shop_owners SET password_hash = $2, token_version = token_version + 1, updated_at = now()
		WHERE shop_id = $1
		RETURNING phone`, shopID, passwordHash).Scan(&phone)
	return phone, err
}
