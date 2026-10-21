-- +goose Up
CREATE TABLE shop_owners (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id       bigint NOT NULL UNIQUE REFERENCES shops(id) ON DELETE CASCADE,
  phone         text NOT NULL UNIQUE,          -- normalized +993XXXXXXXX
  password_hash text NOT NULL,
  token_version int  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- The v1 placeholder for ownership is replaced by shop_owners.shop_id.
ALTER TABLE shops DROP COLUMN owner_user_id;

-- +goose Down
ALTER TABLE shops ADD COLUMN owner_user_id bigint;
DROP TABLE IF EXISTS shop_owners;
