import { createSignal, Show } from "solid-js";
import { t, tr } from "../../i18n/i18n.ts";
import { api } from "../../lib/client.ts";
import { errorMessage, validationFields } from "../../lib/errors.ts";
import { TextField } from "./Field.tsx";

/** The admin's only owner tool: a new password for a shop owner who forgot theirs. */
export default function OwnerPassword(props: { shopId: number; phone: string }) {
  const [password, setPassword] = createSignal("");
  const [fieldError, setFieldError] = createSignal<string | undefined>();
  const [error, setError] = createSignal<unknown>(null);
  const [saving, setSaving] = createSignal(false);
  const [saved, setSaved] = createSignal(false);

  async function save(e: SubmitEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setFieldError(undefined);
    setError(null);
    try {
      await api.admin.setOwnerPassword(props.shopId, password());
      setPassword("");
      setSaved(true);
    } catch (err) {
      setFieldError(validationFields(err).password);
      setError(() => err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form class="space-y-4" novalidate onSubmit={save}>
      <h2 class="text-2xl">{t("owner.title")}</h2>
      <p class="text-sm">
        {t("owner.phone")}: <a href={`tel:${props.phone}`} class="font-semibold text-garnet">{props.phone}</a>
      </p>
      <TextField
        label={t("owner.new_password")}
        type="password"
        autocomplete="new-password"
        hint={t("owner.new_password_hint")}
        value={password()}
        onInput={setPassword}
        error={fieldError()}
      />
      <div class="flex flex-wrap items-center gap-3">
        <button type="submit" class="btn btn-primary" disabled={saving()}>
          {saving() ? t("admin.saving") : t("owner.set_password")}
        </button>
        <span role="status" class="text-sm text-silver-ink">{saved() ? t("owner.password_set") : ""}</span>
        <Show when={error() && !fieldError()}>
          <p role="alert" class="w-full text-sm text-garnet">{errorMessage(error(), tr)}</p>
        </Show>
      </div>
    </form>
  );
}
