import { assertEquals } from "@std/assert";
import { EMPTY_ITEM_FILTERS } from "./itemFilters.ts";
import { parseSearch, searchHref, searchQuery } from "./search.ts";

Deno.test("parseSearch reads the category and its filters, and ignores an unknown category", () => {
  const s = parseSearch(new URLSearchParams("q=ak&category=cars&city=mary&price_min=100&body=suv&size=M"));
  assertEquals(s.category?.slug, "cars");
  assertEquals(s.filters, { q: "ak", city: "mary", priceMin: 100, priceMax: null, attrs: { body: "suv" } });
  const unknown = parseSearch(new URLSearchParams("category=boats&body=suv&price_max=900"));
  assertEquals(unknown.category, undefined);
  assertEquals(unknown.filters, { ...EMPTY_ITEM_FILTERS, priceMax: 900 });
});

Deno.test("searchHref round-trips every param", () => {
  const filters = { q: "ak", city: "mary", priceMin: 100, priceMax: 900, attrs: { body: "limousine", seats_min: "4" } };
  const href = searchHref("cars", filters);
  assertEquals(href, "/search?q=ak&city=mary&price_min=100&price_max=900&body=limousine&seats_min=4&category=cars");
  const back = parseSearch(new URLSearchParams(href.slice(href.indexOf("?") + 1)));
  assertEquals(back.category?.slug, "cars");
  assertEquals(back.filters, filters);
  assertEquals(searchHref("", EMPTY_ITEM_FILTERS), "/search");
});

Deno.test("changing the category keeps the shared filters and drops the old category's own", () => {
  const cars = { ...EMPTY_ITEM_FILTERS, q: "ak", city: "mary", priceMax: 900, attrs: { body: "suv", color: "white", seats_min: "4" } };
  assertEquals(searchHref("tents", cars), "/search?q=ak&city=mary&price_max=900&category=tents");
  assertEquals(searchHref("", cars), "/search?q=ak&city=mary&price_max=900");
  // Dresses have no catalog filters of their own: only the shared ones are kept.
  assertEquals(searchQuery({ category: parseSearch(new URLSearchParams("category=dresses")).category, filters: cars }).toString(),
    "q=ak&city=mary&price_max=900&category=dresses");
});
