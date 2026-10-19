import { ApiError, toApiError } from "./api.ts";
import type { Image } from "./types.ts";

export type UploadOwner = { listingId: number } | { shopId: number };

export interface UploadDeps {
  token: () => string | null;
  onUnauthorized: () => void;
}

/** Uploads one photo with XMLHttpRequest, because fetch cannot report upload progress. */
export function createUploader(deps: UploadDeps) {
  return function upload(file: File, owner: UploadOwner, onProgress: (fraction: number) => void): Promise<Image> {
    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.append("file", file);
      if ("listingId" in owner) form.append("listing_id", String(owner.listingId));
      else form.append("shop_id", String(owner.shopId));

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/admin/images");
      const token = deps.token();
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };
      xhr.onerror = () => reject(new ApiError(0, "network_error", "network request failed"));
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
        reject(toApiError(xhr.status, data, xhr.statusText));
      };
      xhr.send(form);
    });
  };
}
