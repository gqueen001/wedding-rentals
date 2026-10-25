# Search Link, Safer Shop Sign-in and a Dark Splash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Shop sign-in stops after 10 wrong passwords for one phone number in 15 minutes.
- New shop passwords can't be very common ones.
- The computer top menu gets a Search link.
- The installed app's splash screen becomes dark charcoal.

**Architecture:**
- **Limiter:** `auth.Limiter` gains `Undo`, which takes back the latest event. Sign-in counts each try for the phone with `Allow` before the password check, so parallel tries can't slip past, and `Undo`es it when the password is right or the server fails. Input that isn't a phone number isn't counted. A pure `owners.commonPassword` runs after the length checks at sign-up and admin set-password.
- **Frontend:** a new link in `Header`, two texts, and the manifest's `background_color`.

**Tech Stack:** Go 1.27, Gin and PostgreSQL 17 (backend); Solid 1.9 and Tailwind 4 with Deno 2.4 (frontend).

**Spec:** `docs/superpowers/specs/2026-10-25-search-link-safer-signin-splash-design.md`

## Global Constraints

- **The phone limit:**
  - 10 wrong passwords per normalized phone number in 15 minutes (`auth.NewLimiter(10, 15*time.Minute)`).
  - It applies on top of the existing per-IP limiter.
  - Unknown numbers count too, and a correct password neither counts nor clears the count.
  - Input that isn't a phone number can't match an account and isn't counted.
  - The try is counted and checked in one step (`Allow`) **before** the password, and taken back with `Undo` when the password is right.
- **The lock error:** HTTP 429, code `too_many_attempts`.
- **Common passwords:** field code `too_common`, for new passwords only (sign-up and admin set-password). The phone-digits rule runs at sign-up only.
- **Unchanged:**
  - the admin sign-in and the existing per-IP limits;
  - existing passwords;
  - phones' top bar;
  - the manifest's `theme_color` and icons.
- **Splash:** `background_color` is `#121214`.
- **Text:** every user-visible string goes through `frontend/src/i18n/{tk,ru,en}.json`, with identical keys and placeholders, which a test enforces. New API codes go into that test's code lists.
- **Tools:**
  - **Go:** from `backend/`, with `set -a; . ./.env; set +a` and `GOPROXY=off`. Never run `go env -w`.
  - **Frontend:** only `deno task test`, `deno task check` and `deno task build`, from `frontend/`.
- **Data:** never write to the `wedding_dev` database. Go tests use `wedding_test`.
- **Commits:** every commit message ends with the `Co-Authored-By:` trailer line the controller gives you.

## How to read the steps

- **Full files:** a path in backticks on its own line, directly followed by a code block, gives the **whole file**. Create or overwrite it with exactly that content. From the repository root you can extract it with:
  `python3 -I .superpowers/sdd/ss/block.py <brief> <path> > <path>`
- **Replacements:** "In `path`, replace:" gives an exact text to find (it occurs once) and the text to put in its place. Apply a file's replacements in the order given. Go code uses tabs.
- **i18n entries:** under **en.json**, **ru.json** and **tk.json**, a block of `"key": "value"` lines goes at the end of that file. Add a comma to the file's current last entry, and keep the closing `}` last.

---

### Task 1: Safer shop sign-in (backend)

**Files:**
- Create:
  - `backend/internal/owners/common.go`
  - `backend/internal/owners/common_test.go`
- Modify:
  - `backend/internal/auth/ratelimit.go` (full file)
  - `backend/internal/auth/ratelimit_test.go`
  - `backend/internal/owners/handler.go`
  - `backend/internal/owners/owners_test.go`
  - `backend/internal/server/server.go`

**Interfaces:**
- Produces:
  - `(*auth.Limiter).Undo(key string)`;
  - the `owners.Handler.PhoneLimiter *auth.Limiter` field;
  - the `server.Deps.ShopPhoneLimiter` field, which defaults to `auth.NewLimiter(10, 15*time.Minute)` when nil;
  - the error code `too_many_attempts` (429);
  - the field code `too_common`.

- [ ] **Step 1: The limiter can take back an event**

