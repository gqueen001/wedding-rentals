import { useParams } from "@solidjs/router";
import { createResource, For, Match, Show, Switch } from "solid-js";
import ColorSwatch from "../components/ColorSwatch.tsx";
import ErrorState from "../components/ErrorState.tsx";
import ListingDetail from "../components/ListingDetail.tsx";
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
    <ListingDetail
      listing={d()}
      kicker={`${t("cat.dresses")} · ${d().shop.name}`}
      about={t("dress.about")}
      details={
        <dl class="grid grid-cols-[max-content_1fr] items-center gap-x-6 gap-y-3 text-sm">
          <dt class="label">{t("dress.sizes")}</dt>
          <dd class="flex flex-wrap gap-1.5">
            <For each={d().sizes}>
              {(size) => <span class="border border-silver px-2.5 py-0.5 text-xs font-semibold">{size}</span>}
            </For>
          </dd>
          <dt class="label">{t("dress.color")}</dt>
          <dd class="flex items-center gap-2">
            <ColorSwatch color={d().color} />
            {t(`color.${d().color}`)}
          </dd>
          <dt class="label">{t("dress.style")}</dt>
          <dd>{t(`silhouette.${d().silhouette}`)}</dd>
          <dt class="label">{t("dress.sleeves")}</dt>
          <dd>{t(`sleeves.${d().sleeves}`)}</dd>
        </dl>
      }
    />
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
