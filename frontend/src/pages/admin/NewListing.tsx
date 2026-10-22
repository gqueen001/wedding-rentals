import { A, useSearchParams } from "@solidjs/router";
import { For } from "solid-js";
import { t, tr } from "../../i18n/i18n.ts";
import { CATEGORIES, catLabel } from "../../lib/catalog.ts";
import { firstParam } from "../../lib/forms.ts";
import { useManage } from "../../lib/manage.ts";
import { usePageTitle } from "../../lib/title.ts";

/** "New listing": the category comes first; a dress opens the dress editor, the rest the item editor. */
export default function NewListing() {
  usePageTitle(() => t("admin.new_listing"));
  const m = useManage();
  const [search] = useSearchParams();
  const shopId = () => Number(firstParam(search.shop_id)) || undefined;
  return (
    <div class="max-w-2xl">
      <A href={m.listingsHref(shopId())} class="text-sm text-silver-ink hover:text-ink">{t("common.back")}</A>
      <h1 class="mt-2 text-3xl">{t("admin.choose_category")}</h1>
      <ul class="mt-6 grid gap-3 sm:grid-cols-2">
        <For each={CATEGORIES}>
          {(c) => (
            <li>
              <A
                href={c.own_pages ? m.newDressHref(shopId()) : m.newItemHref(c.slug, shopId())}
                class="flex min-h-14 items-center rounded-lg bg-white px-5 font-semibold hover:text-garnet"
              >
                {tr(catLabel(c.slug))}
              </A>
            </li>
          )}
        </For>
      </ul>
    </div>
  );
}
