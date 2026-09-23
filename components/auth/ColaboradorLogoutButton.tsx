'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ColaboradorLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    if (loading) return;
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/colaborador');
      router.refresh();
    }
  }

  return (
    <button className="btn btn-secondary" style={{ width: '100%', marginTop: 18 }} onClick={logout} disabled={loading} type="button">
      {loading ? 'Cerrando sesión…' : 'Cerrar sesión'}
    </button>
  );
}
