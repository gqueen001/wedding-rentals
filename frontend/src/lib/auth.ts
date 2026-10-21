import { type Accessor, createSignal } from "solid-js";
import { type KV, safeKV } from "./storage.ts";

const ADMIN_TOKEN_KEY = "wr.admin_token";

export interface Auth {
  token: Accessor<string | null>;
  set(token: string): void;
  clear(): void;
}

/** A signed-in session kept in storage under key; admins and shop owners each have their own. */
export function createAuth(kv: KV, key = ADMIN_TOKEN_KEY): Auth {
  const [token, setToken] = createSignal<string | null>(kv.get(key));
  return {
    token,
    set(next) {
      kv.set(key, next);
      setToken(next);
    },
    clear() {
      kv.remove(key);
      setToken(null);
    },
  };
}

export const auth = createAuth(safeKV());
