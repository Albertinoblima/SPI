# SPI - Sistema de Pesquisa Inteligente — Apresentação do Sistema

## Visão Geral

O SPI - Sistema de Pesquisa Inteligente é uma solução robusta, multi-tenant, desenvolvida para facilitar a coleta, análise e gestão de dados de pesquisas em campo e online. O sistema integra aplicativos mobile (React Native/Expo), web (Next.js), backend Supabase, e recursos avançados de sincronização, analytics e segurança.

---

## Funcionalidades Principais

### 1. Coleta de Dados em Campo (Mobile)

![Coleta Mobile](https://img.icons8.com/ios-filled/100/000000/survey.png)

- **Aplicativo Mobile Offline/Online:** Permite a coleta de respostas mesmo sem conexão, sincronizando automaticamente quando a internet estiver disponível.
- **Geolocalização:** Registra a localização do entrevistador e do respondente, garantindo a autenticidade dos dados.
- **Captura e Compressão de Imagens:** Fotos de documentos, assinaturas e ambientes são comprimidas automaticamente para economizar espaço e agilizar uploads.
- **Gerenciamento de Tarefas em Background:** Sincronização automática de dados e uploads de mídia, mesmo com o app em segundo plano.
- **Detecção de Conectividade:** O app identifica quando está online e dispara sincronizações automáticas.

---

### 2. Plataforma Web Administrativa

![Dashboard Web](https://img.icons8.com/ios-filled/100/000000/combo-chart.png)

- **Dashboard Analítico:** Visualização de resultados em tempo real, gráficos, mapas de respostas e indicadores de desempenho.
- **Construtor de Pesquisas (SurveyBuilder):** Criação visual e intuitiva de questionários, com suporte a lógica condicional, tipos de perguntas variados e arrastar-e-soltar (drag-and-drop).
- **Gestão Multi-tenant:** Suporte a múltiplas organizações, cada uma com seus próprios usuários, pesquisas e dados isolados.
- **Controle de Acesso e Permissões:** Diferentes níveis de usuário (administrador, supervisor, entrevistador), com permissões configuráveis.
- **Exportação de Dados:** Exportação de resultados em formatos CSV, Excel e integração com ferramentas externas.

---

### 3. Backend e Segurança

![Segurança](https://img.icons8.com/ios-filled/100/000000/lock-2.png)

- **Supabase com RLS (Row Level Security):** Garantia de isolamento de dados entre organizações e usuários, com regras avançadas de acesso.
- **Edge Functions:** Processamento de dados, geração de analytics e manipulação de mídia diretamente no backend, com alta performance.
- **Sincronização Bidirecional:** Dados coletados offline são reconciliados com o servidor, evitando duplicidades e conflitos.
- **Armazenamento Otimizado:** Compressão agressiva de imagens e gerenciamento eficiente do espaço em nuvem.

---

### 4. Diferenciais e Recursos Avançados

![Diferenciais](https://img.icons8.com/ios-filled/100/000000/idea.png)

- **Analytics Avançado:** Painel de BI integrado, com filtros dinâmicos, mapas de calor e relatórios customizáveis.
- **Experiência Offline Completa:** Todo o fluxo de coleta, edição e envio de dados funciona sem internet, ideal para pesquisas em campo.
- **Automação de Processos:** Tarefas como uploads, sincronização e limpeza de cache são automáticas, reduzindo erros humanos.
- **Interface Moderna e Intuitiva:** Design responsivo, acessível e fácil de usar tanto no mobile quanto no web.

---

## Fluxo do Usuário

![Fluxo do Usuário](https://img.icons8.com/ios-filled/100/000000/process.png)

1. **Administrador cria uma pesquisa** no painel web, define perguntas, lógica e permissões.
2. **Entrevistadores recebem tarefas** no app mobile, coletam respostas, fotos e localização.
3. **Dados são sincronizados automaticamente** com o backend assim que houver conexão.
4. **Supervisores e administradores acompanham resultados** em tempo real no dashboard, exportam relatórios e tomam decisões baseadas em dados.

---

## Em que o sistema pode ser melhorado

![Melhorias](https://img.icons8.com/ios-filled/100/000000/maintenance.png)

- **Aprimoramento de Acessibilidade:** Garantir que todos os elementos da interface web/mobile estejam 100% acessíveis (ex: labels em todos inputs, navegação por teclado).
- **Gestão de Conflitos Offline:** Implementar fluxos mais sofisticados para resolução de conflitos de dados coletados offline.
- **Monitoramento de Segurança:** Adicionar logs de auditoria e alertas para tentativas de acesso indevido.
- **Escalabilidade de Edge Functions:** Otimizar funções de backend para grandes volumes de dados e múltiplos tenants simultâneos.
- **Testes Automatizados:** Ampliar a cobertura de testes automatizados para garantir robustez em atualizações futuras.

---

*Este documento apresenta uma visão executiva e funcional do sistema, destacando seus diferenciais e potencial de impacto para pesquisas políticas modernas.*
