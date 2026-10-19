const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Keeps Tab and Shift+Tab inside a dialog. */
export function trapTab(e: KeyboardEvent, container: HTMLElement) {
  if (e.key !== "Tab") return;
  const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  const inside = active instanceof Node && container.contains(active) && active !== container;
  if (e.shiftKey && (!inside || active === first)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (!inside || active === last)) {
    e.preventDefault();
    first.focus();
  }
}

export function focusFirst(container: HTMLElement) {
  container.querySelector<HTMLElement>(FOCUSABLE)?.focus();
}

/** Stops the page behind a dialog from scrolling; returns the function that undoes it. */
export function lockScroll(): () => void {
  const previous = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  return () => {
    document.body.style.overflow = previous;
  };
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

let focusPending = false;

/** After navigation: moves focus to the page's <main>, or to the next one that mounts. */
export function focusMain() {
  const main = document.getElementById("main");
  if (main) {
    main.focus({ preventScroll: true });
    focusPending = false;
  } else {
    focusPending = true;
  }
}

/** The ref for a <main id="main">: takes the focus that focusMain could not give yet. */
export function mainRef(el: HTMLElement) {
  if (!focusPending) return;
  focusPending = false;
  queueMicrotask(() => el.focus({ preventScroll: true }));
}
