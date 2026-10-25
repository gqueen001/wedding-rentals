import { Navigate, useParams } from "@solidjs/router";
import { createResource, Match, Show, Switch } from "solid-js";
import AttributeList from "../components/AttributeList.tsx";
import ErrorState from "../components/ErrorState.tsx";
import ListingDetail from "../components/ListingDetail.tsx";
import { DetailSkeleton } from "../components/Skeleton.tsx";
import { tr } from "../i18n/i18n.ts";
import { catLabel } from "../lib/catalog.ts";
import { api } from "../lib/client.ts";
import { isNotFound } from "../lib/errors.ts";
import { usePageTitle } from "../lib/title.ts";
import type { PublicItem } from "../lib/types.ts";
import NotFound from "./NotFound.tsx";

function ItemView(props: { item: PublicItem }) {
  const it = () => props.item;
  return (
    <ListingDetail
      listing={it()}
      kicker={`${tr(catLabel(it().category))} · ${it().shop.name}`}
      about={tr("item.about")}
      details={<AttributeList category={it().category} attributes={it().attributes} />}
    />
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
