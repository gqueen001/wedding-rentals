import { createSignal, For, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { t, tr } from "../../i18n/i18n.ts";
import { errorMessage } from "../../lib/errors.ts";
import { useManage } from "../../lib/manage.ts";
import type { Image } from "../../lib/types.ts";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, TrashIcon } from "../icons.tsx";

interface Upload {
  key: number;
  name: string;
  progress: number;
  error: unknown;
}

type Action = "earlier" | "later" | "delete";

const ACCEPT = "image/jpeg,image/png,image/webp";

export default function PhotoManager(props: {
  listingId: number;
  title: string;
  images: Image[];
  onChange: (images: Image[]) => void;
}) {
  const m = useManage();
  const [uploads, setUploads] = createStore<Upload[]>([]);
  const [dragging, setDragging] = createSignal<number | null>(null);
  const [dropActive, setDropActive] = createSignal(false);
  const [error, setError] = createSignal<unknown>(null);
  const [status, setStatus] = createSignal("");
  const [working, setWorking] = createSignal(false);
  // Only one change to the photo list at a time, so a rollback can never undo someone else's change.
  const busy = () => working() || uploads.some((u) => u.error === null);
  let list!: HTMLOListElement;
  let fileInput!: HTMLInputElement;
  let nextKey = 0;
  let queue: Promise<void> = Promise.resolve();

  /** Puts keyboard focus back on a photo tile's button after the list has re-rendered. */
  function focusTile(index: number, action: Action) {
    queueMicrotask(() => {
      const tiles = list?.isConnected ? list.querySelectorAll("li") : undefined;
      const tile = tiles?.[Math.min(index, (tiles?.length ?? 1) - 1)];
      const wanted = tile?.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
      const target = wanted && !wanted.disabled ? wanted : tile?.querySelector<HTMLButtonElement>('[data-action="delete"]');
      (target ?? fileInput)?.focus();
    });
  }

  // One upload at a time keeps memory low on the server's photo resizer.
  function addFiles(files: FileList | null | undefined) {
    for (const file of Array.from(files ?? [])) {
      const key = nextKey++;
      setUploads(uploads.length, { key, name: file.name, progress: 0, error: null });
      queue = queue.then(async () => {
        try {
          const img = await m.upload(
            file,
            { listingId: props.listingId },
            (p) => setUploads((u) => u.key === key, "progress", p),
          );
          props.onChange([...props.images, img]);
          setUploads((all) => all.filter((u) => u.key !== key));
        } catch (err) {
          setUploads((u) => u.key === key, "error", () => err);
        }
      });
    }
  }

  async function reorder(from: number, to: number, action: Action | null) {
    if (busy() || from === to || to < 0 || to >= props.images.length) return;
    const before = props.images;
    const next = [...before];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    props.onChange(next);
    setError(null);
    setWorking(true);
    try {
      await m.calls.reorderImages(next.map((i) => i.id));
      setStatus(t("photos.moved", { n: to + 1 }));
      if (action) focusTile(to, action);
    } catch (err) {
      props.onChange(before);
      setError(() => err);
      if (action) focusTile(from, action);
    } finally {
      setWorking(false);
    }
  }

  async function remove(img: Image, index: number) {
    if (busy() || !confirm(t("photos.delete_confirm"))) return;
    setError(null);
    setWorking(true);
    try {
      await m.calls.deleteImage(img.id);
      props.onChange(props.images.filter((i) => i.id !== img.id));
      setStatus(t("photos.deleted"));
      focusTile(index, "delete");
    } catch (err) {
      setError(() => err);
      focusTile(index, "delete");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div class="space-y-4">
      <div
        class="rounded-lg border-2 border-dashed p-6 text-center"
        classList={{ "border-garnet bg-blush": dropActive(), "border-silver": !dropActive() }}
        onDragOver={(e) => {
          if (e.dataTransfer?.types.includes("Files")) {
            e.preventDefault();
            setDropActive(true);
          }
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropActive(false);
        }}
        onDrop={(e) => {
          if (!e.dataTransfer?.files.length) return;
          e.preventDefault();
          setDropActive(false);
          if (!working()) addFiles(e.dataTransfer.files);
        }}
      >
        <p class="text-sm text-silver-ink">{t("photos.drop")}</p>
        <label class="btn btn-primary mt-3 cursor-pointer focus-within:outline-2 focus-within:outline-garnet">
          <PlusIcon />
          {t("photos.add")}
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            multiple
            class="sr-only"
            disabled={working()}
            onChange={(e) => {
              addFiles(e.currentTarget.files);
              e.currentTarget.value = "";
            }}
          />
        </label>
      </div>

      <p role="status" aria-live="polite" class="sr-only">{status()}</p>

      <For each={uploads}>
        {(u) => (
          <div class="text-sm">
            <Show
              when={u.error}
              fallback={
                <>
                  <p>{t("photos.uploading", { name: u.name, percent: Math.round(u.progress * 100) })}</p>
                  <progress class="mt-1 w-full accent-garnet" value={u.progress} max={1} />
                </>
              }
            >
              <div role="alert" class="flex items-center gap-3 text-garnet">
                <p class="flex-1">{t("photos.failed", { name: u.name, error: errorMessage(u.error, tr) })}</p>
                <button
                  type="button"
                  class="btn btn-quiet"
                  onClick={() => setUploads((all) => all.filter((x) => x.key !== u.key))}
                >
                  {t("photos.dismiss")}
                </button>
              </div>
            </Show>
          </div>
        )}
      </For>

      <Show when={error()}>
        <p role="alert" class="text-sm text-garnet">{errorMessage(error(), tr)}</p>
      </Show>

      <Show when={props.images.length > 0}>
        <p class="text-sm text-silver-ink">{t("photos.drag_hint")}</p>
        <ol ref={list} class="grid grid-cols-3 gap-3 sm:grid-cols-5">
          <For each={props.images}>
            {(img, i) => (
              <li
                draggable={busy() ? "false" : "true"}
                class="relative"
                classList={{ "opacity-50": dragging() === i() }}
                onDragStart={(e) => {
                  setDragging(i());
                  if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", String(img.id));
                  }
                }}
                onDragEnd={() => setDragging(null)}
                onDragOver={(e) => {
                  if (dragging() !== null) e.preventDefault();
                }}
                onDrop={(e) => {
                  const from = dragging();
                  if (from === null) return;
                  e.preventDefault();
                  setDragging(null);
                  void reorder(from, i(), null);
                }}
              >
                <img
                  src={img.small}
                  alt={`${props.title}, ${i() + 1}`}
                  draggable={false}
                  class="aspect-[3/4] w-full rounded-xs bg-veil object-cover"
                />
                <Show when={i() === 0}>
                  <span class="absolute left-1 top-1 rounded-full bg-garnet-fill px-2 py-0.5 text-xs text-on-fill">
                    {t("photos.cover")}
                  </span>
                </Show>
                <div class="mt-1 flex justify-between">
                  <button
                    type="button"
                    data-action="earlier"
                    class="btn-icon h-9 w-9"
                    disabled={busy() || i() === 0}
                    aria-label={t("photos.move_earlier", { n: i() + 1 })}
                    onClick={() => void reorder(i(), i() - 1, "earlier")}
                  >
                    <ChevronLeftIcon />
                  </button>
                  <button
                    type="button"
                    data-action="delete"
                    class="btn-icon h-9 w-9"
                    disabled={busy()}
                    aria-label={t("photos.delete", { n: i() + 1 })}
                    onClick={() => void remove(img, i())}
                  >
                    <TrashIcon />
                  </button>
                  <button
                    type="button"
                    data-action="later"
                    class="btn-icon h-9 w-9"
                    disabled={busy() || i() === props.images.length - 1}
                    aria-label={t("photos.move_later", { n: i() + 1 })}
                    onClick={() => void reorder(i(), i() + 1, "later")}
                  >
                    <ChevronRightIcon />
                  </button>
                </div>
              </li>
            )}
          </For>
        </ol>
      </Show>
    </div>
  );
}
