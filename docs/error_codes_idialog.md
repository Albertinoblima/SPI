# Catalogo de Codigos de Erro - iDialog SPI

Fonte oficial para implementacao: apps/web/src/lib/monitoring/error-codes.ts

## Database

- DB_CONNECTION_FAILED: falha de conexao com banco (critical)
- DB_QUERY_FAILED: falha ao executar consulta (high)
- DB_WRITE_FAILED: falha de gravacao (high)

## Autenticacao e Seguranca

- AUTH_NOT_AUTHENTICATED: sessao invalida/expirada (medium)
- AUTH_FORBIDDEN: permissao insuficiente (high)

## Usuario e Validacao

- USER_SAVE_FAILED: falha ao salvar usuario (high)
- USER_UPDATE_FAILED: falha ao atualizar usuario (high)
- VALIDATION_FAILED: payload invalido (medium)

## Rede, Storage e Integracoes

- NETWORK_FETCH_FAILED: falha de comunicacao HTTP/rede (high)
- STORAGE_UPLOAD_FAILED: falha em upload (high)
- EXTERNAL_API_FAILED: erro em integracao externa (high)

## Sistema

- API_UNHANDLED_EXCEPTION: excecao nao tratada na API (critical)
- API_HTTP_5XX: endpoint retornou erro interno (high)
- CLIENT_RUNTIME_ERROR: erro de execucao no frontend (medium)
- UNKNOWN_ERROR: fallback para falhas nao classificadas (medium)

## Regras de escalonamento

- Notificacao imediata: codigos com notifyImmediately=true e toda severidade critical.
- Painel Admin: alertas exibidos no sino (Centro de Alertas) e no console de erros.
- Correlation ID: cada incidente recebe identificador para rastreio ponta-a-ponta.
