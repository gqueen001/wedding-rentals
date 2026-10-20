import { type Accessor, batch, createSignal } from "solid-js";
import type { Page } from "./types.ts";

/** What is loaded so far; enough to bring a list back without fetching. */
export interface PagedSnapshot<T> {
  items: T[];
  total: number;
  loaded: number;
}

export interface PagedList<T> {
  items: Accessor<T[]>;
  total: Accessor<number>;
  loading: Accessor<boolean>;
  error: Accessor<unknown>;
  hasMore: () => boolean;
  /** The loaded pages, to hand to restore() later. */
  snapshot(): PagedSnapshot<T>;
  /** Replaces the list with a snapshot without fetching; a request in flight is ignored. */
  restore(s: PagedSnapshot<T>): void;
  /** Clears everything and loads page 1. */
  reset(): Promise<void>;
  /** Loads the next page unless one is loading, the last one failed, or there is none. */
  loadMore(): Promise<void>;
  /** Loads the page that failed; does nothing while loading or when nothing failed. */
  retry(): Promise<void>;
}

/** Accumulates pages for infinite scroll; responses that arrive after a reset are ignored. */
export function createPagedList<T>(fetchPage: (page: number) => Promise<Page<T>>): PagedList<T> {
  const [items, setItems] = createSignal<T[]>([]);
  const [total, setTotal] = createSignal(0);
  const [loaded, setLoaded] = createSignal(0);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<unknown>(null);
  let generation = 0;

  async function load(pageNumber: number) {
    const gen = generation;
    setLoading(true);
    setError(null);
    try {
      const p = await fetchPage(pageNumber);
      if (gen !== generation) return;
      const next = pageNumber === 1 ? p.items : [...items(), ...p.items];
      batch(() => {
        setItems(() => next);
        // An empty page means the server has nothing more, whatever total says.
        setTotal(p.items.length === 0 ? next.length : p.total);
        setLoaded(pageNumber);
      });
    } catch (e) {
      if (gen === generation) setError(() => e);
    } finally {
      if (gen === generation) setLoading(false);
    }
  }

  const hasMore = () => loaded() > 0 && items().length < total();

  return {
    items,
    total,
    loading,
    error,
    hasMore,
    snapshot: () => ({ items: items(), total: total(), loaded: loaded() }),
    restore(s) {
      generation++;
      batch(() => {
        setItems(() => s.items);
        setTotal(s.total);
        setLoaded(s.loaded);
        setError(null);
        setLoading(false);
      });
    },
    reset() {
      generation++;
      batch(() => {
        setItems(() => []);
        setTotal(0);
        setLoaded(0);
        setError(null);
      });
      return load(1);
    },
    loadMore() {
      if (loading() || error() !== null || !hasMore()) return Promise.resolve();
      return load(loaded() + 1);
    },
    retry() {
      if (loading() || error() === null) return Promise.resolve();
      return load(loaded() + 1);
    },
  };
}
