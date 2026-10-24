# A Simpler Home Page, Top Bar and Shop Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** This plan makes five changes:
- remove the göl band;
- remove the home page's newest grid and its "see all" link;
- remove the "All categories" link under the home categories;
- remove the top-bar search;
- make a shop's public page compact on phones, like My shop.

**Architecture:**
- **Removals:** these are plain deletions of markup, imports and the three unused text keys.
- **Shared shop header:** the compact My shop header becomes `ShopProfileHeader`, a shared component with an `actions` slot, used by My shop and by the public shop page.
- **Compact contact buttons:** `ContactButtons` gains a `compact` option for the shop page header.

**Tech Stack:** Solid 1.9 and Tailwind 4, built and tested with Deno 2.4. There are no backend changes.

**Spec:** `docs/superpowers/specs/2026-10-24-simpler-home-and-shop-design.md`

## Global Constraints

- **Unchanged:**
  - the search results page `/search`;
  - the Categories and More pages;
  - the dress and item pages, whose shop box uses `ContactButtons` without `compact`;
  - My shop's look;
  - computers' shop-page layout;
  - no new routes and no API changes.
- **Removed:**
  - `GolBand` everywhere, including its file;
  - the home newest section;
  - the home "Ähli kategoriýalar" link;
  - the `Header` search form and the phone search icon;
  - the keys `home.newest`, `home.see_all_items` and `home.see_all_categories`.
- **Kept:**
  - the home search box with its city picker;
  - the home hero photos, which still come from `api.items(per_page=8)`.
- **Accessibility:**
  - text contrast is at least 4.5 : 1 in light and dark, and no text is smaller than 10px;
  - the phone "Jaň et" link's accessible name includes the phone number (`dress.call`);
  - no sideways scrolling at 320px in tk, ru and en.
- **Text:** every user-visible string goes through `frontend/src/i18n/{tk,ru,en}.json`, with identical keys and placeholders, which a test enforces.
- **Tools:** frontend tools run only through Deno, from `frontend/`: `deno task test`, `deno task check` and `deno task build`. Never run npm or Vite with Node.
- **Data:** never write to the `wedding_dev` database.
- **Commits:** every commit message ends with the `Co-Authored-By:` trailer line the controller gives you.

## How to read the steps

- **Full files:** a path in backticks on its own line, directly followed by a code block, gives the **whole file**. Create or overwrite it with exactly that content. From the repository root you can extract it with:
  `python3 -I .superpowers/sdd/sh/block.py <brief> <path> > <path>`
- **Replacements:** "In `path`, replace:" gives an exact text to find (it occurs once) and the text to put in its place. Apply a file's replacements in the order given.

---

### Task 1: Remove the göl band, the home newest section and the top-bar search

**Files:**
- Delete: `frontend/src/components/GolBand.tsx`
- Modify:
  - `frontend/src/pages/shop/ShopLayout.tsx`
  - `frontend/src/pages/shop/ShopLogin.tsx`
  - `frontend/src/pages/shop/ShopSignup.tsx`
  - `frontend/src/pages/admin/AdminLayout.tsx`
  - `frontend/src/pages/admin/Login.tsx`
  - `frontend/src/pages/Home.tsx`
  - `frontend/src/components/CategoryBar.tsx`
  - `frontend/src/components/Header.tsx`
  - `frontend/src/i18n/{en,ru,tk}.json`

- [ ] **Step 1: Remove the göl band**

In `frontend/src/pages/shop/ShopLayout.tsx`, replace:
```tsx
import SignOutButton from "../../components/admin/SignOutButton.tsx";
import GolBand from "../../components/GolBand.tsx";
```
with:
```tsx
import SignOutButton from "../../components/admin/SignOutButton.tsx";
```

In `frontend/src/pages/shop/ShopLayout.tsx`, replace:
```tsx
        <header class="bg-white">
          <GolBand />
```
with:
```tsx
        <header class="bg-white">
```

