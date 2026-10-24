# Account Avatar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the desktop "Add your shop" link with an account avatar in the public top bar, on phones and computers. A signed-in shop owner sees their salon's logo (or first letter) and taps through to My shop. Everyone else sees a person icon and taps through to sign in.

**Architecture:**
- A pure `avatarLook()` in `lib/avatar.ts` picks one of four looks. A quiet owner API client, `ownerProbeApi` in `lib/client.ts`, loads the salon without redirecting on an expired session. On a 401 it only clears the token.
- An `AccountAvatar` component reads `shopAuth.token()` and loads the salon each time it mounts. It sits at the end of `Header`.

**Tech Stack:** Solid 1.9, @solidjs/router, Tailwind 4, built and tested with Deno 2.4. There are no backend changes.

**Spec:** `docs/superpowers/specs/2026-10-24-account-avatar-design.md`

## Global Constraints

- **Unchanged:**
  - No new routes and no API changes.
  - The My shop (`ShopLayout`) and admin top bars do not change.
  - "Add your shop" stays in the desktop footer, on `/more` and on the sign-in page.
- **No redirect from public pages:** the avatar's request must never send the visitor to `/shop/login`. On a 401 it clears the token quietly.
- **Looks** (only existing tokens):
  - signed out: a 1px `silver` ring with the person icon in `ink`;
  - signed in while loading, or when the salon can't be loaded: a 2px `garnet` ring with the person icon;
  - logo: `logo.small` with `object-cover` inside the 2px `garnet` ring;
  - no logo: the first letter, white on `garnet`, in `font-label` (the display font is used only at 30px and up).
  - The circle is 34px, inside a 44px `btn-icon` link.
- **Accessibility:**
  - The link's name is "<myshop.title>: <salon name>" when signed in (just `myshop.title` while loading), or `admin.sign_in` when signed out.
  - The circle's contents are `aria-hidden`.
  - No sideways scrolling at 320px in tk, ru and en, and text contrast of at least 4.5 : 1.
- **Text:** no new keys. `nav.add_shop` is removed from `frontend/src/i18n/{tk,ru,en}.json`, and the keys stay identical across the three files (a test enforces this).
- **Tools:** frontend tools run only through Deno, from `frontend/`: `deno task test`, `deno task check` and `deno task build`. Never run npm or Vite with Node.
- **Data:** never write to the `wedding_dev` database.
- **Commits:** every commit message ends with the `Co-Authored-By:` trailer line the controller gives you.

## File Map

```
frontend/src/lib/avatar.ts, avatar_test.ts      new: avatarLook(signedIn, shop) → "signed_out" | "loading" | "logo" | "letter"
frontend/src/lib/client.ts                      + ownerProbeApi (no redirect on 401)
frontend/src/components/icons.tsx               + UserIcon
frontend/src/components/AccountAvatar.tsx       new: the avatar link
frontend/src/components/Header.tsx              the avatar replaces "Add your shop"
frontend/src/i18n/{tk,ru,en}.json               − nav.add_shop
```

## How to read the steps

- **Full files:** a path in backticks on its own line, directly followed by a code block, gives the **whole file**. Create or overwrite it with exactly that content. From the repository root you can extract it with:
  `python3 -I .superpowers/sdd/av/block.py <brief> <path> > <path>`
- **Replacements:** "In `path`, replace:" gives an exact text to find (it occurs once) and the text to put in its place.
- **Appends:** "Append to `path`:" gives text to add at the very end of the file.

---

### Task 1: The avatar's building blocks: look helper, quiet owner client and person icon

This task adds no visible change. It provides the pure function that picks the avatar's look (with its test), a second owner API client that does not redirect on an expired session, and the person icon.

**Files:**
- Create:
  - `frontend/src/lib/avatar.ts`
  - `frontend/src/lib/avatar_test.ts`
- Modify:
  - `frontend/src/lib/client.ts`
  - `frontend/src/components/icons.tsx`

**Interfaces:**
- Produces:
  - `type AvatarLook = "signed_out" | "loading" | "logo" | "letter"`.
  - `avatarLook(signedIn: boolean, shop: { logo: unknown | null } | null): AvatarLook`.
  - `ownerProbeApi`, the same shape as `ownerApi`. Its `onUnauthorized` only calls `shopAuth.clear()`.
  - `UserIcon` (props `{ class?: string }`).

