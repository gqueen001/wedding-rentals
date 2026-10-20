import { Show } from "solid-js";
import { t, tr } from "../i18n/i18n.ts";
import { errorMessage } from "../lib/errors.ts";

/** A friendly, translated failure message with a retry button: never a blank page. */
export default function ErrorState(props: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" class="py-12">
      <h2 class="text-2xl">{t("error.title")}</h2>
      <p class="mt-2 max-w-prose text-silver-ink">{errorMessage(props.error, tr)}</p>
      <Show when={props.onRetry}>
        <button type="button" class="btn btn-primary mt-6" onClick={() => props.onRetry?.()}>
          {t("common.retry")}
        </button>
      </Show>
    </div>
  );
}
