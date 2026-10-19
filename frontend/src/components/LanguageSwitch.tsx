import { For } from "solid-js";
import { i18n, LANGS, t } from "../i18n/i18n.ts";
import type { Lang } from "../lib/types.ts";

const CODE: Record<Lang, string> = { tk: "TK", ru: "RU", en: "EN" };

export default function LanguageSwitch() {
  return (
    <div role="group" aria-label={t("nav.language")} class="flex">
      <For each={LANGS}>
        {(lang) => (
          <button
            type="button"
            lang={lang}
            title={t(`lang.${lang}`)}
            aria-label={t(`lang.${lang}`)}
            aria-pressed={i18n.lang() === lang}
            class="min-h-11 min-w-11 px-2 text-xs"
            classList={{
              "font-semibold text-garnet underline underline-offset-4": i18n.lang() === lang,
              "text-silver-ink hover:text-ink": i18n.lang() !== lang,
            }}
            onClick={() => i18n.setLang(lang)}
          >
            {CODE[lang]}
          </button>
        )}
      </For>
    </div>
  );
}
