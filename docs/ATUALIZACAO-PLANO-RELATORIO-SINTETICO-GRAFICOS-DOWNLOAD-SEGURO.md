# Atualização do Plano – Relatório Sintético com Gráficos + Estratégia de Download Seguro

**Data:** 29 de maio de 2026  
**Contexto:** Aprovação do Plano de Melhorias com ressalvas  
**Versão:** 1.1 (Atualização obrigatória)

---

## 1. Aprovação e Ressalvas Aceitas

O planejamento geral foi **aprovado com as seguintes ressalvas**:

1. **Relatório Sintético** deve ser redesenhado:
   - Foco principal em **gráficos de alta qualidade**.
   - **Uma página dedicada por pergunta**.
   - Números + percentuais + gráfico profissional.
   - O tipo de gráfico deve respeitar o `preferred_visualization` definido no Wizard de criação da pesquisa.

2. **Questão crítica de segurança e experiência de download** deve ser tratada com profundidade, especialmente porque os relatórios serão documentos grandes (muitas imagens de gráficos em alta qualidade).

Este documento é a **atualização oficial** do plano anterior e deve ser considerado parte integrante do planejamento aprovado.

---

## 2. Nova Definição do Relatório Sintético

### 2.1 Visão Geral

O **Relatório Sintético** deixa de ser um relatório "simples e limpo com tabelas" e passa a ser um **relatório visual de alta qualidade**, com forte apelo gráfico.

**Estrutura proposta:**

- **Capa profissional** (logo + identidade visual + título + contratante + período + ficha técnica)
- **Sumário Executivo** (1 página)
  - Principais indicadores (Total de entrevistas, Taxa de conclusão, Principais destaques)
  - Tabela consolidada de cotas realizadas × planejadas (localidade + premissas principais)
- **Uma página por pergunta** (núcleo do relatório):
  - Título da pergunta
  - Números absolutos + percentuais (tabela compacta ao lado ou abaixo)
  - **Gráfico grande e bem formatado**, ocupando a maior parte da página
  - Legenda clara + base (n = X respostas)
- **Metodologia e Ficha Técnica** (1 página)
- **Anexos** (opcional): Questionário resumido + lista de localidades

**Princípio de design:**
> "O relatório sintético deve poder ser impresso e apresentado diretamente ao contratante sem precisar de explicação adicional."

### 2.2 Regra de Ouro: Uma Página por Pergunta

Cada pergunta relevante terá sua **própria página** contendo:

- Cabeçalho com o texto da pergunta
- Resumo numérico (Total, % por opção, "Não sabe / Não respondeu")
- **Gráfico principal** (grande)
- Rodapé da página com número da página + "Relatório Sintético - Confidencial"

### 2.3 Tipo de Gráfico por Tipo de Pergunta

O gráfico **deve respeitar** o que foi configurado no Wizard (`questions.preferred_visualization`).

Mapeamento recomendado:

| Tipo de Pergunta       | Visualizações Recomendadas (em ordem de preferência)          | Observação |
|------------------------|---------------------------------------------------------------|----------|
| `single_choice`        | `bar`, `pie`, `horizontal_bar`                                | Pie só quando ≤ 6 opções |
| `multiple_choice`      | `stacked_bar`, `horizontal_bar` (com % de menções)            | Nunca usar pie |
| `rating`               | `bar` (escala), `horizontal_bar`                              | Respeitar ordem da escala |
| `number`               | Histograma ou `bar` (agrupado)                                | Raro |
| Outros                 | `bar` (padrão)                                                | - |

**Importante:**
- O sistema deve **respeitar a escolha do pesquisador** no wizard.
- Se não houver `preferred_visualization`, aplicar heurística inteligente baseada no tipo + quantidade de opções.
- Permitir override na hora de gerar o relatório (ex: "Usar pizza para esta pergunta").

### 2.4 Requisitos de Qualidade Profissional para Gráficos

- Gráficos gerados em **alta resolução** (mínimo 150-300 DPI para impressão).
- Cores consistentes com a identidade visual da empresa (usar cores do tenant quando disponíveis).
- Legendas claras, com % e valores absolutos.
- Tratamento elegante de "Não sabe / Não respondeu".
- Eixos bem rotulados.
- Título do gráfico = texto da pergunta (ou versão curta).

