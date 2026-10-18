# Wedding Rentals v1: Design Spec

**Date:** 2026-10-18
**Status:** Approved in brainstorming; awaiting a final spec review

## 1. Problem and goal

In Turkmenistan, brides rent their wedding dress, cars and other wedding items. Finding a dress today means searching Instagram and TikTok, often twice, once in English and once in Turkmen, because rental houses use names in either language. The goal is one website where all wedding rentals are grouped and searchable in any language.

**v1 scope:** wedding **dresses** only, on a **mobile-first website** (installable as a PWA). Later versions add more categories, shop self-service, booking, and a "find my dream dress" feature.

## 2. Key decisions

| Topic | Decision |
|---|---|
| Who adds listings | Admins add shops and dresses at launch. Shops claim their pages later; the schema is ready, but the feature is not in v1. |
| Platform | A mobile-first responsive website plus a PWA manifest. No native apps in v1. |
| Categories | Only "Dresses". The schema supports more categories without restructuring. |
| Contact flow | Direct: the dress page shows the shop's phone, address and Instagram/TikTok links. No in-app booking. |
| UI languages | Turkmen (default), Russian, English. |
| Bride accounts | None. Favorites are kept in the browser's localStorage. |
| Business model | Shops only rent dresses; there are no sale prices. |
| Architecture | One Go API plus one Solid.js site; the admin panel lives at `/admin` in the same site. |

## 3. Tech stack

- **Frontend:** Deno 2.x, Vite, Solid.js, Tailwind CSS, `@solidjs/router`. The design is built with the frontend-design skill and aims for an elegant bridal look.
- **Backend:** Go 1.27, Gin, PostgreSQL 17, pgx v5 (pgxpool), JWT (`golang-jwt/jwt/v5`), bcrypt for passwords.
- **Migrations:** plain SQL files in `backend/migrations/`, applied with `goose`.
- **Image processing:** Go standard library decoders (JPEG/PNG) plus `golang.org/x/image` for WebP decoding and resizing. Output is JPEG.

## 4. Project structure

```
wedding-rentals/
  backend/
    cmd/server/        HTTP server entry point
    cmd/admin/         CLI: create admin accounts (no public sign-up)
    internal/
      config/          env-based config (DATABASE_URL, JWT_SECRET, UPLOAD_DIR, PORT, ...)
      db/              pgxpool setup
      httpx/           shared error format, middleware (auth, rate limit, recovery)
      auth/            admin login, JWT issue/verify
      cities/
      shops/           handlers + repository
      dresses/         handlers + repository + filters/search
      images/          upload, resize, Storage interface (local disk implementation)
      web/             serves built frontend, injects Open Graph tags for dress pages
    migrations/
  frontend/
    deno.json
    vite.config.ts
    src/
      pages/           Home, Dresses, Dress, Shop, Favorites
      pages/admin/     Login, Shops, ShopEdit, Dresses, DressEdit
      components/
      i18n/            tk.json, ru.json, en.json + small i18n helper
      lib/api.ts       typed API client; the only place that calls fetch
      lib/favorites.ts localStorage favorites
      lib/filters.ts   filter state <-> URL query string
  docs/superpowers/specs/
```

**Development:** the Go API runs on `:8080`. The Vite dev server runs on `:5173` and proxies `/api` and `/uploads` to `:8080`.

**Production:** a single Go binary serves `/api/*`, `/uploads/*`, and the built frontend (SPA fallback to `index.html`). For `/dresses/:id`, it injects `og:title`, `og:image` and `og:description` into `index.html` so links shared on Instagram or Telegram show previews.

## 5. Data model

All tables have `created_at` and `updated_at` (`timestamptz`). IDs are `bigint` identity columns.

