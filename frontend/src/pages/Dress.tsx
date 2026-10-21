import { useParams } from "@solidjs/router";
import { createResource, For, Match, Show, Switch } from "solid-js";
import Availability from "../components/Availability.tsx";
import ColorSwatch from "../components/ColorSwatch.tsx";
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
import type { PublicDress } from "../lib/types.ts";
import NotFound from "./NotFound.tsx";

function DressView(props: { dress: PublicDress }) {
  const d = () => props.dress;
  return (
    <article class="pt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-12 lg:pt-8">
      <Gallery images={d().images} title={d().title} />
      <div class="mt-6 lg:mt-0">
        <h1 class="text-4xl sm:text-5xl">{d().title}</h1>
        <p class="mt-3 text-2xl font-semibold text-garnet">{priceText(d())}</p>
        <div class="mt-5 flex flex-wrap items-center gap-3">
          <FavoriteButton id={d().id} />
          <ShareButton title={d().title} />
        </div>

        <dl class="mt-8 grid grid-cols-[max-content_1fr] items-center gap-x-6 gap-y-3 text-sm">
          <dt class="text-silver-ink">{t("dress.sizes")}</dt>
          <dd class="flex flex-wrap gap-1.5">
            <For each={d().sizes}>
              {(size) => (
                <span class="rounded-full border border-silver px-2.5 py-0.5 text-xs font-semibold">{size}</span>
              )}
            </For>
          </dd>
          <dt class="text-silver-ink">{t("dress.color")}</dt>
          <dd class="flex items-center gap-2">
            <ColorSwatch color={d().color} />
            {t(`color.${d().color}`)}
          </dd>
          <dt class="text-silver-ink">{t("dress.style")}</dt>
          <dd>{t(`silhouette.${d().silhouette}`)}</dd>
          <dt class="text-silver-ink">{t("dress.sleeves")}</dt>
          <dd>{t(`sleeves.${d().sleeves}`)}</dd>
        </dl>

        <Show when={d().description}>
          {(text) => (
            <section class="mt-8">
              <h2 class="text-xl">{t("dress.about")}</h2>
              <p class="mt-2 max-w-prose whitespace-pre-line">{text()}</p>
            </section>
          )}
        </Show>

        <div class="mt-10">
          <Availability dressId={d().id} />
        </div>

        <div class="mt-10">
          <ShopCardSection shop={d().shop} />
        </div>
      </div>
    </article>
  );
}

export default function Dress() {
  const params = useParams();
  const [dress, { refetch }] = createResource(() => params.id, (id) => api.dress(id));
  usePageTitle(() => (dress.state === "ready" ? dress()?.title : undefined));

  return (
    <Switch>
      <Match when={dress.error}>
        <Show when={isNotFound(dress.error)} fallback={<ErrorState error={dress.error} onRetry={refetch} />}>
          <NotFound />
        </Show>
      </Match>
      <Match when={!dress()}>
        <DetailSkeleton />
      </Match>
      <Match when={dress()} keyed>{(d) => <DressView dress={d} />}</Match>
    </Switch>
  );
}
