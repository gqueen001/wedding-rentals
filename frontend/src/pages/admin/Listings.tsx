import { A, useSearchParams } from "@solidjs/router";
import { createResource, For, Match, Switch } from "solid-js";
import ListingList from "../../components/admin/ListingList.tsx";
import ErrorState from "../../components/ErrorState.tsx";
import { PlusIcon } from "../../components/icons.tsx";
import { t, tr } from "../../i18n/i18n.ts";
import { CATEGORIES, catLabel, categoryDef } from "../../lib/catalog.ts";
import { api } from "../../lib/client.ts";
import { firstParam } from "../../lib/forms.ts";
import { useManage } from "../../lib/manage.ts";
import { usePageTitle } from "../../lib/title.ts";

/** The admin's listings of every shop and category, filtered by ?shop_id= and ?category=. */
export default function AdminListings() {
  usePageTitle(() => t("admin.listings"));
  const m = useManage();
  const [search, setSearch] = useSearchParams();
  const shopId = () => Number(firstParam(search.shop_id)) || 0;
  const category = () => (categoryDef(firstParam(search.category)) ? firstParam(search.category) : "");
  const [shops] = createResource(() => api.admin.shops());
  // The source is an object so "all shops" (0) still fetches.
  const [listings, { refetch }] = createResource(
    () => ({ shop: shopId(), category: category() }),
    (f) => m.calls.listings({ shopId: f.shop || undefined, category: f.category || undefined }),
  );
  const shopList = () => (shops.state === "ready" ? shops() ?? [] : []);
  const shopName = (id: number) => shopList().find((s) => s.id === id)?.name ?? "";

  return (
    <div>
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-3xl">{t("admin.listings")}</h1>
        <select
          class="field-input w-auto"
          aria-label={t("admin.shop")}
          value={shopId() ? String(shopId()) : ""}
          onChange={(e) => setSearch({ shop_id: e.currentTarget.value || undefined })}
        >
          <option value="" selected={!shopId()}>{t("admin.all_shops")}</option>
          <For each={shopList()}>{(s) => <option value={String(s.id)} selected={s.id === shopId()}>{s.name}</option>}</For>
        </select>
        <select
          class="field-input w-auto"
          aria-label={t("admin.category")}
          value={category()}
          onChange={(e) => setSearch({ category: e.currentTarget.value || undefined })}
        >
          <option value="" selected={!category()}>{t("admin.all_categories")}</option>
          <For each={CATEGORIES}>
            {(c) => <option value={c.slug} selected={c.slug === category()}>{tr(catLabel(c.slug))}</option>}
          </For>
        </select>
        <A href={m.newListingHref(shopId() || undefined)} class="btn btn-primary ml-auto">
          <PlusIcon />
          {t("admin.new_listing")}
        </A>
      </div>
      <div class="mt-6">
        <Switch>
          <Match when={listings.error}>
            <ErrorState error={listings.error} onRetry={refetch} />
          </Match>
          <Match when={!listings()}>
            <p class="text-silver-ink">{t("common.loading")}</p>
          </Match>
          <Match when={listings()?.length === 0}>
            <p class="text-silver-ink">{t("admin.empty_listings")}</p>
          </Match>
          <Match when={listings()}>{(list) => <ListingList items={list()} shopName={shopName} />}</Match>
        </Switch>
      </div>
    </div>
  );
}
