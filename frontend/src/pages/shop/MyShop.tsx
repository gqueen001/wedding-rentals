import { A } from "@solidjs/router";
import { createEffect, createMemo, createResource, createSignal, Match, on, Show, Switch } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { FormActions } from "../../components/admin/Field.tsx";
import LogoUpload from "../../components/admin/LogoUpload.tsx";
import ShopFields from "../../components/admin/ShopFields.tsx";
import ListingList from "../../components/admin/ListingList.tsx";
import ErrorState from "../../components/ErrorState.tsx";
import { PlusIcon } from "../../components/icons.tsx";
import { t } from "../../i18n/i18n.ts";
import { ownerApi } from "../../lib/client.ts";
import { contactPhone } from "../../lib/contact.ts";
import { validationFields } from "../../lib/errors.ts";
import { cleanShopInput, EMPTY_SHOP_INPUT, shopToInput } from "../../lib/forms.ts";
import { useManage } from "../../lib/manage.ts";
import { usePageTitle } from "../../lib/title.ts";
import type { ShopInput } from "../../lib/types.ts";

/** "My shop": the owner's listings and shop details. */
export default function MyShop() {
  usePageTitle(() => t("myshop.title"));
  const [me, { mutate, refetch }] = createResource(() => ownerApi.owner.me());
  const m = useManage();
  const [listings, listingList] = createResource(() => ownerApi.owner.listings());
  const shop = () => (me.state === "ready" ? me()?.shop : undefined);
  const [form, setForm] = createStore<ShopInput>({ ...EMPTY_SHOP_INPUT, aliases: [] });
  // Refill the form only when the saved shop changes, not when just its logo does.
  const stamp = createMemo(() => shop()?.updated_at);
  createEffect(on(stamp, (stamp) => {
    const s = shop();
    if (stamp && s) setForm(reconcile(shopToInput(s)));
  }));
  const [errors, setErrors] = createSignal<Record<string, string>>({});
  const [error, setError] = createSignal<unknown>(null);
  const [saving, setSaving] = createSignal(false);
  const [saved, setSaved] = createSignal(false);

  async function save(e: SubmitEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setErrors({});
    setError(null);
    try {
      const result = await ownerApi.owner.updateShop(
        cleanShopInput({ ...form, aliases: [...form.aliases] }),
      );
      setSaved(true);
      mutate((prev) => (prev ? { ...prev, shop: result } : prev));
    } catch (e) {
      setErrors(validationFields(e));
      setError(() => e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Switch>
      <Match when={me.error}>
        <ErrorState error={me.error} onRetry={() => void refetch()} />
      </Match>
      <Match when={!shop()}>
        <p class="text-silver-ink">{t("common.loading")}</p>
      </Match>
      <Match when={shop()}>
        {(s) => (
          <div class="max-w-2xl">
            <h1 class="text-3xl">{s().name}</h1>
            <p class="mt-1 text-sm text-silver-ink">{t("owner.phone")}: {me()?.phone}</p>
            <Show
              when={s().is_published}
              fallback={
                <p class="mt-4 rounded-lg bg-blush p-4 text-garnet-deep">
                  {t("myshop.hidden")}
                  <Show when={contactPhone()}>
                    {(p) => (
                      <>
                        {" "}
                        <a href={`tel:${p().replace(/\s/g, "")}`} class="font-semibold text-garnet">
                          {p()}
                        </a>
                      </>
                    )}
                  </Show>
                </p>
              }
            >
              <A
                href={`/shops/${s().slug}`}
                class="mt-2 inline-block text-sm font-semibold text-garnet"
              >
                {t("myshop.view_page")}
              </A>
            </Show>

            <section class="mt-8">
              <div class="flex flex-wrap items-center gap-3">
                <h2 class="text-2xl">{t("myshop.dresses")}</h2>
                <A href={m.newListingHref()} class="btn btn-primary ml-auto">
                  <PlusIcon />
                  {t("admin.new_listing")}
                </A>
              </div>
              <div class="mt-4">
                <Switch>
                  <Match when={listings.error}>
                    <ErrorState error={listings.error} onRetry={() => void listingList.refetch()} />
                  </Match>
                  <Match when={!listings()}>
                    <p class="text-silver-ink">{t("common.loading")}</p>
                  </Match>
                  <Match when={listings()?.length === 0}>
                    <p class="rounded-lg bg-white p-5 text-silver-ink">{t("myshop.no_dresses")}</p>
                  </Match>
                  <Match when={listings()}>{(list) => <ListingList items={list()} />}</Match>
                </Switch>
              </div>
            </section>

            <section class="mt-10">
              <h2 class="text-2xl">{t("myshop.details")}</h2>
              <form class="mt-4 space-y-5 rounded-lg bg-white p-5" novalidate onSubmit={save}>
                <ShopFields form={form} setForm={setForm} errors={errors()} />
                <FormActions saving={saving()} saved={saved()} error={error()} />
              </form>
              <div class="mt-6 rounded-lg bg-white p-5">
                <LogoUpload
                  shopId={s().id}
                  name={s().name}
                  logo={s().logo}
                  onUploaded={(logo) =>
                    mutate((prev) => (prev ? { ...prev, shop: { ...prev.shop, logo } } : prev))}
                />
              </div>
            </section>
          </div>
        )}
      </Match>
    </Switch>
  );
}
