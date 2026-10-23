import { useNavigate, useParams, useSearchParams } from "@solidjs/router";
import { createEffect, createMemo, createResource, createSignal, For, Match, on, Show, Switch } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import AvailabilityEditor from "../../components/admin/AvailabilityEditor.tsx";
import BackLink from "../../components/admin/BackLink.tsx";
import { CheckboxField, FormActions, SelectField, TextArea, TextField } from "../../components/admin/Field.tsx";
import PhotoManager from "../../components/admin/PhotoManager.tsx";
import ErrorState from "../../components/ErrorState.tsx";
import { t, tr } from "../../i18n/i18n.ts";
import { fieldMessage, validationFields } from "../../lib/errors.ts";
import { type DressForm, dressFormToInput, dressToForm, EMPTY_DRESS_FORM, firstParam } from "../../lib/forms.ts";
import { useManage } from "../../lib/manage.ts";
import { usePageTitle } from "../../lib/title.ts";
import { COLORS, SILHOUETTES, SIZES, SLEEVES } from "../../lib/types.ts";

/**
 * The editor for one dress (or a new one); remounted per dress by DressEdit below.
 * Admins and shop owners share it: useManage() says where it saves and links to.
 */
function DressEditor(props: { id: number | null }) {
  const m = useManage();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const id = () => props.id;
  const [dress, { mutate, refetch }] = createResource(id, (dressId) => m.calls.dress(dressId));
  const [shops] = createResource(() => m.shops?.() ?? Promise.resolve([]));
  const [form, setForm] = createStore<DressForm>({
    ...EMPTY_DRESS_FORM,
    sizes: [],
    shop_id: Number(firstParam(search.shop_id)) || 0,
  });
  // Refill the form only when the saved dress changes, not when just its photos do.
  const stamp = createMemo(() => (dress.state === "ready" ? dress()?.updated_at : undefined));
  createEffect(on(stamp, (stamp) => {
    const d = dress.state === "ready" ? dress() : undefined;
    if (stamp && d) setForm(reconcile(dressToForm(d)));
  }));
  const [errors, setErrors] = createSignal<Record<string, string>>({});
  const [error, setError] = createSignal<unknown>(null);
  const [saving, setSaving] = createSignal(false);
  const [saved, setSaved] = createSignal(false);
  const err = (field: string) => errors()[field];
  usePageTitle(() => (id() ? form.title || t("admin.edit") : t("admin.new_dress")));

  async function save(e: SubmitEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setErrors({});
    setError(null);
    try {
      const input = dressFormToInput({ ...form, sizes: [...form.sizes] });
      const current = id();
      const result = current ? await m.calls.updateDress(current, input) : await m.calls.createDress(input);
      setSaved(true);
      if (current) mutate((prev) => ({ ...result, images: prev?.images ?? result.images }));
      else navigate(m.dressHref(result.id), { replace: true });
    } catch (e) {
      setErrors(validationFields(e));
      setError(() => e);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const current = id();
    if (!current || !confirm(t("admin.delete_dress_confirm"))) return;
    try {
      await m.calls.deleteDress(current);
      navigate(m.listingsHref(form.shop_id), { replace: true });
    } catch (e) {
      setError(() => e);
    }
  }

  const choose = { value: "", label: t("admin.choose") };
  const shopOptions = () => [
    choose,
    ...(shops.state === "ready" ? shops() ?? [] : []).map((s) => ({ value: String(s.id), label: s.name })),
  ];

  return (
    <div class="max-w-2xl lg:max-w-6xl">
      <BackLink href={m.listingsHref()} />
      <h1 class="mt-4 text-3xl">{id() ? form.title || t("admin.edit") : t("admin.new_dress")}</h1>
      <Switch>
        <Match when={dress.error}>
          <ErrorState error={dress.error} onRetry={() => void refetch()} />
        </Match>
        <Match when={id() !== null && !dress()}>
          <p class="mt-6 text-silver-ink">{t("common.loading")}</p>
        </Match>
        <Match when={id() === null || dress()}>
          <div class="mt-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
            <form class="space-y-5 rounded-lg bg-white p-5" novalidate onSubmit={save}>
              <Show when={m.shops}>
                <SelectField
                  label={t("admin.shop")}
                  value={form.shop_id ? String(form.shop_id) : ""}
                  options={shopOptions()}
                  onChange={(v) => setForm("shop_id", Number(v) || 0)}
                  error={err("shop_id")}
                />
              </Show>
              <TextField
                label={t("dressform.title")}
                value={form.title}
                onInput={(v) => setForm("title", v)}
                error={err("title")}
              />
              <div class="grid items-end gap-5 sm:grid-cols-2">
                <TextField
                  label={t("dressform.price")}
                  inputmode="numeric"
                  value={form.price}
                  onInput={(v) => setForm("price", v)}
                  error={err("price_manat")}
                />
                <CheckboxField
                  label={t("dressform.price_is_from")}
                  checked={form.price_is_from}
                  onChange={(v) => setForm("price_is_from", v)}
                />
              </div>
              <div class="grid gap-5 sm:grid-cols-3">
                <SelectField
                  label={t("dressform.color")}
                  value={form.color}
                  options={[choose, ...COLORS.map((c) => ({ value: c, label: t(`color.${c}`) }))]}
                  onChange={(v) => setForm("color", v as DressForm["color"])}
                  error={err("color")}
                />
                <SelectField
                  label={t("dressform.silhouette")}
                  value={form.silhouette}
                  options={[choose, ...SILHOUETTES.map((s) => ({ value: s, label: t(`silhouette.${s}`) }))]}
                  onChange={(v) => setForm("silhouette", v as DressForm["silhouette"])}
                  error={err("silhouette")}
                />
                <SelectField
                  label={t("dressform.sleeves")}
                  value={form.sleeves}
                  options={[choose, ...SLEEVES.map((s) => ({ value: s, label: t(`sleeves.${s}`) }))]}
                  onChange={(v) => setForm("sleeves", v as DressForm["sleeves"])}
                  error={err("sleeves")}
                />
              </div>
              <fieldset>
                <legend class="text-sm font-semibold">{t("dressform.sizes")}</legend>
                <div class="mt-2 flex flex-wrap gap-2">
                  <For each={SIZES}>
                    {(size) => (
                      <label class="chip">
                        <input
                          type="checkbox"
                          class="sr-only"
                          checked={form.sizes.includes(size)}
                          onChange={(e) =>
                            setForm(
                              "sizes",
                              e.currentTarget.checked ? [...form.sizes, size] : form.sizes.filter((s) => s !== size),
                            )}
                        />
                        {size}
                      </label>
                    )}
                  </For>
                </div>
                <Show when={err("sizes")}>
                  {(e) => <p class="mt-1 text-sm text-garnet">{fieldMessage(e(), tr)}</p>}
                </Show>
              </fieldset>
              <TextArea
                label={t("dressform.description")}
                value={form.description}
                onInput={(v) => setForm("description", v)}
                error={err("description")}
              />
              <CheckboxField
                label={t("admin.published")}
                hint={t("admin.published_hint")}
                checked={form.is_published}
                onChange={(v) => setForm("is_published", v)}
              />
              <FormActions saving={saving()} saved={saved()} error={error()} onDelete={id() ? remove : undefined} />
            </form>
            <div class="mt-8 space-y-8 lg:mt-0">
              <section class="rounded-lg bg-white p-5">
                <h2 class="text-2xl">{t("photos.title")}</h2>
                <div class="mt-4">
                  <Show
                    when={id() !== null && dress()}
                    fallback={<p class="text-sm text-silver-ink">{t("photos.save_first")}</p>}
                  >
                    {(d) => (
                      <PhotoManager
                        listingId={d().id}
                        title={d().title}
                        images={d().images}
                        onChange={(images) => mutate({ ...d(), images })}
                      />
                    )}
                  </Show>
                </div>
              </section>

              <section class="rounded-lg bg-white p-5">
                <h2 class="text-2xl">{t("avail.title")}</h2>
                <div class="mt-4">
                  <Show
                    when={id() !== null && dress()}
                    fallback={<p class="text-sm text-silver-ink">{t("avail.save_first")}</p>}
                  >
                    {(d) => <AvailabilityEditor listingId={d().id} />}
                  </Show>
                </div>
              </section>
            </div>
          </div>
        </Match>
      </Switch>
    </div>
  );
}

/**
 * /admin/dresses/new (optionally ?shop_id=), /admin/dresses/:id, /shop/dresses/new and
 * /shop/dresses/:id; a fresh editor per dress.
 */
export default function DressEdit() {
  const params = useParams();
  return (
    <Show when={params.id ?? "new"} keyed>
      {(key) => <DressEditor id={key === "new" ? null : Number(key)} />}
    </Show>
  );
}