In `frontend/src/pages/shop/ShopLogin.tsx`, replace:
```tsx
import { TextField } from "../../components/admin/Field.tsx";
import GolBand from "../../components/GolBand.tsx";
```
with:
```tsx
import { TextField } from "../../components/admin/Field.tsx";
```

In `frontend/src/pages/shop/ShopLogin.tsx`, replace:
```tsx
    <div class="min-h-screen bg-veil">
      <GolBand />
```
with:
```tsx
    <div class="min-h-screen bg-veil">
```

In `frontend/src/pages/shop/ShopSignup.tsx`, replace:
```tsx
import { SelectField, TextField } from "../../components/admin/Field.tsx";
import GolBand from "../../components/GolBand.tsx";
```
with:
```tsx
import { SelectField, TextField } from "../../components/admin/Field.tsx";
```

In `frontend/src/pages/shop/ShopSignup.tsx`, replace:
```tsx
    <div class="min-h-screen bg-veil">
      <GolBand />
```
with:
```tsx
    <div class="min-h-screen bg-veil">
```

In `frontend/src/pages/admin/AdminLayout.tsx`, replace:
```tsx
import SignOutButton from "../../components/admin/SignOutButton.tsx";
import GolBand from "../../components/GolBand.tsx";
```
with:
```tsx
import SignOutButton from "../../components/admin/SignOutButton.tsx";
```

In `frontend/src/pages/admin/AdminLayout.tsx`, replace:
```tsx
        <header class="bg-white">
          <GolBand />
```
with:
```tsx
        <header class="bg-white">
```

In `frontend/src/pages/admin/Login.tsx`, replace:
```tsx
import { TextField } from "../../components/admin/Field.tsx";
import GolBand from "../../components/GolBand.tsx";
```
with:
```tsx
import { TextField } from "../../components/admin/Field.tsx";
```

In `frontend/src/pages/admin/Login.tsx`, replace:
```tsx
    <div class="min-h-screen bg-veil">
      <GolBand />
```
with:
```tsx
    <div class="min-h-screen bg-veil">
```

Then delete the component. From the repository root run `git rm frontend/src/components/GolBand.tsx`, then `grep -rn "GolBand" frontend/src`.
Expected: no output.

- [ ] **Step 2: The home page keeps its hero, search box and categories only**

The hero still uses the newest listings' photos, so the request stays and only its grid goes.

In `frontend/src/pages/Home.tsx`, replace:
```tsx
import { A, useNavigate } from "@solidjs/router";
import { createResource, For, Match, Switch } from "solid-js";
import CategoryBar from "../components/CategoryBar.tsx";
import ErrorState from "../components/ErrorState.tsx";
import ListingGrid from "../components/ListingGrid.tsx";
import SearchBox from "../components/SearchBox.tsx";
import { GridSkeleton } from "../components/Skeleton.tsx";
```
with:
```tsx
import { useNavigate } from "@solidjs/router";
import { createResource, For } from "solid-js";
import CategoryBar from "../components/CategoryBar.tsx";
import SearchBox from "../components/SearchBox.tsx";
```

In `frontend/src/pages/Home.tsx`, replace:
```tsx
  // The newest listings of every category; the first two with a photo also dress the hero.
  const [newest, { refetch }] = createResource(() => api.items(new URLSearchParams({ per_page: "8" })));
```
with:
```tsx
  // The newest listings of every category: the first two with a photo dress the hero.
  const [newest] = createResource(() => api.items(new URLSearchParams({ per_page: "8" })));
```

In `frontend/src/pages/Home.tsx`, replace:
```tsx
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
```
with:
```tsx
      </section>
```

In `frontend/src/components/CategoryBar.tsx`, replace:
```tsx
      </ul>
      <A href="/categories" class="label mt-4 inline-block border-b border-ink pb-0.5 text-ink">
        {t("home.see_all_categories")}
      </A>
```
with:
```tsx
      </ul>
```

