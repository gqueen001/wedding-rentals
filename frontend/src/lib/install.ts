import { createSignal } from "solid-js";
import { type KV, safeKV } from "./storage.ts";

/**
 * How this device can install the site as an app: the browser's own install prompt (Android, and
 * Chrome or Edge on computers), the steps for Safari's Share menu (iPhone and iPad, which have no
 * prompt), or not at all (already installed, or a browser that cannot install).
 */
export type InstallMode = "prompt" | "ios" | "none";

export function installMode(d: { standalone: boolean; ios: boolean; canPrompt: boolean }): InstallMode {
  if (d.standalone) return "none";
  if (d.canPrompt) return "prompt";
  return d.ios ? "ios" : "none";
}

/** iPhones and iPads, including iPadOS, which reports itself as a Mac but has a touch screen. */
export function isIOS(userAgent: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/** Set when the Home install bar is closed, so it stays closed on this device. */
export const INSTALL_DISMISSED_KEY = "wr.install_dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function createInstall(kv: KV, env: {
  standalone: () => boolean;
  ios: boolean;
  listen: (type: string, fn: (e: Event) => void) => void;
}) {
  const [deferred, setDeferred] = createSignal<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = createSignal(false);
  const [dismissed, setDismissed] = createSignal(kv.get(INSTALL_DISMISSED_KEY) === "1");
  // The browser offers the prompt once, early; keep it for the button instead of its own mini-bar.
  env.listen("beforeinstallprompt", (e) => {
    e.preventDefault();
    setDeferred(e as BeforeInstallPromptEvent);
  });
  env.listen("appinstalled", () => {
    setInstalled(true);
    setDeferred(null);
  });
  return {
    mode: (): InstallMode =>
      installMode({ standalone: installed() || env.standalone(), ios: env.ios, canPrompt: deferred() !== null }),
    /** Opens the browser's install prompt; true when the person installed. */
    async prompt(): Promise<boolean> {
      const e = deferred();
      if (!e) return false;
      setDeferred(null); // a prompt can be shown only once
      await e.prompt();
      return (await e.userChoice).outcome === "accepted";
    },
    dismissed,
    dismiss() {
      kv.set(INSTALL_DISMISSED_KEY, "1");
      setDismissed(true);
    },
  };
}

const browser = typeof document !== "undefined";

export const install = createInstall(safeKV(), {
  standalone: () =>
    browser && (matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true),
  ios: browser && isIOS(navigator.userAgent, navigator.maxTouchPoints),
  listen: (type, fn) => browser && globalThis.addEventListener(type, fn),
});

/** The service worker only shows an offline page when a page cannot load (public/sw.js). */
export function registerServiceWorker() {
  if (!browser || !("serviceWorker" in navigator)) return;
  globalThis.addEventListener("load", () => void navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
