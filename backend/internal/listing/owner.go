package listing

import (
	"context"
	"strconv"

	"github.com/gin-gonic/gin"

	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/httpx"
)

// OwnedBy answers 404 and returns false unless listing id belongs to shopID.
// A shopID of 0 means an admin, who may touch every listing.
func OwnedBy(c *gin.Context, d db.DBTX, id, shopID int64) bool {
	if shopID == 0 {
		return true
	}
	var mine bool
	err := d.QueryRow(c.Request.Context(),
		`SELECT EXISTS(SELECT 1 FROM listings WHERE id = $1 AND shop_id = $2)`, id, shopID).Scan(&mine)
	if err != nil {
		httpx.Abort(c, err)
		return false
	}
	if !mine {
		httpx.Abort(c, httpx.ErrNotFound)
		return false
	}
	return true
}

// CheckShop sets errs["shop_id"] = "invalid" when no shop has that id. It does nothing
// when shop_id already has an error.
func CheckShop(ctx context.Context, d db.DBTX, shopID int64, errs map[string]string) error {
	if _, bad := errs["shop_id"]; bad {
		return nil
	}
	var exists bool
	if err := d.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM shops WHERE id = $1)`, shopID).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		errs["shop_id"] = "invalid"
	}
	return nil
}

// ShopIDParam reads the optional ?shop_id= of an admin list (0 when absent). On a bad
// value it answers 400 and returns false.
func ShopIDParam(c *gin.Context) (int64, bool) {
	s := c.Query("shop_id")
	if s == "" {
		return 0, true
	}
	n, err := strconv.ParseInt(s, 10, 64)
	if err != nil || n <= 0 {
		httpx.Abort(c, httpx.Validation(map[string]string{"shop_id": "invalid"}))
		return 0, false
	}
	return n, true
}
