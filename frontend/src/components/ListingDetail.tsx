import { type JSX, Show } from "solid-js";
import { t } from "../i18n/i18n.ts";
import { httpsUrl, telHref } from "../lib/format.ts";
import type { Attributes, Image, ShopCard } from "../lib/types.ts";
import Availability from "./Availability.tsx";
import { FavoriteButton, FavoriteIconButton } from "./FavoriteButton.tsx";
import Gallery from "./Gallery.tsx";
import { InstagramIcon, PhoneIcon, TikTokIcon } from "./icons.tsx";
import { priceText } from "./price.ts";
import ShareButton from "./ShareButton.tsx";
import ShopCardSection from "./ShopCard.tsx";

export interface DetailListing {
  id: number;
  title: string;
  price_manat: number;
  price_is_from: boolean;
  attributes?: Attributes;
  description: string | null;
  images: Image[];
  shop: ShopCard;
}

/**
 * The dress and item page body. On phones the photo fills the width with share and heart buttons
 * on it (no Back: phones use their own), and Call (plus Instagram and TikTok icons) stays in view just above the bottom bar.
 * On wide screens the info and the calendar sit beside the photo, and the shop runs under both as one row.
 */
export default function ListingDetail(props: {
  listing: DetailListing;
  /** The small label above the title, e.g. "Dresses · Ak Gelin". */
  kicker: string;
  /** The heading above the description, e.g. "About this dress". */
  about: string;
  details: JSX.Element;
}) {
  const l = () => props.listing;
  return (
    <>
      <article class="pt-0 md:pt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-x-12">
        <div class="relative">
          <Gallery images={l().images} title={l().title} />
          <div class="pointer-events-none absolute inset-x-0 top-3 flex justify-end sm:px-3 md:hidden">
            <span class="pointer-events-auto flex gap-2">
              <ShareButton title={l().title} round />
              <FavoriteIconButton id={l().id} />
            </span>
          </div>
        </div>
        <div class="mt-6 lg:mt-0">
          <p class="label">{props.kicker}</p>
          <h1 class="mt-2 break-words text-5xl sm:text-6xl">{l().title}</h1>
          <p class="mt-3 font-label text-xl tracking-[0.06em] text-garnet">{priceText(l())}</p>
          <div class="mt-5 hidden flex-wrap items-center gap-3 md:flex">
            <FavoriteButton id={l().id} />
            <ShareButton title={l().title} />
          </div>

          <div class="mt-8">{props.details}</div>

          <Show when={l().description}>
            {(text) => (
              <section class="mt-8">
                <h2 class="label">{props.about}</h2>
                <p class="mt-2 max-w-prose whitespace-pre-line">{text()}</p>
              </section>
            )}
          </Show>

          <div class="mt-10">
            <Availability listingId={l().id} />
          </div>
        </div>

        <div class="mt-10 lg:col-span-2">
          <ShopCardSection shop={l().shop} hideCallOnPhones wide />
        </div>
      </article>

      {/* Phones: always one tap from calling the shop. The spacer keeps the end of the page visible. */}
      <div class="h-16 md:hidden" aria-hidden="true" />
      <div class="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 flex gap-2 border-t border-line bg-white px-4 py-2 md:hidden">
        <a href={telHref(l().shop.phone)} class="btn btn-primary flex-1">
          <PhoneIcon />
          {t("contact.call")}
        </a>
        <Show when={httpsUrl(l().shop.instagram_url)}>
          {(url) => (
            <a
              href={url()}
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-outline px-3"
              aria-label={t("dress.instagram")}
            >
              <InstagramIcon />
            </a>
          )}
        </Show>
        <Show when={httpsUrl(l().shop.tiktok_url)}>
          {(url) => (
            <a
              href={url()}
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-outline px-3"
              aria-label={t("dress.tiktok")}
            >
              <TikTokIcon />
            </a>
          )}
        </Show>
      </div>
    </>
  );
}
