import { useLocation, useNavigate } from "@solidjs/router";
import { createEffect, createMemo, createSignal, Match, on, Show, Switch } from "solid-js";
import DressGrid from "../components/DressGrid.tsx";
import EmptyState from "../components/EmptyState.tsx";
import ErrorState from "../components/ErrorState.tsx";
import FilterSheet from "../components/FilterSheet.tsx";
import { FilterIcon } from "../components/icons.tsx";
import LoadMore from "../components/LoadMore.tsx";
import SearchBox from "../components/SearchBox.tsx";
import { GridSkeleton } from "../components/Skeleton.tsx";
import { t } from "../i18n/i18n.ts";
import { api } from "../lib/client.ts";
import { countActiveFilters, EMPTY_FILTERS, type Filters, filtersToQuery, parseFilters } from "../lib/filters.ts";
import { createPagedList } from "../lib/paged.ts";
import { usePageTitle } from "../lib/title.ts";

const PER_PAGE = "24";

export default function Dresses() {
  usePageTitle(() => t("dresses.title"));
  const location = useLocation();
  const navigate = useNavigate();
  const filters = createMemo(() => parseFilters(new URLSearchParams(location.search)), EMPTY_FILTERS, {
    equals: (a, b) => filtersToQuery(a).toString() === filtersToQuery(b).toString(),
  });
  const [sheetOpen, setSheetOpen] = createSignal(false);

  const list = createPagedList((page) => {
    const query = filtersToQuery(filters());
    query.set("page", String(page));
    query.set("per_page", PER_PAGE);
    return api.dresses(query);
  });
  createEffect(on(filters, () => void list.reset()));

  const apply = (f: Filters) => {
    setSheetOpen(false);
    const qs = filtersToQuery(f).toString();
    navigate(qs ? `/dresses?${qs}` : "/dresses");
  };
  const active = () => countActiveFilters(filters());
  const firstLoad = () => list.items().length === 0;

  return (
    <div class="pt-8">
      <h1 class="text-4xl">{t("dresses.title")}</h1>
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
            <EmptyState title={t("dresses.empty_title")} body={t("dresses.empty_body")}>
              <button type="button" class="btn btn-outline" onClick={() => apply(EMPTY_FILTERS)}>
                {t("dresses.clear")}
              </button>
            </EmptyState>
          </Match>
          <Match when={!firstLoad()}>
            <DressGrid items={list.items()} />
            <LoadMore list={list} />
          </Match>
        </Switch>
      </div>

      <FilterSheet open={sheetOpen()} value={filters()} onApply={apply} onClose={() => setSheetOpen(false)} />
    </div>
  );
}
