import { assertEquals, assertInstanceOf, assertRejects } from "@std/assert";
import { ApiError, createApi } from "./api.ts";
import type { ShopInput } from "./types.ts";

interface Call {
  url: string;
  init: RequestInit;
}

function setup(handler: (url: string, init: RequestInit) => Response | Promise<Response>, token: string | null = "tok") {
  const calls: Call[] = [];
  let unauthorized = 0;
  const fetchFn = ((input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    return Promise.resolve(handler(url, init));
  }) as typeof fetch;
  const api = createApi({ fetch: fetchFn, token: () => token, onUnauthorized: () => unauthorized++ });
  return { api, calls, unauthorized: () => unauthorized };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const shopInput: ShopInput = {
  name: "Ak Gelin", city_id: 1, address: "Aşgabat", phone: "+99365000000", instagram_url: "",
  tiktok_url: "", description: "", is_published: true, aliases: [],
};

Deno.test("cities unwraps items and sends no token", async () => {
  const { api, calls } = setup(() => json(200, { items: [{ id: 1, slug: "ashgabat" }] }));
  const cities = await api.cities();
  assertEquals(cities.map((c) => c.slug), ["ashgabat"]);
  assertEquals(calls[0].url, "/api/cities");
  assertEquals(calls[0].init.method, "GET");
  assertEquals((calls[0].init.headers as Record<string, string>).Authorization, undefined);
});

Deno.test("dresses passes the query string through", async () => {
  const { api, calls } = setup(() => json(200, { items: [], page: 1, per_page: 24, total: 0 }));
  await api.dresses(new URLSearchParams("q=ak&page=2"));
  await api.dresses();
  assertEquals(calls.map((c) => c.url), ["/api/dresses?q=ak&page=2", "/api/dresses"]);
});

Deno.test("admin calls send the bearer token and a JSON body", async () => {
  const { api, calls } = setup(() => json(201, { id: 7, ...shopInput }));
  const shop = await api.admin.createShop(shopInput);
  assertEquals(shop.id, 7);
  const { url, init } = calls[0];
  const headers = init.headers as Record<string, string>;
  assertEquals(url, "/api/admin/shops");
  assertEquals(init.method, "POST");
  assertEquals(headers.Authorization, "Bearer tok");
  assertEquals(headers["Content-Type"], "application/json");
  assertEquals(JSON.parse(String(init.body)), shopInput);
});

Deno.test("admin dresses filters by shop only when a shop is given", async () => {
  const { api, calls } = setup(() => json(200, { items: [] }));
  await api.admin.dresses(3);
  await api.admin.dresses();
  assertEquals(calls.map((c) => c.url), ["/api/admin/dresses?shop_id=3", "/api/admin/dresses"]);
});

Deno.test("an error envelope becomes an ApiError with code and fields", async () => {
  const { api } = setup(() =>
    json(400, { error: { code: "validation_failed", message: "bad", fields: { phone: "invalid" } } })
  );
  const err = await assertRejects(() => api.admin.createShop(shopInput), ApiError);
  assertEquals(err.status, 400);
  assertEquals(err.code, "validation_failed");
  assertEquals(err.fields, { phone: "invalid" });
});

Deno.test("a 401 on an admin call triggers onUnauthorized, a failed login does not", async () => {
  const s = setup(() => json(401, { error: { code: "unauthorized", message: "login required" } }));
  await assertRejects(() => s.api.admin.shops(), ApiError);
  assertEquals(s.unauthorized(), 1);
  const l = setup(() => json(401, { error: { code: "invalid_credentials", message: "wrong" } }));
  await assertRejects(() => l.api.login("a@b.c", "x"), ApiError);
  assertEquals(l.unauthorized(), 0);
});

Deno.test("a network failure becomes network_error", async () => {
  const { api } = setup(() => Promise.reject(new TypeError("Failed to fetch")));
  const err = await assertRejects(() => api.cities(), ApiError);
  assertEquals(err.status, 0);
  assertEquals(err.code, "network_error");
});

Deno.test("a non-JSON server error becomes internal_error", async () => {
  const { api } = setup(() => new Response("<html>bad gateway</html>", { status: 502 }));
  const err = await assertRejects(() => api.dress(1), ApiError);
  assertEquals(err.status, 502);
  assertEquals(err.code, "internal_error");
});

Deno.test("204 responses resolve to undefined", async () => {
  const { api, calls } = setup(() => new Response(null, { status: 204 }));
  assertEquals(await api.admin.deleteShop(4), undefined);
  assertEquals(calls[0].init.method, "DELETE");
  assertEquals(calls[0].url, "/api/admin/shops/4");
});

Deno.test("login returns the token and reorderImages sends the ids", async () => {
  const { api, calls } = setup((url) =>
    url.endsWith("/login") ? json(200, { token: "jwt" }) : new Response(null, { status: 204 })
  );
  assertEquals(await api.login("a@b.c", "secret-pass"), "jwt");
  await api.admin.reorderImages([3, 1, 2]);
  assertEquals(JSON.parse(String(calls[1].init.body)), { ids: [3, 1, 2] });
  assertEquals(calls[1].init.method, "PATCH");
});

Deno.test("ApiError is an Error", () => {
  assertInstanceOf(new ApiError(404, "not_found", "x"), Error);
});

Deno.test("a 413 without a JSON body becomes body_too_large", async () => {
  const { api } = setup(() => new Response("<html>too big</html>", { status: 413 }));
  const err = await assertRejects(() => api.admin.createShop(shopInput), ApiError);
  assertEquals(err.status, 413);
  assertEquals(err.code, "body_too_large");
});

Deno.test("a request that never answers is aborted and becomes network_error", async () => {
  const fetchFn = ((_: RequestInfo | URL, init: RequestInit = {}) =>
    new Promise<Response>((_res, rej) => {
      init.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")));
    })) as typeof fetch;
  const api = createApi({ fetch: fetchFn, token: () => null, onUnauthorized: () => {}, timeoutMs: 10 });
  const err = await assertRejects(() => api.cities(), ApiError);
  assertEquals(err.code, "network_error");
});

Deno.test("an OK response whose body cannot be read becomes network_error", async () => {
  const { api } = setup(() => new Response("<html>cut off", { status: 200 }));
  const err = await assertRejects(() => api.cities(), ApiError);
  assertEquals(err.code, "network_error");
});

Deno.test("busy days: public and admin reads, and marking a day busy or free", async () => {
  const { api, calls } = setup((url, init) =>
    init.method === "GET"
      ? json(200, { from: "2026-10-20", to: "2027-10-20", days: ["2026-11-14"] })
      : new Response(null, { status: 204 })
  );
  assertEquals((await api.busyDays(7)).days, ["2026-11-14"]);
  assertEquals((await api.admin.busyDays(7)).to, "2027-10-20");
  assertEquals(await api.admin.markBusy(7, "2026-11-14"), undefined);
  assertEquals(await api.admin.markFree(7, "2026-11-14"), undefined);
  assertEquals(calls.map((c) => `${c.init.method} ${c.url}`), [
    "GET /api/items/7/busy-days",
    "GET /api/admin/items/7/busy-days",
    "PUT /api/admin/items/7/busy-days/2026-11-14",
    "DELETE /api/admin/items/7/busy-days/2026-11-14",
  ]);
  assertEquals((calls[0].init.headers as Record<string, string>).Authorization, undefined);
  assertEquals((calls[2].init.headers as Record<string, string>).Authorization, "Bearer tok");
});

Deno.test("owner sign-up and sign-in send no token and return the token", async () => {
  const { api, calls } = setup(() => json(200, { token: "shop-jwt" }));
  const input = { shop_name: "Ak Gelin", city_id: 1, address: "Aşgabat", phone: "65123456", password: "long-enough-1" };
  assertEquals(await api.owner.signup(input), "shop-jwt");
  assertEquals(await api.owner.login("65123456", "long-enough-1"), "shop-jwt");
  assertEquals(calls.map((c) => `${c.init.method} ${c.url}`), ["POST /api/shop/signup", "POST /api/shop/login"]);
  assertEquals(JSON.parse(String(calls[0].init.body)), input);
  assertEquals(JSON.parse(String(calls[1].init.body)), { phone: "65123456", password: "long-enough-1" });
  for (const c of calls) assertEquals((c.init.headers as Record<string, string>).Authorization, undefined);
});

Deno.test("a failed owner sign-in does not trigger onUnauthorized, an expired owner session does", async () => {
  const s = setup(() => json(401, { error: { code: "invalid_credentials", message: "wrong" } }));
  await assertRejects(() => s.api.owner.login("65123456", "x"), ApiError);
  assertEquals(s.unauthorized(), 0);
  await assertRejects(() => s.api.owner.me(), ApiError);
  assertEquals(s.unauthorized(), 1);
});

Deno.test("owner calls go to /api/shop with the bearer token", async () => {
  const { api, calls } = setup((_url, init) =>
    init.method === "GET" ? json(200, { items: [] }) : new Response(null, { status: 204 })
  );
  await api.owner.me();
  await api.owner.updateShop(shopInput);
  await api.owner.dresses();
  await api.owner.deleteDress(5);
  await api.owner.reorderImages([2, 1]);
  await api.owner.deleteImage(9);
  await api.owner.markBusy(5, "2026-11-14");
  await api.owner.markFree(5, "2026-11-14");
  assertEquals(calls.map((c) => `${c.init.method} ${c.url}`), [
    "GET /api/shop/me",
    "PUT /api/shop/me/shop",
    "GET /api/shop/dresses",
    "DELETE /api/shop/dresses/5",
    "PATCH /api/shop/images/order",
    "DELETE /api/shop/images/9",
    "PUT /api/shop/items/5/busy-days/2026-11-14",
    "DELETE /api/shop/items/5/busy-days/2026-11-14",
  ]);
  for (const c of calls) assertEquals((c.init.headers as Record<string, string>).Authorization, "Bearer tok");
});

Deno.test("an admin sets a shop owner's password", async () => {
  const { api, calls } = setup(() => new Response(null, { status: 204 }));
  assertEquals(await api.admin.setOwnerPassword(4, "brand-new-pass"), undefined);
  assertEquals(`${calls[0].init.method} ${calls[0].url}`, "POST /api/admin/shops/4/owner-password");
  assertEquals(JSON.parse(String(calls[0].init.body)), { password: "brand-new-pass" });
});

Deno.test("items: the public all-category list, one item, and the shared listing calls", async () => {
  const { api, calls } = setup((_url, init) =>
    init.method === "GET" ? json(200, { items: [], page: 1, per_page: 24, total: 0 }) : json(201, { id: 9 })
  );
  await api.items(new URLSearchParams("category=cars&body=suv"));
  await api.item(9);
  await api.admin.listings({ shopId: 3, category: "tents" });
  await api.owner.listings();
  const input = {
    shop_id: 3, category: "tents", title: "Ak çadyr", price_manat: 5000, price_is_from: false, description: "",
    is_published: true, attributes: { guests: 200 },
  };
  await api.owner.createItem(input);
  await api.admin.updateItem(9, input);
  await api.owner.deleteItem(9);
  assertEquals(calls.map((c) => `${c.init.method} ${c.url}`), [
    "GET /api/items?category=cars&body=suv",
    "GET /api/items/9",
    "GET /api/admin/items?shop_id=3&category=tents",
    "GET /api/shop/items",
    "POST /api/shop/items",
    "PUT /api/admin/items/9",
    "DELETE /api/shop/items/9",
  ]);
  assertEquals(JSON.parse(String(calls[4].init.body)), input);
  assertEquals((calls[0].init.headers as Record<string, string>).Authorization, undefined);
});
