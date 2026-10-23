import { createResource } from "solid-js";
import { api } from "./client.ts";

/**
 * A category's newest photo and listing count, from one small request. It looks at the newest few
 * listings, so a fresh listing that has no photo yet does not leave the category blank.
 * Null while loading or when the request fails (the caller just leaves them out).
 */
export function useCategoryPreview(slug: () => string) {
  const [page] = createResource(slug, (s) =>
    api.items(new URLSearchParams({ category: s, per_page: "6" })).catch(() => null));
  return () => {
    const p = page.state === "ready" ? page() : null;
    return p ? { photo: p.items.find((i) => i.photo)?.photo ?? null, total: p.total } : null;
  };
}
