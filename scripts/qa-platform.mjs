import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'app/login/page.tsx',
  'app/colaborador/page.tsx',
  'app/(platform)/lockers/page.tsx',
  'app/(platform)/lockers/solicitudes/page.tsx',
  'app/(platform)/lockers/incidencias/page.tsx',
  'app/(platform)/lockers/historial/page.tsx',
  'app/(platform)/incidencias/page.tsx',
  'app/(platform)/mamparas/page.tsx',
  'app/(platform)/reportes/page.tsx',
  'app/(platform)/admin/page.tsx',
  'app/api/lockers/overview/route.ts',
  'app/api/lockers/solicitudes/route.ts',
  'app/api/lockers/movimientos/route.ts',
  'app/api/lockers/incidencias/route.ts',
  'app/api/lockers/historial/route.ts',
  'app/api/incidencias/route.ts',
  'app/api/mamparas/inspecciones/route.ts',
  'app/api/reportes/route.ts'
];

const failures = [];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`Missing required surface: ${file}`);
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const browserFiles = [...walk(path.join(root, 'app')), ...walk(path.join(root, 'components'))]
  .filter((file) => /\.(ts|tsx|js|jsx)$/.test(file));

for (const file of browserFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const rel = path.relative(root, file).replaceAll('\\', '/');
  if (text.includes("@/lib/supabase/admin") && text.includes("'use client'")) {
    failures.push(`Client imports service-role module: ${rel}`);
  }
  if ((text.includes('localStorage') || text.includes('sessionStorage')) && /auth|role|session/i.test(text)) {
    failures.push(`Browser storage participates in auth/session logic: ${rel}`);
  }
}

const securityMigration = 'supabase/migrations/20260923060000_next_platform_rls_cutover.sql';
if (!fs.existsSync(path.join(root, securityMigration))) failures.push(`Missing security cutover migration: ${securityMigration}`);

if (failures.length) {
  console.error('NEXT_PLATFORM_QA_FAIL');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`NEXT_PLATFORM_QA_PASS required_surfaces=${required.length} browser_files=${browserFiles.length}`);
