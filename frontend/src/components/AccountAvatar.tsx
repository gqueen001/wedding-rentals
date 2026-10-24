import { A } from "@solidjs/router";
import { createResource, Match, Switch } from "solid-js";
import { t } from "../i18n/i18n.ts";
import { avatarLook } from "../lib/avatar.ts";
import { ownerProbeApi } from "../lib/client.ts";
import { shopAuth } from "../lib/shopAuth.ts";
import { UserIcon } from "./icons.tsx";

/**
 * The account circle at the end of the top bar. A signed-in shop owner sees their salon's logo
 * (or its first letter) and goes to My shop; everyone else sees a person icon and goes to sign in.
 */
export default function AccountAvatar() {
  // Loaded each time the public pages mount, so a new logo or name shows after editing them on /shop.
  // A failed request just leaves the person icon; an expired session is dropped without a redirect.
  const [me] = createResource(shopAuth.token, () => ownerProbeApi.owner.me().catch(() => null));
  const shop = () => (me.state === "ready" ? me()?.shop ?? null : null);
  const look = () => avatarLook(shopAuth.token() !== null, shop());
  const label = () => {
    if (look() === "signed_out") return t("admin.sign_in");
    const s = shop();
    return s ? `${t("myshop.title")}: ${s.name}` : t("myshop.title");
  };
  return (
    <A href={look() === "signed_out" ? "/shop/login" : "/shop"} class="btn-icon shrink-0" aria-label={label()}>
      <span
        aria-hidden="true"
        class="flex h-[34px] w-[34px] items-center justify-center overflow-hidden rounded-full"
        classList={{
          "border border-silver text-ink": look() === "signed_out",
          "border-2 border-garnet text-ink": look() === "loading" || look() === "logo",
          "bg-garnet text-white": look() === "letter",
        }}
      >
        <Switch fallback={<UserIcon class="h-5 w-5" />}>
          <Match when={look() === "logo" && shop()?.logo}>
            {(logo) => <img src={logo().small} alt="" class="h-full w-full object-cover" />}
          </Match>
          <Match when={look() === "letter" && shop()}>
            {(s) => <span class="font-label text-base leading-none">{s().name.trim().charAt(0).toLocaleUpperCase()}</span>}
          </Match>
        </Switch>
      </span>
    </A>
  );
}
