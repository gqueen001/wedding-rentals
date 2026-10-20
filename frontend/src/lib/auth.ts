import { type Accessor, createSignal } from "solid-js";
import { type KV, safeKV } from "./storage.ts";

const TOKEN_KEY = "wr.admin_token";

export interface Auth {
  token: Accessor<string | null>;
  set(token: string): void;
  clear(): void;
}

export function createAuth(kv: KV): Auth {
  const [token, setToken] = createSignal<string | null>(kv.get(TOKEN_KEY));
  return {
    token,
    set(next) {
      kv.set(TOKEN_KEY, next);
      setToken(next);
    },
    clear() {
      kv.remove(TOKEN_KEY);
      setToken(null);
    },
  };
}

export const auth = createAuth(safeKV());
