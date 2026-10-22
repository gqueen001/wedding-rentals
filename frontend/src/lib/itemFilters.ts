import type { CategoryDef } from "./catalog.ts";
import { priceParam } from "./filters.ts";

/** A category page's filters: the shared ones plus the category's own, by query param. */
export interface ItemFilters {
  q: string;
  city: string;
  priceMin: number | null;
  priceMax: number | null;
  /** Filter param → value, e.g. { body: "suv", seats_min: "5" }. */
  attrs: Record<string, string>;
}

export const EMPTY_ITEM_FILTERS: ItemFilters = { q: "", city: "", priceMin: null, priceMax: null, attrs: {} };

/** The category's filter value for param, if valid ("" otherwise). */
function attrValue(c: CategoryDef, param: string, raw: string | null): string {
  const f = c.fields.find((x) => x.filter?.param === param);
  const v = (raw ?? "").trim();
  if (!f?.filter || v === "") return "";
  if (f.filter.kind === "min") {
    const n = /^\d+$/.test(v) ? Number(v) : NaN;
    return n >= (f.min ?? 1) && n <= (f.max ?? Infinity) ? String(n) : "";
  }
  return f.options?.includes(v) ? v : "";
}

/** Reads a category page's filters from its URL query; unknown or invalid values are dropped. */
export function parseItemFilters(c: CategoryDef, query: URLSearchParams): ItemFilters {
  const attrs: Record<string, string> = {};
  for (const f of c.fields) {
    if (!f.filter) continue;
    const v = attrValue(c, f.filter.param, query.get(f.filter.param));
    if (v) attrs[f.filter.param] = v;
  }
  return {
    q: (query.get("q") ?? "").trim(),
    city: (query.get("city") ?? "").trim(),
    priceMin: priceParam(query.get("price_min")),
    priceMax: priceParam(query.get("price_max")),
    attrs,
  };
}

/** Writes filters as a query in a fixed order (the catalog's), leaving out empty values. */
export function itemFiltersToQuery(c: CategoryDef, f: ItemFilters): URLSearchParams {
  const query = new URLSearchParams();
  const put = (key: string, value: string | number | null) => {
    if (value !== null && value !== "") query.set(key, String(value));
  };
  put("q", f.q.trim());
  put("city", f.city);
  put("price_min", f.priceMin);
  put("price_max", f.priceMax);
  for (const field of c.fields) {
    if (field.filter) put(field.filter.param, attrValue(c, field.filter.param, f.attrs[field.filter.param] ?? null));
  }
  return query;
}

/** How many filters are set in the filter sheet; the search text is not counted. */
export function countItemFilters(f: ItemFilters): number {
  return [f.city || null, f.priceMin, f.priceMax].filter((v) => v !== null).length +
    Object.values(f.attrs).filter(Boolean).length;
}
