'use client';

import { useParams } from 'next/navigation';
import { ResultsDashboard } from '../../../../components/results-dashboard';

export default function ResultsPage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <main className="page-shell auth-background-page results-background-page">
      <ResultsDashboard assessmentId={id} />
    </main>
  );
}
