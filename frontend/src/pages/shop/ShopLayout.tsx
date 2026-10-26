import { A, Navigate, type RouteSectionProps, useLocation, useNavigate } from "@solidjs/router";
import { Show } from "solid-js";
import SignOutButton from "../../components/admin/SignOutButton.tsx";
import BottomNav from "../../components/BottomNav.tsx";
import LanguageSwitch from "../../components/LanguageSwitch.tsx";
import ThemeButton from "../../components/ThemeButton.tsx";
import { t } from "../../i18n/i18n.ts";
import { ownerApi, uploadOwnerImage } from "../../lib/client.ts";
import { mainRef } from "../../lib/dom.ts";
import { ManageContext, ownerManage } from "../../lib/manage.ts";
import { shopAuth } from "../../lib/shopAuth.ts";
import { usePageTitle } from "../../lib/title.ts";

const manage = ownerManage(ownerApi, uploadOwnerImage);

/** Every "My shop" page: requires a shop owner's token, otherwise goes to sign-in and comes back. */
export default function ShopLayout(props: RouteSectionProps) {
  usePageTitle(() => t("myshop.title"));
  const location = useLocation();
  const navigate = useNavigate();
  const signOut = () => {
    shopAuth.clear();
    navigate("/shop/login", { replace: true });
  };
  return (
    <Show
      when={shopAuth.token()}
      fallback={
        <Navigate
          href={`/shop/login?next=${encodeURIComponent(location.pathname + location.search)}`}
        />
      }
    >
      <div class="min-h-screen bg-veil">
        <header class="bg-white">
          <div class="mx-auto flex max-w-6xl items-center gap-x-2 px-4 py-2 sm:gap-x-4">
            <A href="/" class="font-display text-2xl text-garnet">{t("app.name")}</A>
            <nav class="hidden text-sm sm:flex" aria-label={t("myshop.title")}>
              <A
                href="/shop"
                end
                class="inline-flex min-h-11 items-center rounded-full px-3 text-silver-ink hover:bg-veil hover:text-ink"
                activeClass="font-semibold"
              >
                {t("myshop.title")}
              </A>
            </nav>
            <div class="ml-auto flex items-center gap-1">
              <LanguageSwitch />
              <ThemeButton />
              <SignOutButton onClick={signOut} />
            </div>
          </div>
        </header>
        <main
          ref={mainRef}
          id="main"
          tabindex="-1"
          class="mx-auto max-w-6xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 outline-none md:pb-8"
        >
          <ManageContext.Provider value={manage}>{props.children}</ManageContext.Provider>
        </main>
        {/* Phones: the same bottom bar as the public pages, so the site is one tap away. */}
        <BottomNav />
      </div>
    </Show>
  );
}
