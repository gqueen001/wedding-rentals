import {
  type Color, COLORS, type Silhouette, SILHOUETTES, type Size, SIZES, type Sleeves, SLEEVES,
} from "./types.ts";

export interface Filters {
  q: string;
  city: string;
  priceMin: number | null;
  priceMax: number | null;
  size: Size | null;
  color: Color | null;
  style: Silhouette | null;
  sleeves: Sleeves | null;
}

export const EMPTY_FILTERS: Filters = {
  q: "", city: "", priceMin: null, priceMax: null, size: null, color: null, style: null, sleeves: null,
};

const MAX_PRICE = 2_147_483_647; // the API rejects anything above int4

function oneOf<T extends string>(allowed: readonly T[], v: string | null): T | null {
  return v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

function price(v: string | null): number | null {
  const s = v?.trim() ?? "";
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n > 0 && n <= MAX_PRICE ? n : null;
}

/** What the price fields make of typed text: only the digits count ("1 500" is 1500). */
export function parsePriceInput(s: string): number | null {
  return price(s.replace(/\D/g, ""));
}

/** Reads filters from a URL query; unknown or invalid values are dropped. */
export function parseFilters(query: URLSearchParams): Filters {
  return {
    q: (query.get("q") ?? "").trim(),
    city: (query.get("city") ?? "").trim(),
    priceMin: price(query.get("price_min")),
    priceMax: price(query.get("price_max")),
    size: oneOf(SIZES, query.get("size")),
    color: oneOf(COLORS, query.get("color")),
    style: oneOf(SILHOUETTES, query.get("style")),
    sleeves: oneOf(SLEEVES, query.get("sleeves")),
  };
}

/** Writes filters as a query in a fixed key order, leaving out empty values. */
export function filtersToQuery(f: Filters): URLSearchParams {
  const query = new URLSearchParams();
  const put = (key: string, value: string | number | null) => {
    if (value !== null && value !== "") query.set(key, String(value));
  };
  put("q", f.q.trim());
  put("city", f.city);
  put("price_min", f.priceMin);
  put("price_max", f.priceMax);
  put("size", f.size);
  put("color", f.color);
  put("style", f.style);
  put("sleeves", f.sleeves);
  return query;
}

/** How many filters are set in the filter sheet; the search text is not counted. */
export function countActiveFilters(f: Filters): number {
  return [f.city || null, f.priceMin, f.priceMax, f.size, f.color, f.style, f.sleeves]
    .filter((v) => v !== null).length;
}
