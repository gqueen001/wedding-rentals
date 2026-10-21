import { assert, assertEquals } from "@std/assert";
import en from "./en.json" with { type: "json" };
import ru from "./ru.json" with { type: "json" };
import tk from "./tk.json" with { type: "json" };
import { createI18n, translate } from "./i18n.ts";
import { memoryKV } from "../lib/storage.ts";
import { COLORS, SILHOUETTES, SLEEVES } from "../lib/types.ts";

const dicts: Record<string, Record<string, string>> = { tk, ru, en };

// Every error code the Go API can return, plus the client-side network_error.
const API_ERROR_CODES = [
  "validation_failed", "not_found", "conflict", "invalid_reference", "invalid_json",
  "body_too_large", "internal_error", "invalid_credentials", "unauthorized", "rate_limited",
  "file_too_large", "image_too_large", "invalid_image", "network_error",
];
// Every value the Go API puts in error.fields.
const FIELD_VALUES = [
  "required", "invalid", "too_long", "too_many", "too_large", "must_be_positive", "out_of_range", "taken",
  "too_short",
  "exactly_one_of_listing_id_or_shop_id", "must_list_all_images_of_one_listing",
];

Deno.test("tk, ru and en have exactly the same keys", () => {
  const keys = (d: object) => Object.keys(d).sort();
  assertEquals(keys(tk), keys(en));
  assertEquals(keys(ru), keys(en));
});

Deno.test("every message is a non-empty string", () => {
  for (const [lang, dict] of Object.entries(dicts)) {
    for (const [key, value] of Object.entries(dict)) {
      assert(typeof value === "string" && value.trim() !== "", `${lang} ${key} is empty`);
    }
  }
});

Deno.test("placeholders are the same in every language", () => {
  const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
  for (const key of Object.keys(en)) {
    const want = placeholders(dicts.en[key]);
    assertEquals(placeholders(dicts.tk[key]), want, `tk ${key}`);
    assertEquals(placeholders(dicts.ru[key]), want, `ru ${key}`);
  }
});

Deno.test("every enum value, API error code and field value has a message", () => {
  const needed = [
    ...COLORS.map((c) => `color.${c}`),
    ...SILHOUETTES.map((s) => `silhouette.${s}`),
    ...SLEEVES.map((s) => `sleeves.${s}`),
    ...API_ERROR_CODES.map((c) => `error.${c}`),
    ...FIELD_VALUES.map((v) => `field.${v}`),
  ];
  for (const key of needed) assert(key in en, `missing ${key}`);
});

Deno.test("translate fills params, then falls back to English, then to the key", () => {
  assertEquals(translate({ a: "Salam, {name}!" }, "a", { name: "Aýna" }), "Salam, Aýna!");
  assertEquals(translate({ a: "{x} {y}" }, "a", { x: 1 }), "1 {y}");
  assertEquals(translate({}, "app.name"), en["app.name"]);
  assertEquals(translate({}, "no.such.key"), "no.such.key");
});

Deno.test("createI18n defaults to Turkmen and remembers the chosen language", () => {
  const kv = memoryKV();
  const i = createI18n(kv);
  assertEquals(i.lang(), "tk");
  assertEquals(i.t("nav.dresses"), tk["nav.dresses"]);
  i.setLang("ru");
  assertEquals(i.t("nav.dresses"), ru["nav.dresses"]);
  assertEquals(kv.get("wr.lang"), "ru");
  assertEquals(createI18n(kv).lang(), "ru");
  assertEquals(createI18n(memoryKV({ "wr.lang": "de" })).lang(), "tk");
});

Deno.test("every month and weekday has a name", () => {
  for (let n = 1; n <= 12; n++) {
    for (const key of [`cal.month.${n}`, `cal.month_of.${n}`]) assert(key in en, `missing ${key}`);
  }
  for (let n = 1; n <= 7; n++) assert(`cal.weekday.${n}` in en, `missing cal.weekday.${n}`);
});
