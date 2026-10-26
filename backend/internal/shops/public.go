package shops

import (
	"context"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"

	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/httpx"
	"wedding-rentals/backend/internal/images"
	"wedding-rentals/backend/internal/items"
	"wedding-rentals/backend/internal/listing"
	"wedding-rentals/backend/internal/textnorm"
)

type PublicShop struct {
	Name         string          `json:"name"`
	Slug         string          `json:"slug"`
	Address      string          `json:"address"`
	Phone        string          `json:"phone"`
	InstagramURL *string         `json:"instagram_url"`
	TikTokURL    *string         `json:"tiktok_url"`
	Description  *string         `json:"description"`
	Logo         *string         `json:"logo"`
	City         listing.CityRef `json:"city"`
	Items        items.Page      `json:"items"`
	// Categories the shop has published listings in, for the page's category chips.
	Categories []string `json:"categories"`
}

func GetPublicBySlug(ctx context.Context, d db.DBTX, slug string) (PublicShop, error) {
	var s PublicShop
	var logo *string
	err := d.QueryRow(ctx, `
		SELECT s.name, s.slug, s.address, s.phone, s.instagram_url, s.tiktok_url, s.description,
		       (SELECT path_small FROM images WHERE id = s.logo_image_id),
		       ci.slug, ci.name_tk, ci.name_ru, ci.name_en
		FROM shops s JOIN cities ci ON ci.id = s.city_id
		WHERE s.slug = $1 AND s.is_published`, slug).Scan(
		&s.Name, &s.Slug, &s.Address, &s.Phone, &s.InstagramURL, &s.TikTokURL, &s.Description,
		&logo, &s.City.Slug, &s.City.NameTK, &s.City.NameRU, &s.City.NameEN)
	if err != nil {
		return PublicShop{}, err
	}
	if logo != nil {
		u := images.URL(*logo)
		s.Logo = &u
	}
	return s, nil
}

// getPublic returns the shop and a page of its published listings in every category
// (supports the same query params as GET /items, including category).
func (h *Handler) getPublic(c *gin.Context) {
	f, errs := items.ParseFilter(c.Request.URL.Query())
	if len(errs) > 0 {
		httpx.Abort(c, httpx.Validation(errs))
		return
	}
	ctx := c.Request.Context()
	s, err := GetPublicBySlug(ctx, h.DB, c.Param("slug"))
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	f.ShopSlug = s.Slug
	if s.Items, err = items.ListPublic(ctx, h.DB, f); err != nil {
		httpx.Abort(c, err)
		return
	}
	if s.Categories, err = items.ShopCategories(ctx, h.DB, s.Slug); err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusOK, s)
}

// ShopSummary is one row of the public salon list.
type ShopSummary struct {
	Name         string          `json:"name"`
	Slug         string          `json:"slug"`
	Logo         *string         `json:"logo"`
	City         listing.CityRef `json:"city"`
	ListingCount int             `json:"listing_count"`
}

type SummaryPage = listing.Page[ShopSummary]

// ListPublic returns a page of published shops with their published listing counts: all of them
// A to Z, or with q only those whose name or an alias matches (the same matching as the listing
// search in listing.Where), best match first.
func ListPublic(ctx context.Context, d db.DBTX, q listing.Query) (SummaryPage, error) {
	page := SummaryPage{Items: []ShopSummary{}, Page: q.Page, PerPage: q.PerPage}
	where, order := " WHERE s.is_published", " ORDER BY norm(s.name), s.id"
	args := []any{}
	if q.Q != "" {
		qn := textnorm.Norm(q.Q)
		args = append(args, qn, "%"+textnorm.EscapeLike(qn)+"%")
		where += ` AND ($1 <% norm(s.name) OR norm(s.name) LIKE $2
			OR EXISTS (SELECT 1 FROM shop_aliases a WHERE a.shop_id = s.id AND ($1 <% norm(a.alias) OR norm(a.alias) LIKE $2)))`
		order = ` ORDER BY GREATEST(word_similarity($1, norm(s.name)),
			COALESCE((SELECT max(word_similarity($1, norm(a.alias))) FROM shop_aliases a WHERE a.shop_id = s.id), 0)
		) DESC, norm(s.name), s.id`
	}
	if err := d.QueryRow(ctx, `SELECT count(*) FROM shops s`+where, args...).Scan(&page.Total); err != nil {
		return SummaryPage{}, err
	}
	args = append(args, q.PerPage, (q.Page-1)*q.PerPage)
	rows, err := d.Query(ctx, `
		SELECT s.name, s.slug, (SELECT path_small FROM images WHERE id = s.logo_image_id),
		       ci.slug, ci.name_tk, ci.name_ru, ci.name_en,
		       (SELECT count(*) FROM listings l WHERE l.shop_id = s.id AND l.is_published)
		FROM shops s JOIN cities ci ON ci.id = s.city_id`+where+order+
		fmt.Sprintf(" LIMIT $%d OFFSET $%d", len(args)-1, len(args)), args...)
	if err != nil {
		return SummaryPage{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var s ShopSummary
		var logo *string
		if err := rows.Scan(&s.Name, &s.Slug, &logo, &s.City.Slug, &s.City.NameTK, &s.City.NameRU, &s.City.NameEN, &s.ListingCount); err != nil {
			return SummaryPage{}, err
		}
		if logo != nil {
			u := images.URL(*logo)
			s.Logo = &u
		}
		page.Items = append(page.Items, s)
	}
	return page, rows.Err()
}

// listPublic is the search page's salon list: q, page and per_page (other list params are ignored).
func (h *Handler) listPublic(c *gin.Context) {
	q, errs := listing.ParseQuery(c.Request.URL.Query())
	if len(errs) > 0 {
		httpx.Abort(c, httpx.Validation(errs))
		return
	}
	page, err := ListPublic(c.Request.Context(), h.DB, q)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusOK, page)
}
