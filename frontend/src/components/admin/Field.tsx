import { createUniqueId, For, Show } from "solid-js";
import { t, tr } from "../../i18n/i18n.ts";
import { errorMessage, fieldMessage } from "../../lib/errors.ts";

interface FieldBase {
  label: string;
  /** The raw API field value, e.g. "required"; translated here. */
  error?: string;
  hint?: string;
}

function Note(props: { id: string; error?: string; hint?: string }) {
  return (
    <Show
      when={props.error}
      fallback={
        <Show when={props.hint}>
          <p id={props.id} class="mt-1 text-sm text-silver-ink">{props.hint}</p>
        </Show>
      }
    >
      {(error) => <p id={props.id} class="mt-1 text-sm text-garnet">{fieldMessage(error(), tr)}</p>}
    </Show>
  );
}

const described = (p: FieldBase, noteId: string) => (p.error || p.hint ? noteId : undefined);

export function TextField(
  props: FieldBase & {
    value: string;
    onInput: (value: string) => void;
    type?: "text" | "email" | "password" | "tel" | "url";
    inputmode?: "text" | "numeric" | "tel" | "url" | "email";
    autocomplete?: string;
  },
) {
  const id = createUniqueId();
  return (
    <div>
      <label for={id} class="block text-sm font-semibold">{props.label}</label>
      <input
        id={id}
        class="field-input mt-1"
        type={props.type ?? "text"}
        inputmode={props.inputmode}
        autocomplete={props.autocomplete}
        value={props.value}
        aria-invalid={props.error ? "true" : undefined}
        aria-describedby={described(props, `${id}-note`)}
        onInput={(e) => props.onInput(e.currentTarget.value)}
      />
      <Note id={`${id}-note`} error={props.error} hint={props.hint} />
    </div>
  );
}

export function TextArea(props: FieldBase & { value: string; onInput: (value: string) => void }) {
  const id = createUniqueId();
  return (
    <div>
      <label for={id} class="block text-sm font-semibold">{props.label}</label>
      <textarea
        id={id}
        rows={4}
        class="field-input mt-1"
        value={props.value}
        aria-invalid={props.error ? "true" : undefined}
        aria-describedby={described(props, `${id}-note`)}
        onInput={(e) => props.onInput(e.currentTarget.value)}
      />
      <Note id={`${id}-note`} error={props.error} hint={props.hint} />
    </div>
  );
}

export function SelectField(
  props: FieldBase & { value: string; options: { value: string; label: string }[]; onChange: (value: string) => void },
) {
  const id = createUniqueId();
  return (
    <div>
      <label for={id} class="block text-sm font-semibold">{props.label}</label>
      <select
        id={id}
        class="field-input mt-1"
        value={props.value}
        aria-invalid={props.error ? "true" : undefined}
        aria-describedby={described(props, `${id}-note`)}
        onChange={(e) => props.onChange(e.currentTarget.value)}
      >
        <For each={props.options}>{(o) => <option value={o.value} selected={o.value === props.value}>{o.label}</option>}</For>
      </select>
      <Note id={`${id}-note`} error={props.error} hint={props.hint} />
    </div>
  );
}

export function CheckboxField(props: FieldBase & { checked: boolean; onChange: (checked: boolean) => void }) {
  const id = createUniqueId();
  return (
    <div>
      <label class="flex items-center gap-3">
        <input
          id={id}
          type="checkbox"
          class="h-5 w-5 accent-garnet"
          checked={props.checked}
          aria-describedby={described(props, `${id}-note`)}
          onChange={(e) => props.onChange(e.currentTarget.checked)}
        />
        <span class="text-sm font-semibold">{props.label}</span>
      </label>
      <Note id={`${id}-note`} error={props.error} hint={props.hint} />
    </div>
  );
}

/** Save button, "Saved" status, the form-level error and an optional delete button. */
export function FormActions(props: { saving: boolean; saved: boolean; error: unknown; onDelete?: () => void }) {
  return (
    <div class="flex flex-wrap items-center gap-3 border-t border-veil pt-5">
      <button type="submit" class="btn btn-primary" disabled={props.saving}>
        {props.saving ? t("admin.saving") : t("admin.save")}
      </button>
      <span role="status" class="text-sm text-silver-ink">{props.saved ? t("admin.saved") : ""}</span>
      <Show when={props.onDelete}>
        <button type="button" class="btn btn-quiet ml-auto" onClick={() => props.onDelete?.()}>
          {t("admin.delete")}
        </button>
      </Show>
      <Show when={props.error}>
        <p role="alert" class="w-full text-sm text-garnet">{errorMessage(props.error, tr)}</p>
      </Show>
    </div>
  );
}
