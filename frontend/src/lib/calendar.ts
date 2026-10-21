/** A month of a year; month is 1–12. */
export interface YearMonth {
  year: number;
  month: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-11-04" for 4 November 2026. */
export function dayKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Splits a YYYY-MM-DD key into numbers. */
export function parseDayKey(key: string): { year: number; month: number; day: number } {
  const [year, month, day] = key.split("-").map(Number);
  return { year, month, day };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The weeks of a month, Monday first; null pads before the 1st and after the last day. */
export function monthGrid(year: number, month: number): (number | null)[][] {
  const offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const cells: (number | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= daysInMonth(year, month); d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Every month from the one containing `from` to the one containing `to`. */
export function monthsInWindow(from: string, to: string): YearMonth[] {
  const start = parseDayKey(from);
  const end = parseDayKey(to);
  const months: YearMonth[] = [];
  let { year, month } = start;
  while (year < end.year || (year === end.year && month <= end.month)) {
    months.push({ year, month });
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

/** Whether a day lies within from…to, both inclusive; YYYY-MM-DD keys compare as strings. */
export function isInWindow(day: string, from: string, to: string): boolean {
  return day >= from && day <= to;
}
