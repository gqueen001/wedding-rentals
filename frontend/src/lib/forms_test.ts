import { assertEquals } from "@std/assert";
import { cleanShopInput, EMPTY_SHOP_INPUT, firstParam, shopToInput } from "./forms.ts";
import type { AdminShop } from "./types.ts";

const shop: AdminShop = {
  id: 3, slug: "ak-gelin", name: "Ak Gelin", city_id: 2, address: "Mary", phone: "+99365",
  instagram_url: null, tiktok_url: "https://tiktok.com/@akgelin", description: null, is_published: true,
  logo: null, aliases: ["Ак Гелин"], created_at: "2026-10-19T00:00:00Z", updated_at: "2026-10-19T00:00:00Z",
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
