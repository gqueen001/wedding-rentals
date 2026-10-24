# Search Filters, Listing Layout and the Owner Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 8 changes the product owner asked for after trying the redesign:
- Search gets a city choice and filters, and loses its big title.
- Dress and item pages get one Call button on phones and the "info beside the picture, calendar below" layout on computers.
- Edit pages get two columns on computers.
- "My shop" becomes an Instagram-style profile with a separate Edit profile page.
- Buttons get 8px corners, and text-only buttons get a thin border.

**Architecture:**
- **Search:** a pure `lib/search.ts` reads and writes the `/search` query on top of the existing `itemFilters.ts`. It treats "All" as a category with no fields of its own. Search reuses `ItemFilterSheet` and `FilterChips`, and a new shared `itemFilterChips()` that the category page also uses.
- **Dress and item pages:** `ListingDetail` moves `Availability` out of the right column into a row that spans both. `ContactButtons` can hide its Call button on phones.
- **Owner pages:** `/shop` shows the profile and a photo grid. The shop form and the logo upload move to a new `/shop/profile` route. A small `BackLink` component gives every edit page the same bordered Back button.

**Tech Stack:** Solid 1.9, @solidjs/router, Vite 7 and Tailwind 4, built and tested with Deno 2.4. There are no backend changes in this plan; the password length change is already committed on this branch.

**Spec:** `docs/superpowers/specs/2026-10-23-search-listing-myshop-design.md`

## Global Constraints

- **Unchanged:**
  - The behaviour, data and API calls stay as they are, apart from what the spec lists.
  - The only new route is `/shop/profile`.
  - The public shop page `/shops/:slug` does not change.
- **Buttons:**
  - Every `.btn` has `border-radius: 0.5rem` (8px).
  - `.btn-quiet` has a 1px `silver` border on a white background.
  - Chips stay pills, and round icon buttons stay circles.
- **Colors and fonts:** use only the existing tokens and classes (`ink`, `silver`, `silver-ink`, `line`, `veil`, `garnet`, `garnet-deep`, `blush`, `.label`, `.btn*`, `.chip*`, `.field-input`). The display font is used only at 30px and up.
- **Accessibility:**
  - Text contrast is at least 4.5 : 1 (3 : 1 for 24px and up), and no text is smaller than 10px.
  - Focus stays visible, and every control and link has an accessible name.
  - No sideways scrolling at 320px in tk, ru and en.
- **Text:** every user-visible string goes through `frontend/src/i18n/{tk,ru,en}.json`, with identical keys and placeholders, which a test enforces.
- **Tools:** frontend tools run only through Deno, from `frontend/`: `deno task test`, `deno task check` and `deno task build`. Never run Vite with Node, and don't add npm packages.
- **Data:** never write to the `wedding_dev` database.
- **Commits:** every commit message ends with the `Co-Authored-By:` trailer line the controller gives you.

## File Map

```
frontend/src/index.css                            .btn 8px corners; bordered .btn-quiet
frontend/src/components/admin/BackLink.tsx        new: "‹ Back" as a small bordered button
frontend/src/pages/admin/{ShopEdit,NewListing}.tsx      use BackLink
frontend/src/components/Header.tsx                "Add your shop" gets a thin garnet border
frontend/src/lib/search.ts, search_test.ts        new: parseSearch, searchQuery, searchHref, searchFields
frontend/src/components/itemFilterChips.ts        new: the active-filter chips, shared by Category and Search
frontend/src/pages/{Category,Search}.tsx          Category uses itemFilterChips; Search gets city, filters, chips
frontend/src/components/{ShopCard,ListingDetail}.tsx    no shop-box Call on phones; calendar under both columns
frontend/src/pages/admin/{DressEdit,ItemEdit}.tsx       BackLink (Task 1); two columns on lg (Task 4)
frontend/src/pages/shop/{MyShop,ShopProfile}.tsx  the owner profile with a photo grid; the new Edit profile page
frontend/src/main.tsx                             /shop/profile
frontend/src/i18n/{tk,ru,en}.json                 + myshop.edit_profile
```

## How to read the steps

- **Full files:** a path in backticks on its own line, directly followed by a code block, gives the **whole file**. Create or overwrite it with exactly that content. From the repository root you can extract it with:
  `python3 -I .superpowers/sdd/sps/block.py <brief> <path> > <path>`
- **Replacements:** "In `path`, replace:" gives an exact text to find (it occurs once) and the text to put in its place.
- **i18n entries:** under **en.json**, **ru.json** and **tk.json**, a block of `"key": "value"` lines goes at the end of that file. Add a comma to the file's current last entry, and keep the closing `}` last.

---

### Task 1: Button corners, bordered quiet buttons and the Back button

This task makes no change to page layouts. Every button gets 8px corners, and every text-only (`btn-quiet`) button gets a thin border: Delete, Sign out, Clear filters, Add a name and Remove photo. The edit pages' "Back" text links become a small bordered "‹ Back" button. "Add your shop" in the desktop menu gets a thin garnet border.

**Files:**
- Create: `frontend/src/components/admin/BackLink.tsx`
- Modify:
  - `frontend/src/index.css`
  - `frontend/src/components/Header.tsx`
  - `frontend/src/pages/admin/ShopEdit.tsx`
  - `frontend/src/pages/admin/NewListing.tsx`
  - `frontend/src/pages/admin/DressEdit.tsx`
  - `frontend/src/pages/admin/ItemEdit.tsx`

**Interfaces:**
- Produces: `BackLink` (default export of `components/admin/BackLink.tsx`), with props `{ href: string }`. It renders `<A class="btn btn-quiet">` with a `ChevronLeftIcon` and `t("common.back")`. Task 5 uses it on `/shop/profile`.

- [ ] **Step 1: Round the buttons and border the quiet ones**

In `frontend/src/index.css`, replace:
```css
    border-radius: 0;
    padding: 0 1.25rem;
```
with:
```css
    border-radius: 0.5rem;
    padding: 0 1.25rem;
```

In `frontend/src/index.css`, replace:
```css
  .btn-quiet {
    padding: 0 0.75rem;
    color: var(--color-garnet);
  }
```
with:
```css
  .btn-quiet {
    border: 1px solid var(--color-silver);
    background: var(--color-white);
    padding: 0 0.75rem;
    color: var(--color-garnet);
  }
```

- [ ] **Step 2: Add the Back button component**

`frontend/src/components/admin/BackLink.tsx`
```tsx
import { A } from "@solidjs/router";
import { t } from "../../i18n/i18n.ts";
import { ChevronLeftIcon } from "../icons.tsx";

/** "‹ Back" at the top of an editing page, as a small bordered button. */
export default function BackLink(props: { href: string }) {
  return (
    <A href={props.href} class="btn btn-quiet">
      <ChevronLeftIcon class="h-4 w-4" />
      {t("common.back")}
    </A>
  );
}
```

- [ ] **Step 3: Use it on the four editing pages**

In `frontend/src/pages/admin/ShopEdit.tsx`, replace:
```tsx
import { A, useNavigate, useParams } from "@solidjs/router";
```
with:
```tsx
import { useNavigate, useParams } from "@solidjs/router";
```

In `frontend/src/pages/admin/ShopEdit.tsx`, replace:
```tsx
import { CheckboxField, FormActions } from "../../components/admin/Field.tsx";
```
with:
```tsx
import BackLink from "../../components/admin/BackLink.tsx";
import { CheckboxField, FormActions } from "../../components/admin/Field.tsx";
```

In `frontend/src/pages/admin/ShopEdit.tsx`, replace:
```tsx
      <A href="/admin/shops" class="text-sm text-silver-ink hover:text-ink">{t("common.back")}</A>
      <h1 class="mt-2 text-3xl">
```
with:
```tsx
      <BackLink href="/admin/shops" />
      <h1 class="mt-4 text-3xl">
```

In `frontend/src/pages/admin/NewListing.tsx`, replace:
```tsx
import { For } from "solid-js";
```
with:
```tsx
import { For } from "solid-js";
import BackLink from "../../components/admin/BackLink.tsx";
```

