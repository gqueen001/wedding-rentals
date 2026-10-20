import { t } from "../i18n/i18n.ts";
import { favorites } from "../lib/favorites.ts";
import { HeartIcon } from "./icons.tsx";

/** The heart over a dress photo in the grid. */
export function FavoriteIconButton(props: { id: number; class?: string }) {
  const on = () => favorites.has(props.id);
  return (
    <button
      type="button"
      class={`inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-garnet hover:bg-white ${
        props.class ?? ""
      }`}
      aria-pressed={on()}
      aria-label={on() ? t("favorites.remove") : t("favorites.add")}
      onClick={() => favorites.toggle(props.id)}
    >
      <HeartIcon filled={on()} />
    </button>
  );
}

/** The labelled favorite button on the dress page. */
export function FavoriteButton(props: { id: number }) {
  const on = () => favorites.has(props.id);
  return (
    <button
      type="button"
      class="btn btn-outline"
      classList={{ "border-garnet bg-blush text-garnet-deep": on() }}
      aria-pressed={on()}
      onClick={() => favorites.toggle(props.id)}
    >
      <HeartIcon filled={on()} class="h-5 w-5 text-garnet" />
      {on() ? t("favorites.remove") : t("favorites.add")}
    </button>
  );
}
