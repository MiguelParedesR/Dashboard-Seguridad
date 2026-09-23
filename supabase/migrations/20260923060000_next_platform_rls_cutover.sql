-- FASE 13 — RLS/backend hardening for the Next-only cutover.
-- Apply ONLY to the TPP project (ref qjefbngewwthawycvutl) after the legacy browser clients are retired.
-- The Next.js server uses service_role; browser sessions never receive service_role credentials.

begin;

-- Sensitive operational tables are server-only after cutover.
do $$
declare
  t text;
begin
  foreach t in array array[
    'usuarios','colaboradores','locales','lockers','solicitudes_locker','asignaciones_locker',
    'movimientos_llaves','incidencias_llaves','historial_locker','incidencias','inspecciones'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on table public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- Remove direct browser execution for transactional RPCs now mediated by Next Route Handlers.
do $$
declare
  r record;
begin
  for r in
    select n.nspname as schema_name, p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'public' and p.proname in (
      'rpc_aprobar_solicitud','rpc_rechazar_solicitud','rpc_registrar_entrega',
      'rpc_registrar_devolucion','rpc_resolver_incidencia_llave'
    )) or (n.nspname = 'app' and p.proname in (
      'admin_listar_locales','admin_crear_local','admin_crear_lockers','admin_eliminar_local'
    ))
  loop
    execute format('revoke execute on function %I.%I(%s) from anon, authenticated', r.schema_name, r.function_name, r.args);
  end loop;
end $$;

-- Storage writes are performed only by the server service-role routes. Existing public object delivery
-- can remain enabled at bucket level where historical evidence URLs already depend on it.

commit;
