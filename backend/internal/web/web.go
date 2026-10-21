package web

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"html"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path"
	"regexp"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"

	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/dresses"
	"wedding-rentals/backend/internal/httpx"
)

// Handler serves the built SPA: real files as-is, every other GET gets
// index.html. Dress pages get Open Graph tags for link previews.
type Handler struct {
	Dir     string
	DB      db.DBTX
	BaseURL string
	// ContactPhone, when set, is published to the SPA in a <meta name="wr-contact-phone"> tag.
	ContactPhone string
}

var dressPath = regexp.MustCompile(`^/dresses/(\d+)/?$`)

func (h *Handler) Serve(c *gin.Context) {
	p := c.Request.URL.Path
	if p == "/api" || strings.HasPrefix(p, "/api/") ||
		p == "/uploads" || strings.HasPrefix(p, "/uploads/") ||
		(c.Request.Method != http.MethodGet && c.Request.Method != http.MethodHead) {
		httpx.Abort(c, httpx.ErrNotFound)
		return
	}
	fsys := os.DirFS(h.Dir)
	clean := path.Clean("/" + p)
	name := strings.TrimPrefix(clean, "/")
	// Vite content-hashes everything under /assets, so a stale page asking for
	// a file from an older build must fail loudly rather than get index.html.
	inAssets := clean == "/assets" || strings.HasPrefix(clean, "/assets/")
	if name != "" && name != "index.html" {
		if st, err := fs.Stat(fsys, name); err == nil && !st.IsDir() {
			if inAssets {
				c.Header("Cache-Control", "public, max-age=31536000, immutable")
			}
			c.FileFromFS(name, http.FS(fsys))
			return
		}
	}
	if inAssets {
		httpx.Abort(c, httpx.ErrNotFound)
		return
	}
	index, err := fs.ReadFile(fsys, "index.html")
	if err != nil {
		c.String(http.StatusNotFound, "frontend not built: run the frontend build first")
		return
	}
	if m := dressPath.FindStringSubmatch(p); m != nil {
		if id, err := strconv.ParseInt(m[1], 10, 64); err == nil {
			index = h.injectOG(c.Request.Context(), index, id)
		}
	}
	if h.ContactPhone != "" {
		tag := `<meta name="wr-contact-phone" content="` + html.EscapeString(h.ContactPhone) + `">` + "\n"
		index = bytes.Replace(index, []byte("</head>"), []byte(tag+"</head>"), 1)
	}
	c.Header("Cache-Control", "no-cache")
	c.Data(http.StatusOK, "text/html; charset=utf-8", index)
}

func (h *Handler) injectOG(ctx context.Context, index []byte, id int64) []byte {
	d, err := dresses.GetPublic(ctx, h.DB, id)
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			log.Printf("og lookup for dress %d: %v", id, err)
		}
		return index
	}
	var b strings.Builder
	meta := func(prop, content string) {
		fmt.Fprintf(&b, `<meta property="%s" content="%s">`+"\n", prop, html.EscapeString(content))
	}
	meta("og:type", "product")
	meta("og:title", d.Title+" · "+d.Shop.Name)
	meta("og:description", fmt.Sprintf("%d TMT · %s", d.PriceManat, d.Shop.City.NameTK))
	meta("og:url", h.BaseURL+"/dresses/"+strconv.FormatInt(id, 10))
	if len(d.Images) > 0 {
		meta("og:image", h.BaseURL+d.Images[0].Large)
	}
	return bytes.Replace(index, []byte("</head>"), []byte(b.String()+"</head>"), 1)
}
