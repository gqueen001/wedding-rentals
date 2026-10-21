import type {
  AdminDress, AdminItem, AdminShop, BusyDays, City, DressInput, ItemInput, ListingSummary, Page, PublicDress,
  PublicItem, PublicShop, ShopInput, ShopMe, SignupInput,
} from "./types.ts";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string>;

  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string; fields?: Record<string, string> };
}

/** Turns an error response body (or anything else) into an ApiError. */
export function toApiError(
  status: number,
  data: unknown,
  fallbackMessage: string,
  tooLargeCode = "body_too_large",
): ApiError {
  const e = (data as ErrorBody | null)?.error;
  // A proxy rejects an oversized body with its own page, not our JSON envelope.
  const fallbackCode = status === 413 ? tooLargeCode : "internal_error";
  return new ApiError(status, e?.code ?? fallbackCode, e?.message ?? fallbackMessage, e?.fields ?? {});
}

export interface ApiDeps {
  fetch: typeof fetch;
  token: () => string | null;
  onUnauthorized: () => void;
  /** How long a request may take before it is abandoned; defaults to 20 s. */
  timeoutMs?: number;
}

interface RequestOptions {
  body?: unknown;
  auth?: boolean;
}

const REQUEST_TIMEOUT_MS = 20_000;

function withQuery(path: string, query?: URLSearchParams): string {
  const qs = query?.toString() ?? "";
  return qs ? `${path}?${qs}` : path;
}

