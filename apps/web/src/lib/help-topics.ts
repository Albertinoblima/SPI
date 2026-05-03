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
    {
        id: 'premises-overview',
        title: 'Premissas e Cotas',
        short: 'Premissas ajudam a equilibrar o perfil dos entrevistados e melhorar a representatividade da coleta.',
        content: [
            'Use premissas para controlar segmentos como sexo, idade, renda e territorio.',
            'Defina cotas quando houver meta percentual por segmento.',
            'Revise as cotas com base na populacao de referencia e no objetivo da pesquisa.',
        ],
    },
    {
        id: 'premises-label',
        title: 'Rotulo da Premissa',
        short: 'O rotulo e o nome exibido para o entrevistador e nos relatorios analiticos.',
        content: [
            'Use nomes claros e sem ambiguidade.',
            'Exemplos: Faixa etaria, Renda familiar, Escolaridade.',
            'Evite abreviacoes internas que prejudiquem leitura do time de campo.',
        ],
    },
    {
        id: 'premises-category-key',
        title: 'Categoria (Chave Interna)',
        short: 'A chave interna identifica tecnicamente a premissa no banco e em integracoes.',
        content: [
            'Padrao recomendado: minusculo com underscore.',
            'Evite acentos e espacos para reduzir erros de integracao.',
            'Mantenha consistencia entre ondas da mesma pesquisa.',
        ],
    },
    {
        id: 'premises-options-quotas',
        title: 'Opcoes e Cota Percentual',
        short: 'Cada opcao representa um segmento; a cota percentual define meta esperada para aquele grupo.',
        content: [
            'A cota pode ser opcional em pesquisas exploratorias.',
            'Quando usada, o ideal e que a soma se aproxime de 100%.',
            'Monitore desvios durante a coleta para corrigir distribuicao de campo.',
        ],
    },
    {
        id: 'premises-multi-select',
        title: 'Multipla Selecao em Premissas',
        short: 'Ative apenas quando o respondente puder pertencer legitimamente a mais de um grupo ao mesmo tempo.',
        content: [
            'Exemplo valido: bairros frequentados, canais de informacao.',
            'Exemplo nao recomendado: sexo biologico em recortes exclusivos.',
            'Multipla selecao altera leitura estatistica e deve ser planejada previamente.',
        ],
    },
    {
        id: 'questionnaire-overview',
        title: 'Construcao do Questionario',
        short: 'A ordem e o tipo das perguntas impactam qualidade da resposta e taxa de conclusao.',
        content: [
            'Comece com perguntas simples para aquecimento do entrevistado.',
            'Agrupe blocos tematicos para manter fluidez cognitiva.',
            'Deixe perguntas sensiveis para momentos posteriores quando houver rapport.',
        ],
    },
    {
        id: 'question-type',
        title: 'Tipo de Pergunta',
        short: 'Escolha o tipo conforme a natureza da informacao: opiniao, fato, escala, registro ou evidencias.',
        content: [
            'Escolha unica: decisao entre alternativas excludentes.',
            'Multipla escolha: permite combinacao de alternativas.',
            'Texto livre: captura justificativas e nuances qualitativas.',
        ],
    },
    {
        id: 'question-required',
        title: 'Pergunta Obrigatoria',
        short: 'Marque como obrigatoria apenas o que for essencial para o objetivo analitico.',
        content: [
            'Excesso de obrigatoriedade aumenta abandono e atrito de coleta.',
            'Perguntas criticas para filtros e indicadores devem ser obrigatorias.',
            'Tenha estrategia para dados faltantes em perguntas opcionais.',
        ],
    },
    {
        id: 'question-options',
        title: 'Opcoes de Resposta',
        short: 'Opcoes bem definidas melhoram comparabilidade e reduzem erro de interpretacao.',
        content: [
            'Evite sobreposicao semantica entre alternativas.',
            'Use linguagem do publico alvo e nao jargoes internos.',
            'Inclua opcoes de escape quando apropriado (nao sabe, nao respondeu).',
        ],
    },
    {
        id: 'question-order',
        title: 'Ordem das Perguntas',
        short: 'A sequencia pode introduzir vies de priming; organize do geral para o especifico.',
        content: [
            'Use drag and drop para montar fluxo coerente.',
            'Evite alternar temas de forma brusca.',
            'Revise a ordem final em modo de pre-visualizacao.',
        ],
    },
];

export const HELP_TOPICS_BY_ID = Object.fromEntries(HELP_TOPICS.map((topic) => [topic.id, topic])) as Record<string, HelpTopic>;

export const HELP_HOVER_EVENT = 'survey-help-hover';