- [ ] **Step 3: No search in the top bar**

The logo now always has `mr-auto`, because the search form no longer pushes the menu to the right.

In `frontend/src/components/Header.tsx`, replace:
```tsx
import { A, useNavigate } from "@solidjs/router";
```
with:
```tsx
import { A } from "@solidjs/router";
```

In `frontend/src/components/Header.tsx`, replace:
```tsx
import { HeartIcon, SearchIcon } from "./icons.tsx";
```
with:
```tsx
import { HeartIcon } from "./icons.tsx";
```

In `frontend/src/components/Header.tsx`, replace:
```tsx
/** Phones: the logo, a search button and the account avatar (the bottom bar does the rest). Desktop: a full menu. */
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
```
with:
```tsx
/** Phones: the logo and the account avatar (the bottom bar does the rest). Desktop: the logo, a menu and the avatar. */
export default function Header() {
  const count = () => favorites.ids().length;
  return (
    <header class="bg-white">
      <div class="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 md:px-8 md:py-5">
        <A href="/" class="mr-auto font-label text-lg uppercase tracking-[0.32em] text-ink">
          {t("app.name")}
        </A>
```

- [ ] **Step 4: Remove the unused texts**

In `frontend/src/i18n/en.json`, replace:
```json
  "home.all_cities": "All cities",
  "home.newest": "New arrivals",
```
with:
```json
  "home.all_cities": "All cities",
```

In `frontend/src/i18n/en.json`, replace:
```json
  "home.categories": "Categories",
  "home.see_all_items": "See everything",
```
with:
```json
  "home.categories": "Categories",
```

In `frontend/src/i18n/en.json`, replace:
```json
  "more.contact": "Contact us:",
  "home.see_all_categories": "All categories",
```
with:
```json
  "more.contact": "Contact us:",
```

In `frontend/src/i18n/ru.json`, replace:
```json
  "home.all_cities": "Все города",
  "home.newest": "Новинки",
```
with:
```json
  "home.all_cities": "Все города",
```

In `frontend/src/i18n/ru.json`, replace:
```json
  "home.categories": "Категории",
  "home.see_all_items": "Смотреть всё",
```
with:
```json
  "home.categories": "Категории",
```

In `frontend/src/i18n/ru.json`, replace:
```json
  "more.contact": "Связаться с нами:",
  "home.see_all_categories": "Все категории",
```
with:
```json
  "more.contact": "Связаться с нами:",
```

In `frontend/src/i18n/tk.json`, replace:
```json
  "home.all_cities": "Ähli şäherler",
  "home.newest": "Täzeler",
```
with:
```json
  "home.all_cities": "Ähli şäherler",
```

In `frontend/src/i18n/tk.json`, replace:
```json
  "home.categories": "Kategoriýalar",
  "home.see_all_items": "Hemmesini gör",
```
with:
```json
  "home.categories": "Kategoriýalar",
```

In `frontend/src/i18n/tk.json`, replace:
```json
  "more.contact": "Bize jaň ediň:",
  "home.see_all_categories": "Ähli kategoriýalar",
```
with:
```json
  "more.contact": "Bize jaň ediň:",
```

Run, from the repository root: `grep -rn "home.newest\|home.see_all_items\|home.see_all_categories" frontend/src`
Expected: no output. Each JSON file must still parse.

- [ ] **Step 5: Check, test and build**

Run, from `frontend/`: `deno task check`, then `deno task test`, then `deno task build`.
Expected: no check errors; every test passes, including the i18n parity test; the build ends with `✓ built`.

- [ ] **Step 6: Commit**

```bash
git add -A frontend/src
git commit -m "feat(frontend): no göl band, no top-bar search, and a home page of categories"
```
(End the message with the trailer line the controller gives you.)

---

### Task 2: A shop's page is compact on phones, like My shop

