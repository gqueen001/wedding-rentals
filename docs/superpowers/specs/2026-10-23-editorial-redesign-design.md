# Editorial Redesign: Design Spec

**Date:** 2026-10-23
**Status:** Approved in brainstorming with visual mockups; awaiting the product owner's review of this document
**Builds on:** `2026-10-21-categories-design.md` (all five categories exist) and the current "Gyrmyzy" visual system in `frontend/src/index.css`.

## 1. Goal

Give Gelin a modern, premium look and an app-like way to move around on phones. The product owner's goals:
1. The site looked plain. It should feel modern and "wedding-premium".
2. Phone navigation should feel like an app.

The reference is the "Style Crew" fashion website on Dribbble, an editorial magazine look. Mockups of the agreed direction are in `.superpowers/brainstorm/` (`editorial-style.html`, `editorial-pages.html`).

## 2. Decisions

| Topic | Decision |
|---|---|
| Direction | **Editorial**: white and soft charcoal, huge thin serif words over oval and arch photos, categories as large elegant words, small spaced-out uppercase labels, thin lines, lots of white space. |
| Color | **A touch of garnet.** The look is black and white, and garnet (`#8e1b2e`) appears only on prices, the active tab, primary buttons and highlights. |
| Phone navigation | A **bottom bar**: Esasy (Home) · Kategoriýalar · Halanlarym (Favorites) · Has köp (More). |
| Desktop navigation | A top menu. There is no bottom bar on wide screens. |
| Admin and "My shop" | They pick up the new colors and fonts through the shared tokens. **Their layout is unchanged**; redesigning them is out of scope. |
| Behaviour and data | **Unchanged.** All features, addresses (URLs), API calls and data stay as they are. This project changes only the look and the navigation. |

## 3. Visual system

### 3.1 Colors

The token names stay as they are, so the admin pages follow automatically. The values change, and there is one new token.

| Token | New value | Use | Contrast on white |
|---|---|---|---|
| `ink` | `#2e2e30` | text, headings, dark buttons | 13.6 : 1 |
| `silver-ink` | `#6b6b70` | secondary text and the small uppercase labels | 5.3 : 1 (AA for small text) |
| `silver` | `#8a8a8f` | input and control borders, icons | 3.4 : 1 (AA for UI components) |
| `line` (new) | `#e6e6e8` | hairlines and dividers (decorative only) | — |
| `veil` | `#f6f6f7` | soft gray backgrounds and photo placeholders | — |
| `garnet` | `#8e1b2e` (unchanged) | prices, the active tab, primary buttons, highlights | 9.0 : 1 |
| `garnet-deep` | `#6b1222` (unchanged) | hover on garnet | — |
| `blush` | `#f8e7ea` (unchanged) | busy days, and selected chips with garnet text | garnet on blush is 7.5 : 1 |

Every text color must reach at least 4.5 : 1 against its background, and controls at least 3 : 1. The mockups' `#8a8a8f` labels (3.4 : 1) are too light for text, which is why labels use `silver-ink`.

### 3.2 Fonts

All three fonts are self-hosted through npm packages, so they work where Google is slow or blocked. They replace Forum and Manrope.

| Role | Font | Package | Rule |
|---|---|---|---|
| Display | **Italiana** | `@fontsource/italiana` | Only for large text (28px and up): page titles, the hero word, category words. It is never used for body text or small text. |
| Label | **Tenor Sans** | `@fontsource/tenor-sans` | The logo "GELIN" (letter-spacing .32em), small uppercase labels (10–12px, letter-spacing .2–.3em), prices, and button text. |
| Body | **Jost** (variable) | `@fontsource-variable/jost` | Everything else. |

The tokens are `--font-display`, `--font-label` (new) and `--font-sans`. The global `h1–h3` rule keeps the display font with weight 400.

### 3.3 Shapes and spacing
- Photos are rectangles, plus oval or arch frames as accents: the home hero, the Categories page and the home category thumbnails.
- **Buttons:**
  - Primary buttons are **square-cornered**, garnet, with uppercase Tenor Sans text.
  - Secondary buttons are outlined in ink.
  - Chips stay rounded pills.
- Lines are 1px `line`.
- White space is generous: at least a 16px page gutter on phones and 56px on desktop.

### 3.4 Unchanged rules
- **Focus:** the existing focus outline and the `aria-disabled` focus rules still apply.
- **Motion:** `prefers-reduced-motion` is honoured.

