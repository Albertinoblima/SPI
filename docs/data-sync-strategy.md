# 📊 Estratégia de Sincronização Automática de Dados

## 📋 Visão Geral

O sistema implementa uma **sincronização mensal automática** de dados geográficos (IBGE) e eleitorais (TSE) via GitHub Actions, executada em horário noturno de **baixo fluxo operacional**.

## 🕐 Agendamento

### Workflow Principal: `monthly-data-sync.yml`

| Aspecto | Configuração |
|---------|--------------|
| **Frequência** | Uma vez por mês |
| **Dia** | Primeiro domingo (1-7 do mês) |
| **Horário** | 02:00 UTC = 23:00 BRT (madrugada) |
| **Cron** | `0 2 1-7 * 0` |
| **Timeout** | 5 horas (suficiente para all-UFs) |

### Por que esse horário?

- 🌙 **Madrugada**: Menor fluxo de usuários (impacto zero em caso de erro)
- 📅 **Primeiro domingo**: Depois do fim de semana, antes da semana de trabalho
- ⏰ **02:00 UTC**: Estratégico em múltiplos fusos hoários
  - 23:00 (dia anterior) em São Paulo (UTC-3)
  - 00:00 (noite) em Brasília (UTC-3)
  - 04:00 em Portugal (UTC+1)

## 🔄 Operação

### Execução Automática (Agendada)

```bash
# Dispara automaticamente no primeiro domingo do mês às 02:00 UTC
# Executar: --all-ufs (todas as 27 UFs)
# Resultado: Commit automático se houver mudanças
```

**Fases Executadas:**

1. ✅ **Fase 1**: Sincronizar 5.570 municípios (IBGE)
2. ✅ **Fase 2**: Sincronizar ~11.000 localidades (IBGE)
3. ✅ **Fase 3**: Sincronizar dados eleitorais (TSE) por município

### Execução Manual

Disponível via GitHub UI em `Actions > Monthly Data Sync > Run workflow`

Parâmetros configuráveis:

- **force_all**: Executar ETL completo (padrão: true)
- **skip_ibge**: Pular dados IBGE (padrão: false)
- **skip_tse**: Pular dados TSE (padrão: false)

## 🔐 Segurança

### Secrets Necessários

Configure em `Settings > Secrets and variables > Actions`:

```
✅ NEXT_PUBLIC_SUPABASE_URL         (pública)
✅ NEXT_PUBLIC_SUPABASE_ANON_KEY    (pública)
✅ SUPABASE_SERVICE_ROLE_KEY        (privada - para inserts)
✅ GITHUB_TOKEN                     (auto-gerado)
```

### Permissões

- `contents: write` — Commit e push automático
- `actions: read` — Ler status de workflows

## 📊 Saídas & Notificações

### ✅ Sucesso

- Mudanças são commitadas automaticamente em `main`
- Mensagem de commit inclui:
  - Número de linhas afetadas
  - Data/hora UTC
  - Link para run do workflow

### ❌ Falha

- Issue automática criada em `Insights > Issues`
- Labels: `🚨 data-sync-failed`, `bug`, `automated`
- Inclui link para logs do workflow

## 🚀 Próximas Execuções (Exemplos)

| Mês | Dia | Data | Horário UTC |
|-----|-----|------|-------------|
| Janeiro 2025 | Domingo | 5 de janeiro | 02:00 |
| Fevereiro 2025 | Domingo | 2 de fevereiro | 02:00 |
| Março 2025 | Domingo | 2 de março | 02:00 |
| Abril 2025 | Domingo | 6 de abril | 02:00 |

## 📈 Monitoramento

### Verificar Status

1. **Via GitHub UI**: `Actions > Monthly Data Sync`
2. **Commits automáticos**: `main` branch, autor `github-actions[bot]`
3. **Issues de erro**: `Labels: 🚨 data-sync-failed`

### Logs Detalhados

Cada run mostra:

- Status do ETL (sucesso/erro)
- Número de registros processados
- Mudanças detectadas
- URL do commit (se sucesso)

## 🔧 Customização

### Alterar Dia/Horário

Edit `.github/workflows/monthly-data-sync.yml`:

```yaml
on:
  schedule:
    - cron: '0 2 1-7 * 0'  # Modifique este cron
```

**Exemplos de cron:**

- `0 2 1 * *` — 1º dia do mês às 02:00 UTC
- `0 3 * * 0` — Toda segunda-feira às 03:00 UTC
- `0 2 8-14 * 1` — Segunda terça-feira do mês às 02:00 UTC

### Desabilitar Workflow

```bash
# Temporariamente (via GitHub UI):
Actions > Monthly Data Sync > ... > Disable

# Permanentemente:
# Remova a seção 'schedule' do YAML
```

## 🎯 Benefícios

✅ **Automático**: Sem intervenção manual  
✅ **Previsível**: Sempre mesmo dia/hora  
✅ **Seguro**: Rodar em horário de baixo risco  
✅ **Auditável**: Commits rastreáveis, issues de erro  
✅ **Flexível**: Execução manual sob demanda  
✅ **Escalável**: Suporta crescimento de dados  

## 📝 Referências

- [GitHub Actions Scheduled Workflows](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule)
- [Crontab Expression Generator](https://crontab.guru/)
- [IANA Timezone Database](https://www.iana.org/time-zones)