**Files:**
- Create: `frontend/src/components/ShopProfileHeader.tsx`
- Modify:
  - `frontend/src/pages/shop/MyShop.tsx`
  - `frontend/src/components/ShopCard.tsx`
  - `frontend/src/pages/Shop.tsx`

**Interfaces:**
- Produces:
  - `ShopProfileHeader`, with props `{ logo: string | null; name: string; place: string; description: string | null; actions: JSX.Element }`;
  - `ContactButtons` props gain `compact?: boolean`.

- [ ] **Step 1: The shared header**

This is the My shop header from the dark-mode plan, unchanged, with the buttons moved into an `actions` slot.

`frontend/src/components/ShopProfileHeader.tsx`
```tsx
import { type JSX, Show } from "solid-js";
import ShopLogo from "./ShopLogo.tsx";

/**
 * A shop's header, on its public page and on My shop. Phones: a small oval logo with the place,
 * the name and the actions beside it, the description below. From md: the large logo, then the
 * name, the description and the actions in one column.
 */
export default function ShopProfileHeader(props: {
  logo: string | null;
  name: string;
  /** The city and address, as one small label. */
  place: string;
  description: string | null;
  actions: JSX.Element;
}) {
  return (
    // Every item gets an explicit cell from md: items with only a row set would otherwise be placed
    // before the logo and push it into a third column.
    <header class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 md:gap-x-6">
      <div class="row-span-2 md:col-start-1 md:row-span-3 md:row-start-1">
        <ShopLogo url={props.logo} name={props.name} size="profile" />
      </div>
      <div class="min-w-0 md:col-start-2 md:row-start-1">
        <p class="label">{props.place}</p>
        <h1 class="mt-1 break-words text-lg md:mt-2 md:font-display md:text-6xl md:tracking-normal">{props.name}</h1>
      </div>
      <div class="mt-2 min-w-0 md:col-start-2 md:row-start-3 md:mt-6">{props.actions}</div>
      <Show when={props.description}>
        {(text) => (
          <p class="col-span-2 mt-3 max-w-prose whitespace-pre-line md:col-span-1 md:col-start-2 md:row-start-2 md:mt-4">
            {text()}
          </p>
        )}
      </Show>
    </header>
  );
}
```

- [ ] **Step 2: My shop uses it**

The look does not change. Only the positioning classes move into `ShopProfileHeader`.

In `frontend/src/pages/shop/MyShop.tsx`, replace:
```tsx
import ShopLogo from "../../components/ShopLogo.tsx";
```
with:
```tsx
import ShopProfileHeader from "../../components/ShopProfileHeader.tsx";
```

