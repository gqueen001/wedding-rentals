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
