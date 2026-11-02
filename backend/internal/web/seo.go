package web

import (
	"bytes"
	"context"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"html"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"

	"wedding-rentals/backend/internal/catalog"
	"wedding-rentals/backend/internal/items"
	"wedding-rentals/backend/internal/shops"
)

// siteName is the brand search engines and link previews show.
const siteName = "TOÝBUKJA"

// catNames are the Turkmen category names (the frontend's cat.<slug> texts; a test keeps them equal).
var catNames = map[string]string{
	"dresses":          "Köýnekler",
	"cars":             "Maşynlar",
	"national-clothes": "Milli eşikler",
	"tents":            "Çadyrlar",
	"car-decorations":  "Maşyn bezegleri",
}

// pageMeta is what one page tells search engines and link previews. Pages are described in
// Turkmen, the site's default language.
type pageMeta struct {
	Title       string // the whole <title>
	Description string
	Path        string // canonical path; empty for pages that are not indexed
	Image       string // absolute URL; the app icon when empty
	Type        string // og:type; "website" when empty
	NoIndex     bool
	Status      int // HTTP status; 200 when 0
	JSONLD      any // structured data, as a schema.org object
}

const homeDescription = "Türkmenistanyň kireý salonlaryndaky toý köýnekleri, maşynlar, milli eşikler, " +
	"çadyrlar we maşyn bezegleri bir ýerde: bahalary, suratlary we salonlaryň telefonlary."

var (
	listingPath  = regexp.MustCompile(`^/(dresses|items)/(\d+)$`)
	categoryPath = regexp.MustCompile(`^/c/([a-z-]+)$`)
	shopPath     = regexp.MustCompile(`^/shops/([^/]+)$`)
)

// pageFor describes the page at path p (already cleaned, no trailing slash). Paths the app does
// not have get a 404, so search engines do not index empty "soft 404" pages.
func (h *Handler) pageFor(ctx context.Context, p string) pageMeta {
	switch {
	case p == "/", p == "/index.html":
		return pageMeta{
			Title:       siteName + " · toý üçin ähli zat: köýnekler, maşynlar, milli eşikler, çadyrlar",
			Description: homeDescription,
			Path:        "/",
			JSONLD: map[string]any{
				"@context": "https://schema.org",
				"@graph": []map[string]any{
					{"@type": "WebSite", "name": siteName, "url": h.BaseURL + "/", "inLanguage": "tk"},
					{"@type": "Organization", "name": siteName, "url": h.BaseURL + "/", "logo": h.BaseURL + "/icons/icon-512.png"},
				},
			},
		}
	case p == "/categories":
		return pageMeta{
			Title:       "Kategoriýalar · " + siteName,
			Description: homeDescription,
			Path:        p,
		}
	case p == "/dresses":
		return categoryMeta("dresses", p)
	case categoryPath.MatchString(p):
		slug := categoryPath.FindStringSubmatch(p)[1]
		if _, ok := catNames[slug]; !ok || slug == "dresses" {
			return notFound()
		}
		return categoryMeta(slug, p)
	case listingPath.MatchString(p):
		m := listingPath.FindStringSubmatch(p)
		id, err := strconv.ParseInt(m[2], 10, 64)
		if err != nil {
			return notFound()
		}
		return h.listingMeta(ctx, m[1], id)
	case shopPath.MatchString(p):
		return h.shopMeta(ctx, shopPath.FindStringSubmatch(p)[1])
	case p == "/credits":
		return pageMeta{Title: "Surat awtorlary · " + siteName, Description: homeDescription, Path: p}
	// Pages that only make sense to one visitor: searches, favorites, settings, and the admin and
	// shop-owner areas.
	case p == "/search", p == "/favorites", p == "/more",
		p == "/admin", strings.HasPrefix(p, "/admin/"), p == "/shop", strings.HasPrefix(p, "/shop/"):
		return pageMeta{Title: siteName, Description: homeDescription, NoIndex: true}
	}
	return notFound()
}

func notFound() pageMeta {
	return pageMeta{Title: siteName, Description: homeDescription, NoIndex: true, Status: http.StatusNotFound}
}

func categoryMeta(slug, p string) pageMeta {
	name := catNames[slug]
	return pageMeta{
		Title: name + " kireýine · " + siteName,
		Description: name + ": Türkmenistanyň kireý salonlaryndan saýlaň. Bahalary, suratlary we " +
			"salonlaryň telefonlary bir ýerde.",
		Path: p,
	}
}

