import { For, Match, Show, Switch } from "solid-js";
import { t, tr } from "../../i18n/i18n.ts";
import { type CategoryDef, fieldLabel, optionLabel } from "../../lib/catalog.ts";
import { fieldMessage } from "../../lib/errors.ts";
import { SelectField, TextField } from "./Field.tsx";

/** A category's own fields in the item editor, built from its definitions. */
export default function AttributeFields(props: {
  category: CategoryDef;
  values: Record<string, string | string[]>;
  onChange: (key: string, value: string | string[]) => void;
  /** Raw API field values, keyed "attributes.<key>". */
  errors: Record<string, string>;
}) {
  const slug = () => props.category.slug;
  return (
    <For each={props.category.fields}>
      {(f) => {
        const label = () => tr(fieldLabel(slug(), f.key));
        const hint = () => (f.required ? undefined : t("itemform.optional"));
        const err = () => props.errors[`attributes.${f.key}`];
        const text = () => {
          const v = props.values[f.key];
          return typeof v === "string" ? v : "";
        };
        const picked = () => {
          const v = props.values[f.key];
          return Array.isArray(v) ? v : [];
        };
        return (
          <Switch>
            <Match when={f.kind === "choice"}>
              <SelectField
                label={label()}
                hint={hint()}
                value={text()}
                options={[
                  { value: "", label: t("admin.choose") },
                  ...(f.options ?? []).map((o) => ({ value: o, label: tr(optionLabel(slug(), f.key, o)) })),
                ]}
                onChange={(v) => props.onChange(f.key, v)}
                error={err()}
              />
            </Match>
            <Match when={f.kind === "choices"}>
              <fieldset>
                <legend class="text-sm font-semibold">{label()}</legend>
                <div class="mt-2 flex flex-wrap gap-2">
                  <For each={f.options ?? []}>
                    {(o) => (
                      <label class="chip">
                        <input
                          type="checkbox"
                          class="sr-only"
                          checked={picked().includes(o)}
                          onChange={(e) =>
                            props.onChange(
                              f.key,
                              e.currentTarget.checked ? [...picked(), o] : picked().filter((x) => x !== o),
                            )}
                        />
                        {tr(optionLabel(slug(), f.key, o))}
                      </label>
                    )}
                  </For>
                </div>
                <Show when={err()}>{(e) => <p class="mt-1 text-sm text-garnet">{fieldMessage(e(), tr)}</p>}</Show>
              </fieldset>
            </Match>
            <Match when={true}>
              <TextField
                label={label()}
                hint={hint()}
                inputmode={f.kind === "number" ? "numeric" : undefined}
                value={text()}
                onInput={(v) => props.onChange(f.key, v)}
                error={err()}
              />
            </Match>
          </Switch>
        );
      }}
    </For>
  );
}
