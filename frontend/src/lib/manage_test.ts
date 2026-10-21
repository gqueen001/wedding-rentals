import { assertEquals } from "@std/assert";
import { createApi } from "./api.ts";
import { adminManage, ownerManage } from "./manage.ts";
import type { Uploader } from "./upload.ts";

function setup() {
  const urls: string[] = [];
  const fetchFn = ((input: RequestInfo | URL) => {
    urls.push(String(input));
    return Promise.resolve(new Response(JSON.stringify({ items: [] }), { status: 200 }));
  }) as typeof fetch;
  const api = createApi({ fetch: fetchFn, token: () => "tok", onUnauthorized: () => {} });
  const upload = (() => Promise.reject(new Error("unused"))) as Uploader;
  return { api, upload, urls };
}

Deno.test("the admin editors reach /api/admin and link inside /admin", async () => {
  const { api, upload, urls } = setup();
  const m = adminManage(api, upload);
  await m.calls.listings({ shopId: 3 });
  await m.calls.busyDays(7);
  await m.shops?.();
  assertEquals(urls, ["/api/admin/items?shop_id=3", "/api/admin/items/7/busy-days", "/api/admin/shops"]);
  assertEquals(m.upload, upload);
  assertEquals(
    [m.listingsHref(), m.listingsHref(3), m.newListingHref(3), m.dressHref(7), m.newDressHref(3)],
    ["/admin/listings", "/admin/listings?shop_id=3", "/admin/listings/new?shop_id=3", "/admin/dresses/7", "/admin/dresses/new?shop_id=3"],
  );
  assertEquals(
    [m.itemHref(8), m.newItemHref("cars"), m.newItemHref("national-clothes", 3)],
    ["/admin/items/8", "/admin/items/new?category=cars", "/admin/items/new?category=national-clothes&shop_id=3"],
  );
});

Deno.test("the owner editors reach /api/shop, link inside /shop and never choose a shop", async () => {
  const { api, upload, urls } = setup();
  const m = ownerManage(api, upload);
  await m.calls.listings();
  await m.calls.busyDays(7);
  assertEquals(urls, ["/api/shop/items", "/api/shop/items/7/busy-days"]);
  assertEquals(
    [m.listingsHref(3), m.newListingHref(3), m.dressHref(7), m.newDressHref(3), m.itemHref(8), m.newItemHref("tents", 3)],
    ["/shop", "/shop/listings/new", "/shop/dresses/7", "/shop/dresses/new", "/shop/items/8", "/shop/items/new?category=tents"],
  );
  assertEquals(m.shops, undefined);
});