In `frontend/src/pages/admin/NewListing.tsx`, replace:
```tsx
      <A href={m.listingsHref(shopId())} class="text-sm text-silver-ink hover:text-ink">{t("common.back")}</A>
      <h1 class="mt-2 text-3xl">
```
with:
```tsx
      <BackLink href={m.listingsHref(shopId())} />
      <h1 class="mt-4 text-3xl">
```

In `frontend/src/pages/admin/DressEdit.tsx`, replace:
```tsx
import AvailabilityEditor from "../../components/admin/AvailabilityEditor.tsx";
```
with:
```tsx
import AvailabilityEditor from "../../components/admin/AvailabilityEditor.tsx";
import BackLink from "../../components/admin/BackLink.tsx";
```

In `frontend/src/pages/admin/DressEdit.tsx`, replace:
```tsx
      <A href={m.listingsHref()} class="text-sm text-silver-ink hover:text-ink">{t("common.back")}</A>
      <h1 class="mt-2 text-3xl">
```
with:
```tsx
      <BackLink href={m.listingsHref()} />
      <h1 class="mt-4 text-3xl">
```

In `frontend/src/pages/admin/ItemEdit.tsx`, replace:
```tsx
import AvailabilityEditor from "../../components/admin/AvailabilityEditor.tsx";
```
with:
```tsx
import AvailabilityEditor from "../../components/admin/AvailabilityEditor.tsx";
import BackLink from "../../components/admin/BackLink.tsx";
```

In `frontend/src/pages/admin/ItemEdit.tsx`, replace:
```tsx
      <A href={m.listingsHref()} class="text-sm text-silver-ink hover:text-ink">{t("common.back")}</A>
      <h1 class="mt-2 text-3xl">
```
with:
```tsx
      <BackLink href={m.listingsHref()} />
      <h1 class="mt-4 text-3xl">
```

`NewListing` still uses `A` elsewhere, so keep its router import. `DressEdit` and `ItemEdit` keep theirs for now; Task 4 rewrites both files and drops the unused `A`.

- [ ] **Step 4: Border "Add your shop" in the desktop menu**

In `frontend/src/components/Header.tsx`, replace:
```tsx
            <A href="/shop/signup" class={`${MENU_LINK} text-garnet`}>{t("nav.add_shop")}</A>
```
with:
```tsx
            <A
              href="/shop/signup"
              class="ml-2 inline-flex min-h-11 items-center rounded-lg border border-garnet px-3 font-label text-xs uppercase tracking-[0.2em] text-garnet hover:bg-blush"
            >
              {t("nav.add_shop")}
            </A>
```

- [ ] **Step 5: Check, test and build**

Run, from `frontend/`: `deno task check`, then `deno task test`, then `deno task build`.
Expected: check reports no errors, every test passes, and the build ends with `✓ built`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/index.css frontend/src/components/admin/BackLink.tsx frontend/src/components/Header.tsx frontend/src/pages/admin/ShopEdit.tsx frontend/src/pages/admin/NewListing.tsx frontend/src/pages/admin/DressEdit.tsx frontend/src/pages/admin/ItemEdit.tsx
git commit -m "feat(frontend): 8px button corners, bordered quiet buttons and a Back button on edit pages"
```
(End the message with the trailer line the controller gives you.)

---

### Task 2: Search with a city choice, filters and removable chips

`/search` loses its visible title and kicker. It gets a city dropdown under the search box, and the same Filters button and removable chips as the category pages. Filters always offer the city and price; when one category chip is picked, they also offer that category's own fields. Everything lives in the URL. The active-filter chips are built once, in a new `itemFilterChips()`, which the category page now uses as well.

**Files:**
- Create:
  - `frontend/src/lib/search.ts`
  - `frontend/src/lib/search_test.ts`
  - `frontend/src/components/itemFilterChips.ts`
- Modify:
  - `frontend/src/pages/Category.tsx` (full file)
  - `frontend/src/pages/Search.tsx` (full file)
  - `frontend/src/components/ItemFilterSheet.tsx` (its doc comment)

**Interfaces:**
- Consumes:
  - from `lib/itemFilters.ts` (unchanged): `ItemFilters`, `EMPTY_ITEM_FILTERS`, `parseItemFilters(c, query)`, `itemFiltersToQuery(c, f)` (it already drops values the category does not accept) and `countItemFilters(f)`;
  - from `lib/catalog.ts`: `CategoryDef` and `categoryDef(slug)`;
  - `ItemFilterSheet` (props `category`, `open`, `value`, `onApply`, `onClose`) and `FilterChips` (props `count`, `active`, `onOpen`), both unchanged.
- Produces:
  - `searchFields(category: CategoryDef | undefined): CategoryDef` returns "All" as a category with `fields: []`.
  - `parseSearch(query: URLSearchParams): SearchState`, where `SearchState` is `{ category: CategoryDef | undefined; filters: ItemFilters }`.
  - `searchQuery(s: SearchState): URLSearchParams`, the API query without a page.
  - `searchHref(category: string, filters: ItemFilters): string`.
  - `itemFilterChips(c: CategoryDef, f: ItemFilters, cities: City[], apply: (f: ItemFilters) => void): ActiveFilter[]`.

- [ ] **Step 1: Write the failing tests**

`frontend/src/lib/search_test.ts`
```ts
import { assertEquals } from "@std/assert";
import { EMPTY_ITEM_FILTERS } from "./itemFilters.ts";
import { parseSearch, searchHref, searchQuery } from "./search.ts";

Deno.test("parseSearch reads the category and its filters, and ignores an unknown category", () => {
  const s = parseSearch(new URLSearchParams("q=ak&category=cars&city=mary&price_min=100&body=suv&size=M"));
  assertEquals(s.category?.slug, "cars");
  assertEquals(s.filters, { q: "ak", city: "mary", priceMin: 100, priceMax: null, attrs: { body: "suv" } });
  const unknown = parseSearch(new URLSearchParams("category=boats&body=suv&price_max=900"));
  assertEquals(unknown.category, undefined);
  assertEquals(unknown.filters, { ...EMPTY_ITEM_FILTERS, priceMax: 900 });
});

Deno.test("searchHref round-trips every param", () => {
  const filters = { q: "ak", city: "mary", priceMin: 100, priceMax: 900, attrs: { body: "limousine", seats_min: "4" } };
  const href = searchHref("cars", filters);
  assertEquals(href, "/search?q=ak&city=mary&price_min=100&price_max=900&body=limousine&seats_min=4&category=cars");
  const back = parseSearch(new URLSearchParams(href.slice(href.indexOf("?") + 1)));
  assertEquals(back.category?.slug, "cars");
  assertEquals(back.filters, filters);
  assertEquals(searchHref("", EMPTY_ITEM_FILTERS), "/search");
});

Deno.test("changing the category keeps the shared filters and drops the old category's own", () => {
  const cars = { ...EMPTY_ITEM_FILTERS, q: "ak", city: "mary", priceMax: 900, attrs: { body: "suv", color: "white", seats_min: "4" } };
  assertEquals(searchHref("tents", cars), "/search?q=ak&city=mary&price_max=900&category=tents");
  assertEquals(searchHref("", cars), "/search?q=ak&city=mary&price_max=900");
  // Dresses have no catalog filters of their own: only the shared ones are kept.
  assertEquals(searchQuery({ category: parseSearch(new URLSearchParams("category=dresses")).category, filters: cars }).toString(),
    "q=ak&city=mary&price_max=900&category=dresses");
});
```

Run, from `frontend/`: `deno task test`
Expected: FAIL. `search_test.ts` cannot load `./search.ts`.

- [ ] **Step 2: Write the search helper**

`frontend/src/lib/search.ts`
```ts
import { type CategoryDef, categoryDef } from "./catalog.ts";
import { type ItemFilters, itemFiltersToQuery, parseItemFilters } from "./itemFilters.ts";

/** Searching every category at once: only the shared filters (city, price) apply. */
const ANY_CATEGORY: CategoryDef = { slug: "", own_pages: false, fields: [] };

