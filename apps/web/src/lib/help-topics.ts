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
        short: 'Quando marcada, informe os dados legais obrigatorios da contratacao, transparencia financeira e, se houver divulgacao publica, o registro no PesqEle.',
        content: [
            'Responsavel tecnico: nome, numero do cadastro e orgao de classe oficial.',
            'Contratante: nome da entidade/empresa e CNPJ ou CPF valido.',
            'Transparencia financeira: valor total da pesquisa, nota fiscal e origem dos recursos.',
            'Se for para divulgacao publica, o registro no Sistema PesqEle e obrigatorio.',
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
            'Tipos amostrais calculam entrevistas automaticamente pela formula para populacao finita.',
            'Tipos qualitativos/censo usam meta manual por estrategia operacional.',
            'O dimensionamento amostral completo e revisado na Etapa 3 antes do questionario.',
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
        short: 'Use a população base correta para o cálculo amostral de cada localidade.',
        content: [
            'Em pesquisas eleitorais, prefira base de eleitores validada.',
            'Em estudos territoriais gerais, use habitantes.',
            'Para abrangencia nacional, o sistema aplica populacao infinita no calculo amostral.',
            'Para cidade/localidade, use o botao de sugestao para consultar populacao municipal no IBGE.',
            'Quando houver correspondencia exata no IBGE, o valor exato e aplicado diretamente.',
            'Quando nao houver correspondencia exata, o sistema oferece sugestao inteligente para confirmacao manual.',
            'Bases inconsistentes distorcem cotas e inferência final.',
            'O valor informado aqui alimenta o dimensionamento amostral na Etapa 3.',
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
        title: 'Estratificação da Amostra',
        short: 'A estratificação da amostra define o perfil dos entrevistados e melhora a representatividade da coleta.',
        content: [
            'Use a estratificação para controlar segmentos como sexo, idade, renda e território.',
            'Defina cotas quando houver meta percentual por segmento.',
            'Revise as cotas com base na populacao de referencia e no objetivo da pesquisa.',
        ],
    },
    {
        id: 'premises-label',
        title: 'Rótulo da Estratificação',
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
        title: 'Múltipla Seleção na Estratificação',
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
    // ── Calculadora de Amostragem ────────────────────────────────────────────
    {
        id: 'sampling-calculator',
        title: 'Calculadora de Amostragem',
        short: 'Calcula o tamanho minimo de amostra necessario com base em parametros estatisticos padrao de mercado.',
        content: [
            'Usa a formula n = z² × p(1-p) / E² da estatistica inferencial.',
            'Modo automatico: ajuste nivel de confianca e margem para obter o n sugerido.',
            'Modo manual: voce insere diretamente os parametros e o total de entrevistas.',
            'O valor calculado pode ser ajustado manualmente para adequar capacidade operacional.',
            'Use configuracoes avancadas para populacoes finitas ou pesquisas por conglomerados.',
        ],
    },
    {
        id: 'total-interviews',
        title: 'Total de Entrevistas',
        short: 'Quantidade total de entrevistados necessarios para atingir a precisao estatistica declarada.',
        content: [
            'No modo automatico, e calculado pela formula padrao de amostragem.',
            'Pode ser ajustado manualmente para adequar ao orcamento ou capacidade de campo.',
            'A distribuicao por localidade e revisada na Etapa 3 (Dimensionamento Amostral).',
            'Arredondar para cima mantem ou melhora a precisao estatistica.',
        ],
    },
    {
        id: 'sample-size-review',
        title: 'Dimensionamento Amostral',
        short: 'Revisao do calculo do tamanho da amostra antes de elaborar o questionario.',
        content: [
            'Confira o total de entrevistas calculado com base na populacao base de cada localidade.',
            'Os parametros estatisticos (margem de erro, intervalo de confianca, Deff) vem da Etapa 1.',
            'Quando a abrangencia e nacional, o metodo usa populacao infinita (sem correcao finita por N).',
            'As populacoes base por localidade foram definidas na Etapa 2.',
            'Volte as etapas anteriores para ajustar qualquer parametro antes de prosseguir.',
            'Esta etapa e somente de revisao; nenhum dado e alterado aqui.',
        ],
    },
    {
        id: 'p-proportion',
        title: 'Estimativa de Proporcao (p)',
        short: 'Proporcao esperada do parametro na populacao. Usar p = 0,50 garante a maior margem possivel.',
        content: [
            'p = 0,50 e o valor padrao conservador adotado pelo mercado (variancia maxima).',
            'Se voce tem dados historicos indicando que o resultado sera bem diferente de 50%, pode ajustar.',
            'Matematicamente: p × (1-p) e maximizado em p = 0,5, logo qualquer outro valor reduz o n necessario.',
            'Em eleicoes disputadas sem candidato claramente liderando, mantenha 0,5.',
        ],
    },
    {
        id: 'population-size',
        title: 'Tamanho da Populacao (N)',
        short: 'Para populacoes acima de 100.000 pessoas, o fator de correcao e proximo de 1 e pode ser ignorado.',
        content: [
            'Quando informado, aplica o fator de correcao de populacao finita: n / (1 + (n-1)/N).',
            'Para eleicoes estaduais ou nacionais, deixe em branco (populacao infinita).',
            'Para cidades pequenas (< 50.000 eleitores), informar N reduz o tamanho de amostra necessario.',
            'Exemplo: em cidade com 20.000 eleitores e margem de 3%, a amostra cai de 1.067 para ~830.',
        ],
    },
    {
        id: 'deff',
        title: 'Efeito de Delineamento (Deff)',
        short: 'Fator multiplicador da variancia quando a amostra nao e puramente aleatoria.',
        content: [
            'Deff = 1,0: amostra aleatoria simples (AAS). Formula classica sem ajuste.',
            'Deff > 1,0: amostras por conglomerados ou cotas perdem precisao relativa a AAS.',
            'Institutos como Datafolha e Quaest usam Deff estimado entre 1,2 e 2,0.',
            'Para pesquisas por cotas sem ponderacao, use Deff entre 1,3 e 1,5 como referencia.',
            'O TSE aceita metodologia por cotas desde que o plano amostral seja detalhado no registro.',
        ],
    },
    {
        id: 'sampling-advanced',
        title: 'Configuracoes Avancadas de Amostragem',
        short: 'Parametros opcionais para ajustar o calculo a realidade da sua pesquisa.',
        content: [
            'p: estimativa de proporcao. Use 0,5 para maxima precisao conservadora.',
            'N (populacao): para correcao de populacao finita em universos menores.',
            'Deff: fator de delineamento para amostras nao-probabilisticas (cotas, conglomerados).',
            'Esses parametros sao opcionais; os defaults ja seguem o padrao de mercado brasileiro.',
        ],
    },
];

export const HELP_TOPICS_BY_ID = Object.fromEntries(HELP_TOPICS.map((topic) => [topic.id, topic])) as Record<string, HelpTopic>;

export const HELP_HOVER_EVENT = 'survey-help-hover';
