import { assertEquals } from "@std/assert";
import { createAuth } from "./auth.ts";
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
