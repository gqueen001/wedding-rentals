# More Rental Categories: Design Spec

**Date:** 2026-10-21
**Status:** Approved in brainstorming; awaiting the product owner's review of this document
**Builds on:**
- `2026-10-18-wedding-rentals-v1-design.md`: the schema already has `categories` and `listings.category_id`, and §11 listed "categories other than dresses" as later work;
- `2026-10-20-dress-availability-calendar-design.md`;
- `2026-10-21-shop-accounts-design.md`.

## 1. Goal

Besides wedding dresses, the site lists four more kinds of wedding rentals:
- **Maşynlar** (wedding cars);
- **Milli eşikler** (national clothes);
- **Çadyrlar** (tents);
- **Maşyn bezegleri** (car decorations).

Brides browse, filter and search them the way they do dresses. Shops and admins add them the way they add dresses. The product owner will show this first version to rental shops and adjust the fields afterwards, so **changing a category's fields must be cheap**.

## 2. Decisions

| Topic | Decision |
|---|---|
| Order | **Categories first.** The visual redesign is a separate, later project. |
| Detail | **Basics plus a few key fields per category**, with filters for them. |
| How fields are stored | **Flexible.** Each listing gets an `attributes` JSON object. The fields are defined in **one list in the backend code**, which drives validation, filters, the forms and the filter panels. |
| Dresses | **Unchanged.** They keep `dress_details`, their API, pages and URLs. They also appear in the new all-category list, search, shop pages and favorites. |
| Fields per category | Exactly §4. They are a first guess, to be revised after talking to shops. |
| Out of scope | The visual redesign, changes to the dress fields, categories beyond these five, and date-availability filters. |

## 3. Categories

| Slug | tk | ru | en | Public list page |
|---|---|---|---|---|
| `dresses` (exists) | Köýnekler | Платья | Dresses | `/dresses` (unchanged) |
| `cars` | Maşynlar | Машины | Cars | `/c/cars` |
| `national-clothes` | Milli eşikler | Национальная одежда | National clothes | `/c/national-clothes` |
| `tents` | Çadyrlar | Шатры | Tents | `/c/tents` |
| `car-decorations` | Maşyn bezegleri | Украшения для машин | Car decorations | `/c/car-decorations` |

A migration seeds the four new rows, using the names above.

## 4. Fields

Every listing has these basics: title, price in manat with the existing "from" option, description, published, photos, busy days, and the shop with its city. On top of them, the category's fields:

| Category | Key | Kind | Values | Required | Filter (query parameter) |
|---|---|---|---|---|---|
| cars | `brand_model` | text, ≤ 100 chars | free text, e.g. "Mercedes S-Class" | yes | none (search covers the title) |
| cars | `body` | one choice | `sedan`, `suv`, `limousine`, `minivan` | yes | `body=<value>` |
| cars | `color` | one choice | `white`, `black`, `silver`, `other` | yes | `color=<value>` |
| cars | `seats` | number, 1–60 | | no | `seats_min=<n>` |
| cars | `price_unit` | one choice | `hour`, `day` | yes | none; the price shows as "800 TMT / hour" |
| national-clothes | `for_whom` | one choice | `bride`, `groom`, `woman`, `man`, `child` | yes | `for_whom=<value>` |
| national-clothes | `sizes` | several choices, at least 1 | `XS`, `S`, `M`, `L`, `XL`, `XXL` | yes | `size=<value>` (items that have it) |
| tents | `guests` | number, 1–5000 | | yes | `guests_min=<n>` |
| tents | `area_m2` | number, 1–10000 | | no | none |
| car-decorations | `color` | one choice | `white`, `red`, `pink`, `gold`, `other` | yes | `color=<value>` |

**Validation** happens on the server, from the definitions:
- an unknown key gets `attributes.<key>: "unknown"`;
- a missing required field gets `"required"`;
- a value of the wrong kind or outside the allowed values gets `"invalid"`;
- a number outside its range or a text over its limit gets `"too_large"`, `"must_be_positive"` or `"too_long"`, matching the existing field values;
- an empty optional field is dropped.

The response's error envelope is the existing one. Field errors use the key `attributes.<key>`.

## 5. What brides see

- **Home:**
  - A row of five category buttons, each with a simple icon: Köýnekler (to `/dresses`), Maşynlar, Milli eşikler, Çadyrlar and Maşyn bezegleri (each to `/c/<slug>`).
  - The "New" section shows the newest published items from **all** categories.
  - The search box goes to `/search?q=`.
  - The city picker still opens the dress list for that city, as before.
