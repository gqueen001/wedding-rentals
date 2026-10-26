import { A, useLocation, useNavigate } from "@solidjs/router";
import { createMemo, For, Match, Switch } from "solid-js";
import ErrorState from "../components/ErrorState.tsx";
import LoadMore from "../components/LoadMore.tsx";
import SearchBox from "../components/SearchBox.tsx";
import ShopLogo from "../components/ShopLogo.tsx";
import { ChevronRightIcon } from "../components/icons.tsx";
import { i18n, t, tr } from "../i18n/i18n.ts";
import { CATEGORIES, catLabel, categoryHref } from "../lib/catalog.ts";
import { api } from "../lib/client.ts";
import { cityName } from "../lib/format.ts";
import { createRememberedList, type ListMemory } from "../lib/rememberedList.ts";
import { usePageTitle } from "../lib/title.ts";
import type { ShopSummary } from "../lib/types.ts";

const PER_PAGE = "24";
const memory: ListMemory<ShopSummary> = {};

/** One salon: its logo, name, city and how many listings it has; it opens the salon's page. */
function SalonRow(props: { shop: ShopSummary }) {
  return (
    <li class="border-b border-line">
      <A href={`/shops/${props.shop.slug}`} class="flex items-center gap-4 py-3 hover:text-garnet">
        <ShopLogo url={props.shop.logo} name={props.shop.name} />
        <span class="min-w-0 flex-1">
          <span class="block truncate font-display text-2xl leading-tight sm:text-3xl">{props.shop.name}</span>
          <span class="label mt-1 block">
            {cityName(props.shop.city, i18n.lang())} · {t("categories.count", { count: props.shop.listing_count })}
          </span>
        </span>
        <ChevronRightIcon class="h-5 w-5 shrink-0 text-silver-ink" />
      </A>
    </li>
  );
}

/** /search?q=: the salons whose name matches, or every salon A to Z when nothing is typed. */
export default function Search() {
  usePageTitle(() => t("search.title"));
  const location = useLocation();
  const navigate = useNavigate();
  const q = createMemo(() => (new URLSearchParams(location.search).get("q") ?? "").trim());
  const list = createRememberedList(memory, q, (page) =>
    api.shops(new URLSearchParams({ ...(q() ? { q: q() } : {}), page: String(page), per_page: PER_PAGE })));
  const firstLoad = () => list.items().length === 0;

  return (
    <div class="pt-6">
      <p class="label">{t("search.title")}</p>
      <h1 class="mt-2 text-5xl sm:text-6xl">{t("search.salons")}</h1>
      <div class="mt-5 max-w-xl">
        <SearchBox
          value={q()}
          onSearch={(text) => navigate(text ? `/search?${new URLSearchParams({ q: text })}` : "/search")}
          label={t("search.salon_label")}
          placeholder={t("search.salon_placeholder")}
        />
      </div>
      <div class="mt-4 max-w-2xl">
        <Switch>
          <Match when={firstLoad() && list.error() !== null}>
            <ErrorState error={list.error()} onRetry={() => void list.retry()} />
          </Match>
          <Match when={firstLoad() && list.loading()}>
            <ul aria-busy="true" aria-label={t("common.loading")}>
              <For each={[0, 1, 2, 3, 4]}>
                {() => <li class="my-3 h-14 animate-pulse rounded-lg bg-veil" />}
              </For>
            </ul>
          </Match>
          <Match when={firstLoad()}>
            {/* Nothing matched (usually a product word): offer the categories instead. */}
            <div class="py-10 text-center">
              <h2 class="text-3xl">{t("search.no_salons")}</h2>
              <p class="mt-2 text-silver-ink">{t("search.no_salons_body")}</p>
              <nav class="mt-5 flex flex-wrap justify-center gap-2" aria-label={t("home.categories")}>
                <For each={CATEGORIES}>{(c) => <A href={categoryHref(c.slug)} class="chip">{tr(catLabel(c.slug))}</A>}</For>
              </nav>
            </div>
          </Match>
          <Match when={!firstLoad()}>
            <ul class="border-t border-line">
              <For each={list.items()}>{(shop) => <SalonRow shop={shop} />}</For>
            </ul>
            <LoadMore list={list} />
          </Match>
        </Switch>
      </div>
    </div>
  );
}