/** The filters a search accepts: the shared ones, plus the picked category's own. */
export function searchFields(category: CategoryDef | undefined): CategoryDef {
  return category ?? ANY_CATEGORY;
}

export interface SearchState {
  /** The picked category chip; undefined means "All". */
  category: CategoryDef | undefined;
  filters: ItemFilters;
}

/** Reads /search's query. An unknown category means "All", and filters it does not have are dropped. */
export function parseSearch(query: URLSearchParams): SearchState {
  const category = categoryDef(query.get("category") ?? "");
  return { category, filters: parseItemFilters(searchFields(category), query) };
}

/** The API query for a search, without the page. */
export function searchQuery(s: SearchState): URLSearchParams {
  const query = itemFiltersToQuery(searchFields(s.category), s.filters);
  if (s.category) query.set("category", s.category.slug);
  return query;
}

/** The /search address for a category slug ("" for all) and filters; another category's own filters are dropped. */
export function searchHref(category: string, filters: ItemFilters): string {
  const qs = searchQuery({ category: categoryDef(category), filters }).toString();
  return qs ? `/search?${qs}` : "/search";
}
```

Run, from `frontend/`: `deno task test`
Expected: PASS, with the 3 new tests ("parseSearch reads…", "searchHref round-trips every param", and "changing the category keeps the shared filters…").

- [ ] **Step 3: Share the active-filter chips**

`frontend/src/components/itemFilterChips.ts`
```ts
import { i18n, t, tr } from "../i18n/i18n.ts";
import { type CategoryDef, fieldLabel, optionLabel } from "../lib/catalog.ts";
import { cityName, formatPrice } from "../lib/format.ts";
import type { ItemFilters } from "../lib/itemFilters.ts";
import type { City } from "../lib/types.ts";
import type { ActiveFilter } from "./FilterChips.tsx";

/** One removable chip per active filter, in the sheet's order; removing one applies the filters without it. */
export function itemFilterChips(
  c: CategoryDef,
  f: ItemFilters,
  cities: City[],
  apply: (f: ItemFilters) => void,
): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  if (f.city) {
    const city = cities.find((x) => x.slug === f.city);
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
}
```

The category page now uses it, so its own copy of this logic and the imports it alone needed go away:

`frontend/src/pages/Category.tsx`
```tsx
import { useLocation, useNavigate, useParams } from "@solidjs/router";
import { createMemo, createSignal, Match, Show, Switch } from "solid-js";
import EmptyState from "../components/EmptyState.tsx";
import ErrorState from "../components/ErrorState.tsx";
import FilterChips from "../components/FilterChips.tsx";
import { itemFilterChips } from "../components/itemFilterChips.ts";
import ItemFilterSheet from "../components/ItemFilterSheet.tsx";
import ListingGrid from "../components/ListingGrid.tsx";
import LoadMore from "../components/LoadMore.tsx";
import SearchBox from "../components/SearchBox.tsx";
import { GridSkeleton } from "../components/Skeleton.tsx";
import { t, tr } from "../i18n/i18n.ts";
import { type CategoryDef, categoryDef, catLabel } from "../lib/catalog.ts";
import { useCities } from "../lib/cities.ts";
import { api } from "../lib/client.ts";
import {
  countItemFilters, EMPTY_ITEM_FILTERS, type ItemFilters, itemFiltersToQuery, parseItemFilters,
} from "../lib/itemFilters.ts";
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
  const activeChips = () => itemFilterChips(c, filters(), cities(), apply);
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

- [ ] **Step 4: Rewrite the Search page**

The `h1` stays for screen readers (`sr-only`). The city dropdown is the same control as Home's (`home.city`, `home.all_cities`). Like the sheet's `CityField`, every option sets `selected=` as well as the select's `value=`: the cities load after the first render, so on a fresh load of `/search?city=mary` the `value` alone would leave "All cities" showing. Picking another category chip keeps the search text, city and price, but drops the old category's own filters, because `searchHref` writes only the filters the new category accepts.

`frontend/src/pages/Search.tsx`
```tsx
import { A, useLocation, useNavigate } from "@solidjs/router";
import { createMemo, createSignal, For, Match, Show, Switch } from "solid-js";
import EmptyState from "../components/EmptyState.tsx";
import ErrorState from "../components/ErrorState.tsx";
import FilterChips from "../components/FilterChips.tsx";
import { itemFilterChips } from "../components/itemFilterChips.ts";
import ItemFilterSheet from "../components/ItemFilterSheet.tsx";
import ListingGrid from "../components/ListingGrid.tsx";
import LoadMore from "../components/LoadMore.tsx";
import SearchBox from "../components/SearchBox.tsx";
import { GridSkeleton } from "../components/Skeleton.tsx";
import { i18n, t, tr } from "../i18n/i18n.ts";
import { CATEGORIES, catLabel } from "../lib/catalog.ts";
import { useCities } from "../lib/cities.ts";
import { api } from "../lib/client.ts";
import { cityName } from "../lib/format.ts";
import { countItemFilters, type ItemFilters } from "../lib/itemFilters.ts";
import { createRememberedList, type ListMemory } from "../lib/rememberedList.ts";
import { parseSearch, searchFields, searchHref, searchQuery } from "../lib/search.ts";
import { usePageTitle } from "../lib/title.ts";
import type { ListItem } from "../lib/types.ts";

const PER_PAGE = "24";
const memory: ListMemory<ListItem> = {};

/** /search?q=&category=&city=&price_min=…: every category at once, narrowed by chips, city and filters. */
export default function Search() {
  usePageTitle(() => t("search.title"));
  const location = useLocation();
  const navigate = useNavigate();
  const state = createMemo(() => parseSearch(new URLSearchParams(location.search)), undefined, {
    equals: (a, b) => searchQuery(a).toString() === searchQuery(b).toString(),
  });
  const slug = () => state().category?.slug ?? "";
  const [sheetOpen, setSheetOpen] = createSignal(false);
  const apply = (f: ItemFilters) => {
    setSheetOpen(false);
    navigate(searchHref(slug(), f));
  };
  const list = createRememberedList(memory, () => searchHref(slug(), state().filters), (page) => {
    const query = searchQuery(state());
    query.set("page", String(page));
    query.set("per_page", PER_PAGE);
    return api.items(query);
  });
  const cities = useCities();
  const activeChips = () => itemFilterChips(searchFields(state().category), state().filters, cities(), apply);
  const firstLoad = () => list.items().length === 0;
  const chip = (category: string, label: string) => (
    <A
      href={searchHref(category, state().filters)}
      class="chip"
      classList={{ "border-garnet bg-blush text-garnet-deep": slug() === category }}
      aria-current={slug() === category ? "page" : undefined}
    >
      {label}
    </A>
  );

  return (
    <div class="pt-6">
      <h1 class="sr-only">{t("search.title")}</h1>
      <div class="max-w-xl space-y-3">
        <SearchBox value={state().filters.q} onSearch={(q) => apply({ ...state().filters, q })} />
        <label class="flex flex-wrap items-center gap-3 text-sm">
          <span class="text-silver-ink">{t("home.city")}</span>
          <select
            class="field-input w-auto"
            value={state().filters.city}
            onChange={(e) => apply({ ...state().filters, city: e.currentTarget.value })}
          >
            {/* selected= as well as value=: the cities load after the first render. */}
            <option value="" selected={!state().filters.city}>{t("home.all_cities")}</option>
            <For each={cities()}>
              {(c) => (
                <option value={c.slug} selected={c.slug === state().filters.city}>{cityName(c, i18n.lang())}</option>
              )}
            </For>
          </select>
        </label>
      </div>
      <nav class="mt-5 flex flex-wrap gap-2" aria-label={t("home.categories")}>
        {chip("", t("search.all"))}
        <For each={CATEGORIES}>{(c) => chip(c.slug, tr(catLabel(c.slug)))}</For>
      </nav>
      <div class="mt-3">
        <FilterChips
          count={countItemFilters(state().filters)}
          active={activeChips()}
          onOpen={() => setSheetOpen(true)}
        />
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
            <EmptyState title={t("items.empty_title")} body={t("search.empty_body")} />
          </Match>
          <Match when={!firstLoad()}>
            <ListingGrid items={list.items()} />
            <LoadMore list={list} />
          </Match>
        </Switch>
      </div>

      <ItemFilterSheet
        category={searchFields(state().category)}
        open={sheetOpen()}
        value={state().filters}
        onApply={apply}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
}
```

