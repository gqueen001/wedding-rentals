import { type Accessor, createSignal } from "solid-js";
import { type KV, safeKV } from "./storage.ts";

export const FAVORITES_KEY = "wr.favorites";
/** The API's per_page cap, so the favorites page loads them in one request. */
export const MAX_FAVORITES = 60;

function parse(raw: string | null): number[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    if (Array.isArray(value)) {
      const ids = value.filter((n): n is number => Number.isSafeInteger(n) && n > 0);
      return [...new Set(ids)].slice(0, MAX_FAVORITES);
    }
  } catch {
    // corrupted value: start over
  }
  return [];
}

export interface Favorites {
  ids: Accessor<number[]>;
  has(id: number): boolean;
  toggle(id: number): void;
  /** Drops saved ids that are not in `existing` (deleted or unpublished dresses). */
  keepOnly(existing: readonly number[]): void;
}

export function createFavorites(kv: KV): Favorites {
  const [ids, setIds] = createSignal(parse(kv.get(FAVORITES_KEY)));
  const save = (next: number[]) => {
    setIds(next);
    kv.set(FAVORITES_KEY, JSON.stringify(next));
  };
  return {
    ids,
    has: (id) => ids().includes(id),
    toggle(id) {
      const current = ids();
      save(current.includes(id) ? current.filter((x) => x !== id) : [id, ...current].slice(0, MAX_FAVORITES));
    },
    keepOnly(existing) {
      const keep = new Set(existing);
      const next = ids().filter((id) => keep.has(id));
      if (next.length !== ids().length) save(next);
    },
  };
}

export const favorites = createFavorites(safeKV());
