# 📊 Dados Eleitorais do TSE (Tribunal Superior Eleitoral)

## Visão Geral

O sistema mantém uma base de dados estática com informações de **5.757 municípios brasileiros** sobre o perfil do eleitorado, fornecida pelo TSE (Tribunal Superior Eleitoral).

**Localização do arquivo:** `apps/web/src/lib/geo/tse-voter-data.json`

## Estrutura dos Dados

Cada município contém:

```typescript
{
  "uf": "SP",              // Unidade Federativa (sigla)
  "code": "35066",         // Código IBGE do município
  "name": "SÃO PAULO",     // Nome do município
  "total": 8234567,        // Total de eleitores
  "m": 4123456,            // Eleitores do sexo masculino
  "f": 4111111,            // Eleitores do sexo feminino
  "n": 0,                  // Eleitores sem designação de sexo
  "a16": 234567,           // Faixa etária 16-17 anos
  "a18": 1123456,          // Faixa etária 18-24 anos
  "a25": 1234567,          // Faixa etária 25-34 anos
  "a35": 1345678,          // Faixa etária 35-44 anos
  "a45": 1456789,          // Faixa etária 45-59 anos
  "a60": 987654,           // Faixa etária 60-69 anos
  "a70": 654321,           // Faixa etária 70-79 anos
  "a80": 123456            // Faixa etária 80+ anos
}
```

## API de Consulta

### Endpoint

```
GET /api/geo/voters?state={UF}&city={CIDADE}
```

### Exemplos

**Ceará - Fortaleza:**

```bash
curl "http://localhost:3000/api/geo/voters?state=CE&city=Fortaleza"
```

**Resposta:**

```json
{
  "source": "tse",
  "total": 2456789,
  "cityName": "FORTALEZA",
  "uf": "CE",
  "match_type": "exact",
  "confidence": 1.0,
  "proportions": {
    "sex": {
      "m": 0.47,
      "f": 0.53,
      "n": 0.00
    },
    "age": {
      "a16": 0.05,
      "a18": 0.18,
      "a25": 0.22,
      "a35": 0.21,
      "a45": 0.19,
      "a60": 0.09,
      "a70": 0.04,
      "a80": 0.02
    }
  }
}
```

### Parâmetros

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `state` | string | Nome ou código do estado (ex: `CE`, `Ceará`, `Ceará`) |
| `city` | string | Nome do município (busca fuzzy com Levenshtein) |

### Tipos de Correspondência

- **`exact`**: Correspondência exata (confiança 1.0)
- **`smart`**: Correspondência via Levenshtein com threshold 0.72 (requer confirmação do usuário)

## 🔄 Atualização Automática dos Dados

Os dados são atualizados automaticamente através de um **GitHub Actions Workflow**.

### Cronograma

- ⏰ **Frequência:** Todo 1º dia do mês, às 00:00 UTC (20:00 Brasília)
- 🔄 **Processo:** Automático (sem intervenção necessária)
- 📢 **Notificação:** Uma issue é criada no GitHub quando dados são atualizados

### Arquivos Relevantes

| Arquivo | Propósito |
|---------|-----------|
| `.github/workflows/update-tse-voters.yml` | Workflow de automação |
| `scripts/generate-tse-voters.ps1` | Script PowerShell que processa dados |
| `scripts/generate-tse-voters.mjs` | Alternativa Node.js (mais rápido para reprocessamento) |
| `apps/web/src/lib/geo/tse-voter-data.json` | Dados gerados (JSON estático) |

### Disparar Manualmente

Se você quiser gerar os dados fora do cronograma:

1. Vá para a aba **Actions** no GitHub
2. Selecione o workflow **"Update TSE Voter Data"**
3. Clique em **"Run workflow"** → **"Run workflow"**

Ou localmente:

```powershell
cd c:\DEV\Sistema_Pesquisa\political-research-platform
powershell -ExecutionPolicy Bypass -File .\scripts\generate-tse-voters.ps1
```

## 📥 Fonte dos Dados

**CDN do TSE:** `https://cdn.tse.jus.br/estatistica/sead/odsele/perfil_eleitor_secao/`

Os dados são baixados em formato ZIP (um por UF) e processados para:

1. Extrair CSVs
2. Agregar por município
3. Calcular proporções
4. Gerar JSON final

## ⚙️ Detalhes Técnicos

### Faixas Etárias Agrupadas

O TSE fornece dados granulares por ano de idade. O sistema agrupa em faixas:

| Código | Faixa | Anos |
|--------|-------|------|
| `a16` | Adolescentes | 16-17 |
| `a18` | Jovens 1 | 18-24 |
| `a25` | Jovens 2 | 25-34 |
| `a35` | Adultos 1 | 35-44 |
| `a45` | Adultos 2 | 45-59 |
| `a60` | Sênior 1 | 60-69 |
| `a70` | Sênior 2 | 70-79 |
| `a80` | Idosos | 80+ |

### Matching Inteligente

O endpoint usa **Levenshtein distance** com threshold de **0.72** para encontrar municípios:

- **Distância < 0.28:** Correspondência exata (automática)
- **Distância 0.28-0.5:** Correspondência viável (requer confirmação)
- **Distância > 0.5:** Sem correspondência

Isso permite encontrar variações como:

- "FORTALEZA" ↔ "Fortaleza"
- "SAO PAULO" ↔ "São Paulo"
- "BRASIL" ↔ "Brasília" ❌ (distância > 0.5)

## 🔐 Considerações de Segurança

- ✅ Dados públicos (TSE)
- ✅ JSON estático (sem computação em runtime)
- ✅ Acesso sem autenticação (dados públicos)
- ✅ Proporções calculadas (não dados sensíveis por indivíduo)

## 📝 Histórico de Atualizações

| Data | Commits | Municípios | Tamanho |
|------|---------|-----------|---------|
| 15/05/2026 | 41bbdc7 | 5.757 | 1.019 KB |

---

**Última atualização:** 15 de maio de 2026
