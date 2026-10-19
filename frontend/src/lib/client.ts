import { createApi } from "./api.ts";
import { auth } from "./auth.ts";
import { createUploader } from "./upload.ts";

/** The admin session expired or was revoked: drop the token and ask to sign in again. */
function onUnauthorized() {
  auth.clear();
  if (!location.pathname.startsWith("/admin/login")) {
    location.assign(`/admin/login?next=${encodeURIComponent(location.pathname + location.search)}`);
  }
}

export const api = createApi({ fetch: (input, init) => fetch(input, init), token: auth.token, onUnauthorized });
export const uploadImage = createUploader({ token: auth.token, onUnauthorized });
