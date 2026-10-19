package cities

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"

	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/httpx"
)

type City struct {
	ID     int64  `json:"id"`
	Slug   string `json:"slug"`
	NameTK string `json:"name_tk"`
	NameRU string `json:"name_ru"`
	NameEN string `json:"name_en"`
}

func List(ctx context.Context, d db.DBTX) ([]City, error) {
	rows, err := d.Query(ctx, `SELECT id, slug, name_tk, name_ru, name_en FROM cities ORDER BY sort_order, id`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[City])
}

type Handler struct{ DB db.DBTX }

func (h *Handler) RegisterPublic(g *gin.RouterGroup) {
	g.GET("/cities", h.list)
}

func (h *Handler) list(c *gin.Context) {
	list, err := List(c.Request.Context(), h.DB)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": list})
}
