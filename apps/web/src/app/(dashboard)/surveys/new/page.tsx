'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { SurveyWizard } from '@/components/surveys/SurveyWizard';

function NewSurveyContent() {
    const searchParams = useSearchParams();
    const draftId = searchParams.get('draft') ?? undefined;
    const planId = searchParams.get('planId') ?? undefined;   // Support for rich 5-step planning handoff

    return <SurveyWizard draftId={draftId} planId={planId} />;
}

export default function NewSurveyPage() {
    return (
        <Suspense>
            <NewSurveyContent />
        </Suspense>
    );
}