func (h *Handler) listingMeta(ctx context.Context, kind string, id int64) pageMeta {
	d, err := items.GetPublic(ctx, h.DB, id)
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			log.Printf("seo lookup for listing %d: %v", id, err)
			return pageMeta{Title: siteName, Description: homeDescription, NoIndex: true}
		}
		return notFound()
	}
	// Each listing has one address: dresses under /dresses, everything else under /items.
	page := "/items/"
	if d.Category == "dresses" {
		page = "/dresses/"
	}
	if (kind == "dresses") != (d.Category == "dresses") {
		return notFound()
	}
	cat := catNames[d.Category]
	price := strconv.Itoa(d.PriceManat) + " TMT"
	if d.PriceIsFrom {
		price += "-den"
	}
	desc := fmt.Sprintf("%s · %s · %s, %s.", cat, price, d.Shop.Name, d.Shop.City.NameTK)
	if d.Description != nil && strings.TrimSpace(*d.Description) != "" {
		desc += " " + strings.TrimSpace(*d.Description)
	}
	m := pageMeta{
		Title:       d.Title + " · " + d.Shop.Name + " · " + siteName,
		Description: truncate(desc, 200),
		Path:        page + strconv.FormatInt(id, 10),
		Type:        "product",
	}
	product := map[string]any{
		"@context": "https://schema.org",
		"@type":    "Product",
		"name":     d.Title,
		"category": cat,
		"url":      h.BaseURL + m.Path,
		"offers": map[string]any{
			"@type":         "Offer",
			"price":         d.PriceManat,
			"priceCurrency": "TMT",
			"url":           h.BaseURL + m.Path,
			"seller":        map[string]any{"@type": "LocalBusiness", "name": d.Shop.Name},
		},
	}
	if len(d.Images) > 0 {
		m.Image = h.BaseURL + d.Images[0].Large
		imgs := []string{}
		for _, img := range d.Images {
			imgs = append(imgs, h.BaseURL+img.Large)
		}
		product["image"] = imgs
	}
	if d.Description != nil && strings.TrimSpace(*d.Description) != "" {
		product["description"] = strings.TrimSpace(*d.Description)
	}
	m.JSONLD = product
	return m
}

func (h *Handler) shopMeta(ctx context.Context, slug string) pageMeta {
	s, err := shops.GetPublicBySlug(ctx, h.DB, slug)
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			log.Printf("seo lookup for shop %q: %v", slug, err)
			return pageMeta{Title: siteName, Description: homeDescription, NoIndex: true}
		}
		return notFound()
	}
	cats, err := items.ShopCategories(ctx, h.DB, s.Slug)
	if err != nil {
		log.Printf("seo categories for shop %q: %v", slug, err)
	}
	names := []string{}
	for _, c := range cats {
		names = append(names, strings.ToLower(catNames[c]))
	}
	desc := s.Name
	if len(names) > 0 {
		desc += ": " + strings.Join(names, ", ") + " kireýine"
	}
	desc += ", " + s.City.NameTK + ". Salgysy: " + s.Address + ". Telefon: " + s.Phone + "."
	if s.Description != nil && strings.TrimSpace(*s.Description) != "" {
		desc += " " + strings.TrimSpace(*s.Description)
	}
	m := pageMeta{
		Title:       s.Name + " · " + s.City.NameTK + " · " + siteName,
		Description: truncate(desc, 200),
		Path:        "/shops/" + s.Slug,
		Type:        "business.business",
	}
	business := map[string]any{
		"@context":  "https://schema.org",
		"@type":     "LocalBusiness",
		"name":      s.Name,
		"url":       h.BaseURL + m.Path,
		"telephone": s.Phone,
		"address": map[string]any{
			"@type":           "PostalAddress",
			"streetAddress":   s.Address,
			"addressLocality": s.City.NameTK,
			"addressCountry":  "TM",
		},
	}
	if s.Logo != nil {
		m.Image = h.BaseURL + *s.Logo
		business["image"] = m.Image
	}
	same := []string{}
	for _, u := range []*string{s.InstagramURL, s.TikTokURL} {
		if u != nil && strings.HasPrefix(*u, "https://") {
			same = append(same, *u)
		}
	}
	if len(same) > 0 {
		business["sameAs"] = same
	}
	if s.Description != nil && strings.TrimSpace(*s.Description) != "" {
		business["description"] = strings.TrimSpace(*s.Description)
	}
	m.JSONLD = business
	return m
}

// truncate shortens s to at most n characters, at a word, with an ellipsis.
func truncate(s string, n int) string {
	if utf8.RuneCountInString(s) <= n {
		return s
	}
	r := []rune(s)[:n-1]
	if i := strings.LastIndex(string(r), " "); i > n/2 {
		return strings.TrimRight(string(r)[:i], " ,.·") + "…"
	}
	return string(r) + "…"
}

var (
	titleTag       = regexp.MustCompile(`(?s)<title>.*?</title>`)
	descriptionTag = regexp.MustCompile(`<meta name="description"[^>]*>\s*`)
)

