import { assert, assertEquals } from "@std/assert";
import { createRoot } from "solid-js";
import { createInstall, INSTALL_DISMISSED_KEY, installMode, isIOS } from "./install.ts";
import { memoryKV } from "./storage.ts";

Deno.test("installMode: installed hides it, a prompt wins, iOS gets the steps", () => {
  assertEquals(installMode({ standalone: true, ios: true, canPrompt: true }), "none");
  assertEquals(installMode({ standalone: false, ios: false, canPrompt: true }), "prompt");
  assertEquals(installMode({ standalone: false, ios: true, canPrompt: false }), "ios");
  assertEquals(installMode({ standalone: false, ios: false, canPrompt: false }), "none");
});

Deno.test("isIOS: iPhone, iPad, and iPadOS posing as a Mac, but not a real Mac", () => {
  assert(isIOS("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", 5));
  assert(isIOS("Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)", 5));
  assert(isIOS("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5));
  assert(!isIOS("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0));
  assert(!isIOS("Mozilla/5.0 (Linux; Android 14)", 5));
});

Deno.test("createInstall keeps the browser's prompt, uses it once, and remembers a closed bar", async () => {
  const handlers: Record<string, (e: Event) => void> = {};
  const kv = memoryKV();
  await createRoot(async (dispose) => {
    const inst = createInstall(kv, { standalone: () => false, ios: false, listen: (t, fn) => (handlers[t] = fn) });
    assertEquals(inst.mode(), "none");
    let prevented = false, prompted = 0;
    const event = Object.assign(new Event("beforeinstallprompt"), {
      preventDefault: () => (prevented = true),
      prompt: () => (prompted++, Promise.resolve()),
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    });
    handlers.beforeinstallprompt(event);
    assert(prevented);
    assertEquals(inst.mode(), "prompt");
    assertEquals(await inst.prompt(), true);
    assertEquals(await inst.prompt(), false); // only once
    assertEquals(prompted, 1);
    handlers.appinstalled(new Event("appinstalled"));
    assertEquals(inst.mode(), "none");

    assertEquals(inst.dismissed(), false);
    inst.dismiss();
    assertEquals(kv.get(INSTALL_DISMISSED_KEY), "1");
    dispose();
  });
  const again = createRoot(() => createInstall(kv, { standalone: () => false, ios: true, listen: () => {} }));
  assertEquals(again.dismissed(), true);
  assertEquals(again.mode(), "ios");
});
