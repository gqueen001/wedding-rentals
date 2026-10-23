import { type CategoryDef, categoryDef } from "./catalog.ts";
import { type ItemFilters, itemFiltersToQuery, parseItemFilters } from "./itemFilters.ts";

/** Searching every category at once: only the shared filters (city, price) apply. */
const ANY_CATEGORY: CategoryDef = { slug: "", own_pages: false, fields: [] };

/** The filters a search accepts: the shared ones, plus the picked category's own. */
export function searchFields(category: CategoryDef | undefined): CategoryDef {
  return category ?? ANY_CATEGORY;
}

export interface SearchState {
  /** The picked category chip; undefined means "All". */
  category: CategoryDef | undefined;
  filters: ItemFilters;
}

/** Reads /search's query. An unknown category means "All", and filters it does not have are dropped. */
export function parseSearch(query: URLSearchParams): SearchState {
  const category = categoryDef(query.get("category") ?? "");
  return { category, filters: parseItemFilters(searchFields(category), query) };
}

/** The API query for a search, without the page. */
export function searchQuery(s: SearchState): URLSearchParams {
  const query = itemFiltersToQuery(searchFields(s.category), s.filters);
  if (s.category) query.set("category", s.category.slug);
  return query;
}

/** The /search address for a category slug ("" for all) and filters; another category's own filters are dropped. */
export function searchHref(category: string, filters: ItemFilters): string {
  const qs = searchQuery({ category: categoryDef(category), filters }).toString();
  return qs ? `/search?${qs}` : "/search";
}
