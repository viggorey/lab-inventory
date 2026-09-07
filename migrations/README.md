# Database schema

The source of truth is **`supabase/migrations/0000_baseline.sql`** — the full
schema captured from the live database on 2026-09-07: all 12 tables, their
constraints and indexes, the functions, every RLS policy, and the three storage
buckets with their policies.

`supabase-setup.sql` used to live here and has been removed. It defined only 5
of the 12 tables and omitted `profiles`, so a rebuild from it produced an app
that could not authenticate anyone. It looked authoritative, which is what made
it dangerous.

## Files

| File | What it is |
|---|---|
| `supabase/migrations/0000_baseline.sql` | Full schema. Run this first on an empty project. |
| `migrations/2026-09-07_tighten_rls.sql` | Applied 2026-09-07. Restricts reads to approved users and closes a privilege-escalation hole. Already folded into the baseline. |
| `migrations/2026-09-07_tighten_rls_ROLLBACK.sql` | Reverts the above. Re-opens the holes — emergency use only. |
| `migrations/add_manual_equipment_junction.sql` | Historical. Already in the baseline. |
| `migrations/add_shared_links.sql` | Historical. Already in the baseline. |

## Refreshing the baseline

The project is on the free plan, which has no automated backups, so this file is
the only copy of the schema outside the Supabase dashboard. Re-capture it after
any schema change.

With the CLI (needs the database password from Project Settings → Database):

```
$env:SUPABASE_DB_PASSWORD = '<password>'
npx supabase db dump -f supabase/migrations/0000_baseline.sql --schema public
```

If the CLI cannot reach Postgres, the catalog can be read through the dashboard
SQL Editor instead — see the query in the project history, which returns
columns, constraints, indexes, triggers, functions and buckets as one JSON
document.
