# Shop Accounts: Design Spec

**Date:** 2026-10-21
**Status:** Approved in brainstorming; awaiting the product owner's review of this document
**Builds on:**
- `2026-10-18-wedding-rentals-v1-design.md`. The v1 spec deferred "shops claiming and managing their own pages" (§11) and reserved `shops.owner_user_id` for it.
- `2026-10-20-dress-availability-calendar-design.md`.

## 1. Goal

Rental shops can sign up by themselves and manage their own shop page: shop details, dresses, photos and the busy/free calendar. Admins approve each new shop once before it goes public.

## 2. Decisions

| Topic | Decision |
|---|---|
| Who signs up | **Rental shops only.** Brides still have no accounts. |
| Visibility | **Admin approval, once per shop.** Nothing a shop adds is public until an admin approves the shop. After approval, the owner's published dresses go live without further review. |
| Sign-in | **Phone + password.** No SMS or email code. The approval call is where the admin confirms the shop is real. |
| Forgotten password | **An admin sets a new password** and tells the owner by phone. |
| Existing shop pages | **The admin can link a new account to an existing shop page** while approving. One account manages exactly one shop. |
| Architecture | **A separate "My shop" area (`/shop`) with its own endpoints.** Owner endpoints always take the shop from the signed-in account. The admin panel keeps working for every shop. |

## 3. What the shop owner does

### 3.1 Signing up: `/shop/signup`

- **The form** asks for four things only: shop name, city, phone number, and a password of at least 10 characters.
- **Phone numbers** are normalized to `+993` followed by 8 digits. Input may contain spaces, dashes and parentheses, and a leading `8` or `+993` / `993` (see §6.2).
  - One phone number is one account.
  - A number already in use gets the field error `phone: "taken"`.
- **On success,** the owner is signed in and lands on "My shop". A banner says: "Your shop is waiting for approval. We'll call you on +993 …".
- **Rate limit:** 5 attempts per minute per IP, the same limiter as admin sign-in, with its own counter.

### 3.2 While pending

- **Shop details:** the owner can edit address, phone shown to brides, Instagram and TikTok links, description, aliases (other names and spellings), and the logo.
  - Shop name and city are also editable.
  - The slug never changes after creation.
- **No dresses yet.** The owner cannot add dresses. Dress, image (listing photos) and busy-day endpoints answer 403 `not_approved`. This keeps linking to an existing shop page lossless.

### 3.3 After approval

"My shop" shows:
- **Shop details:** the same form as above.
- **My dresses:** a list of the shop's dresses, with a thumbnail, title, price and a Published or Draft badge. Each row has Edit, and the list has **Add dress**.
- **The dress editor:** the same fields, photo manager and busy/free calendar as the admin dress editor. It includes the per-dress **Published** switch.
- **Delete dress:** asks for confirmation, then deletes the dress with its photos (files included) and busy days.

The owner cannot change whether the shop itself is published. Only admin approval, block and unblock do that.

### 3.4 Signing in: `/shop/login`

- Phone number and password. Wrong credentials get 401 `invalid_credentials`, without saying which field was wrong.
- A blocked account gets 403 `account_blocked`, shown as "Your account is blocked. Call us."
- Rate limit: 5 attempts per minute per IP.
- "Forgot your password?" shows: "Call us, and we'll set a new one for you."

### 3.5 Signing out

There is a Sign out button. A session lasts 7 days, like the admin session.

## 4. What the admin does

### 4.1 Shop accounts: `/admin/accounts`

- **Navigation:** a new admin nav item, "Shop accounts", with a count of waiting accounts.
- **Groups:** **Waiting**, **Approved** and **Blocked**.
- **Each row:** shop name, phone (as a `tel:` link), city and sign-up date.

### 4.2 A waiting account: `/admin/accounts/:id`

The page shows the sign-up data and the draft shop's current details. It offers three actions:
1. **Approve as a new shop.**
   - The account becomes `approved`, and the draft shop becomes public (`is_published = true`).
2. **Link to an existing shop.**
   - Pick from the existing shops with no owner.
   - A warning says: "The details this owner typed into their draft will be discarded. The existing page stays as it is."
   - On confirm, the chosen shop gets this owner, the draft shop and its logo are deleted, and the account becomes `approved`.
   - The linked shop's own published state is not changed.
3. **Reject.** After a confirmation, the account and its draft shop (and logo) are deleted.

### 4.3 An approved or blocked account

- **Set new password:** the admin types one of at least 10 characters. The owner is signed out on every device.
- **Block:**
  - The account becomes `blocked`, and the owner is signed out everywhere and cannot sign in.
  - The shop is hidden from brides (`is_published = false`).
- **Unblock:** the account becomes `approved` again, and the shop is public again.

### 4.4 Existing admin pages

