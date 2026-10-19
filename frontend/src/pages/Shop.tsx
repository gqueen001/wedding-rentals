import { useParams } from "@solidjs/router";
import { createEffect, createSignal, Match, on, Show, Switch } from "solid-js";
import DressGrid from "../components/DressGrid.tsx";
import ErrorState from "../components/ErrorState.tsx";
import LoadMore from "../components/LoadMore.tsx";
import { ContactButtons } from "../components/ShopCard.tsx";
import ShopLogo from "../components/ShopLogo.tsx";
import { DetailSkeleton } from "../components/Skeleton.tsx";
import { i18n, t } from "../i18n/i18n.ts";
import { api } from "../lib/client.ts";
import { isNotFound } from "../lib/errors.ts";
import { cityName } from "../lib/format.ts";
import { createPagedList } from "../lib/paged.ts";
import { usePageTitle } from "../lib/title.ts";
import type { PublicShop } from "../lib/types.ts";
import NotFound from "./NotFound.tsx";

export default function Shop() {
  const params = useParams();
  const [info, setInfo] = createSignal<PublicShop | null>(null);
  const list = createPagedList((page) => {
    const slug = params.slug ?? "";
    return api.shop(slug, new URLSearchParams({ page: String(page), per_page: "24" })).then((s) => {
      // Ignore the details of a shop the user has already left.
      if (page === 1 && slug === params.slug) setInfo(s);
      return s.dresses;
    });
  });
  createEffect(on(() => params.slug, () => {
    setInfo(null);
    void list.reset();
  }));
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
              <h2 id="shop-dresses-title" class="mb-6 text-3xl">{t("shop.dresses")}</h2>
              <Show when={list.items().length > 0} fallback={<p class="text-silver-ink">{t("shop.empty")}</p>}>
                <DressGrid items={list.items()} />
                <LoadMore list={list} />
              </Show>
            </section>
          </div>
        )}
      </Match>
    </Switch>
  );
}
