import { createSignal, For, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { t, tr } from "../../i18n/i18n.ts";
import { api, uploadImage } from "../../lib/client.ts";
import { errorMessage } from "../../lib/errors.ts";
import type { Image } from "../../lib/types.ts";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, TrashIcon } from "../icons.tsx";

interface Upload {
  key: number;
  name: string;
  progress: number;
  error: unknown;
}

const ACCEPT = "image/jpeg,image/png,image/webp";

export default function PhotoManager(props: {
  listingId: number;
  title: string;
  images: Image[];
  onChange: (images: Image[]) => void;
}) {
  const [uploads, setUploads] = createStore<Upload[]>([]);
  const [dragging, setDragging] = createSignal<number | null>(null);
  const [dropActive, setDropActive] = createSignal(false);
  const [error, setError] = createSignal<unknown>(null);
  let nextKey = 0;
  let queue: Promise<void> = Promise.resolve();

  // One upload at a time keeps memory low on the server's photo resizer.
  function addFiles(files: FileList | null | undefined) {
    for (const file of Array.from(files ?? [])) {
      const key = nextKey++;
      setUploads(uploads.length, { key, name: file.name, progress: 0, error: null });
      queue = queue.then(async () => {
        try {
          const img = await uploadImage(
            file,
            { listingId: props.listingId },
            (p) => setUploads((u) => u.key === key, "progress", p),
          );
          props.onChange([...props.images, img]);
          setUploads((list) => list.filter((u) => u.key !== key));
        } catch (err) {
          setUploads((u) => u.key === key, "error", () => err);
        }
      });
    }
  }

  async function reorder(from: number, to: number) {
    if (from === to || to < 0 || to >= props.images.length) return;
    const before = props.images;
    const next = [...before];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    props.onChange(next);
    setError(null);
    try {
      await api.admin.reorderImages(next.map((i) => i.id));
    } catch (err) {
      props.onChange(before);
      setError(() => err);
    }
  }

  async function remove(img: Image) {
    if (!confirm(t("photos.delete_confirm"))) return;
    setError(null);
    try {
      await api.admin.deleteImage(img.id);
      props.onChange(props.images.filter((i) => i.id !== img.id));
    } catch (err) {
      setError(() => err);
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
        onDragLeave={() => setDropActive(false)}
        onDrop={(e) => {
          if (!e.dataTransfer?.files.length) return;
          e.preventDefault();
          setDropActive(false);
          addFiles(e.dataTransfer.files);
        }}
      >
        <p class="text-sm text-silver-ink">{t("photos.drop")}</p>
        <label class="btn btn-primary mt-3 cursor-pointer focus-within:outline-2 focus-within:outline-garnet">
          <PlusIcon />
          {t("photos.add")}
          <input
            type="file"
            accept={ACCEPT}
            multiple
            class="sr-only"
            onChange={(e) => {
              addFiles(e.currentTarget.files);
              e.currentTarget.value = "";
            }}
          />
        </label>
      </div>

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
                  onClick={() => setUploads((list) => list.filter((x) => x.key !== u.key))}
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
        <ol class="grid grid-cols-3 gap-3 sm:grid-cols-5">
          <For each={props.images}>
            {(img, i) => (
              <li
                draggable="true"
                class="relative"
                classList={{ "opacity-50": dragging() === i() }}
                onDragStart={(e) => {
                  setDragging(i());
                  e.dataTransfer?.setData("text/plain", String(img.id));
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
                  void reorder(from, i());
                }}
              >
                <img
                  src={img.small}
                  alt={`${props.title}, ${i() + 1}`}
                  class="aspect-[3/4] w-full rounded-sm bg-veil object-cover"
                />
                <Show when={i() === 0}>
                  <span class="absolute left-1 top-1 rounded-full bg-garnet px-2 py-0.5 text-xs text-white">
                    {t("photos.cover")}
                  </span>
                </Show>
                <div class="mt-1 flex justify-between">
                  <button
                    type="button"
                    class="btn-icon h-9 w-9"
                    disabled={i() === 0}
                    aria-label={t("photos.move_earlier", { n: i() + 1 })}
                    onClick={() => void reorder(i(), i() - 1)}
                  >
                    <ChevronLeftIcon />
                  </button>
                  <button
                    type="button"
                    class="btn-icon h-9 w-9"
                    aria-label={t("photos.delete", { n: i() + 1 })}
                    onClick={() => void remove(img)}
                  >
                    <TrashIcon />
                  </button>
                  <button
                    type="button"
                    class="btn-icon h-9 w-9"
                    disabled={i() === props.images.length - 1}
                    aria-label={t("photos.move_later", { n: i() + 1 })}
                    onClick={() => void reorder(i(), i() + 1)}
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
