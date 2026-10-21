import { assertEquals } from "@std/assert";
import { createAuth } from "./auth.ts";
import { SHOP_TOKEN_KEY } from "./shopAuth.ts";
import { memoryKV } from "./storage.ts";

Deno.test("auth starts from the stored token", () => {
  assertEquals(createAuth(memoryKV()).token(), null);
  assertEquals(createAuth(memoryKV({ "wr.admin_token": "abc" })).token(), "abc");
});

Deno.test("set stores the token and clear removes it", () => {
  const kv = memoryKV();
  const auth = createAuth(kv);
  auth.set("jwt");
  assertEquals(auth.token(), "jwt");
  assertEquals(kv.get("wr.admin_token"), "jwt");
  auth.clear();
  assertEquals(auth.token(), null);
  assertEquals(kv.get("wr.admin_token"), null);
});

Deno.test("a shop owner's session is stored apart from the admin's", () => {
  const kv = memoryKV({ "wr.admin_token": "admin-jwt" });
  const shop = createAuth(kv, SHOP_TOKEN_KEY);
  assertEquals(shop.token(), null);
  shop.set("shop-jwt");
  assertEquals(kv.get("wr.shop_token"), "shop-jwt");
  shop.clear();
  assertEquals(kv.get("wr.admin_token"), "admin-jwt");
});
