import { For } from "solid-js";
import type { ListItem } from "../lib/types.ts";
import DressTile from "./DressTile.tsx";
import { GRID_CLASS } from "./grid.ts";

export default function DressGrid(props: { items: ListItem[] }) {
  return (
    <ul class={GRID_CLASS}>
      <For each={props.items}>
        {(item) => (
          <li>
            <DressTile item={item} />
          </li>
        )}
      </For>
    </ul>
  );
}
