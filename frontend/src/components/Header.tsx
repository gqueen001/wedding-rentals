import { A } from "@solidjs/router";
import { Show } from "solid-js";
import { t } from "../i18n/i18n.ts";
import { favorites } from "../lib/favorites.ts";
import GolBand from "./GolBand.tsx";
import { HeartIcon } from "./icons.tsx";
import LanguageSwitch from "./LanguageSwitch.tsx";

export default function Header() {
  const count = () => favorites.ids().length;
  return (
    <header class="bg-white">
      <GolBand />
      <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 px-4 py-1 sm:flex-nowrap sm:py-2">
        <A href="/" class="mr-auto font-display text-3xl leading-none text-garnet">
          {t("app.name")}
        </A>
        <nav class="order-last flex w-full items-center text-sm sm:order-none sm:w-auto">
          <A
            href="/dresses"
            class="inline-flex min-h-11 items-center rounded-full px-3 hover:bg-veil"
            activeClass="text-garnet font-semibold"
          >
            {t("nav.dresses")}
          </A>
          <A
            href="/favorites"
            class="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 hover:bg-veil"
            activeClass="text-garnet font-semibold"
            aria-label={t("nav.favorites_count", { count: count() })}
          >
            <HeartIcon filled={count() > 0} class="h-5 w-5 text-garnet" />
            <span class="hidden sm:inline">{t("nav.favorites")}</span>
            <Show when={count() > 0}>
              <span class="tabular-nums text-garnet">{count()}</span>
            </Show>
          </A>
        </nav>
        <LanguageSwitch />
      </div>
    </header>
  );
}
