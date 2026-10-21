package server

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"wedding-rentals/backend/internal/auth"
	"wedding-rentals/backend/internal/busydays"
	"wedding-rentals/backend/internal/cities"
	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/dresses"
	"wedding-rentals/backend/internal/httpx"
	"wedding-rentals/backend/internal/images"
	"wedding-rentals/backend/internal/owners"
	"wedding-rentals/backend/internal/shops"
	"wedding-rentals/backend/internal/web"
)

type Deps struct {
	DB      db.DBTX
	Tokens  *auth.Tokens
	Limiter *auth.Limiter
	// ShopLimiter rate-limits shop sign-up and sign-in; nil gets its own 5-per-minute limiter.
	ShopLimiter  *auth.Limiter
	Storage      images.Storage
	UploadDir    string
	WebDir       string
	BaseURL      string
	ContactPhone string
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
	if d.ShopLimiter == nil {
		d.ShopLimiter = auth.NewLimiter(5, time.Minute)
	}
	ownersH := &owners.Handler{DB: d.DB, Tokens: d.Tokens, Limiter: d.ShopLimiter}

	authH.RegisterPublic(api)
	citiesH.RegisterPublic(api)
	shopsH.RegisterPublic(api)
	dressesH.RegisterPublic(api)
	busyH.RegisterPublic(api)
	ownersH.RegisterPublic(api)

	admin := api.Group("/admin", auth.Middleware(d.Tokens))
	shopsH.RegisterAdmin(admin)
	dressesH.RegisterAdmin(admin)
	imagesH.RegisterAdmin(admin)
	busyH.RegisterAdmin(admin)
	ownersH.RegisterAdmin(admin)

	// Shop owners reuse the admin handlers, scoped to their own shop.
	shop := api.Group("/shop", owners.ShopMiddleware(d.Tokens, d.DB))
	ownersH.RegisterShop(shop)
	(&dresses.Handler{DB: d.DB, Storage: d.Storage, Scope: owners.ShopID}).RegisterAdmin(shop)
	(&images.Handler{DB: d.DB, Storage: d.Storage, Scope: owners.ShopID}).RegisterAdmin(shop)
	(&busydays.Handler{DB: d.DB, Scope: owners.ShopID}).RegisterAdmin(shop)

	r.Static("/uploads", d.UploadDir)
	webH := &web.Handler{Dir: d.WebDir, DB: d.DB, BaseURL: d.BaseURL, ContactPhone: d.ContactPhone}
	r.NoRoute(webH.Serve)
	return r, nil
}
