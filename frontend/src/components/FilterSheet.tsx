import { createSignal } from "solid-js";
import { t } from "../i18n/i18n.ts";
import { EMPTY_FILTERS, type Filters } from "../lib/filters.ts";
import { COLORS, SILHOUETTES, SIZES, SLEEVES } from "../lib/types.ts";
import { ChoiceGroup, CityField, PriceFields } from "./FilterFields.tsx";
import Sheet from "./Sheet.tsx";

/** The dress list's filters in a bottom sheet. Changes stay in a draft until "Show dresses". */
export default function FilterSheet(props: {
  open: boolean;
  value: Filters;
  onApply: (f: Filters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = createSignal<Filters>({ ...props.value });
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <Sheet
      open={props.open}
      title={t("filters.title")}
      onOpen={() => setDraft({ ...props.value })}
      onClose={props.onClose}
      footer={
        <>
          <button type="button" class="btn btn-quiet" onClick={() => setDraft({ ...EMPTY_FILTERS, q: draft().q })}>
            {t("filters.reset")}
          </button>
          <button type="button" class="btn btn-primary flex-1" onClick={() => props.onApply(draft())}>
            {t("filters.apply")}
          </button>
        </>
      }
    >
      <CityField value={draft().city} onChange={(v) => set("city", v)} />
      <PriceFields
        min={draft().priceMin}
        max={draft().priceMax}
        onMin={(n) => set("priceMin", n)}
        onMax={(n) => set("priceMax", n)}
      />
      <ChoiceGroup
        legend={t("filters.size")}
        name="size"
        options={SIZES.map((s) => ({ value: s, label: s }))}
        value={draft().size}
        onChange={(v) => set("size", v)}
      />
      <ChoiceGroup
        legend={t("filters.color")}
        name="color"
        options={COLORS.map((c) => ({ value: c, label: t(`color.${c}`), swatch: c }))}
        value={draft().color}
        onChange={(v) => set("color", v)}
      />
      <ChoiceGroup
        legend={t("filters.style")}
        name="style"
        options={SILHOUETTES.map((s) => ({ value: s, label: t(`silhouette.${s}`) }))}
        value={draft().style}
        onChange={(v) => set("style", v)}
      />
      <ChoiceGroup
        legend={t("filters.sleeves")}
        name="sleeves"
        options={SLEEVES.map((s) => ({ value: s, label: t(`sleeves.${s}`) }))}
        value={draft().sleeves}
        onChange={(v) => set("sleeves", v)}
      />
    </Sheet>
  );
}
