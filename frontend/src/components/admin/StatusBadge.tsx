import { t } from "../../i18n/i18n.ts";

export default function StatusBadge(props: { published: boolean }) {
  return (
    <span
      class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold"
      classList={{ "bg-blush text-garnet-deep": props.published, "bg-veil text-silver-ink": !props.published }}
    >
      {props.published ? t("admin.published") : t("admin.draft")}
    </span>
  );
}
