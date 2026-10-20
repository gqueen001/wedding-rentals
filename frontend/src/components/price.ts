import { t } from "../i18n/i18n.ts";
import { formatPrice } from "../lib/format.ts";

/** "1 500 TMT" or "from 1 500 TMT" in the current language. */
export function priceText(p: { price_manat: number; price_is_from: boolean }): string {
  return t(p.price_is_from ? "price.from" : "price.exact", { price: formatPrice(p.price_manat) });
}