`backend/internal/auth/ratelimit.go`
```go
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

// Undo takes back key's most recent event, e.g. a sign-in try that turned out to be right. With
// Allow it counts only some events, with no gap between checking and counting for parallel tries.
func (l *Limiter) Undo(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	switch h := l.hits[key]; len(h) {
	case 0:
	case 1:
		delete(l.hits, key)
	default:
		l.hits[key] = h[:len(h)-1]
	}
}
```

In `backend/internal/auth/ratelimit_test.go`, replace:
```go
	}
}

```
with:
```go
	}
}

func TestLimiterUndoTakesBackTheLatestEvent(t *testing.T) {
	now := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	l := NewLimiter(3, 15*time.Minute)
	l.now = func() time.Time { return now }
	for i := 0; i < 3; i++ {
		if !l.Allow("+99365000001") {
			t.Fatalf("try %d blocked", i+1)
		}
	}
	if l.Allow("+99365000001") {
		t.Fatal("4th try allowed")
	}
	l.Undo("+99365000001")
	if !l.Allow("+99365000001") {
		t.Fatal("not allowed after Undo")
	}
	// Undo on a key with no events does nothing, and keys are separate.
	l.Undo("+99365000002")
	for i := 0; i < 3; i++ {
		if !l.Allow("+99365000002") {
			t.Fatalf("other key: try %d blocked", i+1)
		}
	}
	now = now.Add(15*time.Minute + time.Second)
	if !l.Allow("+99365000001") {
		t.Fatal("still blocked after the window passed")
	}
}

```

Run, from `backend/`: `set -a; . ./.env; set +a; GOPROXY=off go test -count=1 ./internal/auth/`
Expected: `ok`, including `TestLimiterUndoTakesBackTheLatestEvent` and the existing `TestLimiterAllowsMaxPerWindow`.

- [ ] **Step 2: Write the failing common-password test**

`backend/internal/owners/common_test.go`
```go
package owners

import "testing"

func TestCommonPassword(t *testing.T) {
	for _, tc := range []struct {
		password, phone string
		want            bool
	}{
		{"123456", "", true},
		{"QWERTY", "", true},      // case does not matter
		{"  Gelin123 ", "", true}, // nor surrounding spaces
		{"пароль", "", true},
		{"111111", "", true}, // one repeated character
		{"aaaaaaa", "", true},
		{"234567", "", true},                  // digits going up
		{"987654", "", true},                  // digits going down
		{"65123456", "+99365123456", true},    // the phone's last 8 digits
		{"99365123456", "+99365123456", true}, // the whole phone number
		{"+99365123456", "+99365123456", true},
		{"65 12 34 56", "+99365123456", true}, // however it is spaced
		{"+993 65 12-34-56", "+99365123456", true},
		{"865123456", "+99365123456", true},   // the 8-prefixed local form
		{"65123456ab", "+99365123456", false}, // letters make it a different password
		{"65123456", "", false},               // fine when no phone is given (admin path)
		{"ak-gelin-24", "", false},
		{"abcdeg", "", false},
		{"135790", "", false},
		{"ab3d5ü", "+99365111112", false},
		{"bezeg7", "+99365123456", false},
	} {
		if got := commonPassword(tc.password, tc.phone); got != tc.want {
			t.Errorf("commonPassword(%q, %q) = %v, want %v", tc.password, tc.phone, got, tc.want)
		}
	}
}
```

Run, from `backend/`: `GOPROXY=off go test -count=1 -run TestCommonPassword ./internal/owners/`
Expected: FAIL to build, with `undefined: commonPassword`.

- [ ] **Step 3: The common-password check**

