package busydays

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/httpx"
)

type Handler struct {
	DB db.DBTX
	// Now returns the current time; nil means time.Now. Tests set a fixed clock.
	Now func() time.Time
	// Scope, when set, limits the admin routes to the signed-in shop owner's shop.
	Scope func(*gin.Context) int64
}

// Response is one dress's calendar: the window and the busy days inside it.
type Response struct {
	From string   `json:"from"`
	To   string   `json:"to"`
	Days []string `json:"days"`
}

// Busy days belong to any listing: /items/… serves every category, and /dresses/…
// stays for links and pages made before other categories existed.
func (h *Handler) RegisterPublic(g *gin.RouterGroup) {
	for _, base := range []string{"/dresses", "/items"} {
		g.GET(base+"/:id/busy-days", h.listPublic)
	}
}

func (h *Handler) RegisterAdmin(g *gin.RouterGroup) {
	if h.Scope != nil {
		g = g.Group("", httpx.RequireScope(h.Scope))
	}
	for _, base := range []string{"/dresses", "/items"} {
		g.GET(base+"/:id/busy-days", h.listAdmin)
		g.PUT(base+"/:id/busy-days/:day", h.mark)
		g.DELETE(base+"/:id/busy-days/:day", h.unmark)
	}
}

func (h *Handler) window() Window {
	now := time.Now
	if h.Now != nil {
		now = h.Now
	}
	return WindowAt(now())
}

func (h *Handler) listPublic(c *gin.Context) { h.list(c, true) }
func (h *Handler) listAdmin(c *gin.Context)  { h.list(c, false) }

func (h *Handler) list(c *gin.Context, publicOnly bool) {
	id, ok := h.listing(c, publicOnly)
	if !ok {
		return
	}
	w := h.window()
	days, err := List(c.Request.Context(), h.DB, id, w)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusOK, Response{From: formatDay(w.From), To: formatDay(w.To), Days: days})
}

// listing reads :id and answers 404 unless it names a listing (a visible one when publicOnly).
func (h *Handler) listing(c *gin.Context, publicOnly bool) (int64, bool) {
	id, ok := httpx.ParseID(c, "id")
	if !ok {
		return 0, false
	}
	var shopID int64
	if h.Scope != nil && !publicOnly {
		shopID = h.Scope(c)
	}
	exists, err := listingExists(c.Request.Context(), h.DB, id, publicOnly, shopID)
	if err != nil {
		httpx.Abort(c, err)
		return 0, false
	}
	if !exists {
		httpx.Abort(c, httpx.ErrNotFound)
		return 0, false
	}
	return id, true
}

func (h *Handler) mark(c *gin.Context)   { h.change(c, Mark) }
func (h *Handler) unmark(c *gin.Context) { h.change(c, Unmark) }

func (h *Handler) change(c *gin.Context, apply func(context.Context, db.DBTX, int64, time.Time) error) {
	id, ok := h.listing(c, false)
	if !ok {
		return
	}
	day, ok := ParseDay(c.Param("day"))
	if !ok {
		httpx.Abort(c, httpx.Validation(map[string]string{"day": "invalid"}))
		return
	}
	if !h.window().Contains(day) {
		httpx.Abort(c, httpx.Validation(map[string]string{"day": "out_of_range"}))
		return
	}
	if err := apply(c.Request.Context(), h.DB, id, day); err != nil {
		httpx.Abort(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
