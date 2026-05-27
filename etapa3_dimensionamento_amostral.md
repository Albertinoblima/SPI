# Etapa 3 — Dimensionamento Amostral

## 1. Fundamentos Estatísticos

O dimensionamento amostral define o tamanho da amostra necessária para garantir que os resultados de uma pesquisa sejam representativos da população, dentro de uma margem de erro e nível de confiança estabelecidos.

**Principais parâmetros:**

- **População (N):** Total de elementos do universo pesquisado.
- **Margem de erro (E):** Tolerância máxima para o erro amostral (ex: ±3%).
- **Nível de confiança (Z):** Probabilidade de a amostra representar a população (ex: 95% → Z=1,96).
- **Proporção esperada (p):** Estimativa da proporção do atributo pesquisado (ex: 0,5 para máxima variabilidade).
- **Complemento da proporção (q):** q = 1 - p.

## 2. Fórmulas Matemáticas

- **Amostragem infinita (população grande):**
  $$

n_0 = \frac{Z^2 \cdot p \cdot q}{E^2}
  $$
- **Ajuste para população finita:**
  $$
n = \frac{n_0 \cdot N}{n_0 + N - 1}
  $$
- **Exemplo prático:**
  Para N=10.000, p=0,5, E=0,03, Z=1,96:
  1. Calcule $n_0$.
  2. Ajuste para $n$.

## 3. Detalhes Técnicos de Programação

- **Entradas do sistema:**
  - N (população), E (margem de erro), Z (nível de confiança), p (proporção esperada).
- **Validações:**
  - N > 0, 0 < E < 1, Z > 0, 0 < p < 1.
- **Fluxo típico:**
  1. Receber parâmetros via formulário, API ou script.
  2. Calcular $n_0$.
  3. Se N for finita, ajustar para $n$.
  4. Arredondar resultado para cima.
  5. Exibir/armazenar resultado.

- **Exemplo de função (pseudocódigo):**
  ```
  function calcularAmostra(N, E, Z, p):
      q = 1 - p
      n0 = (Z^2 * p * q) / (E^2)
      if N is finite:
          n = (n0 * N) / (n0 + N - 1)
      else:
          n = n0
      return ceil(n)
  ```

- **Considerações de implementação:**
  - Permitir diferentes níveis de confiança (Z tabelado).
  - Interface para simular diferentes cenários.
  - Exportação dos resultados (PDF, CSV).
  - Logs de cálculo para auditoria.

## 4. Arquitetura e Integração

- **Onde implementar:**
  - Backend (Node.js, Python, etc.) para cálculos robustos.
  - Frontend (React, Next.js) para interface de entrada/visualização.
- **Reutilização:**
  - Funções utilitárias em `shared-utils` ou serviços dedicados.
- **Testes:**
  - Unitários para fórmulas.
  - Testes de integração para fluxo completo.

## 5. Verificação

- Conferir resultados com exemplos clássicos de livros de estatística.
- Validar arredondamento e limites de entrada.
- Testar com diferentes tamanhos de população e margens de erro.

## 6. Decisões e Limites

- **Incluído:** Cálculo clássico para amostragem aleatória simples.
- **Excluído:** Amostragem estratificada, por conglomerados, ponderações complexas (podem ser etapas futuras).

---

# Impactos do Dimensionamento Amostral nas Demais Fases

O dimensionamento amostral influencia diretamente todas as fases subsequentes do processo de pesquisa. Veja os principais impactos em cada etapa:

## 1. Planejamento Operacional
- **Definição de recursos:** O tamanho da amostra determina a quantidade de entrevistadores, tempo de campo, logística e orçamento necessários.
- **Cronograma:** Amostras maiores demandam mais tempo para coleta e processamento.

## 2. Elaboração do Instrumento de Coleta
- **Adequação do questionário:** Questionários longos podem ser inviáveis para amostras grandes, exigindo otimização do instrumento.

## 3. Seleção e Treinamento de Equipe
- **Dimensionamento da equipe:** O número de entrevistadores e supervisores é calculado com base no tamanho da amostra.
- **Treinamento:** Amostras maiores exigem mais profissionais treinados.

## 4. Coleta de Dados
- **Execução:** O volume de entrevistas/observações é definido pelo dimensionamento, impactando rotas, distribuição geográfica e tempo de coleta.
- **Controle de qualidade:** Amostras grandes aumentam a necessidade de monitoramento e validação.

## 5. Processamento e Análise
- **Carga de trabalho:** Mais dados para digitação, limpeza e análise estatística.
- **Capacidade computacional:** Sistemas e bancos de dados precisam suportar o volume definido.

