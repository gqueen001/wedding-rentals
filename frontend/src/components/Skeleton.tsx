import { For } from "solid-js";
import { t } from "../i18n/i18n.ts";
import { GRID_CLASS } from "./grid.ts";

export function GridSkeleton(props: { count?: number }) {
  return (
    <ul class={GRID_CLASS} aria-busy="true" aria-label={t("common.loading")}>
      <For each={Array.from({ length: props.count ?? 8 })}>
        {() => (
          <li>
            <div class="aspect-[3/4] animate-pulse rounded-sm bg-veil" />
            <div class="mt-3 h-4 w-1/2 animate-pulse rounded bg-veil" />
            <div class="mt-2 h-3 w-3/4 animate-pulse rounded bg-veil" />
          </li>
        )}
      </For>
    </ul>
  );
}

export function DetailSkeleton() {
  return (
    <div class="pt-4 lg:grid lg:grid-cols-2 lg:gap-12 lg:pt-8" aria-busy="true" aria-label={t("common.loading")}>
      <div class="-mx-4 aspect-[3/4] animate-pulse bg-veil sm:mx-0" />
      <div class="mt-6 space-y-4 lg:mt-0">
        <div class="h-10 w-3/4 animate-pulse rounded bg-veil" />
        <div class="h-7 w-1/3 animate-pulse rounded bg-veil" />
        <div class="h-24 animate-pulse rounded bg-veil" />
      </div>
    </div>
  );
}
