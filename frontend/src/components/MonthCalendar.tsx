import { createSignal, createUniqueId, For, Show } from "solid-js";
import { t, tr } from "../i18n/i18n.ts";
import { dayKey, isInWindow, monthGrid, monthsInWindow, parseDayKey } from "../lib/calendar.ts";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons.tsx";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

/** "14 November" / "14 ноября" / "14 noýabr" for a YYYY-MM-DD key. */
export function dayLabel(key: string): string {
  const { month, day } = parseDayKey(key);
  return tr("cal.day", { day, month: tr(`cal.month_of.${month}`) });
}

interface DayProps {
  date: string;
  today: string;
  inWindow: boolean;
  busy: boolean;
  pending: boolean;
  onToggle?: (day: string) => void;
}

function Day(props: DayProps) {
  const number = () => parseDayKey(props.date).day;
  const label = () =>
    props.inWindow
      ? tr(props.busy ? "avail.day_busy" : "avail.day_free", { date: dayLabel(props.date) })
      : dayLabel(props.date);
  const look = () => ({
    "flex h-10 w-full items-center justify-center rounded-md tabular-nums": true,
    "bg-blush text-garnet-deep line-through": props.inWindow && props.busy,
    "text-silver": !props.inWindow,
    "ring-1 ring-garnet": props.date === props.today,
    "opacity-50": props.pending,
  });
  return (
    <Show
      when={props.onToggle && props.inWindow}
      fallback={
        <span classList={look()}>
          <span class="sr-only">{label()}</span>
          <span aria-hidden="true">{number()}</span>
        </span>
      }
    >
      <button
        type="button"
        classList={{ ...look(), "hover:bg-veil": !props.busy }}
        aria-busy={props.pending}
        aria-label={`${label()}. ${t(props.busy ? "avail.mark_free" : "avail.mark_busy")}`}
        onClick={() => {
          if (!props.pending) props.onToggle?.(props.date);
        }}
      >
        {number()}
      </button>
    </Show>
  );
}

/**
 * One month at a time, Monday first, limited to the server's window.
 * Read-only by default; with onToggle every day in the window becomes a toggle button.
 */
export default function MonthCalendar(props: {
  window: { from: string; to: string };
  busy: ReadonlySet<string>;
  pending?: ReadonlySet<string>;
  onToggle?: (day: string) => void;
}) {
  const months = () => monthsInWindow(props.window.from, props.window.to);
  const [index, setIndex] = createSignal(0);
  const current = () => months()[Math.min(index(), months().length - 1)];
  const atStart = () => index() === 0;
  const atEnd = () => index() >= months().length - 1;
  const captionId = createUniqueId();

  return (
    <div>
      <div class="flex items-center justify-between">
        <button
          type="button"
          class="btn-icon aria-disabled:opacity-40"
          aria-label={t("cal.prev")}
          aria-disabled={atStart()}
          onClick={() => !atStart() && setIndex(index() - 1)}
        >
          <ChevronLeftIcon />
        </button>
        <p id={captionId} class="label text-ink" aria-live="polite">
          {tr(`cal.month.${current().month}`)} {current().year}
        </p>
        <button
          type="button"
          class="btn-icon aria-disabled:opacity-40"
          aria-label={t("cal.next")}
          aria-disabled={atEnd()}
          onClick={() => !atEnd() && setIndex(index() + 1)}
        >
          <ChevronRightIcon />
        </button>
      </div>
      <table class="mt-2 w-full table-fixed border-collapse text-center text-sm" aria-labelledby={captionId}>
        <thead>
          <tr>
            <For each={WEEKDAYS}>
              {(n) => <th scope="col" class="pb-1 text-xs font-normal text-silver-ink">{tr(`cal.weekday.${n}`)}</th>}
            </For>
          </tr>
        </thead>
        <tbody>
          <For each={monthGrid(current().year, current().month)}>
            {(week) => (
              <tr>
                <For each={week}>
                  {(day) => (
                    <td class="p-0.5">
                      <Show when={day}>
                        {(d) => {
                          const date = () => dayKey(current().year, current().month, d());
                          return (
                            <Day
                              date={date()}
                              today={props.window.from}
                              inWindow={isInWindow(date(), props.window.from, props.window.to)}
                              busy={props.busy.has(date())}
                              pending={props.pending?.has(date()) ?? false}
                              onToggle={props.onToggle}
                            />
                          );
                        }}
                      </Show>
                    </td>
                  )}
                </For>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}
