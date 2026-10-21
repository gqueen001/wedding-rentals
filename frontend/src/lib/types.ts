export const COLORS = ["white", "ivory", "champagne", "blush", "other"] as const;
export const SILHOUETTES = ["ball_gown", "a_line", "mermaid", "straight", "short"] as const;
export const SLEEVES = ["long", "short", "none"] as const;
export const SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

export type Color = (typeof COLORS)[number];
export type Silhouette = (typeof SILHOUETTES)[number];
export type Sleeves = (typeof SLEEVES)[number];
export type Size = (typeof SIZES)[number];
export type Lang = "tk" | "ru" | "en";

export interface CityRef {
  slug: string;
  name_tk: string;
  name_ru: string;
  name_en: string;
}

export interface City extends CityRef {
  id: number;
}

/** URLs are site-relative, e.g. "/uploads/ab12_s.jpg". */
export interface Image {
  id: number;
  position: number;
  small: string;
  large: string;
  width: number;
  height: number;
}

export interface ShopRef {
  name: string;
  slug: string;
}

export interface ListItem {
  id: number;
  title: string;
  price_manat: number;
  price_is_from: boolean;
  photo: string | null;
  shop: ShopRef;
  city: CityRef;
}

export interface Page<T = ListItem> {
  items: T[];
  page: number;
  per_page: number;
  total: number;
}

export interface ShopCard {
  name: string;
  slug: string;
  address: string;
  phone: string;
  instagram_url: string | null;
  tiktok_url: string | null;
  logo: string | null;
  city: CityRef;
}

export interface PublicDress {
  id: number;
  title: string;
  price_manat: number;
  price_is_from: boolean;
  description: string | null;
  color: Color;
  silhouette: Silhouette;
  sleeves: Sleeves;
  sizes: Size[];
  images: Image[];
  shop: ShopCard;
}

export interface PublicShop {
  name: string;
  slug: string;
  address: string;
  phone: string;
  instagram_url: string | null;
  tiktok_url: string | null;
  description: string | null;
  logo: string | null;
  city: CityRef;
  dresses: Page;
}

/** Empty strings clear the optional text fields on the server. */
export interface ShopInput {
  name: string;
  city_id: number;
  address: string;
  phone: string;
  instagram_url: string;
  tiktok_url: string;
  description: string;
  is_published: boolean;
  aliases: string[];
}

export interface AdminShop {
  id: number;
  slug: string;
  name: string;
  city_id: number;
  address: string;
  phone: string;
  instagram_url: string | null;
  tiktok_url: string | null;
  description: string | null;
  is_published: boolean;
  logo: Image | null;
  aliases: string[];
  created_at: string;
  updated_at: string;
}

export interface DressInput {
  shop_id: number;
  title: string;
  price_manat: number;
  price_is_from: boolean;
  description: string;
  is_published: boolean;
  color: Color;
  silhouette: Silhouette;
  sleeves: Sleeves;
  sizes: Size[];
}

export interface AdminDress {
  id: number;
  shop_id: number;
  title: string;
  price_manat: number;
  price_is_from: boolean;
  description: string | null;
  is_published: boolean;
  color: Color;
  silhouette: Silhouette;
  sleeves: Sleeves;
  sizes: Size[];
  images: Image[];
  created_at: string;
  updated_at: string;
}

/** One dress's calendar: the window (today in Turkmenistan to 12 months ahead) and its busy days. */
export interface BusyDays {
  from: string;
  to: string;
  days: string[];
}
