import { useLocation, useNavigate, useParams } from "@solidjs/router";
import { createMemo, createSignal, Match, Show, Switch } from "solid-js";
import EmptyState from "../components/EmptyState.tsx";
import ErrorState from "../components/ErrorState.tsx";
import { FilterIcon } from "../components/icons.tsx";
import ItemFilterSheet from "../components/ItemFilterSheet.tsx";
import ListingGrid from "../components/ListingGrid.tsx";
import LoadMore from "../components/LoadMore.tsx";
import SearchBox from "../components/SearchBox.tsx";
import { GridSkeleton } from "../components/Skeleton.tsx";
import { t, tr } from "../i18n/i18n.ts";
import { type CategoryDef, categoryDef, catLabel } from "../lib/catalog.ts";
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
  const firstLoad = () => list.items().length === 0;

  return (
    <div class="pt-8">
      <h1 class="text-4xl">{tr(catLabel(c.slug))}</h1>
      <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div class="flex-1">
          <SearchBox value={filters().q} onSearch={(q) => apply({ ...filters(), q })} />
        </div>
        <button
          type="button"
          class="btn btn-outline"
          classList={{ "border-garnet text-garnet-deep": active() > 0 }}
          aria-haspopup="dialog"
          onClick={() => setSheetOpen(true)}
        >
          <FilterIcon />
          {active() > 0 ? t("dresses.filters_active", { count: active() }) : t("dresses.filters")}
        </button>
      </div>
      <p class="mt-4 min-h-6 text-sm text-silver-ink" aria-live="polite">
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
