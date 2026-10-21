-- +goose Up
CREATE TABLE listing_busy_days (
  listing_id bigint NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  day        date   NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_id, day)
);

-- +goose Down
DROP TABLE IF EXISTS listing_busy_days;
