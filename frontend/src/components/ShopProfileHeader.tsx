import { type JSX, Show } from "solid-js";
import ShopLogo from "./ShopLogo.tsx";

/**
 * A shop's header, on its public page and on My shop. Phones: a small oval logo with the place,
 * the name and the actions beside it, the description below. From md: the large logo, then the
 * name, the description and the actions in one column.
 */
export default function ShopProfileHeader(props: {
  logo: string | null;
  name: string;
  /** The city and address, as one small label. */
  place: string;
  description: string | null;
  actions: JSX.Element;
}) {
  return (
    // Every item gets an explicit cell from md: items with only a row set would otherwise be placed
    // before the logo and push it into a third column.
    <header class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 md:gap-x-6">
      <div class="row-span-2 md:col-start-1 md:row-span-3 md:row-start-1">
        <ShopLogo url={props.logo} name={props.name} size="profile" />
      </div>
      <div class="min-w-0 md:col-start-2 md:row-start-1">
        <p class="label">{props.place}</p>
        <h1 class="mt-1 break-words text-lg md:mt-2 md:font-display md:text-6xl md:tracking-normal">{props.name}</h1>
      </div>
      <div class="mt-2 min-w-0 md:col-start-2 md:row-start-3 md:mt-6">{props.actions}</div>
      <Show when={props.description}>
        {(text) => (
          <p class="col-span-2 mt-3 max-w-prose whitespace-pre-line md:col-span-1 md:col-start-2 md:row-start-2 md:mt-4">
            {text()}
          </p>
        )}
      </Show>
    </header>
  );
}
