import { Index, Show } from "solid-js";
import { t, tr } from "../../i18n/i18n.ts";
import { fieldMessage } from "../../lib/errors.ts";
import { PlusIcon, TrashIcon } from "../icons.tsx";

/** The list of other names and spellings brides may search for (Cyrillic, Latin, short forms). */
export default function AliasEditor(props: { aliases: string[]; onChange: (aliases: string[]) => void; error?: string }) {
  const update = (index: number, value: string) => props.onChange(props.aliases.map((a, j) => (j === index ? value : a)));
  const remove = (index: number) => props.onChange(props.aliases.filter((_, j) => j !== index));
  return (
    <fieldset>
      <legend class="text-sm font-semibold">{t("shopform.aliases")}</legend>
      <p class="text-sm text-silver-ink">{t("shopform.aliases_hint")}</p>
      <ul class="mt-2 space-y-2">
        <Index each={props.aliases}>
          {(alias, index) => (
            <li class="flex gap-2">
              <input
                class="field-input"
                value={alias()}
                aria-label={`${t("shopform.aliases")} ${index + 1}`}
                onInput={(e) => update(index, e.currentTarget.value)}
              />
              <button
                type="button"
                class="btn-icon shrink-0"
                aria-label={t("shopform.alias_remove", { alias: alias() || String(index + 1) })}
                onClick={() => remove(index)}
              >
                <TrashIcon />
              </button>
            </li>
          )}
        </Index>
      </ul>
      <button type="button" class="btn btn-quiet mt-2" onClick={() => props.onChange([...props.aliases, ""])}>
        <PlusIcon />
        {t("shopform.alias_add")}
      </button>
      <Show when={props.error}>
        {(error) => <p class="mt-1 text-sm text-garnet">{fieldMessage(error(), tr)}</p>}
      </Show>
    </fieldset>
  );
}
