// Package busydays keeps the days a listing is rented, which the dress page shows as a calendar.
package busydays

import "time"

// turkmenistan is UTC+5 all year; the country has no daylight saving time.
var turkmenistan = time.FixedZone("TMT", 5*60*60)

const dayLayout = "2006-01-02"

// Window is the span of days a calendar shows and accepts: today in Turkmenistan
// through the same date 12 months later, both inclusive. Both ends are midnight UTC.
type Window struct {
	From time.Time
	To   time.Time
}

// WindowAt returns the window for the moment now.
func WindowAt(now time.Time) Window {
	y, m, d := now.In(turkmenistan).Date()
	from := time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
	return Window{From: from, To: from.AddDate(0, 12, 0)}
}

// Contains reports whether day (a date from ParseDay) lies inside the window.
func (w Window) Contains(day time.Time) bool {
	return !day.Before(w.From) && !day.After(w.To)
}

// ParseDay parses a real YYYY-MM-DD calendar date and rejects anything else.
func ParseDay(s string) (time.Time, bool) {
	t, err := time.Parse(dayLayout, s)
	if err != nil {
		return time.Time{}, false
	}
	return t, true
}

func formatDay(t time.Time) string { return t.Format(dayLayout) }