In `frontend/src/pages/shop/MyShop.tsx`, replace:
```tsx
            {/* Phones: the logo with the name and buttons beside it, the description below.
                From md: the logo, then the name, description and buttons in one column, as on the shop page. */}
            <header class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 md:gap-x-6">
              <div class="row-span-2 md:col-start-1 md:row-span-3 md:row-start-1">
                <ShopLogo url={s().logo?.small ?? null} name={s().name} size="profile" />
              </div>
              <div class="min-w-0 md:col-start-2 md:row-start-1">
                <p class="label">{[city(), s().address].filter(Boolean).join(" · ")}</p>
                <h1 class="mt-1 break-words text-lg md:mt-2 md:font-display md:text-6xl md:tracking-normal">{s().name}</h1>
              </div>
              <div class="mt-2 grid grid-cols-2 gap-1.5 md:col-start-2 md:row-start-3 md:mt-6 md:flex md:flex-wrap md:items-center md:gap-3">
                <A href="/shop/profile" class={`btn btn-outline ${HEADER_BTN}`}>{t("myshop.edit_profile")}</A>
                <A href={m.newListingHref()} class={`btn btn-primary ${HEADER_BTN}`}>
                  <PlusIcon class="hidden h-5 w-5 shrink-0 md:block" />
                  {t("admin.new_listing")}
                </A>
                <Show when={s().is_published}>
                  <A
                    href={`/shops/${s().slug}`}
                    class="label col-span-2 mt-1 justify-self-start border-b border-ink pb-0.5 text-ink md:mt-0"
                  >
                    {t("myshop.view_page")}
                  </A>
                </Show>
              </div>
              <Show when={s().description}>
                {(text) => (
                  <p class="col-span-2 mt-3 max-w-prose whitespace-pre-line md:col-span-1 md:col-start-2 md:row-start-2 md:mt-4">
                    {text()}
                  </p>
                )}
              </Show>
            </header>
```
with:
```tsx
            <ShopProfileHeader
              logo={s().logo?.small ?? null}
              name={s().name}
              place={[city(), s().address].filter(Boolean).join(" · ")}
              description={s().description}
              actions={
                <div class="grid grid-cols-2 gap-1.5 md:flex md:flex-wrap md:items-center md:gap-3">
                  <A href="/shop/profile" class={`btn btn-outline ${HEADER_BTN}`}>{t("myshop.edit_profile")}</A>
                  <A href={m.newListingHref()} class={`btn btn-primary ${HEADER_BTN}`}>
                    <PlusIcon class="hidden h-5 w-5 shrink-0 md:block" />
                    {t("admin.new_listing")}
                  </A>
                  <Show when={s().is_published}>
                    <A
                      href={`/shops/${s().slug}`}
                      class="label col-span-2 mt-1 justify-self-start border-b border-ink pb-0.5 text-ink md:mt-0"
                    >
                      {t("myshop.view_page")}
                    </A>
                  </Show>
                </div>
              }
            />
```

- [ ] **Step 3: Compact contact buttons**

With `compact`, phones get small buttons: 10px text and no icons. "Jaň et" reads short, and its `aria-label` keeps the number. The icons restate their `h-5 w-5` size, because passing a class replaces the icons' default size. From md the buttons are today's.

In `frontend/src/components/ShopCard.tsx`, replace:
```tsx
/**
 * Big tap targets for the three ways a bride contacts a shop. With hideCallOnPhones the Call button
 * shows from 768px up only, for pages that already keep a Call bar on screen on phones.
```
with:
```tsx
/** Compact contact buttons on phones (small text, no icons, wrapping); today's size from md. */
const COMPACT = "min-h-8 px-1 text-center text-[10px] leading-tight tracking-[0.04em] md:min-h-12 md:px-5 md:tracking-[0.18em]";

/**
 * Big tap targets for the three ways a bride contacts a shop. With hideCallOnPhones the Call button
 * shows from 768px up only, for pages that already keep a Call bar on screen on phones. With compact
 * (the shop page header) they are small on phones, and Call reads just "Jaň et" there.
```

In `frontend/src/components/ShopCard.tsx`, replace:
```tsx
}) {
  return (
    <div class="grid gap-3 sm:grid-cols-3">
      <a
        href={telHref(props.shop.phone)}
        class="btn btn-primary min-h-12 text-base sm:col-span-3"
        classList={{ "hidden md:inline-flex": props.hideCallOnPhones }}
      >
        <PhoneIcon />
        {t("dress.call", { phone: props.shop.phone })}
      </a>
      <Show when={httpsUrl(props.shop.instagram_url)}>
        {(url) => (
          <a href={url()} target="_blank" rel="noopener noreferrer" class="btn btn-outline min-h-12">
            <InstagramIcon />
```
with:
```tsx
  compact?: boolean;
}) {
  // A class replaces the icons' default size, so the compact one restates it.
  const icon = () => (props.compact ? "hidden h-5 w-5 shrink-0 md:block" : undefined);
  const social = () => (props.compact ? `${COMPACT} md:text-xs` : "min-h-12");
  return (
    <div class={props.compact ? "grid grid-cols-2 gap-1.5 md:grid-cols-3 md:gap-3" : "grid gap-3 sm:grid-cols-3"}>
      <a
        href={telHref(props.shop.phone)}
        class={`btn btn-primary ${props.compact ? `${COMPACT} col-span-2 md:col-span-3 md:text-base` : "min-h-12 text-base sm:col-span-3"}`}
        classList={{ "hidden md:inline-flex": props.hideCallOnPhones }}
        aria-label={props.compact ? t("dress.call", { phone: props.shop.phone }) : undefined}
      >
        <PhoneIcon class={icon()} />
        <Show when={props.compact} fallback={t("dress.call", { phone: props.shop.phone })}>
          <span class="md:hidden">{t("contact.call")}</span>
          <span class="hidden md:inline">{t("dress.call", { phone: props.shop.phone })}</span>
        </Show>
      </a>
      <Show when={httpsUrl(props.shop.instagram_url)}>
        {(url) => (
          <a href={url()} target="_blank" rel="noopener noreferrer" class={`btn btn-outline ${social()}`}>
            <InstagramIcon class={icon()} />
```

