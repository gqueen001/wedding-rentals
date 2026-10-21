import { assertEquals } from "@std/assert";
import { hasOwnChrome } from "./areas.ts";

Deno.test("admin and My shop pages bring their own chrome, public shop pages do not", () => {
  for (const path of ["/admin", "/admin/shops/3", "/shop", "/shop/login", "/shop/dresses/4"]) {
    assertEquals(hasOwnChrome(path), true, path);
  }
  for (const path of ["/", "/shops/ak-gelin", "/shopping", "/dresses/4", "/administrator"]) {
    assertEquals(hasOwnChrome(path), false, path);
  }
});