- **Category page `/c/:slug`:** the same grid and "Show more" paging as the dress list.
  - **Filters:** city, price from and to, and the category's filters from §4. A choice filter takes one value, like the dress filters. A number filter is "at least N".
  - **Unknown slug:** an unknown category, or `dresses`, which has its own page, shows the not-found page.
- **Item page `/items/:id`:** the same layout as the dress page.
  - It has the photo gallery, the title and the price (with "/ hour" or "/ day" for cars), and the category's details as label and value pairs.
  - It also has the description, the busy/free calendar, the shop card with Call, Instagram and TikTok, favorite and share.
  - **Dresses:** a dress opened at `/items/:id` redirects to `/dresses/:id`.
  - **Link previews:** shared links to `/items/:id` get Open Graph tags, like dress links.
- **Search `/search?q=`:** finds items from all categories with the existing matching. It searches the title, the shop name and the shop aliases, ignores Turkmen letters versus plain Latin, and tolerates misspellings. Category chips ("All", then every category) narrow the results.
- **Tiles everywhere:** item tiles link to `/dresses/:id` for dresses and `/items/:id` for everything else. Prices show the car unit.
- **Favorites:** any listing can be a favorite. Listing ids are unique across categories, so the stored ids stay as they are. The favorites page loads them through the all-category list.
- **Shop page `/shops/:slug`:** shows all of the shop's published items. When the shop has more than one category, chips ("All", then each category it has) narrow the list.

## 6. What shops and admins see

- **Listing lists:**
  - **Admin:** the "Dresses" menu becomes **"Listings"** (`/admin/listings`). It shows all categories, with a category filter next to the existing shop filter. The old `/admin/dresses` link opens Listings filtered to dresses.
  - **My shop:** "My dresses" becomes **"My listings"**.
  - **Rows:** each row shows a small category label.
- **New listing:** "New listing" first asks for the category.
  - Choosing **Dress** opens the existing dress editor.
  - Choosing any **other category** opens the new **item editor**: the basics, then the category's fields rendered from the definitions, then the existing photo manager and busy/free calendar.
- **Editing:** opening a row goes to the right editor.
- **Category:** the category of an existing item cannot be changed. To change it, delete the item and create it again.
- **Ownership:** the shop-accounts rules apply unchanged.
  - Owners reach only their own shop's items, and any other id answers 404.
  - The shop comes from the session, never from the request.
  - The item editor uses the shared `ManageContext`.

## 7. API

All responses use the existing error envelope.

### 7.1 Public

