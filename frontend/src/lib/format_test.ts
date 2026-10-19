import { assertEquals } from "@std/assert";
import { cityName, formatPrice, telHref } from "./format.ts";

const NBSP = " ";

Deno.test("formatPrice groups thousands with a no-break space", () => {
  assertEquals(formatPrice(0), "0");
  assertEquals(formatPrice(950), "950");
  assertEquals(formatPrice(1500), `1${NBSP}500`);
  assertEquals(formatPrice(1234567), `1${NBSP}234${NBSP}567`);
});

Deno.test("cityName picks the name for the language", () => {
  const mary = { slug: "mary", name_tk: "Mary", name_ru: "Мары", name_en: "Mary" };
  assertEquals(cityName(mary, "tk"), "Mary");
  assertEquals(cityName(mary, "ru"), "Мары");
  assertEquals(cityName(mary, "en"), "Mary");
});

Deno.test("telHref keeps only digits and a leading plus", () => {
  assertEquals(telHref("+993 (65) 12-34-56"), "tel:+99365123456");
  assertEquals(telHref("8 12 34 56 78"), "tel:812345678");
});
