import { A } from "@solidjs/router";
import { createResource, For, Match, Show, Switch } from "solid-js";
import ErrorState from "../../components/ErrorState.tsx";
import { PlusIcon } from "../../components/icons.tsx";
import ShopLogo from "../../components/ShopLogo.tsx";
import { i18n, t } from "../../i18n/i18n.ts";
import { useCities } from "../../lib/cities.ts";
import { ownerApi } from "../../lib/client.ts";
import { contactPhone } from "../../lib/contact.ts";
import { cityName } from "../../lib/format.ts";
import { useManage } from "../../lib/manage.ts";
import { usePageTitle } from "../../lib/title.ts";
import type { ListingSummary } from "../../lib/types.ts";

/** One square of the owner's photo grid: a link to the listing's editor, marked when it is a draft. */
function OwnerTile(props: { listing: ListingSummary; href: string }) {
  const l = () => props.listing;
  return (
    <li>
      <A
        href={props.href}
        class="group relative block aspect-[3/4] overflow-hidden bg-white"
        aria-label={l().is_published ? l().title : `${l().title} · ${t("admin.draft")}`}
      >
        <Show
          when={l().photo}
          fallback={
            <span class="flex h-full items-center justify-center p-2 text-center text-xs text-silver-ink">{l().title}</span>
          }
        >
          {(src) => (
            <img src={src()} alt="" loading="lazy" class="h-full w-full object-cover transition-opacity group-hover:opacity-90" />
          )}
        </Show>
        <Show when={!l().is_published}>
          <span aria-hidden="true" class="label absolute left-1.5 top-1.5 bg-white px-1.5 py-0.5 tracking-normal text-ink">
            {t("admin.draft")}
          </span>
        </Show>
      </A>
    </li>
  );
}

/** "My shop": the owner's shop as brides see it, with Edit profile, New listing and a grid of every listing. */
export default function MyShop() {
  usePageTitle(() => t("myshop.title"));
  const [me, { refetch }] = createResource(() => ownerApi.owner.me());
  const m = useManage();
  const [listings, listingList] = createResource(() => ownerApi.owner.listings());
  const cities = useCities();
  const shop = () => (me.state === "ready" ? me()?.shop : undefined);
  const city = () => {
    const c = cities().find((x) => x.id === shop()?.city_id);
    return c ? cityName(c, i18n.lang()) : "";
  };
  const href = (l: ListingSummary) => (l.category === "dresses" ? m.dressHref(l.id) : m.itemHref(l.id));

  return (
    <Switch>
      <Match when={me.error}>
        <ErrorState error={me.error} onRetry={() => void refetch()} />
      </Match>
      <Match when={!shop()}>
        <p class="text-silver-ink">{t("common.loading")}</p>
      </Match>
      <Match when={shop()}>
        {(s) => (
          <div>
            <header class="flex flex-col gap-6 sm:flex-row sm:items-center">
              <ShopLogo url={s().logo?.small ?? null} name={s().name} size="xl" />
              <div class="min-w-0 flex-1">
                <p class="label">{[city(), s().address].filter(Boolean).join(" · ")}</p>
                <h1 class="mt-2 break-words text-5xl sm:text-6xl">{s().name}</h1>
                <Show when={s().description}>
                  {(text) => <p class="mt-4 max-w-prose whitespace-pre-line">{text()}</p>}
                </Show>
                <div class="mt-6 flex flex-wrap items-center gap-3">
                  <A href="/shop/profile" class="btn btn-outline">{t("myshop.edit_profile")}</A>
                  <A href={m.newListingHref()} class="btn btn-primary">
                    <PlusIcon />
                    {t("admin.new_listing")}
                  </A>
                  <Show when={s().is_published}>
                    <A href={`/shops/${s().slug}`} class="label border-b border-ink pb-0.5 text-ink">
                      {t("myshop.view_page")}
                    </A>
                  </Show>
                </div>
              </div>
            </header>

            <Show when={!s().is_published}>
              <p class="mt-6 max-w-2xl rounded-lg bg-blush p-4 text-garnet-deep">
                {t("myshop.hidden")}
                <Show when={contactPhone()}>
                  {(p) => (
                    <>
                      {" "}
                      <a href={`tel:${p().replace(/\s/g, "")}`} class="font-semibold text-garnet">
                        {p()}
                      </a>
                    </>
                  )}
                </Show>
              </p>
            </Show>

            <section class="mt-10" aria-labelledby="my-listings-title">
              <h2 id="my-listings-title" class="label border-t border-line pt-6">{t("myshop.dresses")}</h2>
              <div class="mt-4">
                <Switch>
                  <Match when={listings.error}>
                    <ErrorState error={listings.error} onRetry={() => void listingList.refetch()} />
                  </Match>
                  <Match when={!listings()}>
                    <p class="text-silver-ink">{t("common.loading")}</p>
                  </Match>
                  <Match when={listings()?.length === 0}>
                    <p class="max-w-2xl rounded-lg bg-white p-5 text-silver-ink">{t("myshop.no_dresses")}</p>
                  </Match>
                  <Match when={listings()}>
                    {(list) => (
                      <ul class="grid grid-cols-3 gap-1 md:grid-cols-4 md:gap-2">
                        <For each={list()}>{(l) => <OwnerTile listing={l} href={href(l)} />}</For>
                      </ul>
                    )}
                  </Match>
                </Switch>
              </div>
            </section>
          </div>
        )}
      </Match>
    </Switch>
  );
}
