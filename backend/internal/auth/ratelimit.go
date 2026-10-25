package auth

import (
	"sync"
	"time"
)

// Limiter allows at most max events per key within a sliding window.
type Limiter struct {
	mu     sync.Mutex
	max    int
	window time.Duration
	now    func() time.Time
	hits   map[string][]time.Time
}

func NewLimiter(max int, window time.Duration) *Limiter {
	return &Limiter{max: max, window: window, now: time.Now, hits: map[string][]time.Time{}}
}

// recent drops the key's events older than the window and returns the rest; l.mu must be held.
func (l *Limiter) recent(key string, now time.Time) []time.Time {
	cutoff := now.Add(-l.window)
	kept := l.hits[key][:0]
	for _, h := range l.hits[key] {
		if h.After(cutoff) {
			kept = append(kept, h)
		}
	}
	if len(kept) == 0 {
		delete(l.hits, key)
		return nil
	}
	l.hits[key] = kept
	return kept
}

// Allow records an event for key and reports whether it was within the limit.
func (l *Limiter) Allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	if len(l.recent(key, now)) >= l.max {
		return false
	}
	l.hits[key] = append(l.hits[key], now)
	return true
}

// Full reports whether key has reached its limit, without recording an event. With Add it counts
// only some events, e.g. wrong passwords: check Full first, Add when the event happens.
func (l *Limiter) Full(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	return len(l.recent(key, l.now())) >= l.max
}

// Add records one event for key.
func (l *Limiter) Add(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	l.hits[key] = append(l.recent(key, now), now)
}
