import { A, useNavigate, useSearchParams } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import { TextField } from "../../components/admin/Field.tsx";
import { t, tr } from "../../i18n/i18n.ts";
import { auth } from "../../lib/auth.ts";
import { api } from "../../lib/client.ts";
import { errorMessage } from "../../lib/errors.ts";
import { firstParam } from "../../lib/forms.ts";
import { usePageTitle } from "../../lib/title.ts";

export default function Login() {
  usePageTitle(() => t("admin.login_title"));
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal<unknown>(null);
  const [busy, setBusy] = createSignal(false);

  // Only return to admin pages, never to another site.
  const next = () => {
    const n = firstParam(search.next);
    return n.startsWith("/admin") && !n.startsWith("/admin/login") ? n : "/admin/shops";
  };

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      auth.set(await api.login(email().trim(), password()));
      navigate(next(), { replace: true });
    } catch (err) {
      setError(() => err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="min-h-screen bg-veil">
      <main class="mx-auto max-w-sm px-4 py-16">
        <A href="/" class="font-display text-3xl text-garnet">{t("app.name")}</A>
        <form class="mt-8 space-y-4 rounded-lg bg-white p-6" onSubmit={submit}>
          <h1 class="text-3xl">{t("admin.login_title")}</h1>
          <TextField label={t("admin.email")} type="email" autocomplete="username" value={email()} onInput={setEmail} />
          <TextField
            label={t("admin.password")}
            type="password"
            autocomplete="current-password"
            value={password()}
            onInput={setPassword}
          />
          <Show when={error()}>
            <p role="alert" class="text-sm text-garnet">{errorMessage(error(), tr)}</p>
          </Show>
          <button type="submit" class="btn btn-primary w-full" disabled={busy()}>{t("admin.sign_in")}</button>
        </form>
      </main>
    </div>
  );
}
