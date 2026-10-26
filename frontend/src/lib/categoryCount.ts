import { createResource } from "solid-js";
import { api } from "./client.ts";

/**
 * How many listings a category has, from one small request.
 * Null while loading or when the request fails (the caller just leaves it out).
 */
export function useCategoryCount(slug: () => string) {
  const [page] = createResource(slug, (s) =>
    api.items(new URLSearchParams({ category: s, per_page: "1" })).catch(() => null));
  return () => (page.state === "ready" ? page()?.total ?? null : null);
}
