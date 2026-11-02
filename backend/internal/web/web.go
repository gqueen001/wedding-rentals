package web

import (
	"bytes"
	"html"
	"io/fs"
	"net/http"
	"os"
	"path"
	"strings"

	"github.com/gin-gonic/gin"

	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/httpx"
)

// Handler serves the built SPA: real files as-is, every other GET gets index.html with the page's
// title, description and link-preview tags for search engines (seo.go), plus robots.txt and
// sitemap.xml.
type Handler struct {
	Dir     string
	DB      db.DBTX
	BaseURL string
	// ContactPhone, when set, is published to the SPA in a <meta name="wr-contact-phone"> tag.
	ContactPhone string
}

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
	switch clean {
	case "/robots.txt":
		c.Header("Cache-Control", "public, max-age=3600")
		c.String(http.StatusOK, h.robots())
		return
	case "/sitemap.xml":
		data, err := h.sitemap(c.Request.Context())
		if err != nil {
			httpx.Abort(c, err)
			return
		}
		c.Header("Cache-Control", "public, max-age=3600")
		c.Data(http.StatusOK, "application/xml; charset=utf-8", data)
		return
	}
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
	meta := h.pageFor(c.Request.Context(), clean)
	index = h.render(index, meta)
	if h.ContactPhone != "" {
		tag := `<meta name="wr-contact-phone" content="` + html.EscapeString(h.ContactPhone) + `">` + "\n"
		index = bytes.Replace(index, []byte("</head>"), []byte(tag+"</head>"), 1)
	}
	status := meta.Status
	if status == 0 {
		status = http.StatusOK
	}
	c.Header("Cache-Control", "no-cache")
	c.Data(status, "text/html; charset=utf-8", index)
}
