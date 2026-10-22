package dresses

import (
	"context"

	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/images"
	"wedding-rentals/backend/internal/listing"
)

type (
	CityRef  = listing.CityRef
	ShopRef  = listing.ShopRef
	ShopCard = listing.ShopCard
	Page     = listing.Page[ListItem]
)

type ListItem struct {
	ID          int64   `json:"id"`
	Title       string  `json:"title"`
	PriceManat  int     `json:"price_manat"`
	PriceIsFrom bool    `json:"price_is_from"`
	Photo       *string `json:"photo"`
	Shop        ShopRef `json:"shop"`
	City        CityRef `json:"city"`
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

func where(f Filter) *listing.Where {
	w := &listing.Where{}
	if f.Size != "" {
		w.Add("? = ANY(d.sizes)", f.Size)
	}
	if f.Color != "" {
		w.Add("d.color = ?", f.Color)
	}
	if f.Style != "" {
		w.Add("d.silhouette = ?", f.Style)
	}
	if f.Sleeves != "" {
		w.Add("d.sleeves = ?", f.Sleeves)
	}
	w.Apply(f.Query)
	return w
}

func ListPublic(ctx context.Context, dbx db.DBTX, f Filter) (Page, error) {
	w := where(f)
	page := Page{Items: []ListItem{}, Page: f.Page, PerPage: f.PerPage}
	if err := dbx.QueryRow(ctx, `SELECT count(*)`+publicFrom+w.SQL(), w.Args()...).Scan(&page.Total); err != nil {
		return Page{}, err
	}
	limit, args := w.Limit(f.Query)
	sql := `SELECT l.id, l.title, l.price_manat, l.price_is_from,
		       (SELECT i.path_small FROM images i WHERE i.listing_id = l.id ORDER BY i.position, i.id LIMIT 1),
		       s.name, s.slug, ci.slug, ci.name_tk, ci.name_ru, ci.name_en` +
		publicFrom + w.SQL() + w.OrderBy() + limit
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
