# ADR-0000: Aprovação do Plano de Evolução para Nível Sênior e Profissional

**Status:** Accepted  
**Date:** 2026-06  
**Deciders:** Arquiteto Sênior + Sponsor Técnico  
**Consulted:** Equipe de Engenharia (via aprovação explícita do plano)

---

## Context

O sistema iDialog SPI possui uma visão arquitetural e de produto de alto nível, porém a execução de engenharia apresenta dívidas técnicas significativas que impedem sua operação em escala profissional:

- Ausência completa de testes automatizados.
- Uso excessivo de `any` e padrões anti-padrão em React/TypeScript (especialmente no app mobile).
- SyncEngine incompleto com risco real de perda de dados em campo.
- Módulo de relatórios ainda não entrega qualidade profissional esperada por clientes.
- CI/CD sem quality gates efetivos de tipo, lint e testes.
- Múltiplas auditorias prévias identificaram centenas de problemas críticos.

Foi elaborado o documento **PLANO_EVOLUCAO_NIVEL_SENIOR_PROFISSIONAL.md** (localizado na raiz do workspace), que define um caminho estruturado, priorizado por risco e fundamentado em melhores práticas de engenharia sênior para elevar o sistema ao nível desejado.

## Decision

Aprovar formalmente o **PLANO DE EVOLUÇÃO PARA NÍVEL SÊNIOR E PROFISSIONAL** (versão 1.0) como o **guia oficial** de evolução técnica do iDialog SPI pelos próximos 6–8 meses.

O plano será seguido rigorosamente, com as seguintes regras:

1. Todas as fases, etapas e subetapas devem ser executadas na ordem definida.
2. Gates de qualidade entre fases são **obrigatórios** — nenhuma fase pode ser considerada concluída sem atender 100% dos critérios do gate.
3. Decisões táticas dentro de cada etapa podem ser tomadas pelo implementador, desde que:
   - Estejam alinhadas com os 10 Princípios Arquiteturais definidos no plano.
   - Sejam registradas em ADR quando afetarem arquitetura, contratos, testes ou schema.
4. O documento `PLANO_EVOLUCAO_NIVEL_SENIOR_PROFISSIONAL.md` é a fonte de verdade para o programa de qualidade.

## Consequences

### Positive
- Cria alinhamento organizacional forte sobre o que significa "pronto para produção profissional".
- Reduz drasticamente o risco de retrabalho futuro ao estabelecer fundações (testes + tipagem) antes de refatorações grandes.
- Estabelece governança clara via ADRs e Quality Reviews.
- Permite medição objetiva de progresso através de gates e métricas definidas.
- Aumenta a confiança da equipe e de stakeholders no longo prazo.

### Negative / Risks
- Exige investimento significativo de tempo (estimado 19–22 semanas) sem entrega de features visíveis para o usuário final nas primeiras 4–6 semanas (Fase 0 e início da Fase 1).
- Pode gerar resistência inicial da equipe por causa do aumento de rigor (tests, strict mode, pre-commit hooks).
- Requer disciplina contínua para não pular gates em momentos de pressão por features.

**Mitigação acordada:** Executar Fase 0 como "Quality Sprint" dedicado com objetivos claros de curto prazo (gates no CI, primeiros testes passando) para gerar momentum rápido.

## Alternatives Considered

| Alternativa | Descrição | Por que foi rejeitada |
|-------------|-----------|-----------------------|
| **Abordagem incremental sem plano formal** | Ir consertando problemas conforme surgem | Alto risco de retrabalho e inconsistência. Já tentado em iterações anteriores sem sucesso sustentável. |
| **Focar apenas em testes** | Ignorar tipagem, CI gates e mobile reliability | Não resolve o problema raiz identificado na auditoria (qualidade geral da base de código). |
| **Big-bang refactor** | Parar tudo e reescrever partes críticas | Extremamente arriscado em sistema com dados reais de campo e operação em produção. Viola princípio "Incremental + Vertical Slices". |
| **Seguir apenas os planos de relatório existentes** | Priorizar features de relatório antes da fundação | Alto risco de construir features complexas sobre base instável (SyncEngine incompleto + falta de testes). |

## References

- Plano completo aprovado: `PLANO_EVOLUCAO_NIVEL_SENIOR_PROFISSIONAL.md` (raiz do workspace)
- Auditoria de qualidade anterior: `RELATORIO_AUDITORIA_QUALIDADE_SISTEMA.md`
- Documentos de planejamento existentes em `docs/` (especialmente os de relatórios e data-sync)
- Template de ADR: `docs/adr/0000-adr-template.md`

---

**Próximos Passos Imediatos Definidos no Plano:**
1. Iniciar Etapa 0.1 — Infraestrutura de Qualidade e CI/CD (maior ROI imediato).
2. Estabelecer processo de Quality Review semanal.
3. Comunicar o plano e os ADRs para toda a equipe de engenharia.
