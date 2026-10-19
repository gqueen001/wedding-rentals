import { createEffect, createSignal, For, type JSX, on, onCleanup, Show } from "solid-js";
import { i18n, t } from "../i18n/i18n.ts";
import { useCities } from "../lib/cities.ts";
import { focusFirst, lockScroll, trapTab } from "../lib/dom.ts";
import { EMPTY_FILTERS, type Filters } from "../lib/filters.ts";
import { cityName } from "../lib/format.ts";
import { type Color, COLORS, SILHOUETTES, SIZES, SLEEVES } from "../lib/types.ts";
import ColorSwatch from "./ColorSwatch.tsx";
import { CloseIcon } from "./icons.tsx";

interface Choice<T extends string> {
  value: T;
  label: string;
  swatch?: Color;
}

/** One single-choice filter as radio chips, with "Any" first. */
function ChoiceGroup<T extends string>(props: {
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

const priceValue = (n: number | null) => (n === null ? "" : String(n));
const parsePrice = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : null);

/** The bottom sheet with every filter. Changes stay in a draft until "Show dresses". */
export default function FilterSheet(props: {
  open: boolean;
  value: Filters;
  onApply: (f: Filters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = createSignal<Filters>({ ...props.value });
  const cities = useCities();
  let panel: HTMLDivElement | undefined;

  createEffect(on(() => props.open, (open) => {
    if (!open) return;
    setDraft({ ...props.value });
    const opener = document.activeElement as HTMLElement | null;
    const unlock = lockScroll();
    queueMicrotask(() => panel && focusFirst(panel));
    onCleanup(() => {
      unlock();
      opener?.focus();
    });
  }));

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <Show when={props.open}>
      <div
        class="fixed inset-0 z-40"
        onKeyDown={(e) => {
          if (e.key === "Escape") props.onClose();
          else if (panel) trapTab(e, panel);
        }}
      >
        <div class="absolute inset-0 bg-ink/40" aria-hidden="true" onClick={() => props.onClose()} />
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-labelledby="filters-title"
          tabindex="-1"
          class="sheet-enter outline-none absolute inset-x-0 bottom-0 mx-auto flex max-h-[88vh] max-w-lg flex-col rounded-t-2xl bg-white"
        >
          <div class="flex items-center justify-between border-b border-veil px-5 py-2">
            <h2 id="filters-title" class="text-2xl">{t("filters.title")}</h2>
            <button type="button" class="btn-icon" aria-label={t("common.close")} onClick={() => props.onClose()}>
              <CloseIcon />
            </button>
          </div>

          <div class="flex-1 space-y-6 overflow-y-auto px-5 py-5">
            <label class="block">
              <span class="text-sm font-semibold">{t("filters.city")}</span>
              <select
                class="field-input mt-1"
                value={draft().city}
                onChange={(e) => set("city", e.currentTarget.value)}
              >
                <option value="">{t("filters.any_city")}</option>
                <For each={cities()}>{(c) => <option value={c.slug}>{cityName(c, i18n.lang())}</option>}</For>
              </select>
            </label>

            <fieldset>
              <legend class="text-sm font-semibold">{t("filters.price")}</legend>
              <div class="mt-1 grid grid-cols-2 gap-3">
                <label>
                  <span class="text-xs text-silver-ink">{t("filters.price_min")}</span>
                  <input
                    class="field-input mt-1"
                    inputmode="numeric"
                    value={priceValue(draft().priceMin)}
                    onInput={(e) => set("priceMin", parsePrice(e.currentTarget.value))}
                  />
                </label>
                <label>
                  <span class="text-xs text-silver-ink">{t("filters.price_max")}</span>
                  <input
                    class="field-input mt-1"
                    inputmode="numeric"
                    value={priceValue(draft().priceMax)}
                    onInput={(e) => set("priceMax", parsePrice(e.currentTarget.value))}
                  />
                </label>
              </div>
            </fieldset>

            <ChoiceGroup
              legend={t("filters.size")}
              name="size"
              options={SIZES.map((s) => ({ value: s, label: s }))}
              value={draft().size}
              onChange={(v) => set("size", v)}
            />
            <ChoiceGroup
              legend={t("filters.color")}
              name="color"
              options={COLORS.map((c) => ({ value: c, label: t(`color.${c}`), swatch: c }))}
              value={draft().color}
              onChange={(v) => set("color", v)}
            />
            <ChoiceGroup
              legend={t("filters.style")}
              name="style"
              options={SILHOUETTES.map((s) => ({ value: s, label: t(`silhouette.${s}`) }))}
              value={draft().style}
              onChange={(v) => set("style", v)}
            />
            <ChoiceGroup
              legend={t("filters.sleeves")}
              name="sleeves"
              options={SLEEVES.map((s) => ({ value: s, label: t(`sleeves.${s}`) }))}
              value={draft().sleeves}
              onChange={(v) => set("sleeves", v)}
            />
          </div>

          <div class="flex gap-3 border-t border-veil px-5 py-3">
            <button
              type="button"
              class="btn btn-quiet"
              onClick={() => setDraft({ ...EMPTY_FILTERS, q: draft().q })}
            >
              {t("filters.reset")}
            </button>
            <button type="button" class="btn btn-primary flex-1" onClick={() => props.onApply(draft())}>
              {t("filters.apply")}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
