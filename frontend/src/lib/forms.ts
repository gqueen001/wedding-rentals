import type { FieldDef } from "./catalog.ts";
import {
  type AdminDress, type AdminItem, type AdminShop, type Attributes, type Color, type DressInput, type ItemInput,
  type ShopInput, type Silhouette, type Size, SIZES, type Sleeves,
} from "./types.ts";

export const EMPTY_SHOP_INPUT: ShopInput = {
  name: "", city_id: 0, address: "", phone: "", instagram_url: "", tiktok_url: "", description: "",
  is_published: false, aliases: [],
};

export function shopToInput(s: AdminShop): ShopInput {
  return {
    name: s.name,
    city_id: s.city_id,
    address: s.address,
    phone: s.phone,
    instagram_url: s.instagram_url ?? "",
    tiktok_url: s.tiktok_url ?? "",
    description: s.description ?? "",
    is_published: s.is_published,
    aliases: [...s.aliases],
  };
}

/** Trims every text field and drops blank or repeated aliases (ignoring case) before saving. */
export function cleanShopInput(f: ShopInput): ShopInput {
  const seen = new Set<string>();
  const aliases: string[] = [];
  for (const raw of f.aliases) {
    const alias = raw.trim();
    const key = alias.toLowerCase();
    if (alias && !seen.has(key)) {
      seen.add(key);
      aliases.push(alias);
    }
  }
  return {
    ...f,
    name: f.name.trim(),
    address: f.address.trim(),
    phone: f.phone.trim(),
    instagram_url: f.instagram_url.trim(),
    tiktok_url: f.tiktok_url.trim(),
    description: f.description.trim(),
    aliases,
  };
}

/** Where a shop owner goes after signing in: only back into "My shop", never to another site. */
export function ownerReturnPath(next: string): string {
  const inside = next === "/shop" || next.startsWith("/shop/") || next.startsWith("/shop?");
  return inside && !next.startsWith("/shop/login") && !next.startsWith("/shop/signup") ? next : "/shop";
}

/** Router search params can hold one value or a list; take the first. */
export function firstParam(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

/** The dress editor's state: the price stays text while typing, and enums may be unset. */
export interface DressForm {
  shop_id: number;
  title: string;
  price: string;
  price_is_from: boolean;
  description: string;
  is_published: boolean;
  color: Color | "";
  silhouette: Silhouette | "";
  sleeves: Sleeves | "";
  sizes: Size[];
}

export const EMPTY_DRESS_FORM: DressForm = {
  shop_id: 0, title: "", price: "", price_is_from: false, description: "", is_published: false,
  color: "", silhouette: "", sleeves: "", sizes: [],
};

export function dressToForm(d: AdminDress): DressForm {
  return {
    shop_id: d.shop_id,
    title: d.title,
    price: String(d.price_manat),
    price_is_from: d.price_is_from,
    description: d.description ?? "",
    is_published: d.is_published,
    color: d.color,
    silhouette: d.silhouette,
    sleeves: d.sleeves,
    sizes: [...d.sizes],
  };
}

/**
 * Builds the API input. A blank or non-numeric price becomes 0 and unset enums stay "",
 * so the API answers with the right field errors. Sizes come out in XS…XXL order.
 */
export function dressFormToInput(f: DressForm): DressInput {
  const price = f.price.trim();
  return {
    shop_id: f.shop_id,
    title: f.title.trim(),
    price_manat: /^\d+$/.test(price) ? Number(price) : 0,
    price_is_from: f.price_is_from,
    description: f.description.trim(),
    is_published: f.is_published,
    color: f.color as Color,
    silhouette: f.silhouette as Silhouette,
    sleeves: f.sleeves as Sleeves,
    sizes: SIZES.filter((s) => f.sizes.includes(s)),
  };
}

/** The item editor's state: price and numbers stay text while typing; choices may be unset. */
export interface ItemForm {
  shop_id: number;
  category: string;
  title: string;
  price: string;
  price_is_from: boolean;
  description: string;
  is_published: boolean;
  /** Field key → text (text, choice and number fields) or picked options (choices). */
  attributes: Record<string, string | string[]>;
}

export function emptyItemForm(category: string, shopId = 0): ItemForm {
  return {
    shop_id: shopId, category, title: "", price: "", price_is_from: false, description: "", is_published: false,
    attributes: {},
  };
}

export function itemToForm(it: AdminItem): ItemForm {
  const attributes: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(it.attributes)) {
    attributes[key] = Array.isArray(value) ? [...value] : String(value);
  }
  return {
    shop_id: it.shop_id,
    category: it.category,
    title: it.title,
    price: String(it.price_manat),
    price_is_from: it.price_is_from,
    description: it.description ?? "",
    is_published: it.is_published,
    attributes,
  };
}

/**
 * Builds the API input from the category's fields. Empty values are left out, numbers are
 * sent as numbers (text that is not a whole number is sent as is, so the API reports it),
 * and a blank or non-numeric price becomes 0 so the API answers with the field error.
 */
export function itemFormToInput(f: ItemForm, fields: FieldDef[]): ItemInput {
  const price = f.price.trim();
  const attributes: Attributes = {};
  for (const field of fields) {
    const raw = f.attributes[field.key];
    if (Array.isArray(raw)) {
      if (raw.length > 0) attributes[field.key] = (field.options ?? []).filter((o) => raw.includes(o));
      continue;
    }
    const text = (raw ?? "").trim();
    if (text === "") continue;
    attributes[field.key] = field.kind === "number" && /^\d+$/.test(text) ? Number(text) : text;
  }
  return {
    shop_id: f.shop_id,
    category: f.category,
    title: f.title.trim(),
    price_manat: /^\d+$/.test(price) ? Number(price) : 0,
    price_is_from: f.price_is_from,
    description: f.description.trim(),
    is_published: f.is_published,
    attributes,
  };
}
