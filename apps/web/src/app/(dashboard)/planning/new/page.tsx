"use client";
// Início do fluxo passo a passo de planejamento
// Redireciona para o passo 1
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PlanningNewPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/planning/new/steps/1');
    }, [router]);
    return null;
}
