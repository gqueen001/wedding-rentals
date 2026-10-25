import { assertEquals } from "@std/assert";
import { consumeTraversal, createBackTracker, markTraversal } from "./history.ts";

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

Deno.test("Back stays on the site only after moving on from the landing page", () => {
  const t = createBackTracker();
  const at = (depth: number | undefined) => ({ state: depth === undefined ? null : { _depth: depth } });
  assertEquals(t.canGoBack(at(3)), false); // nothing marked yet
  t.markLanding(at(1)); // opened in a tab that already had one page
  t.markLanding(at(5)); // later calls do not move the landing
  assertEquals(t.canGoBack(at(1)), false);
  assertEquals(t.canGoBack(at(2)), true);
  assertEquals(t.canGoBack(at(undefined)), false); // an entry the router has not stamped counts as depth 0
});
