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

Development defaults to SQLite. Set `DATABASE_URL` to a PostgreSQL connection URL, `DJANGO_SECRET_KEY` to a private random value, `DJANGO_DEBUG=false`, and `DJANGO_ALLOWED_HOSTS` for deployment. PostgreSQL deployment, TLS, backups, and hosting have not been provisioned.

## Prototype scope

When signed in, Customers, Sales & Invoices, Receipts, Supplier Bills, Payments, Cash Close, Stock, and Exceptions create and display server records. Credit decisions and bill/voucher reviews require an authenticated Managing Director; a creator cannot review their own bill or voucher. ZiG transactions use an approved rate snapshot. Rates are added by the Managing Director with an approval reference; a later rate closes the previous period without changing earlier transaction snapshots. Invoice allocations and supplier settlements are validated by the API. Payment vouchers are records for independent review only; the app does not authorize or execute funds transfers. Cash Close snapshots same-date till cash receipts and MD-approved cash vouchers by currency; each date can be closed once, and variances require an exception reference. Stock is limited to selected controlled/high-value or exception items; manual SD-06 cards remain primary, and approval names are not independently verified. Exception updates are append-only application records; only a Managing Director can escalate to Awaiting MD or close an exception. Sales references must be entered from the paper invoice; the app does not issue invoices or generate numbers. Receipt and payment voucher numbers must already be issued from the pre-numbered SD-03 / SD-04 books. Retain all original source documents and payment evidence.

In server mode, customer balances use server-linked sales and receipts; local mode uses only browser drafts and is not authoritative. Existing local records remain separate and are not counted in server balances. The API records append-only application audit events for supported writes, but these events are not tamper-proof against database administrators. The manual outbox covers Cash Close, Stock, and Exceptions only; business-key conflicts stay queued until corrected and retried or explicitly removed after review, and other modules have no sync workflow. There is no automatic background synchronization. Cash Close is not a bank reconciliation, stock is not a complete inventory system, and none of these records replace the controlled source books or workbook checks.

Do not use this prototype as the system of record or enter sensitive customer information. A production rollout still requires an approved PostgreSQL host and credentials, deployment/TLS configuration, backups, monitoring, security review, audit hardening, broader offline sync and conflict handling, and workbook acceptance testing against the approved operating procedures.