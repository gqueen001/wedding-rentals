/** The phone bottom bar's tabs. */
export type Tab = "home" | "categories" | "favorites" | "more";

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/** Which bottom-bar tab a public page belongs to; null for pages outside the bar's world. */
export function activeTab(pathname: string): Tab | null {
  // Search results start from Home's search box, so they belong to Home.
  if (pathname === "/" || under(pathname, "/search")) return "home";
  if (["/categories", "/c", "/dresses", "/items"].some((base) => under(pathname, base))) return "categories";
  if (under(pathname, "/favorites")) return "favorites";
  if (["/more", "/shops", "/credits"].some((base) => under(pathname, base))) return "more";
  return null;
}
