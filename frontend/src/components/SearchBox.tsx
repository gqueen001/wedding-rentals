import { createUniqueId } from "solid-js";
import { t } from "../i18n/i18n.ts";
import { SearchIcon } from "./icons.tsx";

/** A search form; label and placeholder default to the listing search's. */
export default function SearchBox(props: {
  value: string;
  onSearch: (q: string) => void;
  large?: boolean;
  label?: string;
  placeholder?: string;
}) {
  const id = createUniqueId();
  let input!: HTMLInputElement;
  return (
    <form
      role="search"
      class="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSearch(input.value.trim());
      }}
    >
      <label for={id} class="sr-only">
        {props.label ?? t("search.label")}
      </label>
      <div class="relative flex-1">
        <SearchIcon class="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-silver-ink" />
        <input
          ref={input}
          id={id}
          type="search"
          autocomplete="off"
          value={props.value}
          placeholder={props.placeholder ?? t("search.placeholder")}
          class="field-input pl-10"
          classList={{ "min-h-14 text-lg": props.large }}
        />
      </div>
      <button type="submit" class="btn btn-primary" classList={{ "min-h-14 px-6 text-base": props.large }}>
        {t("search.submit")}
      </button>
    </form>
  );
}
