import { A, useNavigate } from "@solidjs/router";
import { createResource, For, Match, Switch } from "solid-js";
import DressGrid from "../components/DressGrid.tsx";
import ErrorState from "../components/ErrorState.tsx";
import SearchBox from "../components/SearchBox.tsx";
import { GridSkeleton } from "../components/Skeleton.tsx";
import { i18n, t } from "../i18n/i18n.ts";
import { useCities } from "../lib/cities.ts";
import { api } from "../lib/client.ts";
import { EMPTY_FILTERS, filtersToQuery } from "../lib/filters.ts";
import { cityName } from "../lib/format.ts";
import { usePageTitle } from "../lib/title.ts";

export default function Home() {
  usePageTitle(() => undefined);
  const navigate = useNavigate();
  const cities = useCities();
  const [newest, { refetch }] = createResource(() => api.dresses(new URLSearchParams({ per_page: "8" })));

  const browse = (q: string, city = "") => {
    const qs = filtersToQuery({ ...EMPTY_FILTERS, q, city }).toString();
    navigate(qs ? `/dresses?${qs}` : "/dresses");
  };

  return (
    <>
      <section class="pb-12 pt-10 sm:pt-16">
        <h1 class="max-w-2xl text-5xl sm:text-6xl">{t("home.title")}</h1>
        <p class="mt-4 max-w-xl text-lg text-silver-ink">{t("home.lead")}</p>
        <div class="mt-8 max-w-2xl space-y-4">
          <SearchBox value="" large onSearch={(q) => browse(q)} />
          <label class="flex flex-wrap items-center gap-3 text-sm">
            <span class="text-silver-ink">{t("home.city")}</span>
            <select
              class="field-input w-auto"
              value=""
              onChange={(e) => e.currentTarget.value && browse("", e.currentTarget.value)}
            >
              <option value="">{t("home.all_cities")}</option>
              <For each={cities()}>{(c) => <option value={c.slug}>{cityName(c, i18n.lang())}</option>}</For>
            </select>
          </label>
        </div>
      </section>

      <section aria-labelledby="newest-title">
        <div class="mb-6 flex items-baseline justify-between gap-4">
          <h2 id="newest-title" class="text-3xl">{t("home.newest")}</h2>
          <A href="/dresses" class="text-sm font-semibold text-garnet underline-offset-4 hover:underline">
            {t("home.see_all")}
          </A>
        </div>
        <Switch>
          <Match when={newest.error}>
            <ErrorState error={newest.error} onRetry={refetch} />
          </Match>
          <Match when={!newest()}>
            <GridSkeleton count={8} />
          </Match>
          <Match when={newest()}>{(page) => <DressGrid items={page().items} />}</Match>
        </Switch>
      </section>
    </>
  );
}
