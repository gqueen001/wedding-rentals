import type { CityRef, Lang } from "./types.ts";

/** Groups thousands with a no-break space: 12500 → "12 500". */
export function formatPrice(n: number): string {
  return Math.trunc(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
}

export function cityName(city: CityRef, lang: Lang): string {
  if (lang === "ru") return city.name_ru;
  if (lang === "en") return city.name_en;
  return city.name_tk;
}

/** Builds a tel: link from a phone typed by an admin, e.g. "+993 65 12-34-56". */
export function telHref(phone: string): string {
  return "tel:" + phone.replace(/(?!^\+)[^\d]/g, "");
}

/** Only https links are rendered, whatever the API sends. */
export function httpsUrl(url: string | null): string | null {
  return url?.startsWith("https://") ? url : null;
}
