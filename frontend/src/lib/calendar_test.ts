import { assertEquals } from "@std/assert";
import { dayKey, daysInMonth, isInWindow, monthGrid, monthsInWindow, parseDayKey } from "./calendar.ts";

Deno.test("dayKey and parseDayKey round-trip with zero padding", () => {
  assertEquals(dayKey(2026, 11, 4), "2026-11-04");
  assertEquals(parseDayKey("2026-11-04"), { year: 2026, month: 11, day: 4 });
});

Deno.test("daysInMonth knows leap years", () => {
  assertEquals(daysInMonth(2027, 2), 28);
  assertEquals(daysInMonth(2028, 2), 29);
  assertEquals(daysInMonth(2026, 11), 30);
  assertEquals(daysInMonth(2026, 12), 31);
});

Deno.test("monthGrid starts weeks on Monday and pads with null", () => {
  // 1 November 2026 is a Sunday: six blanks, then 1; 30 days fill six weeks.
  const nov = monthGrid(2026, 11);
  assertEquals(nov.length, 6);
  assertEquals(nov[0], [null, null, null, null, null, null, 1]);
  assertEquals(nov[5], [30, null, null, null, null, null, null]);
  // 1 February 2027 is a Monday and the month has 28 days: exactly four full weeks.
  const feb = monthGrid(2027, 2);
  assertEquals(feb.length, 4);
  assertEquals(feb[0], [1, 2, 3, 4, 5, 6, 7]);
  assertEquals(feb[3], [22, 23, 24, 25, 26, 27, 28]);
  // February 2028 (leap) starts on a Tuesday and ends on the 29th.
  const leap = monthGrid(2028, 2);
  assertEquals(leap[0][0], null);
  assertEquals(leap[0][1], 1);
  assertEquals(leap.at(-1)!.filter((d) => d !== null).at(-1), 29);
  for (const week of [...nov, ...feb, ...leap]) assertEquals(week.length, 7);
});

Deno.test("monthsInWindow lists every month across a year boundary", () => {
  const months = monthsInWindow("2026-10-20", "2027-10-20");
  assertEquals(months.length, 13);
  assertEquals(months[0], { year: 2026, month: 10 });
  assertEquals(months[2], { year: 2026, month: 12 });
  assertEquals(months[3], { year: 2027, month: 1 });
  assertEquals(months[12], { year: 2027, month: 10 });
  assertEquals(monthsInWindow("2026-10-20", "2026-10-31"), [{ year: 2026, month: 10 }]);
});

Deno.test("isInWindow includes both ends", () => {
  assertEquals(isInWindow("2026-10-20", "2026-10-20", "2027-10-20"), true);
  assertEquals(isInWindow("2027-10-20", "2026-10-20", "2027-10-20"), true);
  assertEquals(isInWindow("2026-10-19", "2026-10-20", "2027-10-20"), false);
  assertEquals(isInWindow("2027-10-21", "2026-10-20", "2027-10-20"), false);
});
