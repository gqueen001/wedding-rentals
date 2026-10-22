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
          <div class="pt-8">
            <header class="flex flex-col gap-6 sm:flex-row sm:items-start">
              <ShopLogo url={shop().logo} name={shop().name} size="lg" />
              <div class="min-w-0 flex-1">
                <h1 class="text-4xl sm:text-5xl">{shop().name}</h1>
                <p class="mt-1 text-silver-ink">
                  {cityName(shop().city, i18n.lang())}, {shop().address}
                </p>
                <Show when={shop().description}>
                  {(text) => <p class="mt-4 max-w-prose whitespace-pre-line">{text()}</p>}
                </Show>
                <div class="mt-6 max-w-xl">
                  <ContactButtons shop={shop()} />
                </div>
              </div>
            </header>

            <section class="mt-12" aria-labelledby="shop-dresses-title">
              <h2 id="shop-dresses-title" class="mb-6 text-3xl">{t("shop.listings")}</h2>
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
