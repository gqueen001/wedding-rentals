import { A } from "@solidjs/router";
import { Show } from "solid-js";
import { i18n, t } from "../i18n/i18n.ts";
import { cityName, httpsUrl, telHref } from "../lib/format.ts";
import type { ShopCard } from "../lib/types.ts";
import { InstagramIcon, PhoneIcon, TikTokIcon } from "./icons.tsx";
import ShopLogo from "./ShopLogo.tsx";

/**
 * Big tap targets for the three ways a bride contacts a shop. With hideCallOnPhones the Call button
 * shows from 768px up only, for pages that already keep a Call bar on screen on phones.
 */
export function ContactButtons(props: {
  shop: { phone: string; instagram_url: string | null; tiktok_url: string | null };
  hideCallOnPhones?: boolean;
}) {
  return (
    <div class="grid gap-3 sm:grid-cols-3">
      <a
        href={telHref(props.shop.phone)}
        class="btn btn-primary min-h-12 text-base sm:col-span-3"
        classList={{ "hidden md:inline-flex": props.hideCallOnPhones }}
      >
        <PhoneIcon />
        {t("dress.call", { phone: props.shop.phone })}
      </a>
      <Show when={httpsUrl(props.shop.instagram_url)}>
        {(url) => (
          <a href={url()} target="_blank" rel="noopener noreferrer" class="btn btn-outline min-h-12">
            <InstagramIcon />
            {t("dress.instagram")}
          </a>
        )}
      </Show>
      <Show when={httpsUrl(props.shop.tiktok_url)}>
        {(url) => (
          <a href={url()} target="_blank" rel="noopener noreferrer" class="btn btn-outline min-h-12">
            <TikTokIcon />
            {t("dress.tiktok")}
          </a>
        )}
      </Show>
    </div>
  );
}

export default function ShopCardSection(props: { shop: ShopCard; hideCallOnPhones?: boolean }) {
  return (
    <section aria-labelledby="shop-card-title" class="border-t border-line pt-6">
      <p class="label">{t("dress.rent_from")}</p>
      <div class="mt-3 flex items-center gap-4">
        <ShopLogo url={props.shop.logo} name={props.shop.name} />
        <div class="min-w-0">
          <h2 id="shop-card-title" class="truncate text-4xl">
            <A href={`/shops/${props.shop.slug}`} class="hover:text-garnet">
              {props.shop.name}
            </A>
          </h2>
          <p class="label mt-1">{cityName(props.shop.city, i18n.lang())}</p>
        </div>
      </div>
      <div class="mt-5">
        <ContactButtons shop={props.shop} hideCallOnPhones={props.hideCallOnPhones} />
      </div>
      <dl class="mt-5 text-sm">
        <dt class="label">{t("dress.address")}</dt>
        <dd class="mt-0.5">{props.shop.address}</dd>
      </dl>
      <A
        href={`/shops/${props.shop.slug}`}
        class="label mt-5 inline-block border-b border-ink pb-0.5 text-ink"
      >
        {t("dress.shop_page", { shop: props.shop.name })}
      </A>
    </section>
  );
}
