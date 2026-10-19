package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"wedding-rentals/backend/internal/auth"
	"wedding-rentals/backend/internal/config"
	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/images"
	"wedding-rentals/backend/internal/server"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	ctx := context.Background()
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	if err := os.MkdirAll(cfg.UploadDir, 0o755); err != nil {
		log.Fatal(err)
	}
	r, err := server.New(server.Deps{
		DB:             pool,
		Tokens:         auth.NewTokens(cfg.JWTSecret, auth.TokenTTL),
		Limiter:        auth.NewLimiter(5, time.Minute),
		Storage:        images.LocalStorage{Dir: cfg.UploadDir},
		UploadDir:      cfg.UploadDir,
		WebDir:         cfg.WebDir,
		BaseURL:        cfg.BaseURL,
		TrustedProxies: cfg.TrustedProxies,
	})
	if err != nil {
		log.Fatal(err)
	}
	srv := &http.Server{Addr: ":" + cfg.Port, Handler: r, ReadHeaderTimeout: 10 * time.Second}
	log.Printf("listening on http://localhost:%s", cfg.Port)
	log.Fatal(srv.ListenAndServe())
}