`ItemFilterSheet` now serves /search too. In `frontend/src/components/ItemFilterSheet.tsx`, replace:
```tsx
/** A category page's filters, built from the category's field definitions. */
```
with:
```tsx
/** The filters of a category page or of /search, built from the category's field definitions. */
```

- [ ] **Step 5: Check, test and build**

Run, from `frontend/`: `deno task check`, then `deno task test`, then `deno task build`.
Expected: no check errors; every test passes, including the 3 in `search_test.ts`; the build ends with `✓ built`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/search.ts frontend/src/lib/search_test.ts frontend/src/components/itemFilterChips.ts frontend/src/components/ItemFilterSheet.tsx frontend/src/pages/Category.tsx frontend/src/pages/Search.tsx
git commit -m "feat(frontend): search with a city choice, filters and removable chips"
```
(End the message with the trailer line the controller gives you.)

---

### Task 3: One Call button on phones, and the calendar under both columns

On dress and item pages, phones already keep a fixed Call bar on screen. So the shop box's own Call button now shows from 768px up only. From 1024px up, the info and the shop box sit beside the photo, and the busy/free calendar runs under both columns. On phones the order is gallery, info, details, description, shop box, then calendar. The public shop page still shows its Call button at every width.

**Files:**
- Modify (full files):
  - `frontend/src/components/ShopCard.tsx`
  - `frontend/src/components/ListingDetail.tsx`

**Interfaces:**
- Produces:
  - `ContactButtons` props gain `hideCallOnPhones?: boolean`. When it is true, the Call link gets `hidden md:inline-flex`.
  - `ShopCardSection` props gain `hideCallOnPhones?: boolean` and pass it through.
  - `ListingDetail` passes `hideCallOnPhones`. Its props are unchanged.

- [ ] **Step 1: Let the shop box hide its Call button on phones**

`frontend/src/components/ShopCard.tsx`
```tsx
import { A } from "@solidjs/router";
import { Show } from "solid-js";
import { i18n, t } from "../i18n/i18n.ts";
import { cityName, httpsUrl, telHref } from "../lib/format.ts";
import type { ShopCard } from "../lib/types.ts";
import { InstagramIcon, PhoneIcon, TikTokIcon } from "./icons.tsx";
import ShopLogo from "./ShopLogo.tsx";

/**
 * Big tap targets for the three ways a bride contacts a shop. With hideCallOnPhones the Call button
 * shows from 768px up only, for pages that already keep a Call bar on screen on phones.
 */
