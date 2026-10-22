import { Navigate, useParams } from "@solidjs/router";
import { createResource, Match, Show, Switch } from "solid-js";
import AttributeList from "../components/AttributeList.tsx";
import Availability from "../components/Availability.tsx";
import ErrorState from "../components/ErrorState.tsx";
import { FavoriteButton } from "../components/FavoriteButton.tsx";
import Gallery from "../components/Gallery.tsx";
import { priceText } from "../components/price.ts";
import ShareButton from "../components/ShareButton.tsx";
import ShopCardSection from "../components/ShopCard.tsx";
import { DetailSkeleton } from "../components/Skeleton.tsx";
import { t } from "../i18n/i18n.ts";
import { api } from "../lib/client.ts";
import { isNotFound } from "../lib/errors.ts";
import { usePageTitle } from "../lib/title.ts";
import type { PublicItem } from "../lib/types.ts";
import NotFound from "./NotFound.tsx";

function ItemView(props: { item: PublicItem }) {
  const it = () => props.item;
  return (
    <article class="pt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-12 lg:pt-8">
      <Gallery images={it().images} title={it().title} />
      <div class="mt-6 lg:mt-0">
        <h1 class="text-4xl sm:text-5xl">{it().title}</h1>
        <p class="mt-3 text-2xl font-semibold text-garnet">{priceText(it())}</p>
        <div class="mt-5 flex flex-wrap items-center gap-3">
          <FavoriteButton id={it().id} />
          <ShareButton title={it().title} />
        </div>

        <div class="mt-8">
          <AttributeList category={it().category} attributes={it().attributes} />
        </div>

        <Show when={it().description}>
          {(text) => (
            <section class="mt-8">
              <h2 class="text-xl">{t("item.about")}</h2>
              <p class="mt-2 max-w-prose whitespace-pre-line">{text()}</p>
            </section>
          )}
        </Show>

        <div class="mt-10">
          <Availability listingId={it().id} />
        </div>

        <div class="mt-10">
          <ShopCardSection shop={it().shop} />
        </div>
      </div>
    </article>
  );
}

/** /items/:id: any category's page; a dress opened here goes to its own /dresses/:id page. */
export default function Item() {
  const params = useParams();
  const [item, { refetch }] = createResource(() => params.id, (id) => api.item(id));
  usePageTitle(() => (item.state === "ready" ? item()?.title : undefined));

  return (
    <Switch>
      <Match when={item.error}>
        <Show when={isNotFound(item.error)} fallback={<ErrorState error={item.error} onRetry={refetch} />}>
          <NotFound />
        </Show>
      </Match>
      <Match when={!item()}>
        <DetailSkeleton />
      </Match>
      <Match when={item()?.category === "dresses"}>
        <Navigate href={`/dresses/${item()!.id}`} />
      </Match>
      <Match when={item()} keyed>{(it) => <ItemView item={it} />}</Match>
    </Switch>
  );
}
