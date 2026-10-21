# Shop Accounts: Design Spec

**Date:** 2026-10-21
**Status:** Approved in brainstorming. Revised the same day at the product owner's request: there is no admin approval step for now.
**Builds on:**
- `2026-10-18-wedding-rentals-v1-design.md`, which deferred "shops managing their own pages" (§11);
- `2026-10-20-dress-availability-calendar-design.md`.

## 1. Goal

Rental shops sign up by themselves and immediately manage their own shop page: shop details, dresses, photos and the busy/free calendar. No admin action is needed.

## 2. Decisions

| Topic | Decision |
|---|---|
| Who signs up | **Rental shops only.** Brides still have no accounts. |
| Approval | **None for now.** Sign-up creates an active account and a public shop at once. Approval can be added later, once there are more users. |
| Visibility | The shop page is public from sign-up. Brides only ever see dresses that the owner has marked **Published**, so a new, empty shop appears in no dress list. |
| Sign-in | **Phone + password.** There is no SMS or email code. |
| Forgotten password | **An admin sets a new password** on the shop's admin page and tells the owner by phone. That is the only new admin tool. |
| Moderation | The **existing** admin tools are enough. Unpublishing a shop hides it, and the owner cannot republish it. Deleting a shop also deletes its owner account. |
| Existing shop pages | Pages admins created before (for example "Jennet") stay admin-managed. Linking them to owner accounts is out of scope for now. |
| Architecture | **A separate "My shop" area (`/shop`) with its own endpoints.** These always take the shop from the signed-in account. The admin panel keeps working for every shop. |

## 3. What the shop owner does

### 3.1 Signing up (`/shop/signup`)

- **Form fields:**
  - shop name;
  - city;
  - address;
  - phone number, which is the login and also the shop's public contact phone, changeable later;
  - password, at least 10 characters.
- **Phone normalization:** numbers are stored as `+993` followed by 8 digits (§6.2). One phone number is one account. A number already in use gets the field error `phone: "taken"`.
- **On success:** the account and the shop are created together. The owner is signed in and lands on **"My shop"**.
- **Rate limit:** 5 attempts per minute per IP. This is the same limiter type as admin sign-in, with its own counter.

### 3.2 "My shop" (`/shop`)

- **Shop details:** shop name, city, address, contact phone, Instagram and TikTok links, description, other names and spellings (aliases), and the logo. The slug never changes after creation.
- **My dresses:** a list of the shop's dresses showing a thumbnail, title, price and a Published or Draft badge. Each row has **Edit**, and the list has **Add dress**.
- **The dress editor:** the same fields, photo manager and busy/free calendar as the admin dress editor, including the per-dress **Published** switch.
- **Delete dress:** asks for confirmation, then deletes the dress with its photos (files included) and busy days.
- **Hidden shops:** the owner cannot change whether the shop itself is published. If an admin has unpublished the shop, "My shop" shows a banner: "Your shop is hidden from the site. Call us."

### 3.3 Signing in (`/shop/login`)

- **Credentials:** phone number and password. Wrong credentials get 401 `invalid_credentials`, without saying which field was wrong.
- **Rate limit:** 5 attempts per minute per IP.
- **"Forgot your password?"** shows: "Call us, and we'll set a new one for you."

### 3.4 Signing out

A **Sign out** button is always available. A session lasts 7 days, the same as an admin session.

## 4. What the admin does

- **Owner box in the shop editor** (`/admin/shops/:id`): when the shop has an owner account, a small "Owner account" box shows the owner's phone and a **Set new password** form, with at least 10 characters. Setting a new password signs the owner out on every device.
- **Shops list badge:** shops run by an owner show a **"Managed by owner"** badge.
- **Everything else stays as it is.** Admins can still edit, unpublish or delete any shop and any dress.
  - Deleting a shop deletes its owner account too, through the cascade.
  - Admins do not create owner accounts.

## 5. Data model

New migration `backend/migrations/00004_shop_owners.sql`:

