import { createEffect, on, untrack } from "solid-js";
import { consumeTraversal } from "./history.ts";
import { createPagedList, type PagedList, type PagedSnapshot } from "./paged.ts";
import type { Page } from "./types.ts";

/** Where a page keeps its last list, at module level so it outlives the page. */
export interface ListMemory<T> {
  saved?: { key: string; snapshot: PagedSnapshot<T> };
}

/**
 * A paged list for key (a query string). Back/Forward brings back the pages it had, filled in
 * at once so the router can restore the scroll position; any other visit, and every key
 * change, starts from a fresh first page.
 */
export function createRememberedList<T>(
  memory: ListMemory<T>,
  key: () => string,
  fetchPage: (page: number) => Promise<Page<T>>,
): PagedList<T> {
  const list = createPagedList(fetchPage);
  // The key the items on screen belong to.
  let listKey = "";
  const show = (k: string, mayRestore: boolean) => {
    listKey = k;
    if (mayRestore && memory.saved?.key === k) list.restore(memory.saved.snapshot);
    else void list.reset();
  };
  show(untrack(key), consumeTraversal());
  createEffect(on(key, (k) => show(k, false), { defer: true }));
  createEffect(() => {
    const snapshot = list.snapshot();
    if (snapshot.items.length > 0) memory.saved = { key: listKey, snapshot };
  });
  return list;
}
