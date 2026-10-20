import { A, Navigate, type RouteSectionProps, useLocation, useNavigate } from "@solidjs/router";
import { Show } from "solid-js";
import GolBand from "../../components/GolBand.tsx";
import LanguageSwitch from "../../components/LanguageSwitch.tsx";
import { t } from "../../i18n/i18n.ts";
import { auth } from "../../lib/auth.ts";
import { mainRef } from "../../lib/dom.ts";
import { usePageTitle } from "../../lib/title.ts";

const NAV_LINK = "inline-flex min-h-11 items-center rounded-full px-3 hover:bg-veil";

/** Every /admin page: requires a token, otherwise goes to sign-in and comes back afterwards. */
export default function AdminLayout(props: RouteSectionProps) {
  usePageTitle(() => t("admin.title"));
  const location = useLocation();
  const navigate = useNavigate();
  const signOut = () => {
    auth.clear();
    navigate("/admin/login", { replace: true });
  };
  return (
    <Show
      when={auth.token()}
      fallback={<Navigate href={`/admin/login?next=${encodeURIComponent(location.pathname + location.search)}`} />}
    >
      <div class="min-h-screen bg-veil">
        <header class="bg-white">
          <GolBand />
          <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
            <A href="/" class="font-display text-2xl text-garnet">{t("app.name")}</A>
            <span class="text-sm text-silver-ink">{t("admin.title")}</span>
            <nav class="flex text-sm" aria-label={t("admin.title")}>
              <A href="/admin/shops" class={NAV_LINK} activeClass="font-semibold text-garnet">{t("admin.shops")}</A>
              <A href="/admin/dresses" class={NAV_LINK} activeClass="font-semibold text-garnet">
                {t("admin.dresses")}
              </A>
            </nav>
            <div class="ml-auto flex items-center gap-1">
              <LanguageSwitch />
              <button type="button" class="btn btn-quiet" onClick={signOut}>{t("admin.sign_out")}</button>
            </div>
          </div>
        </header>
        <main ref={mainRef} id="main" tabindex="-1" class="mx-auto max-w-6xl px-4 py-8 outline-none">{props.children}</main>
      </div>
    </Show>
  );
}
