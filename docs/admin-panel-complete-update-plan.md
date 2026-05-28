# Plano de Update Completo – Painel Administrativo iDialog

**Data:** 28 de maio de 2026  
**Autor da Análise:** Análise autônoma baseada em exploração profunda do código  
**Objetivo:** Elevar o Painel Administrativo de uma ferramenta básica de suporte/monitoramento para uma **plataforma operacional completa e profissional** para gestão do sistema multi-tenant.

---

## 1. Visão Geral Atual do Painel

### Estrutura Atual

**Frontend (`/app/admin`):**
- Layout com sidebar colapsável
- Páginas principais:
  - Dashboard (`/admin`) – Visão geral com cards de estatísticas
  - Empresas (`/admin/tenants` + detail)
  - Erros do Sistema (`/admin/system/errors`)
  - Saúde do Sistema (`/admin/system/health`) – Integra Vercel + GitHub + Supabase
  - Suporte (`/admin/support` + tickets + broadcast)
  - Auditoria (`/admin/audit-log`)

**Backend (`/api/admin`):**
- Proteção centralizada via `requireSystemAdmin()`
- Rotas para tenants, support, system (health, errors, stats), audit-log, notifications

**Modelo de Permissão:**
- Flag `users.is_system_admin`
- Função `public.is_system_admin()`
- RLS extensivo usando essa função em tabelas sensíveis (`error_logs`, `support_tickets`, `audit_log`, `system_analytics`, etc.)

### Relação com o Sistema

O Painel Administrativo funciona como **"God Mode"** da plataforma:

- Bypass total do isolamento multi-tenant
- Acesso cross-tenant para suporte e monitoramento
- Única interface para operadores da plataforma (não para clientes/tenants)
- Integração forte com:
  - Sistema de Erros (error_monitoring)
  - Sistema de Saúde (Vercel + GitHub + Supabase)
  - Suporte e Broadcast de notificações
  - Auditoria de ações

---

## 2. Diagnóstico Atual (Pontos Fortes e Fracos)

### Pontos Fortes

- Arquitetura de permissão sólida (`is_system_admin` + RLS)
- Bom início de observabilidade (Health + Errors)
- Sistema de suporte com broadcast
- Redirecionamento automático de system_admins para `/admin`
- Separação clara entre admin e tenant admin

### Pontos Fracos / Gaps Críticos

| Área | Problema | Severidade |
|------|----------|----------|
| **Segurança & Acesso** | Sem proteção client-side no layout do admin (só API) | Alta |
| **Gestão de Admins** | Não existe UI para promover/rebaixar system_admins | Alta |
| **Operação Diária** | Sem Impersonation (assumir identidade de tenant) | Crítica para suporte |
| **UX / Produtividade** | Dashboard muito básico | Média |
| **Observabilidade** | Health panel bom, mas limitado (sem métricas de performance, alertas) | Média-Alta |
| **Auditoria** | Logs existem, mas UI é básica e sem filtros avançados | Média |
| **Ações em Massa** | Quase nenhuma ação em lote (tenants, usuários, etc.) | Média |
| **Integração com Módulos** | Pouca visibilidade de Planejamento de Pesquisa, Surveys, etc. | Média |
| **Configuração** | Sem feature flags / configurações globais da plataforma | Baixa-Média |
| **Resiliência** | Algumas queries no health podiam derrubar o painel (já parcialmente corrigido) | Baixa |

---

## 3. Plano de Update Completo (Fases Recomendadas)

### Fase 0 – Fundação e Segurança (Prioridade Máxima)

**Objetivo:** Tornar o painel seguro e confiável antes de adicionar poder.

- Adicionar proteção client-side no `AdminLayout` (verificar `is_system_admin` via API ou contexto)
- Criar página de **Gestão de System Admins** (listar, promover, rebaixar)
- Melhorar `requireSystemAdmin` com rate limiting básico para ações sensíveis
- Adicionar log obrigatório de todas as ações de system_admin (mesmo as de leitura em alguns casos)
- Revisar e endurecer RLS em tabelas novas (ex: planning, geo, etc.)

### Fase 1 – Ferramentas Operacionais (Maior ROI)

**Objetivo:** Dar superpoderes reais para suporte e operação.

1. **Impersonation / Assumir Identidade**
   - Botão "Entrar como esta empresa" em tenants
   - Gera sessão temporária ou token especial
   - Log obrigatório de toda impersonation

2. **User Management Avançado**
   - Listar usuários de qualquer tenant
   - Reset de senha, desativar, mudar role
   - Busca global por email/nome

