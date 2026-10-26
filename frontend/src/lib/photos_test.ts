import { assert, assertEquals } from "@std/assert";
import { CATEGORIES } from "./catalog.ts";
import { categoryPhoto, PHOTOS, photoStyle } from "./photos.ts";

Deno.test("every category has its own photo", () => {
  const srcs = CATEGORIES.map((c) => categoryPhoto(c.slug)?.src);
  assert(srcs.every(Boolean), JSON.stringify(srcs));
  assertEquals(new Set(srcs).size, CATEGORIES.length);
  assertEquals(categoryPhoto("boats"), undefined);
});

Deno.test("every photo names its author, licence and source for the credits page", () => {
  for (const [key, p] of Object.entries(PHOTOS)) {
    assert(p.src.startsWith("/photos/") && p.author.trim() !== "", key);
    assert(/^CC BY(-SA)? \d\.\d$/.test(p.license), `${key}: ${p.license}`);
    assert(p.licenseUrl.startsWith("https://creativecommons.org/licenses/"), key);
    assert(p.source.startsWith("https://commons.wikimedia.org/wiki/File:"), key);
  }
});

Deno.test("photoStyle sets the picture and its position", () => {
  assertEquals(photoStyle(PHOTOS.cars), { "background-image": 'url("/photos/cars.jpg")', "background-position": "88% 60%" });
  assertEquals(photoStyle(undefined), undefined);
});
