import { A } from "@solidjs/router";
import { Show } from "solid-js";
import { i18n, t } from "../i18n/i18n.ts";
import { cityName, httpsUrl, telHref } from "../lib/format.ts";
import type { ShopCard } from "../lib/types.ts";
import { InstagramIcon, PhoneIcon, TikTokIcon } from "./icons.tsx";
import ShopLogo from "./ShopLogo.tsx";

/** Compact contact buttons on phones (small text, no icons, wrapping); today's size from md. */
const COMPACT = "min-h-8 px-1 text-center text-[10px] leading-tight tracking-[0.04em] md:min-h-12 md:px-5 md:tracking-[0.18em]";

/**
 * Big tap targets for the three ways a bride contacts a shop. With hideCallOnPhones the Call button
 * shows from 768px up only, for pages that already keep a Call bar on screen on phones. With compact
 * (the shop page header) they are small on phones, and Call reads just "Jaň et" there.
 */
export function ContactButtons(props: {
  shop: { phone: string; instagram_url: string | null; tiktok_url: string | null };
  hideCallOnPhones?: boolean;
  compact?: boolean;
}) {
  // A class replaces the icons' default size, so the compact one restates it.
  const icon = () => (props.compact ? "hidden h-5 w-5 shrink-0 md:block" : undefined);
  const social = () => (props.compact ? `${COMPACT} md:text-xs` : "min-h-12");
  return (
    <div class={props.compact ? "grid grid-cols-2 gap-1.5 md:grid-cols-3 md:gap-3" : "grid gap-3 sm:grid-cols-3"}>
      <a
        href={telHref(props.shop.phone)}
        class={`btn btn-primary ${props.compact ? `${COMPACT} col-span-2 md:col-span-3 md:text-base` : "min-h-12 text-base sm:col-span-3"}`}
        classList={{ "hidden md:inline-flex": props.hideCallOnPhones }}
        aria-label={props.compact ? t("dress.call", { phone: props.shop.phone }) : undefined}
      >
        <PhoneIcon class={icon()} />
        <Show when={props.compact} fallback={t("dress.call", { phone: props.shop.phone })}>
          <span class="md:hidden">{t("contact.call")}</span>
          <span class="hidden md:inline">{t("dress.call", { phone: props.shop.phone })}</span>
        </Show>
      </a>
      <Show when={httpsUrl(props.shop.instagram_url)}>
        {(url) => (
          <a href={url()} target="_blank" rel="noopener noreferrer" class={`btn btn-outline ${social()}`}>
            <InstagramIcon class={icon()} />
            {t("dress.instagram")}
          </a>
        )}
      </Show>
      <Show when={httpsUrl(props.shop.tiktok_url)}>
        {(url) => (
          <a href={url()} target="_blank" rel="noopener noreferrer" class={`btn btn-outline ${social()}`}>
            <TikTokIcon class={icon()} />
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
