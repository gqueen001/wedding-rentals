import { useNavigate } from "@solidjs/router";
import CategoryBar from "../components/CategoryBar.tsx";
import { InstallBar } from "../components/InstallApp.tsx";
import SearchBox from "../components/SearchBox.tsx";
import { t } from "../i18n/i18n.ts";
import { type Photo, PHOTOS, photoStyle } from "../lib/photos.ts";
import { usePageTitle } from "../lib/title.ts";

/** A photo in an oval frame, a little dimmed in dark mode. */
function Oval(props: { photo: Photo; class: string }) {
  return (
    <span
      class={`block rounded-[50%] bg-veil bg-cover dark:brightness-[.86] ${props.class}`}
      style={photoStyle(props.photo)}
      aria-hidden="true"
    />
  );
}

export default function Home() {
  usePageTitle(() => undefined);
  const navigate = useNavigate();
  const search = (q: string) => navigate(q ? `/search?${new URLSearchParams({ q })}` : "/search");

  return (
    <>
      <section class="grid gap-10 pt-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-center md:pt-10">
        <div>
          {/* The hero: the brand word over a salon's gowns, a smaller oval of roses, a hairline. */}
          <div class="relative mx-auto h-[22rem] max-w-md overflow-hidden sm:h-[28rem]">
            <span
              class="absolute left-1/2 top-1/2 h-px w-[140%] -translate-x-1/2 -rotate-[38deg] bg-line"
              aria-hidden="true"
            />
            <Oval photo={PHOTOS.dresses} class="absolute left-1/2 top-2 h-[19rem] w-52 -translate-x-1/2 sm:h-[24rem] sm:w-64" />
            <Oval photo={PHOTOS.bouquet} class="absolute bottom-6 right-2 h-28 w-20 border-4 border-white sm:right-6" />
            <p
              class="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-display text-[5rem] uppercase leading-none text-ink mix-blend-multiply dark:mix-blend-normal dark:[text-shadow:0_2px_14px_rgb(0_0_0_/_0.6)] sm:text-[7rem]"
              aria-hidden="true"
            >
              {t("app.name")}
            </p>
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
