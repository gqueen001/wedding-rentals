import { A } from "@solidjs/router";
import { For, type JSX, Show } from "solid-js";
import { ChevronRightIcon } from "../components/icons.tsx";
import { InstallButton } from "../components/InstallApp.tsx";
import { i18n, LANGS, t } from "../i18n/i18n.ts";
import { contactPhone } from "../lib/contact.ts";
import { install } from "../lib/install.ts";
import { theme, THEMES } from "../lib/theme.ts";
import { usePageTitle } from "../lib/title.ts";

const ROW = "flex min-h-14 items-center justify-between gap-4 border-b border-line py-3 text-lg";

function LinkRow(props: { href: string; children: JSX.Element }) {
  return (
    <A href={props.href} class={`${ROW} hover:text-garnet`}>
      <span>{props.children}</span>
      <ChevronRightIcon class="h-5 w-5 text-silver-ink" />
    </A>
  );
}

/** The bottom bar's "More": installing the app, language, theme, and the way in for shops. */
export default function More() {
  usePageTitle(() => t("tab.more"));
  const phone = contactPhone();
  return (
    <div class="pt-6">
      <h1 class="text-5xl">{t("tab.more")}</h1>

      <Show when={install.mode() !== "none"}>
        <section class="mt-8" aria-labelledby="more-app">
          <h2 id="more-app" class="label">{t("install.section")}</h2>
          <div class="mt-2 border-t border-line">
            <InstallButton class={`${ROW} w-full text-left hover:text-garnet`}>
              <span>{t("install.title")}</span>
              <ChevronRightIcon class="h-5 w-5 text-silver-ink" />
            </InstallButton>
          </div>
        </section>
      </Show>

      <section class="mt-8" aria-labelledby="more-language">
        <h2 id="more-language" class="label">{t("nav.language")}</h2>
        <div role="group" aria-labelledby="more-language" class="mt-2 border-t border-line">
          <For each={LANGS}>
            {(lang) => (
              <button
                type="button"
                lang={lang}
                aria-pressed={i18n.lang() === lang}
                class={`${ROW} w-full text-left`}
                classList={{ "text-garnet": i18n.lang() === lang }}
                onClick={() => i18n.setLang(lang)}
              >
                <span>{t(`lang.${lang}`)}</span>
                <Show when={i18n.lang() === lang}>
                  <span class="label text-garnet" aria-hidden="true">✓</span>
                </Show>
              </button>
            )}
          </For>
        </div>
      </section>

      <section class="mt-8" aria-labelledby="more-theme">
        <h2 id="more-theme" class="label">{t("more.theme")}</h2>
        <div role="group" aria-labelledby="more-theme" class="mt-2 border-t border-line">
          <For each={THEMES}>
            {(choice) => (
              <button
                type="button"
                aria-pressed={theme.choice() === choice}
                class={`${ROW} w-full text-left`}
                classList={{ "text-garnet": theme.choice() === choice }}
                onClick={() => theme.set(choice)}
              >
                <span>{t(`theme.${choice}`)}</span>
                <Show when={theme.choice() === choice}>
                  <span class="label text-garnet" aria-hidden="true">✓</span>
                </Show>
              </button>
            )}
          </For>
        </div>
      </section>

      <section class="mt-8" aria-labelledby="more-shops">
        <h2 id="more-shops" class="label">{t("more.for_shops")}</h2>
        <div class="mt-2 border-t border-line">
          <LinkRow href="/shop/signup">{t("footer.add_shop")}</LinkRow>
          <LinkRow href="/shop/login">{t("shoplogin.title")}</LinkRow>
        </div>
        <Show when={phone}>
          {(p) => (
            <p class="mt-6 text-sm text-silver-ink">
              {t("more.contact")}{" "}
              <a href={`tel:${p().replace(/\s/g, "")}`} class="font-semibold text-garnet">{p()}</a>
            </p>
          )}
        </Show>
      </section>

      <p class="label mt-10">{t("app.tagline")}</p>
      <A href="/credits" class="mt-3 inline-block text-sm text-silver-ink underline underline-offset-4 hover:text-ink">
        {t("credits.title")}
      </A>
    </div>
  );
}
