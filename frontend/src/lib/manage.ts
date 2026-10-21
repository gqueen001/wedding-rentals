import { createContext, useContext } from "solid-js";
import type { Api, ManageCalls } from "./api.ts";
import type { AdminShop } from "./types.ts";
import type { Uploader } from "./upload.ts";

/**
 * What the shared listing, photo and calendar editors need: the admin panel provides one for
 * every shop, "My shop" provides one that only ever reaches the owner's own shop.
 */
export interface Manage {
  calls: ManageCalls;
  upload: Uploader;
  /** The listing list to go back to, optionally for one shop. */
  listingsHref: (shopId?: number) => string;
  /** The "New listing" page that asks for the category. */
  newListingHref: (shopId?: number) => string;
  /** The editor page of one dress, or of a new one. */
  dressHref: (id: number) => string;
  newDressHref: (shopId?: number) => string;
  /** The editor page of one non-dress item, or of a new one in a category. */
  itemHref: (id: number) => string;
  newItemHref: (category: string, shopId?: number) => string;
  /** Admins choose a listing's shop from this list; an owner's listings always go to their own shop. */
  shops?: () => Promise<AdminShop[]>;
}

export const ManageContext = createContext<Manage>();

export function useManage(): Manage {
  const m = useContext(ManageContext);
  if (!m) throw new Error("useManage outside a ManageContext provider");
  return m;
}

/** path, with ?shop_id= when a shop is given. */
const withShop = (path: string, shopId?: number) => (shopId ? `${path}?shop_id=${shopId}` : path);

/** The admin panel: every shop, under /admin. */
export function adminManage(api: Api, upload: Uploader): Manage {
  return {
    calls: api.admin,
    upload,
    listingsHref: (shopId) => withShop("/admin/listings", shopId),
    newListingHref: (shopId) => withShop("/admin/listings/new", shopId),
    dressHref: (id) => `/admin/dresses/${id}`,
    newDressHref: (shopId) => withShop("/admin/dresses/new", shopId),
    itemHref: (id) => `/admin/items/${id}`,
    newItemHref: (category, shopId) =>
      `/admin/items/new?category=${encodeURIComponent(category)}${shopId ? `&shop_id=${shopId}` : ""}`,
    shops: () => api.admin.shops(),
  };
}

/** "My shop": the signed-in owner's own shop, under /shop. */
export function ownerManage(api: Api, upload: Uploader): Manage {
  return {
    calls: api.owner,
    upload,
    listingsHref: () => "/shop",
    newListingHref: () => "/shop/listings/new",
    dressHref: (id) => `/shop/dresses/${id}`,
    newDressHref: () => "/shop/dresses/new",
    itemHref: (id) => `/shop/items/${id}`,
    newItemHref: (category) => `/shop/items/new?category=${encodeURIComponent(category)}`,
  };
}
