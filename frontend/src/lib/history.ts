/** Remembers that the last navigation was Back/Forward, so a page can tell it from a fresh visit. */
const FRESH_MS = 1000;

let traversedAt = Number.NEGATIVE_INFINITY;

export function markTraversal(now = Date.now()) {
  traversedAt = now;
}

/** True once per Back/Forward, and only if it happened just now: a later fresh visit gets false. */
export function consumeTraversal(now = Date.now()): boolean {
  const fresh = now - traversedAt <= FRESH_MS;
  traversedAt = Number.NEGATIVE_INFINITY;
  return fresh;
}

/** Call before the router starts, so this listener runs ahead of its own. */
export function trackTraversals(win: Pick<Window, "addEventListener"> = window) {
  win.addEventListener("popstate", () => markTraversal());
}
