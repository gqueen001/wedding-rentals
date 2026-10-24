import { createSignal, For, Match, Show, Switch } from "solid-js";
import { t, tr } from "../i18n/i18n.ts";
import { type CategoryDef, fieldLabel, optionLabel } from "../lib/catalog.ts";
import { EMPTY_ITEM_FILTERS, type ItemFilters } from "../lib/itemFilters.ts";
import { ChoiceGroup, CityField, NumberInput, PriceFields } from "./FilterFields.tsx";
import Sheet from "./Sheet.tsx";

/**
 * The filters of a category page or of /search, built from the category's field definitions.
 * With hideCity the city is left out (and kept on Reset), for pages that have their own city dropdown.
 */
export default function ItemFilterSheet(props: {
  category: CategoryDef;
  open: boolean;
  value: ItemFilters;
  onApply: (f: ItemFilters) => void;
  onClose: () => void;
  hideCity?: boolean;
}) {
  const [draft, setDraft] = createSignal<ItemFilters>({ ...props.value });
  const setAttr = (param: string, value: string) =>
    setDraft((d) => ({ ...d, attrs: { ...d.attrs, [param]: value } }));
  const slug = () => props.category.slug;

  return (
    <Sheet
      open={props.open}
      title={t("filters.title")}
      onOpen={() => setDraft({ ...props.value })}
      onClose={props.onClose}
      footer={
        <>
          <button
            type="button"
            class="btn btn-quiet"
            onClick={() => setDraft({ ...EMPTY_ITEM_FILTERS, q: draft().q, city: props.hideCity ? draft().city : "" })}
          >
            {t("filters.reset")}
          </button>
          <button type="button" class="btn btn-primary flex-1" onClick={() => props.onApply(draft())}>
            {t("filters.apply_items")}
          </button>
        </>
      }
    >
      <Show when={!props.hideCity}>
        <CityField value={draft().city} onChange={(city) => setDraft((d) => ({ ...d, city }))} />
      </Show>
      <PriceFields
        min={draft().priceMin}
        max={draft().priceMax}
        onMin={(priceMin) => setDraft((d) => ({ ...d, priceMin }))}
        onMax={(priceMax) => setDraft((d) => ({ ...d, priceMax }))}
      />
      <For each={props.category.fields.filter((f) => f.filter)}>
        {(field) => {
          const param = field.filter!.param;
          return (
            <Switch>
              <Match when={field.filter!.kind === "min"}>
                <NumberInput
                  label={tr("filters.at_least", { field: tr(fieldLabel(slug(), field.key)) })}
                  value={draft().attrs[param] ? Number(draft().attrs[param]) : null}
                  onChange={(n) => setAttr(param, n === null ? "" : String(n))}
                />
              </Match>
              <Match when={true}>
                <ChoiceGroup
                  legend={tr(fieldLabel(slug(), field.key))}
                  name={param}
                  options={(field.options ?? []).map((o) => ({ value: o, label: tr(optionLabel(slug(), field.key, o)) }))}
                  value={draft().attrs[param] || null}
                  onChange={(v) => setAttr(param, v ?? "")}
                />
              </Match>
            </Switch>
          );
        }}
      </For>
    </Sheet>
  );
}
