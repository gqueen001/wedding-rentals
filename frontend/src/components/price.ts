import { t } from "../i18n/i18n.ts";
import { formatPrice } from "../lib/format.ts";
import type { Attributes } from "../lib/types.ts";

/** "1 500 TMT", "from 1 500 TMT", or with a car's unit "800 TMT / hour", in the current language. */
export function priceText(p: { price_manat: number; price_is_from: boolean; attributes?: Attributes }): string {
  const price = t(p.price_is_from ? "price.from" : "price.exact", { price: formatPrice(p.price_manat) });
  const unit = p.attributes?.price_unit;
  if (unit === "hour") return t("price.per_hour", { price });
  if (unit === "day") return t("price.per_day", { price });
  return price;
}
