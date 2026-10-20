import { Show } from "solid-js";

const SIZE = { sm: "h-10 w-10 text-lg", md: "h-14 w-14 text-2xl", lg: "h-24 w-24 text-4xl" } as const;

/** The shop's logo, or its first letter in Forum on garnet when it has none. */
export default function ShopLogo(props: { url: string | null; name: string; size?: keyof typeof SIZE }) {
  const size = () => SIZE[props.size ?? "md"];
  return (
    <Show
      when={props.url}
      fallback={
        <span
          aria-hidden="true"
          class={`inline-flex shrink-0 items-center justify-center rounded-full bg-garnet font-display text-white ${size()}`}
        >
          {props.name.trim().charAt(0).toLocaleUpperCase()}
        </span>
      }
    >
      {(url) => <img src={url()} alt="" class={`shrink-0 rounded-full bg-veil object-cover ${size()}`} />}
    </Show>
  );
}
