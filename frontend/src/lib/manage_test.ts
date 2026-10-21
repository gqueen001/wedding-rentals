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
  await m.calls.dresses(3);
  await m.calls.busyDays(7);
  await m.shops?.();
  assertEquals(urls, ["/api/admin/dresses?shop_id=3", "/api/admin/dresses/7/busy-days", "/api/admin/shops"]);
  assertEquals(m.upload, upload);
  assertEquals([m.dressesHref(), m.dressesHref(3), m.dressHref(7)], ["/admin/dresses", "/admin/dresses?shop_id=3", "/admin/dresses/7"]);
});

Deno.test("the owner editors reach /api/shop, link inside /shop and never choose a shop", async () => {
  const { api, upload, urls } = setup();
  const m = ownerManage(api, upload);
  await m.calls.dresses();
  await m.calls.busyDays(7);
  assertEquals(urls, ["/api/shop/dresses", "/api/shop/dresses/7/busy-days"]);
  assertEquals([m.dressesHref(), m.dressesHref(3), m.dressHref(7)], ["/shop", "/shop", "/shop/dresses/7"]);
  assertEquals(m.shops, undefined);
});
