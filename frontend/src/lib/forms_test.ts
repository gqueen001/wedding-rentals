import { assertEquals } from "@std/assert";
import { cleanShopInput, EMPTY_SHOP_INPUT, firstParam, shopToInput } from "./forms.ts";
import type { AdminShop } from "./types.ts";

const shop: AdminShop = {
  id: 3, slug: "ak-gelin", name: "Ak Gelin", city_id: 2, address: "Mary", phone: "+99365",
  instagram_url: null, tiktok_url: "https://tiktok.com/@akgelin", description: null, is_published: true,
  logo: null, aliases: ["Ак Гелин"], owner: null, created_at: "2026-10-19T00:00:00Z", updated_at: "2026-10-19T00:00:00Z",
};

Deno.test("shopToInput turns null fields into empty strings", () => {
  assertEquals(shopToInput(shop), {
    name: "Ak Gelin", city_id: 2, address: "Mary", phone: "+99365", instagram_url: "",
    tiktok_url: "https://tiktok.com/@akgelin", description: "", is_published: true, aliases: ["Ак Гелин"],
  });
});

Deno.test("cleanShopInput trims text and drops blank or repeated aliases", () => {
  const cleaned = cleanShopInput({
    ...EMPTY_SHOP_INPUT,
    name: "  Ak Gelin ",
    phone: " +993 65 ",
    aliases: [" Ак Гелин ", "", "ак гелин", "AK GELIN", "   "],
  });
  assertEquals(cleaned, { ...EMPTY_SHOP_INPUT, name: "Ak Gelin", phone: "+993 65", aliases: ["Ак Гелин", "AK GELIN"] });
});

Deno.test("firstParam takes the first value of a search param", () => {
  assertEquals(firstParam(undefined), "");
  assertEquals(firstParam("7"), "7");
  assertEquals(firstParam(["5", "6"]), "5");
});
import { dressFormToInput, type DressForm, dressToForm, EMPTY_DRESS_FORM } from "./forms.ts";
import type { AdminDress } from "./types.ts";

Deno.test("dressFormToInput trims, parses the price and orders the sizes", () => {
  const form: DressForm = {
    ...EMPTY_DRESS_FORM, shop_id: 4, title: "  Lale ", price: " 1500 ", color: "ivory",
    silhouette: "a_line", sleeves: "none", sizes: ["L", "XS", "M"],
  };
  assertEquals(dressFormToInput(form), {
    shop_id: 4, title: "Lale", price_manat: 1500, price_is_from: false, description: "", is_published: false,
    color: "ivory", silhouette: "a_line", sleeves: "none", sizes: ["XS", "M", "L"],
  });
});

Deno.test("a blank or non-numeric price becomes 0 so the API reports it", () => {
  for (const price of ["", "12a", "-5", "1.5"]) {
    assertEquals(dressFormToInput({ ...EMPTY_DRESS_FORM, price }).price_manat, 0);
  }
});

Deno.test("dressToForm and dressFormToInput round-trip a saved dress", () => {
  const dress: AdminDress = {
    id: 9, shop_id: 2, title: "Lale", price_manat: 2400, price_is_from: true, description: null,
    is_published: true, color: "blush", silhouette: "mermaid", sleeves: "long", sizes: ["S", "M"],
    images: [], created_at: "2026-10-19T00:00:00Z", updated_at: "2026-10-19T00:00:00Z",
  };
  assertEquals(dressFormToInput(dressToForm(dress)), {
    shop_id: 2, title: "Lale", price_manat: 2400, price_is_from: true, description: "", is_published: true,
    color: "blush", silhouette: "mermaid", sleeves: "long", sizes: ["S", "M"],
  });
});
