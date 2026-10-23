import { createSignal, Show } from "solid-js";
import { t } from "../i18n/i18n.ts";
import { ShareIcon } from "./icons.tsx";

/** Native share sheet on phones; copies the link elsewhere. `round` is the icon-only button over a photo. */
export default function ShareButton(props: { title: string; round?: boolean }) {
  const [copied, setCopied] = createSignal(false);

  async function share() {
    const url = location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: props.title, url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        // share failed for another reason: fall back to copying
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      prompt(t("dress.share"), url);
    }
  }

  return (
    <span class="inline-flex items-center gap-3">
      <Show
        when={props.round}
        fallback={
          <button type="button" class="btn btn-outline" onClick={() => void share()}>
            <ShareIcon />
            {t("dress.share")}
          </button>
        }
      >
        <button
          type="button"
          class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink hover:bg-white"
          aria-label={t("dress.share")}
          onClick={() => void share()}
        >
          <ShareIcon />
        </button>
      </Show>
      <span role="status" class="text-sm text-silver-ink" classList={{ "sr-only": props.round }}>
        {copied() ? t("dress.link_copied") : ""}
      </span>
    </span>
  );
}
