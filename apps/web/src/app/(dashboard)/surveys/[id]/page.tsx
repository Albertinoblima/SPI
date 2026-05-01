'use client';

import { useParams } from 'next/navigation';
import { SurveyBuilder } from '@/components/dashboard/SurveyBuilder';

export default function SurveyBuilderPage() {
    const { id } = useParams<{ id: string }>();

    const handleSave = async (data: { title: string; description: string; questions: any[] }) => {
        // TODO: Call Supabase to persist survey + questions
        console.log('Saving survey:', id, data);
    };

    return (
        <SurveyBuilder
            surveyId={id}
            onSave={handleSave}
        />
    );
}
