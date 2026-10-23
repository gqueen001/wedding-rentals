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
            <option value="">{t("home.all_cities")}</option>
            <For each={cities()}>{(c) => <option value={c.slug}>{cityName(c, i18n.lang())}</option>}</For>
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
