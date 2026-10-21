import { ApiError, toApiError } from "./api.ts";
import type { Image } from "./types.ts";

export type UploadOwner = { listingId: number } | { shopId: number };

export interface UploadDeps {
  /** The upload endpoint, e.g. "/api/admin/images". */
  path: string;
  token: () => string | null;
  onUnauthorized: () => void;
}

const UPLOAD_TIMEOUT_MS = 180_000;

export type Uploader = ReturnType<typeof createUploader>;

/** Uploads one photo with XMLHttpRequest, because fetch cannot report upload progress. */
export function createUploader(deps: UploadDeps) {
  return function upload(file: File, owner: UploadOwner, onProgress: (fraction: number) => void): Promise<Image> {
    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.append("file", file);
      if ("listingId" in owner) form.append("listing_id", String(owner.listingId));
      else form.append("shop_id", String(owner.shopId));

      const xhr = new XMLHttpRequest();
      xhr.open("POST", deps.path);
      const token = deps.token();
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };
      // 10 MB on a slow mobile connection takes a while.
      xhr.timeout = UPLOAD_TIMEOUT_MS;
      const failNetwork = () => reject(new ApiError(0, "network_error", "network request failed"));
      xhr.onerror = failNetwork;
      xhr.ontimeout = failNetwork;
      xhr.onabort = failNetwork;
      xhr.onload = () => {
        let data: unknown = null;
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          // not JSON, e.g. a proxy error page
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(1);
          resolve(data as Image);
          return;
        }
        if (xhr.status === 401) deps.onUnauthorized();
        reject(toApiError(xhr.status, data, xhr.statusText, "file_too_large"));
      };
      xhr.send(form);
    });
  };
}
