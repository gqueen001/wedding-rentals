import { createEffect } from "solid-js";
import { t } from "../i18n/i18n.ts";

/** Keeps document.title as "<page> | <brand>", or just the brand when the page has no title. */
export function usePageTitle(title: () => string | undefined) {
  createEffect(() => {
    const brand = t("app.name");
    const page = title();
    document.title = page ? `${page} | ${brand}` : brand;
  });
}