3. **Ações em Massa**
   - Suspender/reativar múltiplos tenants
   - Enviar broadcast para seleção de tenants
   - Marcar múltiplos erros como resolvidos

4. **Melhorias no Suporte**
   - Respostas rápidas / templates
   - Histórico completo de interações por tenant
   - Priorização automática baseada em criticidade

### Fase 2 – Observabilidade Avançada

**Objetivo:** Transformar o painel em um verdadeiro NOC (Network Operations Center).

- Expandir **Saúde do Sistema**:
  - Métricas de performance (tempo de resposta médio por rota)
  - Alertas configuráveis (ex: > X erros críticos em 1h)
  - Status de integrações externas (Vercel, Supabase, GitHub)
  - Gráficos de tendências (já existe base em `system_analytics`)

- Integração profunda com o sistema de **error monitoring** que já existe
- Dashboard de "Saúde por Tenant" (quais empresas estão com mais erros, baixa atividade, etc.)

### Fase 3 – Visibilidade de Negócio e Módulos

- Visão agregada de uso dos módulos (Planejamento de Pesquisa, Surveys, etc.)
- Métricas de adoção por tenant
- Relatórios executivos (crescimento, churn, engajamento)
- Integração com o módulo de Planejamento (ver planos criados, qualidade das bases geográficas, etc.)

### Fase 4 – Experiência e Produtividade

- Modernização visual do painel (componentes mais ricos, dark mode aprimorado, tabelas com virtualização)
- Filtros avançados + salvamento de views
- Atalhos de teclado
- Notificações em tempo real mais ricas (além do bell atual)
- Tema / customização da interface admin

### Fase 5 – Governança e Compliance

- Export de dados (GDPR readiness)
- Relatório de ações de system_admins (quem fez o quê)
- Aprovação em duas etapas para ações destrutivas (suspender tenant, deletar dados, etc.)
- Retenção e arquivamento de logs de auditoria

---

## 4. Recomendações de Priorização

**Ordem sugerida (melhor custo x benefício):**

1. **Fase 0** (Segurança básica) – Não negociável
2. **Impersonation** (Fase 1) – Maior ganho imediato de produtividade de suporte
3. **Gestão de System Admins** + logs de ações admin
4. **Expansão forte da Saúde do Sistema** (Fase 2)
5. Ações em massa + melhorias no suporte
6. Visibilidade de módulos (Planejamento, etc.)
7. Experiência e polish

---

## 5. Considerações Técnicas Importantes

- Manter o padrão atual de proteção (`requireSystemAdmin`)
- Criar uma nova função `requireSystemAdminWithAudit(action)` para ações sensíveis
- Considerar criar uma tabela dedicada `system_admin_actions` para rastreabilidade máxima
- Usar o sistema de notificações já existente para alertas internos de admin
- Evitar criar novas tabelas desnecessárias — reutilizar `audit_log` e `error_logs` sempre que possível

---

## 6. Entregáveis Esperados do Update Completo

- Painel muito mais poderoso para operação diária
- Redução drástica de tempo para resolver problemas de clientes
- Visibilidade clara da saúde da plataforma como um todo
- Base sólida para escalar o número de tenants sem explodir o suporte
- Conformidade e rastreabilidade de nível enterprise

---

**Este documento representa a visão completa e priorizada para evolução do Painel Administrativo iDialog.**

---

## Progresso de Implementação (atualizado autonomamente)

**2026-05 (sessão atual):**
- **Fase 2 (Saúde do Sistema)**: Status das Integrações Externas completamente refeito com detecção honesta de tokens, descrições de impacto operacional e UI rica (GitHub / Vercel / Supabase Interno). [apps/web/src/app/admin/system/health/*]
- **Fase 1 (Ações em Massa)**: Bulk update de status para múltiplos tenants implementado (API + UI com checkboxes, toolbar âmbar, auditoria por tenant, limite de segurança). Botão "Entrar como" (impersonation) já existia por linha. Agora o God Mode tem poder real de operação em lote.
- Verificações: tsc --noEmit limpo em todas as alterações.
- Commits: 2 commits focados e rastreáveis (09735ec + 2f8616e).

Próximos candidatos de alto valor (decisão autônoma futura):
- Bulk "marcar erros resolvidos" na página de errors
- Indicadores de saúde por tenant no list + detail
- Expansão de métricas no Health (latência, uso de módulos)

Siga com as melhores decisões — sempre priorizando impacto operacional e segurança.

Quer que eu comece a execução da **Fase 0** (Segurança e Fundação) agora, ou prefere ajustar prioridades antes de iniciar a implementação?