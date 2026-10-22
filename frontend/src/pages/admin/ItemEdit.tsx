import { A, useNavigate, useParams, useSearchParams } from "@solidjs/router";
import { createEffect, createResource, createSignal, Match, on, Show, Switch } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import AttributeFields from "../../components/admin/AttributeFields.tsx";
import AvailabilityEditor from "../../components/admin/AvailabilityEditor.tsx";
import { CheckboxField, FormActions, SelectField, TextArea, TextField } from "../../components/admin/Field.tsx";
import PhotoManager from "../../components/admin/PhotoManager.tsx";
import ErrorState from "../../components/ErrorState.tsx";
import { t, tr } from "../../i18n/i18n.ts";
import { categoryDef, catLabel } from "../../lib/catalog.ts";
import { validationFields } from "../../lib/errors.ts";
import { emptyItemForm, firstParam, type ItemForm, itemFormToInput, itemToForm } from "../../lib/forms.ts";
import { useManage } from "../../lib/manage.ts";
import { usePageTitle } from "../../lib/title.ts";
import NotFound from "../NotFound.tsx";

/**
 * The editor for one non-dress item, or a new one in a category; remounted per item by
 * ItemEdit below. Admins and shop owners share it: useManage() says where it saves and links to.
 */
function ItemEditor(props: { id: number | null; category: string }) {
  const m = useManage();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const id = () => props.id;
  const [item, { mutate, refetch }] = createResource(id, (itemId) => m.calls.item(itemId));
  const [shops] = createResource(() => m.shops?.() ?? Promise.resolve([]));
  const [form, setForm] = createStore<ItemForm>(emptyItemForm(props.category, Number(firstParam(search.shop_id)) || 0));
  // Refill the form only when the saved item changes, not when just its photos do.
  createEffect(on(() => (item.state === "ready" ? item()?.updated_at : undefined), (stamp) => {
    const it = item.state === "ready" ? item() : undefined;
    if (stamp && it) setForm(reconcile(itemToForm(it)));
  }));
  const def = () => categoryDef(form.category);
  const categoryName = () => tr(catLabel(form.category));
  const [errors, setErrors] = createSignal<Record<string, string>>({});
  const [error, setError] = createSignal<unknown>(null);
  const [saving, setSaving] = createSignal(false);
  const [saved, setSaved] = createSignal(false);
  const err = (field: string) => errors()[field];
  const heading = () => (id() ? form.title || t("admin.edit") : t("admin.new_item", { category: categoryName() }));
  usePageTitle(heading);

  async function save(e: SubmitEvent) {
    e.preventDefault();
    const d = def();
    if (!d) return;
    setSaving(true);
    setSaved(false);
    setErrors({});
    setError(null);
    try {
      const input = itemFormToInput({ ...form, attributes: { ...form.attributes } }, d.fields);
      const current = id();
      const result = current ? await m.calls.updateItem(current, input) : await m.calls.createItem(input);
      setSaved(true);
      if (current) mutate((prev) => ({ ...result, images: prev?.images ?? result.images }));
      else navigate(m.itemHref(result.id), { replace: true });
    } catch (e) {
      setErrors(validationFields(e));
      setError(() => e);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const current = id();
    if (!current || !confirm(t("admin.delete_item_confirm"))) return;
    try {
      await m.calls.deleteItem(current);
      navigate(m.listingsHref(form.shop_id), { replace: true });
    } catch (e) {
      setError(() => e);
    }
  }

  const shopOptions = () => [
    { value: "", label: t("admin.choose") },
    ...(shops.state === "ready" ? shops() ?? [] : []).map((s) => ({ value: String(s.id), label: s.name })),
  ];

  return (
    <div class="max-w-2xl">
      <A href={m.listingsHref()} class="text-sm text-silver-ink hover:text-ink">{t("common.back")}</A>
      <h1 class="mt-2 text-3xl">{heading()}</h1>
      <Switch>
        <Match when={item.error}>
          <ErrorState error={item.error} onRetry={() => void refetch()} />
        </Match>
        <Match when={id() !== null && !item()}>
          <p class="mt-6 text-silver-ink">{t("common.loading")}</p>
        </Match>
        <Match when={def()}>
          {(d) => (
            <>
              <form class="mt-6 space-y-5 rounded-lg bg-white p-5" novalidate onSubmit={save}>
                <p class="text-sm">
                  <span class="text-silver-ink">{t("admin.category")}:</span>{" "}
                  <span class="font-semibold">{categoryName()}</span>
                </p>
                <Show when={m.shops}>
                  <SelectField
                    label={t("admin.shop")}
                    value={form.shop_id ? String(form.shop_id) : ""}
                    options={shopOptions()}
                    onChange={(v) => setForm("shop_id", Number(v) || 0)}
                    error={err("shop_id")}
                  />
                </Show>
                <TextField label={t("itemform.title")} value={form.title} onInput={(v) => setForm("title", v)} error={err("title")} />
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
                <AttributeFields
                  category={d()}
                  values={form.attributes}
                  onChange={(key, value) => setForm("attributes", key, value)}
                  errors={errors()}
                />
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

              <section class="mt-8 rounded-lg bg-white p-5">
                <h2 class="text-2xl">{t("photos.title")}</h2>
                <div class="mt-4">
                  <Show
                    when={id() !== null && item()}
                    fallback={<p class="text-sm text-silver-ink">{t("photos.save_first_item")}</p>}
                  >
                    {(it) => (
                      <PhotoManager
                        listingId={it().id}
                        title={it().title}
                        images={it().images}
                        onChange={(images) => mutate({ ...it(), images })}
                      />
                    )}
                  </Show>
                </div>
              </section>

              <section class="mt-8 rounded-lg bg-white p-5">
                <h2 class="text-2xl">{t("avail.title")}</h2>
                <div class="mt-4">
                  <Show
                    when={id() !== null && item()}
                    fallback={<p class="text-sm text-silver-ink">{t("avail.save_first_item")}</p>}
                  >
                    {(it) => <AvailabilityEditor listingId={it().id} />}
                  </Show>
                </div>
              </section>
            </>
          )}
        </Match>
      </Switch>
    </div>
  );
}

/**
 * /admin/items/new?category=…, /admin/items/:id, /shop/items/new?category=… and
 * /shop/items/:id; a fresh editor per item. A new item needs a known non-dress category.
 */
export default function ItemEdit() {
  const params = useParams();
  const [search] = useSearchParams();
  const key = () => {
    if (params.id) return params.id;
    const c = categoryDef(firstParam(search.category));
    return c && !c.own_pages ? `new:${c.slug}` : "";
  };
  return (
    <Show when={key()} keyed fallback={<NotFound />}>
      {(k) => (k.startsWith("new:") ? <ItemEditor id={null} category={k.slice(4)} /> : <ItemEditor id={Number(k)} category="" />)}
    </Show>
  );
}