---

## 3. Estratégia de Geração e Download de Relatórios Grandes

Este é o ponto mais crítico da atualização.

### 3.1 Problemas Identificados com a Abordagem Atual

A implementação atual (`DocxReportGenerator.generate`) tem sérios problemas para relatórios profissionais:

- Carrega **todo o documento em memória** (`Buffer`).
- Com 25–40 perguntas + gráficos em alta qualidade = arquivos de **15MB a 80MB+**.
- Risco alto de **timeout**, **memory crash** no servidor, e experiência ruim para o usuário.
- Sem logging de download.
- Sem proteção contra compartilhamento indevido de links de download.

### 3.2 Estratégia Recomendada (Produção)

#### Abordagem: **Geração Assíncrona + Armazenamento Temporário + Signed URLs**

**Fluxo proposto:**

1. **Pesquisador clica em "Gerar Relatório"**
   - Cria um registro em `report_generation_jobs`
   - Status: `queued`

2. **Worker / Background Job processa a geração**
   - Gera o .docx completo (pode levar 30s a 4 minutos dependendo do tamanho)
   - Gera também versão em PDF (se solicitado)
   - Faz upload para bucket privado no Supabase Storage: `reports-generated/{tenant_id}/{job_id}/relatorio-sintetico.docx`
   - Atualiza o job com `file_path`, `file_size`, `status = 'ready'`

3. **Entrega ao usuário**
   - Retorna um **link temporário assinado** (presigned URL) válido por **15 a 60 minutos**.
   - Ou envia por e-mail: "Seu relatório está pronto. Clique aqui para baixar (válido por 24h)".

4. **Download**
   - O download é feito diretamente do Storage (não passa pelo servidor Next.js).
   - Todo acesso é logado em `report_access_logs`.

#### Vantagens dessa abordagem:

- Servidor Next.js nunca segura o arquivo grande em memória.
- Download é rápido e escalável (CDN do Storage).
- Fácil de auditar.
- Permite notificação por e-mail quando relatório grande fica pronto.
- Permite múltiplos formatos (DOCX + PDF) sem custo extra.

### 3.3 Tabela de Controle de Jobs (Nova)

```sql
CREATE TABLE report_generation_jobs (
    id UUID PRIMARY KEY,
    survey_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    report_type TEXT NOT NULL,           -- synthetic, analytical, consolidated
    requested_by UUID,
    configuration JSONB,
    
    status TEXT NOT NULL DEFAULT 'queued',  -- queued, processing, ready, failed, expired
    progress INTEGER DEFAULT 0,
    
    file_path TEXT,
    file_size_bytes BIGINT,
    mime_type TEXT,
    
    expires_at TIMESTAMPTZ,
    download_count INTEGER DEFAULT 0,
    last_downloaded_at TIMESTAMPTZ,
    
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);
```

### 3.4 Opções de Entrega (UX)

| Cenário                        | Estratégia Recomendada                          | Tempo Esperado |
|--------------------------------|--------------------------------------------------|--------------|
| Relatório pequeno (< 8MB)      | Geração síncrona + download imediato             | < 15s        |
| Relatório médio (8–25MB)       | Job assíncrono + link temporário na tela         | 20–90s       |
| Relatório grande (> 25MB)      | Job assíncrono + notificação por e-mail          | 2–6 minutos  |

**Regra:** Qualquer relatório que demorar mais que 12–15 segundos deve usar o fluxo assíncrono.

### 3.5 Segurança no Download

Medidas obrigatórias:

1. **Presigned URLs com expiração curta** (máximo 60 minutos para downloads diretos).
2. **Validação de tenant** no momento do download (mesmo com signed URL).
3. **Rate limiting** por usuário/tenant.
4. **Logging completo** de quem baixou, quando, IP, User-Agent.
5. **Revogação manual** de links (botão "Invalidar link de download").
6. **Senha adicional** para relatórios compartilhados com contratantes (já existe no fluxo atual de shares).
7. **Watermark** discreto no documento (nome do contratante + data + "Documento confidencial") — opcional mas recomendado para segurança.

