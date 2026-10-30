import { For } from "solid-js";
import { t, tr } from "../i18n/i18n.ts";
import { catLabel } from "../lib/catalog.ts";
import { type PhotoKey, PHOTOS, photoStyle } from "../lib/photos.ts";
import { usePageTitle } from "../lib/title.ts";

/** What each photo shows: every photo is a category's. */
const label = (key: PhotoKey) => tr(catLabel(key));

/** /credits: who took the site's photos, under which licence, and where they come from. */
export default function Credits() {
  usePageTitle(() => t("credits.title"));
  return (
    <div class="pt-6">
      <h1 class="text-5xl sm:text-6xl">{t("credits.title")}</h1>
      <p class="mt-3 max-w-prose text-silver-ink">{t("credits.lead")}</p>
      <ul class="mt-6 max-w-2xl border-t border-line">
        <For each={Object.keys(PHOTOS) as PhotoKey[]}>
          {(key) => {
            const photo = PHOTOS[key];
            return (
              <li class="flex items-center gap-4 border-b border-line py-3">
                <span
                  class="h-14 w-10 shrink-0 rounded-[50%] bg-veil bg-cover dark:brightness-[.86]"
                  style={photoStyle(photo)}
                  aria-hidden="true"
                />
                <span class="min-w-0 flex-1 text-sm">
                  <span class="block font-display text-2xl leading-tight">{label(key)}</span>
                  <span class="mt-1 block text-silver-ink">
                    {t("credits.author", { name: photo.author })} ·{" "}
                    <a href={photo.licenseUrl} target="_blank" rel="noopener noreferrer" class="underline underline-offset-4 hover:text-ink">
                      {photo.license}
                    </a>{" "}
                    ·{" "}
                    <a href={photo.source} target="_blank" rel="noopener noreferrer" class="underline underline-offset-4 hover:text-ink">
                      {t("credits.source")}
                    </a>
                  </span>
                </span>
              </li>
            );
          }}
        </For>
      </ul>
    </div>
  );
}
