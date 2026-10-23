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
