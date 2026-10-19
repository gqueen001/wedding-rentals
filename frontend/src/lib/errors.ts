import { ApiError } from "./api.ts";
import type { I18n } from "../i18n/i18n.ts";

type Tr = I18n["tr"];

/** A translated, user-facing message for any thrown value. */
export function errorMessage(err: unknown, tr: Tr): string {
  if (err instanceof ApiError) {
    const key = `error.${err.code}`;
    const msg = tr(key);
    if (msg !== key) return msg;
  }
  return tr("error.generic");
}

/** A translated message for one value of error.fields, e.g. "required". */
export function fieldMessage(value: string, tr: Tr): string {
  const key = `field.${value}`;
  const msg = tr(key);
  return msg === key ? tr("field.invalid") : msg;
}

export function validationFields(err: unknown): Record<string, string> {
  return err instanceof ApiError && err.code === "validation_failed" ? err.fields : {};
}

export function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}
