import { redirect } from 'next/navigation';
import AppShell from '@/components/shell/AppShell';
import { getSession } from '@/lib/auth/session';

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role === 'colaborador') redirect('/colaborador');
  return <AppShell role={session.role} nombre={session.nombre}>{children}</AppShell>;
}
