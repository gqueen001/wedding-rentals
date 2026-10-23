import { A } from "@solidjs/router";
import { For } from "solid-js";
import { t, tr } from "../i18n/i18n.ts";
import { CATEGORIES, catLabel, categoryHref } from "../lib/catalog.ts";

/** Every category as a large elegant word, the first one marked with a short line. */
export default function CategoryBar() {
  return (
    <nav aria-label={t("home.categories")}>
      <p class="label">{t("home.categories")}</p>
      <ul class="mt-3 space-y-1">
        <For each={CATEGORIES}>
          {(c, i) => (
            <li>
              <A
                href={categoryHref(c.slug)}
                class="inline-flex min-h-11 items-center gap-3 font-display text-4xl leading-tight hover:text-garnet sm:text-5xl"
                classList={{ "text-garnet": i() === 0 }}
              >
                {i() === 0 && <span class="h-px w-8 bg-current" aria-hidden="true" />}
                {tr(catLabel(c.slug))}
              </A>
            </li>
          )}
        </For>
      </ul>
      <A href="/categories" class="label mt-4 inline-block border-b border-ink pb-0.5 text-ink">
        {t("home.see_all_categories")}
      </A>
    </nav>
  );
}
