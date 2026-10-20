import { assertEquals } from "@std/assert";
import { ApiError } from "./api.ts";
import { errorMessage, fieldMessage, isNotFound, validationFields } from "./errors.ts";
import { dictionaries, translate } from "../i18n/i18n.ts";

const tr = (key: string) => translate(dictionaries.en, key);

Deno.test("errorMessage translates known API codes and falls back to the generic text", () => {
  assertEquals(errorMessage(new ApiError(429, "rate_limited", "x"), tr), dictionaries.en["error.rate_limited"]);
  assertEquals(errorMessage(new ApiError(500, "brand_new_code", "x"), tr), dictionaries.en["error.generic"]);
  assertEquals(errorMessage(new Error("boom"), tr), dictionaries.en["error.generic"]);
});

Deno.test("fieldMessage translates field values and falls back to invalid", () => {
  assertEquals(fieldMessage("required", tr), dictionaries.en["field.required"]);
  assertEquals(fieldMessage("something_new", tr), dictionaries.en["field.invalid"]);
});

Deno.test("validationFields only reads validation errors", () => {
  assertEquals(validationFields(new ApiError(400, "validation_failed", "x", { name: "required" })), { name: "required" });
  assertEquals(validationFields(new ApiError(409, "conflict", "x")), {});
  assertEquals(validationFields("nope"), {});
});

Deno.test("isNotFound is true only for 404 ApiErrors", () => {
  assertEquals(isNotFound(new ApiError(404, "not_found", "x")), true);
  assertEquals(isNotFound(new ApiError(500, "internal_error", "x")), false);
  assertEquals(isNotFound(undefined), false);
});
