package items

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"wedding-rentals/backend/internal/catalog"
	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/httpx"
	"wedding-rentals/backend/internal/images"
	"wedding-rentals/backend/internal/listing"
)

type Handler struct {
	DB      db.DBTX
	Storage images.Storage
	// Scope, when set, limits the admin routes to the signed-in shop owner's shop,
	// as for dresses. Admins leave it nil.
	Scope func(*gin.Context) int64
}

func (h *Handler) scope(c *gin.Context) int64 {
	if h.Scope == nil {
		return 0
	}
	return h.Scope(c)
}

func (h *Handler) RegisterPublic(g *gin.RouterGroup) {
	g.GET("/items", h.listPublic)
	g.GET("/items/:id", h.getPublic)
}

func (h *Handler) RegisterAdmin(g *gin.RouterGroup) {
	if h.Scope != nil {
		g = g.Group("", httpx.RequireScope(h.Scope))
	}
	g.GET("/items", h.listAdmin)
	g.POST("/items", h.create)
	g.GET("/items/:id", h.getAdmin)
	g.PUT("/items/:id", h.update)
	g.DELETE("/items/:id", h.delete)
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
	it, err := GetPublic(c.Request.Context(), h.DB, id)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusOK, it)
}

func (h *Handler) listAdmin(c *gin.Context) {
	shopID, ok := listing.ShopIDParam(c)
	if !ok {
		return
	}
	if scoped := h.scope(c); scoped != 0 {
		shopID = scoped
	}
	category := c.Query("category")
	if _, known := catalog.Find(category); category != "" && !known {
		httpx.Abort(c, httpx.Validation(map[string]string{"category": "invalid"}))
		return
	}
	list, err := ListAdmin(c.Request.Context(), h.DB, shopID, category)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": list})
}

// bindInput reads and checks the body against the item's category: the body's own
// category when creating, the stored one (current) when updating.
func (h *Handler) bindInput(c *gin.Context, current string) (Input, bool) {
	var in Input
	if !httpx.BindJSON(c, &in) {
		return in, false
	}
	if current != "" {
		in.Category = current
	}
	if shopID := h.scope(c); shopID != 0 {
		in.ShopID = shopID // a shop owner always saves into their own shop
	}
	in.Normalize()
	errs := map[string]string{}
	in.Basics.Validate(errs)
	if err := listing.CheckShop(c.Request.Context(), h.DB, in.ShopID, errs); err != nil {
		httpx.Abort(c, err)
		return in, false
	}
	cat, ok := catalog.Find(in.Category)
	switch {
	case in.Category == "":
		errs["category"] = "required"
	case !ok || cat.OwnPages:
		errs["category"] = "invalid" // dresses are saved through /dresses
	default:
		clean, attrErrs := catalog.Validate(cat, in.Attributes)
		in.Attributes = clean
		for k, code := range attrErrs {
			errs[k] = code
		}
	}
	if len(errs) > 0 {
		httpx.Abort(c, httpx.Validation(errs))
		return in, false
	}
	return in, true
}

func (h *Handler) create(c *gin.Context) {
	in, ok := h.bindInput(c, "")
	if !ok {
		return
	}
	ctx := c.Request.Context()
	id, err := Create(ctx, h.DB, in)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	it, err := Get(ctx, h.DB, id)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusCreated, it)
}

// item loads the item named by :id for an admin route, after the ownership check.
func (h *Handler) item(c *gin.Context) (Item, bool) {
	id, ok := httpx.ParseID(c, "id")
	if !ok || !listing.OwnedBy(c, h.DB, id, h.scope(c)) {
		return Item{}, false
	}
	it, err := Get(c.Request.Context(), h.DB, id) // a dress id is pgx.ErrNoRows: 404
	if err != nil {
		httpx.Abort(c, err)
		return Item{}, false
	}
	return it, true
}

func (h *Handler) getAdmin(c *gin.Context) {
	if it, ok := h.item(c); ok {
		c.JSON(http.StatusOK, it)
	}
}

func (h *Handler) update(c *gin.Context) {
	current, ok := h.item(c)
	if !ok {
		return
	}
	in, ok := h.bindInput(c, current.Category)
	if !ok {
		return
	}
	ctx := c.Request.Context()
	if err := Update(ctx, h.DB, current.ID, in); err != nil {
		httpx.Abort(c, err)
		return
	}
	it, err := Get(ctx, h.DB, current.ID)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusOK, it)
}

func (h *Handler) delete(c *gin.Context) {
	current, ok := h.item(c)
	if !ok {
		return
	}
	if err := Delete(c.Request.Context(), h.DB, h.Storage, current.ID); err != nil {
		httpx.Abort(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
