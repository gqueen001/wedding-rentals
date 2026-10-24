# Dark Mode and the Phone My Shop Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Add a cool-charcoal dark mode. It follows the device by default, and a switch on the More page (Auto, Light or Dark) can override it.
- Give "My shop" a compact phone header, with a small logo, a smaller name and small buttons beside the logo.
- Make the My shop and admin top bars fit on one line on phones.

**Architecture:**
- **Dark colors:** dark mode only redefines the existing color tokens (plus three new fill tokens). It uses a Tailwind custom `dark` variant that matches the device setting (unless `<html data-theme="light">`) or a forced `<html data-theme="dark">`.
- **The choice:** a pure `lib/theme.ts` stores it (`wr.theme`) and applies it. An inline script in `index.html` applies a stored choice before the first paint.
- **Phone layout:** the My shop header becomes a 2-column grid that keeps today's layout from md. A shared `SignOutButton` turns into an icon on phones.

**Tech Stack:** Solid 1.9, Tailwind 4 (`@custom-variant`, `@variant`), built and tested with Deno 2.4. There are no backend changes.

**Spec:** `docs/superpowers/specs/2026-10-24-dark-mode-mobile-shop-design.md`

## Global Constraints

- **Unchanged:**
  - The light mode looks exactly as today, apart from the phone My shop header and the phone top bars.
  - Computers keep today's My shop layout.
  - No new routes and no API changes.
- **Dark colors** (only these values):
  - `white #1b1b1e`, `veil #121214`, `line #2c2c31`;
  - `ink #bdbdc2`, `silver-ink #8e8e94`, `silver #6a6a70`;
  - `garnet #ef8a9a`, `garnet-deep #f2b0b9`, `blush #3a1f25`;
  - `garnet-fill #a8243a`, `garnet-fill-deep #8e1b2e`.
- **New tokens in light:** `garnet-fill #8e1b2e`, `garnet-fill-deep #6b1222`, `on-fill #ffffff`. The value of `on-fill` is the same in both themes.
- **Fills:** anything with white text on garnet uses `bg-garnet-fill` plus `text-on-fill`. Photo viewers and backdrops use `black`, which is the same in both themes.
- **Theme choice:**
  - It is stored under `wr.theme` as `"light"` or `"dark"`. Auto removes the key.
  - `<html data-theme>` is `"light"`, `"dark"` or absent.
  - The browser bar color is `#8e1b2e` in light (unchanged) and `#1b1b1e` in dark.
- **Accessibility:**
  - Text contrast is at least 4.5 : 1 (3 : 1 for 24px and up) in **both** themes, and no text is smaller than 10px.
  - Every control has a name. The sign-out icon is named "Sign out".
  - No sideways scrolling at 320px in tk, ru and en, and the top bars stay on one line.
- **Text:** every user-visible string goes through `frontend/src/i18n/{tk,ru,en}.json`, with identical keys and placeholders, which a test enforces.
- **Tools:** frontend tools run only through Deno, from `frontend/`: `deno task test`, `deno task check` and `deno task build`. Never run npm or Vite with Node.
- **Data:** never write to the `wedding_dev` database.
- **Commits:** every commit message ends with the `Co-Authored-By:` trailer line the controller gives you.

## File Map

```
frontend/src/lib/theme.ts, theme_test.ts       new: ThemeChoice, parseTheme, themeAttr, createTheme, theme
frontend/index.html                            two theme-color metas + the before-paint theme script
frontend/src/pages/More.tsx                    the Theme section (Auto / Light / Dark)
frontend/src/i18n/{tk,ru,en}.json              + more.theme, theme.auto, theme.light, theme.dark
frontend/src/index.css                         dark tokens via @custom-variant dark; garnet-fill/on-fill; btn-primary
frontend/src/components/{Gallery,AccountAvatar,Sheet,ShopLogo,BottomNav,GolBand}.tsx, admin/PhotoManager.tsx, pages/Home.tsx   fills for dark
frontend/src/components/icons.tsx              + LogoutIcon
frontend/src/components/admin/SignOutButton.tsx   new: icon on phones, the word from md
frontend/src/pages/shop/ShopLayout.tsx, pages/admin/AdminLayout.tsx   one-line top bars
frontend/src/components/ShopLogo.tsx           + size "profile"
frontend/src/pages/shop/MyShop.tsx             the compact phone header
```

## How to read the steps

- **Full files:** a path in backticks on its own line, directly followed by a code block, gives the **whole file**. Create or overwrite it with exactly that content. From the repository root you can extract it with:
  `python3 -I .superpowers/sdd/dm/block.py <brief> <path> > <path>`
- **Replacements:** "In `path`, replace:" gives an exact text to find (it occurs once) and the text to put in its place. Apply a file's replacements in the order given.
- **Appends:** "Append to `path`:" gives text to add at the very end of the file.
- **i18n entries:** under **en.json**, **ru.json** and **tk.json**, a block of `"key": "value"` lines goes at the end of that file. Add a comma to the file's current last entry, and keep the closing `}` last.

