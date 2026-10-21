import { For, type JSX, Show } from "solid-js";
import { i18n, t } from "../i18n/i18n.ts";
import { useCities } from "../lib/cities.ts";
import { parsePriceInput } from "../lib/filters.ts";
import { cityName } from "../lib/format.ts";
import type { Color } from "../lib/types.ts";
import ColorSwatch from "./ColorSwatch.tsx";

export interface Choice<T extends string> {
  value: T;
  label: string;
  swatch?: Color;
}

/** One single-choice filter as radio chips, with "Any" first. */
export function ChoiceGroup<T extends string>(props: {
  legend: string;
  name: string;
  options: Choice<T>[];
  value: T | null;
  onChange: (v: T | null) => void;
}) {
  const chip = (value: T | null, label: string, swatch?: Color): JSX.Element => (
    <label class="chip">
      <input
        type="radio"
        class="sr-only"
        name={props.name}
        checked={props.value === value}
        onChange={() => props.onChange(value)}
      />
      <Show when={swatch}>{(s) => <ColorSwatch color={s()} />}</Show>
      <span>{label}</span>
    </label>
  );
  return (
    <fieldset>
      <legend class="text-sm font-semibold">{props.legend}</legend>
      <div class="mt-2 flex flex-wrap gap-2">
        {chip(null, t("filters.any"))}
        <For each={props.options}>{(o) => chip(o.value, o.label, o.swatch)}</For>
      </div>
    </fieldset>
  );
}

export function CityField(props: { value: string; onChange: (slug: string) => void }) {
  const cities = useCities();
  return (
    <label class="block">
      <span class="text-sm font-semibold">{t("filters.city")}</span>
      <select class="field-input mt-1" value={props.value} onChange={(e) => props.onChange(e.currentTarget.value)}>
        <option value="" selected={!props.value}>{t("filters.any_city")}</option>
        <For each={cities()}>
          {(c) => (
            <option value={c.slug} selected={c.slug === props.value}>
              {cityName(c, i18n.lang())}
            </option>
          )}
        </For>
      </select>
    </label>
  );
}

const numberValue = (n: number | null) => (n === null ? "" : String(n));

/** A whole-number input that shows what it understood ("1 500" becomes 1500). */
export function NumberInput(props: { value: number | null; onChange: (n: number | null) => void; label: string; small?: boolean }) {
  return (
    <label class="block">
      <span classList={{ "text-xs text-silver-ink": props.small, "text-sm font-semibold": !props.small }}>{props.label}</span>
      <input
        class="field-input mt-1"
        inputmode="numeric"
        value={numberValue(props.value)}
        onInput={(e) => {
          const n = parsePriceInput(e.currentTarget.value);
          props.onChange(n);
          e.currentTarget.value = numberValue(n); // show what was understood
        }}
      />
    </label>
  );
}

export function PriceFields(props: {
  min: number | null;
  max: number | null;
  onMin: (n: number | null) => void;
  onMax: (n: number | null) => void;
}) {
  return (
    <fieldset>
      <legend class="text-sm font-semibold">{t("filters.price")}</legend>
      <div class="mt-1 grid grid-cols-2 gap-3">
        <NumberInput small label={t("filters.price_min")} value={props.min} onChange={props.onMin} />
        <NumberInput small label={t("filters.price_max")} value={props.max} onChange={props.onMax} />
      </div>
    </fieldset>
  );
}
