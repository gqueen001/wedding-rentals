package dresses

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/images"
	"wedding-rentals/backend/internal/textnorm"
)

type CityRef struct {
	Slug   string `json:"slug"`
	NameTK string `json:"name_tk"`
	NameRU string `json:"name_ru"`
	NameEN string `json:"name_en"`
}

type ShopRef struct {
	Name string `json:"name"`
	Slug string `json:"slug"`
}

type ListItem struct {
	ID          int64   `json:"id"`
	Title       string  `json:"title"`
	PriceManat  int     `json:"price_manat"`
	PriceIsFrom bool    `json:"price_is_from"`
	Photo       *string `json:"photo"`
	Shop        ShopRef `json:"shop"`
	City        CityRef `json:"city"`
}

type Page struct {
	Items   []ListItem `json:"items"`
	Page    int        `json:"page"`
	PerPage int        `json:"per_page"`
	Total   int        `json:"total"`
}

type ShopCard struct {
	Name         string  `json:"name"`
	Slug         string  `json:"slug"`
	Address      string  `json:"address"`
	Phone        string  `json:"phone"`
	InstagramURL *string `json:"instagram_url"`
	TikTokURL    *string `json:"tiktok_url"`
	Logo         *string `json:"logo"`
	City         CityRef `json:"city"`
}

type PublicDress struct {
	ID          int64          `json:"id"`
	Title       string         `json:"title"`
	PriceManat  int            `json:"price_manat"`
	PriceIsFrom bool           `json:"price_is_from"`
	Description *string        `json:"description"`
	Color       string         `json:"color"`
	Silhouette  string         `json:"silhouette"`
	Sleeves     string         `json:"sleeves"`
	Sizes       []string       `json:"sizes"`
	Images      []images.Image `json:"images"`
	Shop        ShopCard       `json:"shop"`
}

const publicFrom = `
	FROM listings l
	JOIN dress_details d ON d.listing_id = l.id
	JOIN shops s ON s.id = l.shop_id
	JOIN cities ci ON ci.id = s.city_id`

// buildWhere returns the WHERE clause, its args and the placeholder of the
// normalized search query ("" when there is no search).
func buildWhere(f Filter) (string, []any, string) {
	where := []string{"l.is_published", "s.is_published"}
	var args []any
	add := func(cond string, val any) {
		args = append(args, val)
		where = append(where, strings.ReplaceAll(cond, "?", "$"+strconv.Itoa(len(args))))
	}
	if f.City != "" {
		add("ci.slug = ?", f.City)
	}
	if f.PriceMin > 0 {
		add("l.price_manat >= ?", f.PriceMin)
	}
	if f.PriceMax > 0 {
		add("l.price_manat <= ?", f.PriceMax)
	}
	if f.Size != "" {
		add("? = ANY(d.sizes)", f.Size)
	}
	if f.Color != "" {
		add("d.color = ?", f.Color)
	}
	if f.Style != "" {
		add("d.silhouette = ?", f.Style)
	}
	if f.Sleeves != "" {
		add("d.sleeves = ?", f.Sleeves)
	}
	if len(f.IDs) > 0 {
		add("l.id = ANY(?)", f.IDs)
	}
	if f.ShopSlug != "" {
		add("s.slug = ?", f.ShopSlug)
	}
	qParam := ""
	if f.Q != "" {
		qn := textnorm.Norm(f.Q)
		args = append(args, qn, "%"+textnorm.EscapeLike(qn)+"%")
		qParam = "$" + strconv.Itoa(len(args)-1)
		like := "$" + strconv.Itoa(len(args))
		where = append(where, fmt.Sprintf(`(
			%[1]s <%% norm(l.title) OR %[1]s <%% norm(s.name)
			OR norm(l.title) LIKE %[2]s OR norm(s.name) LIKE %[2]s
			OR EXISTS (SELECT 1 FROM shop_aliases a WHERE a.shop_id = s.id
			           AND (%[1]s <%% norm(a.alias) OR norm(a.alias) LIKE %[2]s)))`, qParam, like))
	}
	return " WHERE " + strings.Join(where, " AND "), args, qParam
}

func orderBy(qParam string) string {
	if qParam == "" {
		return " ORDER BY l.created_at DESC, l.id DESC"
	}
	return fmt.Sprintf(` ORDER BY GREATEST(
		word_similarity(%[1]s, norm(l.title)),
		word_similarity(%[1]s, norm(s.name)),
		COALESCE((SELECT max(word_similarity(%[1]s, norm(a.alias))) FROM shop_aliases a WHERE a.shop_id = s.id), 0)
	) DESC, l.created_at DESC, l.id DESC`, qParam)
}

func ListPublic(ctx context.Context, dbx db.DBTX, f Filter) (Page, error) {
	where, args, qParam := buildWhere(f)
	page := Page{Items: []ListItem{}, Page: f.Page, PerPage: f.PerPage}
	if err := dbx.QueryRow(ctx, `SELECT count(*)`+publicFrom+where, args...).Scan(&page.Total); err != nil {
		return Page{}, err
	}
	args = append(args, f.PerPage, (f.Page-1)*f.PerPage)
	sql := `SELECT l.id, l.title, l.price_manat, l.price_is_from,
		       (SELECT i.path_small FROM images i WHERE i.listing_id = l.id ORDER BY i.position, i.id LIMIT 1),
		       s.name, s.slug, ci.slug, ci.name_tk, ci.name_ru, ci.name_en` +
		publicFrom + where + orderBy(qParam) +
		fmt.Sprintf(" LIMIT $%d OFFSET $%d", len(args)-1, len(args))
	rows, err := dbx.Query(ctx, sql, args...)
	if err != nil {
		return Page{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var it ListItem
		var photo *string
		if err := rows.Scan(&it.ID, &it.Title, &it.PriceManat, &it.PriceIsFrom, &photo,
			&it.Shop.Name, &it.Shop.Slug, &it.City.Slug, &it.City.NameTK, &it.City.NameRU, &it.City.NameEN); err != nil {
			return Page{}, err
		}
		if photo != nil {
			u := images.URL(*photo)
			it.Photo = &u
		}
		page.Items = append(page.Items, it)
	}
	return page, rows.Err()
}

func GetPublic(ctx context.Context, dbx db.DBTX, id int64) (PublicDress, error) {
	var d PublicDress
	var logo *string
	err := dbx.QueryRow(ctx, `
		SELECT l.id, l.title, l.price_manat, l.price_is_from, l.description,
		       d.color, d.silhouette, d.sleeves, d.sizes,
		       s.name, s.slug, s.address, s.phone, s.instagram_url, s.tiktok_url,
		       (SELECT path_small FROM images WHERE id = s.logo_image_id),
		       ci.slug, ci.name_tk, ci.name_ru, ci.name_en`+publicFrom+`
		WHERE l.id = $1 AND l.is_published AND s.is_published`, id).Scan(
		&d.ID, &d.Title, &d.PriceManat, &d.PriceIsFrom, &d.Description,
		&d.Color, &d.Silhouette, &d.Sleeves, &d.Sizes,
		&d.Shop.Name, &d.Shop.Slug, &d.Shop.Address, &d.Shop.Phone, &d.Shop.InstagramURL, &d.Shop.TikTokURL,
		&logo, &d.Shop.City.Slug, &d.Shop.City.NameTK, &d.Shop.City.NameRU, &d.Shop.City.NameEN)
	if err != nil {
		return PublicDress{}, err
	}
	if logo != nil {
		u := images.URL(*logo)
		d.Shop.Logo = &u
	}
	d.Images, err = images.ListForListing(ctx, dbx, id)
	return d, err
}
