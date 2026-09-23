import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TPP Seguridad',
  description: 'Plataforma integral de seguridad, incidencias, mamparas y lockers'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
