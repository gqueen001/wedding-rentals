import {
  type AdminDress, type AdminShop, type Color, type DressInput, type ShopInput, type Silhouette, type Size, SIZES,
  type Sleeves,
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
