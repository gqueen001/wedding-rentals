import { A } from "@solidjs/router";
import { createResource, For, Show } from "solid-js";
import { ChevronRightIcon } from "../components/icons.tsx";
import { t, tr } from "../i18n/i18n.ts";
import { CATEGORIES, catLabel, categoryHref } from "../lib/catalog.ts";
import { api } from "../lib/client.ts";
import { usePageTitle } from "../lib/title.ts";

/** One category: its newest photo (or a soft placeholder) and how many listings it has. */
function CategoryRow(props: { slug: string; oval: boolean }) {
  // One small request per category; a failure just leaves the photo and count out.
  const [page] = createResource(() => props.slug, (slug) =>
    api.items(new URLSearchParams({ category: slug, per_page: "1" })).catch(() => null));
  const ready = () => (page.state === "ready" ? page() : null);
  return (
    <li class="border-b border-line">
      <A href={categoryHref(props.slug)} class="flex items-center gap-5 py-4 hover:text-garnet">
        <span
          class="h-24 w-[4.5rem] shrink-0 bg-veil bg-cover bg-center"
          classList={{ "rounded-[50%]": props.oval }}
          style={ready()?.items[0]?.photo ? { "background-image": `url("${ready()!.items[0].photo}")` } : undefined}
          aria-hidden="true"
        />
        <span class="min-w-0 flex-1">
          <span class="block font-display text-3xl leading-tight sm:text-4xl">{tr(catLabel(props.slug))}</span>
          <Show when={ready()}>
            {(p) => <span class="label mt-1 block">{t("categories.count", { count: p().total })}</span>}
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
