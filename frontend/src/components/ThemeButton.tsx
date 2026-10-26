import { Match, Switch } from "solid-js";
import { t } from "../i18n/i18n.ts";
import { nextTheme, theme } from "../lib/theme.ts";
import { MoonIcon, SunIcon, ThemeAutoIcon } from "./icons.tsx";

/** The theme switch beside the languages (computer menu, My shop, admin, shop sign-in): Auto → Light → Dark; the icon shows the choice. */
export default function ThemeButton() {
  const name = () => `${t("more.theme")}: ${t(`theme.${theme.choice()}`)}`;
  return (
    <button
      type="button"
      class="btn-icon text-silver-ink hover:text-ink"
      aria-label={name()}
      title={name()}
      onClick={() => theme.set(nextTheme(theme.choice()))}
    >
      <Switch fallback={<ThemeAutoIcon class="h-5 w-5" />}>
        <Match when={theme.choice() === "light"}>
          <SunIcon class="h-5 w-5" />
        </Match>
        <Match when={theme.choice() === "dark"}>
          <MoonIcon class="h-5 w-5" />
        </Match>
      </Switch>
    </button>
  );
}
