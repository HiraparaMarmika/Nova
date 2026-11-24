# NOVA

NOVA is a German cleaning-services marketplace prototype built with Next.js App Router, TypeScript, PostgreSQL and Prisma 6.19.3. It requires Node **20.9+** (developed with Node 20.15).

## Implemented demo workflows

- Separate customer, cleaner and administrator identities, sessions, registrations and portals.
- Availability-aware one-time and recurring bookings with overlap protection, consent, immutable financial snapshots and local demo authorizations.
- Cleaner application review, private local document uploads, profile/rate/service-area/availability editing and job lifecycle actions.
- Customer rescheduling, cancellation policy, recurring-series cancellation, reviews, complaints, notifications and downloadable demo invoices.
- Administrator invitations, account state management, document review, disputes/refunds, reconciliation, risk flags, waitlist follow-up, audit logs and versioned operating rules.
- A worker for request expiry, visit reminders and post-complaint-window settlement, including demo invoice and payout records.

MFA and live Stripe/Connect processing are intentionally deferred. Current payment, refund and payout records are local simulations and never collect card data or move money.

The interface defaults to German. Use the **DE / EN** switch in the header to change to English; the choice is saved across pages and refreshes. Dates use the selected language and Europe/Berlin time, and amounts remain in EUR.

## Local start (PowerShell)

1. Copy `.env.example` to `.env` and fill in the local PostgreSQL password. URL-encode reserved password characters. Do not commit this file.
2. If needed, create the database: `createdb -U postgres nova`.
3. Install and prepare:

   ```powershell
   npm install
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   npm run dev
   ```

Run `npm run worker` from a scheduler or another terminal for queued expiry, reminder and settlement work. `npm run db:migrate:dev -- --name meaningful_change` is for authoring migrations; `db:migrate` only deploys checked-in migration SQL.

For a **disposable local demo database only**, `npx prisma migrate reset --force --skip-seed` recreates the public schema and applies migrations, deleting existing application data. Then run `npm run db:seed`. The seed is idempotent: `npm run db:verify-demo` checks its expected record counts.

## Database-backed accounts

- Customer: `anna@example.test` → `/customer/sign-in`
- Cleaner: `leonie@example.test` or `marina@example.test` → `/cleaner/sign-in`
- Admin: `admin@example.test` → `/admin/sign-in`
- Inactive invitation example: `admin-invite@example.test` (cannot sign in)

Passwords are stored only as salted scrypt hashes in PostgreSQL; the application does not read account passwords from `.env`. Sign-in creates an eight-hour, HTTP-only, portal-scoped database session; sign-out revokes it. For a fresh database, provide the initial account passwords only to the seed command: `npm run db:seed -- --customer-password=... --cleaner-password=... --admin-password=...`. The same values can be supplied to `npm run test:demo` when testing sign-in.

Set or rotate a database login password without adding it to `.env`: `npm run db:set-password -- --email=user@example.com --role=CUSTOMER --password=your-new-password`.

These are synthetic local identities. Admin sign-in uses email and password only. Administrators can create expiring invitation links under **Users & roles**; MFA must be implemented and required before live admin access. Payments, notifications and private file delivery use local adapters in development.

## Security and finance notes

Money is integer cents; commission rates are basis points and rounding is half-up to cents. The local demo currently uses the PostgreSQL bootstrap account in `.env`, which bypasses RLS; create a restricted runtime role and use `withRls()` for production work. The migration connection must be separate and privileged. Sensitive document storage is intended to be private and signed after authorization/audit, not under `public/`.

The webhook endpoint stores one record per provider event ID and treats duplicate delivery as successful. It is intentionally not a live Stripe integration until `STRIPE_WEBHOOK_SECRET` verification and the real Connect adapter are configured.

## Verification

Run: `npm run typecheck`, `npm test`, and `npm run build`. Database migration and seeding require a reachable local PostgreSQL instance and valid credentials. See the two files under `docs/` for traceability and remaining launch decisions.
