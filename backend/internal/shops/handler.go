package shops

import (
	"context"
	"net/http"

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
	g.GET("/shops", h.list)
	g.POST("/shops", h.create)
	g.GET("/shops/:id", h.get)
	g.PUT("/shops/:id", h.update)
	g.DELETE("/shops/:id", h.delete)
}

func (h *Handler) RegisterPublic(g *gin.RouterGroup) {
	g.GET("/shops", h.listPublic)
	g.GET("/shops/:slug", h.getPublic)
}

func (h *Handler) bindInput(c *gin.Context) (Input, bool) {
	var in Input
	if !httpx.BindJSON(c, &in) {
		return in, false
	}
	errs, err := Check(c.Request.Context(), h.DB, &in)
	if err != nil {
		httpx.Abort(c, err)
		return in, false
	}
	if len(errs) > 0 {
		httpx.Abort(c, httpx.Validation(errs))
		return in, false
	}
	return in, true
}

// Check normalizes in and returns its field errors, including whether the city exists.
// Admins and shop owners save shops through the same rules.
func Check(ctx context.Context, d db.DBTX, in *Input) (map[string]string, error) {
	in.normalize()
	errs := in.validate()
	if _, bad := errs["city_id"]; !bad {
		var exists bool
		if err := d.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM cities WHERE id = $1)`, in.CityID).Scan(&exists); err != nil {
			return nil, err
		}
		if !exists {
			errs["city_id"] = "invalid"
		}
	}
	return errs, nil
}

func (h *Handler) list(c *gin.Context) {
	list, err := List(c.Request.Context(), h.DB)
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
	s, err := Get(ctx, h.DB, id)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusCreated, s)
}

func (h *Handler) get(c *gin.Context) {
	id, ok := httpx.ParseID(c, "id")
	if !ok {
		return
	}
	s, err := Get(c.Request.Context(), h.DB, id)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusOK, s)
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
	s, err := Get(ctx, h.DB, id)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusOK, s)
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
