# Editorial Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Gelin an editorial, "Style Crew"-like look (white and charcoal with a touch of garnet, a light display serif, small spaced-out labels, oval photos), and give phones an app-style bottom bar with new Categories and More pages.

**Architecture:**
- **Look:** most of it comes from new token values, fonts and component classes in `frontend/src/index.css`. The admin and "My shop" pages pick them up without layout changes.
- **Navigation:** a pure `activeTab(pathname)` drives the phone `BottomNav`. A redesigned `Header` serves as the phone top bar and the desktop menu.
- **Pages:** the public pages are restyled. The dress and item pages share one new `ListingDetail` layout (with overlay buttons on the photo and a sticky Call bar), and the list pages share a new `FilterChips` row.

**Tech Stack:** Solid 1.9, @solidjs/router, Vite 7, Tailwind 4, built and tested with Deno 2.4. The new fonts come from fontsource npm packages. There are no backend changes.

**Spec:** `docs/superpowers/specs/2026-10-23-editorial-redesign-design.md`

## Global Constraints

- **Unchanged:** behaviour, data, URLs and API calls stay the same. The only new routes are `/categories` and `/more`. Admin and "My shop" keep their layout.
- **Colors** (tokens in `index.css`):
  - `ink #2e2e30`
  - `silver-ink #6b6b70`, used for secondary text and labels (5.3 : 1)
  - `silver #8a8a8f`, used for control borders and icons (3.4 : 1)
  - `line #e6e6e8`, new, for hairlines only
  - `veil #f6f6f7`
  - `garnet #8e1b2e`, `garnet-deep #6b1222` and `blush #f8e7ea`, unchanged

  Garnet appears only on prices, the active tab, primary buttons and highlights.
- **Fonts** (self-hosted, exact versions 5.3.0):
  - **Display:** Cormorant Garamond Light (300), only at 30px and up. Smaller headings automatically use the label font (a CSS rule).
  - **Label:** Tenor Sans, for the logo, small uppercase labels, prices and buttons.
  - **Body:** Jost Variable.

  Forum and Manrope are removed.
- **Accessibility:**
  - Text contrast is at least 4.5 : 1 (3 : 1 for 24px and up), and no text is smaller than 10px.
  - Focus stays visible.
  - The bottom bar is a `<nav>` with an `aria-label`, and the active tab has `aria-current="page"`.
  - No sideways scrolling at 320px in tk, ru and en.
- **Bottom bar:**
  - The tabs are Esasy `/`, Kategoriýalar `/categories`, Halanlarym `/favorites` and Has köp `/more`.
  - It shows below 768px on public pages only. Above it, the header menu takes over.
  - It respects `env(safe-area-inset-bottom)`.
- **Text:** every user-visible string goes through `frontend/src/i18n/{tk,ru,en}.json`, with identical keys and placeholders, which a test enforces.
- **Tools:**
  - Frontend tools run only through Deno, from `frontend/`: `deno task test`, `deno task check` and `deno task build`. Never run Vite with Node.
  - npm is used only to add or remove packages, with `--save-exact`.
- **Data:** never write to the `wedding_dev` database.
- **Commits:** every commit message ends with the `Co-Authored-By:` trailer line the controller gives you.

## File Map

```
frontend/package.json, package-lock.json, deno.lock   fonts: +cormorant-garamond, +tenor-sans, +jost; −forum, −manrope
frontend/src/index.css                       tokens, fonts, heading rule, .label, square .btn, .chip-on
frontend/src/components/{ListingTile,Skeleton,ShopLogo,AttributeList,ShopCard,Availability}.tsx   restyled
frontend/src/lib/nav.ts, nav_test.ts         activeTab(pathname)
frontend/src/components/icons.tsx            + HomeIcon, GridIcon, MoreIcon; − category icons (Task 4)
frontend/src/components/BottomNav.tsx        the phone bottom bar
frontend/src/components/Header.tsx           phone top bar + desktop menu
frontend/src/app/App.tsx                     bottom bar, padding for it, desktop-only footer
frontend/src/pages/{Categories,More}.tsx     new tab pages
frontend/src/main.tsx                        /categories, /more
frontend/src/components/CategoryBar.tsx, pages/Home.tsx   the editorial home page
frontend/src/components/FilterChips.tsx      "Filters · N" chip + removable active-filter chips
frontend/src/pages/{Dresses,Category,Search,Favorites,Shop}.tsx   restyled headers
frontend/src/components/ListingDetail.tsx    the shared dress and item page layout with a sticky Call bar
frontend/src/components/ShareButton.tsx      + a round icon-only variant
frontend/src/pages/{Dress,Item}.tsx          use ListingDetail
frontend/src/i18n/{tk,ru,en}.json            new keys per task
```

## How to read the steps

- **Full files:** a path in backticks on its own line, directly followed by a code block, gives the **whole file**. Create or overwrite it with exactly that content. From the repository root you can extract it with:
  `python3 -I .superpowers/sdd/red/block.py <brief> <path> > <path>`
- **Replacements:** "In `path`, replace:" gives an exact text to find (it occurs once) and the text to put in its place.
- **Appends:** "Append to `path`:" gives text to add at the very end of the file.
- **i18n entries:** under **en.json**, **ru.json** and **tk.json**, a block of `"key": "value"` lines goes at the end of that file. Add a comma to the file's current last entry, and keep the closing `}` last.

---

### Task 1: The visual system: fonts, tokens and the shared look

There is no layout change in this task. The whole site, admin included, gets the new colors, fonts, labels and square buttons. A few small components get the editorial details.

**Files:**
- Modify:
  - `frontend/package.json`, `frontend/package-lock.json` and `frontend/deno.lock`, through npm and Deno
  - `frontend/src/index.css`
  - `frontend/src/components/ListingTile.tsx`
  - `frontend/src/components/Skeleton.tsx`
  - `frontend/src/components/ShopLogo.tsx`
  - `frontend/src/components/AttributeList.tsx`
  - `frontend/src/components/ShopCard.tsx`
  - `frontend/src/components/Availability.tsx`

**Interfaces:**
- Produces:
  - **Tailwind tokens:** `line`, `font-label`, and the new values of `ink`, `silver`, `silver-ink` and `veil`.
  - **Component classes:**
    - `.label`: small uppercase Tenor Sans in `silver-ink`, letter-spacing .28em;
    - `.chip-on`: an ink chip, for links and buttons that are "on";
    - `.btn`, which is now square, uppercase Tenor Sans.
  - **A heading rule:** an `h1`, `h2` or `h3` with `text-xs` through `text-2xl` uses `font-label`.
  - **`ShopLogo` size `"xl"`:** an oval, h-36 w-28. All logo frames use `rounded-[50%]`.

- [ ] **Step 1: Swap the font packages**

Run, from `frontend/`:
```bash
npm install --save-exact @fontsource/cormorant-garamond@5.3.0 @fontsource/tenor-sans@5.3.0 @fontsource-variable/jost@5.3.0
npm uninstall @fontsource/forum @fontsource-variable/manrope
```
Expected: `package.json` dependencies are now exactly:
```json
    "@fontsource-variable/jost": "5.3.0",
    "@fontsource/cormorant-garamond": "5.3.0",
    "@fontsource/tenor-sans": "5.3.0",
    "@solidjs/router": "1.0.0",
    "solid-js": "1.9.17"
```

- [ ] **Step 2: Tokens, fonts and component classes**

`frontend/src/index.css`
```css
@import "tailwindcss";
@import "@fontsource/cormorant-garamond/300.css";
@import "@fontsource/tenor-sans";
@import "@fontsource-variable/jost";

@theme {
  --color-white: #ffffff;
  --color-veil: #f6f6f7;
  --color-line: #e6e6e8;
  --color-ink: #2e2e30;
  --color-garnet: #8e1b2e;
  --color-garnet-deep: #6b1222;
  --color-silver: #8a8a8f;
  --color-silver-ink: #6b6b70;
  --color-blush: #f8e7ea;
  --font-display: "Cormorant Garamond", "Times New Roman", serif;
  --font-label: "Tenor Sans", "Segoe UI", system-ui, sans-serif;
  --font-sans: "Jost Variable", "Segoe UI", system-ui, sans-serif;
}

@layer base {
  html {
    color-scheme: light;
    -webkit-text-size-adjust: 100%;
  }
  body {
    background: var(--color-white);
    color: var(--color-ink);
    font-family: var(--font-sans);
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }
  h1, h2, h3 {
    font-family: var(--font-display);
    font-weight: 300;
    line-height: 1.1;
    color: var(--color-ink);
  }
  /* The light display serif is too thin below 30px: smaller headings use the label font. */
  :is(h1, h2, h3):is(.text-xs, .text-sm, .text-base, .text-lg, .text-xl, .text-2xl) {
    font-family: var(--font-label);
    letter-spacing: 0.04em;
  }
  :focus-visible {
    outline: 2px solid var(--color-garnet);
    outline-offset: 2px;
  }
  ::selection {
    background: var(--color-blush);
  }
}

@layer components {
  /* Small, widely spaced uppercase text: section labels, kickers, counts. */
  .label {
    font-family: var(--font-label);
    font-size: 0.6875rem;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--color-silver-ink);
  }
  .btn {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    border-radius: 0;
    padding: 0 1.25rem;
    font-family: var(--font-label);
    font-size: 0.75rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    transition: background-color 0.15s, border-color 0.15s, color 0.15s;
  }
  .btn:disabled,
  .btn[aria-disabled="true"] {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .btn-primary {
    background: var(--color-garnet);
    color: var(--color-white);
  }
  .btn-primary:hover:not(:disabled):not([aria-disabled="true"]) {
    background: var(--color-garnet-deep);
  }
  .btn-outline {
    border: 1px solid var(--color-ink);
    background: var(--color-white);
    color: var(--color-ink);
  }
  .btn-outline:hover:not(:disabled):not([aria-disabled="true"]) {
    border-color: var(--color-ink);
  }
  .btn-quiet {
    padding: 0 0.75rem;
    color: var(--color-garnet);
  }
  .btn-quiet:hover:not(:disabled):not([aria-disabled="true"]) {
    background: var(--color-veil);
  }
  .btn-icon {
    display: inline-flex;
    height: 2.75rem;
    width: 2.75rem;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
  }
  .btn-icon:hover:not(:disabled):not([aria-disabled="true"]) {
    background: var(--color-veil);
  }
  .field-input {
    width: 100%;
    min-height: 2.75rem;
    border: 1px solid var(--color-silver);
    border-radius: 0.5rem;
    background: var(--color-white);
    padding: 0.5rem 0.75rem;
    color: var(--color-ink);
  }
  .field-input:focus {
    outline: 2px solid var(--color-garnet);
    outline-offset: 1px;
  }
  .field-input[aria-invalid="true"] {
    border-color: var(--color-garnet);
  }
  .chip {
    display: inline-flex;
    min-height: 2.5rem;
    align-items: center;
    gap: 0.4rem;
    border: 1px solid var(--color-silver);
    border-radius: 9999px;
    padding: 0 0.9rem;
    font-size: 0.875rem;
    cursor: pointer;
  }
  /* A chip that is a link or button and currently on, e.g. the selected category. */
  .chip-on {
    border-color: var(--color-ink);
    background: var(--color-ink);
    color: var(--color-white);
  }
  .chip:has(:checked) {
    border-color: var(--color-garnet);
    background: var(--color-blush);
    color: var(--color-garnet-deep);
    font-weight: 600;
  }
  .chip:has(:focus-visible) {
    outline: 2px solid var(--color-garnet);
    outline-offset: 2px;
  }
  .sheet-enter {
    animation: sheet-up 0.22s ease-out;
  }
}

@keyframes sheet-up {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 3: Small components**

`frontend/src/components/ListingTile.tsx`
```tsx
import { A } from "@solidjs/router";
import { Show } from "solid-js";
import { listingHref } from "../lib/catalog.ts";
import type { ListItem } from "../lib/types.ts";
import { FavoriteIconButton } from "./FavoriteButton.tsx";
import { priceText } from "./price.ts";