- **admins:** `id`, `email` (unique), `password_hash`
- **cities:** `id`, `slug` (unique), `name_tk`, `name_ru`, `name_en`, `sort_order`. Seeded with Ashgabat, Arkadag, Mary, Türkmenabat, Daşoguz, Balkanabat, Tejen, Serdar, Bayramaly.
- **shops:** `id`, `slug` (unique), `name`, `city_id` → cities, `address`, `phone`, `instagram_url` (nullable), `tiktok_url` (nullable), `description` (nullable), `logo_image_id` (nullable) → images, `is_published` (default false), `owner_user_id` (nullable; reserved for future shop claiming, unused in v1)
- **shop_aliases:** `id`, `shop_id` → shops (cascade delete), `alias`. Holds alternate names and spellings, including Cyrillic.
- **categories:** `id`, `slug` (unique), `name_tk`, `name_ru`, `name_en`. Seeded with `dresses` only.
- **listings:** `id`, `shop_id` → shops (cascade), `category_id` → categories, `title` (name or model code), `price_manat` (int, > 0), `price_is_from` (bool; the UI shows "from X TMT"), `description` (nullable), `is_published` (default false)
- **dress_details:** `listing_id` (PK, → listings, cascade), `color`, `silhouette`, `sleeves`, `sizes` (`text[]`)
  - `color` ∈ `white, ivory, champagne, blush, other`
  - `silhouette` ∈ `ball_gown, a_line, mermaid, straight, short`
  - `sleeves` ∈ `long, short, none`
  - `sizes` ⊆ `XS, S, M, L, XL, XXL`
  - The values are slugs enforced with CHECK constraints; display names come from the frontend i18n files.
- **images:** `id`, `listing_id` (nullable, cascade), `shop_id` (nullable, cascade), `position` (int), `path_small` (≈400px wide), `path_large` (≈1200px wide), `width`, `height`. CHECK: exactly one of `listing_id` / `shop_id` is set.

**Future categories:** add a row to `categories` and a new `<category>_details` table. Shops, images, listings, search and favorites stay unchanged.

**Visibility rule:** public endpoints return only listings where `listings.is_published` and the shop's `shops.is_published` are both true.

## 6. Search

- Enable the `pg_trgm` extension.
- An immutable SQL function `norm(text)` lowercases and maps Turkmen letters to Latin base letters: `ä→a, ç→c, ň→n, ö→o, ş→s, ü→u, ý→y, ž→z`.
- GIN trigram indexes on `norm(shops.name)`, `norm(shop_aliases.alias)` and `norm(listings.title)`.
- The query `q` matches when `norm(q)` is similar to (`%` operator) or a substring of (`ILIKE`) any of those fields. Results are ordered by best similarity, then newest.
- Cyrillic and other spellings are covered by admin-entered aliases. Automatic transliteration is out of scope.

## 7. API

All responses are JSON. Errors always use this format:

```json
{ "error": { "code": "validation_failed", "message": "...", "fields": { "phone": "required" } } }
```

`code` is a stable machine-readable string that the frontend maps to translated messages. `fields` is present only for validation errors.

### Public

| Method & path | Description |
|---|---|
| `GET /api/cities` | All cities, sorted by `sort_order` |
| `GET /api/dresses` | Filters: `city`, `price_min`, `price_max`, `size`, `color`, `style`, `sleeves`, `q`, `ids` (comma list, used by Favorites), `page` (default 1), `per_page` (default 24, max 60). `style` filters on `dress_details.silhouette`; `price_min` and `price_max` compare against `price_manat`; `city` is a city slug. Returns `{ items, page, per_page, total }`. Each item has id, title, price, first photo (small), shop name/slug, and city. |
| `GET /api/dresses/:id` | Full dress: all photos, details, and the shop card (name, slug, city, address, phone, instagram, tiktok, logo) |
| `GET /api/shops/:slug` | Shop info plus its published dresses (paginated like the dress list) |

Unpublished or missing resources return `404 not_found`.

### Admin (JWT required)

Login uses `Authorization: Bearer <token>`. Tokens are HS256, signed with `JWT_SECRET`, and expire after 7 days.

| Method & path | Description |
|---|---|
| `POST /api/admin/login` | `{email, password}` → `{token}`. Rate-limited per IP to 5 attempts per minute (`429 rate_limited`). Wrong credentials return `401 invalid_credentials` and never reveal which field was wrong. |
| `GET/POST /api/admin/shops`, `GET/PUT/DELETE /api/admin/shops/:id` | Shop CRUD, including the `aliases: string[]` field and `is_published`. Lists include unpublished items. |
| `GET/POST /api/admin/dresses`, `GET/PUT/DELETE /api/admin/dresses/:id` | Dress CRUD (listing + dress_details in one transaction). The list is filterable by `shop_id`. |
| `POST /api/admin/images` | Multipart upload with `file` plus either `listing_id` or `shop_id`. Max 10 MB; JPEG/PNG/WebP only (checked by content sniffing, not the extension). Returns the image record. |
| `PATCH /api/admin/images/order` | `{ ids: [...] }` sets the photo order for one listing |
| `DELETE /api/admin/images/:id` | Deletes the record and its files |

