import { type Accessor, createSignal } from "solid-js";
import { type KV, safeKV } from "./storage.ts";

/** The theme picked on the More page; "auto" follows the device's light or dark setting. */
export type ThemeChoice = "auto" | "light" | "dark";

export const THEMES: readonly ThemeChoice[] = ["auto", "light", "dark"];

/** Kept in step with the inline script in index.html, which applies the theme before the first paint. */
export const THEME_KEY = "wr.theme";

/** The browser bar's color in each theme (the <meta name="theme-color"> tags in index.html). */
export const THEME_COLOR = { light: "#8e1b2e", dark: "#1b1b1e" } as const;

/** A stored value as a choice: anything but "light" or "dark" means auto. */
export function parseTheme(stored: string | null): ThemeChoice {
  return stored === "light" || stored === "dark" ? stored : "auto";
}

/** The <html data-theme> value for a choice; null means no attribute, so the device decides. */
export function themeAttr(choice: ThemeChoice): "light" | "dark" | null {
  return choice === "auto" ? null : choice;
}

export interface Theme {
  choice: Accessor<ThemeChoice>;
  set(choice: ThemeChoice): void;
}

/** The theme choice, remembered in kv and applied to the page (when there is one). */
export function createTheme(kv: KV): Theme {
  const [choice, setChoice] = createSignal(parseTheme(kv.get(THEME_KEY)));
  return {
    choice,
    set(next) {
      setChoice(next);
      if (next === "auto") kv.remove(THEME_KEY);
      else kv.set(THEME_KEY, next);
      if (typeof document === "undefined") return;
      const attr = themeAttr(next);
      if (attr) document.documentElement.dataset.theme = attr;
      else delete document.documentElement.dataset.theme;
      // A picked theme also picks the browser bar's color; auto lets the tags' media queries decide.
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
        m.content = attr ? THEME_COLOR[attr] : m.media.includes("dark") ? THEME_COLOR.dark : THEME_COLOR.light;
      });
    },
  };
}

export const theme = createTheme(safeKV());
