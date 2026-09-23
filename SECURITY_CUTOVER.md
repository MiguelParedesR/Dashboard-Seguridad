# FASE 13 — Security cutover

Target Supabase project: `qjefbngewwthawycvutl` (TPP only).

## Required order
1. Deploy the Next.js application with `SUPABASE_SERVICE_ROLE_KEY` and `SESSION_SECRET` as server-only secrets.
2. Verify staff and collaborator flows use only Next Route Handlers / server actions.
3. Retire the legacy React/Vite and Formulario-Mamparas browser clients.
4. Apply `supabase/migrations/20260923060000_next_platform_rls_cutover.sql` to the TPP project.
5. Re-run smoke tests for Admin, CCTV and Colaborador roles.

## Security invariants
- `SUPABASE_SERVICE_ROLE_KEY` is never exposed with `NEXT_PUBLIC_`.
- Browser requests never choose their role or user id; identity comes from the signed HttpOnly session.
- Operational writes are server-side only.
- Transactional locker workflows continue through database RPCs.
- General incidents, inspections, reporting, storage and administration are protected by server role checks.
- `anon` and `authenticated` lose direct table access at the final cutover.

## Verification SQL
```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('usuarios','colaboradores','locales','lockers','solicitudes_locker','asignaciones_locker','movimientos_llaves','incidencias_llaves','historial_locker','incidencias','inspecciones')
order by tablename;
```

Do not apply this migration to any non-TPP Supabase project.
