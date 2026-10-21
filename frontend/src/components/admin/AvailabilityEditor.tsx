import { createEffect, createResource, createSignal, Match, Show, Switch } from "solid-js";
import { t } from "../../i18n/i18n.ts";
import { api } from "../../lib/client.ts";
import ErrorState from "../ErrorState.tsx";
import MonthCalendar, { dayLabel } from "../MonthCalendar.tsx";

const withDay = (set: ReadonlySet<string>, day: string, on: boolean): ReadonlySet<string> => {
  const next = new Set(set);
  if (on) next.add(day);
  else next.delete(day);
  return next;
};

/** Tap a day to mark it busy or free; every tap saves at once and reverts if the save fails. */
export default function AvailabilityEditor(props: { dressId: number }) {
  const [data, { refetch }] = createResource(() => props.dressId, (id) => api.admin.busyDays(id));
  const [busy, setBusy] = createSignal<ReadonlySet<string>>(new Set());
  const [pending, setPending] = createSignal<ReadonlySet<string>>(new Set());
  const [status, setStatus] = createSignal("");
  const [failure, setFailure] = createSignal("");
  createEffect(() => {
    if (data.state === "ready") setBusy(new Set(data()?.days ?? []));
  });

  async function toggle(day: string) {
    if (pending().has(day)) return;
    const makeBusy = !busy().has(day);
    setBusy((s) => withDay(s, day, makeBusy));
    setPending((s) => withDay(s, day, true));
    setFailure("");
    try {
      await (makeBusy ? api.admin.markBusy(props.dressId, day) : api.admin.markFree(props.dressId, day));
      setStatus(t(makeBusy ? "avail.marked_busy" : "avail.marked_free", { date: dayLabel(day) }));
    } catch {
      setBusy((s) => withDay(s, day, !makeBusy));
      setFailure(t("avail.save_failed", { date: dayLabel(day) }));
    } finally {
      setPending((s) => withDay(s, day, false));
    }
  }

  return (
    <Switch>
      <Match when={data.error}>
        <ErrorState error={data.error} onRetry={refetch} />
      </Match>
      <Match when={!data()}>
        <p class="text-sm text-silver-ink">{t("common.loading")}</p>
      </Match>
      <Match when={data()}>
        {(d) => (
          <div class="max-w-sm">
            <MonthCalendar window={d()} busy={busy()} pending={pending()} onToggle={(day) => void toggle(day)} />
            <p role="status" aria-live="polite" class="sr-only">{status()}</p>
            <Show when={failure()}>
              <p role="alert" class="mt-3 text-sm text-garnet">{failure()}</p>
            </Show>
          </div>
        )}
      </Match>
    </Switch>
  );
}