---

### Task 1: The theme choice and its switch on the More page

This task adds the theme logic (with tests), the before-paint script, and the Theme section on `/more`. The dark colors come in Task 2. Until then, picking Dark sets `<html data-theme="dark">` but nothing looks different yet.

**Files:**
- Create:
  - `frontend/src/lib/theme.ts`
  - `frontend/src/lib/theme_test.ts`
- Modify:
  - `frontend/index.html` (full file)
  - `frontend/src/pages/More.tsx`
  - `frontend/src/i18n/{en,ru,tk}.json`

**Interfaces:**
- Produces:
  - `type ThemeChoice = "auto" | "light" | "dark"`;
  - `THEMES`, `THEME_KEY = "wr.theme"` and `THEME_COLOR`;
  - `parseTheme(stored: string | null): ThemeChoice`;
  - `themeAttr(choice): "light" | "dark" | null`;
  - `createTheme(kv: KV): { choice: Accessor<ThemeChoice>; set(choice): void }`;
  - the app-wide `theme`.

- [ ] **Step 1: Write the failing tests**

`frontend/src/lib/theme_test.ts`
```ts
import { assertEquals } from "@std/assert";
import { memoryKV } from "./storage.ts";
import { createTheme, parseTheme, THEME_KEY, themeAttr } from "./theme.ts";

Deno.test("parseTheme keeps light and dark, and treats anything else as auto", () => {
  assertEquals(parseTheme("light"), "light");
  assertEquals(parseTheme("dark"), "dark");
  assertEquals(parseTheme(null), "auto");
  assertEquals(parseTheme("auto"), "auto");
  assertEquals(parseTheme("sepia"), "auto");
});

Deno.test("themeAttr gives no attribute for auto", () => {
  assertEquals(themeAttr("auto"), null);
  assertEquals(themeAttr("light"), "light");
  assertEquals(themeAttr("dark"), "dark");
});

Deno.test("createTheme remembers a picked theme and forgets it on auto", () => {
  const kv = memoryKV({ [THEME_KEY]: "dark" });
  const t = createTheme(kv);
  assertEquals(t.choice(), "dark");
  t.set("light");
  assertEquals([t.choice(), kv.get(THEME_KEY)], ["light", "light"]);
  t.set("auto");
  assertEquals([t.choice(), kv.get(THEME_KEY)], ["auto", null]);
  assertEquals(createTheme(memoryKV({ [THEME_KEY]: "nonsense" })).choice(), "auto");
});
```

Run, from `frontend/`: `deno task test`
Expected: FAIL. `theme_test.ts` cannot load `./theme.ts`.

- [ ] **Step 2: Write the theme logic**

`frontend/src/lib/theme.ts`
```ts
import { type Accessor, createSignal } from "solid-js";
import { type KV, safeKV } from "./storage.ts";

/** The theme picked on the More page; "auto" follows the device's light or dark setting. */
export type ThemeChoice = "auto" | "light" | "dark";

export const THEMES: readonly ThemeChoice[] = ["auto", "light", "dark"];

/** Kept in step with the inline script in index.html, which applies the theme before the first paint. */
export const THEME_KEY = "wr.theme";

/** The browser bar's color in each theme (the <meta name="theme-color"> tags in index.html). */
export const THEME_COLOR = { light: "#8e1b2e", dark: "#1b1b1e" } as const;

/** A stored value as a choice: anything but "light" or "dark" means auto. */
export function parseTheme(stored: string | null): ThemeChoice {
  return stored === "light" || stored === "dark" ? stored : "auto";
}

/** The <html data-theme> value for a choice; null means no attribute, so the device decides. */
export function themeAttr(choice: ThemeChoice): "light" | "dark" | null {
  return choice === "auto" ? null : choice;
}

export interface Theme {
  choice: Accessor<ThemeChoice>;
  set(choice: ThemeChoice): void;
}

/** The theme choice, remembered in kv and applied to the page (when there is one). */
export function createTheme(kv: KV): Theme {
  const [choice, setChoice] = createSignal(parseTheme(kv.get(THEME_KEY)));
  return {
    choice,
    set(next) {
      setChoice(next);
      if (next === "auto") kv.remove(THEME_KEY);
      else kv.set(THEME_KEY, next);
      if (typeof document === "undefined") return;
      const attr = themeAttr(next);
      if (attr) document.documentElement.dataset.theme = attr;
      else delete document.documentElement.dataset.theme;
      // A picked theme also picks the browser bar's color; auto lets the tags' media queries decide.
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
        m.content = attr ? THEME_COLOR[attr] : m.media.includes("dark") ? THEME_COLOR.dark : THEME_COLOR.light;
      });
    },
  };
}

export const theme = createTheme(safeKV());
```

Run, from `frontend/`: `deno task test`
Expected: PASS, including the 3 tests in `theme_test.ts`.

