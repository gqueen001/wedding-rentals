# Dress Availability Calendar: Design Spec

**Date:** 2026-10-20
**Status:** Approved in brainstorming; awaiting the product owner's review of this document
**Builds on:** `2026-10-18-wedding-rentals-v1-design.md`. The v1 spec listed availability calendars under §11 "Out of scope"; this spec adds a limited version.

## 1. Goal

Every dress page shows which days that dress is already rented, so a bride can see whether it's free on her wedding day before she calls the shop.

## 2. Decisions

| Topic | Decision |
|---|---|
| Who updates it | **Admins**, in the admin panel, when a shop tells them about a rental. Shops still have no accounts. |
| What gets marked | **Single days.** Each day is busy or free; a 4-day rental means marking 4 days. There are no ranges or "rentals". |
| Extra data | **None.** A day is only busy or free: no notes, customer names or phone numbers. |
| Where brides see it | **Only on the dress page.** The dress list does not filter by date. |
| How far ahead | From today to **today + 12 months**, the same for brides and admins. |
| Whose "today" | **Turkmenistan time, UTC+5.** Turkmenistan has no daylight saving time. |
| Booking | Still none in-app. Brides call the shop, as in v1. |

## 3. What the bride sees (dress page)

The dress page gets a new **Availability** section between the dress details (sizes, color, style, sleeves, description) and the shop card.

- **Layout:** a calendar showing one month at a time, with previous and next arrows.
  - It opens on the current month.
  - The arrows go from the current month to the month containing today + 12 months. They are disabled at either end.
- **Grid:**
  - Weeks start on **Monday**.
  - **Busy** days have a muted garnet background with the day number struck through.
  - **Free** days are plain.
  - **Past** days are faded, and so are days after the 12-month limit.
  - **Today** has a thin ring.
- **Legend:** "Busy" and "Free", each with a sample swatch.
- **Note under the calendar:** "Busy days are updated by the shop. Call to confirm your date." The calendar is only as accurate as the admins keep it.
- **Language:** month and weekday names come from the app's translation files (tk, ru, en), not from the browser's `Intl`, because not every phone ships Turkmen locale data.
- **Accessibility:**
  - The calendar is a table with a caption giving the month and year.
  - Each day cell has an accessible name such as "14 November, busy".
  - Nothing is focusable except the two month arrows. Each arrow has a label such as "Previous month".
- **Errors:** if the busy days fail to load, the section shows the standard `ErrorState` ("Something went wrong" / "Try again"). The rest of the dress page keeps working.
- **Visual system:** Gyrmyzy tokens only, with no new colors. The calendar is plain, with no shadow or ornament.

## 4. What the admin does (dress editor)

The admin dress editor (`/admin/dresses/:id`) gets an **Availability** section below Photos.

- **When it appears:** only for a saved dress, the same rule as Photos. On `/admin/dresses/new` the section shows "Save the dress first, then mark busy days."
- **Calendar:** the same calendar and month navigation as the bride's view. Every day from today through the 12-month limit is a **button**:
  - tapping a **free** day marks it **busy**;
  - tapping a **busy** day marks it **free**.
- **Saving:**
  - Each tap saves at once; there is no Save button.
  - The day changes state immediately and looks faint while its request is in flight.
  - Further taps on that same day are ignored until the request finishes.
- **Failure:** the day reverts, and an alert says "Couldn't save 14 November. Try again." The message is translated, using the date the admin tapped.
- **Fixed days:** past days and days beyond the limit are not buttons.
- **Accessibility:**
  - Each day button's name states the current state and the action, for example "14 November, free. Mark as busy".
  - A polite live region announces each successful change: "14 November marked busy" or "14 November marked free".
- **Drafts:** unpublished dresses can have busy days marked.
- **Deletion:** deleting a dress deletes its busy days (database cascade).
- **No bulk selection.**

## 5. Data model

New migration `backend/migrations/00003_busy_days.sql`:

```sql
CREATE TABLE listing_busy_days (
  listing_id bigint NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  day        date   NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_id, day)
);
```

- The table hangs off `listings`, not `dress_details`, so later categories (cars, halls) can reuse it unchanged.
- The primary key stops a day being stored twice and serves the per-listing range query.
- Past rows are kept. They are small and never shown, so there is no cleanup job in v1.

## 6. Time window

The server computes `today` as the calendar date in a fixed UTC+5 zone. The window is:

- `from` = today
- `to` = today + 12 months (Go `AddDate(0, 12, 0)`)

A day is markable and returned only when `from ≤ day ≤ to`.

The server returns `from` and `to` in every response. The frontend uses them for the faded days and the arrow limits, never its own clock, so a phone with a wrong clock still shows the right window.

