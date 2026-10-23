import { For, Show } from "solid-js";
import { tr } from "../i18n/i18n.ts";
import { categoryDef, fieldLabel, optionLabel } from "../lib/catalog.ts";
import type { Attributes } from "../lib/types.ts";

/** A listing's own details as label and value pairs, in the catalog's field order. */
export default function AttributeList(props: { category: string; attributes: Attributes }) {
  const rows = () =>
    (categoryDef(props.category)?.fields ?? [])
      // The price unit is already part of the price.
      .filter((f) => f.key !== "price_unit" && props.attributes[f.key] !== undefined)
      .map((f) => {
        const v = props.attributes[f.key];
        const value = f.kind === "choice"
          ? tr(optionLabel(props.category, f.key, String(v)))
          : f.kind === "choices"
          ? (v as string[]).map((o) => tr(optionLabel(props.category, f.key, o))).join(", ")
          : String(v);
        return { label: tr(fieldLabel(props.category, f.key)), value };
      });
  return (
    <Show when={rows().length > 0}>
      <dl class="grid grid-cols-[max-content_1fr] items-center gap-x-6 gap-y-3 text-sm">
        <For each={rows()}>
          {(row) => (
            <>
              <dt class="label">{row.label}</dt>
              <dd>{row.value}</dd>
            </>
          )}
        </For>
      </dl>
    </Show>
  );
}
