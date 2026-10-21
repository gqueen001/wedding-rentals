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
    <div class="pt-8">
      <h1 class="text-4xl">{t("search.title")}</h1>
      <div class="mt-6">
        <SearchBox value={params().q} onSearch={(q) => navigate(href(q, params().category))} />
      </div>
      <nav class="mt-4 flex flex-wrap gap-2" aria-label={t("home.categories")}>
        {chip("", t("search.all"))}
        <For each={CATEGORIES}>{(c) => chip(c.slug, tr(catLabel(c.slug)))}</For>
      </nav>
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
