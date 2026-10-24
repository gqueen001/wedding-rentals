import { assertEquals } from "@std/assert";
import { avatarLook } from "./avatar.ts";

Deno.test("avatarLook: signed out, loading, logo and letter", () => {
  const logo = { id: 1, position: 0, small: "/uploads/a_s.jpg", large: "/uploads/a_l.jpg", width: 10, height: 10 };
  assertEquals(avatarLook(false, null), "signed_out");
  // A salon left over from an earlier sign-in does not count once the token is gone.
  assertEquals(avatarLook(false, { logo }), "signed_out");
  assertEquals(avatarLook(true, null), "loading");
  assertEquals(avatarLook(true, { logo }), "logo");
  assertEquals(avatarLook(true, { logo: null }), "letter");
});
