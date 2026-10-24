/** How the account avatar in the top bar looks. */
export type AvatarLook = "signed_out" | "loading" | "logo" | "letter";

/**
 * signedIn: an owner token is stored. shop: the owner's salon once loaded, or null while it loads
 * or when it could not be loaded (then the avatar still shows that someone is signed in).
 */
export function avatarLook(signedIn: boolean, shop: { logo: unknown | null } | null): AvatarLook {
  if (!signedIn) return "signed_out";
  if (!shop) return "loading";
  return shop.logo ? "logo" : "letter";
}
