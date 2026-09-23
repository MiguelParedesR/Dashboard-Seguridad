# FASE 16 — Cutover Next Platform

The production target is the Next.js application on `modernization/next-platform`.

## Legacy retirement already applied on this branch
- Removed the Vite entrypoint (`vite.config.js`).
- Removed the legacy GitHub Pages deployment workflow.
- `package.json` is Next-only.
- New deployments use the standalone Next build / Docker image.
- The historical `react/` source remains temporarily as rollback/reference material only; it has no active build entrypoint or deployment workflow.

## Production cutover gate
Do not fast-forward/merge `master` until all of the following are true:
1. `npm run ci:smoke` passes in a functioning runner.
2. The Next deployment has real TPP server secrets configured.
3. Admin, CCTV and Colaborador smoke tests pass against TPP data.
4. Apply `supabase/migrations/20260923060000_next_platform_rls_cutover.sql` to Supabase project `qjefbngewwthawycvutl`.
5. Re-run smoke tests after RLS hardening.
6. Configure the production URL and then retire/redirect the Formulario-Mamparas public entrypoint.

## Rollback
Until the production gate is complete, keep the legacy source history available. Rollback is performed by restoring the prior deployment; do not re-enable direct browser writes after the RLS cutover without explicitly restoring the old grants.
