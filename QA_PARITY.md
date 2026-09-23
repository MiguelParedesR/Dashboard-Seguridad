# FASE 15 — Parity matrix

| Dominio | Superficie Next | Estado de migración |
|---|---|---|
| Auth staff | `/login` + HttpOnly session | Migrado |
| Auth colaborador | `/colaborador` + HttpOnly session | Migrado |
| Lockers vista general | `/lockers` | Migrado |
| Solicitudes | `/lockers/solicitudes` | Migrado |
| Entrega / devolución / evidencias | `/lockers/entrega/*`, `/lockers/devolucion/*` | Migrado |
| Incidencias de llaves | `/lockers/incidencias` | Migrado |
| Historial lockers | `/lockers/historial` | Migrado |
| Incidencias generales | `/incidencias` | Migrado desde Formulario-Mamparas |
| Mamparas | `/mamparas` | Migrado desde Formulario-Mamparas |
| Reportes | `/reportes` + `/api/reportes` | Migrado |
| Administración lockers | `/admin` | Migrado |
| Storage operativo | Route Handlers server-side | Migrado |
| RLS cutover | migración `20260923060000_next_platform_rls_cutover.sql` | Preparada; aplicar solo en TPP |

## Gate automatizado
`npm run qa:platform` valida la presencia de superficies críticas y que un Client Component no importe el cliente Supabase service-role ni use almacenamiento del navegador para decidir autenticación/sesión.

`npm run ci:smoke` ejecuta QA + TypeScript + build.

## Evidencia pendiente de entorno
La migración RLS y el smoke contra datos reales requieren acceso al proyecto Supabase TPP `qjefbngewwthawycvutl`. El conector disponible en la sesión actual no expone ese proyecto.
