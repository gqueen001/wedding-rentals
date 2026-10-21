import { assertEquals } from "@std/assert";
import { contactPhone } from "./contact.ts";

const fake = (meta: { content: string } | null) => ({
  querySelector:
    ((sel: string) => sel === 'meta[name="wr-contact-phone"]' ? meta : null) as Document[
      "querySelector"
    ],
});

Deno.test("contactPhone returns the trimmed meta content", () => {
  assertEquals(contactPhone(fake({ content: "  +993 12 34 56 78 " })), "+993 12 34 56 78");
});

Deno.test("contactPhone is null when the tag is missing", () => {
  assertEquals(contactPhone(fake(null)), null);
});

Deno.test("contactPhone is null when the tag is blank", () => {
  assertEquals(contactPhone(fake({ content: "   " })), null);
});
