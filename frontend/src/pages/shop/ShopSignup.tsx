import { A, useNavigate } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { SelectField, TextField } from "../../components/admin/Field.tsx";
import GolBand from "../../components/GolBand.tsx";
import LanguageSwitch from "../../components/LanguageSwitch.tsx";
import { i18n, t, tr } from "../../i18n/i18n.ts";
import { useCities } from "../../lib/cities.ts";
import { ownerApi } from "../../lib/client.ts";
import { mainRef } from "../../lib/dom.ts";
import { errorMessage, validationFields } from "../../lib/errors.ts";
import { cityName } from "../../lib/format.ts";
import { shopAuth } from "../../lib/shopAuth.ts";
import { usePageTitle } from "../../lib/title.ts";
import type { SignupInput } from "../../lib/types.ts";

/** A rental shop creates its account and its public shop page in one step. */
export default function ShopSignup() {
  usePageTitle(() => t("signup.title"));
  const navigate = useNavigate();
  const cities = useCities();
  const [form, setForm] = createStore<SignupInput>({
    shop_name: "",
    city_id: 0,
    address: "",
    phone: "",
    password: "",
  });
  const [errors, setErrors] = createSignal<Record<string, string>>({});
  const [error, setError] = createSignal<unknown>(null);
  const [busy, setBusy] = createSignal(false);
  const err = (field: string) => errors()[field];
  const cityOptions = () => [
    { value: "", label: t("admin.choose") },
    ...cities().map((c) => ({ value: String(c.id), label: cityName(c, i18n.lang()) })),
  ];

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (busy()) return;
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      shopAuth.set(
        await ownerApi.owner.signup({
          ...form,
          shop_name: form.shop_name.trim(),
          address: form.address.trim(),
          phone: form.phone.trim(),
        }),
      );
      navigate("/shop", { replace: true });
    } catch (err) {
      setErrors(validationFields(err));
      setError(() => err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="min-h-screen bg-veil">
      <GolBand />
      <main ref={mainRef} id="main" tabindex="-1" class="mx-auto max-w-md px-4 py-12 outline-none">
        <div class="flex items-center justify-between gap-3">
          <A href="/" class="font-display text-3xl text-garnet">{t("app.name")}</A>
          <LanguageSwitch />
        </div>
        <form class="mt-8 space-y-5 rounded-lg bg-white p-6" novalidate onSubmit={submit}>
          <div>
            <h1 class="text-3xl">{t("signup.title")}</h1>
            <p class="mt-2 text-sm text-silver-ink">{t("signup.lead")}</p>
          </div>
          <TextField
            label={t("shopform.name")}
            autocomplete="organization"
            value={form.shop_name}
            onInput={(v) => setForm("shop_name", v)}
            error={err("shop_name")}
          />
          <SelectField
            label={t("shopform.city")}
            value={form.city_id ? String(form.city_id) : ""}
            options={cityOptions()}
            onChange={(v) => setForm("city_id", Number(v) || 0)}
            error={err("city_id")}
          />
          <TextField
            label={t("shopform.address")}
            value={form.address}
            onInput={(v) => setForm("address", v)}
            error={err("address")}
          />
          <TextField
            label={t("shoplogin.phone")}
            type="tel"
            inputmode="tel"
            autocomplete="username"
            hint={t("signup.phone_hint")}
            value={form.phone}
            onInput={(v) => setForm("phone", v)}
            error={err("phone")}
          />
          <TextField
            label={t("admin.password")}
            type="password"
            autocomplete="new-password"
            hint={t("signup.password_hint")}
            value={form.password}
            onInput={(v) => setForm("password", v)}
            error={err("password")}
          />
          <Show when={error()}>
            <p role="alert" class="text-sm text-garnet">{errorMessage(error(), tr)}</p>
          </Show>
          <button
            type="submit"
            class="btn btn-primary w-full"
            aria-disabled={busy() ? "true" : undefined}
          >
            {busy() ? t("signup.creating") : t("signup.submit")}
          </button>
        </form>
        <p class="mt-6 text-center text-sm">
          {t("signup.have_account")}{" "}
          <A href="/shop/login" class="font-semibold text-garnet">{t("shoplogin.title")}</A>
        </p>
      </main>
    </div>
  );
}