/** One listing in a grid, of any category: photo, price, title and shop. */
export default function ListingTile(props: { item: ListItem; eager?: boolean }) {
  return (
    <article class="relative">
      <A href={listingHref(props.item)} class="block">
        <div class="aspect-[3/4] overflow-hidden bg-veil">
          <Show when={props.item.photo}>
            {(src) => (
              <img
                src={src()}
                alt={props.item.title}
                loading={props.eager ? "eager" : "lazy"}
                fetchpriority={props.eager ? "high" : undefined}
                decoding="async"
                class="h-full w-full object-cover"
              />
            )}
          </Show>
        </div>
        <p class="mt-3 font-label text-sm tracking-[0.06em] text-garnet">{priceText(props.item)}</p>
        <h3 class="mt-1 truncate font-sans text-base text-ink">{props.item.title}</h3>
        <p class="truncate text-sm text-silver-ink">{props.item.shop.name}</p>
      </A>
      <FavoriteIconButton id={props.item.id} class="absolute right-2 top-2" />
    </article>
  );
}
```

`frontend/src/components/Skeleton.tsx`
```tsx
import { For } from "solid-js";
import { t } from "../i18n/i18n.ts";
import { GRID_CLASS } from "./grid.ts";

export function GridSkeleton(props: { count?: number }) {
  return (
    <ul class={GRID_CLASS} aria-busy="true" aria-label={t("common.loading")}>
      <For each={Array.from({ length: props.count ?? 8 })}>
        {() => (
          <li>
            <div class="aspect-[3/4] animate-pulse bg-veil" />
            <div class="mt-3 h-4 w-1/2 animate-pulse rounded bg-veil" />
            <div class="mt-2 h-3 w-3/4 animate-pulse rounded bg-veil" />
          </li>
        )}
      </For>
    </ul>
  );
}

export function DetailSkeleton() {
  return (
    <div class="pt-4 lg:grid lg:grid-cols-2 lg:gap-12 lg:pt-8" aria-busy="true" aria-label={t("common.loading")}>
      <div class="-mx-4 aspect-[3/4] animate-pulse bg-veil sm:mx-0" />
      <div class="mt-6 space-y-4 lg:mt-0">
        <div class="h-10 w-3/4 animate-pulse rounded bg-veil" />
        <div class="h-7 w-1/3 animate-pulse rounded bg-veil" />
        <div class="h-24 animate-pulse rounded bg-veil" />
      </div>
    </div>
  );
}
```

`frontend/src/components/ShopLogo.tsx`
```tsx
import { Show } from "solid-js";

const SIZE = {
  sm: "h-10 w-10 text-lg",
  md: "h-14 w-14 text-2xl",
  lg: "h-24 w-24 text-4xl",
  xl: "h-36 w-28 text-6xl", // an oval, for the shop page
} as const;

/** The shop's logo, or its first letter on garnet when it has none. */
export default function ShopLogo(props: { url: string | null; name: string; size?: keyof typeof SIZE }) {
  const size = () => SIZE[props.size ?? "md"];
  return (
    <Show
      when={props.url}
      fallback={
        <span
          aria-hidden="true"
          class={`inline-flex shrink-0 items-center justify-center rounded-[50%] bg-garnet font-display text-white ${size()}`}
        >
          {props.name.trim().charAt(0).toLocaleUpperCase()}
        </span>
      }
    >
      {(url) => <img src={url()} alt="" class={`shrink-0 rounded-[50%] bg-veil object-cover ${size()}`} />}
    </Show>
  );
}
```

`frontend/src/components/AttributeList.tsx`
```tsx
import { For, Show } from "solid-js";
import { tr } from "../i18n/i18n.ts";
import { categoryDef, fieldLabel, optionLabel } from "../lib/catalog.ts";
import type { Attributes } from "../lib/types.ts";

/** A listing's own details as label and value pairs, in the catalog's field order. */
export default function AttributeList(props: { category: string; attributes: Attributes }) {
  const rows = () =>
    (categoryDef(props.category)?.fields ?? [])
      // The price unit is already part of the price.
      .filter((f) => f.key !== "price_unit" && props.attributes[f.key] !== undefined)
      .map((f) => {
        const v = props.attributes[f.key];
        const value = f.kind === "choice"
          ? tr(optionLabel(props.category, f.key, String(v)))
          : f.kind === "choices"
          ? (v as string[]).map((o) => tr(optionLabel(props.category, f.key, o))).join(", ")
          : String(v);
        return { label: tr(fieldLabel(props.category, f.key)), value };
      });
  return (
    <Show when={rows().length > 0}>
      <dl class="grid grid-cols-[max-content_1fr] items-center gap-x-6 gap-y-3 text-sm">
        <For each={rows()}>
          {(row) => (
            <>
              <dt class="label">{row.label}</dt>
              <dd>{row.value}</dd>
            </>
          )}
        </For>
      </dl>
    </Show>
  );
}
```

`frontend/src/components/ShopCard.tsx`
```tsx
import { A } from "@solidjs/router";
import { Show } from "solid-js";
import { i18n, t } from "../i18n/i18n.ts";
import { cityName, telHref } from "../lib/format.ts";
import type { ShopCard } from "../lib/types.ts";
import { InstagramIcon, PhoneIcon, TikTokIcon } from "./icons.tsx";
import ShopLogo from "./ShopLogo.tsx";

/** Only https links are rendered, whatever the API sends. */
const httpsUrl = (url: string | null) => (url?.startsWith("https://") ? url : null);

/** Big tap targets for the three ways a bride contacts a shop. */
export function ContactButtons(props: {
  shop: { phone: string; instagram_url: string | null; tiktok_url: string | null };
}) {
  return (
    <div class="grid gap-3 sm:grid-cols-3">
      <a href={telHref(props.shop.phone)} class="btn btn-primary min-h-12 text-base sm:col-span-3">
        <PhoneIcon />
        {t("dress.call", { phone: props.shop.phone })}
      </a>
      <Show when={httpsUrl(props.shop.instagram_url)}>
        {(url) => (
          <a href={url()} target="_blank" rel="noopener noreferrer" class="btn btn-outline min-h-12">
            <InstagramIcon />
            {t("dress.instagram")}
          </a>
        )}
      </Show>
      <Show when={httpsUrl(props.shop.tiktok_url)}>
        {(url) => (
          <a href={url()} target="_blank" rel="noopener noreferrer" class="btn btn-outline min-h-12">
            <TikTokIcon />
            {t("dress.tiktok")}
          </a>
        )}
      </Show>
    </div>
  );
}

export default function ShopCardSection(props: { shop: ShopCard }) {
  return (
    <section aria-labelledby="shop-card-title" class="border-t border-line pt-6">
      <p class="label">{t("dress.rent_from")}</p>
      <div class="mt-3 flex items-center gap-4">
        <ShopLogo url={props.shop.logo} name={props.shop.name} />
        <div class="min-w-0">
          <h2 id="shop-card-title" class="truncate text-4xl">
            <A href={`/shops/${props.shop.slug}`} class="hover:text-garnet">
              {props.shop.name}
            </A>
          </h2>
          <p class="label mt-1">{cityName(props.shop.city, i18n.lang())}</p>
        </div>
      </div>
      <div class="mt-5">
        <ContactButtons shop={props.shop} />
      </div>
      <dl class="mt-5 text-sm">
        <dt class="label">{t("dress.address")}</dt>
        <dd class="mt-0.5">{props.shop.address}</dd>
      </dl>
      <A
        href={`/shops/${props.shop.slug}`}
        class="label mt-5 inline-block border-b border-ink pb-0.5 text-ink"
      >
        {t("dress.shop_page", { shop: props.shop.name })}
      </A>
    </section>
  );
}
```

`frontend/src/components/Availability.tsx`
```tsx
import { createResource, Match, Switch } from "solid-js";
import { t } from "../i18n/i18n.ts";
import { api } from "../lib/client.ts";
import ErrorState from "./ErrorState.tsx";
import MonthCalendar from "./MonthCalendar.tsx";