- [ ] **Step 1: Write the failing test**

`frontend/src/lib/avatar_test.ts`
```ts
import { assertEquals } from "@std/assert";
import { avatarLook } from "./avatar.ts";

Deno.test("avatarLook: signed out, loading, logo and letter", () => {
  const logo = { id: 1, position: 0, small: "/uploads/a_s.jpg", large: "/uploads/a_l.jpg", width: 10, height: 10 };
  assertEquals(avatarLook(false, null), "signed_out");
  // A salon left over from an earlier sign-in does not count once the token is gone.
  assertEquals(avatarLook(false, { logo }), "signed_out");
  assertEquals(avatarLook(true, null), "loading");
  assertEquals(avatarLook(true, { logo }), "logo");
  assertEquals(avatarLook(true, { logo: null }), "letter");
});
```

Run, from `frontend/`: `deno task test`
Expected: FAIL. `avatar_test.ts` cannot load `./avatar.ts`.

- [ ] **Step 2: Write the look helper**

`frontend/src/lib/avatar.ts`
```ts
/** How the account avatar in the top bar looks. */
export type AvatarLook = "signed_out" | "loading" | "logo" | "letter";

/**
 * signedIn: an owner token is stored. shop: the owner's salon once loaded, or null while it loads
 * or when it could not be loaded (then the avatar still shows that someone is signed in).
 */
export function avatarLook(signedIn: boolean, shop: { logo: unknown | null } | null): AvatarLook {
  if (!signedIn) return "signed_out";
  if (!shop) return "loading";
  return shop.logo ? "logo" : "letter";
}
```

Run, from `frontend/`: `deno task test`
Expected: PASS, including "avatarLook: signed out, loading, logo and letter".

- [ ] **Step 3: Add the quiet owner client**

In `frontend/src/lib/client.ts`, replace:
```ts
export const uploadOwnerImage = createUploader({
```
with:
```ts
/** The owner's own calls from public pages, e.g. the top-bar avatar: an expired session is dropped without a redirect. */
export const ownerProbeApi = createApi({ fetch: fetchFn, token: shopAuth.token, onUnauthorized: () => shopAuth.clear() });
export const uploadOwnerImage = createUploader({
```

- [ ] **Step 4: Add the person icon**

Append to `frontend/src/components/icons.tsx`:
```tsx

export const UserIcon = (p: IconProps) => (
  <Svg class={p.class}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </Svg>
);
```

- [ ] **Step 5: Check, test and build**

Run, from `frontend/`: `deno task check`, then `deno task test`, then `deno task build`.
Expected: no check errors, every test passes, and the build ends with `✓ built`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/avatar.ts frontend/src/lib/avatar_test.ts frontend/src/lib/client.ts frontend/src/components/icons.tsx
git commit -m "feat(frontend): account avatar look helper, a quiet owner client and a person icon"
```
(End the message with the trailer line the controller gives you.)

---

### Task 2: The avatar in the top bar

`AccountAvatar` reads the owner token. When there is one, it loads the salon through `ownerProbeApi`, every time it mounts. It links to `/shop` when signed in and `/shop/login` when signed out, and draws one of the four looks. It replaces the desktop "Add your shop" link and sits at the end of the top bar at every width. On phones that puts it next to the search icon. The now-unused `nav.add_shop` key goes away.

**Files:**
- Create: `frontend/src/components/AccountAvatar.tsx`
- Modify:
  - `frontend/src/components/Header.tsx` (full file)
  - `frontend/src/i18n/{en,ru,tk}.json`

**Interfaces:**
- Consumes: `avatarLook`, `ownerProbeApi` and `UserIcon` (Task 1); `shopAuth.token()`, which returns `string | null`; `ownerProbeApi.owner.me()`, which returns `ShopMe` with `shop: AdminShop`, where `logo` is `Image | null`; and the existing keys `admin.sign_in` and `myshop.title`.
- Produces: `AccountAvatar` (default export, no props).

- [ ] **Step 1: Write the avatar component**

The `Switch` falls back to the person icon. Its two `Match`es use the keyed callback form, so the logo and the letter never read a salon that has gone.

`frontend/src/components/AccountAvatar.tsx`
```tsx
import { A } from "@solidjs/router";
import { createResource, Match, Switch } from "solid-js";
import { t } from "../i18n/i18n.ts";
import { avatarLook } from "../lib/avatar.ts";
import { ownerProbeApi } from "../lib/client.ts";
import { shopAuth } from "../lib/shopAuth.ts";
import { UserIcon } from "./icons.tsx";

