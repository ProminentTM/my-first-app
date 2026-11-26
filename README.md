# Fentras Branch Workspace

Prototype v0.1 for the Phase 1 cross-platform PWA.

## Development

```powershell
npm install
npm run dev
```

## Production build

```powershell
npm run build
npm run preview
```

## Render deployment (staging / pilot)

The root `render.yaml` Blueprint runs the Django API and React frontend on one HTTPS origin and provisions a private-network PostgreSQL database in Frankfurt. Review Render's current service, database, and storage charges before creating the Blueprint: the configured web and database plans are paid plans. Do not deploy real branch/customer records until the rollout has passed an independent security review and the operating team has approved the procedure.

1. Push this repository to a private GitHub repository. Do not commit `.env` files, database URLs, or other credentials.
2. In Render, choose **New → Blueprint**, connect the repository, and review `render.yaml`. Confirm the paid plan and database storage charges before approving creation.
3. Wait for the first deployment to finish. Render runs `collectstatic`, applies database migrations in the pre-deploy step, and checks `/api/health/`.
4. In the Render service **Shell**, run `cd backend && python manage.py createsuperuser`. Visit `https://<your-service>.onrender.com/admin/`, sign in, and assign the initial account the approved role in **User profiles**. Create separate accounts for the Managing Director and Branch Manager; do not share the superuser account for daily use.
5. Test the HTTPS app, admin, sign-in/sign-out, health endpoint, a non-sensitive test record, and restoration from a database backup. Confirm that logout, role-based approval, and browser-local drafts behave as expected.
6. Configure a custom domain only after choosing and controlling the domain; then update `DJANGO_ALLOWED_HOSTS` in Render to the exact host and verify TLS and redirects.

Blueprint updates auto-deploy from the connected branch by default. Review each change and its database impact before merging. Render database URLs and generated Django secrets stay in the Render dashboard; never paste them into chat or source control. For recovery, use Render's database backup/export controls and periodically test a restore into a separate database. A service deploy is not by itself a disaster-recovery plan.

## Backend API (development)

The Django API provides authenticated endpoints for Customers, Sales & Invoices, Receipts, Payments, Supplier Bills, Cash Close, controlled Stock movements, Exceptions, approved exchange rates, audit events, and accounts. Sign in from the app header to use server-backed operational workflows. Each record uses an authenticated account and is validated by the API.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 127.0.0.1:8000
```

In another terminal, run the Vite app. Its `/api` requests are proxied to Django. New users default to the Branch Manager role; assign Managing Director through the Django admin `User profiles` section. Managing Directors can approve customer credit, supplier bills, payment vouchers, and ZiG rates; they also control exception escalation/closure. In the app, select **Sign in** and use that Django account. API access and refresh tokens are held in the current browser session; access tokens expire after 10 minutes, and refresh tokens rotate and the previous token is blacklisted. Signing out revokes the active refresh token. Login attempts are throttled to five per minute per client IP. API clients can obtain tokens with `POST /api/auth/token/`, send the access token as `Authorization: Bearer <access-token>`, refresh with `POST /api/auth/token/refresh/`, and revoke a refresh token with authenticated `POST /api/auth/logout/`.

Signing in never uploads browser-local drafts automatically. Cash Close, Stock, and Exception drafts appear in a manual outbox: review each draft and its source documents, then choose **Review & upload** when it is safe to submit. Stable submission IDs make retries safe after uncertain network responses. Other module drafts remain local; verify their source documents and check for existing server records before re-entering them.

Development defaults to SQLite. Render deployment reads its PostgreSQL connection URL and generated `DJANGO_SECRET_KEY` from Render environment settings, with `DJANGO_DEBUG=false` and a host allowlist derived from the service hostname. HTTPS is terminated by Render; Django trusts the forwarded HTTPS header.

## Prototype scope

When signed in, Customers, Sales & Invoices, Receipts, Supplier Bills, Payments, Cash Close, Stock, and Exceptions create and display server records. Credit decisions and bill/voucher reviews require an authenticated Managing Director; a creator cannot review their own bill or voucher. ZiG transactions use an approved rate snapshot. Rates are added by the Managing Director with an approval reference; a later rate closes the previous period without changing earlier transaction snapshots. Invoice allocations and supplier settlements are validated by the API. Payment vouchers are records for independent review only; the app does not authorize or execute funds transfers. Cash Close snapshots same-date till cash receipts and MD-approved cash vouchers by currency; each date can be closed once, and variances require an exception reference. Stock is limited to selected controlled/high-value or exception items; manual SD-06 cards remain primary, and approval names are not independently verified. Exception updates are append-only application records; only a Managing Director can escalate to Awaiting MD or close an exception. Sales references must be entered from the paper invoice; the app does not issue invoices or generate numbers. Receipt and payment voucher numbers must already be issued from the pre-numbered SD-03 / SD-04 books. Retain all original source documents and payment evidence.

In server mode, customer balances use server-linked sales and receipts; local mode uses only browser drafts and is not authoritative. Existing local records remain separate and are not counted in server balances. The API records append-only application audit events for supported writes, but these events are not tamper-proof against database administrators. The manual outbox covers Cash Close, Stock, and Exceptions only; business-key conflicts stay queued until corrected and retried or explicitly removed after review, and other modules have no sync workflow. There is no automatic background synchronization. Cash Close is not a bank reconciliation, stock is not a complete inventory system, and none of these records replace the controlled source books or workbook checks.

Do not use this prototype as the system of record or enter sensitive customer information. The Render Blueprint is deployment scaffolding, not production approval. A production rollout still requires an approved security review, monitoring, audit hardening, broader offline sync and conflict handling, documented backup/restore drills, and workbook acceptance testing against the approved operating procedures.