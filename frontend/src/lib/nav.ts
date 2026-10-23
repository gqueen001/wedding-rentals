/** The phone bottom bar's tabs. */
export type Tab = "home" | "categories" | "favorites" | "more";

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/** Which bottom-bar tab a public page belongs to; null for pages outside the bar's world. */
export function activeTab(pathname: string): Tab | null {
  if (pathname === "/") return "home";
  if (["/categories", "/c", "/dresses", "/items"].some((base) => under(pathname, base))) return "categories";
  if (under(pathname, "/favorites")) return "favorites";
  if (["/more", "/search", "/shops"].some((base) => under(pathname, base))) return "more";
  return null;
}