In `frontend/src/components/ShopCard.tsx`, replace:
```tsx
          <a href={url()} target="_blank" rel="noopener noreferrer" class="btn btn-outline min-h-12">
            <TikTokIcon />
```
with:
```tsx
          <a href={url()} target="_blank" rel="noopener noreferrer" class={`btn btn-outline ${social()}`}>
            <TikTokIcon class={icon()} />
```

- [ ] **Step 4: The shop page uses both**

In `frontend/src/pages/Shop.tsx`, replace:
```tsx
import ShopLogo from "../components/ShopLogo.tsx";
```
with:
```tsx
import ShopProfileHeader from "../components/ShopProfileHeader.tsx";
```

In `frontend/src/pages/Shop.tsx`, replace:
```tsx
            <header class="flex flex-col gap-6 sm:flex-row sm:items-center">
              <ShopLogo url={shop().logo} name={shop().name} size="xl" />
              <div class="min-w-0 flex-1">
                <p class="label">{cityName(shop().city, i18n.lang())} · {shop().address}</p>
                <h1 class="mt-2 break-words text-5xl sm:text-6xl">{shop().name}</h1>
                <Show when={shop().description}>
                  {(text) => <p class="mt-4 max-w-prose whitespace-pre-line">{text()}</p>}
                </Show>
                <div class="mt-6 max-w-xl">
                  <ContactButtons shop={shop()} />
                </div>
              </div>
            </header>
```
with:
```tsx
            <ShopProfileHeader
              logo={shop().logo}
              name={shop().name}
              place={`${cityName(shop().city, i18n.lang())} · ${shop().address}`}
              description={shop().description}
              actions={
                <div class="md:max-w-xl">
                  <ContactButtons shop={shop()} compact />
                </div>
              }
            />
```

- [ ] **Step 5: Check, test and build**

Run, from `frontend/`: `deno task check`, then `deno task test`, then `deno task build`.
Expected: no check errors, every test passes, and the build ends with `✓ built`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ShopProfileHeader.tsx frontend/src/pages/shop/MyShop.tsx frontend/src/components/ShopCard.tsx frontend/src/pages/Shop.tsx
git commit -m "feat(frontend): a compact shop page on phones, sharing My shop's header"
```
(End the message with the trailer line the controller gives you.)

---

## Final verification (controller)

The controller does this in headless Chrome, against a server built from the branch, on the test database with demo data only.

1. **Pages:** home, `/shops/:slug`, `/shop`, `/shop/login`, `/admin/login` and `/admin/listings`.
2. **Themes, languages and widths:** light and dark, tk, ru and en, at 320, 375, 768 and 1280px.
3. **Must hold:**
   - no overflow and no page errors;
   - no göl band;
   - no top-bar search;
   - no newest grid and no "see all" links;
   - the home search box is present;
   - no header button text overflows;
   - contrast is clean in both themes.
4. **The shop page:** on phones the "Jaň et" link is 32px high and named with the number; from md it is 48px.