// render puts the page's tags into index.html's <head>.
func (h *Handler) render(index []byte, m pageMeta) []byte {
	esc := html.EscapeString
	index = titleTag.ReplaceAll(index, []byte("<title>"+esc(m.Title)+"</title>"))
	index = descriptionTag.ReplaceAll(index, nil)
	var b strings.Builder
	tag := func(format string, args ...any) { fmt.Fprintf(&b, format+"\n", args...) }
	tag(`<meta name="description" content="%s">`, esc(m.Description))
	if m.NoIndex {
		tag(`<meta name="robots" content="noindex">`)
	}
	if m.Path != "" {
		url := h.BaseURL + m.Path
		image := m.Image
		if image == "" {
			image = h.BaseURL + "/icons/icon-512.png"
		}
		typ := m.Type
		if typ == "" {
			typ = "website"
		}
		tag(`<link rel="canonical" href="%s">`, esc(url))
		tag(`<meta property="og:site_name" content="%s">`, siteName)
		tag(`<meta property="og:locale" content="tk_TM">`)
		tag(`<meta property="og:type" content="%s">`, esc(typ))
		tag(`<meta property="og:title" content="%s">`, esc(strings.TrimSuffix(m.Title, " · "+siteName)))
		tag(`<meta property="og:description" content="%s">`, esc(m.Description))
		tag(`<meta property="og:url" content="%s">`, esc(url))
		tag(`<meta property="og:image" content="%s">`, esc(image))
		card := "summary"
		if m.Image != "" {
			card = "summary_large_image"
		}
		tag(`<meta name="twitter:card" content="%s">`, card)
	}
	if m.JSONLD != nil {
		// json.Marshal escapes <, > and & so the data cannot close the script tag.
		if data, err := json.Marshal(m.JSONLD); err == nil {
			tag(`<script type="application/ld+json">%s</script>`, data)
		}
	}
	return bytes.Replace(index, []byte("</head>"), []byte(b.String()+"</head>"), 1)
}

// robots tells crawlers what to skip and where the sitemap is. "/shop$" blocks the shop-owner
// home without blocking the public /shops pages.
func (h *Handler) robots() string {
	return "User-agent: *\n" +
		"Disallow: /admin\n" +
		"Disallow: /shop/\n" +
		"Disallow: /shop$\n" +
		"Disallow: /api/\n" +
		"Disallow: /search\n" +
		"Disallow: /favorites\n" +
		"Disallow: /more\n" +
		"\n" +
		"Sitemap: " + h.BaseURL + "/sitemap.xml\n"
}

// sitemap lists every public page: the home and category pages, each published shop, and each
// published listing of a published shop, with the date it last changed.
func (h *Handler) sitemap(ctx context.Context) ([]byte, error) {
	type entry struct {
		path string
		mod  time.Time
	}
	entries := []entry{{path: "/"}, {path: "/categories"}}
	for _, c := range catalog.Categories {
		if c.Slug == "dresses" {
			entries = append(entries, entry{path: "/dresses"})
		} else {
			entries = append(entries, entry{path: "/c/" + c.Slug})
		}
	}
	entries = append(entries, entry{path: "/credits"})

	rows, err := h.DB.Query(ctx, `SELECT slug, updated_at FROM shops WHERE is_published ORDER BY name, id`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var slug string
		var mod time.Time
		if err := rows.Scan(&slug, &mod); err != nil {
			rows.Close()
			return nil, err
		}
		entries = append(entries, entry{"/shops/" + slug, mod})
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	rows, err = h.DB.Query(ctx, `
		SELECT l.id, cat.slug, l.updated_at
		FROM listings l JOIN categories cat ON cat.id = l.category_id JOIN shops s ON s.id = l.shop_id
		WHERE l.is_published AND s.is_published
		ORDER BY l.id`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var id int64
		var cat string
		var mod time.Time
		if err := rows.Scan(&id, &cat, &mod); err != nil {
			rows.Close()
			return nil, err
		}
		page := "/items/"
		if cat == "dresses" {
			page = "/dresses/"
		}
		entries = append(entries, entry{page + strconv.FormatInt(id, 10), mod})
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	var b bytes.Buffer
	b.WriteString(xml.Header)
	b.WriteString(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` + "\n")
	for _, e := range entries {
		b.WriteString("<url><loc>")
		_ = xml.EscapeText(&b, []byte(h.BaseURL+e.path))
		b.WriteString("</loc>")
		if !e.mod.IsZero() {
			b.WriteString("<lastmod>" + e.mod.UTC().Format("2006-01-02") + "</lastmod>")
		}
		b.WriteString("</url>\n")
	}
	b.WriteString("</urlset>\n")
	return b.Bytes(), nil
}
