import { A } from "@solidjs/router";
import { For } from "solid-js";
import { t, tr } from "../i18n/i18n.ts";
import { CATEGORIES, catLabel, categoryHref } from "../lib/catalog.ts";
import { useCategoryPreview } from "../lib/categoryPreview.ts";

/** One category word with a small oval photo of its newest listing. */
function CategoryWord(props: { slug: string; first: boolean }) {
  const preview = useCategoryPreview(() => props.slug);
  return (
    <li>
      <A
        href={categoryHref(props.slug)}
        class="inline-flex min-h-11 items-center gap-4 font-display text-4xl leading-tight hover:text-garnet sm:text-5xl"
        classList={{ "text-garnet": props.first }}
      >
        <span
          class="h-14 w-10 shrink-0 rounded-[50%] bg-veil bg-cover bg-center"
          style={preview()?.photo ? { "background-image": `url("${preview()!.photo}")` } : undefined}
          aria-hidden="true"
        />
        {props.first && <span class="h-px w-8 shrink-0 bg-current" aria-hidden="true" />}
        {tr(catLabel(props.slug))}
      </A>
    </li>
  );
}

/** Every category as a large elegant word with a small photo, the first one marked with a short line. */
export default function CategoryBar() {
  return (
    <nav aria-label={t("home.categories")}>
      <p class="label">{t("home.categories")}</p>
      <ul class="mt-3 space-y-2">
        <For each={CATEGORIES}>{(c, i) => <CategoryWord slug={c.slug} first={i() === 0} />}</For>
      </ul>
      <A href="/categories" class="label mt-4 inline-block border-b border-ink pb-0.5 text-ink">
        {t("home.see_all_categories")}
      </A>
    </nav>
  );
}
