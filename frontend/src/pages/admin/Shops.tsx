import { A } from "@solidjs/router";
import { createResource, For, Match, Switch } from "solid-js";
import StatusBadge from "../../components/admin/StatusBadge.tsx";
import ErrorState from "../../components/ErrorState.tsx";
import { PlusIcon } from "../../components/icons.tsx";
import ShopLogo from "../../components/ShopLogo.tsx";
import { i18n, t } from "../../i18n/i18n.ts";
import { useCities } from "../../lib/cities.ts";
import { api } from "../../lib/client.ts";
import { cityName } from "../../lib/format.ts";
import { usePageTitle } from "../../lib/title.ts";

export default function AdminShops() {
  usePageTitle(() => t("admin.shops"));
  const [shops, { refetch }] = createResource(() => api.admin.shops());
  const cities = useCities();
  const city = (id: number) => {
    const c = cities().find((x) => x.id === id);
    return c ? cityName(c, i18n.lang()) : "";
  };
  return (
    <div>
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-3xl">{t("admin.shops")}</h1>
        <A href="/admin/shops/new" class="btn btn-primary ml-auto">
          <PlusIcon />
          {t("admin.new_shop")}
        </A>
      </div>
      <div class="mt-6">
        <Switch>
          <Match when={shops.error}>
            <ErrorState error={shops.error} onRetry={refetch} />
          </Match>
          <Match when={!shops()}>
            <p class="text-silver-ink">{t("common.loading")}</p>
          </Match>
          <Match when={shops()?.length === 0}>
            <p class="text-silver-ink">{t("admin.empty_shops")}</p>
          </Match>
          <Match when={shops()}>
            {(list) => (
              <ul class="divide-y divide-veil overflow-hidden rounded-lg bg-white">
                <For each={list()}>
                  {(s) => (
                    <li>
                      <A href={`/admin/shops/${s.id}`} class="flex items-center gap-4 px-4 py-3 hover:bg-veil/60">
                        <ShopLogo url={s.logo?.small ?? null} name={s.name} size="sm" />
                        <div class="min-w-0 flex-1">
                          <p class="truncate font-semibold">{s.name}</p>
                          <p class="truncate text-sm text-silver-ink">{city(s.city_id)}</p>
                        </div>
                        <StatusBadge published={s.is_published} />
                      </A>
                    </li>
                  )}
                </For>
              </ul>
            )}
          </Match>
        </Switch>
      </div>
    </div>
  );
}
