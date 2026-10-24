import { A, useLocation } from "@solidjs/router";
import { For, type JSX, Show } from "solid-js";
import { t } from "../i18n/i18n.ts";
import { favorites } from "../lib/favorites.ts";
import { activeTab, type Tab } from "../lib/nav.ts";
import { GridIcon, HeartIcon, HomeIcon, MoreIcon } from "./icons.tsx";

const TABS: { tab: Tab; href: string; icon: (p: { class?: string }) => JSX.Element }[] = [
  { tab: "home", href: "/", icon: HomeIcon },
  { tab: "categories", href: "/categories", icon: GridIcon },
  { tab: "favorites", href: "/favorites", icon: HeartIcon },
  { tab: "more", href: "/more", icon: MoreIcon },
];

/** The phone's app-style bottom bar; hidden from 768px up, where the header has a menu. */
export default function BottomNav() {
  const location = useLocation();
  const active = () => activeTab(location.pathname);
  const count = () => favorites.ids().length;
  return (
    <nav
      aria-label={t("tab.menu")}
      class="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul class="mx-auto flex max-w-lg">
        <For each={TABS}>
          {(item) => {
            const on = () => active() === item.tab;
            const label = () =>
              item.tab === "favorites" && count() > 0
                ? t("nav.favorites_count", { count: count() })
                : t(`tab.${item.tab}`);
            return (
              <li class="flex-1">
                <A
                  href={item.href}
                  end={item.href === "/"}
                  aria-current={on() ? "page" : undefined}
                  aria-label={label()}
                  class="flex min-h-16 flex-col items-center justify-center gap-1 px-0.5 text-center font-label text-[10px] uppercase leading-tight tracking-[0.04em]"
                  classList={{ "text-garnet": on(), "text-silver-ink": !on() }}
                >
                  <span class="relative">
                    <item.icon class="h-6 w-6" />
                    <Show when={item.tab === "favorites" && count() > 0}>
                      <span class="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-garnet-fill px-1 text-center font-sans text-[10px] leading-4 tracking-normal text-on-fill">
                        {count()}
                      </span>
                    </Show>
                  </span>
                  <span aria-hidden="true">{t(`tab.${item.tab}`)}</span>
                </A>
              </li>
            );
          }}
        </For>
      </ul>
    </nav>
  );
}
