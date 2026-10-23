import { Show } from "solid-js";

const SIZE = {
  sm: "h-10 w-10 text-lg",
  md: "h-14 w-14 text-2xl",
  lg: "h-24 w-24 text-4xl",
  xl: "h-36 w-28 text-6xl", // an oval, for the shop page
} as const;

/** The shop's logo, or its first letter on garnet when it has none. */
export default function ShopLogo(props: { url: string | null; name: string; size?: keyof typeof SIZE }) {
  const size = () => SIZE[props.size ?? "md"];
  return (
    <Show
      when={props.url}
      fallback={
        <span
          aria-hidden="true"
          class={`inline-flex shrink-0 items-center justify-center rounded-[50%] bg-garnet font-display text-white ${size()}`}
        >
          {props.name.trim().charAt(0).toLocaleUpperCase()}
        </span>
      }
    >
      {(url) => <img src={url()} alt="" class={`shrink-0 rounded-[50%] bg-veil object-cover ${size()}`} />}
    </Show>
  );
}
