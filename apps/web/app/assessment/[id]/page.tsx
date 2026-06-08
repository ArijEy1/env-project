'use client';

import { useParams } from 'next/navigation';
import { AssessmentWizard } from '../../../components/assessment-wizard';

export default function AssessmentPage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <main className="page-shell auth-background-page wizard-background-page">
      <AssessmentWizard assessmentId={id} />
    </main>
  );
}
