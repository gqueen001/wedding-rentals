import { A } from "@solidjs/router";
import { For } from "solid-js";
import { t, tr } from "../i18n/i18n.ts";
import { CATEGORIES, catLabel, categoryHref } from "../lib/catalog.ts";

/** One category word after a short line. */
function CategoryWord(props: { slug: string; first: boolean }) {
  return (
    <li>
      <A
        href={categoryHref(props.slug)}
        class="inline-flex min-h-11 items-center gap-4 font-display text-4xl leading-tight hover:text-garnet sm:text-5xl"
        classList={{ "text-garnet": props.first }}
      >
        <span class="h-px w-8 shrink-0 bg-current" aria-hidden="true" />
        {tr(catLabel(props.slug))}
      </A>
    </li>
  );
}

/** Every category as a large elegant word after a short line, the first one in garnet. */
export default function CategoryBar() {
  return (
    <nav aria-label={t("home.categories")}>
      <p class="label">{t("home.categories")}</p>
      <ul class="mt-3 space-y-2">
        <For each={CATEGORIES}>{(c, i) => <CategoryWord slug={c.slug} first={i() === 0} />}</For>
      </ul>
    </nav>
  );
}
