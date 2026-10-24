import { A, useNavigate, useSearchParams } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import { TextField } from "../../components/admin/Field.tsx";
import LanguageSwitch from "../../components/LanguageSwitch.tsx";
import { t, tr } from "../../i18n/i18n.ts";
import { ApiError } from "../../lib/api.ts";
import { ownerApi } from "../../lib/client.ts";
import { contactPhone } from "../../lib/contact.ts";
import { mainRef } from "../../lib/dom.ts";
import { errorMessage } from "../../lib/errors.ts";
import { firstParam, ownerReturnPath } from "../../lib/forms.ts";
import { shopAuth } from "../../lib/shopAuth.ts";
import { usePageTitle } from "../../lib/title.ts";

export default function ShopLogin() {
  usePageTitle(() => t("shoplogin.title"));
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const [phone, setPhone] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal<unknown>(null);
  const [busy, setBusy] = createSignal(false);
  const message = () => {
    const e = error();
    // The admin message says "email"; owners sign in with a phone number.
    return e instanceof ApiError && e.code === "invalid_credentials"
      ? t("shoplogin.wrong")
      : errorMessage(e, tr);
  };

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (busy()) return;
    setBusy(true);
    setError(null);
    try {
      shopAuth.set(await ownerApi.owner.login(phone().trim(), password()));
      navigate(ownerReturnPath(firstParam(search.next)), { replace: true });
    } catch (err) {
      setError(() => err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="min-h-screen bg-veil">
      <main ref={mainRef} id="main" tabindex="-1" class="mx-auto max-w-sm px-4 py-16 outline-none">
        <div class="flex items-center justify-between gap-3">
          <A href="/" class="font-display text-3xl text-garnet">{t("app.name")}</A>
          <LanguageSwitch />
        </div>
        <form class="mt-8 space-y-4 rounded-lg bg-white p-6" onSubmit={submit}>
          <h1 class="text-3xl">{t("shoplogin.title")}</h1>
          <TextField
            label={t("shoplogin.phone")}
            type="tel"
            inputmode="tel"
            autocomplete="username"
            value={phone()}
            onInput={setPhone}
          />
          <TextField
            label={t("admin.password")}
            type="password"
            autocomplete="current-password"
            value={password()}
            onInput={setPassword}
          />
          <Show when={error()}>
            <p role="alert" class="text-sm text-garnet">{message()}</p>
          </Show>
          <button
            type="submit"
            class="btn btn-primary w-full"
            aria-disabled={busy() ? "true" : undefined}
          >
            {t("admin.sign_in")}
          </button>
          <details class="text-sm">
            <summary class="cursor-pointer text-silver-ink hover:text-ink">
              {t("shoplogin.forgot")}
            </summary>
            <p class="mt-2">{t("shoplogin.forgot_body")}</p>
            <Show when={contactPhone()}>
              {(p) => (
                <p class="mt-1">
                  <a href={`tel:${p().replace(/\s/g, "")}`} class="font-semibold text-garnet">
                    {p()}
                  </a>
                </p>
              )}
            </Show>
          </details>
        </form>
        <p class="mt-6 text-center text-sm">
          {t("shoplogin.no_account")}{" "}
          <A href="/shop/signup" class="font-semibold text-garnet">{t("signup.title")}</A>
        </p>
      </main>
    </div>
  );
}
