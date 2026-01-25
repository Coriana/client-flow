# AGENTS.md - AI Coding Agent Guidelines

React/TypeScript business management app with Vite, shadcn/ui, and local SQLite backend.

## Build/Lint/Test Commands

```bash
npm run dev              # Start both frontend (:8080) and backend (:3001)
npm run dev:client       # Start Vite dev server only
npm run dev:server       # Start API server only
npm run build            # Production build
npm run lint             # Run ESLint
npm run db:reset         # Reset database to initial state
```

### Testing

**No test framework configured.** If adding tests, use Vitest (recommended for Vite).

## Architecture

```
Frontend (React/Vite :8080)  <-->  Backend (Express/SQLite :3001)
       |                                    |
  src/integrations/api/client.ts      server/
  (Supabase-compatible interface)     ├── db/schema.sql, database.ts
                                      ├── routes/auth.ts, crud.ts, storage.ts
                                      └── middleware/auth.ts
```

### Default Credentials
- Email: `admin@localhost`
- Password: Set on first login

## Project Structure

```
src/
├── components/ui/       # shadcn/ui (DO NOT modify)
├── components/          # Feature components (PascalCase)
├── pages/               # Route pages (PascalCase)
├── hooks/               # Custom hooks (useXxx.ts)
├── contexts/            # React contexts
├── integrations/api/    # API client
└── lib/utils.ts         # Utilities (cn, uuid)

server/
├── db/                  # schema.sql, seed.sql, database.ts
├── routes/              # auth.ts, crud.ts, storage.ts
└── middleware/auth.ts   # JWT authentication
```

## Code Style Guidelines

### Import Order

1. React (`import { useState } from 'react'`)
2. External libraries (`react-router-dom`, `date-fns`, `lucide-react`)
3. UI components (`@/components/ui/*`)
4. Business components (`@/components/*`)
5. Hooks (`@/hooks/*`)
6. Contexts (`@/contexts/*`)
7. Integrations (`@/integrations/*`)
8. Utilities (`@/lib/*`)
9. Types (`import type { ... }`)

Always use `@/` path alias:
```typescript
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Pages/Components | PascalCase | `ClientDetail.tsx` |
| UI components | lowercase-hyphen | `scroll-area.tsx` |
| Hooks | camelCase, `use` prefix | `usePermission.ts` |
| Functions | camelCase | `fetchClients` |
| Event handlers | `handle` prefix | `handleSubmit` |
| Types | PascalCase | `Client`, `JobWithDetails` |

### TypeScript

- Use `Tables<'tablename'>` from `@/integrations/supabase/types`
- Use `Partial<T>` for form state
- Use union types: `'read' | 'write'`
- Relaxed strictness (no strict mode, no strictNullChecks)

### API Usage

The client mimics Supabase's chainable interface:

```typescript
import { supabase } from '@/integrations/supabase/client';

// Query with relations
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

Use toast for user-facing errors:
```typescript
const { toast } = useToast();
if (error) {
  toast({ title: 'Error', description: error.message, variant: 'destructive' });
  return;
}
```

### Styling

- Tailwind CSS only (no inline styles)
- Use `cn()` from `@/lib/utils` for conditional classes
- Common patterns: `space-y-6`, `gap-4`, `text-muted-foreground`

### Components

- Use shadcn/ui from `@/components/ui/`
- **Never modify** files in `components/ui/`
- Add components: `npx shadcn@latest add <component>`

## Environment Variables

```bash
VITE_API_URL=http://localhost:3001/api
API_PORT=3001
DATABASE_PATH=./data/app.db
JWT_SECRET=your-secret-key
CORS_ORIGIN=http://localhost:8080
```

## Key Patterns

### Page Component Structure
```typescript
export default function EntityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [entity, setEntity] = useState<Partial<Entity>>({});

  useEffect(() => { fetchData(); }, [id]);

  async function handleSave() { /* ... */ }
  async function handleDelete() { /* ... */ }

  if (loading) return <div className="text-muted-foreground">Loading...</div>;
  return ( /* JSX */ );
}
```

### Permission Checking
```typescript
import { usePermission } from '@/hooks/usePermission';
const { canRead, canWrite } = usePermission('clients');
```

## Dependencies

**Frontend:** React 18, Vite, TypeScript, shadcn/ui, Tailwind, React Router 6, TanStack Query, react-hook-form, zod

**Backend:** Express 5, better-sqlite3, bcryptjs, jsonwebtoken, multer
