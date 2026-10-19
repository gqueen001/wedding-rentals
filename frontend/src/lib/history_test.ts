import { assertEquals } from "@std/assert";
import { consumeTraversal, markTraversal } from "./history.ts";

Deno.test("a traversal is consumed once", () => {
  assertEquals(consumeTraversal(1000), false);
  markTraversal(1000);
  assertEquals(consumeTraversal(1200), true);
  assertEquals(consumeTraversal(1300), false);
});

Deno.test("an old traversal does not count for a later fresh visit", () => {
  markTraversal(1000);
  assertEquals(consumeTraversal(5000), false);
});
