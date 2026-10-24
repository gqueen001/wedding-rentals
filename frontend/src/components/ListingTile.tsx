import { A } from "@solidjs/router";
import { Show } from "solid-js";
import { listingHref } from "../lib/catalog.ts";
import type { ListItem } from "../lib/types.ts";
import { FavoriteIconButton } from "./FavoriteButton.tsx";
import { priceText } from "./price.ts";

/**
 * One listing in a grid, of any category: the photo, then only the price and the shop (the title is
 * for screen readers, and the photo's alt text). hideShop leaves the shop out, on that shop's own page.
 */
export default function ListingTile(props: { item: ListItem; eager?: boolean; hideShop?: boolean }) {
  return (
    <article class="relative">
      <A href={listingHref(props.item)} class="block">
        <div class="aspect-[3/4] overflow-hidden bg-veil">
          <Show when={props.item.photo}>
            {(src) => (
              <img
                src={src()}
                alt={props.item.title}
                loading={props.eager ? "eager" : "lazy"}
                fetchpriority={props.eager ? "high" : undefined}
                decoding="async"
                class="h-full w-full object-cover"
              />
            )}
          </Show>
        </div>
        <p class="mt-3 font-label text-sm tracking-[0.06em] text-garnet">{priceText(props.item)}</p>
        <h3 class="sr-only">{props.item.title}</h3>
        <Show when={!props.hideShop}>
          <p class="mt-0.5 truncate text-sm text-silver-ink">{props.item.shop.name}</p>
        </Show>
      </A>
      <FavoriteIconButton id={props.item.id} class="absolute right-2 top-2" />
    </article>
  );
}
