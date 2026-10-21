package owners

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"

	"wedding-rentals/backend/internal/auth"
	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/httpx"
)

const (
	ownerIDKey    = "shop_owner_id"
	ownerPhoneKey = "shop_owner_phone"
	shopIDKey     = "shop_owner_shop_id"
)

var errUnauthorized = httpx.New(http.StatusUnauthorized, "unauthorized", "login required")

// ShopMiddleware accepts only a valid shop-owner token whose version matches the owner's
// current token_version (a new password signs old sessions out), and remembers the owner's shop.
func ShopMiddleware(t *auth.Tokens, d db.DBTX) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, ok := strings.CutPrefix(c.GetHeader("Authorization"), "Bearer ")
		if !ok || token == "" {
			httpx.Abort(c, errUnauthorized)
			return
		}
		id, version, err := t.VerifyShop(token)
		if err != nil {
			httpx.Abort(c, errUnauthorized)
			return
		}
		o, err := byID(c.Request.Context(), d, id)
		if errors.Is(err, pgx.ErrNoRows) || (err == nil && o.TokenVersion != version) {
			httpx.Abort(c, errUnauthorized)
			return
		}
		if err != nil {
			httpx.Abort(c, err)
			return
		}
		c.Set(ownerIDKey, o.ID)
		c.Set(ownerPhoneKey, o.Phone)
		c.Set(shopIDKey, o.ShopID)
		c.Next()
	}
}

// ShopID is the signed-in owner's shop, or 0 outside ShopMiddleware. The scoped dresses,
// images and busy-days handlers use it to touch nothing but the owner's own shop.
func ShopID(c *gin.Context) int64 { return c.GetInt64(shopIDKey) }
