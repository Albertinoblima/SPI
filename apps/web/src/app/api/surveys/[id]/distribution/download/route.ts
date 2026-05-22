import { NextRequest } from 'next/server';
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';
import { apiError, handleApiUnhandledError } from '@/lib/api-middleware';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSurveyAuthContext, surveyBelongsToTenant } from '@/lib/surveys/auth-context';

interface RouteParams {
    params: { id: string };
}

type DistributionRow = {
    interviewer_id: string;
    locality_id: string;
    zone: string;
    gender: string;
    age_group: string;
    quota_total: number;
    users?: { full_name?: string };
    survey_localities?: { name?: string };
};

function groupByInterviewer(rows: DistributionRow[]) {
    const grouped = new Map<string, DistributionRow[]>();
    rows.forEach((row) => {
        const key = row.interviewer_id;
        const list = grouped.get(key) ?? [];
        list.push(row);
        grouped.set(key, list);
    });
    return grouped;
}

async function createPdf(rows: DistributionRow[], surveyTitle: string) {
    return await new Promise<Buffer>((resolve) => {
        const doc = new PDFDocument({ margin: 42, size: 'A4' });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        doc.fontSize(18).text(`Controle Geral de Coleta - ${surveyTitle}`);
        doc.moveDown(0.8);

        const grouped = groupByInterviewer(rows);
        let controlIndex = 1;

        grouped.forEach((records) => {
            const interviewerName = records[0]?.users?.full_name ?? 'Entrevistador';
            doc.fontSize(12).text(`Controle ${controlIndex} - ${interviewerName}`);
            doc.moveDown(0.4);
            records.forEach((row) => {
                doc
                    .fontSize(10)
                    .text(
                        `${row.survey_localities?.name ?? '-'} | ${row.zone} | ${row.gender}/${row.age_group} | ${row.quota_total}`,
                    );
            });
            doc.moveDown(1);
            doc.text('Assinatura do entrevistador: ______________________');
            doc.addPage();
            controlIndex += 1;
        });

        doc.end();
    });
}

async function createDocx(rows: DistributionRow[], surveyTitle: string) {
    const children: Paragraph[] = [
        new Paragraph({ text: `Controle Geral de Coleta - ${surveyTitle}`, heading: HeadingLevel.HEADING_1 }),
    ];

    const grouped = groupByInterviewer(rows);
    let controlIndex = 1;

    grouped.forEach((records) => {
        const interviewerName = records[0]?.users?.full_name ?? 'Entrevistador';
        children.push(new Paragraph({ text: `Controle ${controlIndex} - ${interviewerName}`, heading: HeadingLevel.HEADING_2 }));

        records.forEach((row) => {
            children.push(
                new Paragraph({
                    text: `${row.survey_localities?.name ?? '-'} | ${row.zone} | ${row.gender}/${row.age_group} | ${row.quota_total}`,
                }),
            );
        });

        children.push(new Paragraph({ text: 'Assinatura do entrevistador: ______________________' }));
        children.push(new Paragraph({ text: '' }));
        controlIndex += 1;
    });

    const document = new Document({ sections: [{ children }] });
    return await Packer.toBuffer(document);
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const ctx = await getSurveyAuthContext();
        if (!ctx) return apiError('Nao autenticado', 401);

        const survey = await surveyBelongsToTenant(params.id, ctx.tenantId);
        if (!survey) return apiError('Pesquisa nao encontrada', 404);

        const format = request.nextUrl.searchParams.get('format')?.toLowerCase();
        if (format !== 'pdf' && format !== 'docx') {
            return apiError('Formato invalido. Use format=pdf ou format=docx', 400);
        }

        const admin = createAdminClient();
        const { data: rows, error } = await admin
            .from('survey_distribution_quotas')
            .select('interviewer_id, locality_id, zone, gender, age_group, quota_total, users(full_name), survey_localities(name)')
            .eq('survey_id', params.id)
            .eq('tenant_id', ctx.tenantId)
            .order('interviewer_id', { ascending: true });

        if (error) return apiError(`Falha ao montar controle: ${error.message}`, 500);
        if (!rows || rows.length === 0) return apiError('Nao ha distribuicao para gerar documento', 400);

        if (format === 'pdf') {
            const pdfBuffer = await createPdf(rows as DistributionRow[], survey.title);
            return new Response(new Uint8Array(pdfBuffer), {
                status: 200,
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="controle-campo-${params.id}.pdf"`,
                },
            });
        }

        const docxBuffer = await createDocx(rows as DistributionRow[], survey.title);
        return new Response(new Uint8Array(docxBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename="controle-campo-${params.id}.docx"`,
            },
        });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/surveys/[id]/distribution/download', operation: 'GET', surveyId: params.id },
        });
    }
}
