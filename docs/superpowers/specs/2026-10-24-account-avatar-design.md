# Account Avatar in the Top Bar: Design Spec

**Date:** 2026-10-24
**Status:** Approved in brainstorming with a mockup (`.superpowers/brainstorm/22537-1792832213/content/avatar.html`, option A); awaiting the product owner's review of this document
**Builds on:** `2026-10-23-search-listing-myshop-design.md` (My shop as a profile, merged in PR #8).

## 1. Goal

The product owner: "It is too hard to know am I logged in or not." Replace the desktop "Salonyňyzy goşuň" (Add your shop) link with an account avatar, as apps do. When a shop owner is signed in, the avatar shows the salon's logo.

## 2. Decisions

| Topic | Decision |
|---|---|
| Tap behaviour | **Option A: go straight there.** Signed in, the avatar opens `/shop` (Meniň salonym). Signed out, it opens `/shop/login`, which already links to sign-up. There is no menu, and Sign out stays on the My shop pages. |
| Where | The public top bar (`Header`), on phones and computers. The My shop (`ShopLayout`) and admin top bars are unchanged. |
| "Add your shop" | It leaves the top bar. New salons still find it in the desktop footer, on the More page (`/more`), and on the sign-in page ("No account yet?"). |

## 3. Looks

The avatar is a link with a 44px tap area (`btn-icon`), holding a 34px (`h-[34px] w-[34px]`) circle.

| State | Circle |
|---|---|
| **Signed out** (no owner token) | A thin `silver` ring around an outlined person icon (a new `UserIcon`, on the same 24px grid and stroke as the other icons), in `ink`. |
| **Signed in, salon loading or not loadable** | The same person icon, inside a 2px `garnet` ring. |
| **Signed in, salon with a logo** | The logo (`logo.small`) fills the circle (`object-cover`), with a 2px `garnet` ring. |
| **Signed in, salon without a logo** | The salon's first letter, white on `garnet`, the same as `ShopLogo`'s fallback. |

- **Phones** (below 768px): the order is "GELIN", then the search icon, then the avatar.
- **Computers:** the avatar is the last item in the menu, after the language switch, where "Add your shop" was.

## 4. Behaviour

- **Signed-in state:** the avatar reads `shopAuth.token()`, the same reactive token the My shop pages use. When the owner signs out on a My shop page, the avatar turns back to the outlined icon at once.
- **Salon details:** with a token, the avatar fetches the owner's salon (`GET /api/shop/me`) for its name and logo.
  - The request is made each time the public `Header` mounts, so a new logo or name shows as soon as the owner comes back to the public pages from `/shop`.
- **No redirect from public pages:**
  - The normal owner API redirects to `/shop/login` when a session has expired. The avatar's request must not do that.
  - On a 401 it clears the token quietly, and the avatar shows the outlined icon.
  - Any other error leaves the token in place and shows the garnet-ringed person icon.
- **Accessible name:**
  - Signed in: "Meniň salonym: <salon name>" (`myshop.title` + name). Just `myshop.title` while the salon is loading.
  - Signed out: "Sign in" (`admin.sign_in`: "Gir" / "Войти" / "Sign in").
  - The circle's image and letter are `aria-hidden`.
- **Choosing the look:** a small pure helper picks one of `"signed_out" | "loading" | "logo" | "letter"` from (has token, salon or null) and is unit tested.

## 5. Texts

- No new keys.
- `nav.add_shop` is no longer used, so it is removed from all three files.
- The avatar reuses `myshop.title` and `admin.sign_in`.

## 6. Out of scope

- A menu on the avatar (option B).
- An avatar on the My shop or admin top bars.
- Avatars for admins or for brides, who have no accounts.
- Any backend change.

## 7. Testing

- **Unit:** the look helper, covering all four states.
- `deno task test`, `check` and `build` stay clean.
- **Browser** (test database, demo data only):
  - Signed out: the outlined icon on phones and computers; tapping opens `/shop/login`.
  - Signed in with a logo: the logo; tapping opens `/shop`.
  - Signed in without a logo: the letter.
  - After signing out on `/shop`, the public header shows the outlined icon again.
  - An expired or invalid token on a public page: no redirect, and the outlined icon after the 401.
  - No overflow at 320px in tk, ru and en, and the contrast check is clean.
