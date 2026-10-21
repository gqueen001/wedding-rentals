import type { AdminDress, AdminShop, BusyDays, City, DressInput, Page, PublicDress, PublicShop, ShopInput } from "./types.ts";

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

  const admin = { auth: true } as const;

  return {
    cities: () => request<{ items: City[] }>("GET", "/api/cities").then((r) => r.items),
    dresses: (query?: URLSearchParams) => request<Page>("GET", withQuery("/api/dresses", query)),
    dress: (id: number | string) => request<PublicDress>("GET", `/api/dresses/${encodeURIComponent(String(id))}`),
    busyDays: (dressId: number) => request<BusyDays>("GET", `/api/dresses/${dressId}/busy-days`),
    shop: (slug: string, query?: URLSearchParams) =>
      request<PublicShop>("GET", withQuery(`/api/shops/${encodeURIComponent(slug)}`, query)),
    login: (email: string, password: string) =>
      request<{ token: string }>("POST", "/api/admin/login", { body: { email, password } }).then((r) => r.token),
    admin: {
      shops: () => request<{ items: AdminShop[] }>("GET", "/api/admin/shops", admin).then((r) => r.items),
      shop: (id: number) => request<AdminShop>("GET", `/api/admin/shops/${id}`, admin),
      createShop: (input: ShopInput) => request<AdminShop>("POST", "/api/admin/shops", { ...admin, body: input }),
      updateShop: (id: number, input: ShopInput) =>
        request<AdminShop>("PUT", `/api/admin/shops/${id}`, { ...admin, body: input }),
      deleteShop: (id: number) => request<void>("DELETE", `/api/admin/shops/${id}`, admin),
      dresses: (shopId?: number) =>
        request<{ items: AdminDress[] }>(
          "GET",
          withQuery("/api/admin/dresses", shopId ? new URLSearchParams({ shop_id: String(shopId) }) : undefined),
          admin,
        ).then((r) => r.items),
      dress: (id: number) => request<AdminDress>("GET", `/api/admin/dresses/${id}`, admin),
      createDress: (input: DressInput) => request<AdminDress>("POST", "/api/admin/dresses", { ...admin, body: input }),
      updateDress: (id: number, input: DressInput) =>
        request<AdminDress>("PUT", `/api/admin/dresses/${id}`, { ...admin, body: input }),
      deleteDress: (id: number) => request<void>("DELETE", `/api/admin/dresses/${id}`, admin),
      reorderImages: (ids: number[]) => request<void>("PATCH", "/api/admin/images/order", { ...admin, body: { ids } }),
      deleteImage: (id: number) => request<void>("DELETE", `/api/admin/images/${id}`, admin),
      busyDays: (dressId: number) => request<BusyDays>("GET", `/api/admin/dresses/${dressId}/busy-days`, admin),
      markBusy: (dressId: number, day: string) =>
        request<void>("PUT", `/api/admin/dresses/${dressId}/busy-days/${day}`, admin),
      markFree: (dressId: number, day: string) =>
        request<void>("DELETE", `/api/admin/dresses/${dressId}/busy-days/${day}`, admin),
    },
  };
}

export type Api = ReturnType<typeof createApi>;
