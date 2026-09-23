import { notFound } from 'next/navigation';
import AssignmentMovementForm from '@/components/lockers/AssignmentMovementForm';
import { readAssignmentById } from '@/lib/lockers/assignments';

export default async function EntregaPage({ params }: { params: Promise<{ asignacionId: string }> }) {
  const { asignacionId } = await params;
  const assignment = await readAssignmentById(asignacionId);
  if (!assignment || !assignment.activa || assignment.cerrada) notFound();

  return (
    <main>
      <div className="page-head">
        <div>
          <div className="eyebrow">Lockers · entrega</div>
          <h1>Registrar entrega</h1>
          <p>Entrega posterior a la aprobación, con evidencia fotográfica y control de llaves.</p>
        </div>
      </div>
      <AssignmentMovementForm mode="entrega" assignment={assignment} />
    </main>
  );
}
