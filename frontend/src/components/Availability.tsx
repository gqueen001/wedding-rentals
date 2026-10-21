import { createResource, Match, Switch } from "solid-js";
import { t } from "../i18n/i18n.ts";
import { api } from "../lib/client.ts";
import ErrorState from "./ErrorState.tsx";
import MonthCalendar from "./MonthCalendar.tsx";

/** A listing page's read-only calendar of busy days, with a legend and a reminder to call. */
export default function Availability(props: { listingId: number }) {
  const [data, { refetch }] = createResource(() => props.listingId, (id) => api.busyDays(id));
  return (
    <section aria-labelledby="availability-title" class="border-t border-veil pt-6">
      <h2 id="availability-title" class="text-2xl">{t("avail.title")}</h2>
      <div class="mt-4 max-w-sm">
        <Switch>
          <Match when={data.error}>
            <ErrorState error={data.error} onRetry={refetch} />
          </Match>
          <Match when={!data()}>
            <div class="h-[25rem] animate-pulse rounded-lg bg-veil" aria-busy="true" aria-label={t("common.loading")} />
          </Match>
          <Match when={data()}>
            {(d) => (
              <>
                <MonthCalendar window={d()} busy={new Set(d().days)} />
                <ul class="mt-3 flex gap-5 text-sm">
                  <li class="flex items-center gap-2">
                    <span aria-hidden="true" class="inline-flex h-5 w-5 items-center justify-center rounded bg-blush text-[10px] text-garnet-deep line-through">14</span>
                    {t("avail.busy")}
                  </li>
                  <li class="flex items-center gap-2">
                    <span aria-hidden="true" class="inline-flex h-5 w-5 items-center justify-center rounded border border-silver text-[10px]">14</span>
                    {t("avail.free")}
                  </li>
                </ul>
                <p class="mt-3 text-sm text-silver-ink">{t("avail.note")}</p>
              </>
            )}
          </Match>
        </Switch>
      </div>
    </section>
  );
}
