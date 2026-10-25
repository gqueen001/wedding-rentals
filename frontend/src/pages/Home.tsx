import { useNavigate } from "@solidjs/router";
import { createResource, For } from "solid-js";
import CategoryBar from "../components/CategoryBar.tsx";
import SearchBox from "../components/SearchBox.tsx";
import { i18n, t } from "../i18n/i18n.ts";
import { useCities } from "../lib/cities.ts";
import { api } from "../lib/client.ts";
import { EMPTY_FILTERS, filtersToQuery } from "../lib/filters.ts";
import { cityName } from "../lib/format.ts";
import { usePageTitle } from "../lib/title.ts";

/** A photo in an oval frame, or a soft gray oval while there is none. */
function Oval(props: { photo: string | null | undefined; class: string }) {
  return (
    <span
      class={`block rounded-[50%] bg-veil bg-cover bg-[center_20%] ${props.class}`}
      style={props.photo ? { "background-image": `url("${props.photo}")` } : undefined}
      aria-hidden="true"
    />
  );
}

export default function Home() {
  usePageTitle(() => undefined);
  const navigate = useNavigate();
  const cities = useCities();
  // The newest listings of every category: the first two with a photo dress the hero.
  const [newest] = createResource(() => api.items(new URLSearchParams({ per_page: "8" })));
  const photo = (i: number) =>
    newest.state === "ready" ? (newest()?.items ?? []).filter((it) => it.photo)[i]?.photo : null;
  const search = (q: string) => navigate(q ? `/search?${new URLSearchParams({ q })}` : "/search");
  const browseCity = (city: string) => {
    const qs = filtersToQuery({ ...EMPTY_FILTERS, city }).toString();
    navigate(qs ? `/dresses?${qs}` : "/dresses");
  };

  return (
    <>
      <section class="grid gap-10 pt-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-center md:pt-10">
        <div>
          {/* The hero: the brand word over an oval photo, a smaller round photo, a hairline. */}
          <div class="relative mx-auto h-[22rem] max-w-md overflow-hidden sm:h-[28rem]">
            <span
              class="absolute left-1/2 top-1/2 h-px w-[140%] -translate-x-1/2 -rotate-[38deg] bg-line"
              aria-hidden="true"
            />
            <Oval photo={photo(0)} class="absolute left-1/2 top-2 h-[19rem] w-52 -translate-x-1/2 sm:h-[24rem] sm:w-64" />
            <Oval photo={photo(1)} class="absolute bottom-6 right-2 h-28 w-20 border-4 border-white sm:right-6" />
            <p
              class="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-display text-[5rem] uppercase leading-none text-ink mix-blend-multiply dark:mix-blend-screen sm:text-[7rem]"
              aria-hidden="true"
            >
              {t("app.name")}
            </p>
          </div>
          <h1 class="label text-center">{t("home.title")}</h1>
          <p class="mx-auto mt-3 max-w-md text-center text-silver-ink">{t("home.lead")}</p>
          <div class="mx-auto mt-6 max-w-md space-y-4">
            <SearchBox value="" onSearch={search} />
            <div class="flex justify-center">
              <select
                class="field-input w-auto"
                aria-label={t("home.city")}
                value=""
                onChange={(e) => e.currentTarget.value && browseCity(e.currentTarget.value)}
              >
                <option value="">{t("home.all_cities")}</option>
                <For each={cities()}>{(c) => <option value={c.slug}>{cityName(c, i18n.lang())}</option>}</For>
              </select>
            </div>
          </div>
        </div>
        <CategoryBar />
      </section>
    </>
  );
}
