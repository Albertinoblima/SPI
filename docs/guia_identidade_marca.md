# Guia de Identidade de Marca - iDialog SPI

Este guia define a nomenclatura oficial da marca para interfaces, documentação e comunicação técnica do sistema.

## Nome oficial do produto

- Nome completo: **iDialog SPI - Sistema de Pesquisa Inteligente**
- Nome curto (UI): **iDialog SPI**

## Dominios oficiais

- Institucional da empresa: `idialog.com.br`
- Produto web (producao): `spi.idialog.com.br`
- API do produto (quando aplicavel): `api.spi.idialog.com.br`
- Dominio tecnico temporario de deploy: `spi-sistema-pesquisa-inteligente.vercel.app`

## Regras de nomenclatura

1. Em titulos de paginas e documentos institucionais, use preferencialmente o nome completo.
2. Em menus, headers curtos e botoes, use o nome curto **iDialog SPI**.
3. Nao usar apenas **SPI** isolado em textos de interface ou documentos novos.
4. Em configuracoes tecnicas (slug, package, bundle, ids), manter valores existentes para evitar regressao.

## Exemplos recomendados

- Titulo de pagina: `iDialog SPI - Sistema de Pesquisa Inteligente`
- Header de dashboard: `Bem-vindo ao iDialog SPI`
- Texto institucional: `Plataforma iDialog SPI para gestao de pesquisas`

## Termos a evitar em novos conteudos

- `SPI - Sistema de Pesquisa Inteligente` (sem prefixo iDialog)
- `SPI Admin` (preferir `Painel Administrativo iDialog`)

## Aplicacao em PRs e commits

- Preferir mensagens com escopo de marca quando aplicavel:
  - `chore(branding): padronizar nomenclatura iDialog SPI`
  - `docs(branding): atualizar guia de identidade`

## Revisao rapida antes de publicar

- Nome da tela segue o padrao iDialog SPI?
- URL de producao citada corretamente (`spi.idialog.com.br`)?
- Termos legados de marca removidos dos textos visiveis?
- Configuracoes tecnicas sensiveis foram preservadas?
