# Lhyndahan

Mobile-first pre-order store for hopia and sweets, plus an admin dashboard.
Next.js 16 (App Router) · Tailwind CSS 4 · Supabase (database, login, storage) · Vercel.

Orders are batched weekly: the cutoff is **Wednesday 6:00 AM (Manila)**, **KUS Delivery** arrives Friday and **My address** delivery arrives Saturday.

## What it does

**Customers** (no account needed)
- Browse by category, add to cart, check out with COD or GCash.
- KUS Delivery needs no address; "My address" asks for address, landmark and an optional Google Maps pin.
- Order numbers look like `LH-0001`. Customers can look up an order with the code and phone number.

**Admin** (`/admin`, one email only)
- Overview: sales, profit, unpaid, repeat customers, traffic and sources, per batch.
- Orders: filters, status tabs, mark paid / delivered, Excel (CSV) export.
- Batch: totals per product, "Copy for Supplier", supplier cost.
- Delivery: per-day lists with the amount to collect, printable.
- Products: CRUD, categories, multi-image upload, supplier price and delivery markup.
- Settings: GCash QR / name / number, password.

Profit = selling price − delivery markup − supplier price. If a product has no supplier price, its profit is shown as unknown rather than guessed.

## Project layout

```
src/app/(shop)/       customer pages (home, product, cart, checkout, order, lookup)
src/app/admin/        admin pages (login + (dash) section)
src/app/api/          /api/orders (place order), /api/keep-alive
src/components/       ui/ (base components), shop/ (store components)
src/lib/              validators, dates, cart, money, auth, supabase clients
supabase/migrations/  database, in order: 0001 … 0010
supabase/seed.sql     the product list
supabase/test/        SQL tests (run.sh runs them against a local Postgres)
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → Data API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys (`sb_publishable_…`) |
| `SUPABASE_SECRET_KEY` | Supabase → API Keys → Secret keys (`sb_secret_…`). **Server only.** |
| `ORDER_API_SECRET` | Any long random string. It must equal `private.app_secrets.order_api_secret` in the database. |

Never put the secret key in client code or commit `.env.local`. Add the same four values in Vercel → Project → Settings → Environment Variables.

## Set up the database (once)

1. Create a Supabase project (region: Southeast Asia / Singapore).
2. In the SQL editor, run every file in `supabase/migrations/` in order (`0001` … `0010`), then `supabase/seed.sql`.
3. Set the admin email (only this email can open `/admin`; it can't be changed from the app on purpose):

   ```sql
   update public.settings set admin_email = 'you@example.com', notify_email = 'you@example.com' where id = 1;
   ```
4. Store the order secret (same value as `ORDER_API_SECRET`):

   ```sql
   insert into private.app_secrets (key, value) values ('order_api_secret', 'the-same-long-random-string')
   on conflict (key) do update set value = excluded.value;
   ```
5. Authentication → turn **off** "Allow new users to sign up", then create your admin user (same email, auto-confirm).

## Rebuild the database from scratch

`supabase/rebuild.sql` is every migration plus the product list in one file (regenerate it with `supabase/build-rebuild.sh` after adding a migration).

1. Create a new Supabase project, open the SQL editor, paste `rebuild.sql`, run it once.
2. After it runs:
   - Set the admin email (`update public.settings ...`, see the setup steps above).
   - Read the generated order secret with `select value from private.app_secrets where key = 'order_api_secret';` and use it as `ORDER_API_SECRET` in Vercel.
   - Authentication: turn off sign-ups, create the admin user (same email, strong password).
   - Put the new URL, publishable key and secret key in Vercel, then redeploy.
3. Re-upload the payment QR codes in Admin → Settings.

Orders, uploaded images and logins live only in Supabase; this file recreates the structure and products, not that data.

## Run locally

Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local   # fill it in
npm run dev                  # http://localhost:3000, admin at /admin
```

Checks before pushing: `npx tsc --noEmit`, `npx eslint src`, `npm run build`.

## Deploy (Vercel)

1. Import the repository in Vercel (framework: Next.js).
2. Add the four environment variables above.
3. Deploy. Once the repository is connected, every push to `main` deploys to production automatically. `vercel.json` has a daily cron that calls `/api/keep-alive` so the free Supabase project doesn't pause.

## Weekly routine

1. Orders come in until Wednesday 6:00 AM. A new batch starts automatically after the cutoff.
2. Thursday: open **Batch**, tap **Copy for Supplier**, send it, then mark the orders as ordered.
3. Friday and Saturday: open **Delivery** for the lists and the amounts to collect. Print them if you want.
4. Mark orders **Paid** and **Delivered** as they go.

## Security notes

- Row Level Security is on for every table; only the admin email can read orders and customers.
- Orders are created through a security-definer function that needs a server-only secret, validates everything, snapshots prices, and rate-limits to 5 orders per hour per IP.
- Order lookup needs both the order code and the phone number.
- The admin area is protected by `src/proxy.ts` and again on every page and server action.

## Promo banners

The sliding cards at the top of the shop are managed in **Admin → Settings → Promo banners** (image and/or text, optional link, optional start/end time, reorder, hide). They slide by themselves, stop when touched, and stay still for people who set "reduce motion". Customers only ever see banners that are switched on and inside their dates (enforced by row-level security). Pictures live in the `site` storage bucket under `banners/`.
