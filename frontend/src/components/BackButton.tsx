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