`backend/internal/owners/common.go`
```go
package owners

import (
	"strings"
	"unicode"
)

// commonList holds passwords guessed first, whatever the rules below already cover.
var commonList = map[string]bool{}

func init() {
	for _, p := range strings.Fields(`
		123456 1234567 12345678 123456789 1234567890 654321 123123 112233 121212 1q2w3e 1q2w3e4r
		qwerty qwerty1 qwerty123 qwertyu asdfgh zxcvbn йцукен
		password password1 parol parol123 пароль abc123 abcdef iloveyou
		gelin gelin123 salon salon123 toy123 turkmenistan`) {
		commonList[p] = true
	}
}

// commonPassword reports whether a new password is too easy to guess: on the list, one repeated
// character, a run of digits (up or down), or, when phone is given, the phone number itself (its
// digits, however they are spaced, in full, local or 8-prefixed form).
func commonPassword(password, phone string) bool {
	p := strings.ToLower(strings.TrimSpace(password))
	if commonList[p] {
		return true
	}
	r := []rune(p)
	same, up, down := true, true, true
	for i := 1; i < len(r); i++ {
		same = same && r[i] == r[0]
		up = up && unicode.IsDigit(r[i]) && r[i] == r[i-1]+1
		down = down && unicode.IsDigit(r[i]) && r[i] == r[i-1]-1
	}
	if len(r) > 1 && (same || (unicode.IsDigit(r[0]) && (up || down))) {
		return true
	}
	if digits := onlyDigits(phone); digits != "" && strings.Trim(p, "0123456789+-() ") == "" {
		local := digits
		if len(local) > 8 {
			local = local[len(local)-8:]
		}
		if pd := onlyDigits(p); pd == digits || pd == local || pd == "8"+local {
			return true
		}
	}
	return false
}

func onlyDigits(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}
```

Run, from `backend/`: `GOPROXY=off go test -count=1 -run TestCommonPassword ./internal/owners/`
Expected: `ok`.

- [ ] **Step 4: Write the failing sign-in tests**

Both test setups get a `PhoneLimiter`. The new tests cover:
- the lock after 10 wrong passwords;
- the correct password not counting;
- an unknown number locking the same way, and non-phone input never locking;
- common passwords at sign-up and at admin set-password.

In `backend/internal/owners/owners_test.go`, replace:
```go
	"net/http"
	"strconv"
```
with:
```go
	"net/http"
	"net/http/httptest"
	"strconv"
```

In `backend/internal/owners/owners_test.go`, replace:
```go
	h := &owners.Handler{DB: e.tx, Tokens: tokens, Limiter: auth.NewLimiter(100, time.Minute)}
```
with:
```go
	h := &owners.Handler{DB: e.tx, Tokens: tokens, Limiter: auth.NewLimiter(100, time.Minute), PhoneLimiter: auth.NewLimiter(10, 15*time.Minute)}
```

In `backend/internal/owners/owners_test.go`, replace:
```go
	h := &owners.Handler{DB: e.tx, Tokens: tokens, Limiter: auth.NewLimiter(5, time.Minute)}
```
with:
```go
	h := &owners.Handler{DB: e.tx, Tokens: tokens, Limiter: auth.NewLimiter(5, time.Minute), PhoneLimiter: auth.NewLimiter(10, 15*time.Minute)}
```

In `backend/internal/owners/owners_test.go`, replace:
```go
		t.Fatalf("6th attempt: status = %d", rec.Code)
	}
```
with:
```go
		t.Fatalf("6th attempt: status = %d", rec.Code)
	}
	if code := testutil.Decode[testutil.ErrorBody](t, rec).Error.Code; code != "rate_limited" {
		t.Fatalf("6th attempt: code = %q, want rate_limited (the per-IP limit)", code)
	}
```