export function createApi(deps: ApiDeps) {
  async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    if (opts.auth) {
      const token = deps.token();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    // AbortSignal.timeout needs Safari 16; a controller works everywhere.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? REQUEST_TIMEOUT_MS);
    try {
      let res: Response;
      try {
        res = await deps.fetch(path, {
          method,
          headers,
          body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
          signal: controller.signal,
        });
      } catch {
        throw new ApiError(0, "network_error", "network request failed");
      }
      if (res.status === 204) return undefined as T;
      let data: unknown;
      try {
        data = await res.json();
      } catch {
        // An error page from a proxy is fine to report by status; a cut-off success is not.
        if (res.ok) throw new ApiError(0, "network_error", "response could not be read");
        data = null;
      }
      if (!res.ok) {
        if (opts.auth && res.status === 401) deps.onUnauthorized();
        throw toApiError(res.status, data, res.statusText);
      }
      return data as T;
    } finally {
      clearTimeout(timer);
    }
  }

  const signedIn = { auth: true } as const;

  /** Listings, photos and busy days: the same calls under /api/admin and /api/shop. */
  function manage(base: string) {
    return {
      dresses: (shopId?: number) =>
        request<{ items: AdminDress[] }>(
          "GET",
          withQuery(`${base}/dresses`, shopId ? new URLSearchParams({ shop_id: String(shopId) }) : undefined),
          signedIn,
        ).then((r) => r.items),
      dress: (id: number) => request<AdminDress>("GET", `${base}/dresses/${id}`, signedIn),
      createDress: (input: DressInput) => request<AdminDress>("POST", `${base}/dresses`, { ...signedIn, body: input }),
      updateDress: (id: number, input: DressInput) =>
        request<AdminDress>("PUT", `${base}/dresses/${id}`, { ...signedIn, body: input }),
      deleteDress: (id: number) => request<void>("DELETE", `${base}/dresses/${id}`, signedIn),
      reorderImages: (ids: number[]) => request<void>("PATCH", `${base}/images/order`, { ...signedIn, body: { ids } }),
      deleteImage: (id: number) => request<void>("DELETE", `${base}/images/${id}`, signedIn),
      /** Every listing in every category, dresses included, for the listing lists. */
      listings: (filter: { shopId?: number; category?: string } = {}) => {
        const query = new URLSearchParams();
        if (filter.shopId) query.set("shop_id", String(filter.shopId));
        if (filter.category) query.set("category", filter.category);
        return request<{ items: ListingSummary[] }>("GET", withQuery(`${base}/items`, query), signedIn)
          .then((r) => r.items);
      },
      item: (id: number) => request<AdminItem>("GET", `${base}/items/${id}`, signedIn),
      createItem: (input: ItemInput) => request<AdminItem>("POST", `${base}/items`, { ...signedIn, body: input }),
      updateItem: (id: number, input: ItemInput) =>
        request<AdminItem>("PUT", `${base}/items/${id}`, { ...signedIn, body: input }),
      deleteItem: (id: number) => request<void>("DELETE", `${base}/items/${id}`, signedIn),
      // Busy days belong to any listing, dresses included.
      busyDays: (listingId: number) => request<BusyDays>("GET", `${base}/items/${listingId}/busy-days`, signedIn),
      markBusy: (listingId: number, day: string) =>
        request<void>("PUT", `${base}/items/${listingId}/busy-days/${day}`, signedIn),
      markFree: (listingId: number, day: string) =>
        request<void>("DELETE", `${base}/items/${listingId}/busy-days/${day}`, signedIn),
    };
  }

  return {
    cities: () => request<{ items: City[] }>("GET", "/api/cities").then((r) => r.items),
    dresses: (query?: URLSearchParams) => request<Page>("GET", withQuery("/api/dresses", query)),
    dress: (id: number | string) => request<PublicDress>("GET", `/api/dresses/${encodeURIComponent(String(id))}`),
    /** Published listings of every category, or of one with ?category=. */
    items: (query?: URLSearchParams) => request<Page>("GET", withQuery("/api/items", query)),
    item: (id: number | string) => request<PublicItem>("GET", `/api/items/${encodeURIComponent(String(id))}`),
    busyDays: (listingId: number) => request<BusyDays>("GET", `/api/items/${listingId}/busy-days`),
    shop: (slug: string, query?: URLSearchParams) =>
      request<PublicShop>("GET", withQuery(`/api/shops/${encodeURIComponent(slug)}`, query)),
    login: (email: string, password: string) =>
      request<{ token: string }>("POST", "/api/admin/login", { body: { email, password } }).then((r) => r.token),
    admin: {
      shops: () => request<{ items: AdminShop[] }>("GET", "/api/admin/shops", signedIn).then((r) => r.items),
      shop: (id: number) => request<AdminShop>("GET", `/api/admin/shops/${id}`, signedIn),
      createShop: (input: ShopInput) => request<AdminShop>("POST", "/api/admin/shops", { ...signedIn, body: input }),
      updateShop: (id: number, input: ShopInput) =>
        request<AdminShop>("PUT", `/api/admin/shops/${id}`, { ...signedIn, body: input }),
      deleteShop: (id: number) => request<void>("DELETE", `/api/admin/shops/${id}`, signedIn),
      setOwnerPassword: (shopId: number, password: string) =>
        request<void>("POST", `/api/admin/shops/${shopId}/owner-password`, { ...signedIn, body: { password } }),
      ...manage("/api/admin"),
    },
    /** A shop owner's own account; every call acts on the signed-in owner's shop only. */
    owner: {
      signup: (input: SignupInput) =>
        request<{ token: string }>("POST", "/api/shop/signup", { body: input }).then((r) => r.token),
      login: (phone: string, password: string) =>
        request<{ token: string }>("POST", "/api/shop/login", { body: { phone, password } }).then((r) => r.token),
      me: () => request<ShopMe>("GET", "/api/shop/me", signedIn),
      updateShop: (input: ShopInput) => request<AdminShop>("PUT", "/api/shop/me/shop", { ...signedIn, body: input }),
      ...manage("/api/shop"),
    },
  };
}

export type Api = ReturnType<typeof createApi>;
/** The calls the shared dress, photo and calendar editors make, for an admin or an owner. */
export type ManageCalls = Omit<Api["owner"], "signup" | "login" | "me" | "updateShop">;
