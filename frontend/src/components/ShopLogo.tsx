import { Show } from "solid-js";

const SIZE = {
  sm: "h-10 w-10 text-lg",
  md: "h-14 w-14 text-2xl",
  lg: "h-24 w-24 text-4xl",
  profile: "h-[92px] w-[70px] text-3xl md:h-36 md:w-28 md:text-6xl", // the shop header's oval: small on phones, large from md
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
          class={`inline-flex shrink-0 items-center justify-center rounded-[50%] bg-garnet-fill font-display text-on-fill ${size()}`}
        >
          {props.name.trim().charAt(0).toLocaleUpperCase()}
        </span>
      }
    >
      {(url) => <img src={url()} alt="" class={`shrink-0 rounded-[50%] bg-veil object-cover ${size()}`} />}
    </Show>
  );
}
