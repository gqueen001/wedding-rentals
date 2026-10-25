import { A, type RouteSectionProps, useLocation } from "@solidjs/router";
import { createEffect, ErrorBoundary, type JSX, on, onMount, Show } from "solid-js";
import BackButton from "../components/BackButton.tsx";
import BottomNav from "../components/BottomNav.tsx";
import ErrorState from "../components/ErrorState.tsx";
import Header from "../components/Header.tsx";
import { t } from "../i18n/i18n.ts";
import { hasOwnChrome } from "../lib/areas.ts";
import { focusMain, mainRef } from "../lib/dom.ts";
import { backTracker } from "../lib/history.ts";

/**
 * A render or chunk-load failure shows a message with a retry button, never a blank page.
 * Retry reloads the page: it recovers from a stale lazy chunk in every browser, whatever its message.
 */
function Guard(props: { children: JSX.Element }) {
  const where = useLocation();
  return (
    <ErrorBoundary
      fallback={(err, reset) => {
        // Following a link to another page clears the error.
        createEffect(on(() => where.pathname, reset, { defer: true }));
        return <ErrorState error={err} onRetry={() => location.reload()} />;
      }}
    >
      {props.children}
    </ErrorBoundary>
  );
}

/** Public pages get the header and footer; admin and "My shop" pages bring their own. */
export default function App(props: RouteSectionProps) {
  const location = useLocation();
  // The page this visit opened on: Back buttons only go back past it to stay on the site.
  onMount(() => backTracker.markLanding());
  // Not on first load, and not when only the search string changes.
  createEffect(on(() => location.pathname, () => focusMain(), { defer: true }));
  return (
    <Show when={!hasOwnChrome(location.pathname)} fallback={<Guard>{props.children}</Guard>}>
      <a
        href="#main"
        rel="external" // keeps the router out of it, so the browser focuses <main> itself
        class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2"
      >
        {t("common.skip")}
      </a>
      <Header />
      {/* On phones the bottom bar covers the last 4rem (plus the iPhone home indicator). */}
      <main
        ref={mainRef}
        id="main"
        tabindex="-1"
        class="mx-auto w-full max-w-6xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] outline-none md:px-8 md:pb-20"
      >
        <Show when={location.pathname !== "/"}>
          <BackButton />
        </Show>
        <Guard>{props.children}</Guard>
      </main>
      <footer class="hidden border-t border-line md:block">
        <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-8 py-8">
          <p class="label whitespace-nowrap">{t("app.tagline")}</p>
          <A href="/shop/signup" class="btn btn-outline whitespace-nowrap">{t("footer.add_shop_short")}</A>
        </div>
      </footer>
      <BottomNav />
    </Show>
  );
}
