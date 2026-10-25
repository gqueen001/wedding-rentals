# Back Button, Computer Theme Button and Small Tidy-ups: Design Spec

**Date:** 2026-10-25
**Status:** Approved by the product owner in chat ("Shorter button", "Previous page", "Small button in the menu")
**Builds on:** `2026-10-24-dark-mode-mobile-shop-design.md` (the theme choice) and `2026-10-24-simpler-home-and-shop-design.md`.

## 1. Changes

1. **More page (phones):** the section with the Search and Favorites rows is removed. Phones still have Favorites in the bottom bar, and the search box on the home page.
2. **Home:** the visible "Şäher" (City) word before the city dropdown is removed. The dropdown keeps the same name for screen readers, through `aria-label={t("home.city")}`.
3. **Computer menu, Favorites:**
   - the heart icon is removed;
   - the favorites count becomes a small raised number after the word (`text-[10px]`, garnet, `align-super`);
   - the link's accessible name, "Favorites: N", is unchanged.
4. **Computer footer:** the button reads a shorter text, from a new key `footer.add_shop_short` ("Salonyňyzy goşuň" / "Добавить салон" / "Add your shop"). The tagline and the button each stay on one line (`whitespace-nowrap`); if a screen is too narrow for both, they sit on two rows. The long `footer.add_shop` text stays on the More page.
5. **Back button on computers:**
   - Every public page except Home shows a small bordered **‹ Yza** (`common.back`) button at the top of the page, from md up. Phones don't show it.
   - It goes to the previous page when there is one in the tab's history; otherwise it goes to Home.
   - It is a new `BackButton` component, rendered by the app layout. The My shop and admin pages have their own layouts and Back links, and are unchanged.
6. **Theme button on computers:**
   - A small round button sits after TK RU EN in the computer menu. Each click goes **Awtomatik → Ýagty → Garaňky → Awtomatik**.
   - It uses the same `theme` setting as the More page's Theme section, so the choice is remembered and both stay in sync.
   - **Its icon shows the current choice:** a half-filled circle for Auto, a sun for Light, a moon for Dark.
   - **Its name**, as `aria-label` and `title`, is "<Theme>: <choice>", for example "Görnüş: Awtomatik".
   - The pure "next choice" step, `nextTheme(choice)` in `lib/theme.ts`, is unit tested.

## 2. Texts

There is one new key:

| Key | tk | ru | en |
|---|---|---|---|
| `footer.add_shop_short` | Salonyňyzy goşuň | Добавить салон | Add your shop |

Everything else reuses existing keys: `home.city`, `common.back`, `more.theme` and `theme.*`.

## 3. Out of scope

- The phone layout.
- The Search page's own city label.
- The My shop and admin layouts.
- Any backend change.

## 4. Testing

- **Unit:** `nextTheme`. `deno task test`, `check` and `build` stay clean.
- **Browser** (test database, demo data), in light and dark, in tk, ru and en, at 320, 375, 768, 1024 and 1280px:
  - no overflow and no errors;
  - the More page has no Search or Favorites rows;
  - Home has no "Şäher" text, and the dropdown is named;
  - the computer Favorites link has no heart, with a small count after adding a favorite;
  - the footer button reads the short text, and each footer text stays on one line;
  - Back shows from md on every public page except Home, is hidden on phones, and goes to the previous page (or Home when opened directly);
  - the theme button cycles Auto → Light → Dark, the page follows, the More page shows the same choice, and the name says the current choice;
  - contrast is clean in both themes.
