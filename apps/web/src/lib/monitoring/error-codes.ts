export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ErrorDomain =
    | 'database'
    | 'auth'
    | 'user'
    | 'validation'
    | 'network'
    | 'integration'
    | 'storage'
    | 'security'
    | 'system';

export interface ErrorCodeDefinition {
    code: string;
    title: string;
    domain: ErrorDomain;
    severity: ErrorSeverity;
    userMessage: string;
    resolutionSteps: string[];
    notifyImmediately: boolean;
}

// Catalogo padrao de incidentes do iDialog SPI.
export const ERROR_CODE_CATALOG: Record<string, ErrorCodeDefinition> = {
    DB_CONNECTION_FAILED: {
        code: 'DB_CONNECTION_FAILED',
        title: 'Falha de conexao com banco de dados',
        domain: 'database',
        severity: 'critical',
        userMessage: 'Nao foi possivel conectar ao banco de dados.',
        resolutionSteps: [
            'Validar disponibilidade da instancia Supabase.',
            'Checar credenciais e variaveis de ambiente de banco.',
            'Executar teste de conectividade e latencia.',
        ],
        notifyImmediately: true,
    },
    DB_QUERY_FAILED: {
        code: 'DB_QUERY_FAILED',
        title: 'Falha ao executar consulta',
        domain: 'database',
        severity: 'high',
        userMessage: 'Falha ao consultar dados no banco.',
        resolutionSteps: [
            'Inspecionar consulta SQL e parametros enviados.',
            'Verificar politicas RLS e permissoes de leitura.',
            'Checar indexes e tempo de resposta da consulta.',
        ],
        notifyImmediately: true,
    },
    DB_WRITE_FAILED: {
        code: 'DB_WRITE_FAILED',
        title: 'Falha de gravacao no banco de dados',
        domain: 'database',
        severity: 'high',
        userMessage: 'Nao foi possivel salvar os dados.',
        resolutionSteps: [
            'Validar payload e constraints de tabela.',
            'Verificar politicas RLS de escrita.',
            'Reprocessar operacao com correlation id.',
        ],
        notifyImmediately: true,
    },
    AUTH_NOT_AUTHENTICATED: {
        code: 'AUTH_NOT_AUTHENTICATED',
        title: 'Usuario nao autenticado',
        domain: 'auth',
        severity: 'medium',
        userMessage: 'Sua sessao expirou. Faca login novamente.',
        resolutionSteps: [
            'Revalidar token de sessao.',
            'Verificar fluxo de refresh token.',
        ],
        notifyImmediately: false,
    },
    AUTH_FORBIDDEN: {
        code: 'AUTH_FORBIDDEN',
        title: 'Acesso negado',
        domain: 'security',
        severity: 'high',
        userMessage: 'Voce nao tem permissao para esta acao.',
        resolutionSteps: [
            'Conferir role e permissoes do usuario.',
            'Revisar regras de autorizacao por tenant.',
        ],
        notifyImmediately: true,
    },
    USER_SAVE_FAILED: {
        code: 'USER_SAVE_FAILED',
        title: 'Falha ao salvar usuario',
        domain: 'user',
        severity: 'high',
        userMessage: 'Nao foi possivel salvar os dados do usuario.',
        resolutionSteps: [
            'Validar campos obrigatorios e unicidade de email.',
            'Checar falhas de permissao no cadastro de usuarios.',
            'Repetir operacao apos validacao de payload.',
        ],
        notifyImmediately: true,
    },
    USER_UPDATE_FAILED: {
        code: 'USER_UPDATE_FAILED',
        title: 'Falha ao atualizar usuario',
        domain: 'user',
        severity: 'high',
        userMessage: 'Nao foi possivel atualizar o usuario.',
        resolutionSteps: [
            'Verificar concorrencia e integridade de dados.',
            'Checar auditoria e tentativas recentes.',
        ],
        notifyImmediately: true,
    },
    VALIDATION_FAILED: {
        code: 'VALIDATION_FAILED',
        title: 'Falha de validacao de entrada',
        domain: 'validation',
        severity: 'medium',
        userMessage: 'Dados invalidos enviados para o servidor.',
        resolutionSteps: [
            'Revisar schema de validacao e tipos esperados.',
            'Corrigir payload no frontend.',
        ],
        notifyImmediately: false,
    },
    NETWORK_FETCH_FAILED: {
        code: 'NETWORK_FETCH_FAILED',
        title: 'Falha de comunicacao com servico',
        domain: 'network',
        severity: 'high',
        userMessage: 'Falha de comunicacao com o servidor.',
        resolutionSteps: [
            'Validar conectividade de rede e DNS.',
            'Checar status de API gateway e timeouts.',
            'Revisar politicas de retry para chamadas externas.',
        ],
        notifyImmediately: true,
    },
    STORAGE_UPLOAD_FAILED: {
        code: 'STORAGE_UPLOAD_FAILED',
        title: 'Falha de upload em storage',
        domain: 'storage',
        severity: 'high',
        userMessage: 'Nao foi possivel enviar o arquivo.',
        resolutionSteps: [
            'Verificar bucket e politicas de acesso.',
            'Validar tamanho/formatos permitidos.',
            'Checar limites de throughput e timeout.',
        ],
        notifyImmediately: true,
    },
    EXTERNAL_API_FAILED: {
        code: 'EXTERNAL_API_FAILED',
        title: 'Falha em integracao externa',
        domain: 'integration',
        severity: 'high',
        userMessage: 'Um servico externo falhou durante o processamento.',
        resolutionSteps: [
            'Validar credenciais da integracao.',
            'Checar status do provedor externo.',
            'Acionar fallback ou fila de reprocessamento.',
        ],
        notifyImmediately: true,
    },
    API_UNHANDLED_EXCEPTION: {
        code: 'API_UNHANDLED_EXCEPTION',
        title: 'Excecao nao tratada na API',
        domain: 'system',
        severity: 'critical',
        userMessage: 'Erro interno no processamento da requisicao.',
        resolutionSteps: [
            'Analisar stacktrace e correlation id.',
            'Corrigir causa raiz e adicionar teste de regressao.',
            'Validar deploy com monitoramento reforcado.',
        ],
        notifyImmediately: true,
    },
    API_HTTP_5XX: {
        code: 'API_HTTP_5XX',
        title: 'Resposta HTTP de erro interno',
        domain: 'system',
        severity: 'high',
        userMessage: 'Servidor retornou erro interno.',
        resolutionSteps: [
            'Investigar endpoint e dependencia impactada.',
            'Correlacionar com erros recentes de banco/integracao.',
            'Aplicar mitigacao e acompanhar reincidencia.',
        ],
        notifyImmediately: true,
    },
    CLIENT_RUNTIME_ERROR: {
        code: 'CLIENT_RUNTIME_ERROR',
        title: 'Erro de execucao no cliente',
        domain: 'system',
        severity: 'medium',
        userMessage: 'Falha inesperada na interface.',
        resolutionSteps: [
            'Reproduzir com navegador e fluxo informados.',
            'Analisar stacktrace minificado e source maps.',
            'Adicionar guardas para evitar nova quebra.',
        ],
        notifyImmediately: false,
    },
    UNKNOWN_ERROR: {
        code: 'UNKNOWN_ERROR',
        title: 'Erro desconhecido',
        domain: 'system',
        severity: 'medium',
        userMessage: 'Ocorreu um erro inesperado.',
        resolutionSteps: [
            'Capturar contexto completo da falha.',
            'Classificar erro com codigo especifico.',
            'Ajustar observabilidade para prevenir lacunas.',
        ],
        notifyImmediately: false,
    },
};

export type ErrorCode = keyof typeof ERROR_CODE_CATALOG;

export function getErrorCodeDefinition(code: string): ErrorCodeDefinition {
    return ERROR_CODE_CATALOG[code] ?? ERROR_CODE_CATALOG.UNKNOWN_ERROR;
}

export function isImmediateNotificationCode(code: string): boolean {
    return getErrorCodeDefinition(code).notifyImmediately;
}
