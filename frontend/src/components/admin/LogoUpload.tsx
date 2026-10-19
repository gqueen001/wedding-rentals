import { createSignal, Show } from "solid-js";
import { t, tr } from "../../i18n/i18n.ts";
import { uploadImage } from "../../lib/client.ts";
import { errorMessage } from "../../lib/errors.ts";
import type { Image } from "../../lib/types.ts";
import ShopLogo from "../ShopLogo.tsx";

export default function LogoUpload(props: {
  shopId: number;
  name: string;
  logo: Image | null;
  onUploaded: (logo: Image) => void;
}) {
  const [progress, setProgress] = createSignal<number | null>(null);
  const [error, setError] = createSignal<unknown>(null);

  async function pick(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    setError(null);
    setProgress(0);
    try {
      props.onUploaded(await uploadImage(file, { shopId: props.shopId }, setProgress));
    } catch (err) {
      setError(() => err);
    } finally {
      setProgress(null);
    }
  }

  return (
    <div>
      <h2 class="text-sm font-semibold">{t("shopform.logo")}</h2>
      <div class="mt-3 flex flex-wrap items-center gap-4">
        <ShopLogo url={props.logo?.small ?? null} name={props.name || "?"} size="lg" />
        <label class="btn btn-outline cursor-pointer focus-within:outline-2 focus-within:outline-garnet">
          {t("shopform.logo_upload")}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="sr-only"
            disabled={progress() !== null}
            onChange={(e) => void pick(e.currentTarget)}
          />
        </label>
        <Show when={progress() !== null}>
          <span role="status" class="text-sm text-silver-ink">
            {t("photos.uploading", { name: t("shopform.logo"), percent: Math.round((progress() ?? 0) * 100) })}
          </span>
        </Show>
      </div>
      <Show when={error()}>
        <p role="alert" class="mt-2 text-sm text-garnet">{errorMessage(error(), tr)}</p>
      </Show>
    </div>
  );
}
