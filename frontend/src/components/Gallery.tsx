import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { t } from "../i18n/i18n.ts";
import { lockScroll, prefersReducedMotion, trapTab } from "../lib/dom.ts";
import type { Image } from "../lib/types.ts";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "./icons.tsx";

/** Full-screen photos: swipe or arrow keys to move, tap the photo to zoom in and pan. */
function PhotoViewer(props: { images: Image[]; start: number; title: string; onClose: () => void }) {
  const [index, setIndex] = createSignal(props.start);
  const [zoomed, setZoomed] = createSignal(false);
  const total = () => props.images.length;
  const label = (i: number) => t("dress.photo", { n: i + 1, total: total() });
  const go = (delta: number) => {
    setZoomed(false);
    setIndex((i) => Math.min(total() - 1, Math.max(0, i + delta)));
    // A nav button that just became disabled drops keyboard focus; keep it in the dialog.
    queueMicrotask(() => {
      const active = document.activeElement;
      if (active instanceof HTMLButtonElement && active.disabled) dialog.focus();
    });
  };
  let dialog!: HTMLDivElement;
  let closeButton!: HTMLButtonElement;
  let touchX: number | null = null;

  onMount(() => {
    const opener = document.activeElement as HTMLElement | null;
    const unlock = lockScroll();
    closeButton.focus();
    onCleanup(() => {
      unlock();
      opener?.focus();
    });
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") props.onClose();
    else if (e.key === "ArrowLeft") go(-1);
    else if (e.key === "ArrowRight") go(1);
    else trapTab(e, dialog);
  };

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label={props.title}
      tabindex="-1"
      class="fixed inset-0 z-50 flex flex-col bg-ink text-white outline-none"
      onKeyDown={onKeyDown}
    >
      <div class="flex items-center justify-between px-3 py-2">
        <span class="text-sm tabular-nums">{label(index())}</span>
        <button
          ref={closeButton}
          type="button"
          class="btn-icon hover:bg-white/10"
          aria-label={t("common.close")}
          onClick={() => props.onClose()}
        >
          <CloseIcon />
        </button>
      </div>
      <div
        class="relative min-h-0 flex-1"
        classList={{ "overflow-auto": zoomed(), "flex items-center justify-center overflow-hidden": !zoomed() }}
        onTouchStart={(e) => {
          touchX = zoomed() ? null : e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchX === null) return;
          const dx = e.changedTouches[0].clientX - touchX;
          touchX = null;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        }}
      >
        <button
          type="button"
          class="block"
          classList={{ "h-full w-full": !zoomed() }}
          aria-pressed={zoomed()}
          aria-label={t("dress.zoom")}
          onClick={() => setZoomed(!zoomed())}
        >
          <img
            src={props.images[index()].large}
            alt={`${props.title}, ${label(index())}`}
            class={zoomed()
              ? "w-[200%] max-w-none cursor-zoom-out"
              : "mx-auto max-h-full max-w-full cursor-zoom-in object-contain"}
          />
        </button>
      </div>
      <Show when={total() > 1}>
        <div class="flex justify-between px-3 py-2">
          <button
            type="button"
            class="btn-icon hover:bg-white/10"
            disabled={index() === 0}
            aria-label={label(Math.max(0, index() - 1))}
            onClick={() => go(-1)}
          >
            <ChevronLeftIcon class="h-6 w-6" />
          </button>
          <button
            type="button"
            class="btn-icon hover:bg-white/10"
            disabled={index() === total() - 1}
            aria-label={label(Math.min(total() - 1, index() + 1))}
            onClick={() => go(1)}
          >
            <ChevronRightIcon class="h-6 w-6" />
          </button>
        </div>
      </Show>
    </div>
  );
}

/** Swipeable photos (CSS scroll snap) with position dots; tapping a photo opens the viewer. */
export default function Gallery(props: { images: Image[]; title: string }) {
  const [index, setIndex] = createSignal(0);
  const [viewer, setViewer] = createSignal<number | null>(null);
  let track!: HTMLDivElement;
  const total = () => props.images.length;
  const label = (i: number) => t("dress.photo", { n: i + 1, total: total() });
  const goTo = (i: number) =>
    track.scrollTo({ left: i * track.clientWidth, behavior: prefersReducedMotion() ? "auto" : "smooth" });

  return (
    <Show
      when={total() > 0}
      fallback={
        <div class="-mx-4 flex aspect-[3/4] items-center justify-center bg-veil text-silver-ink sm:mx-0">
          {t("dress.no_photos")}
        </div>
      }
    >
      <section aria-label={t("dress.gallery")} class="-mx-4 sm:mx-0">
        <div
          ref={track}
          class="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={() => setIndex(Math.round(track.scrollLeft / Math.max(1, track.clientWidth)))}
        >
          <For each={props.images}>
            {(img, i) => (
              <button
                type="button"
                class="w-full shrink-0 snap-center"
                aria-label={t("dress.open_photo", { n: i() + 1 })}
                onClick={() => setViewer(i())}
              >
                <img
                  src={img.large}
                  srcset={`${img.small} 400w, ${img.large} 1200w`}
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  alt={`${props.title}, ${label(i())}`}
                  loading={i() === 0 ? "eager" : "lazy"}
                  decoding="async"
                  class="aspect-[3/4] w-full bg-veil object-cover"
                />
              </button>
            )}
          </For>
        </div>
        <Show when={total() > 1}>
          <div class="mt-1 flex justify-center">
            <For each={props.images}>
              {(_, i) => (
                <button
                  type="button"
                  class="flex h-8 w-8 items-center justify-center"
                  aria-label={label(i())}
                  aria-current={index() === i() ? "true" : undefined}
                  onClick={() => goTo(i())}
                >
                  <span
                    class="h-2 w-2 rounded-full"
                    classList={{ "bg-garnet": index() === i(), "bg-silver": index() !== i() }}
                  />
                </button>
              )}
            </For>
          </div>
        </Show>
      </section>
      <Show when={viewer() !== null}>
        <PhotoViewer images={props.images} start={viewer()!} title={props.title} onClose={() => setViewer(null)} />
      </Show>
    </Show>
  );
}
