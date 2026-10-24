import { createEffect, type JSX, on, onCleanup, Show } from "solid-js";
import { t } from "../i18n/i18n.ts";
import { focusFirst, lockScroll, trapTab } from "../lib/dom.ts";
import { CloseIcon } from "./icons.tsx";

/**
 * A bottom-sheet dialog: it locks page scroll, moves focus inside, keeps Tab inside, closes on
 * Escape or a tap outside, and gives focus back to the opener when it closes.
 */
export default function Sheet(props: {
  open: boolean;
  title: string;
  onClose: () => void;
  /** Called each time the sheet opens, before it is shown. */
  onOpen?: () => void;
  children: JSX.Element;
  footer: JSX.Element;
}) {
  let panel: HTMLDivElement | undefined;
  createEffect(on(() => props.open, (open) => {
    if (!open) return;
    props.onOpen?.();
    const opener = document.activeElement as HTMLElement | null;
    const unlock = lockScroll();
    queueMicrotask(() => panel && focusFirst(panel));
    onCleanup(() => {
      unlock();
      opener?.focus();
    });
  }));

  return (
    <Show when={props.open}>
      <div
        class="fixed inset-0 z-40"
        onKeyDown={(e) => {
          if (e.key === "Escape") props.onClose();
          else if (panel) trapTab(e, panel);
        }}
      >
        <div class="absolute inset-0 bg-black/50" aria-hidden="true" onClick={() => props.onClose()} />
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-labelledby="sheet-title"
          tabindex="-1"
          class="sheet-enter outline-none absolute inset-x-0 bottom-0 mx-auto flex max-h-[88vh] max-w-lg flex-col rounded-t-2xl bg-white"
        >
          <div class="flex items-center justify-between border-b border-veil px-5 py-2">
            <h2 id="sheet-title" class="text-2xl">{props.title}</h2>
            <button type="button" class="btn-icon" aria-label={t("common.close")} onClick={() => props.onClose()}>
              <CloseIcon />
            </button>
          </div>
          <div class="flex-1 space-y-6 overflow-y-auto px-5 py-5">{props.children}</div>
          <div class="flex gap-3 border-t border-veil px-5 py-3">{props.footer}</div>
        </div>
      </div>
    </Show>
  );
}
