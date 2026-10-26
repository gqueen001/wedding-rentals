import { A } from "@solidjs/router";
import { For } from "solid-js";
import { t, tr } from "../i18n/i18n.ts";
import { CATEGORIES, catLabel, categoryHref, categoryPicture } from "../lib/catalog.ts";

/** One category word with its small oval picture. */
function CategoryWord(props: { slug: string; first: boolean }) {
  return (
    <li>
      <A
        href={categoryHref(props.slug)}
        class="inline-flex min-h-11 items-center gap-4 font-display text-4xl leading-tight hover:text-garnet sm:text-5xl"
        classList={{ "text-garnet": props.first }}
      >
        <span
          class="h-14 w-10 shrink-0 rounded-[50%] bg-veil bg-cover bg-center dark:brightness-[.86]"
          style={{ "background-image": `url("${categoryPicture(props.slug)}")` }}
          aria-hidden="true"
        />
        {props.first && <span class="h-px w-8 shrink-0 bg-current" aria-hidden="true" />}
        {tr(catLabel(props.slug))}
      </A>
    </li>
  );
}

/** Every category as a large elegant word with a small picture, the first one marked with a short line. */
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