Slugs are generated from the shop name (with Turkmen letters normalized) and made unique with a numeric suffix.

## 8. Frontend

### Public pages (mobile first)

- **Home `/`:** a large search box, the city selector, and the newest dresses.
- **Dresses `/dresses`:** a photo grid (2 columns on mobile) showing price and shop name. The "Filters" button opens a bottom sheet with city, price range, size, color, style and sleeves. Filter state is kept in the URL query string, so a filtered list can be shared. Infinite scroll loads more pages.
- **Dress `/dresses/:id`:** a swipeable, zoomable gallery; price, sizes, color, style and sleeves; and a shop card with large **Call** (`tel:`), **Instagram** and **TikTok** buttons plus the address. There are favorite (❤️) and share (Web Share API, falling back to copying the link) buttons.
- **Shop `/shops/:slug`:** the logo, contacts, and a grid of the shop's dresses.
- **Favorites `/favorites`:** ids come from localStorage and are loaded with `GET /api/dresses?ids=`. Ids that no longer exist are dropped silently.
- **Header:** the logo, search, and a language switcher (TK / RU / EN). Turkmen is the default; the choice is saved in localStorage.
- **PWA:** a web manifest and icons so the site can be installed to the home screen. No offline mode in v1.

### Admin pages (`/admin`)

- **Login:** the token is stored in localStorage. A 401 from the API redirects to login.
- **Shops list → shop edit:** all shop fields, logo upload, the alias list editor, and the published toggle.
- **Dresses list (filter by shop) → dress edit:** all fields, multi-photo drag-and-drop upload with progress, drag to reorder, delete photo, and the published toggle.
- The admin UI is translated as well (it uses the same i18n files).

### i18n

Flat JSON files per language with identical keys, checked by a test. The enum slugs (color, silhouette, sleeves) and API error codes all have translation keys.

## 9. Error handling

- **Frontend:** network or server errors show a friendly translated message with a "Try again" button, never a blank page. Each list and detail page has loading skeletons. Admin forms show validation errors next to each field (from `error.fields`).
- **Backend:** recovery middleware turns panics into `500 internal_error` and logs them. Validation happens in handlers before any database call. Database unique violations map to `409 conflict`.
- **Uploads:** an image that fails to decode returns `422 invalid_image`; one that is too large returns `413 file_too_large`. If writing to the database fails, the files already written are removed.

## 10. Testing

The work is test-driven: each feature is built test-first.

- **Backend:** Go tests against a real PostgreSQL test database (`TEST_DATABASE_URL`). Migrations run once per test run, and each test runs inside a transaction that is rolled back. Coverage includes:
  - dress filters (each filter alone and combined) and pagination
  - search: Turkmen-letter normalization, aliases, typo tolerance
  - the published/unpublished visibility rule for both shop and listing
  - admin login (success, wrong password, rate limit) and JWT middleware (missing, expired, bad signature)
  - admin CRUD validation, and the slug generation and uniqueness logic
  - image upload: type sniffing, size limit, resize output dimensions, cleanup on failure
  - Open Graph injection for `/dresses/:id`
- **Frontend (Deno test):** `filters.ts` (URL ↔ state round-trip), `favorites.ts` (add/remove/persist), and i18n key parity across tk/ru/en.

## 11. Out of scope for v1

- Categories other than dresses (cars, halls, photographers, …)
- Shops claiming and managing their own pages, and shop accounts
- In-app booking requests and availability calendars
- Bride accounts and syncing favorites across devices
- The "find my dream dress" discovery/recommendation feature
- Native iOS/Android apps and offline mode
- Online payment
- Automatic Cyrillic ↔ Latin transliteration in search (aliases cover this)
- Cloud object storage (photos go on local disk, behind the `Storage` interface)
- Deployment and hosting setup (decided separately before launch)
