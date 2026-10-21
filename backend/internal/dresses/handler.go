package dresses

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/httpx"
	"wedding-rentals/backend/internal/images"
)

type Handler struct {
	DB      db.DBTX
	Storage images.Storage
	// Scope, when set, limits the admin routes to one shop: it returns the signed-in shop
	// owner's shop id. Admins leave it nil and may touch every shop.
	Scope func(*gin.Context) int64
}

func (h *Handler) scope(c *gin.Context) int64 {
	if h.Scope == nil {
		return 0
	}
	return h.Scope(c)
}

// own answers 404 unless the dress id belongs to the scoped shop (always true for admins).
func (h *Handler) own(c *gin.Context, id int64) bool {
	shopID := h.scope(c)
	if shopID == 0 {
		return true
	}
	var mine bool
	err := h.DB.QueryRow(c.Request.Context(),
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

func (h *Handler) RegisterAdmin(g *gin.RouterGroup) {
	if h.Scope != nil {
		g = g.Group("", httpx.RequireScope(h.Scope))
	}
	g.GET("/dresses", h.listAdmin)
	g.POST("/dresses", h.create)
	g.GET("/dresses/:id", h.getAdmin)
	g.PUT("/dresses/:id", h.update)
	g.DELETE("/dresses/:id", h.delete)
}

func (h *Handler) RegisterPublic(g *gin.RouterGroup) {
	g.GET("/dresses", h.listPublic)
	g.GET("/dresses/:id", h.getPublic)
}

func (h *Handler) listPublic(c *gin.Context) {
	f, errs := ParseFilter(c.Request.URL.Query())
	if len(errs) > 0 {
		httpx.Abort(c, httpx.Validation(errs))
		return
	}
	page, err := ListPublic(c.Request.Context(), h.DB, f)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusOK, page)
}

func (h *Handler) getPublic(c *gin.Context) {
	id, ok := httpx.ParseID(c, "id")
	if !ok {
		return
	}
	d, err := GetPublic(c.Request.Context(), h.DB, id)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusOK, d)
}

func (h *Handler) bindInput(c *gin.Context) (Input, bool) {
	var in Input
	if !httpx.BindJSON(c, &in) {
		return in, false
	}
	if shopID := h.scope(c); shopID != 0 {
		in.ShopID = shopID // a shop owner always saves into their own shop
	}
	in.normalize()
	errs := in.validate()
	if _, bad := errs["shop_id"]; !bad {
		var exists bool
		if err := h.DB.QueryRow(c.Request.Context(), `SELECT EXISTS(SELECT 1 FROM shops WHERE id = $1)`, in.ShopID).Scan(&exists); err != nil {
			httpx.Abort(c, err)
			return in, false
		}
		if !exists {
			errs["shop_id"] = "invalid"
		}
	}
	if len(errs) > 0 {
		httpx.Abort(c, httpx.Validation(errs))
		return in, false
	}
	in.Sizes = canonicalSizes(in.Sizes)
	return in, true
}

func (h *Handler) listAdmin(c *gin.Context) {
	var shopID int64
	if s := c.Query("shop_id"); s != "" {
		n, err := strconv.ParseInt(s, 10, 64)
		if err != nil || n <= 0 {
			httpx.Abort(c, httpx.Validation(map[string]string{"shop_id": "invalid"}))
			return
		}
		shopID = n
	}
	if scoped := h.scope(c); scoped != 0 {
		shopID = scoped
	}
	list, err := ListAdmin(c.Request.Context(), h.DB, shopID)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": list})
}

func (h *Handler) create(c *gin.Context) {
	in, ok := h.bindInput(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()
	id, err := Create(ctx, h.DB, in)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	d, err := Get(ctx, h.DB, id)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusCreated, d)
}

func (h *Handler) getAdmin(c *gin.Context) {
	id, ok := httpx.ParseID(c, "id")
	if !ok || !h.own(c, id) {
		return
	}
	d, err := Get(c.Request.Context(), h.DB, id)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusOK, d)
}

func (h *Handler) update(c *gin.Context) {
	id, ok := httpx.ParseID(c, "id")
	if !ok || !h.own(c, id) {
		return
	}
	in, ok := h.bindInput(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()
	if err := Update(ctx, h.DB, id, in); err != nil {
		httpx.Abort(c, err)
		return
	}
	d, err := Get(ctx, h.DB, id)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusOK, d)
}

func (h *Handler) delete(c *gin.Context) {
	id, ok := httpx.ParseID(c, "id")
	if !ok || !h.own(c, id) {
		return
	}
	if err := Delete(c.Request.Context(), h.DB, h.Storage, id); err != nil {
		httpx.Abort(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
