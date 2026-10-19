/** A tiny key-value store that never throws (private mode, blocked storage, tests). */
export interface KV {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export function memoryKV(initial: Record<string, string> = {}): KV {
  const m = new Map(Object.entries(initial));
  return {
    get: (k) => m.get(k) ?? null,
    set: (k, v) => void m.set(k, v),
    remove: (k) => void m.delete(k),
  };
}

function browserStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // some browsers throw just for touching localStorage
  }
}

/** Wraps a Web Storage object and falls back to memory when it is missing or throws. */
export function safeKV(storage: Storage | null = browserStorage()): KV {
  const fallback = memoryKV();
  function attempt<T>(fn: (s: Storage) => T, alt: () => T): T {
    if (storage) {
      try {
        return fn(storage);
      } catch {
        // blocked or full: use memory for this page view
      }
    }
    return alt();
  }
  return {
    get: (k) => attempt((s) => s.getItem(k) ?? fallback.get(k), () => fallback.get(k)),
    set: (k, v) => attempt((s) => s.setItem(k, v), () => fallback.set(k, v)),
    remove: (k) => attempt((s) => s.removeItem(k), () => fallback.remove(k)),
  };
}
