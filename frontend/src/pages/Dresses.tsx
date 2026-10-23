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
