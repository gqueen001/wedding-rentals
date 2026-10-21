import { For } from "solid-js";
import type { ListItem } from "../lib/types.ts";
import ListingTile from "./ListingTile.tsx";
import { GRID_CLASS } from "./grid.ts";

/** The first row is on screen at load: its photos should not wait for lazy loading. */
const EAGER_COUNT = 4;

export default function ListingGrid(props: { items: ListItem[] }) {
  return (
    <ul class={GRID_CLASS}>
      <For each={props.items}>
        {(item, i) => (
          <li>
            <ListingTile item={item} eager={i() < EAGER_COUNT} />
          </li>
        )}
      </For>
    </ul>
  );
}
