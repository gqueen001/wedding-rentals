import { type JSX, Show } from "solid-js";

export default function EmptyState(props: { title: string; body: string; children?: JSX.Element }) {
  return (
    <div class="py-12">
      <h2 class="text-2xl">{props.title}</h2>
      <p class="mt-2 max-w-prose text-silver-ink">{props.body}</p>
      <Show when={props.children}>
        <div class="mt-6">{props.children}</div>
      </Show>
    </div>
  );
}