- [ ] **Step 3: Apply a stored theme before the first paint**

The two `theme-color` tags let the browser bar follow the device. The script only runs for a picked theme, and it repeats `parseTheme`, `themeAttr` and `THEME_COLOR` in a few plain lines.

`frontend/index.html`
```html
<!doctype html>
<html lang="tk">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#8e1b2e" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#1b1b1e" media="(prefers-color-scheme: dark)" />
    <script>
      // Before the first paint, so a dark page never flashes white: a theme picked on the More page
      // (wr.theme, see src/lib/theme.ts) wins over the device's setting.
      try {
        var theme = localStorage.getItem("wr.theme");
        if (theme === "light" || theme === "dark") {
          document.documentElement.dataset.theme = theme;
          document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) {
            m.content = theme === "dark" ? "#1b1b1e" : "#8e1b2e";
          });
        }
      } catch (e) {}
    </script>
    <meta name="description" content="Toý köýnekleri: Türkmenistanyň kireý salonlaryndan köýnekler bir ýerde." />
    <title>Gelin</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <link rel="manifest" href="/manifest.json" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Add the texts**

**en.json**
```json
  "more.theme": "Theme",
  "theme.auto": "Auto",
  "theme.light": "Light",
  "theme.dark": "Dark"
```

**ru.json**
```json
  "more.theme": "Тема",
  "theme.auto": "Как на устройстве",
  "theme.light": "Светлая",
  "theme.dark": "Тёмная"
```

**tk.json**
```json
  "more.theme": "Görnüş",
  "theme.auto": "Awtomatik",
  "theme.light": "Ýagty",
  "theme.dark": "Garaňky"
```

- [ ] **Step 5: Add the Theme section to the More page**

It works the same way as the language rows: buttons with `aria-pressed` and a ✓ on the chosen one.

In `frontend/src/pages/More.tsx`, replace:
```tsx
import { contactPhone } from "../lib/contact.ts";
import { usePageTitle } from "../lib/title.ts";
```
with:
```tsx
import { contactPhone } from "../lib/contact.ts";
import { theme, THEMES } from "../lib/theme.ts";
import { usePageTitle } from "../lib/title.ts";
```

In `frontend/src/pages/More.tsx`, replace:
```tsx
/** The bottom bar's "More": language, search, and the way in for shops. */
```
with:
```tsx
/** The bottom bar's "More": language, theme, search, and the way in for shops. */
```

In `frontend/src/pages/More.tsx`, replace:
```tsx
                <Show when={i18n.lang() === lang}>
                  <span class="label text-garnet" aria-hidden="true">✓</span>
