import { NextRequest } from 'next/server';
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { apiError, handleApiUnhandledError } from '@/lib/api-middleware';
import { createAuditedSupabaseAdminClient } from '@political-research/shared-utils';
import { getSurveyAuthContext, surveyBelongsToTenant } from '@/lib/surveys/auth-context';
import { normalizeQuestions } from '@/lib/surveys/documents';
import { buildCorrelationId } from '@/lib/monitoring/error-monitor';

interface RouteParams {
    params: { id: string };
}

function datePtBr(value?: string | null) {
    if (!value) return '-';
    const dt = new Date(value);
    return Number.isNaN(dt.getTime()) ? '-' : dt.toLocaleDateString('pt-BR');
}

async function buildPdfBuffer(payload: {
    title: string;
    started_at?: string | null;
    created_by_name?: string | null;
    questions: Array<{ question_text?: string; options?: Array<{ label?: string; value?: string }> }>;
    premises: Array<{ label?: string; options?: Array<{ label?: string; quota_pct?: number }> }>;
}) {
    return await new Promise<Buffer>((resolve) => {
        const doc = new PDFDocument({ margin: 48, size: 'A4' });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        doc.fontSize(20).text(payload.title, { align: 'left' });
        doc.moveDown(0.5);
        doc.fontSize(10).text(`Data: ${datePtBr(payload.started_at)}`);
        doc.fontSize(10).text(`Responsavel: ${payload.created_by_name ?? '-'}`);
        doc.moveDown(1.2);

        doc.fontSize(14).text('Questoes', { underline: true });
        doc.moveDown(0.6);

        payload.questions.forEach((q, idx) => {
            doc.fontSize(12).text(`${idx + 1}. ${q.question_text ?? '-'}`);
            (q.options ?? []).forEach((opt) => {
                doc.fontSize(10).text(`   - ${opt.label ?? opt.value ?? '-'}`);
            });
            doc.moveDown(0.4);
        });

        doc.moveDown(0.8);
        doc.fontSize(14).text('Perfil do Entrevistado (premissas/cotas)', { underline: true });
        doc.moveDown(0.6);

        payload.premises.forEach((premise) => {
            const formatted = (premise.options ?? [])
                .map((opt) => `${opt.label ?? '-'}${typeof opt.quota_pct === 'number' ? ` (${opt.quota_pct}%)` : ''}`)
                .join(', ');
            doc.fontSize(10).text(`- ${premise.label ?? '-'}: ${formatted || '-'}`);
        });

        doc.end();
    });
}

async function buildDocxBuffer(payload: {
    title: string;
    started_at?: string | null;
    created_by_name?: string | null;
    questions: Array<{ question_text?: string; options?: Array<{ label?: string; value?: string }> }>;
    premises: Array<{ label?: string; options?: Array<{ label?: string; quota_pct?: number }> }>;
}) {
    const children: Paragraph[] = [
        new Paragraph({ text: payload.title, heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ children: [new TextRun(`Data: ${datePtBr(payload.started_at)}`)] }),
        new Paragraph({ children: [new TextRun(`Responsavel: ${payload.created_by_name ?? '-'}`)] }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: 'Questoes', heading: HeadingLevel.HEADING_2 }),
    ];

    payload.questions.forEach((q, idx) => {
        children.push(new Paragraph({ text: `${idx + 1}. ${q.question_text ?? '-'}` }));
        (q.options ?? []).forEach((opt) => {
            children.push(new Paragraph({ text: `- ${opt.label ?? opt.value ?? '-'}` }));
        });
        children.push(new Paragraph({ text: '' }));
    });

    children.push(new Paragraph({ text: 'Perfil do Entrevistado (premissas/cotas)', heading: HeadingLevel.HEADING_2 }));
    payload.premises.forEach((premise) => {
        const formatted = (premise.options ?? [])
            .map((opt) => `${opt.label ?? '-'}${typeof opt.quota_pct === 'number' ? ` (${opt.quota_pct}%)` : ''}`)
            .join(', ');
        children.push(new Paragraph({ text: `- ${premise.label ?? '-'}: ${formatted || '-'}` }));
    });

    const document = new Document({
        sections: [{ children }],
    });

    return await Packer.toBuffer(document);
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    const correlationId = buildCorrelationId(request.headers.get('x-correlation-id') ?? undefined);
    try {
        const ctx = await getSurveyAuthContext();
        if (!ctx) return apiError('Nao autenticado', 401, correlationId);

        const survey = await surveyBelongsToTenant(params.id, ctx.tenantId);
        if (!survey) return apiError('Pesquisa nao encontrada', 404, correlationId);

        const format = request.nextUrl.searchParams.get('format')?.toLowerCase();
        if (format !== 'pdf' && format !== 'docx') {
            return apiError('Formato invalido. Use format=pdf ou format=docx', 400, correlationId);
        }

        const admin = createAuditedSupabaseAdminClient('questionnaire-download');
        const { data, error } = await admin
            .from('surveys')
            .select('title, started_at, users!surveys_created_by_fkey(full_name), questions(*), survey_premises(*)')
            .eq('id', params.id)
            .eq('tenant_id', ctx.tenantId)
            .single();

        if (error || !data) {
            return apiError(`Falha ao montar questionario: ${error?.message ?? 'desconhecido'}`, 500, correlationId);
        }

        const usersRelation = data.users as { full_name?: string } | Array<{ full_name?: string }> | null;

        const payload = {
            title: data.title,
            started_at: data.started_at,
            created_by_name: (Array.isArray(usersRelation) ? usersRelation[0]?.full_name : usersRelation?.full_name) ?? null,
            questions: normalizeQuestions(data.questions ?? []),
            premises: data.survey_premises ?? [],
        };

        if (format === 'pdf') {
            const pdfBuffer = await buildPdfBuffer(payload);
            return new Response(new Uint8Array(pdfBuffer), {
                status: 200,
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="questionario-${params.id}.pdf"`,
                    'Cache-Control': 'no-store',
                },
            });
        }

        const docxBuffer = await buildDocxBuffer(payload);
        return new Response(new Uint8Array(docxBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename="questionario-${params.id}.docx"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/surveys/[id]/questionnaire/download', operation: 'GET', surveyId: params.id },
        });
    }
}