/**
 * The account circle at the end of the top bar. A signed-in shop owner sees their salon's logo
 * (or its first letter) and goes to My shop; everyone else sees a person icon and goes to sign in.
 */
export default function AccountAvatar() {
  // Loaded each time the public pages mount, so a new logo or name shows after editing them on /shop.
  // A failed request just leaves the person icon; an expired session is dropped without a redirect.
  const [me] = createResource(shopAuth.token, () => ownerProbeApi.owner.me().catch(() => null));
  const shop = () => (me.state === "ready" ? me()?.shop ?? null : null);
  const look = () => avatarLook(shopAuth.token() !== null, shop());
  const label = () => {
    if (look() === "signed_out") return t("admin.sign_in");
    const s = shop();
    return s ? `${t("myshop.title")}: ${s.name}` : t("myshop.title");
  };
  return (
    <A href={look() === "signed_out" ? "/shop/login" : "/shop"} class="btn-icon shrink-0" aria-label={label()}>
      <span
        aria-hidden="true"
        class="flex h-[34px] w-[34px] items-center justify-center overflow-hidden rounded-full"
        classList={{
          "border border-silver text-ink": look() === "signed_out",
          "border-2 border-garnet text-ink": look() === "loading" || look() === "logo",
          "bg-garnet text-white": look() === "letter",
        }}
      >
        <Switch fallback={<UserIcon class="h-5 w-5" />}>
          <Match when={look() === "logo" && shop()?.logo}>
            {(logo) => <img src={logo().small} alt="" class="h-full w-full object-cover" />}
          </Match>
          <Match when={look() === "letter" && shop()}>
            {(s) => <span class="font-label text-base leading-none">{s().name.trim().charAt(0).toLocaleUpperCase()}</span>}
          </Match>
        </Switch>
      </span>
    </A>
  );
}
```

- [ ] **Step 2: Put it in the top bar**

The avatar comes after the desktop menu, outside it, so a single avatar serves phones and computers. The "Add your shop" link is removed.

`frontend/src/components/Header.tsx`
```tsx
import { A, useNavigate } from "@solidjs/router";
import { Show } from "solid-js";
import { t } from "../i18n/i18n.ts";
import { favorites } from "../lib/favorites.ts";
import AccountAvatar from "./AccountAvatar.tsx";
import { HeartIcon, SearchIcon } from "./icons.tsx";
import LanguageSwitch from "./LanguageSwitch.tsx";

const MENU_LINK = "inline-flex min-h-11 items-center gap-1.5 px-2 font-label text-xs uppercase tracking-[0.2em]";

