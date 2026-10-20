import { assertEquals } from "@std/assert";
import { createFavorites, FAVORITES_KEY, MAX_FAVORITES } from "./favorites.ts";
import { memoryKV } from "./storage.ts";

Deno.test("toggle adds the newest first and persists", () => {
  const kv = memoryKV();
  const fav = createFavorites(kv);
  assertEquals(fav.ids(), []);
  fav.toggle(5);
  fav.toggle(9);
  assertEquals(fav.ids(), [9, 5]);
  assertEquals(fav.has(5), true);
  assertEquals(JSON.parse(kv.get(FAVORITES_KEY)!), [9, 5]);
});

Deno.test("toggle removes an existing favorite", () => {
  const fav = createFavorites(memoryKV({ [FAVORITES_KEY]: "[3,4]" }));
  fav.toggle(3);
  assertEquals(fav.ids(), [4]);
  assertEquals(fav.has(3), false);
});

Deno.test("corrupted or invalid stored values are ignored", () => {
  assertEquals(createFavorites(memoryKV({ [FAVORITES_KEY]: "not json" })).ids(), []);
  assertEquals(createFavorites(memoryKV({ [FAVORITES_KEY]: '{"a":1}' })).ids(), []);
  assertEquals(createFavorites(memoryKV({ [FAVORITES_KEY]: '[1,"2",-3,1.5,4,4]' })).ids(), [1, 4]);
});

Deno.test("favorites are capped and the oldest one is dropped", () => {
  const fav = createFavorites(memoryKV());
  for (let id = 1; id <= MAX_FAVORITES + 1; id++) fav.toggle(id);
  assertEquals(fav.ids().length, MAX_FAVORITES);
  assertEquals(fav.ids()[0], MAX_FAVORITES + 1);
  assertEquals(fav.has(1), false);
});

Deno.test("keepOnly silently drops ids that no longer exist", () => {
  const kv = memoryKV({ [FAVORITES_KEY]: "[7,8,9]" });
  const fav = createFavorites(kv);
  fav.keepOnly([9, 7]);
  assertEquals(fav.ids(), [7, 9]);
  assertEquals(JSON.parse(kv.get(FAVORITES_KEY)!), [7, 9]);
});
