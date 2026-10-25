import { assertEquals } from "@std/assert";
import { memoryKV } from "./storage.ts";
import { createTheme, nextTheme, parseTheme, THEME_KEY, themeAttr } from "./theme.ts";

Deno.test("parseTheme keeps light and dark, and treats anything else as auto", () => {
  assertEquals(parseTheme("light"), "light");
  assertEquals(parseTheme("dark"), "dark");
  assertEquals(parseTheme(null), "auto");
  assertEquals(parseTheme("auto"), "auto");
  assertEquals(parseTheme("sepia"), "auto");
});

Deno.test("themeAttr gives no attribute for auto", () => {
  assertEquals(themeAttr("auto"), null);
  assertEquals(themeAttr("light"), "light");
  assertEquals(themeAttr("dark"), "dark");
});

Deno.test("createTheme remembers a picked theme and forgets it on auto", () => {
  const kv = memoryKV({ [THEME_KEY]: "dark" });
  const t = createTheme(kv);
  assertEquals(t.choice(), "dark");
  t.set("light");
  assertEquals([t.choice(), kv.get(THEME_KEY)], ["light", "light"]);
  t.set("auto");
  assertEquals([t.choice(), kv.get(THEME_KEY)], ["auto", null]);
  assertEquals(createTheme(memoryKV({ [THEME_KEY]: "nonsense" })).choice(), "auto");
});

Deno.test("nextTheme cycles auto, light, dark and back to auto", () => {
  assertEquals(nextTheme("auto"), "light");
  assertEquals(nextTheme("light"), "dark");
  assertEquals(nextTheme("dark"), "auto");
});
