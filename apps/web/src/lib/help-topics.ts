export interface HelpTopic {
    id: string;
    category: string;
    title: string;
    short: string;
    content: string[];
    relatedErrors?: string[];
    keywords?: string[];
}

export const HELP_TOPICS: HelpTopic[] = [
    // ==================== VISÃO GERAL E FLUXO ====================
    {
        id: 'system-overview',
        category: 'Visão Geral',
        title: 'Visão Geral do iDialog SPI',
        short: 'Entenda a estrutura do sistema, os principais módulos e o fluxo de trabalho recomendado.',
        content: [
            'O iDialog SPI é uma plataforma completa para planejamento, execução e análise de pesquisas de campo multi-tenant.',
            'Principais módulos: Planejamento de Pesquisa (5 passos), Coleta de Dados, Dados Geográficos Enriquecidos, Relatórios e o Painel Administrativo (God Mode para gestores da plataforma).',
            'Fluxo recomendado: 1) Criar tenant → 2) Planejar pesquisa (Base Geográfica + Cotas + Estratificação) → 3) Configurar questionário → 4) Coletar em campo → 5) Analisar e gerar relatórios.',
            'Todo tenant tem isolamento total de dados via RLS (Row Level Security). System Admins podem usar impersonation para dar suporte sem comprometer a privacidade.',
        ],
        keywords: ['visão geral', 'fluxo', 'módulos', 'como começar', 'multi-tenant'],
    },
    {
        id: 'workflow-main',
        category: 'Visão Geral',
        title: 'Fluxo de Trabalho Recomendado',
        short: 'Siga esta sequência para obter os melhores resultados e evitar retrabalho.',
        content: [
            'Etapa 1: Planejamento rigoroso usando o assistente de 5 passos (especialmente Base Geográfica enriquecida).',
            'Etapa 2: Validação da base com dados Censo + TSE + CNEFE antes de liberar para campo.',
            'Etapa 3: Coleta com monitoramento em tempo real no app de campo.',
            'Etapa 4: Análise com relatórios automáticos + exportações.',
            'Dica de ouro: Sempre use o seletor de localidades com badges de qualidade. Evite municípios sem dados enriquecidos quando possível.',
        ],
        keywords: ['fluxo', 'passo a passo', 'melhor prática', 'planejamento'],
    },

    // ==================== PLANEJAMENTO DE PESQUISA (5 PASSOS) ====================
    {
        id: 'planning-step2-geobase',
        category: 'Planejamento de Pesquisa',
        title: 'Passo 2: Base Geográfica (o mais importante)',
        short: 'A qualidade da sua pesquisa depende diretamente da base geográfica escolhida.',
        content: [
            'Use o novo seletor profissional com filtros por zona (Urbana/Rural) e busca rápida.',
            'Priorize municípios com badges "Enriquecido" (Censo + TSE + CNEFE disponíveis).',
            'Você pode travar (lock) cotas específicas. O sistema redistribui proporcionalmente o restante.',
            'Atenção à densidade (entrevistas por 10 mil habitantes) e presença de CNEFE — isso impacta viabilidade de campo.',
        ],
        relatedErrors: ['PLANNING_GEO_INVALID'],
        keywords: ['base geográfica', 'localidades', 'cotas', 'passo 2', 'seletor'],
    },
    {
        id: 'planning-quotas-locks',
        category: 'Planejamento de Pesquisa',
        title: 'Travamento e Redistribuição de Cotas',
        short: 'Como usar travamentos sem distorcer sua amostra.',
        content: [
            'Trave apenas as localidades mais críticas (ex: capitais ou regiões difíceis).',
            'Após travar, use o botão de redistribuição proporcional.',
            'Evite travar mais de 40-50% das entrevistas — isso reduz a flexibilidade operacional.',
            'O sistema avisa quando o total fica inconsistente.',
        ],
        keywords: ['cotas', 'travamento', 'lock', 'redistribuição'],
    },
    {
        id: 'planning-tse-stratification',
        category: 'Planejamento de Pesquisa',
        title: 'Sugestão de Estratificação via TSE',
        short: 'Como usar a sugestão automática de sexo e faixa etária baseada em dados eleitorais.',
        content: [
            'A sugestão pondera pela população Censo + densidade CNEFE.',
            'Você pode aceitar a sugestão completa ou ajustar manualmente.',
            'Ideal para pesquisas eleitorais ou de opinião pública.',
            'Sempre revise se o perfil da sua pesquisa exige ajustes (ex: só eleitores de 16+).',
        ],
        keywords: ['estratificação', 'TSE', 'sugestão', 'sexo', 'idade'],
    },

    // ==================== DADOS GEOGRÁFICOS E ENRIQUECIMENTO ====================
    {
        id: 'geo-data-sources',
        category: 'Dados Geográficos',
        title: 'Fontes de Dados: Censo, TSE e CNEFE',
        short: 'Entenda o que cada fonte traz e como o sistema combina elas.',
        content: [
            'Censo IBGE (2022): População total, domicílios, sexo, faixa etária por município.',
            'TSE: Número de eleitores por sexo e faixa etária (atualizado mensalmente via ETL).',
            'CNEFE: Presença de endereços residenciais (ótimo indicador de viabilidade de coleta).',
            'O sistema usa essas fontes para calcular densidade e sugerir cotas realistas.',
        ],
        keywords: ['censo', 'tse', 'cnefe', 'enriquecido', 'dados geográficos'],
    },
    {
        id: 'geo-municipality-profile',
        category: 'Dados Geográficos',
        title: 'Perfil do Município (API /api/geo/municipality-profile)',
        short: 'Como o sistema entrega dados ricos de um município específico.',
        content: [
            'Retorna população Censo, eleitores TSE, % de mobilização, número estimado de residências via CNEFE.',
            'Inclui score de qualidade dos dados (0 a 3) com badges visuais.',
            'Usado automaticamente no seletor de base geográfica e no planejamento.',
        ],
        keywords: ['perfil município', 'api geo', 'qualidade dados'],
    },

    // ==================== PAINEL ADMINISTRATIVO (GOD MODE) ====================
    {
        id: 'admin-impersonation',
        category: 'Painel Administrativo',
        title: 'Impersonation (Entrar como a empresa)',
        short: 'Como e quando usar a representação de tenant para suporte.',
        content: [
            'Use apenas quando necessário para diagnosticar problemas específicos do cliente.',
            'Toda impersonation é registrada em audit_log com IP, User-Agent e timestamp.',
            'O banner âmbar aparece para todos os usuários enquanto a sessão estiver ativa.',
            'Nunca use para "espiar" — use com responsabilidade e propósito claro de suporte.',
            'Para sair: clique em "Sair da representação" no banner ou na página de tenants.',
        ],
        relatedErrors: ['IMPERSONATION_ACTIVE'],
        keywords: ['impersonation', 'entrar como', 'god mode', 'suporte', 'representação'],
    },
    {
        id: 'admin-bulk-actions',
        category: 'Painel Administrativo',
        title: 'Ações em Massa (Bulk)',
        short: 'Como usar as ferramentas de bulk para operar com eficiência.',
        content: [
            'Bulk de status de tenants: útil para suspender/reativar várias empresas de uma vez.',
            'Bulk de resolução de erros: marque dezenas de incidentes como resolvidos rapidamente.',
            'Sempre há confirmação + auditoria completa por ação.',
            'Limites de segurança existem (ex: máximo 100-200 itens por operação).',
        ],
        keywords: ['bulk', 'ações em massa', 'suspender', 'resolver erros'],
    },

    // ==================== ERROS COMUNS E SOLUÇÕES ====================
    {
        id: 'error-geo-no-data',
        category: 'Erros Comuns e Soluções',
        title: 'Sem dados geográficos enriquecidos para o município',
        short: 'O sistema não encontrou Censo/TSE/CNEFE para um ou mais municípios.',
        content: [
            'Verifique se o município tem dados recentes carregados (alguns municípios pequenos podem ter cobertura parcial).',
            'Use o botão "Sugerir população" para consultar IBGE automaticamente.',
            'Para municípios muito pequenos ou novos, considere usar dados de municípios vizinhos como referência (com nota interna).',
            'Se o erro persistir em municípios grandes, abra ticket com os códigos IBGE.',
        ],
        relatedErrors: ['GEO_NO_DATA', 'PLANNING_GEO_INVALID'],
        keywords: ['erro geográfico', 'sem dados', 'município', 'IBGE', 'Censo'],
    },
    {
        id: 'error-quota-inconsistency',
        category: 'Erros Comuns e Soluções',
        title: 'Inconsistência nas cotas após travamentos',
        short: 'O total de entrevistas ficou diferente do planejado após travar várias localidades.',
        content: [
            'Use o botão "Redistribuir proporcionalmente" após cada grupo de travamentos.',
            'Evite travar mais de 50% do total se possível — reduz flexibilidade.',
            'Em pesquisas qualitativas/censo, é comum e aceitável ter metas operacionais diferentes do cálculo estatístico.',
        ],
        keywords: ['cota inconsistente', 'travamento', 'redistribuição'],
    },
    {
        id: 'error-impersonation-denied',
        category: 'Erros Comuns e Soluções',
        title: 'Não foi possível iniciar impersonation',
        short: 'Falha ao tentar representar uma empresa.',
        content: [
            'Verifique se você é System Admin.',
            'Confira se já existe outra sessão de impersonation ativa (o sistema permite apenas uma por vez).',
            'Tente sair de qualquer representação anterior antes de iniciar uma nova.',
        ],
        relatedErrors: ['IMPERSONATION_ACTIVE', 'NOT_SYSTEM_ADMIN'],
        keywords: ['impersonation', 'erro', 'não autorizado'],
    },

    // ==================== SUPORTE E AUTOAJUDA ====================
    {
        id: 'support-self-service',
        category: 'Suporte',
        title: 'Como usar o Assistente de Autossuporte',
        short: 'O fluxo correto antes de abrir qualquer ticket.',
        content: [
            'Sempre comece descrevendo seu problema no Assistente de Ajuda.',
            'Leia os artigos sugeridos com atenção.',
            'Se algum artigo resolver seu problema, marque "Isso resolveu meu problema".',
            'Só prossiga para abrir ticket humano se o problema persistir após consultar a base.',
            'Para sugestões de melhoria (feature), você pode pular direto para o ticket, mas ainda é recomendado ver se algo similar já foi documentado.',
        ],
        keywords: ['assistente', 'autossuporte', 'base de conhecimento', 'como usar suporte'],
    },
    {
        id: 'support-when-ticket',
        category: 'Suporte',
        title: 'Quando realmente abrir um ticket',
        short: 'Critérios para decidir se vale a pena envolver o time de suporte.',
        content: [
            'Abra ticket quando: o problema bloqueia operação crítica, você já consultou a ajuda sem sucesso, ou é uma sugestão de melhoria.',
            'Não abra para: dúvidas simples que estão documentadas, problemas já conhecidos com solução no help, ou questões de "como fazer" que o assistente já cobriu.',
            'Tickets bem descritos (com prints, passos e horários) são resolvidos muito mais rápido.',
        ],
        keywords: ['quando abrir ticket', 'suporte', 'melhor prática'],
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
            'No modo automático, é calculado pela fórmula padrão de amostragem.',
            'Pode ser ajustado manualmente para adequar ao orçamento ou capacidade de campo.',
            'A distribuição por localidade pode ser revisada antes do questionário.',
            'Arredondar para cima mantém ou melhora a precisão estatística.',
        ],
    },
    // Removido: Etapa 3 (Dimensionamento Amostral) não existe mais
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

    // ========================================================================
    // FLUXO PONTA A PONTA (Planejamento 5 passos → Distribuição por Entrevistador → Mobile → Relatórios)
    // Adicionado no polimento 100% + transição automática para evolução do suporte
    // ========================================================================
    {
        id: 'ponta-a-ponta-overview',
        category: 'Fluxo Ponta a Ponta',
        title: 'Visão Completa do Fluxo Ponta a Ponta',
        short: 'Como o planejamento rico, a distribuição por entrevistador, a coleta no mobile e os relatórios se conectam em um ciclo fechado.',
        content: [
            'O iDialog agora fecha o ciclo completo que você definiu: Planejar (5 passos com geo enriquecido) → Distribuir cotas por entrevistador → Criar pesquisa com seeding automático → Mobile respeita cotas em tempo real → Relatórios (.docx + dashboard protegido para o contratante).',
            'Passo 1 (Planejamento): Use o fluxo de 5 passos (/planning/new). Defina base geográfica, cotas, estratificação e depois a distribuição por entrevistador no Passo 4 (algoritmos igualitário ou proporcional + travas individuais).',
            'Passo 2 (Handoff): No resumo (Step5) use o botão "Criar Pesquisa AGORA + Aplicar Cotas por Entrevistador" — ele cria a survey, adiciona a equipe automaticamente e semeia survey_distribution_quotas + survey_team_members.',
            'Passo 3 (Mobile): O entrevistador vê "Sua Missão de Campo" com cotas por localidade, barras de progresso (contagem real do backend + sessão atual), seletor de localidade e proteção explícita no submit quando a cota está esgotada.',
            'Passo 4 (Relatórios): Após coleta, gere .docx configurável (papel, letterhead via company_assets) ou compartilhe dashboard dinâmico protegido por credenciais do contratante (email + senha com reset).',
            'Tudo é auditado. O sistema respeita RLS em todos os pontos.',
        ],
        keywords: ['ponta a ponta', 'fluxo completo', 'distribuição por entrevistador', 'ciclo', 'mobile', 'relatórios'],
    },
    {
        id: 'interviewer-quota-distribution',
        category: 'Fluxo Ponta a Ponta',
        title: 'Como Distribuir Cotas Proporcionalmente entre Entrevistadores',
        short: 'Guia prático do componente InterviewerQuotaAssignment: algoritmos, travas, validação e melhores práticas.',
        content: [
            'Abra a seção "Atribuição de Cotas por Entrevistador" no Passo 4 do planejamento.',
            'Carregue a equipe real do tenant (botão "Carregar Equipe Real do Tenant").',
            'Dois algoritmos automáticos: "Distribuir Igualmente" (mesmo número para todos) e "Proporcional às Cotas Geográficas" (respeita o peso de cada localidade).',
            'Você pode travar (lock) um ou mais entrevistadores — o sistema redistribui apenas os desbloqueados.',
            'Validação em tempo real: nunca é possível atribuir mais do que a cota geográfica total de uma localidade.',
            'Resumo global no rodapé mostra total distribuído vs planejado. Diferenças são destacadas em vermelho.',
            'Dica: use proporcional quando os entrevistadores têm diferentes capacidades operacionais por região.',
        ],
        relatedErrors: ['PLANNING_DISTRIBUTION_EXCEEDS'],
        keywords: ['cotas por entrevistador', 'distribuição', 'InterviewerQuotaAssignment', 'proporcional', 'igualitário', 'travas'],
    },
    {
        id: 'what-interviewer-sees-mobile',
        category: 'Fluxo Ponta a Ponta',
        title: 'O que o Entrevistador Vê no App Mobile (Missão + Cotas em Tempo Real)',
        short: 'Explicação completa da experiência do coletador após o handoff do planejamento.',
        content: [
            'Ao abrir uma pesquisa atribuída, o app mostra o card "Sua Missão de Campo" com total de entrevistas planejadas para ele.',
            'Lista de localidades com: nome, quota_total, collected_count (real do backend via tabela interviews) e barra de progresso.',
            'Na tela de resposta: seletor de localidade atual (chips clicáveis) mostrando "Restam X" considerando backend + contagens desta sessão.',
            'Barra sticky durante a entrevista: "Localidade X — Restante: N" com alerta de "quase esgotada" quando ≤ 3.',
            'Ao finalizar entrevista: se a cota da localidade já estiver esgotada (backend + sessão), aparece confirmação explícita "Enviar mesmo assim (será auditada)".',
            'Após sincronização, o collected_count no backend atualiza automaticamente para todos os dispositivos do mesmo entrevistador.',
            'Se nenhuma cota foi distribuída ainda: mensagem educada orientando o coordenador a finalizar a distribuição no planejamento.',
        ],
        keywords: ['mobile', 'entrevistador', 'missão de campo', 'cota restante', 'session count', 'interviews table'],
    },
    {
        id: 'protected-contractor-dashboard',
        category: 'Fluxo Ponta a Ponta',
        title: 'Como Gerar Link Protegido para o Contratante (Dashboard Power BI Style)',
        short: 'Fluxo completo de report shares + credenciais do contratante + acesso público seguro.',
        content: [
            'No módulo de Relatórios, gere um relatório ou acesse a aba de compartilhamento.',
            'Crie um "Compartilhamento Protegido": defina email + senha inicial do contratante (hash bcrypt).',
            'O sistema gera um share_token longo e não-adivinhável.',
            'Envie ao contratante o link: /reports/public/[shareToken]',
            'Na primeira visita ele faz login com as credenciais que você definiu (pode resetar senha depois).',
            'O dashboard é dinâmico (Recharts): totais, distribuições por pergunta, cross-tabs em tempo real (usando ReportAggregationService).',
            'Todo acesso é logado em report_access_logs (quem, quando, o que viu).',
            'Você controla papel, expiração e pode revogar o acesso a qualquer momento.',
            'Relatórios .docx também podem ser gerados com letterhead da empresa (company_assets) e 3 tipos: sintético, analítico ou consolidado.',
        ],
        keywords: ['relatório protegido', 'contratante', 'share token', 'dashboard público', 'credenciais', 'reset senha', 'docx'],
    },
    {
        id: 'handoff-planning-to-survey',
        category: 'Fluxo Ponta a Ponta',
        title: 'Handoff do Planejamento para o Wizard Antigo (planId)',
        short: 'Como funciona quando você abre /surveys/new?planId=... e o que é preenchido automaticamente.',
        content: [
            'O SurveyWizard detecta planId e carrega: título, objetivo, metodologia, total de entrevistas e localidades com cotas.',
            'A distribuição por entrevistador (interviewerAssignments) é armazenada internamente.',
            'Ao salvar rascunho ou publicar, o sistema chama automaticamente seedTeamFromPlan (adiciona interviewers à survey_team_members) + seedInterviewerDistributionFromPlan (popula survey_distribution_quotas).',
            'Banner visual "Importado do Planejamento 5 passos" aparece no topo.',
            'No Passo 6 (Equipe) aparece banner verde informando quantos entrevistadores serão adicionados automaticamente.',
            'Recomendação: prefira o botão "Criar Pesquisa AGORA" direto no resumo do planejamento 5 passos — ele faz o seeding imediatamente e é mais rápido.',
        ],
        keywords: ['planId', 'handoff', 'SurveyWizard', 'seedTeam', 'seedDistribution', 'pré-preenchimento'],
    },
    {
        id: 'quota-real-count-backend',
        category: 'Fluxo Ponta a Ponta',
        title: 'Como Funciona a Contagem Real de Respostas por Cota (Backend)',
        short: 'Explicação técnica de como collected_count é calculado a partir da tabela interviews (100% confiável).',
        content: [
            'Quando o mobile sincroniza uma entrevista via /api/entrevistas/sync, um registro é criado na tabela interviews com locality_id, interviewer_id, survey_id e status.',
            'As APIs de bundle para mobile (/api/mobile/pesquisa/[id] e /cotas) fazem uma agregação: contam quantos registros "completed" ou "synced" existem por (survey, interviewer, locality).',
            'Esse número (collected_count) é devolvido junto com cada quota da survey_distribution_quotas.',
            'O app mobile usa: remaining = quota_total - (collected_count + sessionCounts locais desta execução).',
            'Isso garante que mesmo que o entrevistador use dois celulares ou reinicie o app, a cota real nunca é ultrapassada sem confirmação explícita.',
            'O contador de sessão (client-side) serve apenas para feedback imediato antes da sincronização.',
            'Auditoria completa: toda coleta fica registrada em interviews + interview_answers + response_answers quando aplicável.',
        ],
        keywords: ['collected_count', 'interviews table', 'backend count', 'quota real', 'sync', 'entrevistador'],
    },
    {
        id: 'step-by-step-full-flow',
        category: 'Fluxo Ponta a Ponta',
        title: 'Passo a Passo Completo: Do Planejamento 5 Passos até a Primeira Coleta no Mobile',
        short: 'Guia numerado end-to-end para o coordenador que quer ver o ciclo funcionando do zero ao primeiro dado coletado com cotas respeitadas.',
        content: [
            '1. Acesse Planejamento > Novo Planejamento (fluxo de 5 passos).',
            '2. Passo 1-3: Defina nome, base geográfica rica (priorize municípios com badge Enriquecido Censo+TSE+CNEFE) e cotas geográficas.',
            '3. No Passo 4 (Distribuição), abra a seção "Atribuição por Entrevistador". Carregue a equipe real e use os botões "Distribuir Igualmente" ou "Proporcional". Trave quem precisar.',
            '4. Vá ao Resumo (Passo 5). Clique no botão verde grande "Criar Pesquisa AGORA + Aplicar Cotas por Entrevistador".',
            '5. O sistema cria a pesquisa, adiciona os entrevistadores na survey_team_members e semeia as cotas em survey_distribution_quotas automaticamente.',
            '6. O entrevistador faz login no app mobile (Expo) com as credenciais do tenant.',
            '7. Na lista de pesquisas, abra a que você acabou de criar. Ele verá o card "Sua Missão de Campo" com as localidades + totais atribuídos a ele.',
            '8. Ao iniciar coleta, selecione a localidade atual. A barra sticky mostra o restante real (backend + esta sessão).',
            '9. Ao finalizar a entrevista, se a cota estiver perto ou esgotada, o app pede confirmação explícita.',
            '10. Após sync, volte ao monitor da pesquisa no web. Os números de coleta começam a subir. Os eventos de "HELP_TOPIC_MARKED_HELPFUL" também são registrados se ele usou a ajuda.',
        ],
    },
    {
        id: 'contractor-protected-report-guide',
        category: 'Fluxo Ponta a Ponta',
        title: 'Guia do Contratante: Como Usar o Dashboard Protegido (do Login aos Cruzamentos)',
        short: 'Passo a passo para a pessoa que recebe o link protegido: login, visão geral, cruzamentos dinâmicos e como pedir ajustes.',
        content: [
            '1. Abra o link que o coordenador enviou (formato: /reports/public/[shareToken longo]).',
            '2. Informe o email + senha que foram combinados com o coordenador.',
            '3. Após login, você verá o total de entrevistas realizadas + data da última atualização.',
            '4. Use os dois selects de "Cruzamentos em Tempo Real" para escolher duas perguntas e gerar tabelas cruzadas ao vivo.',
            '5. Os dados vêm do ReportAggregationService (mesmo motor usado nos relatórios .docx).',
            '6. Se precisar de um arquivo formal, peça ao coordenador o relatório .docx (com papel, orientação e letterhead da empresa).',
            '7. Caso tenha dúvida sobre algum número, use o botão de ajuda no canto (contexto "reports") — ele prioriza os artigos sobre dashboard protegido e fluxo ponta a ponta.',
            '8. Para resetar sua senha, peça ao coordenador (ele tem o botão de reset no painel de compartilhamento).',
            'Dica: Todos os seus acessos ficam registrados (auditável pelo coordenador).',
        ],
    },
];

export const HELP_TOPICS_BY_ID = Object.fromEntries(HELP_TOPICS.map((topic) => [topic.id, topic])) as Record<string, HelpTopic>;

export const HELP_HOVER_EVENT = 'survey-help-hover';
