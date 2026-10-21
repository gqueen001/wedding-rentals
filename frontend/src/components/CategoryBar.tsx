import { A } from "@solidjs/router";
import { For, type JSX } from "solid-js";
import { tr } from "../i18n/i18n.ts";
import { CATEGORIES, catLabel, categoryHref } from "../lib/catalog.ts";
import { CarIcon, DressIcon, RibbonIcon, RobeIcon, TentIcon } from "./icons.tsx";

const ICONS: Record<string, (p: { class?: string }) => JSX.Element> = {
  "dresses": DressIcon,
  "cars": CarIcon,
  "national-clothes": RobeIcon,
  "tents": TentIcon,
  "car-decorations": RibbonIcon,
};

/** One button per category; on narrow screens the row scrolls sideways inside itself. */
export default function CategoryBar() {
  return (
    <nav aria-label={tr("home.categories")}>
      <ul class="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0">
        <For each={CATEGORIES}>
          {(c) => {
            const Icon = ICONS[c.slug] ?? DressIcon;
            return (
              <li class="w-28 shrink-0 snap-start sm:w-auto">
                <A
                  href={categoryHref(c.slug)}
                  class="flex h-full min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-veil bg-white px-2 py-3 text-center text-sm font-semibold hover:border-garnet hover:text-garnet"
                >
                  <Icon class="h-7 w-7 text-garnet" />
                  <span>{tr(catLabel(c.slug))}</span>
                </A>
              </li>
            );
          }}
        </For>
      </ul>
    </nav>
  );
}
