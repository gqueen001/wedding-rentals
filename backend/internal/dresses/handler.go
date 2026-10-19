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
}

func (h *Handler) RegisterAdmin(g *gin.RouterGroup) {
	g.GET("/dresses", h.listAdmin)
	g.POST("/dresses", h.create)
	g.GET("/dresses/:id", h.getAdmin)
	g.PUT("/dresses/:id", h.update)
	g.DELETE("/dresses/:id", h.delete)
}

// RegisterPublic is filled in by Task 9.
func (h *Handler) RegisterPublic(g *gin.RouterGroup) {}

func (h *Handler) bindInput(c *gin.Context) (Input, bool) {
	var in Input
	if !httpx.BindJSON(c, &in) {
		return in, false
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
	if !ok {
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
	if !ok {
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
	if !ok {
		return
	}
	if err := Delete(c.Request.Context(), h.DB, h.Storage, id); err != nil {
		httpx.Abort(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