In `backend/internal/owners/owners_test.go`, replace:
```go
		t.Fatalf("token after shop deletion: status = %d, want 401", rec.Code)
	}
}

```
with:
```go
		t.Fatalf("token after shop deletion: status = %d, want 401", rec.Code)
	}
}

func TestLoginStopsAfterTenWrongPasswordsForOneNumber(t *testing.T) {
	e := setup(t)
	signup(t, e, "+99365123456")
	login := func(phone, password string) *httptest.ResponseRecorder {
		return testutil.Request(t, e.r, http.MethodPost, "/api/shop/login", map[string]any{"phone": phone, "password": password}, "")
	}
	// A correct password does not count towards the limit.
	if rec := login("65123456", "long-enough-1"); rec.Code != http.StatusOK {
		t.Fatalf("right password: status = %d", rec.Code)
	}
	for i := 0; i < 10; i++ {
		if rec := login("+993 65 12-34-56", "wrong-pass"); rec.Code != http.StatusUnauthorized {
			t.Fatalf("wrong password %d: status = %d", i+1, rec.Code)
		}
	}
	// Locked for this number (however it is typed), even with the right password.
	rec := login("65123456", "long-enough-1")
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("after 10 wrong: status = %d, want 429", rec.Code)
	}
	if code := testutil.Decode[testutil.ErrorBody](t, rec).Error.Code; code != "too_many_attempts" {
		t.Fatalf("code = %q, want too_many_attempts", code)
	}
	// Another number is not affected. An unknown number locks the same way, so the answer never tells
	// whether an account exists.
	for i := 0; i < 10; i++ {
		if rec := login("65999999", "whatever-1"); rec.Code != http.StatusUnauthorized {
			t.Fatalf("unknown number, try %d: status = %d, want 401", i+1, rec.Code)
		}
	}
	rec = login("65999999", "whatever-1")
	if rec.Code != http.StatusTooManyRequests || testutil.Decode[testutil.ErrorBody](t, rec).Error.Code != "too_many_attempts" {
		t.Fatalf("unknown number after 10: status = %d: %s", rec.Code, rec.Body)
	}
	// Input that is not a phone number can't match an account and isn't counted.
	for i := 0; i < 12; i++ {
		if rec := login("not a phone", "whatever-1"); rec.Code != http.StatusUnauthorized {
			t.Fatalf("not a phone, try %d: status = %d, want 401", i+1, rec.Code)
		}
	}
}

func TestCommonPasswordsAreRefused(t *testing.T) {
	e := setup(t)
	for _, pw := range []string{"123456", "qwerty", "111111", "65111222"} {
		body := signupBody(t, e.tx, "+99365111222")
		body["password"] = pw
		got := testutil.Decode[testutil.ErrorBody](t, testutil.Request(t, e.r, http.MethodPost, "/api/shop/signup", body, ""))
		if got.Error.Fields["password"] != "too_common" {
			t.Errorf("signup with %q: fields = %v, want password too_common", pw, got.Error.Fields)
		}
	}
	token := signup(t, e, "+99365123457")
	path := "/api/admin/shops/" + strconv.FormatInt(me(t, e, token).Shop.ID, 10) + "/owner-password"
	rec := testutil.Request(t, e.r, http.MethodPost, path, map[string]any{"password": "password"}, "")
	if rec.Code != http.StatusBadRequest || testutil.Decode[testutil.ErrorBody](t, rec).Error.Fields["password"] != "too_common" {
		t.Fatalf("admin set common password: status = %d: %s", rec.Code, rec.Body)
	}
}

```

Run, from `backend/`: `set -a; . ./.env; set +a; GOPROXY=off go test -count=1 ./internal/owners/`
Expected: FAIL to build, with `unknown field PhoneLimiter`.

- [ ] **Step 5: Sign-in, sign-up and set-password use them**

In `backend/internal/owners/handler.go`, replace:
```go
	errRateLimited        = httpx.New(http.StatusTooManyRequests, "rate_limited", "too many attempts, try again in a minute")
)
```
with:
```go
	errRateLimited        = httpx.New(http.StatusTooManyRequests, "rate_limited", "too many attempts, try again in a minute")
	// The 15 minutes is server.go's default PhoneLimiter window.
	errTooManyAttempts = httpx.New(http.StatusTooManyRequests, "too_many_attempts", "too many wrong passwords for this number, try again in 15 minutes")
)
```

In `backend/internal/owners/handler.go`, replace:
```go
	Limiter *auth.Limiter
}
```
with:
```go
	Limiter *auth.Limiter
	// PhoneLimiter counts wrong passwords per phone number (the number is public, so a per-IP
	// limit alone lets many devices try one account).
	PhoneLimiter *auth.Limiter
}
```

In `backend/internal/owners/handler.go`, replace:
```go
		errs["password"] = "too_long"
	}
```
with:
```go
		errs["password"] = "too_long"
	} else if commonPassword(in.Password, phoneIf(phoneOK, phone)) {
		errs["password"] = "too_common"
	}
```

In `backend/internal/owners/handler.go`, replace:
```go
	phone, _ := NormalizePhone(in.Phone)
```
with:
```go
	phone, ok := NormalizePhone(in.Phone)
	// Each try is counted before the password is checked and taken back when it is right, so parallel
	// tries can't slip past the limit. Unknown numbers count too, so the answer never tells whether an
	// account exists; input that is not a phone number can't match an account and isn't counted.
	if ok && !h.PhoneLimiter.Allow(phone) {
		httpx.Abort(c, errTooManyAttempts)
		return
	}
```

