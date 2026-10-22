import { A } from "@solidjs/router";
import { For, Show } from "solid-js";
import { tr } from "../../i18n/i18n.ts";
import { catLabel } from "../../lib/catalog.ts";
import { useManage } from "../../lib/manage.ts";
import type { ListingSummary } from "../../lib/types.ts";
import { priceText } from "../price.ts";
import StatusBadge from "./StatusBadge.tsx";

/** The admin and owner listing lists: one row per listing of any category, linking to its editor. */
export default function ListingList(props: { items: ListingSummary[]; shopName?: (shopId: number) => string }) {
  const m = useManage();
  const href = (l: ListingSummary) => (l.category === "dresses" ? m.dressHref(l.id) : m.itemHref(l.id));
  return (
    <ul class="divide-y divide-veil overflow-hidden rounded-lg bg-white">
      <For each={props.items}>
        {(l) => (
          <li>
            <A href={href(l)} class="flex items-center gap-4 px-4 py-3 hover:bg-veil/60">
              <div class="h-16 w-12 shrink-0 overflow-hidden rounded-xs bg-veil">
                <Show when={l.photo}>{(src) => <img src={src()} alt="" class="h-full w-full object-cover" />}</Show>
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate font-semibold">{l.title}</p>
                <p class="truncate text-sm text-silver-ink">
                  {tr(catLabel(l.category))}
                  <Show when={props.shopName?.(l.shop_id)}>{(name) => <> · {name()}</>}</Show>
                </p>
                <p class="text-sm text-garnet">{priceText(l)}</p>
              </div>
              <StatusBadge published={l.is_published} />
            </A>
          </li>
        )}
      </For>
    </ul>
  );
}
