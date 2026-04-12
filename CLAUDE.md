# Lab Inventory System — CLAUDE.md

## What this project is

A web application for **The Federle Lab** (a research lab) to manage shared lab resources. It is deployed on Vercel and backed by Supabase (Postgres + Auth + Storage).

Users must register and be approved by an admin before accessing anything. There are three roles: `admin`, `user`, `pending` (and `denied`).

## Tech stack

- **Framework:** Next.js 15 (App Router, TypeScript)
- **Auth & DB:** Supabase (`@supabase/supabase-js` v2, PKCE flow)
- **Styling:** Tailwind CSS v3
- **Icons:** lucide-react
- **Calendar:** FullCalendar (for equipment booking)
- **Excel:** xlsx (import/export inventory)
- **Deployment:** Vercel

## Project structure

```
src/
  app/                   # Next.js App Router pages
    page.tsx             # Root: shows AuthForm or redirects to /inventory
    inventory/page.tsx          # Lab Inventory (default, lab="main")
    inventory/brunei/page.tsx   # Brunei Inventory (lab="brunei")
    manuals/page.tsx     # Equipment manuals
    publications/page.tsx# Lab publications/papers
    other/page.tsx       # Shared links
  components/
    InventorySystem.tsx  # Core inventory UI (large, central component)
    AuthForm.tsx         # Login/register form
    AuthGuard.tsx        # Wraps pages that require auth
    PendingApproval.tsx  # Shown while account awaits approval
    UserManagement.tsx   # Admin: approve/deny/change user roles
    UserActivityDashboard.tsx  # Admin: audit log of inventory actions
    BookingModal.tsx     # Book equipment (FullCalendar)
    BookingsList.tsx     # View bookings
    CommentModal.tsx     # Item comments
    layout/Navigation.tsx # Top nav bar (Inventory / Manuals / Publications / Other)
    manuals/ManualsSystem.tsx
    publications/PublicationsSystem.tsx
    other/OtherSystem.tsx
  hooks/
    useAuth.ts           # Auth state hook (role, loading, signOut)
    useUniqueUnits.ts
  lib/
    supabase.ts          # Lazy Supabase client singleton
    storage.ts           # Supabase Storage helpers
    utils.js
  types/
    inventory.ts         # Item interface
```

## Database schema (Supabase / Postgres)

RLS is enabled on **all** tables. SELECT is open to any authenticated user; INSERT/UPDATE/DELETE require `role = 'admin'` in `profiles`.

### `profiles`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | FK → `auth.users(id)` |
| `email` | TEXT | |
| `role` | TEXT | `'admin'` / `'user'` / `'pending'` / `'denied'` |
| `full_name` | TEXT | nullable |
| `created_at` | TIMESTAMPTZ | |

### `inventory`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `name` | TEXT | |
| `quantity` | TEXT | stored as text (may include ranges) |
| `unit` | TEXT | nullable (e.g. "mL", "pcs") |
| `category` | TEXT | |
| `location` | TEXT | |
| `source` | TEXT | nullable (supplier / origin) |
| `comment` | TEXT | nullable |
| `created_at` | TIMESTAMPTZ | |
| `lab` | TEXT | `'main'` (default) or `'brunei'` — which lab this item belongs to |
| `created_by` | UUID | FK → `auth.users(id)` |

### `inventory_logs`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `item_id` | UUID | FK → `inventory(id)` |
| `user_id` | UUID | FK → `auth.users(id)` |
| `user_email` | TEXT | |
| `action_type` | TEXT | `'create'` / `'edit'` / `'delete'` |
| `field_name` | TEXT | nullable — which field changed |
| `old_value` | TEXT | nullable |
| `new_value` | TEXT | nullable |
| `timestamp` | TIMESTAMPTZ | |

