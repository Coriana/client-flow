# AGENTS.md - AI Coding Agent Guidelines

This is a React/TypeScript business management application built with Vite, shadcn/ui, and a local SQLite backend.

## Build/Lint/Test Commands

```bash
# Development (runs both frontend and backend)
npm run dev              # Start both servers concurrently
npm run dev:client       # Start Vite dev server only (port 8080)
npm run dev:server       # Start API server only (port 3001)

# Building
npm run build            # Production build
npm run build:dev        # Development build

# Other
npm run lint             # Run ESLint
npm run preview          # Preview production build
npm run db:reset         # Reset database to initial state
```

### Testing

**No test framework is configured.** If you need to add tests, consider Vitest (recommended for Vite projects).

## Architecture Overview

This app uses a **local SQLite backend** instead of cloud services:

```
Frontend (React/Vite)     Backend (Express/SQLite)
     :8080          <-->        :3001
       |                          |
  src/integrations/         server/
  api/client.ts             ├── index.ts (Express server)
       |                    ├── db/
       v                    │   ├── schema.sql
  Supabase-compatible       │   ├── seed.sql
  API interface             │   └── database.ts
                            ├── routes/
                            │   ├── auth.ts
                            │   ├── crud.ts
                            │   └── storage.ts
                            └── middleware/
                                └── auth.ts
```

### Default Credentials
- Email: `admin@localhost`
- Password: Set on first login (any password works initially)

## Project Structure

```
src/
├── components/
│   ├── ui/              # shadcn/ui components (DO NOT modify directly)
│   ├── layout/          # Layout components
│   └── [feature]/       # Feature-specific components
├── pages/               # Route page components
├── hooks/               # Custom React hooks
├── contexts/            # React context providers
├── integrations/
│   ├── api/             # Local API client (Supabase-compatible interface)
│   └── supabase/        # Re-exports api client + types
└── lib/                 # Utility functions

server/
├── index.ts             # Express server entry point
├── db/
│   ├── schema.sql       # SQLite schema (50+ tables)
│   ├── seed.sql         # Initial data (admin user, roles, etc.)
│   └── database.ts      # Database connection and helpers
├── routes/
│   ├── auth.ts          # Authentication endpoints
│   ├── crud.ts          # Generic CRUD for all tables
│   └── storage.ts       # File upload/download
├── middleware/
│   └── auth.ts          # JWT authentication
└── uploads/             # File storage (gitignored)

data/
└── app.db               # SQLite database file (gitignored)
```

## Code Style Guidelines

### Imports

Order imports in this sequence:
1. React imports (`import { useState, useEffect } from 'react'`)
2. External libraries (`react-router-dom`, `date-fns`, `lucide-react`)
3. Internal UI components (`@/components/ui/*`)
4. Internal business components (`@/components/*`)
5. Hooks (`@/hooks/*`)
6. Contexts (`@/contexts/*`)
7. Integrations (`@/integrations/*`)
8. Utilities (`@/lib/*`)
9. Types (`import type { ... }`)

Always use the `@/` path alias for internal imports:
```typescript
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Page files | PascalCase | `ClientDetail.tsx`, `Jobs.tsx` |
| Component files | PascalCase | `PermissionGate.tsx` |
| Hook files | camelCase with `use` prefix | `usePermission.ts` |
| UI components | lowercase-hyphen | `button.tsx`, `scroll-area.tsx` |
| Functions | camelCase | `fetchClients`, `handleSave` |
| Event handlers | `handle` prefix | `handleDelete`, `handleSubmit` |
| Types/Interfaces | PascalCase | `Client`, `JobWithDetails` |

### TypeScript

- Use types from `@/integrations/supabase/types` for database entities
- Use `Partial<T>` for form state with optional fields
- Use union types for strict values: `'read' | 'write'`
- TypeScript is configured with relaxed strictness (no strict mode)

### API Usage

The API client mimics Supabase's interface. Use the same patterns:

```typescript
import { supabase } from '@/integrations/supabase/client';

// Query
const { data, error } = await supabase
  .from('clients')
  .select('*, locations(*)')
  .eq('is_active', true)
  .order('name');

// Insert
const { data, error } = await supabase
  .from('clients')
  .insert({ name: 'New Client' })
  .select()
  .single();

// Update
const { error } = await supabase
  .from('clients')
  .update({ name: 'Updated' })
  .eq('id', clientId);

// Delete
const { error } = await supabase
  .from('clients')
  .delete()
  .eq('id', clientId);
```

### Error Handling

Use toast notifications for user-facing errors:
```typescript
const { toast } = useToast();

if (error) {
  toast({ 
    title: 'Error', 
    description: error.message, 
    variant: 'destructive' 
  });
  return;
}
```

### Styling

- Use Tailwind CSS utility classes exclusively
- Use the `cn()` utility for conditional classes
- Common spacing: `space-y-6`, `space-y-4`, `gap-4`
- Text colors: `text-muted-foreground`, `text-destructive`

### UI Components

- Use shadcn/ui components from `@/components/ui/`
- Do NOT modify files in `components/ui/` directly
- Add new shadcn components via: `npx shadcn@latest add <component>`

## Environment Variables

Create `.env.local` with:
```bash
VITE_API_URL=http://localhost:3001/api
API_PORT=3001
DATABASE_PATH=./data/app.db
JWT_SECRET=your-secret-key
CORS_ORIGIN=http://localhost:8080
```

## Key Dependencies

**Frontend:**
- React 18 + Vite + TypeScript
- shadcn/ui + Radix UI primitives
- Tailwind CSS 3.x
- React Router DOM 6.x
- TanStack React Query
- react-hook-form + zod

**Backend:**
- Express 5.x
- better-sqlite3
- bcryptjs + jsonwebtoken
- multer (file uploads)
