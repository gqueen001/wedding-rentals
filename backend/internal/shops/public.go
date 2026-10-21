package shops

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"

	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/httpx"
	"wedding-rentals/backend/internal/images"
	"wedding-rentals/backend/internal/items"
	"wedding-rentals/backend/internal/listing"
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
