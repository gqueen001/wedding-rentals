import { A, Navigate, type RouteSectionProps, useLocation, useNavigate } from "@solidjs/router";
import { Show } from "solid-js";
import SignOutButton from "../../components/admin/SignOutButton.tsx";
import LanguageSwitch from "../../components/LanguageSwitch.tsx";
import { t } from "../../i18n/i18n.ts";
import { auth } from "../../lib/auth.ts";
import { api, uploadImage } from "../../lib/client.ts";
import { mainRef } from "../../lib/dom.ts";
import { adminManage, ManageContext } from "../../lib/manage.ts";
import { usePageTitle } from "../../lib/title.ts";

const manage = adminManage(api, uploadImage);

const NAV_LINK = "inline-flex min-h-11 items-center rounded-full px-2 hover:bg-veil sm:px-3";

/** Every /admin page: requires a token, otherwise goes to sign-in and comes back afterwards. */
export default function AdminLayout(props: RouteSectionProps) {
  usePageTitle(() => t("admin.title"));
  const location = useLocation();
  const navigate = useNavigate();
  // Editing a dress or an item still belongs to "Listings".
  const inListings = () =>
    ["/admin/listings", "/admin/dresses", "/admin/items"].some((p) => location.pathname.startsWith(p));
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
          <div class="mx-auto flex max-w-6xl items-center gap-x-2 px-4 py-2 sm:gap-x-4">
            <A href="/" class="font-display text-2xl text-garnet">{t("app.name")}</A>
            <span class="hidden text-sm text-silver-ink sm:inline">{t("admin.title")}</span>
            <nav class="flex text-sm" aria-label={t("admin.title")}>
              <A href="/admin/shops" class={NAV_LINK} activeClass="font-semibold text-garnet">{t("admin.shops")}</A>
              <A href="/admin/listings" class={`${NAV_LINK} ${inListings() ? "font-semibold text-garnet" : ""}`}>
                {t("admin.listings")}
              </A>
            </nav>
            <div class="ml-auto flex items-center gap-1">
              {/* Phones: no room next to the admin links; the language can be changed on any public page. */}
              <span class="hidden sm:contents">
                <LanguageSwitch />
              </span>
              <SignOutButton onClick={signOut} />
            </div>
          </div>
        </header>
        <main ref={mainRef} id="main" tabindex="-1" class="mx-auto max-w-6xl px-4 py-8 outline-none">
          <ManageContext.Provider value={manage}>{props.children}</ManageContext.Provider>
        </main>
      </div>
    </Show>
  );
}