/** Phones: the logo, a search button and the account avatar (the bottom bar does the rest). Desktop: a full menu. */
export default function Header() {
  const navigate = useNavigate();
  const count = () => favorites.ids().length;
  let input!: HTMLInputElement;
  return (
    <header class="bg-white">
      <div class="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 md:px-8 md:py-5">
        <A href="/" class="mr-auto font-label text-lg uppercase tracking-[0.32em] text-ink md:mr-0">
          {t("app.name")}
        </A>
        <A href="/search" class="btn-icon text-ink md:hidden" aria-label={t("search.title")}>
          <SearchIcon class="h-6 w-6" />
        </A>
        <form
          role="search"
          class="hidden flex-1 md:block"
          onSubmit={(e) => {
            e.preventDefault();
            const q = input.value.trim();
            navigate(q ? `/search?${new URLSearchParams({ q })}` : "/search");
          }}
        >
          <label class="relative block max-w-sm">
            <span class="sr-only">{t("search.label")}</span>
            <SearchIcon class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-silver-ink" />
            <input
              ref={input}
              type="search"
              autocomplete="off"
              placeholder={t("search.placeholder")}
              class="min-h-11 w-full rounded-full border border-silver bg-white pl-10 pr-4 text-sm"
            />
          </label>
        </form>
        <nav class="hidden items-center md:flex" aria-label={t("tab.menu")}>
          <A href="/categories" class={MENU_LINK} activeClass="text-garnet">{t("tab.categories")}</A>
          <A
            href="/favorites"
            class={MENU_LINK}
            activeClass="text-garnet"
            aria-label={t("nav.favorites_count", { count: count() })}
          >
            <HeartIcon filled={count() > 0} class="h-4 w-4 text-garnet" />
            {t("tab.favorites")}
            <Show when={count() > 0}>
              <span class="tabular-nums text-garnet">{count()}</span>
            </Show>
          </A>
          <LanguageSwitch />
        </nav>
        <AccountAvatar />
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Remove the unused text**

In `frontend/src/i18n/en.json`, replace:
```json
  "nav.language": "Language",
  "nav.add_shop": "Add your shop",
```
with:
```json
  "nav.language": "Language",
```

In `frontend/src/i18n/ru.json`, replace:
```json
  "nav.language": "Язык",
  "nav.add_shop": "Добавить салон",
```
with:
```json
  "nav.language": "Язык",
```

In `frontend/src/i18n/tk.json`, replace:
```json
  "nav.language": "Dil",
  "nav.add_shop": "Salonyňyzy goşuň",
```
with:
```json
  "nav.language": "Dil",
```

Then confirm no code still uses the key. Run, from the repository root: `grep -rn "nav.add_shop" frontend/src`
Expected: no output.

- [ ] **Step 4: Check, test and build**

Run, from `frontend/`: `deno task check`, then `deno task test`, then `deno task build`.
Expected: no check errors; every test passes, including the i18n parity test; the build ends with `✓ built`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AccountAvatar.tsx frontend/src/components/Header.tsx frontend/src/i18n/en.json frontend/src/i18n/ru.json frontend/src/i18n/tk.json
git commit -m "feat(frontend): an account avatar in the top bar shows whether a shop owner is signed in"
```
(End the message with the trailer line the controller gives you.)

---

## Final verification (controller)

The controller does this in headless Chrome against a server built from the branch. It uses the **test** database and demo data only, never `wedding_dev`, and deletes every row it created afterwards.

1. **The four looks:** signed out (a silver ring and the person icon), signed in with a logo, and signed in without a logo (the letter). Check each in tk, ru and en at 320 and 1280px, including the accessible names and the 44px tap size. There must be no overflow and no page errors.
2. **Taps:**
   - Signed in, the avatar opens `/shop`; signed out, `/shop/login`.
   - After Sign out on `/shop`, the public header shows the person icon again.
3. **An invalid token on a public page:** the page stays where it is, the token is cleared, and the person icon shows.
4. **Contrast:** the script finds no problems.

## Spec coverage

| Spec | Where |
|---|---|
| §2 tap behaviour, placement; "Add your shop" leaves the top bar | Task 2 |
| §3 looks | Task 1 (`avatarLook`, `UserIcon`), Task 2 (`AccountAvatar`) |
| §4 behaviour: token, loading, no redirect, accessible names | Task 1 (`ownerProbeApi`), Task 2 |
| §5 texts | Task 2, Step 3 |
| §7 testing | Task 1 (`avatar_test.ts`), Final verification |

## Changes made during review

- No code changes were needed. Both task reviews and the final review found no Critical or Important issues.
- **Left for later**, triaged as fine:
  - the redundant `| null` in `avatarLook`'s parameter type;
  - the inline 401 handler in `ownerProbeApi`;
  - an empty salon name would show a blank circle, but the backend rejects empty names;
  - this plan calls the `Match` callbacks "keyed", though they use the accessor form (the code is correct);
  - no component test for the label and link;
  - at 768px in Russian the header search field shrinks to about 110px. A possible follow-up is `gap-6 md:gap-4 lg:gap-6` on the Header row.
