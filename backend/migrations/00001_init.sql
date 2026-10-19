-- +goose Up
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- +goose StatementBegin
CREATE FUNCTION norm(t text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT lower(translate(t, 'ÄÇŇÖŞÜÝŽäçňöşüýž', 'ACNOSUYZacnosuyz'))
$$;
-- +goose StatementEnd

CREATE TABLE admins (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cities (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug       text NOT NULL UNIQUE,
  name_tk    text NOT NULL,
  name_ru    text NOT NULL,
  name_en    text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE shops (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug          text NOT NULL UNIQUE,
  name          text NOT NULL,
  city_id       bigint NOT NULL REFERENCES cities(id),
  address       text NOT NULL,
  phone         text NOT NULL,
  instagram_url text,
  tiktok_url    text,
  description   text,
  logo_image_id bigint,
  is_published  boolean NOT NULL DEFAULT false,
  owner_user_id bigint,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE shop_aliases (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id    bigint NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  alias      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, alias)
);

CREATE TABLE categories (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug       text NOT NULL UNIQUE,
  name_tk    text NOT NULL,
  name_ru    text NOT NULL,
  name_en    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE listings (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id       bigint NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  category_id   bigint NOT NULL REFERENCES categories(id),
  title         text NOT NULL,
  price_manat   int NOT NULL CHECK (price_manat > 0),
  price_is_from boolean NOT NULL DEFAULT false,
  description   text,
  is_published  boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX listings_browse_idx ON listings (category_id, is_published, created_at DESC);
CREATE INDEX listings_shop_idx ON listings (shop_id);

CREATE TABLE dress_details (
  listing_id bigint PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  color      text NOT NULL CHECK (color IN ('white', 'ivory', 'champagne', 'blush', 'other')),
  silhouette text NOT NULL CHECK (silhouette IN ('ball_gown', 'a_line', 'mermaid', 'straight', 'short')),
  sleeves    text NOT NULL CHECK (sleeves IN ('long', 'short', 'none')),
  sizes      text[] NOT NULL CHECK (cardinality(sizes) > 0 AND sizes <@ ARRAY['XS','S','M','L','XL','XXL']::text[]),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE images (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  listing_id bigint REFERENCES listings(id) ON DELETE CASCADE,
  shop_id    bigint REFERENCES shops(id) ON DELETE CASCADE,
  position   int NOT NULL DEFAULT 0,
  path_small text NOT NULL,
  path_large text NOT NULL,
  width      int NOT NULL,
  height     int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((listing_id IS NULL) <> (shop_id IS NULL))
);
CREATE INDEX images_listing_idx ON images (listing_id, position);
CREATE INDEX images_shop_idx ON images (shop_id);

ALTER TABLE shops ADD CONSTRAINT shops_logo_image_fk
  FOREIGN KEY (logo_image_id) REFERENCES images(id) ON DELETE SET NULL;

CREATE INDEX shops_name_trgm ON shops USING gin (norm(name) gin_trgm_ops);
CREATE INDEX shop_aliases_alias_trgm ON shop_aliases USING gin (norm(alias) gin_trgm_ops);
CREATE INDEX listings_title_trgm ON listings USING gin (norm(title) gin_trgm_ops);

-- +goose Down
ALTER TABLE shops DROP CONSTRAINT IF EXISTS shops_logo_image_fk;
DROP TABLE IF EXISTS images, dress_details, listings, categories, shop_aliases, shops, cities, admins;
DROP FUNCTION IF EXISTS norm(text);
