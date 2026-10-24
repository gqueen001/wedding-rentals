import { createApi } from "./api.ts";
import { auth } from "./auth.ts";
import { shopAuth } from "./shopAuth.ts";
import { createUploader } from "./upload.ts";

/** The session expired or was revoked: drop the token and ask to sign in again, then come back. */
function signInAgain(clear: () => void, loginPath: string) {
  return () => {
    clear();
    if (!location.pathname.startsWith(loginPath)) {
      location.assign(`${loginPath}?next=${encodeURIComponent(location.pathname + location.search)}`);
    }
  };
}

const fetchFn: typeof fetch = (input, init) => fetch(input, init);
const onAdminUnauthorized = signInAgain(() => auth.clear(), "/admin/login");
const onOwnerUnauthorized = signInAgain(() => shopAuth.clear(), "/shop/login");

/** Public calls and the admin's calls (admin token). */
export const api = createApi({ fetch: fetchFn, token: auth.token, onUnauthorized: onAdminUnauthorized });
export const uploadImage = createUploader({
  path: "/api/admin/images",
  token: auth.token,
  onUnauthorized: onAdminUnauthorized,
});

/** A shop owner's calls (shop token); use ownerApi.owner.*. */
export const ownerApi = createApi({ fetch: fetchFn, token: shopAuth.token, onUnauthorized: onOwnerUnauthorized });
/** The owner's own calls from public pages, e.g. the top-bar avatar: an expired session is dropped without a redirect. */
export const ownerProbeApi = createApi({ fetch: fetchFn, token: shopAuth.token, onUnauthorized: () => shopAuth.clear() });
export const uploadOwnerImage = createUploader({
  path: "/api/shop/images",
  token: shopAuth.token,
  onUnauthorized: onOwnerUnauthorized,
});
