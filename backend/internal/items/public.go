package items

import (
	"context"

	"wedding-rentals/backend/internal/catalog"
	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/images"
	"wedding-rentals/backend/internal/listing"
)

const publicFrom = `
	FROM listings l
	JOIN categories cat ON cat.id = l.category_id
	JOIN shops s ON s.id = l.shop_id
	JOIN cities ci ON ci.id = s.city_id`

func where(f Filter) *listing.Where {
	w := &listing.Where{}
	if f.Category != "" {
		w.Add("cat.slug = ?", f.Category)
	}
	for _, c := range f.attrs {
		w.Add(c.SQL, c.Value)
	}
	w.Apply(f.Query)
	return w
}

// ListPublic returns a page of published listings from published shops, in every
// category or one.
func ListPublic(ctx context.Context, dbx db.DBTX, f Filter) (Page, error) {
	w := where(f)
	page := Page{Items: []ListItem{}, Page: f.Page, PerPage: f.PerPage}
	if err := dbx.QueryRow(ctx, `SELECT count(*)`+publicFrom+w.SQL(), w.Args()...).Scan(&page.Total); err != nil {
		return Page{}, err
	}
	limit, args := w.Limit(f.Query)
	rows, err := dbx.Query(ctx, `SELECT l.id, cat.slug, l.title, l.price_manat, l.price_is_from, l.attributes,
		       (SELECT i.path_small FROM images i WHERE i.listing_id = l.id ORDER BY i.position, i.id LIMIT 1),
		       s.name, s.slug, ci.slug, ci.name_tk, ci.name_ru, ci.name_en`+
		publicFrom+w.SQL()+w.OrderBy()+limit, args...)
	if err != nil {
		return Page{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var it ListItem
		var photo *string
		if err := rows.Scan(&it.ID, &it.Category, &it.Title, &it.PriceManat, &it.PriceIsFrom, &it.Attributes, &photo,
			&it.Shop.Name, &it.Shop.Slug, &it.City.Slug, &it.City.NameTK, &it.City.NameRU, &it.City.NameEN); err != nil {
			return Page{}, err
		}
		it.Photo = photoURL(photo)
		page.Items = append(page.Items, it)
	}
	return page, rows.Err()
}

// GetPublic returns one published listing of any category; pgx.ErrNoRows otherwise.
func GetPublic(ctx context.Context, dbx db.DBTX, id int64) (PublicItem, error) {
	var it PublicItem
	var logo *string
	err := dbx.QueryRow(ctx, `
		SELECT l.id, cat.slug, l.title, l.price_manat, l.price_is_from, l.description, l.attributes,
		       s.name, s.slug, s.address, s.phone, s.instagram_url, s.tiktok_url,
		       (SELECT path_small FROM images WHERE id = s.logo_image_id),
		       ci.slug, ci.name_tk, ci.name_ru, ci.name_en`+publicFrom+`
		WHERE l.id = $1 AND l.is_published AND s.is_published`, id).Scan(
		&it.ID, &it.Category, &it.Title, &it.PriceManat, &it.PriceIsFrom, &it.Description, &it.Attributes,
		&it.Shop.Name, &it.Shop.Slug, &it.Shop.Address, &it.Shop.Phone, &it.Shop.InstagramURL, &it.Shop.TikTokURL,
		&logo, &it.Shop.City.Slug, &it.Shop.City.NameTK, &it.Shop.City.NameRU, &it.Shop.City.NameEN)
	if err != nil {
		return PublicItem{}, err
	}
	it.Shop.Logo = photoURL(logo)
	it.Images, err = images.ListForListing(ctx, dbx, id)
	return it, err
}

func photoURL(path *string) *string {
	if path == nil {
		return nil
	}
	u := images.URL(*path)
	return &u
}

// ShopCategories returns the categories the shop has published listings in, in the
// catalog's display order.
func ShopCategories(ctx context.Context, dbx db.DBTX, shopSlug string) ([]string, error) {
	rows, err := dbx.Query(ctx, `SELECT DISTINCT cat.slug`+publicFrom+`
		WHERE l.is_published AND s.is_published AND s.slug = $1`, shopSlug)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	has := map[string]bool{}
	for rows.Next() {
		var slug string
		if err := rows.Scan(&slug); err != nil {
			return nil, err
		}
		has[slug] = true
	}
	out := []string{}
	for _, c := range catalog.Categories {
		if has[c.Slug] {
			out = append(out, c.Slug)
		}
	}
	return out, rows.Err()
}
