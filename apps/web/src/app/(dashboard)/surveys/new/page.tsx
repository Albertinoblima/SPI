'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { SurveyWizard } from '@/components/surveys/SurveyWizard';

function NewSurveyContent() {
    const searchParams = useSearchParams();
    const draftId = searchParams.get('draft') ?? undefined;
    return <SurveyWizard draftId={draftId} />;
}

export default function NewSurveyPage() {
    return (
        <Suspense>
            <NewSurveyContent />
        </Suspense>
    );
}
