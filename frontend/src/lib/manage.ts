import { createContext, useContext } from "solid-js";
import type { Api, ManageCalls } from "./api.ts";
import type { AdminShop } from "./types.ts";
import type { Uploader } from "./upload.ts";

/**
 * What the shared dress, photo and calendar editors need: the admin panel provides one for
 * every shop, "My shop" provides one that only ever reaches the owner's own shop.
 */
export interface Manage {
  calls: ManageCalls;
  upload: Uploader;
  /** The dress list to go back to, optionally for one shop. */
  dressesHref: (shopId?: number) => string;
  /** The editor page of one dress. */
  dressHref: (id: number) => string;
  /** Admins choose a dress's shop from this list; an owner's dresses always go to their own shop. */
  shops?: () => Promise<AdminShop[]>;
}

export const ManageContext = createContext<Manage>();

export function useManage(): Manage {
  const m = useContext(ManageContext);
  if (!m) throw new Error("useManage outside a ManageContext provider");
  return m;
}

/** The admin panel: every shop, under /admin. */
export function adminManage(api: Api, upload: Uploader): Manage {
  return {
    calls: api.admin,
    upload,
    dressesHref: (shopId) => (shopId ? `/admin/dresses?shop_id=${shopId}` : "/admin/dresses"),
    dressHref: (id) => `/admin/dresses/${id}`,
    shops: () => api.admin.shops(),
  };
}

/** "My shop": the signed-in owner's own shop, under /shop. */
export function ownerManage(api: Api, upload: Uploader): Manage {
  return {
    calls: api.owner,
    upload,
    dressesHref: () => "/shop",
    dressHref: (id) => `/shop/dresses/${id}`,
  };
}
