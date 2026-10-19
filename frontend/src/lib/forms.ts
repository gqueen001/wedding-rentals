import type { AdminShop, ShopInput } from "./types.ts";

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

/** Router search params can hold one value or a list; take the first. */
export function firstParam(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}
