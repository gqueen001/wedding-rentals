# A Simpler Home Page, Top Bar and Shop Page: Design Spec

**Date:** 2026-10-24
**Status:** Approved by the product owner in chat, with three choices: keep the home search box, remove both top-bar searches, and a compact shop page like My shop
**Builds on:** `2026-10-24-dark-mode-mobile-shop-design.md` (the compact My shop header and the dark tokens).

## 1. Goal

The product owner asked for five changes:

1. Remove the Turkmen göl ornament band from the top of the pages.
2. On phones, a shop's public page (`/shops/:slug`) has a shop name and Call button that are too big. Make them like the My shop page.
3. Remove the home page's newest listings and its "see all" link, so brides browse category by category.
4. Remove the "Ähli kategoriýalar" (All categories) link under the home category words.
5. Remove the top-bar search, because the home page already has a search box.

## 2. Changes

### 2.1 No göl band

- `GolBand` is removed from the My shop and admin top bars, and from the owner sign-in, owner sign-up and admin sign-in pages.
- The component file is deleted.
- The app icon images are unchanged.

### 2.2 Home page

- **The newest section is removed:** the "Täzeler" heading, the "Hemmesini gör" (`/search`) link, and the listings grid with its loading and error states.
- **The hero ovals:** they still show the newest listings' photos. The same `api.items(per_page=8)` request stays, used only for the hero.
- **The category words:** they lose their "Ähli kategoriýalar" link. The bottom bar's Kategoriýalar tab still leads to `/categories`.
- **What stays:** the search box with the city picker, and the search results page `/search`. It stays reachable from the home search box and from **Has köp → Search**.
- **Unused keys removed:** `home.newest`, `home.see_all_items` and `home.see_all_categories`, from all three languages.

### 2.3 Top bar (`Header`)

- **Computers:** the search field goes.
- **Phones:** the search icon goes.
- **What remains:** the bar has the logo, the menu (computers only), and the account avatar.

### 2.4 A shop's public page on phones

- **Shared header:** the compact header from My shop becomes a shared `ShopProfileHeader` component, used by My shop and by the public shop page.
  - It takes the logo, the place label, the name, the description, and an **actions** slot.
  - **Phones** (below md): a small oval logo, with the label, the name in `text-lg` and the actions beside it, and the description below.
  - **From md:** the large logo, then the name in the display font, the description, and the actions, as today.
- **My shop:** passes its Edit profile, New listing and "See your shop page" actions, exactly as now.
- **The public shop page:** passes its contact buttons.
  - `ContactButtons` gets a `compact` option.
  - **On phones:** a small "Jaň et" button (the existing `contact.call` text), with the phone number in its accessible name. Instagram and TikTok become small outline buttons in the same 2-column grid.
  - **From md:** today's full buttons ("Jaň et: +993…", Instagram, TikTok).
  - The dress and item pages' shop box uses `ContactButtons` without `compact` and is unchanged.
- **Computers:** the shop page looks as today, apart from the description now sitting above the buttons. It already did.

## 3. Out of scope

- The search results page itself.
- The Categories page.
- The More page.
- Any backend change.

## 4. Testing

- `deno task test`, `check` and `build` stay clean. The i18n parity test covers the removed keys.
- **Browser** (test database, demo data only), in light and dark, in tk, ru and en at 320, 375, 768 and 1280px:
  - home, `/shops/:slug`, `/shop`, `/shop/login`, `/admin/login` and `/admin/listings`;
  - no overflow, no page errors, and contrast clean in both themes;
  - **Home:** no newest grid and no "see all" links; the search box still opens `/search`.
  - **Top bar:** no search field or icon.
  - **No göl band anywhere.**
  - **The shop page on phones:** compact. "Jaň et" is a `tel:` link named with the phone number.
  - **My shop:** unchanged.
