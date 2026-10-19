import { A } from "@solidjs/router";
import { Show } from "solid-js";
import type { ListItem } from "../lib/types.ts";
import { FavoriteIconButton } from "./FavoriteButton.tsx";
import { priceText } from "./price.ts";

export default function DressTile(props: { item: ListItem; eager?: boolean }) {
  return (
    <article class="relative">
      <A href={`/dresses/${props.item.id}`} class="block">
        <div class="aspect-[3/4] overflow-hidden rounded-xs bg-veil">
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
        <p class="mt-3 font-semibold text-garnet">{priceText(props.item)}</p>
        <h3 class="mt-0.5 truncate font-sans text-base text-ink">{props.item.title}</h3>
        <p class="truncate text-sm text-silver-ink">{props.item.shop.name}</p>
      </A>
      <FavoriteIconButton id={props.item.id} class="absolute right-2 top-2" />
    </article>
  );
}
