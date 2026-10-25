import { A } from "@solidjs/router";
import { Show } from "solid-js";
import { t } from "../i18n/i18n.ts";
import { favorites } from "../lib/favorites.ts";
import AccountAvatar from "./AccountAvatar.tsx";
import LanguageSwitch from "./LanguageSwitch.tsx";
import ThemeButton from "./ThemeButton.tsx";

const MENU_LINK = "inline-flex min-h-11 items-center gap-1.5 px-2 font-label text-xs uppercase tracking-[0.2em]";

/** Phones: the logo and the account avatar (the bottom bar does the rest). Desktop: the logo, a menu (search first) and the avatar. */
export default function Header() {
  const count = () => favorites.ids().length;
  return (
    <header class="bg-white">
      <div class="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 md:px-8 md:py-5">
        <A href="/" class="mr-auto font-label text-lg uppercase tracking-[0.32em] text-ink">
          {t("app.name")}
        </A>
        <nav class="hidden items-center md:flex" aria-label={t("tab.menu")}>
          <A href="/search" class={MENU_LINK} activeClass="text-garnet">{t("search.title")}</A>
          <A href="/categories" class={MENU_LINK} activeClass="text-garnet">{t("tab.categories")}</A>
          <A
            href="/favorites"
            class={MENU_LINK}
            activeClass="text-garnet"
            aria-label={t("nav.favorites_count", { count: count() })}
          >
            {t("tab.favorites")}
            <Show when={count() > 0}>
              <span class="-ml-1 -translate-y-1 text-[10px] leading-none tracking-normal tabular-nums text-garnet">{count()}</span>
            </Show>
          </A>
          <LanguageSwitch />
          <ThemeButton />
        </nav>
        <AccountAvatar />
      </div>
    </header>
  );
}