- **Shops and Dresses:** they keep working for every shop, owned or not.
- **Ownership badge:** the shops list and the shop editor show "Managed by owner" with the owner's phone when a shop has an owner.
- **No accounts created by admins:** admins do not create owner accounts.

## 5. Data model

New migration `backend/migrations/00004_shop_owners.sql`:

```sql
CREATE TABLE shop_owners (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phone         text NOT NULL UNIQUE,          -- normalized +993XXXXXXXX
  password_hash text NOT NULL,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'blocked')),
  token_version int  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shops
  ADD CONSTRAINT shops_owner_fk FOREIGN KEY (owner_user_id) REFERENCES shop_owners(id) ON DELETE SET NULL,
  ADD CONSTRAINT shops_owner_unique UNIQUE (owner_user_id);
```

- The draft shop created at sign-up has `owner_user_id` set and `is_published = false`.
- Each owner owns exactly one shop. The application guarantees this: sign-up creates both in one transaction, and linking moves ownership in one transaction.
- `token_version` is incremented on block, unblock and set-password. That invalidates every token issued before.

## 6. Security

### 6.1 Token audiences

- **Claims:** JWTs gain an audience claim. Admin tokens use `aud: "admin"`; shop tokens use `aud: "shop"` plus a `ver` claim (the owner's `token_version`).
- **Checks:** the admin middleware accepts only `admin` tokens, and the shop middleware only `shop` tokens. Tests must prove that each rejects the other's token.
- **Upgrade:** existing admin tokens have no audience, so admins sign in once more after the upgrade.

### 6.2 Phone normalization

1. Strip everything except digits.
2. If the result has 11 digits starting with `993`, keep the last 8 digits.
3. If it has 9 digits starting with `8`, drop the `8`.
4. If 8 digits remain, store `+993` followed by them. Otherwise the input is invalid.

Results:
- `+993 65 12-34-56`, `8 65 123456` and `65123456` all become `+99365123456`.
- `12345` is invalid.

The same function serves sign-up and sign-in.

### 6.3 Shop owner middleware

On every request the middleware:
1. verifies the `shop` token;
2. loads the owner;
3. rejects with 401 `unauthorized` if the owner is missing, the status is `blocked`, or the `ver` claim differs from `token_version`.

It puts the owner's id, status and shop id into the request context.

### 6.4 Ownership

- **Source of the shop:** owner handlers take the shop id only from the context, never from the request body or query. Any dress, image or busy-day id that does not belong to the owner's shop answers 404 `not_found`.
- **Pending accounts:** dresses, listing photos and busy days answer 403 `not_approved`. Shop details and the logo are allowed.
- **Shop publishing:** owners cannot set `shops.is_published`. The owner's shop-details endpoint ignores any such field.

### 6.5 Other

- Passwords use bcrypt with a minimum of 10 characters, the same as admin passwords.
- The shop token is stored in localStorage as `wr.shop_token`, separate from `wr.admin_token`.

## 7. API

All responses use the existing error envelope.

### 7.1 Shop owner: public

| Method and path | Body | Result |
|---|---|---|
| `POST /api/shop/signup` | `{shop_name, city_id, phone, password}` | 201 `{token}`. 400 `validation_failed`, with field values such as `phone: "invalid"` or `"taken"`, `password: "too_short"`, `city_id: "invalid"`. 429 `rate_limited`. |
| `POST /api/shop/login` | `{phone, password}` | 200 `{token}`. 401 `invalid_credentials`. 403 `account_blocked`. 429 `rate_limited`. |

### 7.2 Shop owner: signed in (`aud: shop`)

| Method and path | Allowed when | Result |
|---|---|---|
| `GET /api/shop/me` | pending, approved | `{id, phone, status, shop: AdminShop}` |
| `PUT /api/shop/me/shop` | pending, approved | Updates the shop details. `is_published` is ignored. Returns `AdminShop`. |
| `POST /api/shop/images` (multipart: `file` plus `shop_id` = own shop, or `listing_id` = own dress) | logo: pending, approved; listing photo: approved | Same rules as the admin upload. |
| `PATCH /api/shop/images/order`, `DELETE /api/shop/images/:id` | approved | Only own images. |
| `GET/POST /api/shop/dresses`, `GET/PUT/DELETE /api/shop/dresses/:id` | approved | Own shop only. `shop_id` in the body is ignored and forced to the owner's shop. |
| `GET /api/shop/dresses/:id/busy-days`, `PUT/DELETE /api/shop/dresses/:id/busy-days/:day` | approved | Same contract as the admin busy-days endpoints. |

### 7.3 Admin (`aud: admin`)

| Method and path | Result |
|---|---|
| `GET /api/admin/accounts?status=pending\|approved\|blocked` | `{items: [{id, phone, status, created_at, shop: {id, name, slug, city_id}}]}`, newest first |
| `GET /api/admin/accounts/:id` | The same item, with `shop` as a full `AdminShop` |
| `POST /api/admin/accounts/:id/approve` | pending only. 204. The draft shop becomes public. |
| `POST /api/admin/accounts/:id/link` `{shop_id}` | pending only. 204. The target shop must exist and have no owner, else 409 `conflict`. The draft shop and its logo are deleted. |
| `DELETE /api/admin/accounts/:id` | pending only (reject). 204. Deletes the account and its draft shop. |
| `POST /api/admin/accounts/:id/password` `{password}` | approved or blocked. 204. Increments `token_version`. |
| `POST /api/admin/accounts/:id/block` / `unblock` | 204. Updates the status and `shops.is_published`, and increments `token_version`. |

The existing `AdminShop` gains `owner: {id, phone} | null`.

An action that does not match the current status answers 409 `conflict`. Examples are approving an approved account, or rejecting an approved one.

## 8. Code structure

### 8.1 Backend

- **`internal/auth`:**
  - Tokens gain an audience: `IssueAdmin` / `VerifyAdmin`, and `IssueShop(ownerID, version)` / `VerifyShop`.
  - `Middleware` becomes admin-only.
- **`internal/owners`, a new package:**
  - phone normalization;
  - the repository: create the owner with a draft shop, find by phone, get, list, and status changes;
  - the sign-up and sign-in handlers;
  - `ShopMiddleware`;
  - the admin account handlers;
  - the `/api/shop/me` handlers.
- **Shop-scoped handlers:** a new `internal/ownerapi` package wraps the existing repository functions in `shops`, `dresses`, `images` and `busydays`. It checks ownership and status first, so no logic is duplicated. Where an existing handler is needed, it is refactored into a repository function the wrapper can call.
- **`internal/server`:** wires `/api/shop` (public and shop-authenticated) and the new admin routes.

### 8.2 Frontend

- **A shared API interface:** the editors that admins and owners share call one interface, `ManageApi`. It covers:
  - `shop` get and update;
  - `dresses` list, get, create, update and delete;
  - `images` upload, reorder and delete;
  - `busyDays` get, `markBusy` and `markFree`.
  `lib/manage.ts` builds an admin and a shop implementation, and a Solid context provides one to each component.
  The components that use it are `AliasEditor`, `LogoUpload`, `PhotoManager`, `AvailabilityEditor`, and the shop and dress form bodies.
  The admin pages keep their behaviour.
- **Shop owner pages:** `src/lib/shopAuth.ts` keeps the token under `wr.shop_token`. The new pages are:
  - `/shop/signup`
  - `/shop/login`
  - `/shop`, the "My shop" dashboard: the status banner, the shop details, and the dress list once approved
  - `/shop/dresses/new`
  - `/shop/dresses/:id`
  They are lazy-loaded, like the admin pages.
- **Admin pages:** `/admin/accounts` and `/admin/accounts/:id`, plus the ownership badge on the shops pages.
- **Texts:** all new text is in tk, ru and en, with parity enforced by test. This includes the error codes `not_approved`, `account_blocked` and `conflict`, and the field values `taken` and `too_short`.

## 9. Testing

- **Go**, against the test database:
  - phone normalization, table-driven;
  - sign-up: pending owner and draft shop created, phone taken, validation, rate limit;
  - sign-in: success, wrong password, blocked;
  - token audiences: an admin token is rejected on `/api/shop/me` and a shop token on `/api/admin/*`; the `ver` mismatch is rejected;
  - a pending owner gets 403 on dresses and listing photos, but 200 on shop details and logo;
  - an approved owner can create, read, update and delete own dresses, photos and busy days;
  - another shop's dress, image or day gets 404;
  - the owner cannot publish or unpublish the shop;
  - admin actions:
    - approve;
    - link, including a target that already has an owner (409) and deletion of the draft;
    - reject, including deletion of the draft and its logo files;
    - set password, which invalidates old tokens;
    - block and unblock, including shop visibility;
    - every wrong-status action (409);
  - public visibility: pending and blocked shops are hidden.
- **Deno:**
  - the new API client methods;
  - `ManageApi` routing to the admin and shop endpoints;
  - i18n parity;
  - the client-side phone formatting helper, if one is added.
- **Browser (controller, headless Chrome):**
  - a shop signs up and sees the pending banner and the locked dresses section;
  - an admin approves it;
  - the owner adds a dress with a photo and busy days, and publishes it;
  - a bride sees it;
  - the link flow;
  - blocking signs the owner out and hides the shop;
  - no sideways overflow at 320px in the three languages.

## 10. Out of scope

- SMS or email verification, and self-service password reset.
- More than one account per shop, staff roles, and one account managing several shops.
- Owner-initiated "claim this page" requests: admins link instead.
- Shops editing their slug.
- Notifications to admins about new sign-ups beyond the waiting count.
- Bride accounts and booking requests.
- Payments or shop subscriptions.
