import { t } from "../i18n/i18n.ts";

export default function Home() {
  return <h1 class="pt-10 text-5xl">{t("home.title")}</h1>;
}