### 3.6 Considerações de Armazenamento

- Bucket `reports-generated` deve ser **privado**.
- Política de ciclo de vida: deletar arquivos após 30–90 dias (configurável por tenant).
- Versões antigas de relatórios devem ser mantidas por governança (mover para "cold storage" após 30 dias).

---

## 4. Impacto nas Fases do Plano

### Ajustes Necessários

| Fase | Impacto | Ação |
|------|---------|------|
| **Fase 0** | Alto | Incluir criação da tabela `report_generation_jobs` + estrutura básica de jobs |
| **Fase 1** | Muito Alto | Geração de gráficos como imagens de alta qualidade passa a ser **crítica** desde o início |
| **Fase 2** | Médio | UI de geração precisa tratar estados assíncronos (queued / processing / ready) |
| **Fase 3** | Baixo | - |
| **Fase 4** | Médio | Adicionar suporte a PDF + expiração de jobs |

### Nova Tarefa Prioritária (Fase 1)

**"Chart Image Generator Service"**

Responsável por:
- Receber dados de uma pergunta + tipo de visualização
- Gerar imagem PNG/SVG de alta resolução
- Retornar buffer pronto para embedding no `docx`

Opções técnicas a avaliar (recomendação durante Fase 0):

- `chartjs-node-canvas` (leve, bom para bar/pie)
- Playwright / Puppeteer headless (mais pesado, mas qualidade excelente e suporta Recharts)
- Solução híbrida (SVG puro para casos simples + canvas para complexos)

---

## 5. Atualização das Entregas por Fase

### Fase 1 (Identidade Visual + Gráficos) – agora mais importante

**Entregáveis atualizados:**

- Embedding real de logo + papel timbrado
- Geração de pelo menos 3 tipos de gráfico como imagem (bar, pie, horizontal_bar)
- Uma página por pergunta com gráfico grande + números
- Suporte básico ao campo `preferred_visualization`
- Primeiro protótipo de geração assíncrona para relatórios > 10MB

### Fase 2

- UI completa de configuração de relatório
- Seleção de premissas para cruzamentos (Analítico)
- Fluxo completo de jobs (com barra de progresso e notificação por e-mail quando pronto)

---

## 6. Riscos Adicionados por Esta Mudança

| Risco Novo | Severidade | Mitigação |
|------------|------------|---------|
| Geração de gráficos em alta qualidade é lenta e pesada | Alta | Avaliar bem a biblioteca de charts na Fase 0. Ter fallback para tabelas de alta qualidade |
| Arquivos extremamente grandes (> 50MB) | Média | Avisar o usuário antes de gerar. Oferecer opção "Versão otimizada para e-mail" (gráficos em menor resolução) |
| Complexidade do fluxo assíncrono | Média | Começar simples (polling no frontend) e evoluir para webhooks/e-mail depois |

---

## 7. Decisões Técnicas que Precisam ser Tomadas (Antes de Iniciar)

1. **Biblioteca de geração de gráficos** (chartjs-node-canvas vs Playwright vs outra)
2. **Estratégia de jobs**: 
   - Usar Supabase Edge Functions + pg_cron?
   - Usar Inngest / Trigger.dev?
   - Worker simples em Node com loop de polling?
3. **Formato padrão de entrega**: Sempre gerar DOCX + PDF, ou deixar o usuário escolher?
4. **Watermark obrigatório** em relatórios gerados para contratantes?

---

## 8. Próximos Passos Imediatos

1. **Aprovar esta atualização** (especialmente a estratégia de download assíncrono + signed URLs).
2. Definir a biblioteca de geração de gráficos.
3. Iniciar **Fase 0** com foco em:
   - Tabela `report_generation_jobs`
   - Serviço básico de agregação com filtros
   - Prova de conceito de geração de gráfico como imagem

---

**Documento de Atualização aprovado como parte do planejamento oficial.**

Aguardando sinal verde para iniciar a Fase 0 com as novas diretrizes.

---

**Fim da Atualização do Plano**
