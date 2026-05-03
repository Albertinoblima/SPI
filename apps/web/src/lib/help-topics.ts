export interface HelpTopic {
    id: string;
    title: string;
    short: string;
    content: string[];
}

export const HELP_TOPICS: HelpTopic[] = [
    {
        id: 'survey-title',
        title: 'Titulo da Pesquisa',
        short: 'Use um titulo objetivo e unico para identificar a pesquisa em relatorios e dashboards.',
        content: [
            'Evite titulos genericos como "Pesquisa 01".',
            'Inclua tema, local e periodo quando possivel.',
            'Padrao sugerido: Tema - Local - Mes/Ano.',
        ],
    },
    {
        id: 'survey-type',
        title: 'Tipo de Pesquisa',
        short: 'O tipo define o metodo, as regras de amostragem e como as metas por localidade serao calculadas.',
        content: [
            'Quantitativas amostrais usam margem de erro e intervalo de confianca.',
            'Censo/cadastro usa cobertura total ou meta operacional definida pela gestao.',
            'Qualitativas usam metas por criterio, sem inferencia estatistica classica.',
        ],
    },
    {
        id: 'target-audience',
        title: 'Publico-alvo',
        short: 'Descreva com precisao quem pode ser entrevistado para reduzir vies de coleta.',
        content: [
            'Defina criterio de inclusao e exclusao.',
            'Exemplo: eleitores de 16+ residentes ha pelo menos 6 meses.',
            'Esse campo orienta treinamento da equipe e validacao em campo.',
        ],
    },
    {
        id: 'margin-error',
        title: 'Margem de Erro',
        short: 'Indica a variacao maxima esperada para os resultados da amostra.',
        content: [
            'Quanto menor a margem, maior o tamanho de amostra necessario.',
            'Faixa comum em pesquisas publicas: 3% a 5%.',
            'Nao se aplica a pesquisas qualitativas puras.',
        ],
    },
    {
        id: 'confidence-interval',
        title: 'Intervalo de Confianca',
        short: 'Representa o nivel de confianca estatistica da estimativa amostral.',
        content: [
            '95% e o padrao mais adotado.',
            'Valores maiores elevam o tamanho de amostra.',
            'Deve ser interpretado junto com margem de erro e plano amostral.',
        ],
    },
    {
        id: 'survey-period',
        title: 'Periodo de Coleta',
        short: 'Defina datas realistas para planejamento de campo, supervisao e fechamento.',
        content: [
            'Considere feriados, eventos locais e janela de supervisao.',
            'Use periodo mais curto quando o tema for sensivel a variacoes rapidas.',
            'Datas alimentam relatorios operacionais e controle de SLA.',
        ],
    },
    {
        id: 'survey-objective',
        title: 'Objetivo da Pesquisa',
        short: 'O objetivo orienta questionario, amostragem e analise final.',
        content: [
            'Escreva o problema de negocio que a pesquisa precisa responder.',
            'Use verbos claros: medir, comparar, identificar, priorizar.',
            'Evite objetivo amplo demais para uma unica coleta.',
        ],
    },
    {
        id: 'survey-methodology',
        title: 'Metodologia',
        short: 'Registre desenho metodologico, tecnica de coleta e estrategia de analise.',
        content: [
            'Informe se o desenho e probabilistico, nao probabilistico ou misto.',
            'Descreva abordagem de campo: presencial, telefonica, online ou hibrida.',
            'Documente criterios de qualidade e auditoria da coleta.',
        ],
    },
    {
        id: 'registered-research',
        title: 'Pesquisa Registrada',
        short: 'Quando exigido, informe responsavel tecnico, numero de registro e orgao de classe.',
        content: [
            'Esses dados fortalecem rastreabilidade e conformidade.',
            'Use formato oficial do cadastro para facilitar auditoria.',
            'Mantenha o registro atualizado em cada nova onda de pesquisa.',
        ],
    },
    {
        id: 'collection-resources',
        title: 'Recursos da Coleta',
        short: 'Ative somente os recursos necessarios para reduzir friccao no app de campo.',
        content: [
            'Geolocalizacao: valida presenca no ponto de entrevista.',
            'Foto/assinatura: aumenta lastro probatorio em operacoes sensiveis.',
            'Modo offline: essencial para areas com conectividade instavel.',
        ],
    },
    {
        id: 'localities-method',
        title: 'Metas por Localidade',
        short: 'A distribuicao por localidade muda conforme o tipo da pesquisa.',
        content: [
            'Tipos amostrais usam estimativa automatica por formula para populacao finita.',
            'Tipos qualitativos/censo usam meta manual por estrategia operacional.',
            'Sempre revise pesos finais para evitar concentracao excessiva em uma unica area.',
        ],
    },
    {
        id: 'localities-zone',
        title: 'Zona da Localidade',
        short: 'A zona ajuda no desenho logistico e no balanceamento do campo.',
        content: [
            'Use urbana/rural/mista conforme realidade da coleta.',
            'Essa classificacao ajuda a estimar deslocamento, tempo e custo.',
            'Tambem pode orientar distribuicao de equipe e supervisao.',
        ],
    },
    {
        id: 'localities-population',
        title: 'Populacao de Referencia',
        short: 'Use a base populacional correta para o calculo de entrevistas.',
        content: [
            'Em eleitorais, prefira base de eleitores validada.',
            'Em estudos territoriais gerais, use habitantes.',
            'Bases inconsistentes distorcem cotas e inferencia final.',
        ],
    },
    {
        id: 'localities-manual-target',
        title: 'Meta Manual de Entrevistas',
        short: 'Quando nao houver amostragem estatistica, defina a meta operacional por localidade.',
        content: [
            'Considere capacidade de campo, prazo e objetivo analitico.',
            'Registre justificativa interna para auditoria e aprendizado futuro.',
            'Ajuste metas por complexidade de acesso e perfil do publico.',
        ],
    },
    {
        id: 'survey-internal-notes',
        title: 'Observacoes Internas',
        short: 'Use para registrar riscos, acordos de operacao e restricoes de coleta.',
        content: [
            'Nao coloque dados sensiveis desnecessarios.',
            'Documente decisoes metodologicas nao obvias.',
            'Esse historico melhora a reproducao de ondas futuras.',
        ],
    },
];

export const HELP_TOPICS_BY_ID = Object.fromEntries(HELP_TOPICS.map((topic) => [topic.id, topic])) as Record<string, HelpTopic>;

export const HELP_HOVER_EVENT = 'survey-help-hover';
