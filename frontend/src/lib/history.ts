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

/** The router stamps each history entry with its depth; the first entry this visit opened on is the landing. */
type HistoryLike = { state: unknown };
const depthOf = (h: HistoryLike): number => {
  const d = (h.state as { _depth?: unknown } | null)?._depth;
  return typeof d === "number" ? d : 0;
};

export interface BackTracker {
  /** Call once, when the app first mounts: the current entry is where this visit landed. */
  markLanding(h?: HistoryLike): void;
  /** True when Back would stay on this site: we have moved forward from the landing page. */
  canGoBack(h?: HistoryLike): boolean;
}

export function createBackTracker(): BackTracker {
  let landing: number | null = null;
  return {
    markLanding(h = window.history) {
      landing ??= depthOf(h);
    },
    canGoBack(h = window.history) {
      return landing !== null && depthOf(h) > landing;
    },
  };
}

export const backTracker = createBackTracker();
