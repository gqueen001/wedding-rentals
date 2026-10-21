import data from "./catalog.json" with { type: "json" };
import type { ListItem } from "./types.ts";

/**
 * The rental categories and their own fields. catalog.json is generated from the backend's
 * internal/catalog (go test ./internal/catalog/ -update), so both sides always agree.
 * Texts: cat.<slug>, attr.<slug>.<key> and attr.<slug>.<key>.<option> in the i18n files.
 */
export interface FieldDef {
  key: string;
  kind: "text" | "choice" | "choices" | "number";
  required: boolean;
  options?: string[];
  min?: number;
  max?: number;
  max_len?: number;
  filter?: { param: string; kind: "eq" | "has" | "min" };
}

export interface CategoryDef {
  slug: string;
  /** Dresses keep their own pages, editor and API. */
  own_pages: boolean;
  fields: FieldDef[];
}

export const CATEGORIES = data.categories as CategoryDef[];

/** Every category except dresses: the ones with /c/:slug pages and the item editor. */
export const ITEM_CATEGORIES = CATEGORIES.filter((c) => !c.own_pages);

export function categoryDef(slug: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

/** The public list page of a category. */
export function categoryHref(slug: string): string {
  return slug === "dresses" ? "/dresses" : `/c/${slug}`;
}

/** A listing's public page: dresses keep /dresses/:id, everything else is /items/:id. */
export function listingHref(item: Pick<ListItem, "id" | "category">): string {
  return !item.category || item.category === "dresses" ? `/dresses/${item.id}` : `/items/${item.id}`;
}

export const catLabel = (slug: string) => `cat.${slug}`;
export const fieldLabel = (slug: string, key: string) => `attr.${slug}.${key}`;
export const optionLabel = (slug: string, key: string, option: string) => `attr.${slug}.${key}.${option}`;
