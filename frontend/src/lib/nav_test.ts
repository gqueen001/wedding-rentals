import { assertEquals } from "@std/assert";
import { activeTab } from "./nav.ts";

Deno.test("each public page lights up its bottom-bar tab", () => {
  const cases: Record<string, ReturnType<typeof activeTab>> = {
    "/": "home",
    "/categories": "categories",
    "/c/cars": "categories",
    "/dresses": "categories",
    "/dresses/12": "categories",
    "/items/30": "categories",
    "/favorites": "favorites",
    "/more": "more",
    "/credits": "more",
    "/search": "home",
    "/shops/ak-gelin": "more",
    "/admin/listings": null,
    "/shop": null,
    "/shop/login": null,
    "/cars": null,
    "/dressesx": null,
  };
  for (const [path, want] of Object.entries(cases)) assertEquals(activeTab(path), want, path);
});