| Method and path | Result |
|---|---|
| `GET /api/items` | A page of published listings from published shops, in all categories or `category=<slug>`. Parameters: `q`, `city`, `price_min`, `price_max`, `ids`, `page`, `per_page`, plus the category's filters (§4) when `category` is a non-dress category. An unknown category or filter value gives 400 `validation_failed`. Each item is the existing list item plus `category` (slug) and `attributes`; for dresses, `attributes` is `{}`. |
| `GET /api/items/:id` | One published item: the list fields plus description, all images, the shop card, `category` and `attributes`. A dress answers with `category: "dresses"`, so the frontend can redirect. |
| `GET /api/items/:id/busy-days` | The same contract as `/api/dresses/:id/busy-days`, for any published listing. Both paths now accept any listing. |
| `GET /api/shops/:slug` | Now returns `items` (a page of all the shop's published items, accepting `category`) in place of `dresses`, plus `categories`: the slugs of the categories it has published items in, in display order. |

### 7.2 Admin (`/api/admin`) and shop owner (`/api/shop`)

Both prefixes have the same routes. Under `/api/shop`, everything is scoped to the owner's shop.

| Method and path | Result |
|---|---|
| `GET /items` | All of the shop's listings in every category, including dresses, for the lists in §6. Admins may filter by `shop_id` and `category`. |
| `POST /items` | Creates a non-dress item. The body has `{shop_id, category, title, price_manat, price_is_from, description, is_published, attributes}`. `category: "dresses"` gives `category: "invalid"`, because dresses keep `/dresses`. Owners' `shop_id` is ignored. |
| `GET/PUT/DELETE /items/:id` | A non-dress item. A dress id answers 404 here. `PUT` cannot change `category`. `DELETE` removes the photos (files too) and the busy days, as for dresses. |
| `GET /items/:id/busy-days`, `PUT/DELETE /items/:id/busy-days/:day` | The existing busy-days contract, for any listing (dresses included). The editors use these paths for every category. |

The images endpoints already work for any listing. They are unchanged. `DELETE /dresses/:id` now answers 404 for a non-dress listing, as `GET` and `PUT` already did.

## 8. Code structure

### 8.1 Backend

- **`backend/migrations/00005_categories.sql`:**
  - seeds the four categories;
  - adds `listings.attributes jsonb NOT NULL DEFAULT '{}'`;
  - adds a GIN index on `attributes`.
- **`internal/catalog`, a new package:**
  - `Categories` (slug, names, field definitions);
  - `Validate(slug, attrs)`, which returns the clean attributes and the field errors;
  - `ParseFilters(slug, query)`, which returns SQL conditions on `attributes` and the field errors.
  - **Field-definitions file for the frontend:** a golden-file test writes the definitions to `frontend/src/lib/catalog.json` with `-update`, and fails when the file is out of date.
- **`internal/items`, a new package:** the public list and get, and the admin and shop CRUD, with the same `Scope` pattern as dresses (fail-closed `RequireScope`).
  - **Shared code with dresses:** a new `internal/listing` package holds what both use:
    - the public card types and the page type;
    - the browse query (city, price, ids, paging), the search condition and its ranking;
    - the basic field checks, the shop-exists check, the `?shop_id=` parameter and the ownership check.
    The dress behaviour stays the same, which the existing dress tests prove.
- **`internal/busydays`:**
  - `dressExists` becomes `listingExists`, which accepts any listing;
  - the routes are also registered under `/items/:id/busy-days`.
- **`internal/shops` public page:** it uses the all-category list (`items`).
- **`internal/web`:** it adds Open Graph tags for `/items/:id`.

### 8.2 Frontend

- **`lib/catalog.ts`:** it reads `catalog.json` and provides the types, the category list and the field definitions.
  - **Text keys:**
    - category names come from `cat.<slug>`;
    - field labels from `attr.<slug>.<key>`;
    - options from `attr.<slug>.<key>.<option>`;
    - the price units from `price.per_hour` and `price.per_day`.
  - **i18n test:** it checks that every one of these keys exists in tk, ru and en.
- **API client:** it gains `items`, `item`, and `listings` plus the item create, read, update and delete in the shared `manage(base)` set. Busy days use the `/items/:id/busy-days` paths for every listing.
- **New components:**
  - `CategoryBar`, with icons;
  - `ItemFilters`, the generic filter sheet built from the definitions;
  - `AttributeList`;
  - `ItemEditor`, built from the definitions.
  - The dress tile is generalized to link and price by category.
- **New and changed pages:**
  - **New:** `pages/Category.tsx` (`/c/:slug`), `pages/Item.tsx` (`/items/:id`) and `pages/Search.tsx` (`/search`).
  - **Changed:** Home, Shop, Favorites, and the admin and owner listing lists and the "New listing" choice.
- **Texts:** all new text is in tk, ru and en, with parity enforced by the test.

## 9. Testing

- **Go**, against the test database:
  - **Definitions:** every field kind, required and optional, ranges, unknown keys, and choice values.
  - **Filters:** each filter in §4, including `size` on a several-choices field, and `seats_min` and `guests_min` boundaries. Unknown values give 400.
  - **Items API:**
    - create, read, update and delete for each new category;
    - a dress id answers 404 on `/items/:id`;
    - `category` cannot change;
    - `dresses` is rejected on `/items`.
  - **Public list:**
    - all categories and one category;
    - search across categories, including the "ak gelyn" → "Ak Gelin" case;
    - dresses keep passing all their existing tests.
  - **Owners:** they reach only their own items; another shop's item, image or day answers 404, and the list ignores `shop_id`.
  - **Busy days:** they work for a non-dress item under both prefixes.
  - **Golden file:** the definitions file is up to date.
- **Deno:**
  - the catalog helpers;
  - the price with a unit;
  - the tile link by category;
  - the API client paths;
  - i18n parity, including every category, field and option key.
- **Browser** (run by the controller against the test database only; `wedding_dev` is never touched before merge):
  1. An owner adds a car with a photo and busy days, and publishes it.
  2. A bride finds it from the home category button, filters by body and color, opens it, and sees "/ hour" and the details.
  3. Search finds it alongside a dress.
  4. Favorites and the shop page show both.
  5. Admin "Listings" shows both, with category labels and the right editors.
  6. No sideways overflow at 320px, in tk, ru and en.

## 10. Later

- Revising the fields after talking to shops: edit the definitions, add the texts, and regenerate `catalog.json`.
- The visual redesign, which is the next project.
- Moving dresses onto the flexible fields, if one system everywhere becomes worth it.
- Date-availability filters ("free on my date").
