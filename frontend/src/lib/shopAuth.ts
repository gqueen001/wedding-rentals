import { createAuth } from "./auth.ts";
import { safeKV } from "./storage.ts";

export const SHOP_TOKEN_KEY = "wr.shop_token";

/** The shop owner's session, kept apart from the admin's. */
export const shopAuth = createAuth(safeKV(), SHOP_TOKEN_KEY);
