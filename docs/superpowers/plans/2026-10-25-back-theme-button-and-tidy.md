# Back Button, Computer Theme Button and Small Tidy-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The product owner asked for these changes:
- Has köp on phones loses its Search and Favorites rows.
- Home's city dropdown loses its "Şäher" word.
- The computer Favorites link has no heart and a small count.
- The computer footer's button is short enough to fit.
- Computers get a Back button on every public page except Home.
- Computers get a theme button that cycles Auto → Light → Dark.

**Architecture:**
- **Theme button:** a pure `nextTheme` in `lib/theme.ts` drives a new `ThemeButton` in the computer menu. It shares the existing `theme` store with the More page.
- **Back button:** a `BackButton` in the app layout uses a new `backTracker` in `lib/history.ts`. The router stamps each history entry with its depth (`history.state._depth`), and the tracker remembers the depth this visit landed on. Back goes to the previous page only once you have moved on from there; otherwise it goes Home. The phone listing back button uses the same tracker.

**Tech Stack:** Solid 1.9, @solidjs/router and Tailwind 4, built and tested with Deno 2.4. There are no backend changes.

**Spec:** `docs/superpowers/specs/2026-10-25-back-theme-button-and-tidy-design.md`

## Global Constraints

- **Unchanged:**
  - the phone layout, apart from the More page;
  - the My shop and admin layouts and their Back links;
  - routes, the API and the data.
- **Back:**
  - The button shows from md, on every public page except `/`.
  - It uses `btn btn-quiet` with `ChevronLeftIcon` and `common.back`.
  - It goes to `history.back()` only when `backTracker.canGoBack()`; otherwise it goes to `/`.
- **The theme button:**
  - It cycles `auto → light → dark → auto` through `theme.set(nextTheme(theme.choice()))`.
  - Its `aria-label` and `title` read "<more.theme>: <theme.choice>".
  - Its icon is half-filled for Auto, a sun for Light and a moon for Dark.
- **Favorites count:** `text-[10px]` (the 10px minimum), raised, in garnet. The link's accessible name stays `nav.favorites_count`.
- **Text:** every user-visible string goes through `frontend/src/i18n/{tk,ru,en}.json`, with identical keys and placeholders, which a test enforces. The only new key is `footer.add_shop_short`.
- **Tools:** frontend tools run only through Deno, from `frontend/`: `deno task test`, `deno task check` and `deno task build`. Never run npm or Vite with Node.
- **Data:** never write to the `wedding_dev` database.
- **Commits:** every commit message ends with the `Co-Authored-By:` trailer line the controller gives you.

## How to read the steps

- **Full files:** a path in backticks on its own line, directly followed by a code block, gives the **whole file**. Create or overwrite it with exactly that content. From the repository root you can extract it with:
  `python3 -I .superpowers/sdd/bt/block.py <brief> <path> > <path>`
- **Replacements:** "In `path`, replace:" gives an exact text to find (it occurs once) and the text to put in its place. Apply a file's replacements in the order given.
- **Appends:** "Append to `path`:" gives text to add at the very end of the file.
- **i18n entries:** under **en.json**, **ru.json** and **tk.json**, a block of `"key": "value"` lines goes at the end of that file. Add a comma to the file's current last entry, and keep the closing `}` last.

---

### Task 1: Tidy-ups and the computer theme button

**Files:**
- Create: `frontend/src/components/ThemeButton.tsx`
- Modify:
  - `frontend/src/lib/theme.ts`
  - `frontend/src/lib/theme_test.ts`
  - `frontend/src/components/icons.tsx`
  - `frontend/src/components/Header.tsx`
  - `frontend/src/pages/More.tsx`
  - `frontend/src/pages/Home.tsx`

**Interfaces:**
- Produces:
  - `nextTheme(choice: ThemeChoice): ThemeChoice`;
  - `SunIcon`, `MoonIcon` and `ThemeAutoIcon`;
  - `ThemeButton` (default export, no props).

- [ ] **Step 1: Write the failing test**

In `frontend/src/lib/theme_test.ts`, replace:
```ts
import { createTheme, parseTheme, THEME_KEY, themeAttr } from "./theme.ts";
```
with:
```ts
import { createTheme, nextTheme, parseTheme, THEME_KEY, themeAttr } from "./theme.ts";
```

In `frontend/src/lib/theme_test.ts`, replace:
```ts
  assertEquals(createTheme(memoryKV({ [THEME_KEY]: "nonsense" })).choice(), "auto");
});

```
with:
```ts
  assertEquals(createTheme(memoryKV({ [THEME_KEY]: "nonsense" })).choice(), "auto");
});

Deno.test("nextTheme cycles auto, light, dark and back to auto", () => {
  assertEquals(nextTheme("auto"), "light");
  assertEquals(nextTheme("light"), "dark");
  assertEquals(nextTheme("dark"), "auto");
});


```

