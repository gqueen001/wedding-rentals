import { A } from "@solidjs/router";
import { t } from "../i18n/i18n.ts";
import { usePageTitle } from "../lib/title.ts";

export default function NotFound() {
  usePageTitle(() => t("notfound.title"));
  return (
    <div class="py-16">
      <h1 class="text-4xl">{t("notfound.title")}</h1>
      <p class="mt-3 max-w-prose text-silver-ink">{t("notfound.body")}</p>
      <A href="/" class="btn btn-primary mt-8">
        {t("notfound.home")}
      </A>
    </div>
  );
}
