# CLAUDE.md — guidance for AI coding agents

Client Flow is a business-management app: a React/Vite frontend with a local
Express/SQLite (better-sqlite3) backend. The frontend talks to the backend
through a **Supabase-compatible client shim** (`src/integrations/api/client.ts`),
so app code reads like Supabase but there is no Supabase at runtime.

## Commands

```bash
npm run dev          # frontend (:8080) + backend (:3001) together
npm run dev:client   # Vite only
npm run dev:server   # API server only (tsx watch)
npm run build        # production build
npm run lint         # ESLint (note: repo has pre-existing lint debt)
npm run typecheck    # tsc --noEmit for the server project
npm run test         # Vitest (watch)
npm run test:run     # Vitest (once) — server integration tests
npm run db:reset     # delete data/app.db and restart the server
```

## Architecture

```
Frontend (React/Vite :8080)  <-->  Backend (Express/SQLite :3001)
  src/integrations/api/client.ts     server/
  (Supabase-compatible shim)         ├── index.ts            app wiring, CORS, rate limiting
                                     ├── db/{schema.sql, seed.sql, database.ts, columns.ts}
                                     ├── routes/{auth,crud,storage,functions,
                                     │           external-api,bill-import,mail}.ts
                                     ├── middleware/auth.ts   JWT + permissions
                                     └── utils/{numbering,activityLogger,email}.ts
mcp-server/   local MCP server exposing the external API to AI agents
openapi.yaml  OpenAPI 3.1 contract for /api/external
```

The `crud.ts` router implements the Supabase-style query surface (select with
relations, filters like `col.eq.value`, order, limit) over SQLite. Table and
**column names are validated** against real columns (`db/columns.ts`) before
being interpolated — never interpolate a caller-supplied identifier without
validating it.

## Security model (do not regress)

- Auth is JWT (`middleware/auth.ts`); `authMiddleware` re-checks the user is
  active on every request. Passwords are bcrypt.
- Onboarding is **invite-based**: `POST /auth/users` (requires `team:write`)
  creates a user with an invite token; `POST /auth/accept-invite` sets the
  password. Login never auto-creates passwords.
- The external API (`/api/external`, `routes/external-api.ts`) authenticates
  with hashed API keys and is gated by the key's **scopes** AND the owning
  user's role. Keys are created at `/api-keys`.
- In production the server refuses to boot with a placeholder `JWT_SECRET`.

## Numbering

Invoice/job numbers come from atomic counters in `company_settings`, allocated
via `server/utils/numbering.ts` (`allocateInvoiceNumber` / `allocateJobNumber`)
inside a transaction. The frontend reserves a number at save time via
`POST /api/functions/allocate-invoice-number`. Do NOT generate numbers with
`COUNT(*)` or a client-side read-modify-write — both reuse/collide.

## Project structure (frontend)

```
src/
├── components/ui/     shadcn/ui — DO NOT modify (add via `npx shadcn@latest add`)
├── components/        feature components (PascalCase)
├── pages/             route pages (PascalCase), lazy-loaded in App.tsx
├── hooks/             custom hooks (useXxx.ts)
├── contexts/          React contexts (Auth, Permission, Branding)
├── integrations/api/  the API client shim
└── lib/utils.ts       cn(), uuid
```

## Conventions

- Import order: React → external libs → `@/components/ui/*` → `@/components/*`
  → `@/hooks/*` → `@/contexts/*` → `@/integrations/*` → `@/lib/*` → types.
  Always use the `@/` alias.
- Naming: Pages/Components PascalCase; ui components lowercase-hyphen; hooks
  `useX`; handlers `handleX`; types PascalCase.
- Styling: Tailwind only; use `cn()` for conditional classes. No inline styles.
- User-facing errors go through `useToast` →
  `toast({ title, description, variant: 'destructive' })`.
- TypeScript strictness is relaxed on the frontend; the **server project
  typechecks cleanly** (`npm run typecheck`) — keep it that way.

## Testing

Server integration tests live in `server/__tests__/` (Vitest + supertest over a
temp SQLite). They assert the security and numbering invariants — run
`npm run test:run` before committing server changes, and add a test when you fix
a backend bug. CI (`.github/workflows/ci.yml`) gates on typecheck + tests +
build + docker build.

## Gotchas

- better-sqlite3 is **synchronous** and built with `SQLITE_DQS=0`: use
  single-quoted SQL string literals (`datetime('now')`, not `"now"`), or the
  statement throws.
- The DB is a singleton keyed off `DATABASE_PATH`; tests set env vars before
  dynamically importing the app.
- `server/uploads/` and `data/` are gitignored; storage paths are contained to
  their bucket dir (no traversal).

## Environment

```bash
VITE_API_URL=http://localhost:3001/api
API_PORT=3001
DATABASE_PATH=./data/app.db
JWT_SECRET=change-me            # required; must be non-placeholder in production
CORS_ORIGIN=http://localhost:8080
# SMTP_* optional, for invoice/invite email
```
