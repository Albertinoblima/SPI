type QuestionLike = {
    order_index?: number;
    question_text?: string;
    question_type?: string;
    options?: Array<{ label?: string; value?: string }>;
};

type PremiseLike = {
    label?: string;
    options?: Array<{ label?: string; quota_pct?: number }>;
};

type SurveyDocumentInput = {
    title: string;
    started_at?: string | null;
    created_by_name?: string | null;
    questions: QuestionLike[];
    premises: PremiseLike[];
};

function safeDate(value?: string | null) {
    if (!value) return '-';
    const dt = new Date(value);
    return Number.isNaN(dt.getTime()) ? '-' : dt.toLocaleDateString('pt-BR');
}

export function normalizeQuestions(questions: QuestionLike[]) {
    return [...questions].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
}

export function buildQuestionnaireHtml(input: SurveyDocumentInput) {
    const questions = normalizeQuestions(input.questions);
    const headerDate = safeDate(input.started_at);
    const responsible = input.created_by_name?.trim() || 'Nao informado';

    const questionRows = questions
        .map((q, idx) => {
            const options = Array.isArray(q.options) ? q.options : [];
            const list = options.length
                ? `<ul>${options.map((opt) => `<li>${opt.label ?? opt.value ?? '-'}</li>`).join('')}</ul>`
                : '';

            return `
            <section class="question">
              <h3>${idx + 1}. ${q.question_text ?? '-'}</h3>
              ${list}
            </section>
          `;
        })
        .join('');

    const premiseRows = input.premises
        .map((premise) => {
            const options = Array.isArray(premise.options) ? premise.options : [];
            const items = options.map((opt) => `${opt.label ?? '-'}${typeof opt.quota_pct === 'number' ? ` (${opt.quota_pct}%)` : ''}`);
            return `<li><strong>${premise.label ?? '-'}</strong>: ${items.join(', ') || '-'}</li>`;
        })
        .join('');

    return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Questionario - ${input.title}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #0f172a; }
    .header { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 22px; }
    .meta { color: #334155; font-size: 14px; margin-top: 6px; }
    h2 { margin-top: 26px; font-size: 18px; border-left: 4px solid #2563eb; padding-left: 8px; }
    .question { margin: 14px 0; }
    .question h3 { margin: 0 0 8px 0; font-size: 16px; }
    ul { margin: 0 0 0 20px; }
    li { margin: 4px 0; }
  </style>
</head>
<body>
  <header class="header">
    <h1>${input.title}</h1>
    <div class="meta">Data: ${headerDate}</div>
    <div class="meta">Responsavel: ${responsible}</div>
  </header>

  <h2>Questoes</h2>
  ${questionRows || '<p>Nenhuma questao cadastrada.</p>'}

  <h2>Perfil do Entrevistado (premissas/cotas)</h2>
  <ul>
    ${premiseRows || '<li>Nenhuma premissa cadastrada.</li>'}
  </ul>
</body>
</html>`;
}