Run, from `frontend/`: `deno task test`
Expected: FAIL. `nextTheme` is not exported from `./theme.ts`.

- [ ] **Step 2: The cycle step**

In `frontend/src/lib/theme.ts`, replace:
```ts
export const THEME_COLOR = { light: "#8e1b2e", dark: "#1b1b1e" } as const;

```
with:
```ts
export const THEME_COLOR = { light: "#8e1b2e", dark: "#1b1b1e" } as const;

/** The choice after this one, for a button that cycles Auto → Light → Dark → Auto. */
export function nextTheme(choice: ThemeChoice): ThemeChoice {
  return THEMES[(THEMES.indexOf(choice) + 1) % THEMES.length];
}

```

Run, from `frontend/`: `deno task test`
Expected: PASS, including "nextTheme cycles auto, light, dark and back to auto".

- [ ] **Step 3: The icons and the theme button**

In `frontend/src/components/icons.tsx`, replace:
```tsx
    <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
  </Svg>
);

```
with:
```tsx
    <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
  </Svg>
);

export const SunIcon = (p: IconProps) => (
  <Svg class={p.class}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </Svg>
);

export const MoonIcon = (p: IconProps) => (
  <Svg class={p.class}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </Svg>
);

/** Auto theme: a circle, half filled. */
export const ThemeAutoIcon = (p: IconProps) => (
  <Svg class={p.class}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
  </Svg>
);

```

`frontend/src/components/ThemeButton.tsx`
```tsx
import { Match, Switch } from "solid-js";
import { t } from "../i18n/i18n.ts";
import { nextTheme, theme } from "../lib/theme.ts";
import { MoonIcon, SunIcon, ThemeAutoIcon } from "./icons.tsx";

/** The computer menu's theme switch: each click goes Auto → Light → Dark; the icon shows the choice. */
export default function ThemeButton() {
  const name = () => `${t("more.theme")}: ${t(`theme.${theme.choice()}`)}`;
  return (
    <button
      type="button"
      class="btn-icon text-silver-ink hover:text-ink"
      aria-label={name()}
      title={name()}
      onClick={() => theme.set(nextTheme(theme.choice()))}
    >
      <Switch fallback={<ThemeAutoIcon class="h-5 w-5" />}>
        <Match when={theme.choice() === "light"}>
          <SunIcon class="h-5 w-5" />
        </Match>
        <Match when={theme.choice() === "dark"}>
          <MoonIcon class="h-5 w-5" />
        </Match>
      </Switch>
    </button>
  );
}
```

- [ ] **Step 4: The computer menu: no heart, a small count, and the theme button**

In `frontend/src/components/Header.tsx`, replace:
```tsx
import { HeartIcon } from "./icons.tsx";
import LanguageSwitch from "./LanguageSwitch.tsx";
```
with:
```tsx
import LanguageSwitch from "./LanguageSwitch.tsx";
import ThemeButton from "./ThemeButton.tsx";
```

In `frontend/src/components/Header.tsx`, replace:
```tsx
            <HeartIcon filled={count() > 0} class="h-4 w-4 text-garnet" />
            {t("tab.favorites")}
            <Show when={count() > 0}>
              <span class="tabular-nums text-garnet">{count()}</span>
            </Show>
          </A>
          <LanguageSwitch />
```
with:
```tsx
            {t("tab.favorites")}
            <Show when={count() > 0}>
              <span class="-ml-1 align-super text-[10px] leading-none tracking-normal tabular-nums text-garnet">{count()}</span>
            </Show>
          </A>
          <LanguageSwitch />
          <ThemeButton />
```

- [ ] **Step 5: More without Search and Favorites; Home's dropdown without its word**

The dropdown keeps its name for screen readers through `aria-label`.

In `frontend/src/pages/More.tsx`, replace:
```tsx
/** The bottom bar's "More": language, theme, search, and the way in for shops. */
```
with:
```tsx
/** The bottom bar's "More": language, theme, and the way in for shops. */
```

In `frontend/src/pages/More.tsx`, replace:
```tsx

      <section class="mt-8" aria-labelledby="more-site">
        <h2 id="more-site" class="label">{t("app.name")}</h2>
        <div class="mt-2 border-t border-line">
          <LinkRow href="/search">{t("search.title")}</LinkRow>
          <LinkRow href="/favorites">{t("tab.favorites")}</LinkRow>
        </div>
      </section>

```
with:
```tsx

```

