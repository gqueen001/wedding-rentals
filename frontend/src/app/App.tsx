import { type RouteSectionProps, useLocation } from "@solidjs/router";
import { Show } from "solid-js";
import Header from "../components/Header.tsx";
import { t } from "../i18n/i18n.ts";

/** Public pages get the header and footer; /admin pages bring their own chrome. */
export default function App(props: RouteSectionProps) {
  const location = useLocation();
  const isAdmin = () => location.pathname === "/admin" || location.pathname.startsWith("/admin/");
  return (
    <Show when={!isAdmin()} fallback={props.children}>
      <a
        href="#main"
        class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2"
      >
        {t("common.skip")}
      </a>
      <Header />
      <main id="main" class="mx-auto w-full max-w-6xl px-4 pb-20">
        {props.children}
      </main>
      <footer class="border-t border-veil">
        <p class="mx-auto max-w-6xl px-4 py-6 text-sm text-silver-ink">{t("app.tagline")}</p>
      </footer>
    </Show>
  );
}
