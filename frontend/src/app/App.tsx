import { type RouteSectionProps, useLocation } from "@solidjs/router";
import { createEffect, ErrorBoundary, type JSX, on, Show } from "solid-js";
import ErrorState from "../components/ErrorState.tsx";
import Header from "../components/Header.tsx";
import { t } from "../i18n/i18n.ts";
import { focusMain, mainRef } from "../lib/dom.ts";

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

/** Public pages get the header and footer; /admin pages bring their own chrome. */
export default function App(props: RouteSectionProps) {
  const location = useLocation();
  const isAdmin = () => location.pathname === "/admin" || location.pathname.startsWith("/admin/");
  // Not on first load, and not when only the search string changes.
  createEffect(on(() => location.pathname, () => focusMain(), { defer: true }));
  return (
    <Show when={!isAdmin()} fallback={<Guard>{props.children}</Guard>}>
      <a
        href="#main"
        rel="external" // keeps the router out of it, so the browser focuses <main> itself
        class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2"
      >
        {t("common.skip")}
      </a>
      <Header />
      <main ref={mainRef} id="main" tabindex="-1" class="mx-auto w-full max-w-6xl px-4 pb-20 outline-none">
        <Guard>{props.children}</Guard>
      </main>
      <footer class="border-t border-veil">
        <p class="mx-auto max-w-6xl px-4 py-6 text-sm text-silver-ink">{t("app.tagline")}</p>
      </footer>
    </Show>
  );
}
