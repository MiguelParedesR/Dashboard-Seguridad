import { notFound } from 'next/navigation';
import AssignmentMovementForm from '@/components/lockers/AssignmentMovementForm';
import { readAssignmentById } from '@/lib/lockers/assignments';

export default async function DevolucionPage({ params }: { params: Promise<{ asignacionId: string }> }) {
  const { asignacionId } = await params;
  const assignment = await readAssignmentById(asignacionId);
  if (!assignment || !assignment.activa || assignment.cerrada) notFound();

  return (
    <main>
      <div className="page-head">
        <div>
          <div className="eyebrow">Lockers · devolución</div>
          <h1>Registrar devolución</h1>
          <p>Cierre operativo con evidencia y contraste entre llaves declaradas y esperadas.</p>
        </div>
      </div>
      <AssignmentMovementForm mode="devolucion" assignment={assignment} />
    </main>
  );
}
