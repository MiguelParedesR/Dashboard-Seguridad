import { redirect } from 'next/navigation';
import LoginForm from '@/components/auth/LoginForm';
import { defaultStaffRoute, getSession, isStaffRole } from '@/lib/auth/session';

export default async function LoginPage() {
  const session = await getSession();
  if (session && isStaffRole(session.role)) redirect(defaultStaffRoute(session.role));
  return <LoginForm />;
}