## 7. API

All responses use the existing error envelope `{"error":{"code","message","fields?"}}`. Days are `YYYY-MM-DD` strings.

| Method and path | Auth | Behaviour |
|---|---|---|
| `GET /api/dresses/:id/busy-days` | public | 200 `{"from":"2026-10-20","to":"2027-10-20","days":["2026-11-14", …]}`. The days fall inside the window and are sorted ascending. 404 `not_found` unless the listing is a dress and both it and its shop are published (v1 visibility rule). |
| `GET /api/admin/dresses/:id/busy-days` | admin JWT | Same body for any existing dress, published or not. 404 if the dress does not exist. |
| `PUT /api/admin/dresses/:id/busy-days/:day` | admin JWT | Marks the day busy. 204. Idempotent (insert … on conflict do nothing). |
| `DELETE /api/admin/dresses/:id/busy-days/:day` | admin JWT | Marks the day free. 204. Idempotent; deleting a free day is not an error. |

Validation for `:day` on PUT and DELETE:

| Condition | Response |
|---|---|
| Not a real `YYYY-MM-DD` date | 400 `validation_failed`, `fields.day = "invalid"` |
| Outside the window | 400 `validation_failed`, `fields.day = "out_of_range"` |
| Unknown dress id, or a listing that is not a dress | 404 `not_found` |

Code placement follows the existing backend layout:

- a new `internal/busydays` package, holding the repository functions (taking `db.DBTX`) and the handlers;
- route registration in `internal/server/server.go`, with the public route on the API group and the admin routes behind the auth middleware.

## 8. Frontend structure

- **`src/lib/calendar.ts`**: pure functions with no Solid or DOM code, tested with Deno.
  - `monthGrid(year, month)` returns the weeks, Monday first, with leading and trailing blanks.
  - Date-key helpers turn a date into `YYYY-MM-DD` and back.
  - `monthsInWindow(from, to)` lists the months the arrows can reach.
  - `isInWindow(day, from, to)` tests a single day.
- **`src/lib/types.ts`**: adds `interface BusyDays { from: string; to: string; days: string[] }`.
- **`src/lib/api.ts`**: adds
  - `busyDays(dressId)`
  - `admin.busyDays(dressId)`
  - `admin.markBusy(dressId, day)`
  - `admin.markFree(dressId, day)`
- **`src/components/MonthCalendar.tsx`**: one component with two modes.
  - **Read-only:** for brides.
  - **Editable:** for admins, with an `onToggle(day)` handler.
  - It takes the busy set, the window and the set of days with requests in flight.
- **`src/components/Availability.tsx`**: the dress-page section. It loads the busy days and renders `MonthCalendar` read-only, with the legend and note.
- **`src/components/admin/AvailabilityEditor.tsx`**: the admin section. It handles optimistic toggling, in-flight state, rollback and live announcements.
- **i18n:** new keys in tk, ru and en. Key parity is already test-enforced.
  - `cal.month.1` … `cal.month.12`
  - `cal.weekday.1` … `cal.weekday.7` (short names, Monday first)
  - `cal.prev`, `cal.next`
  - `avail.title`, `avail.busy`, `avail.free`, `avail.note`
  - `avail.day_busy`, `avail.day_free`, `avail.mark_busy`, `avail.mark_free`
  - `avail.marked_busy`, `avail.marked_free`, `avail.save_failed`, `avail.save_first`
  - `field.out_of_range`

## 9. Testing

- **Go**, against the real test database with the rolled-back-transaction harness:
  - the public visibility rule: unpublished dress → 404, unpublished shop → 404, published → 200;
  - only days inside the window are returned, sorted;
  - PUT and DELETE are idempotent;
  - `:day` validation: malformed, past, beyond the limit, and the exact first and last days of the window;
  - 401 without a token;
  - 404 for an unknown or non-dress listing;
  - deleting a dress removes its busy days.
- **Deno:**
  - `calendar.ts`: grids for months starting on Monday and on Sunday, February in leap and non-leap years, window months across a year boundary, `isInWindow` edges;
  - the new API methods: paths, methods and the 204 handling.
- **Browser** (headless Chrome script):
  - In the admin, mark two days busy and reload; they are still busy. Unmark one.
  - Each day's accessible name matches its state.
  - The dress page shows the same days as busy.
  - The month arrows stop at the window edges.
  - No sideways overflow at 320 px in all three languages.

## 10. Out of scope

- Date ranges, and the notion of a single "rental".
- Notes or customer data on busy days.
- Filtering or searching dresses by date.
- Shop accounts, or shops editing their own calendars.
- Booking requests from brides.
- Selecting several days at once.
- Showing past rentals or history.
