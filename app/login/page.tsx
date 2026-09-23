import { redirect } from 'next/navigation';
import LoginForm from '@/components/auth/LoginForm';
import { defaultAppRoute, getSession } from '@/lib/auth/session';

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(defaultAppRoute(session.role));
  return <LoginForm />;
}
