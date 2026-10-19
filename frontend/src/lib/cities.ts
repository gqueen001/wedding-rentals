import { createSignal } from "solid-js";
import { api } from "./client.ts";
import type { City } from "./types.ts";

/** A city list that loads on first read; empty while loading, and a failed load is retried by the next read. */
export function createCitiesStore(fetchCities: () => Promise<City[]>): () => City[] {
  const [list, setList] = createSignal<City[]>([]);
  let loaded = false;
  let inflight = false;
  function load() {
    if (loaded || inflight) return;
    inflight = true;
    fetchCities()
      .then((items) => {
        setList(items);
        loaded = true;
      })
      .catch(() => {
        // stay empty; the next read tries again
      })
      .finally(() => {
        inflight = false;
      });
  }
  return () => {
    load();
    return list();
  };
}

let cities: (() => City[]) | undefined;

/** The city list, fetched once per page load: empty while loading or if the request failed. */
export function useCities(): () => City[] {
  return (cities ??= createCitiesStore(() => api.cities()));
}
