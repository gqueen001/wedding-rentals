# Dark Mode and the Phone My Shop Header: Design Spec

**Date:** 2026-10-24
**Status:** Approved by the product owner in brainstorming with mockups (`.superpowers/brainstorm/22537-1792832213/content/`: `myshop-phone-2.html`, `mobile-dark.html` option A, and `dark-text.html` option B)
**Builds on:** `2026-10-23-editorial-redesign-design.md` (the tokens), `2026-10-23-search-listing-myshop-design.md` (My shop as a profile) and `2026-10-24-account-avatar-design.md`.

## 1. Goal

The product owner asked for two things.

1. **My shop on phones.** "My shop page's shop icon, user name, edit profile and add new buttons [are] big as [the] computer version. Please give them [a] mobile version. On [the] navbar, items do not fit on one line."
2. **Dark mode by device**, with a cool charcoal look, softer light grey text, and a switch.

## 2. Decisions

| Topic | Decision |
|---|---|
| My shop on phones | **Compact, Instagram-like.** A small oval logo, with the name and the two buttons beside it, all smaller. Computers are unchanged. |
| Top bars on phones | **One line.** Sign out becomes a small bordered icon below 768px. This covers the My shop bar and the admin bar. |
| Dark look | **A · Cool charcoal** with **B · light grey** text. |
| When dark | **The device's setting by default, plus a switch** on the More page (`/more`): Auto, Light or Dark, remembered on the device. |
| Where | **Every page**, public, My shop and admin, because all of them use the shared color tokens. |

## 3. My shop on phones (below 768px)

Computers (md and up) keep today's layout. Below md:

- **The header row** has, from left to right:
  - the `ShopLogo` oval at 70 × 92px;
  - next to it:
    - the city · address `label`;
    - the salon name, in the label font at about 18px (an `h1` at `text-lg`, which the heading rule sets in `font-label`);
    - under the name, the two buttons in a 2-column grid with a 6px gap: **Edit profile** (outline) and **+ New listing** (primary).
- **The two buttons on phones:**
  - 32px high, with 10px text, 0.06em letter-spacing and small side padding;
  - a long word wraps onto a second line inside its button and never overflows (Russian at 320px is the case to check);
  - from md they become today's full-size buttons.
- **Below the row:** the description, then the "See your shop page" link, then the listings grid as today.

## 4. One-line top bars on phones

- `ShopLayout`'s bar and `AdminLayout`'s bar each fit on one line at 320, 375 and 768px in tk, ru and en.
- **Sign out on phones:** below md it becomes an icon-only `btn btn-quiet` square, 44px tall, with a new `LogoutIcon`. Its `aria-label` is the existing sign-out text. From md, the text button stays as today.
- **If one line still doesn't fit at 320px,** the bar's section links (My shop's "Meniň salonym", and the admin's links) may use smaller padding and text on phones. They must not be dropped from the admin bar. The My shop link may be hidden below `sm`, since every sub-page has a Back button. The prototype measures this.

## 5. Dark mode

### 5.1 Colors

The token names stay as they are, and their values change in dark mode. Two new tokens let fills and text on fills differ from the text colors.

