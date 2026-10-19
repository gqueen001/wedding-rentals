import { A, useSearchParams } from "@solidjs/router";
import { createResource, For, Match, Show, Switch } from "solid-js";
import StatusBadge from "../../components/admin/StatusBadge.tsx";
import ErrorState from "../../components/ErrorState.tsx";
import { PlusIcon } from "../../components/icons.tsx";
import { priceText } from "../../components/price.ts";
import { t } from "../../i18n/i18n.ts";
import { api } from "../../lib/client.ts";
import { firstParam } from "../../lib/forms.ts";
import { usePageTitle } from "../../lib/title.ts";

export default function AdminDresses() {
  usePageTitle(() => t("admin.dresses"));
  const [search, setSearch] = useSearchParams();
  const shopId = () => Number(firstParam(search.shop_id)) || 0;
  const [shops] = createResource(() => api.admin.shops());
  // The source is an object so "all shops" (0) still fetches.
  const [dresses, { refetch }] = createResource(() => ({ shop: shopId() }), (s) => api.admin.dresses(s.shop || undefined));
  const shopList = () => (shops.state === "ready" ? shops() ?? [] : []);
  const shopName = (id: number) => shopList().find((s) => s.id === id)?.name ?? "";

  return (
    <div>
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-3xl">{t("admin.dresses")}</h1>
        <select
          class="field-input w-auto"
          aria-label={t("admin.shop")}
          value={shopId() ? String(shopId()) : ""}
          onChange={(e) => setSearch({ shop_id: e.currentTarget.value || undefined })}
        >
          <option value="">{t("admin.all_shops")}</option>
          <For each={shopList()}>{(s) => <option value={String(s.id)}>{s.name}</option>}</For>
        </select>
        <A
          href={shopId() ? `/admin/dresses/new?shop_id=${shopId()}` : "/admin/dresses/new"}
          class="btn btn-primary ml-auto"
        >
          <PlusIcon />
          {t("admin.new_dress")}
        </A>
      </div>
      <div class="mt-6">
        <Switch>
          <Match when={dresses.error}>
            <ErrorState error={dresses.error} onRetry={refetch} />
          </Match>
          <Match when={!dresses()}>
            <p class="text-silver-ink">{t("common.loading")}</p>
          </Match>
          <Match when={dresses()?.length === 0}>
            <p class="text-silver-ink">{t("admin.empty_dresses")}</p>
          </Match>
          <Match when={dresses()}>
            {(list) => (
              <ul class="divide-y divide-veil overflow-hidden rounded-lg bg-white">
                <For each={list()}>
                  {(d) => (
                    <li>
                      <A href={`/admin/dresses/${d.id}`} class="flex items-center gap-4 px-4 py-3 hover:bg-veil/60">
                        <div class="h-16 w-12 shrink-0 overflow-hidden rounded-sm bg-veil">
                          <Show when={d.images[0]}>
                            {(img) => <img src={img().small} alt="" class="h-full w-full object-cover" />}
                          </Show>
                        </div>
                        <div class="min-w-0 flex-1">
                          <p class="truncate font-semibold">{d.title}</p>
                          <p class="truncate text-sm text-silver-ink">{shopName(d.shop_id)}</p>
                          <p class="text-sm text-garnet">{priceText(d)}</p>
                        </div>
                        <StatusBadge published={d.is_published} />
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
