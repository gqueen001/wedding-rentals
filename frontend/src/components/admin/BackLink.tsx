import { A } from "@solidjs/router";
import { t } from "../../i18n/i18n.ts";
import { ChevronLeftIcon } from "../icons.tsx";

/** "‹ Back" at the top of an editing page, as a small bordered button; computers only (phones use their own back). */
export default function BackLink(props: { href: string }) {
  return (
    <A href={props.href} class="btn btn-quiet hidden md:inline-flex">
      <ChevronLeftIcon class="h-4 w-4" />
      {t("common.back")}
    </A>
  );
}
