# Search Link, Safer Shop Sign-in and a Dark Splash: Design Spec

**Date:** 2026-10-25
**Status:** Approved by the product owner in chat: "10 tries, common passwords blocked" and "dark charcoal splash"
**Builds on:**
- `2026-10-24-simpler-home-and-shop-design.md`, which removed the top-bar search;
- `2026-10-21-shop-accounts-design.md`, which covers shop sign-in;
- the 6-character owner password change (PR #8).

## 1. Goal

There are three follow-ups from the last reviews:

1. On computers, search is now only in the home page box, so add a **Search** link to the computer top menu.
2. Make shop sign-in safer.
   - Today the only limit is 5 tries a minute per device (IP), and the sign-in phone number is public.
   - A 6-character password like "123456" is allowed.
3. When the installed app opens, its splash screen is white, even on dark phones.

## 2. Search link (computers)

- The desktop menu in `Header` gets a first link, **Gözleg** (`search.title`). It goes to `/search` and is highlighted there (`activeClass="text-garnet"`), like the other menu links.
- Phones are unchanged, because the bottom bar's Has köp already has Search.

## 3. Safer shop sign-in (backend)

### 3.1 A limit per phone number

- **The limit:** on top of today's per-IP limit (5 per minute), `/api/shop/login` counts **wrong passwords per phone number**. After **10 wrong passwords for one number within 15 minutes**, sign-in for that number is refused until the oldest of those 10 is more than 15 minutes old.
- **Which numbers count:**
  - The key is the normalized phone, the same one used to look up the owner.
  - Unknown numbers count too, so the reply never reveals whether an account exists.
  - An input that doesn't normalize can't match any account and isn't counted (counting it by its raw text would let junk input fill memory).
- **The error:** a refused sign-in gets **HTTP 429** with a new error code, **`too_many_attempts`** ("too many wrong passwords for this number, try again in 15 minutes"). Each try is counted and checked in one step **before** the password is checked, so a locked number can't be probed and parallel tries can't slip past; a right password (or a server error) takes its try back.
- **What counts:** a correct password doesn't add to the count, and it doesn't clear it. An admin setting a new password (the "call us" flow for a forgotten password) clears the number's count, so the owner can sign in with it straight away.
- **Accepted trade-off:** anyone who knows a number (numbers are public) can keep it locked by making about 10 wrong tries every 15 minutes. No account is taken over; the owner stays signed in on their devices, and the admin can clear the lock by setting a new password. Keying the lock by phone and IP together would bring back many-device guessing, which this limit exists to stop.
- **Where it lives:** the count is kept in memory, the same way as the existing limiter. A server restart clears it, which is acceptable.
- **Implementation:**
  - `auth.Limiter` gets `Undo(key)`, which takes back the key's latest event. Sign-in uses the existing `Allow` to count a try and `Undo` when it was right.
  - `Undo` is unit tested, and `Allow` keeps working.
  - `owners.Handler` gets a `PhoneLimiter`. `server.go` creates it as `auth.NewLimiter(10, 15*time.Minute)` when it is nil.

### 3.2 No very common passwords

- **Where it applies:** new passwords, at **sign-up** and when an **admin sets an owner's password**. Existing passwords keep working.
- **The rule:** after the length checks, the password is rejected with the field code **`too_common`** when any of these is true:
  - its lowercase form is on a short built-in list. The list includes:
    - number runs: `123456`, `1234567`, `12345678`, `123456789`, `1234567890`, `654321`, `123123`, `112233`, `121212`, `1q2w3e` and `1q2w3e4r`;
    - keyboard rows: `qwerty`, `qwerty1`, `qwerty123`, `qwertyu`, `asdfgh`, `zxcvbn` and `йцукен`;
    - words: `password`, `password1`, `parol`, `parol123`, `пароль`, `abc123`, `abcdef`, `iloveyou`, `gelin`, `gelin123`, `salon`, `salon123`, `toy123` and `turkmenistan`;
  - every character is the same, for example `111111` or `aaaaaa`;
  - it is an ascending or descending run of digits, for example `234567` or `987654`;
  - **at sign-up only:** it is made only of digits (and `+ - ( )` or spaces), and its digits are the phone number's: the full normalized number, its last 8 digits, or those with a leading 8.
- **The code:** a pure function, `owners.commonPassword(password, phone string) bool`, with table tests. The admin path calls it with an empty phone.

### 3.3 Texts

| Key | tk | ru | en |
|---|---|---|---|
| `error.too_many_attempts` | Bu belgi üçin nädogry açar söz gaty köp girizildi. 15 minutdan gaýtadan synanyşyň. | Слишком много неверных паролей для этого номера. Попробуйте через 15 минут. | Too many wrong passwords for this number. Try again in 15 minutes. |
| `field.too_common` | Bu açar söz gaty ýönekeý. Başgasyny saýlaň. | Слишком простой пароль. Выберите другой. | This password is too common. Choose another one. |

- The i18n test's lists of API error codes and field values each gain the new code.

## 4. Dark splash

- `public/manifest.json`: `background_color` goes from `#ffffff` to **`#121214`**, the dark page color. A manifest has one splash color and can't follow the light or dark setting.
- `theme_color` stays `#8e1b2e`, and the icons are unchanged.

## 5. Out of scope

- A per-phone limit for the admin sign-in. Admins sign in by email, and the email is not public.
- Persisting the counts across restarts.
- A full password-breach list.

## 6. Testing

- **Go:**
  - `Limiter.Undo` and `Limiter.Reset` (and that `Allow` keeps working).
  - `commonPassword`: list entries, mixed case, same characters, digit runs both ways, the phone digits, and passwords that must pass.
  - Owners login:
    - the 11th try after 10 wrong passwords for one number gets 429 `too_many_attempts`, even with the right password;
    - another number is unaffected;
    - a correct password does not count.
  - Sign-up and admin set-password reject a common password with `too_common`.
  - The full suite stays green.
- **Frontend:** `deno task test`, including i18n parity and the code lists, `check` and `build`.
- **Browser** (test database):
  - The computer header shows Gözleg, which opens `/search` and is highlighted there.
  - Signing up with `123456` shows the too-common message.
  - Eleven wrong sign-ins for one number show the 15-minute message.
  - The manifest serves `background_color: #121214`.