In `backend/internal/owners/handler.go`, replace:
```go
		httpx.Abort(c, errInvalidCredentials)
		return
	}
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	if !auth.CheckPassword(o.PasswordHash, in.Password) {
```
with:
```go
		httpx.Abort(c, errInvalidCredentials)
		return
	}
	if err != nil {
		h.PhoneLimiter.Undo(phone) // a server error is not a wrong password
		httpx.Abort(c, err)
		return
	}
	if !auth.CheckPassword(o.PasswordHash, in.Password) {
```

In `backend/internal/owners/handler.go`, replace:
```go
	}
	h.respondWithToken(c, http.StatusOK, o)
```
with:
```go
	}
	h.PhoneLimiter.Undo(phone)
	h.respondWithToken(c, http.StatusOK, o)
```

In `backend/internal/owners/handler.go`, replace:
```go
		httpx.Abort(c, httpx.Validation(map[string]string{"password": "too_long"}))
		return
	}
	hash, err := auth.HashPassword(in.Password)
	if err != nil {
		httpx.Abort(c, err)
```
with:
```go
		httpx.Abort(c, httpx.Validation(map[string]string{"password": "too_long"}))
		return
	}
	if commonPassword(in.Password, "") {
		httpx.Abort(c, httpx.Validation(map[string]string{"password": "too_common"}))
		return
	}
	hash, err := auth.HashPassword(in.Password)
	if err != nil {
		httpx.Abort(c, err)
```

In `backend/internal/owners/handler.go`, replace:
```go
	c.Status(http.StatusNoContent)
}

```
with:
```go
	c.Status(http.StatusNoContent)
}

// phoneIf is phone when ok, else "": a password only matches the number when the number is valid.
func phoneIf(ok bool, phone string) string {
	if ok {
		return phone
	}
	return ""
}

```

In `backend/internal/server/server.go`, replace:
```go
	ShopLimiter *auth.Limiter
	// UploadLimiter caps a shop owner's image uploads; nil gets 30 per minute per owner.
```
with:
```go
	ShopLimiter *auth.Limiter
	// ShopPhoneLimiter counts wrong shop passwords per phone number; nil gets 10 per 15 minutes.
	ShopPhoneLimiter *auth.Limiter
	// UploadLimiter caps a shop owner's image uploads; nil gets 30 per minute per owner.
```

In `backend/internal/server/server.go`, replace:
```go
	if d.UploadLimiter == nil {
		d.UploadLimiter = auth.NewLimiter(30, time.Minute)
	}
	ownersH := &owners.Handler{DB: d.DB, Tokens: d.Tokens, Limiter: d.ShopLimiter}
```
with:
```go
	if d.ShopPhoneLimiter == nil {
		d.ShopPhoneLimiter = auth.NewLimiter(10, 15*time.Minute)
	}
	if d.UploadLimiter == nil {
		d.UploadLimiter = auth.NewLimiter(30, time.Minute)
	}
	ownersH := &owners.Handler{DB: d.DB, Tokens: d.Tokens, Limiter: d.ShopLimiter, PhoneLimiter: d.ShopPhoneLimiter}
```

- [ ] **Step 6: Run everything**

Run, from `backend/`: `set -a; . ./.env; set +a; GOPROXY=off go test -p 1 -count=1 ./...`, then `GOPROXY=off go vet ./...`, then `gofmt -l .`.
Expected: every package `ok`, vet silent, and gofmt printing nothing.

- [ ] **Step 7: Commit**

```bash
git add backend/internal/auth/ratelimit.go backend/internal/auth/ratelimit_test.go backend/internal/owners/common.go backend/internal/owners/common_test.go backend/internal/owners/handler.go backend/internal/owners/owners_test.go backend/internal/server/server.go
git commit -m "feat(backend): shop sign-in stops after 10 wrong passwords per number; common passwords refused"
```
(End the message with the trailer line the controller gives you.)

---

### Task 2: The Search link, the new texts and the dark splash (frontend)

**Files:**
- Modify:
  - `frontend/src/components/Header.tsx`
  - `frontend/src/i18n/i18n_test.ts`
  - `frontend/src/i18n/{en,ru,tk}.json`
  - `frontend/public/manifest.json`

**Interfaces:**
- Consumes: the API codes `too_many_attempts` and `too_common` from Task 1. `lib/errors.ts` already looks up `error.<code>` and `field.<code>`.

