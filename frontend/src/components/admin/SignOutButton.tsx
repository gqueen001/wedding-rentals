import { t } from "../../i18n/i18n.ts";
import { LogoutIcon } from "../icons.tsx";

/** "Sign out" in the admin and My shop top bars: a small icon on phones, the word from 768px up. */
export default function SignOutButton(props: { onClick: () => void }) {
  return (
    <button type="button" class="btn btn-quiet w-11 px-0 md:w-auto md:px-3" aria-label={t("admin.sign_out")} onClick={props.onClick}>
      <LogoutIcon class="h-4 w-4 md:hidden" />
      <span class="hidden md:inline">{t("admin.sign_out")}</span>
    </button>
  );
}
