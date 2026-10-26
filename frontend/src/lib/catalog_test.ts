import { assert, assertEquals } from "@std/assert";
import { CATEGORIES, categoryDef, categoryHref, categoryPicture, ITEM_CATEGORIES, listingHref } from "./catalog.ts";

Deno.test("dresses come first and keep their own pages", () => {
  assertEquals(CATEGORIES[0].slug, "dresses");
  assertEquals(CATEGORIES[0].own_pages, true);
  assertEquals(ITEM_CATEGORIES.map((c) => c.slug), ["cars", "national-clothes", "tents", "car-decorations"]);
});

Deno.test("every filter belongs to a choice or number field", () => {
  for (const c of CATEGORIES) {
    for (const f of c.fields) {
      if (!f.filter) continue;
      if (f.filter.kind === "min") assertEquals(f.kind, "number", `${c.slug}.${f.key}`);
      else assert(f.options && f.options.length > 0, `${c.slug}.${f.key} has no options`);
    }
  }
  assertEquals(categoryDef("cars")?.fields.find((f) => f.key === "seats")?.filter, { param: "seats_min", kind: "min" });
  assertEquals(categoryDef("boats"), undefined);
});

Deno.test("links go to each category's own pages", () => {
  assertEquals(categoryHref("dresses"), "/dresses");
  assertEquals(categoryHref("tents"), "/c/tents");
  assertEquals(listingHref({ id: 4, category: "dresses" }), "/dresses/4");
  assertEquals(listingHref({ id: 4 }), "/dresses/4"); // dress lists send no category
  assertEquals(listingHref({ id: 5, category: "cars" }), "/items/5");
});

Deno.test("each category's picture is its own file under /art", () => {
  assertEquals(categoryPicture("national-clothes"), "/art/national-clothes.svg");
  assertEquals(new Set(CATEGORIES.map((c) => categoryPicture(c.slug))).size, CATEGORIES.length);
});
