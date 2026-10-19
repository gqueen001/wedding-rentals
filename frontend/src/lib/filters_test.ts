import { assertEquals } from "@std/assert";
import { countActiveFilters, EMPTY_FILTERS, type Filters, filtersToQuery, parseFilters } from "./filters.ts";

const full: Filters = {
  q: "ak gelin", city: "mary", priceMin: 500, priceMax: 3000, size: "M", color: "ivory",
  style: "mermaid", sleeves: "none",
};

Deno.test("filters survive a round trip through the URL", () => {
  assertEquals(parseFilters(filtersToQuery(full)), full);
  assertEquals(parseFilters(new URLSearchParams()), EMPTY_FILTERS);
});

Deno.test("filtersToQuery uses a fixed key order and leaves out empty values", () => {
  assertEquals(
    filtersToQuery(full).toString(),
    "q=ak+gelin&city=mary&price_min=500&price_max=3000&size=M&color=ivory&style=mermaid&sleeves=none",
  );
  assertEquals(filtersToQuery(EMPTY_FILTERS).toString(), "");
  assertEquals(filtersToQuery({ ...EMPTY_FILTERS, priceMin: 0 }).toString(), "price_min=0");
});

Deno.test("parseFilters drops unknown and invalid values", () => {
  const f = parseFilters(
    new URLSearchParams("size=XXXL&color=red&style=tent&sleeves=half&price_min=abc&price_max=-5&q=%20ak%20"),
  );
  assertEquals(f, { ...EMPTY_FILTERS, q: "ak" });
  assertEquals(parseFilters(new URLSearchParams("price_min=99999999999")).priceMin, null);
});

Deno.test("countActiveFilters ignores the search text", () => {
  assertEquals(countActiveFilters(EMPTY_FILTERS), 0);
  assertEquals(countActiveFilters({ ...EMPTY_FILTERS, q: "ak" }), 0);
  assertEquals(countActiveFilters(full), 7);
});
