import type { SetStoreFunction } from "solid-js/store";
import { i18n, t } from "../../i18n/i18n.ts";
import { useCities } from "../../lib/cities.ts";
import { cityName } from "../../lib/format.ts";
import type { ShopInput } from "../../lib/types.ts";
import AliasEditor from "./AliasEditor.tsx";
import { SelectField, TextArea, TextField } from "./Field.tsx";

/** The shop details form body, shared by the admin shop editor and "My shop". */
export default function ShopFields(props: {
  form: ShopInput;
  setForm: SetStoreFunction<ShopInput>;
  /** Raw API field values by field name, e.g. { name: "required" }. */
  errors: Record<string, string>;
}) {
  const cities = useCities();
  const err = (field: string) => props.errors[field];
  const cityOptions = () => [
    { value: "", label: t("admin.choose") },
    ...cities().map((c) => ({ value: String(c.id), label: cityName(c, i18n.lang()) })),
  ];
  return (
    <>
      <TextField
        label={t("shopform.name")}
        value={props.form.name}
        onInput={(v) => props.setForm("name", v)}
        error={err("name")}
      />
      <SelectField
        label={t("shopform.city")}
        value={props.form.city_id ? String(props.form.city_id) : ""}
        options={cityOptions()}
        onChange={(v) => props.setForm("city_id", Number(v) || 0)}
        error={err("city_id")}
      />
      <TextField
        label={t("shopform.address")}
        value={props.form.address}
        onInput={(v) => props.setForm("address", v)}
        error={err("address")}
      />
      <TextField
        label={t("shopform.phone")}
        type="tel"
        inputmode="tel"
        value={props.form.phone}
        onInput={(v) => props.setForm("phone", v)}
        error={err("phone")}
      />
      <div class="grid gap-5 sm:grid-cols-2">
        <TextField
          label={t("shopform.instagram_url")}
          type="url"
          inputmode="url"
          hint={t("shopform.url_hint")}
          value={props.form.instagram_url}
          onInput={(v) => props.setForm("instagram_url", v)}
          error={err("instagram_url")}
        />
        <TextField
          label={t("shopform.tiktok_url")}
          type="url"
          inputmode="url"
          hint={t("shopform.url_hint")}
          value={props.form.tiktok_url}
          onInput={(v) => props.setForm("tiktok_url", v)}
          error={err("tiktok_url")}
        />
      </div>
      <TextArea
        label={t("shopform.description")}
        value={props.form.description}
        onInput={(v) => props.setForm("description", v)}
        error={err("description")}
      />
      <AliasEditor
        aliases={props.form.aliases}
        onChange={(list) => props.setForm("aliases", list)}
        error={err("aliases")}
      />
    </>
  );
}
