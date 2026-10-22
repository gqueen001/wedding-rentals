import { assertEquals } from "@std/assert";
import { dictionaries, i18n, translate } from "../i18n/i18n.ts";
import { formatPrice } from "../lib/format.ts";
import { priceText } from "./price.ts";

// Built from the current language's texts, so the test does not depend on (or change) it.
const tx = (key: string, params: Record<string, string>) => translate(dictionaries[i18n.lang()], key, params);

Deno.test("priceText adds a car's unit, and nothing for other listings", () => {
  const exact = (n: number) => tx("price.exact", { price: formatPrice(n) });
  assertEquals(priceText({ price_manat: 1500, price_is_from: false }), exact(1500));
  assertEquals(
    priceText({ price_manat: 800, price_is_from: false, attributes: { price_unit: "hour" } }),
    tx("price.per_hour", { price: exact(800) }),
  );
  assertEquals(
    priceText({ price_manat: 800, price_is_from: true, attributes: { price_unit: "day" } }),
    tx("price.per_day", { price: tx("price.from", { price: formatPrice(800) }) }),
  );
  assertEquals(priceText({ price_manat: 5000, price_is_from: false, attributes: { guests: 200 } }), exact(5000));
});