| Token | Light (unchanged) | Dark | Used for |
|---|---|---|---|
| `veil` | `#f6f6f7` | `#121214` | the page background |
| `white` | `#ffffff` | `#1b1b1e` | cards, top bars, sheets, inputs ("surface") |
| `line` | `#e6e6e8` | `#2c2c31` | hairlines |
| `ink` | `#2e2e30` | `#bdbdc2` | main text |
| `silver-ink` | `#6b6b70` | `#8e8e94` | secondary text and labels |
| `silver` | `#8a8a8f` | `#6a6a70` | control borders and icons |
| `garnet` | `#8e1b2e` | `#ef8a9a` | prices, links, highlights, focus rings and accent borders (the text-like uses) |
| `garnet-deep` | `#6b1222` | `#f2b0b9` | text on `blush` |
| `blush` | `#f8e7ea` | `#3a1f25` | selected chips and busy days |
| **`garnet-fill`** (new) | `#8e1b2e` | `#a8243a` | fills: `.btn-primary`, `bg-garnet` areas such as the avatar letter, the shop logo letter and the photo badge |
| **`garnet-fill-deep`** (new) | `#6b1222` | `#8e1b2e` | `.btn-primary` hover |
| **`on-fill`** (new) | `#ffffff` | `#ffffff` | text and icons on `garnet-fill` and on photos (today's `text-white`, `fill-white`, `stroke-white` and `border-white` uses) |

**Rules:**
- **Fills:** every fill that carries white text uses `garnet-fill`.
- **On ink:** anything drawn on an `ink` fill, such as `.chip-on`, uses `veil` for its text, so it flips correctly in both themes.
- **Photo overlay buttons:** `bg-white/90` follows `white`, so they are dark in dark mode, with `ink` icons.
- **Fixed swatches:** photos, logos and the `ColorSwatch` dress colors don't change.
- **Contrast:** in dark mode, text is at least 4.5 : 1 on both `veil` and `white`, control borders are at least 3 : 1, and white text on `garnet-fill` is at least 4.5 : 1.
- **Implementation check:** the controller checks every `bg-white`, `text-white` and `*-garnet` use. A fill becomes `garnet-fill` or `on-fill` where the role needs it. Whatever is left must read well in both themes.

### 5.2 How dark mode turns on

- **The theme attribute:** `<html>` gets `data-theme="light"`, `data-theme="dark"`, or no attribute for Auto.
- **The CSS:** the dark values apply under:
  - `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }`;
  - `:root[data-theme="dark"] { … }`.
- **The choice:**
  - It is stored with the existing `safeKV` under `wr.theme`, as `"light"`, `"dark"` or absent (Auto).
  - A small inline script in `index.html` sets the attribute before the CSS paints, so there is no white flash. It wraps its storage access in try/catch.
- **Native controls:**
  - `color-scheme: light dark` (or the forced value) is set on `:root`, so form controls and scrollbars match.
  - `<meta name="theme-color">` has a light (`#ffffff`) and a dark (`#1b1b1e`) variant with `media` queries. When the switch forces a theme, the script sets the matching value.
- **Auto:** with no attribute, the media query alone follows the device, even while the page is open.
- **The logic:** a pure helper in `lib/theme.ts` (parse the stored value, and turn a choice into the attribute or no attribute) is unit tested. The inline script repeats the same tiny rule.

### 5.3 The switch on Has köp (`/more`)

- A new **Görnüş** (Theme) section, in the same style as the language rows. It has three choices: **Awtomatik** (Auto, the default), **Ýagty** (Light) and **Garaňky** (Dark).
- It is a radio group with the selected one marked, keyboard-operable, and with visible focus.
- Choosing one applies it at once and remembers it.

## 6. Texts

There are 4 new keys in tk, ru and en.

| Key | tk | ru | en |
|---|---|---|---|
| `more.theme` | Görnüş | Тема | Theme |
| `theme.auto` | Awtomatik | Как на устройстве | Auto |
| `theme.light` | Ýagty | Светлая | Light |
| `theme.dark` | Garaňky | Тёмная | Dark |

The sign-out icon reuses the existing sign-out key. A native Turkmen proofread is still a later step.

## 7. Out of scope

- A separate dark set of photos or logos.
- A theme switch anywhere other than `/more`.
- Dark-specific layout changes.
- Any backend change.

## 8. Testing

- **Unit:** `lib/theme.ts`, which parses the stored value and turns a choice into the attribute.
- `deno task test`, `check` and `build` stay clean.
- **Browser** (test database, demo data only):
  - **Screenshots** in light and in dark (by device setting, and by the switch), in tk, ru and en at 320, 375, 768 and 1280px, of:
    - home, `/c/cars`, a dress page and `/more`;
    - `/shop`, `/shop/profile` and an editor;
    - `/admin/listings`.
  - No overflow and no page errors.
  - The contrast check passes in **both** themes.
  - **Behaviour:**
    - the switch sets and remembers the theme;
    - Auto follows the device's emulated color scheme;
    - no white flash on load in dark: the first paint is already dark;
    - the My shop phone header matches §3, with the buttons wrapping inside at 320px in ru;
    - both top bars fit on one line;
    - the sign-out icon has its accessible name.
