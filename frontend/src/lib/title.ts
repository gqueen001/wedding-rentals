import { createEffect, onCleanup } from "solid-js";
import { t } from "../i18n/i18n.ts";

/**
 * Keeps document.title as "<page> | <brand>", or just the brand when the page has no title.
 * When the page closes, the title goes back to the brand.
 */
export function usePageTitle(title: () => string | undefined) {
  createEffect(() => {
    const brand = t("app.name");
    const page = title();
    document.title = page ? `${page} | ${brand}` : brand;
  });
  onCleanup(() => {
    document.title = t("app.name");
  });
}