```sql
-- +goose Up
CREATE TABLE shop_owners (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id       bigint NOT NULL UNIQUE REFERENCES shops(id) ON DELETE CASCADE,
  phone         text NOT NULL UNIQUE,          -- normalized +993XXXXXXXX
  password_hash text NOT NULL,
  token_version int  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- The v1 placeholder for ownership is replaced by shop_owners.shop_id.
ALTER TABLE shops DROP COLUMN owner_user_id;

-- +goose Down
ALTER TABLE shops ADD COLUMN owner_user_id bigint;
DROP TABLE IF EXISTS shop_owners;
```

- **Ownership lives on the owner row.** One owner has exactly one shop (`shop_id NOT NULL UNIQUE`), and a shop has at most one owner.
- **Sign-up** creates the shop (`is_published = true`) and the owner in one transaction.
- **`token_version`** is incremented when an admin sets a new password. This invalidates every token issued before.
- **The dropped column** `shops.owner_user_id` was never used by any code.

## 6. Security

### 6.1 Token audiences

- **Audience claim:** JWTs gain an audience claim. Admin tokens use `aud: "admin"`, and shop tokens use `aud: "shop"` plus a `ver` claim holding the owner's `token_version`.
- **Separate middleware:** the admin middleware accepts only `admin` tokens, and the shop middleware accepts only `shop` tokens. Tests must prove that each rejects the other's token.
- **Re-sign-in:** existing admin tokens have no audience, so admins sign in once more after the upgrade.

### 6.2 Phone normalization

1. Remove everything except digits.
2. If 11 digits remain and they start with `993`, keep the last 8.
3. If 9 digits remain and they start with `8`, drop the `8`.
4. If exactly 8 digits remain, the result is `+993` followed by them. Otherwise the phone is invalid.

For example, `+993 65 12-34-56`, `8 65 123456` and `65123456` all become `+99365123456`, while `12345` is invalid. The same function serves both sign-up and sign-in.

### 6.3 Shop owner middleware

On every request the middleware:
1. verifies the `shop` token;
2. loads the owner;
3. answers 401 `unauthorized` if the owner no longer exists or `ver` differs from `token_version`;
4. puts the owner's id and shop id into the request context.

### 6.4 Ownership

- **The shop comes only from the context:** owner handlers take the shop id from the request context, never from the request body or query.
- **Foreign ids get 404:** any dress, image or busy-day id that does not belong to the owner's shop answers 404 `not_found`.
- **No self-publishing:** owners cannot set `shops.is_published`. The owner's shop-details endpoint ignores that field.

### 6.5 Other

- **Passwords:** bcrypt, at least 10 characters, the same as admin passwords.
- **Token storage:** the shop token is stored in localStorage under `wr.shop_token`, separate from `wr.admin_token`.

## 7. API

All responses use the existing error envelope.

### 7.1 Shop owner, public

| Method and path | Body | Result |
|---|---|---|
| `POST /api/shop/signup` | `{shop_name, city_id, address, phone, password}` | 201 `{token}`. 400 `validation_failed`, with field values such as `phone: "invalid"` or `"taken"`, `password: "too_short"`, `city_id: "invalid"`, `address: "required"`. 429 `rate_limited`. |
| `POST /api/shop/login` | `{phone, password}` | 200 `{token}`. 401 `invalid_credentials`. 429 `rate_limited`. |

### 7.2 Shop owner, signed in (`aud: shop`)

| Method and path | Result |
|---|---|
| `GET /api/shop/me` | `{id, phone, shop: AdminShop}` |
| `PUT /api/shop/me/shop` | Updates the shop details. `is_published` is ignored, and the response is the updated `AdminShop`. |
| `POST /api/shop/images` (multipart: `file` plus either `shop_id` = own shop, or `listing_id` = own dress) | Same rules as the admin upload. |
| `PATCH /api/shop/images/order`, `DELETE /api/shop/images/:id` | Own images only. |
| `GET/POST /api/shop/dresses`, `GET/PUT/DELETE /api/shop/dresses/:id` | Own shop only. `shop_id` in the body is ignored and forced to the owner's shop. |
| `GET /api/shop/dresses/:id/busy-days`, `PUT/DELETE /api/shop/dresses/:id/busy-days/:day` | Same contract as the admin busy-days endpoints. |