## 4. Navigation

### 4.1 Phone (below 768px, Tailwind `md`)

- **Top bar:** the "GELIN" logo, which links to `/`, and a search icon, which links to `/search`. The language switch and the favorites link move out of the top bar. The carpet ornament band (`GolBand`) is no longer shown on public pages.
- **Bottom bar:** fixed to the bottom, white with a hairline top border. Each button has an icon and a label in small uppercase Tenor Sans, at least **10px**.

  | Tab | Path | Active for |
  |---|---|---|
  | Esasy | `/` | `/` |
  | Kategoriýalar | `/categories` (new) | `/categories`, `/c/*`, `/dresses`, `/dresses/*`, `/items/*` |
  | Halanlarym | `/favorites` | `/favorites`; shows the favorites count |
  | Has köp | `/more` (new) | `/more`, `/search`, `/shops/*` |

- **Active tab:** shown in garnet, with a dot and `aria-current="page"`.
- **Touch targets:** each tab is at least 44×44px.
- **Space:** the bar respects `env(safe-area-inset-bottom)` (the iPhone home indicator). Page content gets enough bottom padding that nothing hides behind the bar.
- **Where it is hidden:** on admin, "My shop", sign-in and sign-up pages, which keep their own layout.

### 4.2 Desktop (768px and up)

- **Top bar:** "GELIN" on the left, a pill search field in the middle, then a menu: KATEGORIÝALAR, HALANLARYM (with count), the TK · RU · EN switch, and "Salonyňyzy goşuň" (Add your shop).
- **No bottom bar.**

### 4.3 The new pages

- **`/categories` (Kategoriýalar):** a small label and a large title ("Toý üçin ähli zat"), then one row per category. Each row has:
  - a photo, oval or rectangular in turn;
  - the category name as a large Italiana word;
  - a small "N BILDIRIŞ" count;
  - a chevron.

  Each row links to `/dresses` or `/c/<slug>`.
  - **Photo:** the newest published listing's photo in that category, or a soft `veil` placeholder.
  - **Count:** the total number of published listings in that category.
  - **Data:** one `/api/items?category=<slug>&per_page=1` request per category, using only existing endpoints.
- **`/more` (Has köp):**
  - the language choice (TK · RU · EN) as large tappable rows;
  - Search;
  - "Add your shop" (`/shop/signup`);
  - "Shop sign-in" (`/shop/login`);
  - the tagline;
  - the contact phone, when `CONTACT_PHONE` is set (from the existing meta tag).

## 5. Pages

The data and behaviour of every page stay the same. Only layout and styling change.

- **Home `/`:**
  - **Hero:** a large Italiana "GELIN" overlapping an oval photo, with a smaller round photo and a thin diagonal hairline. The photos come from the newest published listings. While they load, or if there are none, soft `veil` ovals show instead.
  - Under the hero: "TOÝ ÜÇIN ÄHLI ZAT" as a small label, then the search box.
  - The category list as large words (Köýnekler, Maşynlar…), each linking to its page, with a thumbnail photo.
  - "TÄZELER" (newest), as a label plus a "HEMMESI" link, above the grid.
  - The city picker stays (it opens the dress list for that city).
  - **Desktop:** a wide hero with the big word, the oval photo on the left, and the category word list on the right, as in the desktop mockup.
- **Category lists `/c/:slug` and `/dresses`:**
  - a label ("KATEGORIÝA"), then a big Italiana title;
  - a row of chips: a "Süzgüçler · N" (filters) chip that opens the existing filter sheet, plus chips showing the active filters, each tap removing that filter;
  - the found count as a small label;
  - a 2-column grid on phones, 3–4 columns on desktop.
- **Listing tile:**
  - a rectangular photo with a round white heart button in the corner;
  - the price in garnet Tenor Sans, the title in Jost, and the shop name in `silver-ink`.
- **Dress `/dresses/:id` and item `/items/:id`:**
  - **Photos:** on phones the gallery fills the full width at the top, with round white back, share and heart buttons on the photo. On desktop it keeps today's two-column layout.
  - **Text:** a label ("KÖÝNEK · <shop>"), then the title in Italiana and the price in garnet Tenor Sans.
  - **Details:** shown as small-label and value rows.
  - **Below:** the busy/free calendar and the shop card come next, restyled.
  - **Sticky contact bar (phones):** a bar sits just above the bottom bar and is always visible. It has a garnet **JAŇ ET** (Call) button and an outlined **INSTAGRAM** button, which shows only when the shop has Instagram.
