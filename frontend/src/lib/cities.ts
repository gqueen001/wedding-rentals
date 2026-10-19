import { createResource, createRoot } from "solid-js";
import { api } from "./client.ts";
import type { City } from "./types.ts";

let cities: (() => City[]) | undefined;

/** The city list, fetched once per page load: empty while loading or if the request failed. */
export function useCities(): () => City[] {
  cities ??= createRoot(() => {
    const [res] = createResource(() => api.cities());
    return () => (res.state === "ready" || res.state === "refreshing" ? res() ?? [] : []);
  });
  return cities;
}
