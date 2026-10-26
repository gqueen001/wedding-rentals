import { createSignal, For, type JSX, Show } from "solid-js";
import { t } from "../i18n/i18n.ts";
import { install } from "../lib/install.ts";
import { CloseIcon, ShareIcon } from "./icons.tsx";
import Sheet from "./Sheet.tsx";

/**
 * A button that installs the site as an app: the browser's own prompt where there is one, or
 * the three Share-menu steps on iPhone. Renders nothing once installed or where it cannot work.
 */
export function InstallButton(props: { class: string; children: JSX.Element }) {
  const [steps, setSteps] = createSignal(false);
  const start = () => (install.mode() === "prompt" ? void install.prompt() : setSteps(true));
  return (
    <Show when={install.mode() !== "none"}>
      <button type="button" class={props.class} onClick={start}>{props.children}</button>
      <Sheet
        open={steps()}
        title={t("install.title")}
        onClose={() => setSteps(false)}
        footer={<button type="button" class="btn btn-primary flex-1" onClick={() => setSteps(false)}>{t("common.close")}</button>}
      >
        <p class="text-silver-ink">{t("install.ios_lead")}</p>
        <ol class="space-y-4">
          <For each={["install.ios_step1", "install.ios_step2", "install.ios_step3"] as const}>
            {(key, i) => (
              <li class="flex items-start gap-3">
                <span class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-garnet-fill text-sm text-on-fill">
                  {i() + 1}
                </span>
                <span class="pt-0.5">
                  {t(key)}
                  <Show when={i() === 0}>
                    <ShareIcon class="ml-1.5 inline h-5 w-5 align-text-bottom text-garnet" />
                  </Show>
                </span>
              </li>
            )}
          </For>
        </ol>
      </Sheet>
    </Show>
  );
}

/** Home's small bar for phones that can install the app; once closed it stays closed. */
export function InstallBar() {
  return (
    <Show when={install.mode() !== "none" && !install.dismissed()}>
      <div class="mx-auto mt-6 flex max-w-md items-center gap-3 rounded-lg border border-line p-3 md:hidden">
        <img src="/icons/icon-192.png" alt="" class="h-10 w-10 shrink-0 rounded-lg" />
        <p class="min-w-0 flex-1 text-sm leading-snug">{t("install.bar")}</p>
        <InstallButton class="btn btn-primary shrink-0 px-4">{t("install.button")}</InstallButton>
        <button type="button" class="btn-icon -mr-1 shrink-0 text-silver-ink" aria-label={t("common.close")} onClick={() => install.dismiss()}>
          <CloseIcon class="h-5 w-5" />
        </button>
      </div>
    </Show>
  );
}