```
with:
```tsx
                <Show when={i18n.lang() === lang}>
                  <span class="label text-garnet" aria-hidden="true">✓</span>
                </Show>
              </button>
            )}
          </For>
        </div>
      </section>

      <section class="mt-8" aria-labelledby="more-theme">
        <h2 id="more-theme" class="label">{t("more.theme")}</h2>
        <div role="group" aria-labelledby="more-theme" class="mt-2 border-t border-line">
          <For each={THEMES}>
            {(choice) => (
              <button
                type="button"
                aria-pressed={theme.choice() === choice}
                class={`${ROW} w-full text-left`}
                classList={{ "text-garnet": theme.choice() === choice }}
                onClick={() => theme.set(choice)}
              >
                <span>{t(`theme.${choice}`)}</span>
                <Show when={theme.choice() === choice}>
                  <span class="label text-garnet" aria-hidden="true">✓</span>
```

- [ ] **Step 6: Check, test and build**

Run, from `frontend/`: `deno task check`, then `deno task test`, then `deno task build`.
Expected: no check errors; every test passes, including the i18n parity test; the build ends with `✓ built`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/theme.ts frontend/src/lib/theme_test.ts frontend/index.html frontend/src/pages/More.tsx frontend/src/i18n/en.json frontend/src/i18n/ru.json frontend/src/i18n/tk.json
git commit -m "feat(frontend): a theme choice (auto, light, dark) on the More page, applied before the first paint"
```
(End the message with the trailer line the controller gives you.)

---

### Task 2: The dark colors

The tokens get their dark values through a custom `dark` variant. That variant matches the device's dark setting (unless `data-theme="light"`) or a forced `data-theme="dark"`. Three new tokens split fills from text:
- `garnet-fill` and `garnet-fill-deep` are the button and badge fills;
- `on-fill` is the white text on them.

The places that drew white on garnet, or used `ink` as a dark backdrop, switch to these tokens or to `black`. On Home, the big "GELIN" word uses `screen` blending in dark mode, so it doesn't disappear into the dark page.

**Files:**
- Modify:
  - `frontend/src/index.css`
  - `frontend/src/components/Gallery.tsx`
  - `frontend/src/components/AccountAvatar.tsx`
  - `frontend/src/components/Sheet.tsx`
  - `frontend/src/components/ShopLogo.tsx`
  - `frontend/src/components/BottomNav.tsx`
  - `frontend/src/components/GolBand.tsx`
  - `frontend/src/components/admin/PhotoManager.tsx`
  - `frontend/src/pages/Home.tsx`

**Interfaces:**
- Consumes: `data-theme` from Task 1.
- Produces:
  - the `dark:` variant;
  - the utilities `bg-garnet-fill`, `text-garnet-fill`, `text-on-fill`, `fill-on-fill`, `stroke-on-fill`, `hover:bg-on-fill/10` and `garnet-fill-deep`.

- [ ] **Step 1: Dark tokens, the dark variant and the fill tokens**

In `frontend/src/index.css`, replace:
```css
  --color-blush: #f8e7ea;
  --font-display: "Cormorant Garamond", "Times New Roman", serif;
```
with:
```css
  --color-blush: #f8e7ea;
  /* Fills that carry white text (primary buttons, badges, the logo letter), and that white text. */
  --color-garnet-fill: #8e1b2e;
  --color-garnet-fill-deep: #6b1222;
  --color-on-fill: #ffffff;
  --font-display: "Cormorant Garamond", "Times New Roman", serif;
```

In `frontend/src/index.css`, replace:
```css
@layer base {
  html {
    color-scheme: light;
```
with:
```css
/* Dark mode: the device's setting, unless a theme was picked on the More page (<html data-theme>). */
@custom-variant dark {
  @media (prefers-color-scheme: dark) {
    &:where(:root:not([data-theme="light"]), :root:not([data-theme="light"]) *) {
      @slot;
    }
  }
  &:where([data-theme="dark"], [data-theme="dark"] *) {
    @slot;
  }
}

:root {
  @variant dark {
    --color-white: #1b1b1e;
    --color-veil: #121214;
    --color-line: #2c2c31;
    --color-ink: #bdbdc2;
    --color-garnet: #ef8a9a;
    --color-garnet-deep: #f2b0b9;
    --color-silver: #6a6a70;
    --color-silver-ink: #8e8e94;
    --color-blush: #3a1f25;
    --color-garnet-fill: #a8243a;
    --color-garnet-fill-deep: #8e1b2e;
  }
}

@layer base {
  html {
    color-scheme: light;
    @variant dark {
      color-scheme: dark;
    }
```

In `frontend/src/index.css`, replace:
```css
    background: var(--color-garnet);
    color: var(--color-white);
  }
  .btn-primary:hover:not(:disabled):not([aria-disabled="true"]) {
    background: var(--color-garnet-deep);
```
with:
```css
    background: var(--color-garnet-fill);
    color: var(--color-on-fill);
  }
  .btn-primary:hover:not(:disabled):not([aria-disabled="true"]) {
    background: var(--color-garnet-fill-deep);
```

- [ ] **Step 2: Fills and backdrops**

In `frontend/src/components/Gallery.tsx`, replace:
```tsx
      class="fixed inset-0 z-50 flex flex-col bg-ink text-white outline-none"
```
with:
```tsx
      class="fixed inset-0 z-50 flex flex-col bg-black text-on-fill outline-none"
```

In `frontend/src/components/Gallery.tsx`, replace:
```tsx
          type="button"
          class="btn-icon hover:bg-white/10"
          aria-label={t("common.close")}
```
with:
```tsx
          type="button"
          class="btn-icon hover:bg-on-fill/10"
          aria-label={t("common.close")}
```

In `frontend/src/components/Gallery.tsx`, replace:
```tsx
            type="button"
            class="btn-icon hover:bg-white/10"
            disabled={index() === 0}
```
with:
```tsx
            type="button"
            class="btn-icon hover:bg-on-fill/10"
            disabled={index() === 0}
```

In `frontend/src/components/Gallery.tsx`, replace:
```tsx
            type="button"
            class="btn-icon hover:bg-white/10"
            disabled={index() === total() - 1}
```
with:
```tsx
            type="button"
            class="btn-icon hover:bg-on-fill/10"
            disabled={index() === total() - 1}
```

In `frontend/src/components/AccountAvatar.tsx`, replace:
```tsx
          "bg-garnet text-white": look() === "letter",
```
with:
```tsx
          "bg-garnet-fill text-on-fill": look() === "letter",
```

In `frontend/src/components/Sheet.tsx`, replace:
```tsx
        <div class="absolute inset-0 bg-ink/40" aria-hidden="true" onClick={() => props.onClose()} />
```
with:
```tsx
        <div class="absolute inset-0 bg-black/50" aria-hidden="true" onClick={() => props.onClose()} />
```

In `frontend/src/components/ShopLogo.tsx`, replace:
```tsx
          class={`inline-flex shrink-0 items-center justify-center rounded-[50%] bg-garnet font-display text-white ${size()}`}
```
with:
```tsx
          class={`inline-flex shrink-0 items-center justify-center rounded-[50%] bg-garnet-fill font-display text-on-fill ${size()}`}
```

In `frontend/src/components/BottomNav.tsx`, replace:
```tsx
                      <span class="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-garnet px-1 text-center font-sans text-[10px] leading-4 tracking-normal text-white">
```
with:
```tsx
                      <span class="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-garnet-fill px-1 text-center font-sans text-[10px] leading-4 tracking-normal text-on-fill">
```

In `frontend/src/components/GolBand.tsx`, replace:
```tsx
    <svg class="block h-3.5 w-full text-garnet" aria-hidden="true">
      <defs>
        <pattern id={id} width="28" height="14" patternUnits="userSpaceOnUse">
          <rect width="28" height="14" fill="currentColor" />
          <path d="M8 1.5h12l4.5 3v5L20 12.5H8l-4.5-3v-5z" fill="none" class="stroke-white" stroke-width="1" />
          <path d="M14 4l3.5 3-3.5 3-3.5-3z" class="fill-white" />
```
with:
```tsx
    <svg class="block h-3.5 w-full text-garnet-fill" aria-hidden="true">
      <defs>
        <pattern id={id} width="28" height="14" patternUnits="userSpaceOnUse">
          <rect width="28" height="14" fill="currentColor" />
          <path d="M8 1.5h12l4.5 3v5L20 12.5H8l-4.5-3v-5z" fill="none" class="stroke-on-fill" stroke-width="1" />
          <path d="M14 4l3.5 3-3.5 3-3.5-3z" class="fill-on-fill" />
```

In `frontend/src/components/admin/PhotoManager.tsx`, replace:
```tsx
                  <span class="absolute left-1 top-1 rounded-full bg-garnet px-2 py-0.5 text-xs text-white">
```
with:
```tsx
                  <span class="absolute left-1 top-1 rounded-full bg-garnet-fill px-2 py-0.5 text-xs text-on-fill">
```

In `frontend/src/pages/Home.tsx`, replace:
```tsx
              class="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-display text-[5rem] uppercase leading-none text-ink mix-blend-multiply sm:text-[7rem]"
```
with:
```tsx
              class="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-display text-[5rem] uppercase leading-none text-ink mix-blend-multiply dark:mix-blend-screen sm:text-[7rem]"
```

Then confirm that nothing else draws white on garnet. Run, from the repository root: `grep -rn "text-white\|fill-white\|stroke-white\|bg-ink\b" frontend/src`
Expected: no output.

- [ ] **Step 3: Check, test and build**

Run, from `frontend/`: `deno task check`, then `deno task test`, then `deno task build`.
Expected: no check errors, every test passes, and the build ends with `✓ built`. In `frontend/dist/assets/*.css`, `grep -c "data-theme=dark"` prints at least 1.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css frontend/src/components/Gallery.tsx frontend/src/components/AccountAvatar.tsx frontend/src/components/Sheet.tsx frontend/src/components/ShopLogo.tsx frontend/src/components/BottomNav.tsx frontend/src/components/GolBand.tsx frontend/src/components/admin/PhotoManager.tsx frontend/src/pages/Home.tsx
git commit -m "feat(frontend): a cool-charcoal dark mode through the color tokens"
```
(End the message with the trailer line the controller gives you.)

---

### Task 3: One-line top bars on phones

In the My shop and admin top bars, Sign out becomes a small bordered icon below 768px (the shared `SignOutButton`). It keeps the word from md up. To fit on one line at 320px in every language:
- the My shop bar hides its "My shop" link below 640px, because every sub-page has a Back button;
- the admin bar hides its "Admin" label and its language switch below 640px. The language is shared with the public pages, where it can be changed. Its two section links stay, with smaller padding.

**Files:**
- Create: `frontend/src/components/admin/SignOutButton.tsx`
- Modify:
  - `frontend/src/components/icons.tsx`
  - `frontend/src/pages/shop/ShopLayout.tsx`
  - `frontend/src/pages/admin/AdminLayout.tsx`

**Interfaces:**
- Produces:
  - `LogoutIcon` (props `{ class?: string }`);
  - `SignOutButton` (props `{ onClick: () => void }`). Its accessible name is `admin.sign_out`.

- [ ] **Step 1: Add the icon**

Append to `frontend/src/components/icons.tsx`:
```tsx

export const LogoutIcon = (p: IconProps) => (
  <Svg class={p.class}>
    <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
  </Svg>
);
```

- [ ] **Step 2: Add the Sign out button**

`frontend/src/components/admin/SignOutButton.tsx`
```tsx
import { t } from "../../i18n/i18n.ts";
import { LogoutIcon } from "../icons.tsx";

/** "Sign out" in the admin and My shop top bars: a small icon on phones, the word from 768px up. */
export default function SignOutButton(props: { onClick: () => void }) {
  return (
    <button type="button" class="btn btn-quiet w-11 px-0 md:w-auto md:px-3" aria-label={t("admin.sign_out")} onClick={props.onClick}>
      <LogoutIcon class="h-4 w-4 md:hidden" />
      <span class="hidden md:inline">{t("admin.sign_out")}</span>
    </button>
  );
}
```

- [ ] **Step 3: Use it, and keep both bars on one line**

In `frontend/src/pages/shop/ShopLayout.tsx`, replace:
```tsx
import { Show } from "solid-js";
import GolBand from "../../components/GolBand.tsx";
```
with:
```tsx
import { Show } from "solid-js";
import SignOutButton from "../../components/admin/SignOutButton.tsx";
import GolBand from "../../components/GolBand.tsx";
```

In `frontend/src/pages/shop/ShopLayout.tsx`, replace:
```tsx
          <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
            <A href="/" class="font-display text-2xl text-garnet">{t("app.name")}</A>
            <nav class="flex text-sm" aria-label={t("myshop.title")}>
```
with:
```tsx
          <div class="mx-auto flex max-w-6xl items-center gap-x-2 px-4 py-2 sm:gap-x-4">
            <A href="/" class="font-display text-2xl text-garnet">{t("app.name")}</A>
            <nav class="hidden text-sm sm:flex" aria-label={t("myshop.title")}>
```

In `frontend/src/pages/shop/ShopLayout.tsx`, replace:
```tsx
              <button type="button" class="btn btn-quiet" onClick={signOut}>
                {t("admin.sign_out")}
              </button>
```
with:
```tsx
              <SignOutButton onClick={signOut} />
```

In `frontend/src/pages/admin/AdminLayout.tsx`, replace:
```tsx
import { Show } from "solid-js";
import GolBand from "../../components/GolBand.tsx";
```
with:
```tsx
import { Show } from "solid-js";
import SignOutButton from "../../components/admin/SignOutButton.tsx";
import GolBand from "../../components/GolBand.tsx";
```

In `frontend/src/pages/admin/AdminLayout.tsx`, replace:
```tsx
const NAV_LINK = "inline-flex min-h-11 items-center rounded-full px-3 hover:bg-veil";
```
with:
```tsx
const NAV_LINK = "inline-flex min-h-11 items-center rounded-full px-2 hover:bg-veil sm:px-3";
```

In `frontend/src/pages/admin/AdminLayout.tsx`, replace:
```tsx
          <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
            <A href="/" class="font-display text-2xl text-garnet">{t("app.name")}</A>
            <span class="text-sm text-silver-ink">{t("admin.title")}</span>
```
with:
```tsx
          <div class="mx-auto flex max-w-6xl items-center gap-x-2 px-4 py-2 sm:gap-x-4">
            <A href="/" class="font-display text-2xl text-garnet">{t("app.name")}</A>
            <span class="hidden text-sm text-silver-ink sm:inline">{t("admin.title")}</span>
```

In `frontend/src/pages/admin/AdminLayout.tsx`, replace:
```tsx
              <LanguageSwitch />
              <button type="button" class="btn btn-quiet" onClick={signOut}>{t("admin.sign_out")}</button>
```
with:
```tsx
              {/* Phones: no room next to the admin links; the language can be changed on any public page. */}
              <span class="hidden sm:contents">
                <LanguageSwitch />
              </span>
              <SignOutButton onClick={signOut} />
```

- [ ] **Step 4: Check, test and build**

Run, from `frontend/`: `deno task check`, then `deno task test`, then `deno task build`.
Expected: no check errors, every test passes, and the build ends with `✓ built`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/icons.tsx frontend/src/components/admin/SignOutButton.tsx frontend/src/pages/shop/ShopLayout.tsx frontend/src/pages/admin/AdminLayout.tsx
git commit -m "feat(frontend): the My shop and admin top bars fit on one line on phones"
```
(End the message with the trailer line the controller gives you.)

---

### Task 4: The compact My shop header on phones

Below 768px the header is a 2-column grid. The small oval logo (70 × 92px) sits on the left. Beside it are the city and address, the name in the label font at `text-lg`, and the two buttons, which are 32px high with 10px text and no + icon and wrap long words. The "See your shop page" link comes under the buttons, and the description goes below the whole row.

From md, every item gets an explicit grid cell, so the layout is exactly today's: the large logo; then the name, the description and the full-size buttons in one column.

**Files:**
- Modify:
  - `frontend/src/components/ShopLogo.tsx`
  - `frontend/src/pages/shop/MyShop.tsx` (full file)

**Interfaces:**
- Produces: the `ShopLogo` size `"profile"`, which is `h-[92px] w-[70px] text-3xl` below md and the `xl` oval from md.

- [ ] **Step 1: Add the profile logo size**

In `frontend/src/components/ShopLogo.tsx`, replace:
```tsx
  xl: "h-36 w-28 text-6xl", // an oval, for the shop page
```
with:
```tsx
  xl: "h-36 w-28 text-6xl", // an oval, for the shop page
  profile: "h-[92px] w-[70px] text-3xl md:h-36 md:w-28 md:text-6xl", // My shop: small on phones, xl from md
```

- [ ] **Step 2: Rewrite the header**

The `md:col-start-*` and `md:row-start-*` classes pin every header item to its cell. Without them, the items that have a fixed row are placed first and push the logo into a third column.

`frontend/src/pages/shop/MyShop.tsx`
```tsx
import { A } from "@solidjs/router";
import { createResource, For, Match, Show, Switch } from "solid-js";
import ErrorState from "../../components/ErrorState.tsx";
import { PlusIcon } from "../../components/icons.tsx";
import ShopLogo from "../../components/ShopLogo.tsx";
import { i18n, t } from "../../i18n/i18n.ts";
import { useCities } from "../../lib/cities.ts";
import { ownerApi } from "../../lib/client.ts";
import { contactPhone } from "../../lib/contact.ts";
import { cityName } from "../../lib/format.ts";
import { useManage } from "../../lib/manage.ts";
import { usePageTitle } from "../../lib/title.ts";
import type { ListingSummary } from "../../lib/types.ts";

/** Edit profile and New listing: compact on phones (next to the logo, wrapping long words, no + icon), full size from md. */
const HEADER_BTN =
  "min-h-8 px-1 text-center text-[10px] leading-tight tracking-[0.04em] md:min-h-11 md:px-5 md:text-xs md:tracking-[0.18em]";

/** One square of the owner's photo grid: a link to the listing's editor, marked when it is a draft. */
function OwnerTile(props: { listing: ListingSummary; href: string }) {
  const l = () => props.listing;
  return (
    <li>
      <A
        href={props.href}
        class="group relative block aspect-[3/4] overflow-hidden bg-white"
        aria-label={l().is_published ? l().title : `${l().title} · ${t("admin.draft")}`}
      >
        <Show
          when={l().photo}
          fallback={
            <span class="flex h-full items-center justify-center p-2 text-center text-xs text-silver-ink">{l().title}</span>
          }
        >
          {(src) => (
            <img src={src()} alt="" loading="lazy" class="h-full w-full object-cover transition-opacity group-hover:opacity-90" />
          )}
        </Show>
        <Show when={!l().is_published}>
          <span aria-hidden="true" class="label absolute left-1.5 top-1.5 bg-white px-1.5 py-0.5 tracking-normal text-ink">
            {t("admin.draft")}
          </span>
        </Show>
      </A>
    </li>
  );
}

/** "My shop": the owner's shop as brides see it, with Edit profile, New listing and a grid of every listing. */
export default function MyShop() {
  usePageTitle(() => t("myshop.title"));
  const [me, { refetch }] = createResource(() => ownerApi.owner.me());
  const m = useManage();
  const [listings, listingList] = createResource(() => ownerApi.owner.listings());
  const cities = useCities();
  const shop = () => (me.state === "ready" ? me()?.shop : undefined);
  const city = () => {
    const c = cities().find((x) => x.id === shop()?.city_id);
    return c ? cityName(c, i18n.lang()) : "";
  };
  const href = (l: ListingSummary) => (l.category === "dresses" ? m.dressHref(l.id) : m.itemHref(l.id));

  return (
    <Switch>
      <Match when={me.error}>
        <ErrorState error={me.error} onRetry={() => void refetch()} />
      </Match>
      <Match when={!shop()}>
        <p class="text-silver-ink">{t("common.loading")}</p>
      </Match>
      <Match when={shop()}>
        {(s) => (
          <div>
            {/* Phones: the logo with the name and buttons beside it, the description below.
                From md: the logo, then the name, description and buttons in one column, as on the shop page. */}
            <header class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 md:gap-x-6">
              <div class="row-span-2 md:col-start-1 md:row-span-3 md:row-start-1">
                <ShopLogo url={s().logo?.small ?? null} name={s().name} size="profile" />
              </div>
              <div class="min-w-0 md:col-start-2 md:row-start-1">
                <p class="label">{[city(), s().address].filter(Boolean).join(" · ")}</p>
                <h1 class="mt-1 break-words text-lg md:mt-2 md:font-display md:text-6xl md:tracking-normal">{s().name}</h1>
              </div>
              <div class="mt-2 grid grid-cols-2 gap-1.5 md:col-start-2 md:row-start-3 md:mt-6 md:flex md:flex-wrap md:items-center md:gap-3">
                <A href="/shop/profile" class={`btn btn-outline ${HEADER_BTN}`}>{t("myshop.edit_profile")}</A>
                <A href={m.newListingHref()} class={`btn btn-primary ${HEADER_BTN}`}>
                  <PlusIcon class="hidden h-5 w-5 shrink-0 md:block" />
                  {t("admin.new_listing")}
                </A>
                <Show when={s().is_published}>
                  <A
                    href={`/shops/${s().slug}`}
                    class="label col-span-2 mt-1 justify-self-start border-b border-ink pb-0.5 text-ink md:mt-0"
                  >
                    {t("myshop.view_page")}
                  </A>
                </Show>
              </div>
              <Show when={s().description}>
                {(text) => (
                  <p class="col-span-2 mt-3 max-w-prose whitespace-pre-line md:col-span-1 md:col-start-2 md:row-start-2 md:mt-4">
                    {text()}
                  </p>
                )}
              </Show>
            </header>

            <Show when={!s().is_published}>
              <p class="mt-6 max-w-2xl rounded-lg bg-blush p-4 text-garnet-deep">
                {t("myshop.hidden")}
                <Show when={contactPhone()}>
                  {(p) => (
                    <>
                      {" "}
                      <a href={`tel:${p().replace(/\s/g, "")}`} class="font-semibold text-garnet">
                        {p()}
                      </a>
                    </>
                  )}
                </Show>
              </p>
            </Show>

            <section class="mt-10" aria-labelledby="my-listings-title">
              <h2 id="my-listings-title" class="label border-t border-line pt-6">{t("myshop.dresses")}</h2>
              <div class="mt-4">
                <Switch>
                  <Match when={listings.error}>
                    <ErrorState error={listings.error} onRetry={() => void listingList.refetch()} />
                  </Match>
                  <Match when={!listings()}>
                    <p class="text-silver-ink">{t("common.loading")}</p>
                  </Match>
                  <Match when={listings()?.length === 0}>
                    <p class="max-w-2xl rounded-lg bg-white p-5 text-silver-ink">{t("myshop.no_dresses")}</p>
                  </Match>
                  <Match when={listings()}>
                    {(list) => (
                      <ul class="grid grid-cols-3 gap-1 md:grid-cols-4 md:gap-2">
                        <For each={list()}>{(l) => <OwnerTile listing={l} href={href(l)} />}</For>
                      </ul>
                    )}
                  </Match>
                </Switch>
              </div>
            </section>
          </div>
        )}
      </Match>
    </Switch>
  );
}
```

- [ ] **Step 3: Check, test and build**

Run, from `frontend/`: `deno task check`, then `deno task test`, then `deno task build`.
Expected: no check errors, every test passes, and the build ends with `✓ built`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ShopLogo.tsx frontend/src/pages/shop/MyShop.tsx
git commit -m "feat(frontend): a compact My shop header on phones"
```
(End the message with the trailer line the controller gives you.)

---

## Final verification (controller)

The controller does this in headless Chrome against a server built from the branch. It uses the **test** database and demo data only, never `wedding_dev`, and deletes every row it created afterwards.

1. **Screenshots:**
   - In light and in dark (the emulated device setting), in tk, ru and en at 320, 375, 768 and 1280px.
   - Pages:
     - home, `/c/cars`, a dress page and `/more`;
     - `/shop`, `/shop/profile` and an owner editor, signed in as a demo owner;
     - `/admin/listings`, signed in as the demo admin.
   - There must be no overflow, no page errors, no top bar taller than one line, and no header button whose text overflows.
2. **Contrast:** the script finds no problems in light **and** in dark on the public pages, the owner pages and the sign-in page.
3. **The switch:**
   - Dark sets `data-theme="dark"`, stores it, and turns the browser bar color dark.
   - After a reload, the page is dark as soon as the DOM is ready.
   - Auto removes the attribute and the stored key, and then follows the emulated device setting.
4. **The sign-out icon** is named "Sign out".

## Spec coverage

| Spec | Where |
|---|---|
| §3 My shop on phones | Task 4 |
| §4 One-line top bars | Task 3 |
| §5.1 Colors, fills | Task 2 |
| §5.2 How dark turns on | Task 1 (`theme.ts`, `index.html`), Task 2 (`@custom-variant dark`) |
| §5.3 The switch on Has köp | Task 1 |
| §6 Texts | Task 1 |
| §8 Testing | Task 1 (`theme_test.ts`), Final verification |

## Changes made during review

- **Task 2:** the implementer missed the `.btn-primary` replacement (the controller's file check caught it, fix 25ed78b). The product owner accepted the pure black photo viewer and `black/50` sheet backdrop in light mode too.
- **Final review:** no code changes were needed. The spec text was aligned with what was built:
  - the phone button letter-spacing and the position of the "See your shop page" link;
  - the admin bar hiding its label and language switch on phones;
  - `.chip-on` using `white`, and Home's `border-white` frame;
  - the light browser-bar color;
  - the button-group switch;
  - `color-scheme`.
- **Left for later**, triaged as fine:
  - no cross-tab theme sync;
  - the inline script's global `var`;
  - the Auto meta restore keys off the `media` string;
  - `SignOutButton` lives in `components/admin/`;
  - `leading-tight` also applies at md;
  - the small "See your shop page" link;
  - the description reads after the buttons for screen readers at md;
  - the garnet focus ring on the black photo viewer is about 2.3:1;
  - out-of-window calendar days are about 3.2:1 in dark;
  - placeholders are about 3.3:1;
  - "GELIN" on Home washes out over white photo areas in dark.
- **Follow-up:** `public/manifest.json` `background_color` is `#ffffff`, so an installed app shows a white splash on dark devices.

