import { createEffect, Match, on, onCleanup, onMount, Switch } from "solid-js";
import { t } from "../i18n/i18n.ts";
import type { PagedList } from "../lib/paged.ts";
import ErrorState from "./ErrorState.tsx";

/** Loads the next page as the end of the list nears the viewport, and offers a button too. */
export default function LoadMore(props: { list: PagedList<unknown> }) {
  let sentinel!: HTMLDivElement;
  const near = () => sentinel.getBoundingClientRect().top < window.innerHeight + 600;
  const maybeLoad = () => {
    const l = props.list;
    if (l.hasMore() && !l.loading() && l.error() === null && near()) void l.loadMore();
  };
  onMount(() => {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) maybeLoad();
    }, { rootMargin: "600px 0px" });
    io.observe(sentinel);
    onCleanup(() => io.disconnect());
  });
  // After a page arrives the sentinel can still be on screen, which fires no new intersection.
  createEffect(on(() => props.list.items().length, () => queueMicrotask(maybeLoad), { defer: true }));

  return (
    <div ref={sentinel} class="mt-10 flex min-h-12 justify-center">
      <Switch>
        <Match when={props.list.error() !== null}>
          <ErrorState error={props.list.error()} onRetry={() => void props.list.retry()} />
        </Match>
        <Match when={props.list.loading()}>
          <p role="status" class="text-sm text-silver-ink">{t("common.loading")}</p>
        </Match>
        <Match when={props.list.hasMore()}>
          <button type="button" class="btn btn-outline" onClick={() => void props.list.loadMore()}>
            {t("dresses.load_more")}
          </button>
        </Match>
      </Switch>
    </div>
  );
}
