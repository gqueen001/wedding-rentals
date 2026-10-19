-- +goose Up
INSERT INTO cities (slug, name_tk, name_ru, name_en, sort_order) VALUES
  ('ashgabat',    'Aşgabat',     'Ашхабад',    'Ashgabat',    1),
  ('arkadag',     'Arkadag',     'Аркадаг',    'Arkadag',     2),
  ('mary',        'Mary',        'Мары',       'Mary',        3),
  ('turkmenabat', 'Türkmenabat', 'Туркменабат','Turkmenabat', 4),
  ('dashoguz',    'Daşoguz',     'Дашогуз',    'Dashoguz',    5),
  ('balkanabat',  'Balkanabat',  'Балканабат', 'Balkanabat',  6),
  ('tejen',       'Tejen',       'Теджен',     'Tejen',       7),
  ('serdar',      'Serdar',      'Сердар',     'Serdar',      8),
  ('bayramaly',   'Baýramaly',   'Байрамали',  'Bayramaly',   9);

INSERT INTO categories (slug, name_tk, name_ru, name_en) VALUES
  ('dresses', 'Toý köýnekleri', 'Свадебные платья', 'Wedding dresses');

-- +goose Down
DELETE FROM categories WHERE slug = 'dresses';
DELETE FROM cities;
