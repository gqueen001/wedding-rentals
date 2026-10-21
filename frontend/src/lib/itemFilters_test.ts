import { assertEquals } from "@std/assert";
import { categoryDef } from "./catalog.ts";
import { countItemFilters, EMPTY_ITEM_FILTERS, itemFiltersToQuery, parseItemFilters } from "./itemFilters.ts";

const cars = categoryDef("cars")!;

Deno.test("parseItemFilters keeps only the category's valid filters", () => {
  const f = parseItemFilters(cars, new URLSearchParams("q= ak &city=mary&price_max=900&body=suv&color=green&seats_min=70&size=M"));
  assertEquals(f, { q: "ak", city: "mary", priceMin: null, priceMax: 900, attrs: { body: "suv" } });
  assertEquals(parseItemFilters(cars, new URLSearchParams("seats_min=05")).attrs, { seats_min: "5" });
});

Deno.test("itemFiltersToQuery writes a stable order and round-trips", () => {
  const f = { ...EMPTY_ITEM_FILTERS, city: "mary", attrs: { seats_min: "4", body: "limousine" } };
  const query = itemFiltersToQuery(cars, f);
  assertEquals(query.toString(), "city=mary&body=limousine&seats_min=4");
  assertEquals(parseItemFilters(cars, query), f);
  // A value the category does not accept is left out.
  assertEquals(itemFiltersToQuery(cars, { ...EMPTY_ITEM_FILTERS, attrs: { body: "truck" } }).toString(), "");
});

Deno.test("countItemFilters counts the sheet's filters, not the search", () => {
  assertEquals(countItemFilters({ ...EMPTY_ITEM_FILTERS, q: "ak" }), 0);
  assertEquals(countItemFilters({ ...EMPTY_ITEM_FILTERS, city: "mary", priceMin: 100, attrs: { body: "suv" } }), 3);
});
