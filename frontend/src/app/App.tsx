import { type RouteSectionProps, useLocation } from "@solidjs/router";
import { createEffect, ErrorBoundary, type JSX, on, Show } from "solid-js";
import ErrorState from "../components/ErrorState.tsx";
import Header from "../components/Header.tsx";
import { t } from "../i18n/i18n.ts";

/** A lazy chunk that failed to download: only a full reload fetches a fresh build. */
function isChunkError(err: unknown): boolean {
  return err instanceof Error &&
    (err.name === "ChunkLoadError" || err.message.includes("Failed to fetch dynamically imported module"));
}

/** A render or chunk-load failure shows a message with a retry button, never a blank page. */
function Guard(props: { children: JSX.Element }) {
  const where = useLocation();
  return (
    <ErrorBoundary
      fallback={(err, reset) => {
        // Following a link to another page clears the error.
        createEffect(on(() => where.pathname, reset, { defer: true }));
        return <ErrorState error={err} onRetry={() => (isChunkError(err) ? location.reload() : reset())} />;
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
  return (
    <Show when={!isAdmin()} fallback={<Guard>{props.children}</Guard>}>
      <a
        href="#main"
        class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2"
      >
        {t("common.skip")}
      </a>
      <Header />
      <main id="main" class="mx-auto w-full max-w-6xl px-4 pb-20">
        <Guard>{props.children}</Guard>
      </main>
      <footer class="border-t border-veil">
        <p class="mx-auto max-w-6xl px-4 py-6 text-sm text-silver-ink">{t("app.tagline")}</p>
      </footer>
    </Show>
  );
}
