import { A } from "@solidjs/router";
import { createEffect, createResource, Match, Switch, untrack } from "solid-js";
import ListingGrid from "../components/ListingGrid.tsx";
import EmptyState from "../components/EmptyState.tsx";
import ErrorState from "../components/ErrorState.tsx";
import { GridSkeleton } from "../components/Skeleton.tsx";
import { t } from "../i18n/i18n.ts";
import { api } from "../lib/client.ts";
import { favorites, MAX_FAVORITES } from "../lib/favorites.ts";
import { usePageTitle } from "../lib/title.ts";
import type { ListItem, Page } from "../lib/types.ts";

export default function Favorites() {
  usePageTitle(() => t("favorites.title"));
  // Fetch once with the ids saved on this device; unhearting here only hides the tile.
  const [page, { refetch }] = createResource((): Promise<Page | null> => {
    const ids = untrack(favorites.ids);
    if (ids.length === 0) return Promise.resolve(null);
    return api.items(new URLSearchParams({ ids: ids.join(","), per_page: String(MAX_FAVORITES) }));
  });

  // Ids that the API no longer returns (deleted or unpublished) are dropped silently.
  createEffect(() => {
    const p = page.state === "ready" ? page() : null;
    if (p) untrack(() => favorites.keepOnly(p.items.map((i) => i.id)));
  });

  // Newest favorite first, the same order as on the device.
  const visible = (): ListItem[] => {
    const p = page.state === "ready" ? page() : null;
    if (!p) return [];
    const byId = new Map(p.items.map((i) => [i.id, i]));
    return favorites.ids().flatMap((id) => byId.get(id) ?? []);
  };

  return (
    <div class="pt-6">
      <p class="label">{t("app.name")}</p>
      <h1 class="mt-2 text-5xl sm:text-6xl">{t("favorites.title")}</h1>
      <p class="mt-2 text-sm text-silver-ink">{t("favorites.device_note")}</p>
      <div class="mt-6">
        <Switch>
          <Match when={page.error}>
            <ErrorState error={page.error} onRetry={refetch} />
          </Match>
          <Match when={page.loading}>
            <GridSkeleton count={Math.min(favorites.ids().length, 8)} />
          </Match>
          <Match when={visible().length === 0}>
            <EmptyState title={t("favorites.empty_title")} body={t("favorites.empty_body")}>
              <A href="/" class="btn btn-primary">{t("favorites.browse")}</A>
            </EmptyState>
          </Match>
          <Match when={visible().length > 0}>
            <ListingGrid items={visible()} />
          </Match>
        </Switch>
      </div>
    </div>
  );
}