- **Search `/search`:** a big title, the search box, and the category chips restyled.
- **Favorites `/favorites`:** a big title and the same grid.
- **Shop page `/shops/:slug`:** the logo in an oval, the name in Italiana, the city and address as a small label, the contact buttons and the category chips.
- **Not found, error and empty states:** restyled with an Italiana title.
- **Owner sign-in and sign-up:** the new fonts and colors on the existing layout.
- **Footer (desktop only):** the tagline, plus "Rent out dresses? Add your shop". On phones these move to `/more`.

## 6. Accessibility and quality rules

- **Contrast:** text meets 4.5 : 1 and controls 3 : 1 (§3.1).
- **Font sizes:** no text smaller than 10px. Italiana is used only at 28px and up.
- **Bottom bar markup:** a `<nav>` with an `aria-label`. Each tab has `aria-current="page"` when active, and the favorites count is part of its accessible name.
- **Keyboard:** the bottom bar and the sticky contact bar are reachable in a logical order, and the focus outline stays visible.
- **Layout:** no sideways scrolling at 320px in tk, ru and en. Long Turkmen and Russian words (for example "Maşyn bezegleri", "Национальная одежда") must wrap or fit.
- **Overlaps:** the bottom bar and the sticky bars never cover the last content or the focused element. The page adds bottom padding equal to their height.

## 7. Code structure

- **`frontend/src/index.css`:** the new token values, the `line` and `--font-label` tokens, the font imports, square primary buttons, and a `.label` utility (Tenor Sans, uppercase, spaced, `silver-ink`).
- **`frontend/package.json`:** add the three fontsource packages and remove `@fontsource/forum` and `@fontsource-variable/manrope`.
- **`lib/nav.ts` (new):** `activeTab(pathname)`, a pure function with a Deno test. It returns `"home" | "categories" | "favorites" | "more" | null`.
- **`components/BottomNav.tsx` (new)**, plus a redesigned `components/Header.tsx` that serves as the phone top bar and the desktop menu.
- **`app/App.tsx`:** renders the bottom bar on public pages and adds the bottom padding.
- **New pages:** `pages/Categories.tsx` and `pages/More.tsx`. `main.tsx` gets the routes `/categories` and `/more`.
- **Restyled pages and components:** Home, Dresses, Category, Item, Dress, Search, Favorites, Shop, NotFound, `ListingTile`, `ListingGrid`, `CategoryBar` (which becomes the home category word list), the shop card, `Availability`, `EmptyState`, `ErrorState`, `SearchBox`, the filter chip row, `Sheet` (styling only), and `Gallery` (overlay buttons on phones).
- **i18n:** new keys for the tab labels, the `/categories` and `/more` texts, the hero label, the count label ("{count} bildiriş") and the contact bar, all in tk, ru and en.

## 8. Testing

- **Deno:**
  - `activeTab` for every path in §4.1, including `/shops/x` going to "more" and `/admin/...` going to null;
  - i18n parity for every new key;
  - every existing test stays green.
- **Browser** (the controller runs headless Chrome against a server built from the branch, using **test data only**):
  1. **Screenshots:** at 320, 375, 768 and 1280px in tk, ru and en, for home, `/categories`, a category list, a dress page, an item page, search, favorites, a shop page and `/more`. There must be no sideways overflow.
  2. **Bottom bar:**
     - it shows on public pages and is hidden at 768px and up;
     - it is hidden on admin and "My shop" pages;
     - the right tab is active (`aria-current`);
     - the favorites count updates.
  3. **Sticky contact bar:** it shows on a dress page on phones, and the last content is not covered.
  4. **Contrast:** a script checks the computed contrast of every visible text element on the main pages. It reports anything below 4.5 : 1 (3 : 1 for 24px and up).
  5. **Keyboard:** Tab reaches the bottom bar and the contact bar, and the focus outline is visible.
  6. **Regression:** the existing category, shop-account and admin flows still work.

## 9. Out of scope (later)

- Redesigning the admin and "My shop" screens.
- New features: no new filters, sorting or sharing.
- A dark mode.
- Animations beyond simple fades.
- A native-speaker review of the new texts. It stays on the to-do list with the earlier Turkmen proofread.
