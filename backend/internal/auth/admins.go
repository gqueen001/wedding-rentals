package auth

import (
	"context"
	"errors"
	"strings"

	"wedding-rentals/backend/internal/db"
)

type admin struct {
	ID           int64
	Email        string
	PasswordHash string
}

func normalizeEmail(s string) string { return strings.ToLower(strings.TrimSpace(s)) }

func CreateAdmin(ctx context.Context, d db.DBTX, email, password string) (int64, error) {
	email = normalizeEmail(email)
	if !strings.Contains(email, "@") {
		return 0, errors.New("invalid email")
	}
	if len(password) < 10 {
		return 0, errors.New("password must be at least 10 characters")
	}
	hash, err := HashPassword(password)
	if err != nil {
		return 0, err
	}
	var id int64
	err = d.QueryRow(ctx, `INSERT INTO admins (email, password_hash) VALUES ($1, $2) RETURNING id`, email, hash).Scan(&id)
	return id, err
}

func findAdminByEmail(ctx context.Context, d db.DBTX, email string) (admin, error) {
	var a admin
	err := d.QueryRow(ctx, `SELECT id, email, password_hash FROM admins WHERE email = $1`, email).
		Scan(&a.ID, &a.Email, &a.PasswordHash)
	return a, err
}
