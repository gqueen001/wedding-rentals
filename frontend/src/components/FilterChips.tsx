import { For } from "solid-js";
import { t } from "../i18n/i18n.ts";
import { CloseIcon, FilterIcon } from "./icons.tsx";

export interface ActiveFilter {
  key: string;
  label: string;
  remove: () => void;
}

/** "Filters · N" (opens the sheet), then one chip per active filter: tapping it removes it. */
export default function FilterChips(props: { count: number; active: ActiveFilter[]; onOpen: () => void }) {
  let filtersButton: HTMLButtonElement | undefined;
  return (
    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        class="chip"
        ref={filtersButton}
        classList={{ "chip-on": props.count > 0 }}
        aria-haspopup="dialog"
        onClick={() => props.onOpen()}
      >
        <FilterIcon class="h-4 w-4" />
        {props.count > 0 ? t("dresses.filters_active", { count: props.count }) : t("dresses.filters")}
      </button>
      <For each={props.active}>
        {(f) => (
          <button
            type="button"
            class="chip"
            aria-label={t("filters.remove", { filter: f.label })}
            onClick={() => {
              // The chips are rebuilt after a removal; keep focus on the Filters button, which stays.
              filtersButton?.focus();
              f.remove();
            }}
          >
            {f.label}
            <CloseIcon class="h-3.5 w-3.5" />
          </button>
        )}
      </For>
    </div>
  );
}
