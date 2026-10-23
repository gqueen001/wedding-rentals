import { createResource } from "solid-js";
import { api } from "./client.ts";

/**
 * A category's newest photo and listing count, from one small request.
 * Null while loading or when the request fails (the caller just leaves them out).
 */
export function useCategoryPreview(slug: () => string) {
  const [page] = createResource(slug, (s) =>
    api.items(new URLSearchParams({ category: s, per_page: "1" })).catch(() => null));
  return () => {
    const p = page.state === "ready" ? page() : null;
    return p ? { photo: p.items[0]?.photo ?? null, total: p.total } : null;
  };
}