In `frontend/src/pages/Home.tsx`, replace:
```tsx
            <label class="flex flex-wrap items-center justify-center gap-3 text-sm">
              <span class="text-silver-ink">{t("home.city")}</span>
              <select
                class="field-input w-auto"
```
with:
```tsx
            <div class="flex justify-center">
              <select
                class="field-input w-auto"
                aria-label={t("home.city")}
```

In `frontend/src/pages/Home.tsx`, replace:
```tsx
            </label>
```
with:
```tsx
            </div>
```

- [ ] **Step 6: Check, test and build**

Run, from `frontend/`: `deno task check`, then `deno task test`, then `deno task build`.
Expected: no check errors, every test passes, and the build ends with `✓ built`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/theme.ts frontend/src/lib/theme_test.ts frontend/src/components/icons.tsx frontend/src/components/ThemeButton.tsx frontend/src/components/Header.tsx frontend/src/pages/More.tsx frontend/src/pages/Home.tsx
git commit -m "feat(frontend): a theme button in the computer menu; small tidy-ups on More, Home and Favorites"
```
(End the message with the trailer line the controller gives you.)

---

### Task 2: A Back button on computers, and a footer that fits

**Files:**
- Create: `frontend/src/components/BackButton.tsx`
- Modify:
  - `frontend/src/lib/history.ts`
  - `frontend/src/lib/history_test.ts`
  - `frontend/src/app/App.tsx`
  - `frontend/src/components/ListingDetail.tsx`
  - `frontend/src/i18n/{en,ru,tk}.json`

**Interfaces:**
- Produces:
  - `createBackTracker(): BackTracker`, with `markLanding(h?)` and `canGoBack(h?)`;
  - the app-wide `backTracker`;
  - `BackButton` (default export, no props);
  - the key `footer.add_shop_short`.

- [ ] **Step 1: Write the failing test**

In `frontend/src/lib/history_test.ts`, replace:
```ts
import { consumeTraversal, markTraversal } from "./history.ts";
```
with:
```ts
import { consumeTraversal, createBackTracker, markTraversal } from "./history.ts";
```

In `frontend/src/lib/history_test.ts`, replace:
```ts
  assertEquals(consumeTraversal(5000), false);
});

```
with:
```ts
  assertEquals(consumeTraversal(5000), false);
});

Deno.test("Back stays on the site only after moving on from the landing page", () => {
  const t = createBackTracker();
  const at = (depth: number | undefined) => ({ state: depth === undefined ? null : { _depth: depth } });
  assertEquals(t.canGoBack(at(3)), false); // nothing marked yet
  t.markLanding(at(1)); // opened in a tab that already had one page
  t.markLanding(at(5)); // later calls do not move the landing
  assertEquals(t.canGoBack(at(1)), false);
  assertEquals(t.canGoBack(at(2)), true);
  assertEquals(t.canGoBack(at(undefined)), false); // an entry the router has not stamped counts as depth 0
});

```

Run, from `frontend/`: `deno task test`
Expected: FAIL. `createBackTracker` is not exported from `./history.ts`.

- [ ] **Step 2: The back tracker**

The router stamps `history.state._depth`. The first entry this visit opened on is the landing, and Back stays on the site only after moving on from it. So a link opened in a new tab, or typed into a tab that had another page, goes Home instead of leaving the site.

In `frontend/src/lib/history.ts`, replace:
```ts
  win.addEventListener("popstate", () => markTraversal());
}

```
with:
```ts
  win.addEventListener("popstate", () => markTraversal());
}

/** The router stamps each history entry with its depth; the first entry this visit opened on is the landing. */
type HistoryLike = { state: unknown };
const depthOf = (h: HistoryLike): number => {
  const d = (h.state as { _depth?: unknown } | null)?._depth;
  return typeof d === "number" ? d : 0;
};

export interface BackTracker {
  /** Call once, when the app first mounts: the current entry is where this visit landed. */
  markLanding(h?: HistoryLike): void;
  /** True when Back would stay on this site: we have moved forward from the landing page. */
  canGoBack(h?: HistoryLike): boolean;
}

export function createBackTracker(): BackTracker {
  let landing: number | null = null;
  return {
    markLanding(h = window.history) {
      landing ??= depthOf(h);
    },
    canGoBack(h = window.history) {
      return landing !== null && depthOf(h) > landing;
    },
  };
}

export const backTracker = createBackTracker();

```

Run, from `frontend/`: `deno task test`
Expected: PASS, including "Back stays on the site only after moving on from the landing page".

- [ ] **Step 3: The Back button**

`frontend/src/components/BackButton.tsx`
```tsx
import { useNavigate } from "@solidjs/router";
import { t } from "../i18n/i18n.ts";
import { backTracker } from "../lib/history.ts";
import { ChevronLeftIcon } from "./icons.tsx";