/** A listing page's read-only calendar of busy days, with a legend and a reminder to call. */
export default function Availability(props: { listingId: number }) {
  const [data, { refetch }] = createResource(() => props.listingId, (id) => api.busyDays(id));
  return (
    <section aria-labelledby="availability-title" class="border-t border-line pt-6">
      <h2 id="availability-title" class="label">{t("avail.title")}</h2>
      <div class="mt-4 max-w-sm">
        <Switch>
          <Match when={data.error}>
            <ErrorState error={data.error} onRetry={refetch} />
          </Match>
          <Match when={!data()}>
            <div class="h-[25rem] animate-pulse rounded-lg bg-veil" aria-busy="true" aria-label={t("common.loading")} />
          </Match>
          <Match when={data()}>
            {(d) => (
              <>
                <MonthCalendar window={d()} busy={new Set(d().days)} />
                <ul class="mt-3 flex gap-5 text-sm">
                  <li class="flex items-center gap-2">
                    <span aria-hidden="true" class="inline-flex h-5 w-5 items-center justify-center rounded bg-blush text-[10px] text-garnet-deep line-through">14</span>
                    {t("avail.busy")}
                  </li>
                  <li class="flex items-center gap-2">
                    <span aria-hidden="true" class="inline-flex h-5 w-5 items-center justify-center rounded border border-silver text-[10px]">14</span>
                    {t("avail.free")}
                  </li>
                </ul>
                <p class="mt-3 text-sm text-silver-ink">{t("avail.note")}</p>
              </>
            )}
          </Match>
        </Switch>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run all frontend checks**

Run: `deno task test && deno task check && deno task build`
Expected:
- the tests pass;
- `check` reports no errors;
- the build prints `✓ built`;
- `deno.lock` now lists the three new font packages and no longer lists Forum or Manrope. Deno updates it by itself.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/deno.lock frontend/src
git commit -m "feat(frontend): editorial visual system: fonts, tokens, labels, square buttons"
```

---

### Task 2: Phone bottom bar and the new header

**Files:**
- Create:
  - `frontend/src/lib/nav.ts`
  - `frontend/src/components/BottomNav.tsx`
- Modify:
  - `frontend/src/components/icons.tsx`
  - `frontend/src/components/Header.tsx`
  - `frontend/src/app/App.tsx`
  - `frontend/src/i18n/en.json`, `ru.json` and `tk.json`
- Test: `frontend/src/lib/nav_test.ts`

**Interfaces:**
- Consumes:
  - from Task 1: `font-label`, `border-line` and `.label`;
  - existing: `favorites`, `LanguageSwitch`, `SearchIcon`, `HeartIcon` and `hasOwnChrome`.
- Produces:
  - `type Tab = "home" | "categories" | "favorites" | "more"` and `activeTab(pathname): Tab | null`.
  - `HomeIcon`, `GridIcon` and `MoreIcon`.
  - `BottomNav`, a fixed bar shown below 768px with `aria-current` on the active tab.
  - **The new `Header`:**
    - phones get the logo plus a search button that links to `/search`;
    - desktop gets the logo, a search field, Categories, Favorites (with count) and the language switch.
  - **`App`:** renders the bottom bar on public pages, pads `<main>` so content clears the bar, and shows the footer on desktop only.
  - **i18n keys:** `tab.menu`, `tab.home`, `tab.categories`, `tab.favorites` and `tab.more`.

- [ ] **Step 1: Write the failing test**

`frontend/src/lib/nav_test.ts`
```ts
import { assertEquals } from "@std/assert";
import { activeTab } from "./nav.ts";

Deno.test("each public page lights up its bottom-bar tab", () => {
  const cases: Record<string, ReturnType<typeof activeTab>> = {
    "/": "home",
    "/categories": "categories",
    "/c/cars": "categories",
    "/dresses": "categories",
    "/dresses/12": "categories",
    "/items/30": "categories",
    "/favorites": "favorites",
    "/more": "more",
    "/search": "more",
    "/shops/ak-gelin": "more",
    "/admin/listings": null,
    "/shop": null,
    "/shop/login": null,
    "/cars": null,
    "/dressesx": null,
  };
  for (const [path, want] of Object.entries(cases)) assertEquals(activeTab(path), want, path);
});
```

Run: `deno test src/lib/nav_test.ts`
Expected: FAIL, with `Module not found` for `./nav.ts`.

- [ ] **Step 2: The tab logic**

`frontend/src/lib/nav.ts`
```ts
/** The phone bottom bar's tabs. */
export type Tab = "home" | "categories" | "favorites" | "more";

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/** Which bottom-bar tab a public page belongs to; null for pages outside the bar's world. */
export function activeTab(pathname: string): Tab | null {
  if (pathname === "/") return "home";
  if (["/categories", "/c", "/dresses", "/items"].some((base) => under(pathname, base))) return "categories";
  if (under(pathname, "/favorites")) return "favorites";
  if (["/more", "/search", "/shops"].some((base) => under(pathname, base))) return "more";
  return null;
}
```

Run: `deno test src/lib/nav_test.ts`
Expected: PASS.

- [ ] **Step 3: Icons, texts, bottom bar, header and app frame**

Append to `frontend/src/components/icons.tsx`:
```tsx

export const HomeIcon = (p: IconProps) => (
  <Svg class={p.class}>
    <path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z" />
  </Svg>
);

export const GridIcon = (p: IconProps) => (
  <Svg class={p.class}>
    <rect x="4" y="4" width="7" height="7" />
    <rect x="13" y="4" width="7" height="7" />
    <rect x="4" y="13" width="7" height="7" />
    <rect x="13" y="13" width="7" height="7" />
  </Svg>
);

export const MoreIcon = (p: IconProps) => (
  <Svg class={p.class}>
    <circle cx="5" cy="12" r="1.4" />
    <circle cx="12" cy="12" r="1.4" />
    <circle cx="19" cy="12" r="1.4" />
  </Svg>
);
```

**en.json**
```json
  "tab.menu": "Menu",
  "tab.home": "Home",
  "tab.categories": "Categories",
  "tab.favorites": "Favorites",
  "tab.more": "More"
```

**ru.json**
```json
  "tab.menu": "Меню",
  "tab.home": "Главная",
  "tab.categories": "Категории",
  "tab.favorites": "Избранное",
  "tab.more": "Ещё"
```

**tk.json**
```json
  "tab.menu": "Menýu",
  "tab.home": "Esasy",
  "tab.categories": "Kategoriýalar",
  "tab.favorites": "Halanlarym",
  "tab.more": "Has köp"
```

`frontend/src/components/BottomNav.tsx`
```tsx
import { A, useLocation } from "@solidjs/router";
import { For, type JSX, Show } from "solid-js";
import { t } from "../i18n/i18n.ts";
import { favorites } from "../lib/favorites.ts";
import { activeTab, type Tab } from "../lib/nav.ts";
import { GridIcon, HeartIcon, HomeIcon, MoreIcon } from "./icons.tsx";

const TABS: { tab: Tab; href: string; icon: (p: { class?: string }) => JSX.Element }[] = [
  { tab: "home", href: "/", icon: HomeIcon },
  { tab: "categories", href: "/categories", icon: GridIcon },
  { tab: "favorites", href: "/favorites", icon: HeartIcon },
  { tab: "more", href: "/more", icon: MoreIcon },
];

/** The phone's app-style bottom bar; hidden from 768px up, where the header has a menu. */
export default function BottomNav() {
  const location = useLocation();
  const active = () => activeTab(location.pathname);
  const count = () => favorites.ids().length;
  return (
    <nav
      aria-label={t("tab.menu")}
      class="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul class="mx-auto flex max-w-lg">
        <For each={TABS}>
          {(item) => {
            const on = () => active() === item.tab;
            const label = () =>
              item.tab === "favorites" && count() > 0
                ? t("nav.favorites_count", { count: count() })
                : t(`tab.${item.tab}`);
            return (
              <li class="flex-1">
                <A
                  href={item.href}
                  end={item.href === "/"}
                  aria-current={on() ? "page" : undefined}
                  aria-label={label()}
                  class="flex min-h-16 flex-col items-center justify-center gap-1 px-0.5 text-center font-label text-[10px] uppercase leading-tight tracking-[0.04em]"
                  classList={{ "text-garnet": on(), "text-silver-ink": !on() }}
                >
                  <span class="relative">
                    <item.icon class="h-6 w-6" />
                    <Show when={item.tab === "favorites" && count() > 0}>
                      <span class="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-garnet px-1 text-center font-sans text-[10px] leading-4 tracking-normal text-white">
                        {count()}
                      </span>
                    </Show>
                  </span>
                  <span aria-hidden="true">{t(`tab.${item.tab}`)}</span>
                </A>
              </li>
            );
          }}
        </For>
      </ul>
    </nav>
  );
}
```

`frontend/src/components/Header.tsx`
```tsx
import { A, useNavigate } from "@solidjs/router";
import { Show } from "solid-js";
import { t } from "../i18n/i18n.ts";
import { favorites } from "../lib/favorites.ts";
import { HeartIcon, SearchIcon } from "./icons.tsx";
import LanguageSwitch from "./LanguageSwitch.tsx";

const MENU_LINK = "inline-flex min-h-11 items-center gap-1.5 px-2 font-label text-xs uppercase tracking-[0.2em]";

/** Phones: the logo and a search button (the bottom bar does the rest). Desktop: a full menu. */
export default function Header() {
  const navigate = useNavigate();
  const count = () => favorites.ids().length;
  let input!: HTMLInputElement;
  return (
    <header class="bg-white">
      <div class="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 md:px-8 md:py-5">
        <A href="/" class="mr-auto font-label text-lg uppercase tracking-[0.32em] text-ink md:mr-0">
          {t("app.name")}
        </A>
        <A href="/search" class="btn-icon text-ink md:hidden" aria-label={t("search.title")}>
          <SearchIcon class="h-6 w-6" />
        </A>
        <form
          role="search"
          class="hidden flex-1 md:block"
          onSubmit={(e) => {
            e.preventDefault();
            const q = input.value.trim();
            navigate(q ? `/search?${new URLSearchParams({ q })}` : "/search");
          }}
        >
          <label class="relative block max-w-sm">
            <span class="sr-only">{t("search.label")}</span>
            <SearchIcon class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-silver-ink" />
            <input
              ref={input}
              type="search"
              autocomplete="off"
              placeholder={t("search.placeholder")}
              class="min-h-11 w-full rounded-full border border-silver bg-white pl-10 pr-4 text-sm"
            />
          </label>
        </form>
        <nav class="hidden items-center md:flex" aria-label={t("tab.menu")}>
          <A href="/categories" class={MENU_LINK} activeClass="text-garnet">{t("tab.categories")}</A>
          <A
            href="/favorites"
            class={MENU_LINK}
            activeClass="text-garnet"
            aria-label={t("nav.favorites_count", { count: count() })}
          >
            <HeartIcon filled={count() > 0} class="h-4 w-4 text-garnet" />
            {t("tab.favorites")}
            <Show when={count() > 0}>
              <span class="tabular-nums text-garnet">{count()}</span>
            </Show>
          </A>
          <LanguageSwitch />
        </nav>
      </div>
    </header>
  );
}
```

`frontend/src/app/App.tsx`
```tsx
import { A, type RouteSectionProps, useLocation } from "@solidjs/router";
import { createEffect, ErrorBoundary, type JSX, on, Show } from "solid-js";
import BottomNav from "../components/BottomNav.tsx";
import ErrorState from "../components/ErrorState.tsx";
import Header from "../components/Header.tsx";
import { t } from "../i18n/i18n.ts";
import { hasOwnChrome } from "../lib/areas.ts";
import { focusMain, mainRef } from "../lib/dom.ts";

/**
 * A render or chunk-load failure shows a message with a retry button, never a blank page.
 * Retry reloads the page: it recovers from a stale lazy chunk in every browser, whatever its message.
 */
function Guard(props: { children: JSX.Element }) {
  const where = useLocation();
  return (
    <ErrorBoundary
      fallback={(err, reset) => {
        // Following a link to another page clears the error.
        createEffect(on(() => where.pathname, reset, { defer: true }));
        return <ErrorState error={err} onRetry={() => location.reload()} />;
      }}
    >
      {props.children}
    </ErrorBoundary>
  );
}

/** Public pages get the header and footer; admin and "My shop" pages bring their own. */
export default function App(props: RouteSectionProps) {
  const location = useLocation();
  // Not on first load, and not when only the search string changes.
  createEffect(on(() => location.pathname, () => focusMain(), { defer: true }));
  return (
    <Show when={!hasOwnChrome(location.pathname)} fallback={<Guard>{props.children}</Guard>}>
      <a
        href="#main"
        rel="external" // keeps the router out of it, so the browser focuses <main> itself
        class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2"
      >
        {t("common.skip")}
      </a>
      <Header />
      {/* On phones the bottom bar covers the last 4rem (plus the iPhone home indicator). */}
      <main
        ref={mainRef}
        id="main"
        tabindex="-1"
        class="mx-auto w-full max-w-6xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] outline-none md:px-8 md:pb-20"
      >
        <Guard>{props.children}</Guard>
      </main>
      <footer class="hidden border-t border-line md:block">
        <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-8 py-8">
          <p class="label">{t("app.tagline")}</p>
          <A href="/shop/signup" class="btn btn-outline">{t("footer.add_shop")}</A>
        </div>
      </footer>
      <BottomNav />
    </Show>
  );
}
```

- [ ] **Step 4: Run all frontend checks**

Run: `deno task test && deno task check && deno task build`
Expected:
- the tests pass, including the new `activeTab` test;
- `check` reports no errors;
- the build prints `✓ built`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): app-style bottom bar on phones and a new header"
```

---

### Task 3: The Categories and More pages

**Files:**
- Create:
  - `frontend/src/pages/Categories.tsx`
  - `frontend/src/pages/More.tsx`
- Modify:
  - `frontend/src/main.tsx`
  - `frontend/src/i18n/en.json`, `ru.json` and `tk.json`

**Interfaces:**
- Consumes:
  - from Task 2: the `tab.*` keys and `ChevronRightIcon`;
  - existing: `CATEGORIES`, `catLabel`, `categoryHref`, `api.items`, `contactPhone`, `i18n`, `LANGS` and `usePageTitle`.
- Produces:
  - **Routes:** `/categories` and `/more`.
  - **i18n keys:** `categories.count` (`{count}`), `more.for_shops` and `more.contact`.

- [ ] **Step 1: The texts**

**en.json**
```json
  "categories.count": "{count} listings",
  "more.for_shops": "For shops",
  "more.contact": "Contact us:"
```

**ru.json**
```json
  "categories.count": "Объявлений: {count}",
  "more.for_shops": "Для салонов",
  "more.contact": "Связаться с нами:"
```

**tk.json**
```json
  "categories.count": "{count} bildiriş",
  "more.for_shops": "Salonlar üçin",
  "more.contact": "Bize jaň ediň:"
```

- [ ] **Step 2: The pages**

`frontend/src/pages/Categories.tsx`
```tsx
import { A } from "@solidjs/router";
import { createResource, For, Show } from "solid-js";
import { ChevronRightIcon } from "../components/icons.tsx";
import { t, tr } from "../i18n/i18n.ts";
import { CATEGORIES, catLabel, categoryHref } from "../lib/catalog.ts";
import { api } from "../lib/client.ts";
import { usePageTitle } from "../lib/title.ts";

/** One category: its newest photo (or a soft placeholder) and how many listings it has. */
function CategoryRow(props: { slug: string; oval: boolean }) {
  // One small request per category; a failure just leaves the photo and count out.
  const [page] = createResource(() => props.slug, (slug) =>
    api.items(new URLSearchParams({ category: slug, per_page: "1" })).catch(() => null));
  const ready = () => (page.state === "ready" ? page() : null);
  return (
    <li class="border-b border-line">
      <A href={categoryHref(props.slug)} class="flex items-center gap-5 py-4 hover:text-garnet">
        <span
          class="h-24 w-[4.5rem] shrink-0 bg-veil bg-cover bg-center"
          classList={{ "rounded-[50%]": props.oval }}
          style={ready()?.items[0]?.photo ? { "background-image": `url("${ready()!.items[0].photo}")` } : undefined}
          aria-hidden="true"
        />
        <span class="min-w-0 flex-1">
          <span class="block font-display text-3xl leading-tight sm:text-4xl">{tr(catLabel(props.slug))}</span>
          <Show when={ready()}>
            {(p) => <span class="label mt-1 block">{t("categories.count", { count: p().total })}</span>}
          </Show>
        </span>
        <ChevronRightIcon class="h-5 w-5 shrink-0 text-silver-ink" />
      </A>
    </li>
  );
}

/** The bottom bar's Categories tab: every category as a large word. */
export default function Categories() {
  usePageTitle(() => t("tab.categories"));
  return (
    <div class="pt-6">
      <p class="label">{t("tab.categories")}</p>
      <h1 class="mt-2 text-5xl sm:text-6xl">{t("home.title")}</h1>
      <ul class="mt-6 border-t border-line">
        <For each={CATEGORIES}>{(c, i) => <CategoryRow slug={c.slug} oval={i() % 2 === 0} />}</For>
      </ul>
    </div>
  );
}
```

`frontend/src/pages/More.tsx`
```tsx
import { A } from "@solidjs/router";
import { For, type JSX, Show } from "solid-js";
import { ChevronRightIcon } from "../components/icons.tsx";
import { i18n, LANGS, t } from "../i18n/i18n.ts";
import { contactPhone } from "../lib/contact.ts";
import { usePageTitle } from "../lib/title.ts";

const ROW = "flex min-h-14 items-center justify-between gap-4 border-b border-line py-3 text-lg";

function LinkRow(props: { href: string; children: JSX.Element }) {
  return (
    <A href={props.href} class={`${ROW} hover:text-garnet`}>
      <span>{props.children}</span>
      <ChevronRightIcon class="h-5 w-5 text-silver-ink" />
    </A>
  );
}

/** The bottom bar's "More": language, search, and the way in for shops. */
export default function More() {
  usePageTitle(() => t("tab.more"));
  const phone = contactPhone();
  return (
    <div class="pt-6">
      <h1 class="text-5xl">{t("tab.more")}</h1>

      <section class="mt-8" aria-labelledby="more-language">
        <h2 id="more-language" class="label">{t("nav.language")}</h2>
        <div role="group" aria-labelledby="more-language" class="mt-2 border-t border-line">
          <For each={LANGS}>
            {(lang) => (
              <button
                type="button"
                lang={lang}
                aria-pressed={i18n.lang() === lang}
                class={`${ROW} w-full text-left`}
                classList={{ "text-garnet": i18n.lang() === lang }}
                onClick={() => i18n.setLang(lang)}
              >
                <span>{t(`lang.${lang}`)}</span>
                <Show when={i18n.lang() === lang}>
                  <span class="label text-garnet" aria-hidden="true">✓</span>
                </Show>
              </button>
            )}
          </For>
        </div>
      </section>

      <section class="mt-8" aria-labelledby="more-site">
        <h2 id="more-site" class="label">{t("app.name")}</h2>
        <div class="mt-2 border-t border-line">
          <LinkRow href="/search">{t("search.title")}</LinkRow>
          <LinkRow href="/favorites">{t("tab.favorites")}</LinkRow>
        </div>
      </section>

      <section class="mt-8" aria-labelledby="more-shops">
        <h2 id="more-shops" class="label">{t("more.for_shops")}</h2>
        <div class="mt-2 border-t border-line">
          <LinkRow href="/shop/signup">{t("footer.add_shop")}</LinkRow>
          <LinkRow href="/shop/login">{t("shoplogin.title")}</LinkRow>
        </div>
        <Show when={phone}>
          {(p) => (
            <p class="mt-6 text-sm text-silver-ink">
              {t("more.contact")}{" "}
              <a href={`tel:${p().replace(/\s/g, "")}`} class="font-semibold text-garnet">{p()}</a>
            </p>
          )}
        </Show>
      </section>

      <p class="label mt-10">{t("app.tagline")}</p>
    </div>
  );
}
```

- [ ] **Step 3: Routes**

In `frontend/src/main.tsx`, replace:
```tsx
import Category from "./pages/Category.tsx";
```
with:
```tsx
import Categories from "./pages/Categories.tsx";
import Category from "./pages/Category.tsx";
```

In `frontend/src/main.tsx`, replace:
```tsx
import Item from "./pages/Item.tsx";
```
with:
```tsx
import Item from "./pages/Item.tsx";
import More from "./pages/More.tsx";
```

In `frontend/src/main.tsx`, replace:
```tsx
      <Route path="/c/:slug" component={Category} />
```
with:
```tsx
      <Route path="/categories" component={Categories} />
      <Route path="/c/:slug" component={Category} />
```

In `frontend/src/main.tsx`, replace:
```tsx
      <Route path="/favorites" component={Favorites} />
```
with:
```tsx
      <Route path="/favorites" component={Favorites} />
      <Route path="/more" component={More} />
```

- [ ] **Step 4: Run all frontend checks**

Run: `deno task test && deno task check && deno task build`
Expected:
- the tests pass;
- `check` reports no errors;
- the build prints `✓ built`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): Categories and More pages for the bottom bar"
```

---

### Task 4: The editorial home page

**Files:**
- Modify:
  - `frontend/src/components/CategoryBar.tsx`
  - `frontend/src/pages/Home.tsx`
  - `frontend/src/components/icons.tsx`
  - `frontend/src/i18n/en.json`, `ru.json` and `tk.json`

**Interfaces:**
- Consumes:
  - from Task 1: `.label` and the tokens;
  - existing: `api.items`, `ListingGrid`, `SearchBox`, `useCities`, `filtersToQuery` and the catalog helpers.
- Produces:
  - **`CategoryBar`:** the category word list, with no icons.
  - **`Home`:** the hero ("GELIN" over an oval photo, using the first two newest listings that have a photo), then the label, lead, search and city picker, the word list, and the newest grid.
  - **`icons.tsx`:** the five category icons (`DressIcon`, `CarIcon`, `RobeIcon`, `TentIcon` and `RibbonIcon`) are removed.
  - **i18n key:** `home.see_all_categories`.

- [ ] **Step 1: The texts**

**en.json**
```json
  "home.see_all_categories": "All categories"
```

**ru.json**
```json
  "home.see_all_categories": "Все категории"
```

**tk.json**
```json
  "home.see_all_categories": "Ähli kategoriýalar"
```

- [ ] **Step 2: The category word list and the home page**

`frontend/src/components/CategoryBar.tsx`
```tsx
import { A } from "@solidjs/router";
import { For } from "solid-js";
import { t, tr } from "../i18n/i18n.ts";
import { CATEGORIES, catLabel, categoryHref } from "../lib/catalog.ts";

/** Every category as a large elegant word, the first one marked with a short line. */
export default function CategoryBar() {
  return (
    <nav aria-label={t("home.categories")}>
      <p class="label">{t("home.categories")}</p>
      <ul class="mt-3 space-y-1">
        <For each={CATEGORIES}>
          {(c, i) => (
            <li>
              <A
                href={categoryHref(c.slug)}
                class="inline-flex min-h-11 items-center gap-3 font-display text-4xl leading-tight hover:text-garnet sm:text-5xl"
                classList={{ "text-garnet": i() === 0 }}
              >
                {i() === 0 && <span class="h-px w-8 bg-current" aria-hidden="true" />}
                {tr(catLabel(c.slug))}
              </A>
            </li>
          )}
        </For>
      </ul>
      <A href="/categories" class="label mt-4 inline-block border-b border-ink pb-0.5 text-ink">
        {t("home.see_all_categories")}
      </A>
    </nav>
  );
}
```

`frontend/src/pages/Home.tsx`
```tsx
import { A, useNavigate } from "@solidjs/router";
import { createResource, For, Match, Switch } from "solid-js";
import CategoryBar from "../components/CategoryBar.tsx";
import ErrorState from "../components/ErrorState.tsx";
import ListingGrid from "../components/ListingGrid.tsx";
import SearchBox from "../components/SearchBox.tsx";
import { GridSkeleton } from "../components/Skeleton.tsx";
import { i18n, t } from "../i18n/i18n.ts";
import { useCities } from "../lib/cities.ts";
import { api } from "../lib/client.ts";
import { EMPTY_FILTERS, filtersToQuery } from "../lib/filters.ts";
import { cityName } from "../lib/format.ts";
import { usePageTitle } from "../lib/title.ts";

/** A photo in an oval frame, or a soft gray oval while there is none. */
function Oval(props: { photo: string | null | undefined; class: string }) {
  return (
    <span
      class={`block rounded-[50%] bg-veil bg-cover bg-[center_20%] ${props.class}`}
      style={props.photo ? { "background-image": `url("${props.photo}")` } : undefined}
      aria-hidden="true"
    />
  );
}

export default function Home() {
  usePageTitle(() => undefined);
  const navigate = useNavigate();
  const cities = useCities();
  // The newest listings of every category; the first two with a photo also dress the hero.
  const [newest, { refetch }] = createResource(() => api.items(new URLSearchParams({ per_page: "8" })));
  const photo = (i: number) =>
    newest.state === "ready" ? (newest()?.items ?? []).filter((it) => it.photo)[i]?.photo : null;
  const search = (q: string) => navigate(q ? `/search?${new URLSearchParams({ q })}` : "/search");
  const browseCity = (city: string) => {
    const qs = filtersToQuery({ ...EMPTY_FILTERS, city }).toString();
    navigate(qs ? `/dresses?${qs}` : "/dresses");
  };

  return (
    <>
      <section class="grid gap-10 pt-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-center md:pt-10">
        <div>
          {/* The hero: the brand word over an oval photo, a smaller round photo, a hairline. */}
          <div class="relative mx-auto h-[22rem] max-w-md overflow-hidden sm:h-[28rem]">
            <span
              class="absolute left-1/2 top-1/2 h-px w-[140%] -translate-x-1/2 -rotate-[38deg] bg-line"
              aria-hidden="true"
            />
            <Oval photo={photo(0)} class="absolute left-1/2 top-2 h-[19rem] w-52 -translate-x-1/2 sm:h-[24rem] sm:w-64" />
            <Oval photo={photo(1)} class="absolute bottom-6 right-2 h-28 w-20 border-4 border-white sm:right-6" />
            <p
              class="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-display text-[5rem] uppercase leading-none text-ink mix-blend-multiply sm:text-[7rem]"
              aria-hidden="true"
            >
              {t("app.name")}
            </p>
          </div>
          <h1 class="label text-center">{t("home.title")}</h1>
          <p class="mx-auto mt-3 max-w-md text-center text-silver-ink">{t("home.lead")}</p>
          <div class="mx-auto mt-6 max-w-md space-y-4">
            <SearchBox value="" onSearch={search} />
            <label class="flex flex-wrap items-center justify-center gap-3 text-sm">
              <span class="text-silver-ink">{t("home.city")}</span>
              <select
                class="field-input w-auto"
                value=""
                onChange={(e) => e.currentTarget.value && browseCity(e.currentTarget.value)}
              >
                <option value="">{t("home.all_cities")}</option>
                <For each={cities()}>{(c) => <option value={c.slug}>{cityName(c, i18n.lang())}</option>}</For>
              </select>
            </label>
          </div>
        </div>
        <CategoryBar />
      </section>

      <section aria-labelledby="newest-title" class="mt-16">
        <div class="mb-6 flex items-baseline justify-between gap-4 border-t border-line pt-6">
          <h2 id="newest-title" class="label">{t("home.newest")}</h2>
          <A href="/search" class="label border-b border-ink pb-0.5 text-ink">{t("home.see_all_items")}</A>
        </div>
        <Switch>
          <Match when={newest.error}>
            <ErrorState error={newest.error} onRetry={refetch} />
          </Match>
          <Match when={!newest()}>
            <GridSkeleton count={8} />
          </Match>
          <Match when={newest()}>{(page) => <ListingGrid items={page().items} />}</Match>
        </Switch>
      </section>
    </>
  );
}
```

- [ ] **Step 3: Remove the category icons, which nothing uses now**

In `frontend/src/components/icons.tsx`, replace:
```tsx
// Category icons, drawn on the same 24px grid as the rest.
export const DressIcon = (p: IconProps) => (
  <Svg class={p.class}>
    <path d="M9.5 3h5l-1 4.5L18 21H6l4.5-13.5z" />
    <path d="M10.5 7.5h3" />
  </Svg>
);

export const CarIcon = (p: IconProps) => (
  <Svg class={p.class}>
    <path d="M3 16.5V13l2.2-4.6A2 2 0 0 1 7 7.3h10a2 2 0 0 1 1.8 1.1L21 13v3.5H3z" />
    <path d="M3 13h18" />
    <circle cx="7.5" cy="17" r="1.6" />
    <circle cx="16.5" cy="17" r="1.6" />
  </Svg>
);

export const RobeIcon = (p: IconProps) => (
  <Svg class={p.class}>
    <path d="M9 3 12 6l3-3 4.5 4-2.5 2.5V21H7V9.5L4.5 7z" />
    <path d="M12 6v15" />
  </Svg>
);

export const TentIcon = (p: IconProps) => (
  <Svg class={p.class}>
    <path d="M2.5 20 12 4l9.5 16z" />
    <path d="M12 4v16M9 20l3-6 3 6" />
  </Svg>
);

export const RibbonIcon = (p: IconProps) => (
  <Svg class={p.class}>
    <path d="M12 11c-2.5-3.5-7-4.5-8-2.2S7 12.8 12 11z" />
    <path d="M12 11c2.5-3.5 7-4.5 8-2.2S17 12.8 12 11z" />
    <path d="m12 11-3.5 9M12 11l3.5 9" />
  </Svg>
);

export const HomeIcon = (p: IconProps) => (
```
with:
```tsx
export const HomeIcon = (p: IconProps) => (
```

- [ ] **Step 4: Run all frontend checks**

Run: `deno task test && deno task check && deno task build && grep -rn "DressIcon\|CarIcon\|RobeIcon\|TentIcon\|RibbonIcon" src`
Expected:
- the tests pass;
- `check` reports no errors;
- the build prints `✓ built`;
- the grep finds nothing.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): editorial home page with the oval hero and category words"
```

---

### Task 5: List pages: titles and filter chips

**Files:**
- Create: `frontend/src/components/FilterChips.tsx`
- Modify:
  - `frontend/src/pages/Dresses.tsx`
  - `frontend/src/pages/Category.tsx`
  - `frontend/src/pages/Search.tsx`
  - `frontend/src/pages/Favorites.tsx`
  - `frontend/src/pages/Shop.tsx`
  - `frontend/src/i18n/en.json`, `ru.json` and `tk.json`

**Interfaces:**
- Consumes:
  - from Task 1: `.chip-on`, `.label` and `ShopLogo` size `"xl"`;
  - existing: the `Filters`/`ItemFilters` helpers, `useCities`, `cityName`, `formatPrice`, the catalog helpers and the filter sheets.
- Produces:
  - `FilterChips(props: { count: number; active: ActiveFilter[]; onOpen: () => void })`, with `ActiveFilter { key; label; remove() }`.
  - **i18n keys:** `categories.kicker`, `filters.up_to` (`{price}`) and `filters.remove` (`{filter}`).

- [ ] **Step 1: The texts**

**en.json**
```json
  "categories.kicker": "Category",
  "filters.up_to": "up to {price} TMT",
  "filters.remove": "Remove filter: {filter}"
```

**ru.json**
```json
  "categories.kicker": "Категория",
  "filters.up_to": "до {price} TMT",
  "filters.remove": "Убрать фильтр: {filter}"
```

**tk.json**
```json
  "categories.kicker": "Kategoriýa",
  "filters.up_to": "{price} TMT çenli",
  "filters.remove": "Süzgüji aýyr: {filter}"
```

- [ ] **Step 2: The chip row**

`frontend/src/components/FilterChips.tsx`
```tsx
import { For } from "solid-js";
import { t } from "../i18n/i18n.ts";
import { CloseIcon, FilterIcon } from "./icons.tsx";

export interface ActiveFilter {
  key: string;
  label: string;
  remove: () => void;
}

/** "Filters · N" (opens the sheet), then one chip per active filter: tapping it removes it. */
export default function FilterChips(props: { count: number; active: ActiveFilter[]; onOpen: () => void }) {
  return (
    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        class="chip"
        classList={{ "chip-on": props.count > 0 }}
        aria-haspopup="dialog"
        onClick={() => props.onOpen()}
      >
        <FilterIcon class="h-4 w-4" />
        {props.count > 0 ? t("dresses.filters_active", { count: props.count }) : t("dresses.filters")}
      </button>
      <For each={props.active}>
        {(f) => (
          <button
            type="button"
            class="chip"
            aria-label={t("filters.remove", { filter: f.label })}
            onClick={() => f.remove()}
          >
            {f.label}
            <CloseIcon class="h-3.5 w-3.5" />
          </button>
        )}
      </For>
    </div>
  );
}
```

- [ ] **Step 3: The pages**

`frontend/src/pages/Dresses.tsx`
```tsx
import { useLocation, useNavigate } from "@solidjs/router";
import { createMemo, createSignal, Match, Show, Switch } from "solid-js";
import ListingGrid from "../components/ListingGrid.tsx";
import EmptyState from "../components/EmptyState.tsx";
import ErrorState from "../components/ErrorState.tsx";
import FilterSheet from "../components/FilterSheet.tsx";
import FilterChips, { type ActiveFilter } from "../components/FilterChips.tsx";
import LoadMore from "../components/LoadMore.tsx";
import SearchBox from "../components/SearchBox.tsx";
import { GridSkeleton } from "../components/Skeleton.tsx";
import { i18n, t } from "../i18n/i18n.ts";
import { useCities } from "../lib/cities.ts";
import { api } from "../lib/client.ts";
import { countActiveFilters, EMPTY_FILTERS, type Filters, filtersToQuery, parseFilters } from "../lib/filters.ts";
import { cityName, formatPrice } from "../lib/format.ts";
import { createRememberedList, type ListMemory } from "../lib/rememberedList.ts";
import { usePageTitle } from "../lib/title.ts";
import type { ListItem } from "../lib/types.ts";

const PER_PAGE = "24";

/** The last list shown, so Back from a dress finds the same pages instead of a fresh first page. */
const memory: ListMemory<ListItem> = {};

export default function Dresses() {
  usePageTitle(() => t("dresses.title"));
  const location = useLocation();
  const navigate = useNavigate();
  const filters = createMemo(() => parseFilters(new URLSearchParams(location.search)), EMPTY_FILTERS, {
    equals: (a, b) => filtersToQuery(a).toString() === filtersToQuery(b).toString(),
  });
  const [sheetOpen, setSheetOpen] = createSignal(false);

  const list = createRememberedList(memory, () => filtersToQuery(filters()).toString(), (page) => {
    const query = filtersToQuery(filters());
    query.set("page", String(page));
    query.set("per_page", PER_PAGE);
    return api.dresses(query);
  });

  const apply = (f: Filters) => {
    setSheetOpen(false);
    const qs = filtersToQuery(f).toString();
    navigate(qs ? `/dresses?${qs}` : "/dresses");
  };
  const active = () => countActiveFilters(filters());
  const cities = useCities();
  /** One removable chip per active filter, in the sheet's order. */
  const activeChips = (): ActiveFilter[] => {
    const f = filters();
    const drop = (patch: Partial<Filters>) => () => apply({ ...f, ...patch });
    const out: ActiveFilter[] = [];
    if (f.city) {
      const c = cities().find((x) => x.slug === f.city);
      out.push({ key: "city", label: c ? cityName(c, i18n.lang()) : f.city, remove: drop({ city: "" }) });
    }
    if (f.priceMin !== null) {
      out.push({ key: "price_min", label: t("price.from", { price: formatPrice(f.priceMin) }), remove: drop({ priceMin: null }) });
    }
    if (f.priceMax !== null) {
      out.push({ key: "price_max", label: t("filters.up_to", { price: formatPrice(f.priceMax) }), remove: drop({ priceMax: null }) });
    }
    if (f.size) out.push({ key: "size", label: f.size, remove: drop({ size: null }) });
    if (f.color) out.push({ key: "color", label: t(`color.${f.color}`), remove: drop({ color: null }) });
    if (f.style) out.push({ key: "style", label: t(`silhouette.${f.style}`), remove: drop({ style: null }) });
    if (f.sleeves) out.push({ key: "sleeves", label: t(`sleeves.${f.sleeves}`), remove: drop({ sleeves: null }) });
    return out;
  };
  const firstLoad = () => list.items().length === 0;

  return (
    <div class="pt-6">
      <p class="label">{t("categories.kicker")}</p>
      <h1 class="mt-2 text-5xl sm:text-6xl">{t("dresses.title")}</h1>
      <div class="mt-6 max-w-xl">
        <SearchBox value={filters().q} onSearch={(q) => apply({ ...filters(), q })} />
      </div>
      <div class="mt-4">
        <FilterChips count={active()} active={activeChips()} onOpen={() => setSheetOpen(true)} />
      </div>
      <p class="label mt-5 min-h-5" aria-live="polite">
        <Show when={!(list.loading() && firstLoad()) && list.error() === null}>{t("dresses.found", { count: list.total() })}</Show>
      </p>

      <div class="mt-4">
        <Switch>
          <Match when={firstLoad() && list.error() !== null}>
            <ErrorState error={list.error()} onRetry={() => void list.retry()} />
          </Match>
          <Match when={firstLoad() && list.loading()}>
            <GridSkeleton />
          </Match>
          <Match when={firstLoad()}>
            <EmptyState title={t("dresses.empty_title")} body={t("dresses.empty_body")}>
              <button type="button" class="btn btn-outline" onClick={() => apply(EMPTY_FILTERS)}>
                {t("dresses.clear")}
              </button>
            </EmptyState>
          </Match>
          <Match when={!firstLoad()}>
            <ListingGrid items={list.items()} />
            <LoadMore list={list} />
          </Match>
        </Switch>
      </div>

      <FilterSheet open={sheetOpen()} value={filters()} onApply={apply} onClose={() => setSheetOpen(false)} />
    </div>
  );
}
```

`frontend/src/pages/Category.tsx`
```tsx
import { useLocation, useNavigate, useParams } from "@solidjs/router";
import { createMemo, createSignal, Match, Show, Switch } from "solid-js";
import EmptyState from "../components/EmptyState.tsx";
import ErrorState from "../components/ErrorState.tsx";
import FilterChips, { type ActiveFilter } from "../components/FilterChips.tsx";
import ItemFilterSheet from "../components/ItemFilterSheet.tsx";
import ListingGrid from "../components/ListingGrid.tsx";
import LoadMore from "../components/LoadMore.tsx";
import SearchBox from "../components/SearchBox.tsx";
import { GridSkeleton } from "../components/Skeleton.tsx";
import { i18n, t, tr } from "../i18n/i18n.ts";
import { type CategoryDef, categoryDef, catLabel, fieldLabel, optionLabel } from "../lib/catalog.ts";
import { useCities } from "../lib/cities.ts";
import { api } from "../lib/client.ts";
import {
  countItemFilters, EMPTY_ITEM_FILTERS, type ItemFilters, itemFiltersToQuery, parseItemFilters,
} from "../lib/itemFilters.ts";
import { cityName, formatPrice } from "../lib/format.ts";
import { createRememberedList, type ListMemory } from "../lib/rememberedList.ts";
import { usePageTitle } from "../lib/title.ts";
import type { ListItem } from "../lib/types.ts";
import NotFound from "./NotFound.tsx";

const PER_PAGE = "24";

/** The last list shown, so Back from an item finds the same pages instead of a fresh first page. */
const memory: ListMemory<ListItem> = {};

function CategoryList(props: { category: CategoryDef }) {
  const c = props.category;
  usePageTitle(() => tr(catLabel(c.slug)));
  const location = useLocation();
  const navigate = useNavigate();
  const filters = createMemo(() => parseItemFilters(c, new URLSearchParams(location.search)), EMPTY_ITEM_FILTERS, {
    equals: (a, b) => itemFiltersToQuery(c, a).toString() === itemFiltersToQuery(c, b).toString(),
  });
  const [sheetOpen, setSheetOpen] = createSignal(false);
  const query = () => {
    const q = itemFiltersToQuery(c, filters());
    q.set("category", c.slug);
    return q;
  };
  const list = createRememberedList(memory, () => query().toString(), (page) => {
    const q = query();
    q.set("page", String(page));
    q.set("per_page", PER_PAGE);
    return api.items(q);
  });

  const apply = (f: ItemFilters) => {
    setSheetOpen(false);
    const qs = itemFiltersToQuery(c, f).toString();
    navigate(qs ? `/c/${c.slug}?${qs}` : `/c/${c.slug}`);
  };
  const active = () => countItemFilters(filters());
  const cities = useCities();
  /** One removable chip per active filter, in the sheet's order. */
  const activeChips = (): ActiveFilter[] => {
    const f = filters();
    const out: ActiveFilter[] = [];
    if (f.city) {
      const city = cities().find((x) => x.slug === f.city);
      out.push({ key: "city", label: city ? cityName(city, i18n.lang()) : f.city, remove: () => apply({ ...f, city: "" }) });
    }
    if (f.priceMin !== null) {
      out.push({ key: "price_min", label: t("price.from", { price: formatPrice(f.priceMin) }), remove: () => apply({ ...f, priceMin: null }) });
    }
    if (f.priceMax !== null) {
      out.push({ key: "price_max", label: t("filters.up_to", { price: formatPrice(f.priceMax) }), remove: () => apply({ ...f, priceMax: null }) });
    }
    for (const field of c.fields) {
      const param = field.filter?.param;
      const value = param ? f.attrs[param] : "";
      if (!param || !value) continue;
      const label = field.filter!.kind === "min"
        ? `${tr("filters.at_least", { field: tr(fieldLabel(c.slug, field.key)) })} ${value}`
        : tr(optionLabel(c.slug, field.key, value));
      out.push({ key: param, label, remove: () => apply({ ...f, attrs: { ...f.attrs, [param]: "" } }) });
    }
    return out;
  };
  const firstLoad = () => list.items().length === 0;

  return (
    <div class="pt-6">
      <p class="label">{t("categories.kicker")}</p>
      <h1 class="mt-2 text-5xl sm:text-6xl">{tr(catLabel(c.slug))}</h1>
      <div class="mt-6 max-w-xl">
        <SearchBox value={filters().q} onSearch={(q) => apply({ ...filters(), q })} />
      </div>
      <div class="mt-4">
        <FilterChips count={active()} active={activeChips()} onOpen={() => setSheetOpen(true)} />
      </div>
      <p class="label mt-5 min-h-5" aria-live="polite">
        <Show when={!(list.loading() && firstLoad()) && list.error() === null}>{t("dresses.found", { count: list.total() })}</Show>
      </p>

      <div class="mt-4">
        <Switch>
          <Match when={firstLoad() && list.error() !== null}>
            <ErrorState error={list.error()} onRetry={() => void list.retry()} />
          </Match>
          <Match when={firstLoad() && list.loading()}>
            <GridSkeleton />
          </Match>
          <Match when={firstLoad()}>
            <EmptyState title={t("items.empty_title")} body={t("dresses.empty_body")}>
              <button type="button" class="btn btn-outline" onClick={() => apply(EMPTY_ITEM_FILTERS)}>
                {t("dresses.clear")}
              </button>
            </EmptyState>
          </Match>
          <Match when={!firstLoad()}>
            <ListingGrid items={list.items()} />
            <LoadMore list={list} />
          </Match>
        </Switch>
      </div>

      <ItemFilterSheet
        category={c}
        open={sheetOpen()}
        value={filters()}
        onApply={apply}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
}

/** /c/:slug for every category except dresses, which keep /dresses. A fresh list per category. */
export default function Category() {
  const params = useParams();
  const def = () => {
    const c = categoryDef(params.slug ?? "");
    return c && !c.own_pages ? c : undefined;
  };
  return (
    <Show when={def()} keyed fallback={<NotFound />}>
      {(c) => <CategoryList category={c} />}
    </Show>
  );
}
```

`frontend/src/pages/Search.tsx`
```tsx
import { A, useLocation, useNavigate } from "@solidjs/router";
import { createMemo, For, Match, Show, Switch } from "solid-js";
import EmptyState from "../components/EmptyState.tsx";
import ErrorState from "../components/ErrorState.tsx";
import ListingGrid from "../components/ListingGrid.tsx";
import LoadMore from "../components/LoadMore.tsx";
import SearchBox from "../components/SearchBox.tsx";
import { GridSkeleton } from "../components/Skeleton.tsx";
import { t, tr } from "../i18n/i18n.ts";
import { CATEGORIES, catLabel, categoryDef } from "../lib/catalog.ts";
import { api } from "../lib/client.ts";
import { createRememberedList, type ListMemory } from "../lib/rememberedList.ts";
import { usePageTitle } from "../lib/title.ts";
import type { ListItem } from "../lib/types.ts";

const PER_PAGE = "24";
const memory: ListMemory<ListItem> = {};

/** /search?q=&category=: every category at once, narrowed by the category chips. */
export default function Search() {
  usePageTitle(() => t("search.title"));
  const location = useLocation();
  const navigate = useNavigate();
  const params = createMemo(() => {
    const query = new URLSearchParams(location.search);
    const category = query.get("category") ?? "";
    return { q: (query.get("q") ?? "").trim(), category: categoryDef(category) ? category : "" };
  }, { q: "", category: "" }, { equals: (a, b) => a.q === b.q && a.category === b.category });
  const href = (q: string, category: string) => {
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    if (category) query.set("category", category);
    const qs = query.toString();
    return qs ? `/search?${qs}` : "/search";
  };
  const list = createRememberedList(memory, () => href(params().q, params().category), (page) => {
    const query = new URLSearchParams({ page: String(page), per_page: PER_PAGE });
    if (params().q) query.set("q", params().q);
    if (params().category) query.set("category", params().category);
    return api.items(query);
  });
  const firstLoad = () => list.items().length === 0;
  const chip = (category: string, label: string) => (
    <A
      href={href(params().q, category)}
      class="chip"
      classList={{ "border-garnet bg-blush text-garnet-deep": params().category === category }}
      aria-current={params().category === category ? "page" : undefined}
    >
      {label}
    </A>
  );

  return (
    <div class="pt-6">
      <p class="label">{t("app.name")}</p>
      <h1 class="mt-2 text-5xl sm:text-6xl">{t("search.title")}</h1>
      <div class="mt-6 max-w-xl">
        <SearchBox value={params().q} onSearch={(q) => navigate(href(q, params().category))} />
      </div>
      <nav class="mt-4 flex flex-wrap gap-2" aria-label={t("home.categories")}>
        {chip("", t("search.all"))}
        <For each={CATEGORIES}>{(c) => chip(c.slug, tr(catLabel(c.slug)))}</For>
      </nav>
      <p class="label mt-5 min-h-5" aria-live="polite">
        <Show when={!(list.loading() && firstLoad()) && list.error() === null}>{t("dresses.found", { count: list.total() })}</Show>
      </p>
      <div class="mt-4">
        <Switch>
          <Match when={firstLoad() && list.error() !== null}>
            <ErrorState error={list.error()} onRetry={() => void list.retry()} />
          </Match>
          <Match when={firstLoad() && list.loading()}>
            <GridSkeleton />
          </Match>
          <Match when={firstLoad()}>
            <EmptyState title={t("items.empty_title")} body={t("search.empty_body")} />
          </Match>
          <Match when={!firstLoad()}>
            <ListingGrid items={list.items()} />
            <LoadMore list={list} />
          </Match>
        </Switch>
      </div>
    </div>
  );
}
```

`frontend/src/pages/Favorites.tsx`
```tsx
import { A } from "@solidjs/router";
import { createEffect, createResource, Match, Switch, untrack } from "solid-js";
import ListingGrid from "../components/ListingGrid.tsx";
import EmptyState from "../components/EmptyState.tsx";
import ErrorState from "../components/ErrorState.tsx";
import { GridSkeleton } from "../components/Skeleton.tsx";
import { t } from "../i18n/i18n.ts";
import { api } from "../lib/client.ts";
import { favorites, MAX_FAVORITES } from "../lib/favorites.ts";
import { usePageTitle } from "../lib/title.ts";
import type { ListItem, Page } from "../lib/types.ts";

export default function Favorites() {
  usePageTitle(() => t("favorites.title"));
  // Fetch once with the ids saved on this device; unhearting here only hides the tile.
  const [page, { refetch }] = createResource((): Promise<Page | null> => {
    const ids = untrack(favorites.ids);
    if (ids.length === 0) return Promise.resolve(null);
    return api.items(new URLSearchParams({ ids: ids.join(","), per_page: String(MAX_FAVORITES) }));
  });

  // Ids that the API no longer returns (deleted or unpublished) are dropped silently.
  createEffect(() => {
    const p = page.state === "ready" ? page() : null;
    if (p) untrack(() => favorites.keepOnly(p.items.map((i) => i.id)));
  });

  // Newest favorite first, the same order as on the device.
  const visible = (): ListItem[] => {
    const p = page.state === "ready" ? page() : null;
    if (!p) return [];
    const byId = new Map(p.items.map((i) => [i.id, i]));
    return favorites.ids().flatMap((id) => byId.get(id) ?? []);
  };

  return (
    <div class="pt-6">
      <p class="label">{t("app.name")}</p>
      <h1 class="mt-2 text-5xl sm:text-6xl">{t("favorites.title")}</h1>
      <div class="mt-6">
        <Switch>
          <Match when={page.error}>
            <ErrorState error={page.error} onRetry={refetch} />
          </Match>
          <Match when={page.loading}>
            <GridSkeleton count={Math.min(favorites.ids().length, 8)} />
          </Match>
          <Match when={visible().length === 0}>
            <EmptyState title={t("favorites.empty_title")} body={t("favorites.empty_body")}>
              <A href="/" class="btn btn-primary">{t("favorites.browse")}</A>
            </EmptyState>
          </Match>
          <Match when={visible().length > 0}>
            <ListingGrid items={visible()} />
          </Match>
        </Switch>
      </div>
    </div>
  );
}
```

`frontend/src/pages/Shop.tsx`
```tsx
import { A, useLocation, useNavigate, useParams } from "@solidjs/router";
import { createEffect, createSignal, For, Match, on, Show, Switch } from "solid-js";
import ListingGrid from "../components/ListingGrid.tsx";
import ErrorState from "../components/ErrorState.tsx";
import LoadMore from "../components/LoadMore.tsx";
import { ContactButtons } from "../components/ShopCard.tsx";
import ShopLogo from "../components/ShopLogo.tsx";
import { DetailSkeleton, GridSkeleton } from "../components/Skeleton.tsx";
import { i18n, t, tr } from "../i18n/i18n.ts";
import { categoryDef, catLabel } from "../lib/catalog.ts";
import { api } from "../lib/client.ts";
import { isNotFound } from "../lib/errors.ts";
import { cityName } from "../lib/format.ts";
import { createPagedList } from "../lib/paged.ts";
import { usePageTitle } from "../lib/title.ts";
import type { PublicShop } from "../lib/types.ts";
import NotFound from "./NotFound.tsx";

export default function Shop() {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  /** The ?category= chip; "" shows every category. */
  const category = () => {
    const c = new URLSearchParams(location.search).get("category") ?? "";
    return categoryDef(c) ? c : "";
  };
  const [info, setInfo] = createSignal<PublicShop | null>(null);
  const list = createPagedList((page) => {
    const slug = params.slug ?? "";
    const query = new URLSearchParams({ page: String(page), per_page: "24" });
    if (category()) query.set("category", category());
    return api.shop(slug, query).then((s) => {
      // Ignore the details of a shop the user has already left.
      if (page === 1 && slug === params.slug) setInfo(s);
      return s.items;
    });
  });
  createEffect(on(() => params.slug, () => {
    setInfo(null);
    void list.reset();
  }));
  // Another chip keeps the shop's details on screen and reloads only the list.
  createEffect(on(category, () => void list.reset(), { defer: true }));
  // An old link to a category this shop does not have: go back to "All".
  createEffect(() => {
    const shop = info();
    const c = category();
    if (shop && shop.slug === params.slug && c && !shop.categories.includes(c)) {
      navigate(`/shops/${params.slug}`, { replace: true });
    }
  });
  const chipHref = (c: string) => `/shops/${params.slug}${c ? `?category=${c}` : ""}`;
  const chip = (c: string, label: string) => (
    <A
      href={chipHref(c)}
      class="chip"
      classList={{ "border-garnet bg-blush text-garnet-deep": category() === c }}
      aria-current={category() === c ? "page" : undefined}
    >
      {label}
    </A>
  );
  usePageTitle(() => info()?.name);

  return (
    <Switch>
      <Match when={!info() && list.error() !== null}>
        <Show
          when={isNotFound(list.error())}
          fallback={<ErrorState error={list.error()} onRetry={() => void list.retry()} />}
        >
          <NotFound />
        </Show>
      </Match>
      <Match when={!info()}>
        <DetailSkeleton />
      </Match>
      <Match when={info()}>
        {(shop) => (
          <div class="pt-6">
            <header class="flex flex-col gap-6 sm:flex-row sm:items-center">
              <ShopLogo url={shop().logo} name={shop().name} size="xl" />
              <div class="min-w-0 flex-1">
                <p class="label">{cityName(shop().city, i18n.lang())} · {shop().address}</p>
                <h1 class="mt-2 text-5xl sm:text-6xl">{shop().name}</h1>
                <Show when={shop().description}>
                  {(text) => <p class="mt-4 max-w-prose whitespace-pre-line">{text()}</p>}
                </Show>
                <div class="mt-6 max-w-xl">
                  <ContactButtons shop={shop()} />
                </div>
              </div>
            </header>

            <section class="mt-12" aria-labelledby="shop-dresses-title">
              <h2 id="shop-dresses-title" class="label mb-6 border-t border-line pt-6">{t("shop.listings")}</h2>
              <Show when={shop().categories.length > 1}>
                <nav class="mb-6 flex flex-wrap gap-2" aria-label={t("home.categories")}>
                  {chip("", t("search.all"))}
                  <For each={shop().categories}>{(c) => chip(c, tr(catLabel(c)))}</For>
                </nav>
              </Show>
              <Switch>
                <Match when={list.items().length === 0 && list.error() !== null}>
                  <ErrorState error={list.error()} onRetry={() => void list.retry()} />
                </Match>
                <Match when={list.items().length === 0 && list.loading()}>
                  <GridSkeleton />
                </Match>
                <Match when={list.items().length === 0}>
                  <p class="text-silver-ink">{t("shop.empty")}</p>
                </Match>
                <Match when={true}>
                  <ListingGrid items={list.items()} />
                  <LoadMore list={list} />
                </Match>
              </Switch>
            </section>
          </div>
        )}
      </Match>
    </Switch>
  );
}
```

- [ ] **Step 4: Run all frontend checks**

Run: `deno task test && deno task check && deno task build`
Expected:
- the tests pass;
- `check` reports no errors;
- the build prints `✓ built`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): editorial list pages with removable filter chips"
```

---

### Task 6: Dress and item pages with a sticky Call bar

**Files:**
- Create: `frontend/src/components/ListingDetail.tsx`
- Modify:
  - `frontend/src/components/ShareButton.tsx`
  - `frontend/src/pages/Dress.tsx`
  - `frontend/src/pages/Item.tsx`
  - `frontend/src/i18n/en.json`, `ru.json` and `tk.json`

**Interfaces:**
- Consumes:
  - from Task 1: `.label`, `.btn` and the tokens;
  - existing: `Gallery`, `FavoriteButton`, `FavoriteIconButton`, `Availability`, `ShopCardSection`, `priceText`, `telHref`, `AttributeList`, `ColorSwatch` and the catalog helpers.
- Produces:
  - `ShareButton(props: { title; round? })`. `round` is an icon-only white circle for use over a photo.
  - `ListingDetail(props: { listing: DetailListing; kicker: string; backHref: string; details: JSX.Element })`.
  - **i18n key:** `contact.call`.

- [ ] **Step 1: The texts**

**en.json**
```json
  "contact.call": "Call"
```

**ru.json**
```json
  "contact.call": "Позвонить"
```

**tk.json**
```json
  "contact.call": "Jaň et"
```

- [ ] **Step 2: The round share button and the shared layout**

`frontend/src/components/ShareButton.tsx`
```tsx
import { createSignal, Show } from "solid-js";
import { t } from "../i18n/i18n.ts";
import { ShareIcon } from "./icons.tsx";

/** Native share sheet on phones; copies the link elsewhere. `round` is the icon-only button over a photo. */
export default function ShareButton(props: { title: string; round?: boolean }) {
  const [copied, setCopied] = createSignal(false);

  async function share() {
    const url = location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: props.title, url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        // share failed for another reason: fall back to copying
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      prompt(t("dress.share"), url);
    }
  }

  return (
    <span class="inline-flex items-center gap-3">
      <Show
        when={props.round}
        fallback={
          <button type="button" class="btn btn-outline" onClick={() => void share()}>
            <ShareIcon />
            {t("dress.share")}
          </button>
        }
      >
        <button
          type="button"
          class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink hover:bg-white"
          aria-label={t("dress.share")}
          onClick={() => void share()}
        >
          <ShareIcon />
        </button>
      </Show>
      <span role="status" class="text-sm text-silver-ink" classList={{ "sr-only": props.round }}>
        {copied() ? t("dress.link_copied") : ""}
      </span>
    </span>
  );
}
```

`frontend/src/components/ListingDetail.tsx`
```tsx
import { useNavigate } from "@solidjs/router";
import { type JSX, Show } from "solid-js";
import { t } from "../i18n/i18n.ts";
import { telHref } from "../lib/format.ts";
import type { Attributes, Image, ShopCard } from "../lib/types.ts";
import Availability from "./Availability.tsx";
import { FavoriteButton, FavoriteIconButton } from "./FavoriteButton.tsx";
import Gallery from "./Gallery.tsx";
import { ChevronLeftIcon, InstagramIcon, PhoneIcon } from "./icons.tsx";
import { priceText } from "./price.ts";
import ShareButton from "./ShareButton.tsx";
import ShopCardSection from "./ShopCard.tsx";

export interface DetailListing {
  id: number;
  title: string;
  price_manat: number;
  price_is_from: boolean;
  attributes?: Attributes;
  description: string | null;
  images: Image[];
  shop: ShopCard;
}

/** Only https links are rendered, whatever the API sends. */
const httpsUrl = (url: string | null) => (url?.startsWith("https://") ? url : null);

/**
 * The dress and item page body. On phones the photo fills the width with back, share and heart
 * buttons on it, and Call (plus Instagram) stays in view just above the bottom bar.
 */
export default function ListingDetail(props: {
  listing: DetailListing;
  /** The small label above the title, e.g. "Dresses · Ak Gelin". */
  kicker: string;
  /** Where Back goes when there is no page to go back to. */
  backHref: string;
  details: JSX.Element;
}) {
  const navigate = useNavigate();
  const l = () => props.listing;
  const back = () => (history.length > 1 ? history.back() : navigate(props.backHref));
  return (
    <>
      <article class="pt-0 md:pt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-12">
        <div class="relative">
          <Gallery images={l().images} title={l().title} />
          <div class="pointer-events-none absolute inset-x-0 top-3 flex justify-between md:hidden">
            <button
              type="button"
              class="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink hover:bg-white"
              aria-label={t("common.back")}
              onClick={back}
            >
              <ChevronLeftIcon />
            </button>
            <span class="pointer-events-auto flex gap-2">
              <ShareButton title={l().title} round />
              <FavoriteIconButton id={l().id} />
            </span>
          </div>
        </div>
        <div class="mt-6 lg:mt-0">
          <p class="label">{props.kicker}</p>
          <h1 class="mt-2 text-5xl sm:text-6xl">{l().title}</h1>
          <p class="mt-3 font-label text-xl tracking-[0.06em] text-garnet">{priceText(l())}</p>
          <div class="mt-5 hidden flex-wrap items-center gap-3 md:flex">
            <FavoriteButton id={l().id} />
            <ShareButton title={l().title} />
          </div>

          <div class="mt-8">{props.details}</div>

          <Show when={l().description}>
            {(text) => (
              <section class="mt-8">
                <h2 class="label">{t("item.about")}</h2>
                <p class="mt-2 max-w-prose whitespace-pre-line">{text()}</p>
              </section>
            )}
          </Show>

          <div class="mt-10">
            <Availability listingId={l().id} />
          </div>

          <div class="mt-10">
            <ShopCardSection shop={l().shop} />
          </div>
        </div>
      </article>

      {/* Phones: always one tap from calling the shop. The spacer keeps the end of the page visible. */}
      <div class="h-16 md:hidden" aria-hidden="true" />
      <div class="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 flex gap-2 border-t border-line bg-white px-4 py-2 md:hidden">
        <a href={telHref(l().shop.phone)} class="btn btn-primary flex-1">
          <PhoneIcon />
          {t("contact.call")}
        </a>
        <Show when={httpsUrl(l().shop.instagram_url)}>
          {(url) => (
            <a href={url()} target="_blank" rel="noopener noreferrer" class="btn btn-outline">
              <InstagramIcon />
              {t("dress.instagram")}
            </a>
          )}
        </Show>
      </div>
    </>
  );
}
```

- [ ] **Step 3: The dress and item pages use it**

`frontend/src/pages/Dress.tsx`
```tsx
import { useParams } from "@solidjs/router";
import { createResource, For, Match, Show, Switch } from "solid-js";
import ColorSwatch from "../components/ColorSwatch.tsx";
import ErrorState from "../components/ErrorState.tsx";
import ListingDetail from "../components/ListingDetail.tsx";
import { DetailSkeleton } from "../components/Skeleton.tsx";
import { t } from "../i18n/i18n.ts";
import { api } from "../lib/client.ts";
import { isNotFound } from "../lib/errors.ts";
import { usePageTitle } from "../lib/title.ts";
import type { PublicDress } from "../lib/types.ts";
import NotFound from "./NotFound.tsx";

function DressView(props: { dress: PublicDress }) {
  const d = () => props.dress;
  return (
    <ListingDetail
      listing={d()}
      kicker={`${t("cat.dresses")} · ${d().shop.name}`}
      backHref="/dresses"
      details={
        <dl class="grid grid-cols-[max-content_1fr] items-center gap-x-6 gap-y-3 text-sm">
          <dt class="label">{t("dress.sizes")}</dt>
          <dd class="flex flex-wrap gap-1.5">
            <For each={d().sizes}>
              {(size) => <span class="border border-silver px-2.5 py-0.5 text-xs font-semibold">{size}</span>}
            </For>
          </dd>
          <dt class="label">{t("dress.color")}</dt>
          <dd class="flex items-center gap-2">
            <ColorSwatch color={d().color} />
            {t(`color.${d().color}`)}
          </dd>
          <dt class="label">{t("dress.style")}</dt>
          <dd>{t(`silhouette.${d().silhouette}`)}</dd>
          <dt class="label">{t("dress.sleeves")}</dt>
          <dd>{t(`sleeves.${d().sleeves}`)}</dd>
        </dl>
      }
    />
  );
}

export default function Dress() {
  const params = useParams();
  const [dress, { refetch }] = createResource(() => params.id, (id) => api.dress(id));
  usePageTitle(() => (dress.state === "ready" ? dress()?.title : undefined));

  return (
    <Switch>
      <Match when={dress.error}>
        <Show when={isNotFound(dress.error)} fallback={<ErrorState error={dress.error} onRetry={refetch} />}>
          <NotFound />
        </Show>
      </Match>
      <Match when={!dress()}>
        <DetailSkeleton />
      </Match>
      <Match when={dress()} keyed>{(d) => <DressView dress={d} />}</Match>
    </Switch>
  );
}
```

`frontend/src/pages/Item.tsx`
```tsx
import { Navigate, useParams } from "@solidjs/router";
import { createResource, Match, Show, Switch } from "solid-js";
import AttributeList from "../components/AttributeList.tsx";
import ErrorState from "../components/ErrorState.tsx";
import ListingDetail from "../components/ListingDetail.tsx";
import { DetailSkeleton } from "../components/Skeleton.tsx";
import { tr } from "../i18n/i18n.ts";
import { categoryHref, catLabel } from "../lib/catalog.ts";
import { api } from "../lib/client.ts";
import { isNotFound } from "../lib/errors.ts";
import { usePageTitle } from "../lib/title.ts";
import type { PublicItem } from "../lib/types.ts";
import NotFound from "./NotFound.tsx";

function ItemView(props: { item: PublicItem }) {
  const it = () => props.item;
  return (
    <ListingDetail
      listing={it()}
      kicker={`${tr(catLabel(it().category))} · ${it().shop.name}`}
      backHref={categoryHref(it().category)}
      details={<AttributeList category={it().category} attributes={it().attributes} />}
    />
  );
}

/** /items/:id: any category's page; a dress opened here goes to its own /dresses/:id page. */
export default function Item() {
  const params = useParams();
  const [item, { refetch }] = createResource(() => params.id, (id) => api.item(id));
  usePageTitle(() => (item.state === "ready" ? item()?.title : undefined));

  return (
    <Switch>
      <Match when={item.error}>
        <Show when={isNotFound(item.error)} fallback={<ErrorState error={item.error} onRetry={refetch} />}>
          <NotFound />
        </Show>
      </Match>
      <Match when={!item()}>
        <DetailSkeleton />
      </Match>
      <Match when={item()?.category === "dresses"}>
        <Navigate href={`/dresses/${item()!.id}`} />
      </Match>
      <Match when={item()} keyed>{(it) => <ItemView item={it} />}</Match>
    </Switch>
  );
}
```

- [ ] **Step 4: Run all frontend checks**

Run: `deno task test && deno task check && deno task build`
Expected:
- the tests pass;
- `check` reports no errors;
- the build prints `✓ built`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): dress and item pages with photo buttons and a sticky Call bar"
```

---

## Final verification (controller)

The controller does this in headless Chrome against a server built from the branch. It uses the **test** database and demo data only, never `wedding_dev`, and deletes every row it created afterwards.

1. **Screenshots:** at 320, 375 and 1280px in tk, ru and en, of home, `/categories`, `/c/cars`, `/dresses`, a dress page, an item page, `/search?q=demo`, a shop page, `/favorites` and `/more`. There must be no sideways overflow, and no page errors.
2. **Contrast:** the script finds no text below 4.5 : 1 (3 : 1 for 24px and up) on those pages, nor on the sign-in pages.
3. **Behaviour:**
   - the right tab has `aria-current`;
   - `Categories` → `Cars` → `Filters` → Limousine gives `?body=limousine` and a "Limousine" chip, and tapping that chip removes the filter;
   - hearting a dress makes the Favorites tab read "Favorites: 1";
   - the sticky Call bar does not cover the last link;
   - Tab reaches the bottom bar, with a solid focus outline;
   - the bottom bar is hidden at 1280px and on `/admin/*`.
4. **Regression:** the existing categories and shop-account browser flows still pass.

## Spec coverage

| Spec | Where |
|---|---|
| §3 colors, fonts, shapes | Task 1 |
| §4.1 bottom bar, top bar | Task 2 |
| §4.2 desktop menu | Task 2 (`Header`) |
| §4.3 Categories and More pages | Task 3 |
| §5 Home | Task 4 |
| §5 list pages, tile, search, favorites, shop page | Task 1 (tile), Task 5 |
| §5 dress and item pages, sticky contact bar | Task 6 |
| §5 not found, error and empty states; sign-in pages; footer | Task 1 (tokens and the heading rule), Task 2 (footer) |
| §6 accessibility | Tasks 1–6, Final verification |
| §8 testing | Task 2 (`nav_test`), Final verification |

## Changes made during review

- **Task 1:** no changes.
- **Task 2:** removed a stray blank line in `icons.tsx`; added `scroll-padding-bottom` on phones so focused elements are not hidden under the bottom bar.
- **Task 5:** removing a filter chip moves focus to the Filters button; long shop names wrap (`break-words`).
- **Task 6:** in Russian, Call plus a text Instagram button was wider than 320px and 375px screens, so Instagram became an icon with an `aria-label`. The dress page lost "About this dress" to the shared `item.about` heading; `ListingDetail` now takes an `about` prop. `httpsUrl` moved to `lib/format.ts` (with a test), and the title got `break-words`.
- **Final review:**
  - The calendar month name used the display font at 20px; it now uses `.label`.
  - Spec §4.2 "Add your shop" in the desktop menu was missing from the plan; added from `lg` up (new key `nav.add_shop`).
  - Spec §5 home category thumbnails were missing from the plan; added as small ovals, sharing `lib/categoryPreview.ts` with the Categories page. The preview uses the newest of 6 listings that has a photo, so a new listing without photos does not blank its category.
  - Small extras: en `categories.count` reads "Listings: {count}", the photo buttons get `sm:px-3`, and `.btn-outline` hover shows a veil background.
  - Spec text updated to match: 32px desktop gutter, plural category kicker, the Instagram icon, and label-font titles on empty states.
