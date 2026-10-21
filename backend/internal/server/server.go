package server

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"wedding-rentals/backend/internal/auth"
	"wedding-rentals/backend/internal/busydays"
	"wedding-rentals/backend/internal/cities"
	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/dresses"
	"wedding-rentals/backend/internal/httpx"
	"wedding-rentals/backend/internal/images"
	"wedding-rentals/backend/internal/shops"
	"wedding-rentals/backend/internal/web"
)

type Deps struct {
	DB        db.DBTX
	Tokens    *auth.Tokens
	Limiter   *auth.Limiter
	Storage   images.Storage
	UploadDir string
	WebDir    string
	BaseURL   string
	// TrustedProxies are IPs/CIDRs allowed to set X-Forwarded-For; empty trusts none.
	TrustedProxies []string
}

func New(d Deps) (*gin.Engine, error) {
	r := gin.New()
	r.Use(gin.Logger(), httpx.Recovery())
	if err := r.SetTrustedProxies(d.TrustedProxies); err != nil {
		return nil, err
	}
	r.MaxMultipartMemory = 16 << 20

	api := r.Group("/api")
	api.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })

	authH := &auth.Handler{DB: d.DB, Tokens: d.Tokens, Limiter: d.Limiter}
	citiesH := &cities.Handler{DB: d.DB}
	shopsH := &shops.Handler{DB: d.DB, Storage: d.Storage}
	dressesH := &dresses.Handler{DB: d.DB, Storage: d.Storage}
	imagesH := &images.Handler{DB: d.DB, Storage: d.Storage}
	busyH := &busydays.Handler{DB: d.DB}

	authH.RegisterPublic(api)
	citiesH.RegisterPublic(api)
	shopsH.RegisterPublic(api)
	dressesH.RegisterPublic(api)
	busyH.RegisterPublic(api)

	admin := api.Group("/admin", auth.Middleware(d.Tokens))
	shopsH.RegisterAdmin(admin)
	dressesH.RegisterAdmin(admin)
	imagesH.RegisterAdmin(admin)
	busyH.RegisterAdmin(admin)

	r.Static("/uploads", d.UploadDir)
	webH := &web.Handler{Dir: d.WebDir, DB: d.DB, BaseURL: d.BaseURL}
	r.NoRoute(webH.Serve)
	return r, nil
}