### `inventory_bookings`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `item_id` | UUID | FK → `inventory(id)` |
| `user_id` | UUID | FK → `auth.users(id)` |
| `user_email` | TEXT | |
| `quantity` | INTEGER | how many units booked |
| `start_datetime` | TIMESTAMPTZ | |
| `end_datetime` | TIMESTAMPTZ | |
| `status` | TEXT | `'active'` (others possible) |
| `purpose` | TEXT | nullable — comment/reason |

### `manuals`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `title` | TEXT | |
| `description` | TEXT | nullable |
| `version` | TEXT | nullable |
| `pdf_path` | TEXT | storage path in `equipment-manuals` bucket |
| `pdf_filename` | TEXT | |
| `pdf_size_bytes` | BIGINT | |
| `created_at` | TIMESTAMPTZ | |
| `created_by` | UUID | FK → `auth.users(id)` |
| `updated_at` | TIMESTAMPTZ | nullable |

### `manual_equipment` (junction)
| Column | Type | Notes |
|---|---|---|
| `manual_id` | UUID | FK → `manuals(id)` ON DELETE CASCADE |
| `equipment_id` | UUID | FK → `inventory(id)` ON DELETE CASCADE |

Unique on `(manual_id, equipment_id)`. One manual can be linked to many items and vice versa.

### `publications`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `title` | TEXT | |
| `author` | TEXT | |
| `year` | INTEGER | |
| `category_id` | UUID | FK → `publication_categories(id)` nullable |
| `doi` | TEXT | nullable |
| `external_link` | TEXT | nullable |
| `pdf_path` | TEXT | nullable — storage path in `publications` bucket |
| `pdf_filename` | TEXT | nullable |
| `pdf_size_bytes` | BIGINT | nullable |
| `notes` | TEXT | nullable |
| `created_at` | TIMESTAMPTZ | |
| `created_by` | UUID | FK → `auth.users(id)` |
| `updated_at` | TIMESTAMPTZ | nullable |

### `publication_categories`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `name` | TEXT | |
| `description` | TEXT | nullable |
| `created_at` | TIMESTAMPTZ | |
| `created_by` | UUID | FK → `auth.users(id)` |

### `shared_links`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `title` | TEXT | |
| `url` | TEXT | |
| `comment` | TEXT | nullable |
| `created_at` | TIMESTAMPTZ | |
| `created_by` | UUID | FK → `auth.users(id)` |
| `updated_at` | TIMESTAMPTZ | nullable |

### Storage buckets
| Bucket | Access | Used for |
|---|---|---|
| `equipment-manuals` | Private (signed URLs) | Manual PDFs |
| `publications` | Private (signed URLs) | Publication PDFs |

PDF paths follow the pattern: `{user_id}/{timestamp}_{sanitized_filename}`

## Item data model (`inventory` table)

```ts
interface Item {
  id: string;
  name: string;
  quantity: string;
  unit?: string | null;
  category: string;
  location: string;
  source?: string | null;
  comment?: string | null;
  created_at?: string;
  created_by?: string;
}
```

## Auth flow

1. User registers → profile created with `role = 'pending'`
2. Admin approves in User Management → `role = 'user'` or `'denied'`
3. `isAuthenticated = role === 'admin' || role === 'user'`
4. `AuthGuard` wraps protected pages and redirects to `/` if not authenticated

## Running locally

```bash
npm install
# Create .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev   # http://localhost:3000
```

## Deployment

Pushed to GitHub (`viggorey/lab-inventory`) and auto-deployed via Vercel. Environment variables must be set in the Vercel dashboard.

## Key patterns

- All pages under `/inventory`, `/manuals`, `/publications`, `/other` are wrapped in `AuthGuard`
- Supabase client is a lazy proxy singleton (safe for SSR/Next.js build)
- Admin-only actions (edit, delete, upload) are gated both in RLS and in UI (`isAdmin` from `useAuth`)
- Toast notifications via `useToast`, confirm dialogs via `useConfirm`
- Inventory supports Excel import/export via the `xlsx` library
- FullCalendar is used for equipment booking UI
