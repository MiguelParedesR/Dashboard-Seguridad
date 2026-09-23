import { redirect } from 'next/navigation';
import { defaultAppRoute, getSession } from '@/lib/auth/session';

export default async function Home() {
  const session = await getSession();
  if (!session) redirect('/login');
  redirect(defaultAppRoute(session.role));
}
