import { type Accessor, createSignal } from "solid-js";
import en from "./en.json" with { type: "json" };
import ru from "./ru.json" with { type: "json" };
import tk from "./tk.json" with { type: "json" };
import { type KV, safeKV } from "../lib/storage.ts";
import type { Lang } from "../lib/types.ts";

export type MessageKey = keyof typeof en;
export type Params = Record<string, string | number>;

export const LANGS: readonly Lang[] = ["tk", "ru", "en"];
export const DEFAULT_LANG: Lang = "tk";
// The Record type makes `deno check` fail if tk or ru is missing a key.
export const dictionaries: Record<Lang, Record<MessageKey, string>> = { tk, ru, en };

const LANG_KEY = "wr.lang";

/** Looks key up in dict, then in English, then returns the key itself; fills {name} params. */
export function translate(dict: Partial<Record<string, string>>, key: string, params?: Params): string {
  const english: Partial<Record<string, string>> = dictionaries.en;
  const template = dict[key] ?? english[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export function isLang(v: unknown): v is Lang {
  return typeof v === "string" && (LANGS as readonly string[]).includes(v);
}

export interface I18n {
  lang: Accessor<Lang>;
  setLang(lang: Lang): void;
  t(key: MessageKey, params?: Params): string;
  /** For keys built at runtime, such as `error.${code}`. */
  tr(key: string, params?: Params): string;
}

export function createI18n(kv: KV): I18n {
  const stored = kv.get(LANG_KEY);
  const [lang, setLangSignal] = createSignal<Lang>(isLang(stored) ? stored : DEFAULT_LANG);
  const tr = (key: string, params?: Params) => translate(dictionaries[lang()], key, params);
  return {
    lang,
    setLang(next) {
      setLangSignal(next);
      kv.set(LANG_KEY, next);
      if (typeof document !== "undefined") document.documentElement.lang = next;
    },
    t: tr,
    tr,
  };
}

export const i18n = createI18n(safeKV());
export const t = i18n.t;
export const tr = i18n.tr;