## 6. Apresentação de Resultados
- **Precisão dos resultados:** O tamanho da amostra afeta a margem de erro e a confiabilidade das conclusões apresentadas.
- **Segmentações:** Amostras pequenas podem limitar análises por subgrupos (ex: faixas etárias, regiões).

## 7. Custos e Prazos
- **Orçamento:** Amostras maiores elevam custos de campo, processamento e análise.
- **Prazos:** O tempo total do projeto é impactado pelo volume de dados a ser coletado e processado.

---

**Resumo:**
O dimensionamento amostral é um ponto de partida crítico: define o escopo operacional, a viabilidade financeira, a robustez estatística e a profundidade das análises possíveis em todas as fases do projeto de pesquisa. Decisões tomadas nesta etapa devem ser cuidadosamente alinhadas com os objetivos, recursos e limitações do projeto.

---

## 8. Exemplos de Código

### Exemplo em TypeScript (Backend/Shared Utils)

```ts
/**
 * Calcula o tamanho da amostra para amostragem aleatória simples.
 * @param N População total
 * @param E Margem de erro (ex: 0.03 para 3%)
 * @param Z Valor z do nível de confiança (ex: 1.96 para 95%)
 * @param p Proporção esperada (ex: 0.5 para máxima variabilidade)
 */
export function calcularAmostra(N: number, E: number, Z: number, p: number): number {
  const q = 1 - p;
  const n0 = (Z ** 2 * p * q) / (E ** 2);
  if (N && N < Infinity) {
    return Math.ceil((n0 * N) / (n0 + N - 1));
  }
  return Math.ceil(n0);
}
```

### Exemplo de Uso no Frontend (React/Next.js)

```tsx
import { useState } from 'react';
import { calcularAmostra } from '@political-research/shared-utils';

export function AmostraForm() {
  const [N, setN] = useState(10000);
  const [E, setE] = useState(0.03);
  const [Z, setZ] = useState(1.96);
  const [p, setP] = useState(0.5);
  const [resultado, setResultado] = useState<number>();

  function calcular() {
    setResultado(calcularAmostra(N, E, Z, p));
  }

  return (
    <div>
      <input type='number' value={N} onChange={e => setN(Number(e.target.value))} placeholder='População' />
      <input type='number' value={E} onChange={e => setE(Number(e.target.value))} placeholder='Margem de erro' step='0.01' />
      <input type='number' value={Z} onChange={e => setZ(Number(e.target.value))} placeholder='Z' step='0.01' />
      <input type='number' value={p} onChange={e => setP(Number(e.target.value))} placeholder='Proporção' step='0.01' />
      <button onClick={calcular}>Calcular</button>
      {resultado && <div>Amostra recomendada: {resultado}</div>}
    </div>
  );
}
```

### Exemplo de Integração Mobile (React Native/Expo)

- O cálculo pode ser feito localmente ou via API, e o resultado pode ser usado para validar o número mínimo de entrevistas antes de permitir o fechamento da coleta.

---

## 9. Integração com o Sistema

- **Backend:** Função utilitária pode ser implementada em `@political-research/shared-utils`.
- **Frontend Web:** Formulários de configuração de pesquisa usam o cálculo para sugerir ou validar o tamanho da amostra.
- **Mobile:** O app pode exibir o tamanho mínimo de amostra e bloquear o envio de resultados se não atingir o mínimo.
- **APIs:** O backend pode expor endpoint para cálculo amostral ou validação de amostra mínima.

---

## 10. Arquivos Relacionados à Etapa

### Utilitários e Lógica Compartilhada

- `packages/shared-utils/src/index.ts`  
- `packages/shared-utils/src/format-utils.ts`  
- `packages/shared-utils/src/date-utils.ts`  

### Entidades e Tipos

- `packages/shared-types/src/entities/Survey.ts`  
- `packages/shared-types/src/entities/Response.ts`  
- `packages/shared-types/src/entities/Question.ts`  

### Validações

- `packages/shared-validations/src/survey.schema.ts`  
- `packages/shared-validations/src/response.schema.ts`  
- `apps/mobile/src/utils/validators.ts`  

### Integração e Sincronização

- `apps/mobile/src/services/supabase.ts`  
- `apps/mobile/src/services/sync/SyncEngine.ts`  
- `apps/mobile/src/services/mobileApi.ts`  

### Documentação e Relatórios

- `docs/modelo_relatorio_pesquisa.md`  
- `docs/dashboard_detalhado.md`  
- `docs/api-reference.md`  
- `docs/architecture.md`  

### APIs Web

- `apps/web/src/app/api/admin/system/stats/route.ts`  
- `apps/web/src/app/api/admin/tenants/route.ts`  
- `apps/web/src/app/api/admin/system/errors/route.ts`  

---