- [ ] **Step 1: The test knows the new codes**

In `frontend/src/i18n/i18n_test.ts`, replace:
```ts
  "body_too_large", "internal_error", "invalid_credentials", "unauthorized", "rate_limited",
```
with:
```ts
  "body_too_large", "internal_error", "invalid_credentials", "unauthorized", "rate_limited", "too_many_attempts",
```

In `frontend/src/i18n/i18n_test.ts`, replace:
```ts
  "too_short", "unknown",
```
with:
```ts
  "too_short", "too_common", "unknown",
```

Run, from `frontend/`: `deno task test`
Expected: FAIL. The i18n test reports missing keys for `error.too_many_attempts` and `field.too_common`.

- [ ] **Step 2: Add the texts**

**en.json**
```json
  "error.too_many_attempts": "Too many wrong passwords for this number. Try again in 15 minutes.",
  "field.too_common": "This password is too common. Choose another one."
```

**ru.json**
```json
  "error.too_many_attempts": "Слишком много неверных паролей для этого номера. Попробуйте через 15 минут.",
  "field.too_common": "Слишком простой пароль. Выберите другой."
```

**tk.json**
```json
  "error.too_many_attempts": "Bu belgi üçin nädogry açar sözi gaty köp. 15 minutdan gaýtadan synanyşyň.",
  "field.too_common": "Bu açar söz gaty ýönekeý. Başgasyny saýlaň."
```

Run, from `frontend/`: `deno task test`
Expected: PASS.

- [ ] **Step 3: The Search link in the computer menu**

In `frontend/src/components/Header.tsx`, replace:
```tsx
/** Phones: the logo and the account avatar (the bottom bar does the rest). Desktop: the logo, a menu and the avatar. */
```
with:
```tsx
/** Phones: the logo and the account avatar (the bottom bar does the rest). Desktop: the logo, a menu (search first) and the avatar. */
```

In `frontend/src/components/Header.tsx`, replace:
```tsx
        <nav class="hidden items-center md:flex" aria-label={t("tab.menu")}>
          <A href="/categories" class={MENU_LINK} activeClass="text-garnet">{t("tab.categories")}</A>
```
with:
```tsx
        <nav class="hidden items-center md:flex" aria-label={t("tab.menu")}>
          <A href="/search" class={MENU_LINK} activeClass="text-garnet">{t("search.title")}</A>
          <A href="/categories" class={MENU_LINK} activeClass="text-garnet">{t("tab.categories")}</A>
```

- [ ] **Step 4: The dark splash**

In `frontend/public/manifest.json`, replace:
```json
  "background_color": "#ffffff",
```
with:
```json
  "background_color": "#121214",
```

- [ ] **Step 5: Check, test and build**

Run, from `frontend/`: `deno task check`, then `deno task test`, then `deno task build`.
Expected: no check errors, every test passes, and the build ends with `✓ built`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Header.tsx frontend/src/i18n/i18n_test.ts frontend/src/i18n/en.json frontend/src/i18n/ru.json frontend/src/i18n/tk.json frontend/public/manifest.json
git commit -m "feat(frontend): a Search link in the computer menu, sign-in messages, and a dark splash"
```
(End the message with the trailer line the controller gives you.)

---

## Final verification (controller)

This runs in headless Chrome, on the test database.

- **Header:** the computer header shows Gözleg, which opens `/search` and is highlighted there. The header has no overflow at 768, 1024 and 1280px in tk, ru and en.
- **Sign-up:** a sign-up with `123456` shows the too-common message.
- **The lock:** 10 wrong passwords for one number, paced under the per-IP limit, are followed by the sign-in page showing the 15-minute message.
- **The manifest** serves `"background_color": "#121214"`.

## Changes made during review

- **Task 1:** the review found two problems in the first version.
  - **Memory.** Non-phone input was counted under its raw text, up to 1 MiB, and never pruned.
  - **Parallel tries.** A separate check (`Full`) and count (`Add`), with bcrypt in between, let parallel tries from many devices get well past 10.
  - **The fix:** non-phone input isn't counted; each try is counted with `Allow` and taken back with `Undo` on success.
  - **Also:** the phone-number rule now compares the password's digits however they are spaced, and the tests cover unknown numbers, non-phone input and the per-IP `rate_limited` code.

