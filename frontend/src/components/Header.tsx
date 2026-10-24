import { A, useNavigate } from "@solidjs/router";
import { Show } from "solid-js";
import { t } from "../i18n/i18n.ts";
import { favorites } from "../lib/favorites.ts";
import AccountAvatar from "./AccountAvatar.tsx";
import { HeartIcon, SearchIcon } from "./icons.tsx";
import LanguageSwitch from "./LanguageSwitch.tsx";

const MENU_LINK = "inline-flex min-h-11 items-center gap-1.5 px-2 font-label text-xs uppercase tracking-[0.2em]";

/** Phones: the logo, a search button and the account avatar (the bottom bar does the rest). Desktop: a full menu. */
export default function Header() {
  const navigate = useNavigate();
  const count = () => favorites.ids().length;
  let input!: HTMLInputElement;
  return (
    <header class="bg-white">
      <div class="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 md:px-8 md:py-5">
        <A href="/" class="mr-auto font-label text-lg uppercase tracking-[0.32em] text-ink md:mr-0">
          {t("app.name")}
        </A>
        <A href="/search" class="btn-icon text-ink md:hidden" aria-label={t("search.title")}>
          <SearchIcon class="h-6 w-6" />
        </A>
        <form
          role="search"
          class="hidden flex-1 md:block"
          onSubmit={(e) => {
            e.preventDefault();
            const q = input.value.trim();
            navigate(q ? `/search?${new URLSearchParams({ q })}` : "/search");
          }}
        >
          <label class="relative block max-w-sm">
            <span class="sr-only">{t("search.label")}</span>
            <SearchIcon class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-silver-ink" />
            <input
              ref={input}
              type="search"
              autocomplete="off"
              placeholder={t("search.placeholder")}
              class="min-h-11 w-full rounded-full border border-silver bg-white pl-10 pr-4 text-sm"
            />
          </label>
        </form>
        <nav class="hidden items-center md:flex" aria-label={t("tab.menu")}>
          <A href="/categories" class={MENU_LINK} activeClass="text-garnet">{t("tab.categories")}</A>
          <A
            href="/favorites"
            class={MENU_LINK}
            activeClass="text-garnet"
            aria-label={t("nav.favorites_count", { count: count() })}
          >
            <HeartIcon filled={count() > 0} class="h-4 w-4 text-garnet" />
            {t("tab.favorites")}
            <Show when={count() > 0}>
              <span class="tabular-nums text-garnet">{count()}</span>
            </Show>
          </A>
          <LanguageSwitch />
        </nav>
        <AccountAvatar />
      </div>
    </header>
  );
}