### 7.3 Admin (`aud: admin`)

| Method and path | Result |
|---|---|
| `POST /api/admin/shops/:id/owner-password` `{password}` | 204. Answers 404 if the shop has no owner, and 400 `validation_failed` (`password: "too_short"`). Increments `token_version`. |

The existing `AdminShop` gains `owner: {id, phone} | null` in the admin shop list and detail.

## 8. Code structure

### 8.1 Backend

- **`internal/auth`:**
  - Tokens gain audiences: `IssueAdmin`/`VerifyAdmin` and `IssueShop(ownerID, version)`/`VerifyShop`.
  - `Middleware` becomes admin-only.
- **`internal/owners`, a new package:**
  - phone normalization;
  - the repository: create an owner together with a shop, find by phone, get, and set a password;
  - the sign-up and sign-in handlers;
  - `ShopMiddleware`;
  - `/api/shop/me`;
  - the admin owner-password handler.
- **`internal/ownerapi`, a new package:** shop-scoped wrappers around the existing repository functions in `shops`, `dresses`, `images` and `busydays`. They check ownership first, so no business logic is duplicated. Where an existing handler holds logic the wrapper needs, that logic is moved into a reusable function.
- **`internal/server`:** wires `/api/shop` (public and shop-authenticated) and the new admin route.

### 8.2 Frontend

- **One editing interface, two backends:**
  - The editors that admins and owners share use a single interface, `ManageApi`, which covers the shop (get, update), dresses (list, get, create, update, delete), images (upload, reorder, delete) and busy days (get, mark busy, mark free).
  - `lib/manage.ts` builds an admin and a shop implementation, and a Solid context provides one of them to each component.
  - The shared components are `AliasEditor`, `LogoUpload`, `PhotoManager`, `AvailabilityEditor`, and the shop and dress form bodies.
  - The admin pages keep their current behaviour.
- **Owner pages:**
  - `src/lib/shopAuth.ts` keeps the token under `wr.shop_token`.
  - New pages: `/shop/signup`, `/shop/login`, `/shop` (the "My shop" dashboard: shop details, hidden-shop banner, dress list), `/shop/dresses/new` and `/shop/dresses/:id`. They are lazy-loaded, like the admin pages.
- **Admin additions:** the "Owner account" box with Set new password in the admin shop editor, and the "Managed by owner" badge in the shops list.
- **Texts:** all new text exists in tk, ru and en, with parity enforced by a test. This includes the field values `taken` and `too_short`.

## 9. Testing

- **Go**, against the test database:
  - phone normalization, table-driven;
  - sign-up:
    - creates the owner and a public shop;
    - rejects a taken phone;
    - validates every field;
    - is rate-limited;
  - sign-in: success and wrong password;
  - token audiences:
    - an admin token is rejected on `/api/shop/me`;
    - a shop token is rejected on `/api/admin/*`;
    - a `ver` mismatch is rejected;
  - owner access:
    - create, read, update and delete on own dresses, photos and busy days work;
    - another shop's dress, image or day gets 404;
    - the owner cannot publish or unpublish the shop;
  - admin set-password:
    - old tokens stop working;
    - the new password works;
    - a shop without an owner gets 404;
  - deleting a shop deletes its owner.
- **Deno:** the new API client methods, `ManageApi` routing to the admin and shop endpoints, and i18n parity.
- **Browser** (run by the controller in headless Chrome):
  1. A shop signs up.
  2. It adds a dress with a photo and busy days, and publishes it.
  3. A bride sees it.
  4. An admin sets a new password: the old session is signed out and the new password works.
  5. An admin unpublishes the shop: the owner sees the banner and brides no longer see the shop.
  6. No sideways overflow at 320px, in all three languages.

## 10. Out of scope (later, once there are more users)

- Admin approval of new shops, blocking and unblocking accounts, and linking accounts to existing shop pages.
- SMS or email verification, and self-service password reset.
- More than one account per shop, staff roles, and one account managing several shops.
- Shops editing their slug.
- Bride accounts, booking requests and payments.
