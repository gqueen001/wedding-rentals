import { createEffect, createMemo, createResource, createSignal, Match, on, Switch } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import BackLink from "../../components/admin/BackLink.tsx";
import { FormActions } from "../../components/admin/Field.tsx";
import LogoUpload from "../../components/admin/LogoUpload.tsx";
import ShopFields from "../../components/admin/ShopFields.tsx";
import ErrorState from "../../components/ErrorState.tsx";
import { t } from "../../i18n/i18n.ts";
import { ownerApi } from "../../lib/client.ts";
import { validationFields } from "../../lib/errors.ts";
import { cleanShopInput, EMPTY_SHOP_INPUT, shopToInput } from "../../lib/forms.ts";
import { usePageTitle } from "../../lib/title.ts";
import type { ShopInput } from "../../lib/types.ts";

/** /shop/profile: "Edit profile", only the shop's details and its logo. */
export default function ShopProfile() {
  usePageTitle(() => t("myshop.edit_profile"));
  const [me, { mutate, refetch }] = createResource(() => ownerApi.owner.me());
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
    <div class="max-w-2xl">
      <BackLink href="/shop" />
      <h1 class="mt-4 text-3xl">{t("myshop.edit_profile")}</h1>
      <Switch>
        <Match when={me.error}>
          <ErrorState error={me.error} onRetry={() => void refetch()} />
        </Match>
        <Match when={!shop()}>
          <p class="mt-6 text-silver-ink">{t("common.loading")}</p>
        </Match>
        <Match when={shop()}>
          {(s) => (
            <>
              <p class="mt-1 text-sm text-silver-ink">{t("owner.phone")}: {me()?.phone}</p>
              <section class="mt-6" aria-labelledby="about-salon-title">
                <h2 id="about-salon-title" class="text-2xl">{t("myshop.details")}</h2>
                <form class="mt-4 space-y-5 rounded-lg bg-white p-5" novalidate onSubmit={save}>
                  <ShopFields form={form} setForm={setForm} errors={errors()} />
                  <FormActions saving={saving()} saved={saved()} error={error()} />
                </form>
              </section>
              <div class="mt-6 rounded-lg bg-white p-5">
                <LogoUpload
                  shopId={s().id}
                  name={s().name}
                  logo={s().logo}
                  onUploaded={(logo) =>
                    mutate((prev) => (prev ? { ...prev, shop: { ...prev.shop, logo } } : prev))}
                />
              </div>
            </>
          )}
        </Match>
      </Switch>
    </div>
  );
}
