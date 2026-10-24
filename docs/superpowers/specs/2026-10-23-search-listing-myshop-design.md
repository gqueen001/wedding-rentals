# Search Filters, Listing Layout and the Owner Profile: Design Spec

**Date:** 2026-10-23
**Status:** Approved by the product owner (2026-10-23), including 8px button corners; implemented on `feature/shop-profile-and-search`
**Builds on:** `2026-10-23-editorial-redesign-design.md` (merged in PR #7) and `2026-10-21-shop-accounts-design.md`.

## 1. Goal

After trying the redesign on a phone and a computer, the product owner asked for 8 changes:

1. Search: add a city choice.
2. Search: add filters.
3. Search: remove the big title and the small "GELIN" label.
4. Dress page on phones: remove one of the two Call buttons.
5. Dress page on computers: fit the info next to the picture.
6. Owner edit page on computers: put the photos and the busy/free calendar next to the dress info.
7. "My shop" should look like the public shop page, like an Instagram profile. It gets an "Edit profile" button that shows only "About the salon" and "Change logo". Tapping a photo opens its edit page. Brides see the public page as before.
8. Give text-only buttons (Back, Delete, Add your shop, and the others) a thin border.

Mockups are in `.superpowers/brainstorm/11380-1792755719/content/` (`dress-desktop.html`, `myshop.html`).

## 2. Decisions

| Topic | Decision |
|---|---|
| Phone Call buttons (4) | **Keep the fixed bottom bar.** The Call button inside the shop box is hidden on phones. Computers keep it, since they have no bottom bar. |
| Search filters (2) | **Price, plus the category's own filters.** The price from/to is always there. When one category chip is picked, that category's own filters are added. The city is a separate dropdown. |
| Dress page on computers (5) | **Layout B:** the info and the shop box sit beside the picture. The busy/free calendar goes under both, across the full width. |
| Owner profile (7) | It lives on **`/shop` (My shop)**. "Edit profile" opens a new page, **`/shop/profile`**. The public `/shops/:slug` page is unchanged. |
| Borders (8) | **All text-only buttons**, plus the Back links and the "Add your shop" menu link. |
| Button corners | **8px** rounded corners on every button, chosen in a mockup. |
| Owner password length | The change from 10 to 6 characters (commit `5e2131b`, already on this branch) ships in the same PR. |

## 3. Search page (`/search`)

- **Header:** remove the small `label` ("GELIN") and the big visible `h1` ("Gözleg"). The page starts with the search box. An `h1` with `class="sr-only"` and the same text stays for screen readers. The page title is unchanged.
- **City:**
  - A "Şäher" dropdown sits under or next to the search box, the same control and style as on Home: "Ähli şäherler" plus every city.
  - Changing it sets `?city=<slug>`, or removes it for "all", and reloads the list.
- **Filters button:**
  - It sits next to the category chips, with the same look and count badge ("Filters (n)") as the category pages.
  - It opens a sheet with:
    - **always:** price from/to (`price_min`, `price_max`);
    - **when one category chip other than "All" is picked:** that category's own filter fields, from `catalog.json` (the same fields as its `/c/:slug` page).
    - **Dresses:** dresses have no catalog filter fields, so picking "Köýnekler" gives the price only. Their size, color and style filters stay on `/dresses`.
- **Active filters** show as removable chips (`FilterChips`): city, price, and each category filter.
- **Address (URL):** everything is in the query: `?q=&category=&city=&price_min=&price_max=&<category params>`.
  - Picking another category chip keeps `q`, `city` and the prices, and drops the old category's own params.
  - Picking "All" drops every category param.
- **API:** `/api/items` already accepts `city`, `price_min`, `price_max` and, with `category`, that category's params. No backend change is needed.
- **Logic:** reading and writing these params is a pure helper in `lib/`, with unit tests. It must cover:
  - a round trip of every param;
  - dropping the old category's params when the category changes;
  - ignoring an unknown category.

## 4. Dress and item pages (`ListingDetail`)

- **Phones (below 768px):** the shop box (`ShopCard` / `ContactButtons`) hides its Call button, because the fixed Call bar already has one. Instagram, TikTok, the address and the "everything from this shop" link stay. From 768px up, the Call button shows as today.
- **Computers (lg, 1024px and up):**
  - **Left:** the gallery.
  - **Right, in this order:** the kicker, title and price; Favorite and Share; the details; the description; the shop box (with Call).
  - **Below both, full width:** the busy/free calendar ("Boş we meşgul günler"), with a hairline above it.
- **Phones and tablets:** one column, in the same order: gallery, info, details, description, shop box, calendar.
- Nothing else changes: the phone photo buttons, the sticky Call bar and its spacer, the texts and the data.

## 5. Edit pages (`DressEdit`, `ItemEdit`)

- These pages serve both owners (`/shop/dresses/:id`, `/shop/items/:id`, `…/new`) and admins (`/admin/…`), so both get the change.
- **lg (1024px) and up:** two columns.
  - **Left:** the Back button, the heading and the info form.
  - **Right:** the Photos box, then the busy/free calendar box.
  - The page's maximum width grows from `max-w-2xl` to fit both columns, about `max-w-6xl`.
- **Below lg:** one column, exactly as today.
- New listings show the same "save first" behaviour for photos and the calendar as today.

## 6. My shop (`/shop`) and Edit profile (`/shop/profile`)

### 6.1 `/shop`: the owner's profile

- **Header:** like the public shop page.
  - The oval `ShopLogo` (xl), then the city and address as a `label`, the shop name as the big title, and the description.
  - Under them:
    - **Edit profile** (`btn btn-outline`) goes to `/shop/profile`;
    - **+ New listing** (`btn btn-primary`) goes to the existing new-listing page;
    - when the shop is published, the existing "See your shop page" link goes to `/shops/:slug`.
- **The "hidden" notice:** shown when the shop is not published, unchanged.
- **Photo grid:**
  - Every listing of the shop, including drafts, from the existing `ownerApi.owner.listings()`.
  - 3 per row on phones and 4 per row from md, with small gaps and 3:4 photos, like an Instagram grid.
  - Each tile is a link to the listing's edit page: `/shop/dresses/:id` for dresses, `/shop/items/:id` for other categories.
  - The tile shows only the photo. With no photo, the tile is a soft `veil` box with the title in small text.
  - An unpublished listing shows a small "Draft" label on the photo (reuse the existing status text).
  - The link's accessible name is the title, plus "Draft" when unpublished.
- **Empty:** the existing "No listings yet…" text, with the New listing button above it.
- The current list view (`ListingList`) is no longer used on My shop. Admin pages keep it.

### 6.2 `/shop/profile`: Edit profile

- A new route inside `ShopLayout`, for signed-in owners only, with the same guard as `/shop`.
- **Content, in this order:**
  - a bordered **‹ Back** button to `/shop`;
  - the title "Edit profile";
  - the owner's sign-in phone as small text;
  - the **About the salon** box: the existing `ShopFields` form with Save, the same save logic and validation as today;
  - the **Change logo** box: the existing `LogoUpload`.
- After saving, the page stays put and shows the existing "Saved" status. Back returns to `/shop`, which shows the new details.

### 6.3 Brides

`/shops/:slug` is unchanged. It has no edit button, and its tiles open the public `/dresses/:id` or `/items/:id`.

## 7. Button corners and thin borders

- **Rounded corners:** every `.btn` (primary, outline and quiet) changes from square corners to **8px** (`border-radius: 0.5rem`), the same as the input boxes. The product owner chose this in a mockup (`button-radius.html`). Chips stay pills, and round icon buttons (`btn-icon`, the photo overlay buttons) stay circles. This replaces the redesign spec's "square-cornered" rule (§3.3 of `2026-10-23-editorial-redesign-design.md`).

- **`.btn-quiet`:**
  - It gets a 1px border in `silver` (`#8a8a8f`), keeping its garnet text.
  - On hover the background becomes `veil`.
  - This covers Delete, Sign out (admin and My shop), Clear filters (both sheets), Add a name, and Remove photo.
- **Back links** on the edit pages and `/shop/profile` become `btn btn-quiet` with a left chevron and the existing "Back" text.
- **Add your shop** in the desktop top menu gets a thin garnet border around its existing label, and stays 44px high.
- **Contrast:** `#8a8a8f` on white is 3.4:1, which meets the 3:1 rule for UI component borders.

## 8. New texts

There is one new key, in `tk`, `ru` and `en`:

| Key | tk | ru | en |
|---|---|---|---|
| `myshop.edit_profile` | Profili üýtget | Изменить профиль | Edit profile |

Everything else reuses existing keys:
- "About the salon" is `myshop.details` ("Salon barada").
- The logo box keeps the logo upload's own heading.
- Back, New listing, the Draft status, Saved, the city label and "All cities", Filters, and the filter chips all have keys already.

A native Turkmen proofread is still a later step.

## 9. Out of scope

- Dress-specific filters (size, color, style) on Search.
- Category chips on the owner's grid.
- Any backend change other than the password length, which is already committed.
- Any change to the public shop page.

## 10. Testing

- **Unit:** the search params helper (§3), and any new pure helper for owner tile links. `deno task test`, `check` and `build` stay clean. The Go tests, including the password boundary test, pass.
- **Browser** (on the test database, with demo data only):
  - Screenshots in tk, ru and en at 320, 375, 768, 1024 and 1280px of: `/search` (with a category, city and price), a dress and an item page, `/shop`, `/shop/profile`, and an owner and an admin edit page.
  - No sideways scrolling, and the contrast check is clean.
  - Search: filters and chips, and the URL round trip.
  - Phones: the shop box has no Call button. Computers: the calendar sits under both columns.
  - My shop: tiles open the edit page, Edit profile saves, and the Draft label appears.
  - The public shop page is unchanged.