/** "‹ Back" at the top of every public page but Home, on computers only: the previous page on this site, else Home. */
export default function BackButton() {
  const navigate = useNavigate();
  return (
    <div class="hidden pt-6 md:block">
      <button type="button" class="btn btn-quiet" onClick={() => (backTracker.canGoBack() ? history.back() : navigate("/"))}>
        <ChevronLeftIcon class="h-4 w-4" />
        {t("common.back")}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: The text for the short footer button**

**en.json**
```json
  "footer.add_shop_short": "Add your shop"
```

**ru.json**
```json
  "footer.add_shop_short": "Добавить салон"
```

**tk.json**
```json
  "footer.add_shop_short": "Salonyňyzy goşuň"
```

- [ ] **Step 5: The layout marks the landing, shows Back, and uses the short footer text**

In `frontend/src/app/App.tsx`, replace:
```tsx
import { createEffect, ErrorBoundary, type JSX, on, Show } from "solid-js";
```
with:
```tsx
import { createEffect, ErrorBoundary, type JSX, on, onMount, Show } from "solid-js";
import BackButton from "../components/BackButton.tsx";
```

In `frontend/src/app/App.tsx`, replace:
```tsx
import { focusMain, mainRef } from "../lib/dom.ts";

```
with:
```tsx
import { focusMain, mainRef } from "../lib/dom.ts";
import { backTracker } from "../lib/history.ts";

```

In `frontend/src/app/App.tsx`, replace:
```tsx
  const location = useLocation();
  // Not on first load, and not when only the search string changes.
```
with:
```tsx
  const location = useLocation();
  // The page this visit opened on: Back buttons only go back past it to stay on the site.
  onMount(() => backTracker.markLanding());
  // Not on first load, and not when only the search string changes.
```

In `frontend/src/app/App.tsx`, replace:
```tsx
      >
        <Guard>{props.children}</Guard>
```
with:
```tsx
      >
        <Show when={location.pathname !== "/"}>
          <BackButton />
        </Show>
        <Guard>{props.children}</Guard>
```

In `frontend/src/app/App.tsx`, replace:
```tsx
          <p class="label">{t("app.tagline")}</p>
          <A href="/shop/signup" class="btn btn-outline">{t("footer.add_shop")}</A>
```
with:
```tsx
          <p class="label whitespace-nowrap">{t("app.tagline")}</p>
          <A href="/shop/signup" class="btn btn-outline whitespace-nowrap">{t("footer.add_shop_short")}</A>
```

- [ ] **Step 6: The phone listing back button uses the same tracker**

In `frontend/src/components/ListingDetail.tsx`, replace:
```tsx
import { httpsUrl, telHref } from "../lib/format.ts";
import type { Attributes, Image, ShopCard } from "../lib/types.ts";
```
with:
```tsx
import { httpsUrl, telHref } from "../lib/format.ts";
import { backTracker } from "../lib/history.ts";
import type { Attributes, Image, ShopCard } from "../lib/types.ts";
```

In `frontend/src/components/ListingDetail.tsx`, replace:
```tsx
  const back = () => (history.length > 1 ? history.back() : navigate(props.backHref));
```
with:
```tsx
  const back = () => (backTracker.canGoBack() ? history.back() : navigate(props.backHref));
```

- [ ] **Step 7: Check, test and build**

Run, from `frontend/`: `deno task check`, then `deno task test`, then `deno task build`.
Expected: no check errors; every test passes, including the i18n parity test; the build ends with `✓ built`.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/history.ts frontend/src/lib/history_test.ts frontend/src/components/BackButton.tsx frontend/src/app/App.tsx frontend/src/components/ListingDetail.tsx frontend/src/i18n/en.json frontend/src/i18n/ru.json frontend/src/i18n/tk.json
git commit -m "feat(frontend): a Back button on computers that stays on the site; a short footer button"
```
(End the message with the trailer line the controller gives you.)

---

## Final verification (controller)

This runs in headless Chrome on the test database with demo data, in light and dark, tk, ru and en, at 320, 375, 768, 1024 and 1280px.

- **Layout:** no overflow and no errors.
- **Back button:**
  - It shows from md on every public page except Home.
  - From a page reached in-app, it goes back. Opened directly, it goes Home.
- **Footer:** the button reads the short text, and the tagline stays on one line.
- **Favorites link:** no heart, and a 10px count.
- **Home:** no "Şäher" word, and the dropdown is named.
- **More:** no Search or Favorites rows.
- **Theme button:** it cycles Auto → Light → Dark → Auto, and More shows the same choice.
- **Phone listing back:** it goes back from the list, and to the list when opened directly.
- **Contrast:** clean in both themes.
