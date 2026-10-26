import { A } from "@solidjs/router";
import { For, Show } from "solid-js";
import { ChevronRightIcon } from "../components/icons.tsx";
import { t, tr } from "../i18n/i18n.ts";
import { CATEGORIES, catLabel, categoryHref } from "../lib/catalog.ts";
import { useCategoryCount } from "../lib/categoryCount.ts";
import { categoryPhoto, photoStyle } from "../lib/photos.ts";
import { usePageTitle } from "../lib/title.ts";

/** One category: its photo and how many listings it has. */
function CategoryRow(props: { slug: string; oval: boolean }) {
  const count = useCategoryCount(() => props.slug);
  return (
    <li class="border-b border-line">
      <A href={categoryHref(props.slug)} class="flex items-center gap-5 py-4 hover:text-garnet">
        <span
          class="h-24 w-[4.5rem] shrink-0 bg-veil bg-cover dark:brightness-[.86]"
          classList={{ "rounded-[50%]": props.oval }}
          style={photoStyle(categoryPhoto(props.slug))}
          aria-hidden="true"
        />
        <span class="min-w-0 flex-1">
          <span class="block font-display text-3xl leading-tight sm:text-4xl">{tr(catLabel(props.slug))}</span>
          <Show when={count() !== null}>
            <span class="label mt-1 block">{t("categories.count", { count: count()! })}</span>
          </Show>
        </span>
        <ChevronRightIcon class="h-5 w-5 shrink-0 text-silver-ink" />
      </A>
    </li>
  );
}

/** The bottom bar's Categories tab: every category as a large word. */
export default function Categories() {
  usePageTitle(() => t("tab.categories"));
  return (
    <div class="pt-6">
      <p class="label">{t("tab.categories")}</p>
      <h1 class="mt-2 text-5xl sm:text-6xl">{t("home.title")}</h1>
      <ul class="mt-6 border-t border-line">
        <For each={CATEGORIES}>{(c, i) => <CategoryRow slug={c.slug} oval={i() % 2 === 0} />}</For>
      </ul>
    </div>
  );
}
