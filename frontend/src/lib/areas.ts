/** /admin and /shop ("My shop", not the public /shops/:slug) bring their own chrome. */
export function hasOwnChrome(pathname: string): boolean {
  return ["/admin", "/shop"].some((area) => pathname === area || pathname.startsWith(`${area}/`));
}
