import { A, useNavigate, useParams } from "@solidjs/router";
import { createEffect, createResource, createSignal, Match, on, Show, Switch } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import AliasEditor from "../../components/admin/AliasEditor.tsx";
import { CheckboxField, FormActions, SelectField, TextArea, TextField } from "../../components/admin/Field.tsx";
import LogoUpload from "../../components/admin/LogoUpload.tsx";
import ErrorState from "../../components/ErrorState.tsx";
import { i18n, t } from "../../i18n/i18n.ts";
import { useCities } from "../../lib/cities.ts";
import { api } from "../../lib/client.ts";
import { validationFields } from "../../lib/errors.ts";
import { cityName } from "../../lib/format.ts";
import { cleanShopInput, EMPTY_SHOP_INPUT, shopToInput } from "../../lib/forms.ts";
import { usePageTitle } from "../../lib/title.ts";
import type { ShopInput } from "../../lib/types.ts";

/** The editor for one shop (or a new one); remounted per shop by ShopEdit below. */
function ShopEditor(props: { id: number | null }) {
  const navigate = useNavigate();
  const id = () => props.id;
  const [shop, { mutate }] = createResource(id, (shopId) => api.admin.shop(shopId));
  const [form, setForm] = createStore<ShopInput>({ ...EMPTY_SHOP_INPUT, aliases: [] });
  // Refill the form only when the saved shop changes, not when just its logo does.
  createEffect(on(() => (shop.state === "ready" ? shop()?.updated_at : undefined), (stamp) => {
    const s = shop.state === "ready" ? shop() : undefined;
    if (stamp && s) setForm(reconcile(shopToInput(s)));
  }));
  const cities = useCities();
  const [errors, setErrors] = createSignal<Record<string, string>>({});
  const [error, setError] = createSignal<unknown>(null);
  const [saving, setSaving] = createSignal(false);
  const [saved, setSaved] = createSignal(false);
  const err = (field: string) => errors()[field];
  usePageTitle(() => (id() ? form.name || t("admin.edit") : t("admin.new_shop")));

  async function save(e: SubmitEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setErrors({});
    setError(null);
    try {
      const input = cleanShopInput({ ...form, aliases: [...form.aliases] });
      const current = id();
      const result = current ? await api.admin.updateShop(current, input) : await api.admin.createShop(input);
      setSaved(true);
      if (current) mutate(result);
      else navigate(`/admin/shops/${result.id}`, { replace: true });
    } catch (e) {
      setErrors(validationFields(e));
      setError(() => e);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const current = id();
    if (!current || !confirm(t("admin.delete_shop_confirm"))) return;
    try {
      await api.admin.deleteShop(current);
      navigate("/admin/shops", { replace: true });
    } catch (e) {
      setError(() => e);
    }
  }

  const cityOptions = () => [
    { value: "", label: t("admin.choose") },
    ...cities().map((c) => ({ value: String(c.id), label: cityName(c, i18n.lang()) })),
  ];

  return (
    <div class="max-w-2xl">
      <A href="/admin/shops" class="text-sm text-silver-ink hover:text-ink">{t("common.back")}</A>
      <h1 class="mt-2 text-3xl">{id() ? form.name || t("admin.edit") : t("admin.new_shop")}</h1>
      <Switch>
        <Match when={shop.error}>
          <ErrorState error={shop.error} />
        </Match>
        <Match when={id() !== null && !shop()}>
          <p class="mt-6 text-silver-ink">{t("common.loading")}</p>
        </Match>
        <Match when={id() === null || shop()}>
          <form class="mt-6 space-y-5 rounded-lg bg-white p-5" novalidate onSubmit={save}>
            <TextField label={t("shopform.name")} value={form.name} onInput={(v) => setForm("name", v)} error={err("name")} />
            <SelectField
              label={t("shopform.city")}
              value={form.city_id ? String(form.city_id) : ""}
              options={cityOptions()}
              onChange={(v) => setForm("city_id", Number(v) || 0)}
              error={err("city_id")}
            />
            <TextField
              label={t("shopform.address")}
              value={form.address}
              onInput={(v) => setForm("address", v)}
              error={err("address")}
            />
            <TextField
              label={t("shopform.phone")}
              type="tel"
              inputmode="tel"
              value={form.phone}
              onInput={(v) => setForm("phone", v)}
              error={err("phone")}
            />
            <div class="grid gap-5 sm:grid-cols-2">
              <TextField
                label={t("shopform.instagram_url")}
                type="url"
                inputmode="url"
                hint={t("shopform.url_hint")}
                value={form.instagram_url}
                onInput={(v) => setForm("instagram_url", v)}
                error={err("instagram_url")}
              />
              <TextField
                label={t("shopform.tiktok_url")}
                type="url"
                inputmode="url"
                hint={t("shopform.url_hint")}
                value={form.tiktok_url}
                onInput={(v) => setForm("tiktok_url", v)}
                error={err("tiktok_url")}
              />
            </div>
            <TextArea
              label={t("shopform.description")}
              value={form.description}
              onInput={(v) => setForm("description", v)}
              error={err("description")}
            />
            <AliasEditor aliases={form.aliases} onChange={(list) => setForm("aliases", list)} error={err("aliases")} />
            <CheckboxField
              label={t("admin.published")}
              hint={t("admin.published_hint")}
              checked={form.is_published}
              onChange={(v) => setForm("is_published", v)}
            />
            <FormActions saving={saving()} saved={saved()} error={error()} onDelete={id() ? remove : undefined} />
          </form>
          <Show when={id() !== null && shop()}>
            {(s) => (
              <section class="mt-8 rounded-lg bg-white p-5">
                <LogoUpload
                  shopId={s().id}
                  name={s().name}
                  logo={s().logo}
                  onUploaded={(logo) => mutate({ ...s(), logo })}
                />
              </section>
            )}
          </Show>
        </Match>
      </Switch>
    </div>
  );
}

/** Both /admin/shops/new and /admin/shops/:id; a fresh editor per shop, so no state leaks between shops. */
export default function ShopEdit() {
  const params = useParams();
  return (
    <Show when={params.id ?? "new"} keyed>
      {(key) => <ShopEditor id={key === "new" ? null : Number(key)} />}
    </Show>
  );
}
