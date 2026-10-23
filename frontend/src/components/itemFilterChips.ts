import { i18n, t, tr } from "../i18n/i18n.ts";
import { type CategoryDef, fieldLabel, optionLabel } from "../lib/catalog.ts";
import { cityName, formatPrice } from "../lib/format.ts";
import type { ItemFilters } from "../lib/itemFilters.ts";
import type { City } from "../lib/types.ts";
import type { ActiveFilter } from "./FilterChips.tsx";

/** One removable chip per active filter, in the sheet's order; removing one applies the filters without it. */
export function itemFilterChips(
  c: CategoryDef,
  f: ItemFilters,
  cities: City[],
  apply: (f: ItemFilters) => void,
): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  if (f.city) {
    const city = cities.find((x) => x.slug === f.city);
    out.push({ key: "city", label: city ? cityName(city, i18n.lang()) : f.city, remove: () => apply({ ...f, city: "" }) });
  }
  if (f.priceMin !== null) {
    out.push({ key: "price_min", label: t("price.from", { price: formatPrice(f.priceMin) }), remove: () => apply({ ...f, priceMin: null }) });
  }
  if (f.priceMax !== null) {
    out.push({ key: "price_max", label: t("filters.up_to", { price: formatPrice(f.priceMax) }), remove: () => apply({ ...f, priceMax: null }) });
  }
  for (const field of c.fields) {
    const param = field.filter?.param;
    const value = param ? f.attrs[param] : "";
    if (!param || !value) continue;
    const label = field.filter!.kind === "min"
      ? `${tr("filters.at_least", { field: tr(fieldLabel(c.slug, field.key)) })} ${value}`
      : tr(optionLabel(c.slug, field.key, value));
    out.push({ key: param, label, remove: () => apply({ ...f, attrs: { ...f.attrs, [param]: "" } }) });
  }
  return out;
}
