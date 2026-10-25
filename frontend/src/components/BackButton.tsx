import { useNavigate } from "@solidjs/router";
import { t } from "../i18n/i18n.ts";
import { backTracker } from "../lib/history.ts";
import { ChevronLeftIcon } from "./icons.tsx";

/**
 * "‹ Back" at the top of every public page but Home, and of My shop, on computers only: the previous
 * page on this site, else Home. class sets the spacing around it (default: space above).
 */
export default function BackButton(props: { class?: string }) {
  const navigate = useNavigate();
  return (
    <div class={`hidden md:block ${props.class ?? "pt-6"}`}>
      <button type="button" class="btn btn-quiet" onClick={() => (backTracker.canGoBack() ? history.back() : navigate("/"))}>
        <ChevronLeftIcon class="h-4 w-4" />
        {t("common.back")}
      </button>
    </div>
  );
}