export function ContactButtons(props: {
  shop: { phone: string; instagram_url: string | null; tiktok_url: string | null };
  hideCallOnPhones?: boolean;
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

export default function ShopCardSection(props: { shop: ShopCard; hideCallOnPhones?: boolean }) {
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
        <ContactButtons shop={props.shop} hideCallOnPhones={props.hideCallOnPhones} />
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

- [ ] **Step 2: Move the calendar under both columns**

`frontend/src/components/ListingDetail.tsx`
```tsx
import { useNavigate } from "@solidjs/router";
import { type JSX, Show } from "solid-js";
import { t } from "../i18n/i18n.ts";
import { httpsUrl, telHref } from "../lib/format.ts";
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

/**
 * The dress and item page body. On phones the photo fills the width with back, share and heart
 * buttons on it, and Call (plus an Instagram icon) stays in view just above the bottom bar.
 * On wide screens the info and the shop sit beside the photo, and the calendar runs under both.
 */
export default function ListingDetail(props: {
  listing: DetailListing;
  /** The small label above the title, e.g. "Dresses · Ak Gelin". */
  kicker: string;
  /** Where Back goes when there is no page to go back to. */
  backHref: string;
  /** The heading above the description, e.g. "About this dress". */
  about: string;
  details: JSX.Element;
}) {
  const navigate = useNavigate();
  const l = () => props.listing;
  const back = () => (history.length > 1 ? history.back() : navigate(props.backHref));
  return (
    <>
      <article class="pt-0 md:pt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-x-12">
        <div class="relative">
          <Gallery images={l().images} title={l().title} />
          <div class="pointer-events-none absolute inset-x-0 top-3 flex justify-between sm:px-3 md:hidden">
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
          <h1 class="mt-2 break-words text-5xl sm:text-6xl">{l().title}</h1>
          <p class="mt-3 font-label text-xl tracking-[0.06em] text-garnet">{priceText(l())}</p>
          <div class="mt-5 hidden flex-wrap items-center gap-3 md:flex">
            <FavoriteButton id={l().id} />
            <ShareButton title={l().title} />
          </div>

          <div class="mt-8">{props.details}</div>

          <Show when={l().description}>
            {(text) => (
              <section class="mt-8">
                <h2 class="label">{props.about}</h2>
                <p class="mt-2 max-w-prose whitespace-pre-line">{text()}</p>
              </section>
            )}
          </Show>

          <div class="mt-10">
            <ShopCardSection shop={l().shop} hideCallOnPhones />
          </div>
        </div>

        <div class="mt-10 lg:col-span-2">
          <Availability listingId={l().id} />
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
            <a
              href={url()}
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-outline px-3"
              aria-label={t("dress.instagram")}
            >
              <InstagramIcon />
            </a>
          )}
        </Show>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Check, test and build**

Run, from `frontend/`: `deno task check`, then `deno task test`, then `deno task build`.
Expected: no check errors, every test passes, and the build ends with `✓ built`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ShopCard.tsx frontend/src/components/ListingDetail.tsx
git commit -m "feat(frontend): one Call button on phones; the calendar runs under the photo and info"
```
(End the message with the trailer line the controller gives you.)

---

### Task 4: Two columns on the edit pages

From 1024px up, the dress and item edit pages show the info form on the left, and the Photos and busy/free calendar boxes on the right. Below 1024px they stay one column, exactly as before. Owners (`/shop/…`) and admins (`/admin/…`) share these pages, so both get the change. The behaviour does not change: the save, delete, photo and calendar logic and the "save first" notes for new listings stay as they are.

**Files:**
- Modify (full files):
  - `frontend/src/pages/admin/DressEdit.tsx`
  - `frontend/src/pages/admin/ItemEdit.tsx`

**Interfaces:**
- Consumes: `BackLink` from Task 1. Both files already import it. The router import loses `A`, which neither file uses any more since Task 1.

- [ ] **Step 1: Lay out the dress editor in two columns**

The outer box widens to `max-w-6xl` on lg. The form and a right-hand column go into a grid (`lg:grid lg:grid-cols-2 lg:items-start lg:gap-8`), and the two sections drop their own top margin in favour of the column's `space-y-8`.

`frontend/src/pages/admin/DressEdit.tsx`
```tsx
import { useNavigate, useParams, useSearchParams } from "@solidjs/router";
import { createEffect, createMemo, createResource, createSignal, For, Match, on, Show, Switch } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import AvailabilityEditor from "../../components/admin/AvailabilityEditor.tsx";
import BackLink from "../../components/admin/BackLink.tsx";
import { CheckboxField, FormActions, SelectField, TextArea, TextField } from "../../components/admin/Field.tsx";
import PhotoManager from "../../components/admin/PhotoManager.tsx";
import ErrorState from "../../components/ErrorState.tsx";
import { t, tr } from "../../i18n/i18n.ts";
import { fieldMessage, validationFields } from "../../lib/errors.ts";
import { type DressForm, dressFormToInput, dressToForm, EMPTY_DRESS_FORM, firstParam } from "../../lib/forms.ts";
import { useManage } from "../../lib/manage.ts";
import { usePageTitle } from "../../lib/title.ts";
import { COLORS, SILHOUETTES, SIZES, SLEEVES } from "../../lib/types.ts";

/**
 * The editor for one dress (or a new one); remounted per dress by DressEdit below.
 * Admins and shop owners share it: useManage() says where it saves and links to.
 */
function DressEditor(props: { id: number | null }) {
  const m = useManage();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const id = () => props.id;
  const [dress, { mutate, refetch }] = createResource(id, (dressId) => m.calls.dress(dressId));
  const [shops] = createResource(() => m.shops?.() ?? Promise.resolve([]));
  const [form, setForm] = createStore<DressForm>({
    ...EMPTY_DRESS_FORM,
    sizes: [],
    shop_id: Number(firstParam(search.shop_id)) || 0,
  });
  // Refill the form only when the saved dress changes, not when just its photos do.
  const stamp = createMemo(() => (dress.state === "ready" ? dress()?.updated_at : undefined));
  createEffect(on(stamp, (stamp) => {
    const d = dress.state === "ready" ? dress() : undefined;
    if (stamp && d) setForm(reconcile(dressToForm(d)));
  }));
  const [errors, setErrors] = createSignal<Record<string, string>>({});
  const [error, setError] = createSignal<unknown>(null);
  const [saving, setSaving] = createSignal(false);
  const [saved, setSaved] = createSignal(false);
  const err = (field: string) => errors()[field];
  usePageTitle(() => (id() ? form.title || t("admin.edit") : t("admin.new_dress")));

  async function save(e: SubmitEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setErrors({});
    setError(null);
    try {
      const input = dressFormToInput({ ...form, sizes: [...form.sizes] });
      const current = id();
      const result = current ? await m.calls.updateDress(current, input) : await m.calls.createDress(input);
      setSaved(true);
      if (current) mutate((prev) => ({ ...result, images: prev?.images ?? result.images }));
      else navigate(m.dressHref(result.id), { replace: true });
    } catch (e) {
      setErrors(validationFields(e));
      setError(() => e);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const current = id();
    if (!current || !confirm(t("admin.delete_dress_confirm"))) return;
    try {
      await m.calls.deleteDress(current);
      navigate(m.listingsHref(form.shop_id), { replace: true });
    } catch (e) {
      setError(() => e);
    }
  }

  const choose = { value: "", label: t("admin.choose") };
  const shopOptions = () => [
    choose,
    ...(shops.state === "ready" ? shops() ?? [] : []).map((s) => ({ value: String(s.id), label: s.name })),
  ];

  return (
    <div class="max-w-2xl lg:max-w-6xl">
      <BackLink href={m.listingsHref()} />
      <h1 class="mt-4 text-3xl">{id() ? form.title || t("admin.edit") : t("admin.new_dress")}</h1>
      <Switch>
        <Match when={dress.error}>
          <ErrorState error={dress.error} onRetry={() => void refetch()} />
        </Match>
        <Match when={id() !== null && !dress()}>
          <p class="mt-6 text-silver-ink">{t("common.loading")}</p>
        </Match>
        <Match when={id() === null || dress()}>
          <div class="mt-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
            <form class="space-y-5 rounded-lg bg-white p-5" novalidate onSubmit={save}>
              <Show when={m.shops}>
                <SelectField
                  label={t("admin.shop")}
                  value={form.shop_id ? String(form.shop_id) : ""}
                  options={shopOptions()}
                  onChange={(v) => setForm("shop_id", Number(v) || 0)}
                  error={err("shop_id")}
                />
              </Show>
              <TextField
                label={t("dressform.title")}
                value={form.title}
                onInput={(v) => setForm("title", v)}
                error={err("title")}
              />
              <div class="grid items-end gap-5 sm:grid-cols-2">
                <TextField
                  label={t("dressform.price")}
                  inputmode="numeric"
                  value={form.price}
                  onInput={(v) => setForm("price", v)}
                  error={err("price_manat")}
                />
                <CheckboxField
                  label={t("dressform.price_is_from")}
                  checked={form.price_is_from}
                  onChange={(v) => setForm("price_is_from", v)}
                />
              </div>
              <div class="grid gap-5 sm:grid-cols-3">
                <SelectField
                  label={t("dressform.color")}
                  value={form.color}
                  options={[choose, ...COLORS.map((c) => ({ value: c, label: t(`color.${c}`) }))]}
                  onChange={(v) => setForm("color", v as DressForm["color"])}
                  error={err("color")}
                />
                <SelectField
                  label={t("dressform.silhouette")}
                  value={form.silhouette}
                  options={[choose, ...SILHOUETTES.map((s) => ({ value: s, label: t(`silhouette.${s}`) }))]}
                  onChange={(v) => setForm("silhouette", v as DressForm["silhouette"])}
                  error={err("silhouette")}
                />
                <SelectField
                  label={t("dressform.sleeves")}
                  value={form.sleeves}
                  options={[choose, ...SLEEVES.map((s) => ({ value: s, label: t(`sleeves.${s}`) }))]}
                  onChange={(v) => setForm("sleeves", v as DressForm["sleeves"])}
                  error={err("sleeves")}
                />
              </div>
              <fieldset>
                <legend class="text-sm font-semibold">{t("dressform.sizes")}</legend>
                <div class="mt-2 flex flex-wrap gap-2">
                  <For each={SIZES}>
                    {(size) => (
                      <label class="chip">
                        <input
                          type="checkbox"
                          class="sr-only"
                          checked={form.sizes.includes(size)}
                          onChange={(e) =>
                            setForm(
                              "sizes",
                              e.currentTarget.checked ? [...form.sizes, size] : form.sizes.filter((s) => s !== size),
                            )}
                        />
                        {size}
                      </label>
                    )}
                  </For>
                </div>
                <Show when={err("sizes")}>
                  {(e) => <p class="mt-1 text-sm text-garnet">{fieldMessage(e(), tr)}</p>}
                </Show>
              </fieldset>
              <TextArea
                label={t("dressform.description")}
                value={form.description}
                onInput={(v) => setForm("description", v)}
                error={err("description")}
              />
              <CheckboxField
                label={t("admin.published")}
                hint={t("admin.published_hint")}
                checked={form.is_published}
                onChange={(v) => setForm("is_published", v)}
              />
              <FormActions saving={saving()} saved={saved()} error={error()} onDelete={id() ? remove : undefined} />
            </form>
            <div class="mt-8 space-y-8 lg:mt-0">
              <section class="rounded-lg bg-white p-5">
                <h2 class="text-2xl">{t("photos.title")}</h2>
                <div class="mt-4">
                  <Show
                    when={id() !== null && dress()}
                    fallback={<p class="text-sm text-silver-ink">{t("photos.save_first")}</p>}
                  >
                    {(d) => (
                      <PhotoManager
                        listingId={d().id}
                        title={d().title}
                        images={d().images}
                        onChange={(images) => mutate({ ...d(), images })}
                      />
                    )}
                  </Show>
                </div>
              </section>

              <section class="rounded-lg bg-white p-5">
                <h2 class="text-2xl">{t("avail.title")}</h2>
                <div class="mt-4">
                  <Show
                    when={id() !== null && dress()}
                    fallback={<p class="text-sm text-silver-ink">{t("avail.save_first")}</p>}
                  >
                    {(d) => <AvailabilityEditor listingId={d().id} />}
                  </Show>
                </div>
              </section>
            </div>
          </div>
        </Match>
      </Switch>
    </div>
  );
}

/**
 * /admin/dresses/new (optionally ?shop_id=), /admin/dresses/:id, /shop/dresses/new and
 * /shop/dresses/:id; a fresh editor per dress.
 */
export default function DressEdit() {
  const params = useParams();
  return (
    <Show when={params.id ?? "new"} keyed>
      {(key) => <DressEditor id={key === "new" ? null : Number(key)} />}
    </Show>
  );
}
```

- [ ] **Step 2: Lay out the item editor the same way**

`frontend/src/pages/admin/ItemEdit.tsx`
```tsx
import { useNavigate, useParams, useSearchParams } from "@solidjs/router";
import { createEffect, createMemo, createResource, createSignal, Match, on, Show, Switch } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import AttributeFields from "../../components/admin/AttributeFields.tsx";
import AvailabilityEditor from "../../components/admin/AvailabilityEditor.tsx";
import BackLink from "../../components/admin/BackLink.tsx";
import { CheckboxField, FormActions, SelectField, TextArea, TextField } from "../../components/admin/Field.tsx";
import PhotoManager from "../../components/admin/PhotoManager.tsx";
import ErrorState from "../../components/ErrorState.tsx";
import { t, tr } from "../../i18n/i18n.ts";
import { categoryDef, catLabel } from "../../lib/catalog.ts";
import { validationFields } from "../../lib/errors.ts";
import { emptyItemForm, firstParam, type ItemForm, itemFormToInput, itemToForm } from "../../lib/forms.ts";
import { useManage } from "../../lib/manage.ts";
import { usePageTitle } from "../../lib/title.ts";
import NotFound from "../NotFound.tsx";

/**
 * The editor for one non-dress item, or a new one in a category; remounted per item by
 * ItemEdit below. Admins and shop owners share it: useManage() says where it saves and links to.
 */
function ItemEditor(props: { id: number | null; category: string }) {
  const m = useManage();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const id = () => props.id;
  const [item, { mutate, refetch }] = createResource(id, (itemId) => m.calls.item(itemId));
  const [shops] = createResource(() => m.shops?.() ?? Promise.resolve([]));
  const [form, setForm] = createStore<ItemForm>(emptyItemForm(props.category, Number(firstParam(search.shop_id)) || 0));
  // Refill the form only when the saved item changes, not when just its photos do.
  const stamp = createMemo(() => (item.state === "ready" ? item()?.updated_at : undefined));
  createEffect(on(stamp, (stamp) => {
    const it = item.state === "ready" ? item() : undefined;
    if (stamp && it) setForm(reconcile(itemToForm(it)));
  }));
  const def = () => categoryDef(form.category);
  const categoryName = () => tr(catLabel(form.category));
  const [errors, setErrors] = createSignal<Record<string, string>>({});
  const [error, setError] = createSignal<unknown>(null);
  const [saving, setSaving] = createSignal(false);
  const [saved, setSaved] = createSignal(false);
  const err = (field: string) => errors()[field];
  const heading = () => (id() ? form.title || t("admin.edit") : t("admin.new_item", { category: categoryName() }));
  usePageTitle(heading);

  async function save(e: SubmitEvent) {
    e.preventDefault();
    const d = def();
    if (!d) return;
    setSaving(true);
    setSaved(false);
    setErrors({});
    setError(null);
    try {
      const input = itemFormToInput({ ...form, attributes: { ...form.attributes } }, d.fields);
      const current = id();
      const result = current ? await m.calls.updateItem(current, input) : await m.calls.createItem(input);
      setSaved(true);
      if (current) mutate((prev) => ({ ...result, images: prev?.images ?? result.images }));
      else navigate(m.itemHref(result.id), { replace: true });
    } catch (e) {
      setErrors(validationFields(e));
      setError(() => e);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const current = id();
    if (!current || !confirm(t("admin.delete_item_confirm"))) return;
    try {
      await m.calls.deleteItem(current);
      navigate(m.listingsHref(form.shop_id), { replace: true });
    } catch (e) {
      setError(() => e);
    }
  }

  const shopOptions = () => [
    { value: "", label: t("admin.choose") },
    ...(shops.state === "ready" ? shops() ?? [] : []).map((s) => ({ value: String(s.id), label: s.name })),
  ];

  return (
    <div class="max-w-2xl lg:max-w-6xl">
      <BackLink href={m.listingsHref()} />
      <h1 class="mt-4 text-3xl">{heading()}</h1>
      <Switch>
        <Match when={item.error}>
          <ErrorState error={item.error} onRetry={() => void refetch()} />
        </Match>
        <Match when={id() !== null && !item()}>
          <p class="mt-6 text-silver-ink">{t("common.loading")}</p>
        </Match>
        <Match when={def()}>
          {(d) => (
            <>
              <div class="mt-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
                <form class="space-y-5 rounded-lg bg-white p-5" novalidate onSubmit={save}>
                  <p class="text-sm">
                    <span class="text-silver-ink">{t("admin.category")}:</span>{" "}
                    <span class="font-semibold">{categoryName()}</span>
                  </p>
                  <Show when={m.shops}>
                    <SelectField
                      label={t("admin.shop")}
                      value={form.shop_id ? String(form.shop_id) : ""}
                      options={shopOptions()}
                      onChange={(v) => setForm("shop_id", Number(v) || 0)}
                      error={err("shop_id")}
                    />
                  </Show>
                  <TextField label={t("itemform.title")} value={form.title} onInput={(v) => setForm("title", v)} error={err("title")} />
                  <div class="grid items-end gap-5 sm:grid-cols-2">
                    <TextField
                      label={t("dressform.price")}
                      inputmode="numeric"
                      value={form.price}
                      onInput={(v) => setForm("price", v)}
                      error={err("price_manat")}
                    />
                    <CheckboxField
                      label={t("dressform.price_is_from")}
                      checked={form.price_is_from}
                      onChange={(v) => setForm("price_is_from", v)}
                    />
                  </div>
                  <AttributeFields
                    category={d()}
                    values={form.attributes}
                    onChange={(key, value) => setForm("attributes", key, value)}
                    errors={errors()}
                  />
                  <TextArea
                    label={t("dressform.description")}
                    value={form.description}
                    onInput={(v) => setForm("description", v)}
                    error={err("description")}
                  />
                  <CheckboxField
                    label={t("admin.published")}
                    hint={t("admin.published_hint")}
                    checked={form.is_published}
                    onChange={(v) => setForm("is_published", v)}
                  />
                  <FormActions saving={saving()} saved={saved()} error={error()} onDelete={id() ? remove : undefined} />
                </form>
                <div class="mt-8 space-y-8 lg:mt-0">
                  <section class="rounded-lg bg-white p-5">
                    <h2 class="text-2xl">{t("photos.title")}</h2>
                    <div class="mt-4">
                      <Show
                        when={id() !== null && item()}
                        fallback={<p class="text-sm text-silver-ink">{t("photos.save_first_item")}</p>}
                      >
                        {(it) => (
                          <PhotoManager
                            listingId={it().id}
                            title={it().title}
                            images={it().images}
                            onChange={(images) => mutate({ ...it(), images })}
                          />
                        )}
                      </Show>
                    </div>
                  </section>

                  <section class="rounded-lg bg-white p-5">
                    <h2 class="text-2xl">{t("avail.title")}</h2>
                    <div class="mt-4">
                      <Show
                        when={id() !== null && item()}
                        fallback={<p class="text-sm text-silver-ink">{t("avail.save_first_item")}</p>}
                      >
                        {(it) => <AvailabilityEditor listingId={it().id} />}
                      </Show>
                    </div>
                  </section>
                </div>
              </div>
            </>
          )}
        </Match>
      </Switch>
    </div>
  );
}

/**
 * /admin/items/new?category=…, /admin/items/:id, /shop/items/new?category=… and
 * /shop/items/:id; a fresh editor per item. A new item needs a known non-dress category.
 */
export default function ItemEdit() {
  const params = useParams();
  const [search] = useSearchParams();
  const key = () => {
    if (params.id) return /^\d+$/.test(params.id) && Number(params.id) > 0 ? params.id : "";
    const c = categoryDef(firstParam(search.category));
    return c && !c.own_pages ? `new:${c.slug}` : "";
  };
  return (
    <Show when={key()} keyed fallback={<NotFound />}>
      {(k) => (k.startsWith("new:") ? <ItemEditor id={null} category={k.slice(4)} /> : <ItemEditor id={Number(k)} category="" />)}
    </Show>
  );
}
```

- [ ] **Step 3: Check, test and build**

Run, from `frontend/`: `deno task check`, then `deno task test`, then `deno task build`.
Expected: no check errors, every test passes, and the build ends with `✓ built`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/admin/DressEdit.tsx frontend/src/pages/admin/ItemEdit.tsx
git commit -m "feat(frontend): edit pages put photos and the calendar beside the form on wide screens"
```
(End the message with the trailer line the controller gives you.)

---

### Task 5: My shop as a profile, and the Edit profile page

`/shop` now looks like the public shop page:
- the oval logo, the city and address, the name and the description;
- **Edit profile**, **+ New listing**, and "See your shop page" when the shop is published;
- the "hidden" notice when it is not;
- a photo grid of every listing, 3 per row on phones and 4 from md. Each tile links to its editor, and drafts show a "Draft" label.

The shop form and the logo upload move to the new `/shop/profile`, under a Back button. There is one new text, `myshop.edit_profile`. The box headings reuse `myshop.details` ("Salon barada") and the logo upload's own heading.

**Files:**
- Create: `frontend/src/pages/shop/ShopProfile.tsx`
- Modify:
  - `frontend/src/pages/shop/MyShop.tsx` (full file)
  - `frontend/src/main.tsx`
  - `frontend/src/i18n/{en,ru,tk}.json`

**Interfaces:**
- Consumes:
  - `BackLink` (Task 1);
  - `ownerApi.owner.me()`, which returns `ShopMe` with `shop: AdminShop` and `phone`;
  - `ownerApi.owner.listings()`, which returns `ListingSummary[]`;
  - `ownerApi.owner.updateShop(input)`;
  - `useManage()`, for `dressHref(id)`, `itemHref(id)` and `newListingHref()`;
  - `useCities()`, to show `AdminShop.city_id` as a city name;
  - `ShopLogo` (size `"xl"`), `ShopFields`, `FormActions` and `LogoUpload`, all unchanged.
- Produces: the route `/shop/profile` (component `ShopProfile`) and the text key `myshop.edit_profile`.

- [ ] **Step 1: Add the text**

**en.json**
```json
  "myshop.edit_profile": "Edit profile"
```

**ru.json**
```json
  "myshop.edit_profile": "Изменить профиль"
```

**tk.json**
```json
  "myshop.edit_profile": "Profili üýtget"
```

- [ ] **Step 2: Move the shop form to the Edit profile page**

This is the same save logic that was on `MyShop`, unchanged.

`frontend/src/pages/shop/ShopProfile.tsx`
```tsx
import { createEffect, createMemo, createResource, createSignal, Match, on, Switch } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import BackLink from "../../components/admin/BackLink.tsx";
import { FormActions } from "../../components/admin/Field.tsx";
import LogoUpload from "../../components/admin/LogoUpload.tsx";
import ShopFields from "../../components/admin/ShopFields.tsx";
import ErrorState from "../../components/ErrorState.tsx";
import { t } from "../../i18n/i18n.ts";
import { ownerApi } from "../../lib/client.ts";
import { validationFields } from "../../lib/errors.ts";
import { cleanShopInput, EMPTY_SHOP_INPUT, shopToInput } from "../../lib/forms.ts";
import { usePageTitle } from "../../lib/title.ts";
import type { ShopInput } from "../../lib/types.ts";

/** /shop/profile: "Edit profile", only the shop's details and its logo. */
export default function ShopProfile() {
  usePageTitle(() => t("myshop.edit_profile"));
  const [me, { mutate, refetch }] = createResource(() => ownerApi.owner.me());
  const shop = () => (me.state === "ready" ? me()?.shop : undefined);
  const [form, setForm] = createStore<ShopInput>({ ...EMPTY_SHOP_INPUT, aliases: [] });
  // Refill the form only when the saved shop changes, not when just its logo does.
  const stamp = createMemo(() => shop()?.updated_at);
  createEffect(on(stamp, (stamp) => {
    const s = shop();
    if (stamp && s) setForm(reconcile(shopToInput(s)));
  }));
  const [errors, setErrors] = createSignal<Record<string, string>>({});
  const [error, setError] = createSignal<unknown>(null);
  const [saving, setSaving] = createSignal(false);
  const [saved, setSaved] = createSignal(false);

  async function save(e: SubmitEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setErrors({});
    setError(null);
    try {
      const result = await ownerApi.owner.updateShop(
        cleanShopInput({ ...form, aliases: [...form.aliases] }),
      );
      setSaved(true);
      mutate((prev) => (prev ? { ...prev, shop: result } : prev));
    } catch (e) {
      setErrors(validationFields(e));
      setError(() => e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class="max-w-2xl">
      <BackLink href="/shop" />
      <h1 class="mt-4 text-3xl">{t("myshop.edit_profile")}</h1>
      <Switch>
        <Match when={me.error}>
          <ErrorState error={me.error} onRetry={() => void refetch()} />
        </Match>
        <Match when={!shop()}>
          <p class="mt-6 text-silver-ink">{t("common.loading")}</p>
        </Match>
        <Match when={shop()}>
          {(s) => (
            <>
              <p class="mt-1 text-sm text-silver-ink">{t("owner.phone")}: {me()?.phone}</p>
              <section class="mt-6" aria-labelledby="about-salon-title">
                <h2 id="about-salon-title" class="text-2xl">{t("myshop.details")}</h2>
                <form class="mt-4 space-y-5 rounded-lg bg-white p-5" novalidate onSubmit={save}>
                  <ShopFields form={form} setForm={setForm} errors={errors()} />
                  <FormActions saving={saving()} saved={saved()} error={error()} />
                </form>
              </section>
              <div class="mt-6 rounded-lg bg-white p-5">
                <LogoUpload
                  shopId={s().id}
                  name={s().name}
                  logo={s().logo}
                  onUploaded={(logo) =>
                    mutate((prev) => (prev ? { ...prev, shop: { ...prev.shop, logo } } : prev))}
                />
              </div>
            </>
          )}
        </Match>
      </Switch>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite My shop as the owner's profile**

`frontend/src/pages/shop/MyShop.tsx`
```tsx
import { A } from "@solidjs/router";
import { createResource, For, Match, Show, Switch } from "solid-js";
import ErrorState from "../../components/ErrorState.tsx";
import { PlusIcon } from "../../components/icons.tsx";
import ShopLogo from "../../components/ShopLogo.tsx";
import { i18n, t } from "../../i18n/i18n.ts";
import { useCities } from "../../lib/cities.ts";
import { ownerApi } from "../../lib/client.ts";
import { contactPhone } from "../../lib/contact.ts";
import { cityName } from "../../lib/format.ts";
import { useManage } from "../../lib/manage.ts";
import { usePageTitle } from "../../lib/title.ts";
import type { ListingSummary } from "../../lib/types.ts";

/** One square of the owner's photo grid: a link to the listing's editor, marked when it is a draft. */
function OwnerTile(props: { listing: ListingSummary; href: string }) {
  const l = () => props.listing;
  return (
    <li>
      <A
        href={props.href}
        class="group relative block aspect-[3/4] overflow-hidden bg-veil"
        aria-label={l().is_published ? l().title : `${l().title} · ${t("admin.draft")}`}
      >
        <Show
          when={l().photo}
          fallback={
            <span class="flex h-full items-center justify-center p-2 text-center text-xs text-silver-ink">{l().title}</span>
          }
        >
          {(src) => (
            <img src={src()} alt="" loading="lazy" class="h-full w-full object-cover transition-opacity group-hover:opacity-90" />
          )}
        </Show>
        <Show when={!l().is_published}>
          <span aria-hidden="true" class="label absolute left-1.5 top-1.5 bg-white px-1.5 py-0.5 tracking-normal text-ink">
            {t("admin.draft")}
          </span>
        </Show>
      </A>
    </li>
  );
}

/** "My shop": the owner's shop as brides see it, with Edit profile, New listing and a grid of every listing. */
export default function MyShop() {
  usePageTitle(() => t("myshop.title"));
  const [me, { refetch }] = createResource(() => ownerApi.owner.me());
  const m = useManage();
  const [listings, listingList] = createResource(() => ownerApi.owner.listings());
  const cities = useCities();
  const shop = () => (me.state === "ready" ? me()?.shop : undefined);
  const city = () => {
    const c = cities().find((x) => x.id === shop()?.city_id);
    return c ? cityName(c, i18n.lang()) : "";
  };
  const href = (l: ListingSummary) => (l.category === "dresses" ? m.dressHref(l.id) : m.itemHref(l.id));

  return (
    <Switch>
      <Match when={me.error}>
        <ErrorState error={me.error} onRetry={() => void refetch()} />
      </Match>
      <Match when={!shop()}>
        <p class="text-silver-ink">{t("common.loading")}</p>
      </Match>
      <Match when={shop()}>
        {(s) => (
          <div>
            <header class="flex flex-col gap-6 sm:flex-row sm:items-center">
              <ShopLogo url={s().logo?.small ?? null} name={s().name} size="xl" />
              <div class="min-w-0 flex-1">
                <p class="label">{[city(), s().address].filter(Boolean).join(" · ")}</p>
                <h1 class="mt-2 break-words text-5xl sm:text-6xl">{s().name}</h1>
                <Show when={s().description}>
                  {(text) => <p class="mt-4 max-w-prose whitespace-pre-line">{text()}</p>}
                </Show>
                <div class="mt-6 flex flex-wrap items-center gap-3">
                  <A href="/shop/profile" class="btn btn-outline">{t("myshop.edit_profile")}</A>
                  <A href={m.newListingHref()} class="btn btn-primary">
                    <PlusIcon />
                    {t("admin.new_listing")}
                  </A>
                  <Show when={s().is_published}>
                    <A href={`/shops/${s().slug}`} class="label border-b border-ink pb-0.5 text-ink">
                      {t("myshop.view_page")}
                    </A>
                  </Show>
                </div>
              </div>
            </header>

            <Show when={!s().is_published}>
              <p class="mt-6 max-w-2xl rounded-lg bg-blush p-4 text-garnet-deep">
                {t("myshop.hidden")}
                <Show when={contactPhone()}>
                  {(p) => (
                    <>
                      {" "}
                      <a href={`tel:${p().replace(/\s/g, "")}`} class="font-semibold text-garnet">
                        {p()}
                      </a>
                    </>
                  )}
                </Show>
              </p>
            </Show>

            <section class="mt-10" aria-labelledby="my-listings-title">
              <h2 id="my-listings-title" class="label border-t border-line pt-6">{t("myshop.dresses")}</h2>
              <div class="mt-4">
                <Switch>
                  <Match when={listings.error}>
                    <ErrorState error={listings.error} onRetry={() => void listingList.refetch()} />
                  </Match>
                  <Match when={!listings()}>
                    <p class="text-silver-ink">{t("common.loading")}</p>
                  </Match>
                  <Match when={listings()?.length === 0}>
                    <p class="max-w-2xl rounded-lg bg-white p-5 text-silver-ink">{t("myshop.no_dresses")}</p>
                  </Match>
                  <Match when={listings()}>
                    {(list) => (
                      <ul class="grid grid-cols-3 gap-1 md:grid-cols-4 md:gap-2">
                        <For each={list()}>{(l) => <OwnerTile listing={l} href={href(l)} />}</For>
                      </ul>
                    )}
                  </Match>
                </Switch>
              </div>
            </section>
          </div>
        )}
      </Match>
    </Switch>
  );
}
```

- [ ] **Step 4: Add the route**

In `frontend/src/main.tsx`, replace:
```tsx
const MyShop = lazy(() => import("./pages/shop/MyShop.tsx"));
```
with:
```tsx
const MyShop = lazy(() => import("./pages/shop/MyShop.tsx"));
const ShopProfile = lazy(() => import("./pages/shop/ShopProfile.tsx"));
```

In `frontend/src/main.tsx`, replace:
```tsx
        <Route path="/" component={MyShop} />
```
with:
```tsx
        <Route path="/" component={MyShop} />
        <Route path="/profile" component={ShopProfile} />
```

- [ ] **Step 5: Check, test and build**

Run, from `frontend/`: `deno task check`, then `deno task test`, then `deno task build`.
Expected: no check errors; every test passes, including the i18n parity test that now sees `myshop.edit_profile` in all three files; the build ends with `✓ built`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/shop/MyShop.tsx frontend/src/pages/shop/ShopProfile.tsx frontend/src/main.tsx frontend/src/i18n/en.json frontend/src/i18n/ru.json frontend/src/i18n/tk.json
git commit -m "feat(frontend): My shop as an Instagram-style profile with a separate Edit profile page"
```
(End the message with the trailer line the controller gives you.)

---

## Final verification (controller)

The controller does this in headless Chrome against a server built from the branch. It uses the **test** database and demo data only, never `wedding_dev`, and deletes every row it created afterwards.

1. **Screenshots:**
   - At 320, 375, 768, 1024 and 1280px in tk, ru and en.
   - Pages:
     - `/search` with a category, city, price and a category filter;
     - a dress page and an item page;
     - `/shop` and `/shop/profile`, signed in as a demo owner;
     - an owner edit page and an admin edit page;
     - a public shop page.
   - There must be no sideways overflow and no page errors.
2. **Contrast:** the script finds no problems on those pages.
3. **Behaviour:**
   - **Search:** the chips, city and filters round-trip through the URL, and changing the category drops the old category's filters.
   - **Dress page:** on phones the only visible Call is the fixed bar; on desktop the shop box shows Call and the calendar sits under the photo.
   - **My shop:** the tiles link to `/shop/dresses/:id` and `/shop/items/:id`, and drafts read "… · Draft".
   - **Edit profile:** saving works, and Back shows the new details on `/shop`.
   - **Public shop page:** it has no Edit button and its tiles open the public pages.
4. **Regression:**
   - owner sign-up, then My shop, then the new dress form;
   - the admin shops, listings and item pages;
   - the behaviour script from the redesign.

## Spec coverage

| Spec | Where |
|---|---|
| §3 Search: header, city, filters, chips, URL, helper tests | Task 2 |
| §4 Dress and item pages: phone Call, layout B | Task 3 |
| §5 Edit pages, two columns | Task 4 (Back button: Task 1) |
| §6 My shop and Edit profile | Task 5 |
| §7 Button corners and borders | Task 1 |
| §8 New texts | Task 5 (only `myshop.edit_profile` is new; the box headings reuse `myshop.details` and the logo upload's heading) |
| §10 Testing | Task 2 (`search_test.ts`), Final verification |

## Changes made during review

- **Task 1:** the step text wrongly said `DressEdit` and `ItemEdit` still used `A`. Task 4's whole-file code drops the unused import (plan commit cc8bb00).
- **Task 2:** the Search city `<select>` showed "All cities" on a fresh load of `?city=…`, because the cities load after the first render. Every option now also sets `selected=`, like the sheet's `CityField`. `ItemFilterSheet`'s doc comment was updated, and the test also checks that a min-type filter is dropped (fix 40117fe).
- **Task 5:** the "Draft" label (`.label`, 0.28em tracking) was clipped in 93px tiles at 320px in tk and ru. It gets `tracking-normal` (fix 8e9a20c).
- **Final review (fix b9446f9):**
  - No-photo tiles were invisible on the `bg-veil` My shop page; they are now `bg-white`.
  - The city appeared twice on Search. `ItemFilterSheet` gets `hideCity`: Search's sheet has no city field, keeps the city on Reset, and the Filters badge counts only the sheet's filters.
  - Search's empty state offers Clear filters, like the category page.
  - The admin set-password test now sets an exactly 6-character password.
- **Left for later**, triaged as fine:
  - an unknown `?city=` slug shows "All cities";
  - an empty `ContactButtons` grid on phones for shops with no social links;
  - the 16px "See your shop page" link;
  - the city label appearing once cities load.
- **Security note:** owner sign-in is limited per IP only, and the sign-in phone is public. A per-phone limiter or a short list of banned common passwords would offset the shorter 6-character minimum.

