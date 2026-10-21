import { A, Navigate, type RouteSectionProps, useLocation, useNavigate } from "@solidjs/router";
import { Show } from "solid-js";
import GolBand from "../../components/GolBand.tsx";
import LanguageSwitch from "../../components/LanguageSwitch.tsx";
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
          <GolBand />
          <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
            <A href="/" class="font-display text-2xl text-garnet">{t("app.name")}</A>
            <nav class="flex text-sm" aria-label={t("myshop.title")}>
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
              <button type="button" class="btn btn-quiet" onClick={signOut}>
                {t("admin.sign_out")}
              </button>
            </div>
          </div>
        </header>
        <main
          ref={mainRef}
          id="main"
          tabindex="-1"
          class="mx-auto max-w-6xl px-4 py-8 outline-none"
        >
          <ManageContext.Provider value={manage}>{props.children}</ManageContext.Provider>
        </main>
      </div>
    </Show>
  );
}
