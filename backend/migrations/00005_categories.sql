-- +goose Up
INSERT INTO categories (slug, name_tk, name_ru, name_en) VALUES
  ('cars', 'Maşynlar', 'Машины', 'Cars'),
  ('national-clothes', 'Milli eşikler', 'Национальная одежда', 'National clothes'),
  ('tents', 'Çadyrlar', 'Шатры', 'Tents'),
  ('car-decorations', 'Maşyn bezegleri', 'Украшения для машин', 'Car decorations');

-- Each category's own fields (internal/catalog defines them); dresses keep dress_details.
ALTER TABLE listings ADD COLUMN attributes jsonb NOT NULL DEFAULT '{}';
CREATE INDEX listings_attributes_idx ON listings USING gin (attributes jsonb_path_ops);

-- +goose Down
DROP INDEX IF EXISTS listings_attributes_idx;
ALTER TABLE listings DROP COLUMN IF EXISTS attributes;
DELETE FROM listings WHERE category_id IN
  (SELECT id FROM categories WHERE slug IN ('cars', 'national-clothes', 'tents', 'car-decorations'));
DELETE FROM categories WHERE slug IN ('cars', 'national-clothes', 'tents', 'car-decorations');
