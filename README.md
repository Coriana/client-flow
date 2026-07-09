# Client Flow

Business management app with a React/Vite frontend and a local Express/SQLite backend.

## Stack

- React 18 + Vite + TypeScript
- Tailwind CSS + shadcn/ui
- Express 5 + SQLite (better-sqlite3)

## Requirements

- Node.js + npm

## Local setup

1) Install dependencies

```sh
npm install
```

2) Create `.env.local`

```sh
# API
VITE_API_URL=http://localhost:3001/api
API_PORT=3001
DATABASE_PATH=./data/app.db
JWT_SECRET=your-secret-key
CORS_ORIGIN=http://localhost:8080

# SMTP (optional - for sending invoices/invites via email)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
```

3) Start development servers (frontend + backend)

```sh
npm run dev
```

Frontend: http://localhost:8080
Backend API: http://localhost:3001/api

## Default login

- Email: `admin@localhost`
- Password: `admin123`

## Scripts

```sh
npm run dev           # Start both servers
npm run dev:client    # Vite dev server only
npm run dev:server    # API server only
npm run build         # Production build
npm run build:dev     # Development build
npm run lint          # ESLint
npm run preview       # Preview production build
npm run db:reset      # Reset SQLite database
```

## Email setup (optional)

To send invoices and team invites via email, configure SMTP in `.env.local`:

- For Gmail: Use an [App Password](https://support.google.com/accounts/answer/185833) (not your regular password)
- For other providers: Use your SMTP credentials
- If SMTP is not configured, email features will show warnings but the app will still work

## Features

### Activity Logging

All changes to key business entities are automatically logged:
- **Tracked tables:** clients, jobs, invoices, estimates, payments, expenses, timesheets, inventory_items, purchases, assets, vendors, locations, profiles, company_settings
- **Logged actions:** created, updated, deleted
- **Stored data:** old values (for updates/deletes), new values (for creates/updates), entity name, user who made the change
- **Source tracking:** logs whether changes came from the browser UI or external API
- **API key attribution:** API-sourced changes show which API key was used
- View the activity log at `/activity-log` with filtering by source (Browser/API)

### External API

Programmatic access for integrations and AI tools:
- **API Keys:** Create and manage API keys at `/api-keys`
- **Scoped access:** Limit keys to specific resources (clients, jobs, invoices, etc.)
- **Request logging:** All API requests are logged with method, endpoint, status, duration, and IP address
- **Per-key usage:** View request logs filtered by specific API key
- See `api-examples.md` for detailed usage examples

### Reports

11 built-in reports accessible from `/reports`:
- **P&L Report** - Profit and loss statement
- **Job Profitability** - Revenue vs costs per job
- **Aged Receivables** - Outstanding invoices by age
- **Revenue by Client** - Client-wise revenue breakdown
- **Invoice Summary** - Invoice status overview
- **Time by Job** - Timesheet hours by job
- **Inventory Valuation** - Current inventory value
- **Asset Register** - Asset tracking
- **Bank Reconciliation** - Payment reconciliation
- **Vendor Spend** - Spending by vendor
- **GST Summary** - Tax summary

### Backups

The server automatically backs up the SQLite database on startup and on a recurring interval, using better-sqlite3's online backup API (safe to run while the app is live):

- Backups are written to `BACKUP_DIR` (default `data/backups`, already gitignored) as `app-YYYYMMDD-HHmmss.db`
- Runs every `BACKUP_INTERVAL_HOURS` (default `24`); set to `0` to disable
- Only the newest `BACKUP_RETENTION` backups are kept (default `7`); older ones are deleted automatically
- A backup failure is logged but never crashes the server

Configure these in `.env.local` if you want different values - see `.env.example`.

## Notes

- The local database file lives at `data/app.db` and is gitignored.
- No test framework is configured yet.
