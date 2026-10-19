const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Keeps Tab and Shift+Tab inside a dialog. */
export function trapTab(e: KeyboardEvent, container: HTMLElement) {
  if (e.key !== "Tab") return;
  const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
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
