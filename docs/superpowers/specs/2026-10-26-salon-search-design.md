# Salon Search: Design Spec

**Date:** 2026-10-26
**Status:** Approved by the product owner in chat ("I love it"), after a mockup.

## 1. Goal

Brides know salons by name, written in Turkmen, Russian or English. Search now finds **salons**, not products. Products are browsed category by category.

## 2. Search page (`/search?q=`)

- A "Gözleg" label, the title **Salonlar**, and the search box. The box's placeholder is "Salonyň adyny ýazyň".
- **Nothing typed:** every published salon, A to Z by the Latin-folded name. A salon with no listings is shown too. More load as you scroll (24 a page).
- **A name typed:** the salons whose name or alias matches, best match first. Matching is the same as the listing search: Turkmen letters folded, small typos allowed, aliases in any alphabet.
- **Each row:** the logo (or the first letter on garnet), the name, the city, the published listing count, and a chevron. The row opens `/shops/:slug`.
- **No match:** "Salon tapylmady", a hint, and the five category links.
- The category chips, city select and filter sheet are removed from this page. The category pages keep their own filters.

## 3. Home

- The city select is removed.
- The search box asks for a salon name and opens `/search?q=`.

## 4. API

`GET /api/shops?q=&page=&per_page=` returns a page with fields `items`, `page`, `per_page` and `total`. Each item has:
- `name`, `slug` and `logo`;
- `city`: `slug`, `name_tk`, `name_ru` and `name_en`;
- `listing_count`.

It covers published shops only, and a `q` longer than 100 characters gets 400.

## 5. Texts

| Key | tk | ru | en |
|---|---|---|---|
| `search.salons` | Salonlar | Салоны | Salons |
| `search.salon_label` | Salon gözle | Найти салон | Find a salon |
| `search.salon_placeholder` | Salonyň adyny ýazyň | Введите название салона | Type the salon's name |
| `search.no_salons` | Salon tapylmady | Салон не найден | No salon found |
| `search.no_salons_body` | Salonyň adyny ýazyň ýa-da kategoriýany saýlaň: | Введите название салона или выберите категорию: | Type a salon's name or pick a category: |

Removed: `home.city`, `home.all_cities` and `search.empty_body`.

## 6. Testing

- **Go:**
  - A to Z order;
  - listing counts that skip drafts;
  - hidden shops left out;
  - paging;
  - matching by folded name, typo and alias;
  - no match for a product word;
  - a long `q` refused.
- **Frontend:** test, check and build.
- **Browser** (tk, ru and en, light and dark, 320–1280px):
  - Home has no select, and its search lands on the salon results;
  - the A to Z list is correct, and a row opens the salon;
  - no match shows the five categories;
  - no overflow, and contrast is clean.
