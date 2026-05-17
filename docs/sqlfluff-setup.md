# SQLFluff Configuration - PostgreSQL Linting

## Overview

Este projeto utiliza **SQLFluff** para validação e formatação automática de código SQL com PostgreSQL.

## Configuração

- **Arquivo de Configuração**: `.sqlfluff.yaml`
- **Arquivo de Ignore Patterns**: `.sqlfluffignore`
- **Dialeto**: PostgreSQL
- **Indentação**: 2 espaços
- **Tamanho máximo de linha**: 88 caracteres

## Instalação

### Localmente via pip

```bash
pip install sqlfluff
pip install sqlfluff[postgres]
```

### Em ambiente Docker

```bash
docker run -it fluff/sqlfluff:latest
```

### Via npm (wrapper)

```bash
npm install --save-dev sqlfluff
# ou usar a CLI diretamente
```

## Uso

### Verificar Lint em arquivo específico

```bash
sqlfluff lint supabase/migrations/20240101000001_create_tenants.sql
```

### Verificar Lint em todos os arquivos SQL

```bash
sqlfluff lint supabase/
```

### Formatar automaticamente (com preview)

```bash
sqlfluff fix supabase/ --check
```

### Aplicar formatação (sem preview)

```bash
sqlfluff fix supabase/
```

### Usar como ci/cd

```bash
sqlfluff lint supabase/ --exit-code 1
```

### Configurar regras de formatação

```bash
sqlfluff fix supabase/ --rules L001,L003,L009
```

## Regras Habilitadas

### Capitalização

- `capitalisation.keywords`: Capitalização consistente de palavras-chave
- `capitalisation.functions`: Capitalização de funções
- `capitalisation.types`: Capitalização de tipos de dados

### Espaçamento

- `spacing`: Controle de espaçamento
- `comma_spacing`: Espaçamento ao redor de vírgulas
- `operator_spacing`: Espaçamento de operadores
- `bracket_spacing`: Espaçamento de parênteses

### Linting

- `line_length`: Máximo de caracteres por linha (88)
- `trailing_whitespace`: Remove espaços ao final
- `statement_endings`: Validação de terminação de statements
- `indentation`: Validação de indentação (2 espaços)

### Aliases e Referências

- `aliasing.table`: Aliases explícitos para tabelas
- `aliasing.column`: Aliases explícitos para colunas
- `references.qualification`: Qualificação de referências

## Configuração do VSCode

### Extensão Recomendada

1. Instale: `SQLFluff` (extension id: `dorzey.vscode-sqlfluff`)

### .vscode/settings.json

```json
{
  "[sql]": {
    "editor.defaultFormatter": "dorzey.vscode-sqlfluff",
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.fixAll.sqlfluff": true
    }
  },
  "sqlfluff.dialect": "postgres",
  "sqlfluff.maxLineLength": 88,
  "sqlfluff.runTrigger": "onSave",
  "sqlfluff.linting.rules": []
}
```

## Integração com CI/CD

### GitHub Actions

```yaml
name: SQL Linting
on: [push, pull_request]
jobs:
  sqlfluff:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install sqlfluff
        run: pip install sqlfluff[postgres]
      - name: Run sqlfluff lint
        run: sqlfluff lint supabase/
```

## Regras Customizadas

Para desabilitar uma regra específica, adicione à seção `rules` em `.sqlfluff.yaml`:

```yaml
rules:
  L001:
    disabled: true
```

Ou adicione um comentário no SQL:

```sql
-- sqlfluff:noqa:L001
SELECT  col1  FROM table;
```

## Troubleshooting

### "dialect not found"

Verifique se o pacote `sqlfluff[postgres]` está instalado

### "Error parsing file"

Valide se o SQL é válido PostgreSQL. Use `psql -n` para testar:

```bash
psql -f arquivo.sql --dry-run
```

### Performance com muitos arquivos

Use flags:

```bash
sqlfluff lint supabase/ --workers 4
```

## Versionamento

**Data de criação**: 17 de maio de 2026
**Versão**: 1.0.0
**Compatibilidade**: SQLFluff >= 2.0.0, PostgreSQL >= 12

## Referências

- [SQLFluff Docs](https://docs.sqlfluff.com/)
- [SQLFluff Rules](https://docs.sqlfluff.com/en/stable/rules.html)
- [PostgreSQL Dialect](https://docs.sqlfluff.com/en/stable/dialects.html#postgres)
