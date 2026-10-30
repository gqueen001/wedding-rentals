import { useNavigate } from "@solidjs/router";
import CategoryBar from "../components/CategoryBar.tsx";
import { InstallBar } from "../components/InstallApp.tsx";
import SearchBox from "../components/SearchBox.tsx";
import { t } from "../i18n/i18n.ts";
import { usePageTitle } from "../lib/title.ts";

export default function Home() {
  usePageTitle(() => undefined);
  const navigate = useNavigate();
  const search = (q: string) => navigate(q ? `/search?${new URLSearchParams({ q })}` : "/search");

  return (
    <>
      <section class="grid gap-10 pt-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-center md:pt-10">
        <div>
          {/* The hero is type only: two wedding rings, the brand word and a small ornament line. */}
          <div class="flex flex-col items-center gap-3 py-16 sm:py-24" aria-hidden="true">
            <svg viewBox="0 0 40 24" class="w-14 text-garnet" fill="none" stroke="currentColor" stroke-width="1.2">
              <circle cx="15" cy="12" r="9" />
              <circle cx="25" cy="12" r="9" />
            </svg>
            <p class="font-display text-[3.4rem] uppercase leading-none tracking-[0.04em] text-ink min-[400px]:text-[4rem] sm:text-[5.5rem] md:text-[4rem] lg:text-[5.5rem]">
              {t("app.name")}
            </p>
            <span class="flex items-center gap-3 text-garnet">
              <span class="h-px w-16 bg-current" />
              <span class="h-1.5 w-1.5 rotate-45 bg-current" />
              <span class="h-px w-16 bg-current" />
            </span>
          </div>
          <h1 class="label text-center">{t("home.title")}</h1>
          <p class="mx-auto mt-3 max-w-md text-center text-silver-ink">{t("home.lead")}</p>
          <div class="mx-auto mt-6 max-w-md">
            <SearchBox
              value=""
              onSearch={search}
              label={t("search.salon_label")}
              placeholder={t("search.salon_placeholder")}
            />
          </div>
          <InstallBar />
        </div>
        <CategoryBar />
      </section>
    </>
  );
}
