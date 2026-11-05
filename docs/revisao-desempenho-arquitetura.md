# Revisão de desempenho, arquitetura e organização

Data: 03/11/2026. Escopo: `business-intelligence-logistica`, API Node/Express, interface Vue, consultas PostgreSQL e organização do ETL. As alterações anteriores existentes na pasta foram preservadas.

## Melhorias implementadas

### 1. Consultar o cache de respostas antes de carregar os dados brutos

Em `api-server/repositories/postgres.js`, a consulta dos painéis e das opções de filtro carregava o snapshot antes de consultar o cache do resultado. Como o cache de dados brutos comporta uma entrada, navegar entre áreas descartava o snapshot anterior. Mesmo com uma resposta pronta em cache, voltar à área provocava leitura e normalização dos dados outra vez.

Agora a API verifica a publicação ativa e consulta o cache derivado primeiro. O snapshot é necessário somente quando o resultado solicitado não está em cache. A mesma mudança foi aplicada à visão estratégica em `api-server/repositories/strategic.js`.

- As chaves continuam incluindo a versão da publicação e o contexto da consulta.
- Mantêm-se o TTL, a capacidade limitada e o compartilhamento das requisições simultâneas da mesma chave.
- A disponibilidade da publicação é verificada a cada requisição; uma resposta em cache não oculta banco indisponível ou publicação ausente.
- A capacidade do cache bruto não foi aumentada: reter vários históricos completos teria um custo significativo de memória.

### 2. Transportar as árvores de cargas uma única vez

As tabelas de pedidos e cargas expunham o mesmo array como `rows` e `tree`. A serialização JSON repetia os registros e todos os seus filhos.

O adaptador `api-server/presentation/logistics.js` mantém apenas `rows` quando os dois campos são a mesma referência e adiciona `treeFromRows: true`. A store logística restaura `tree = rows` em memória. Árvores que diferem dos registros de origem continuam sendo enviadas integralmente.

Isso separa a representação de transporte do objeto usado pelos cálculos. Os vínculos carga → pedido → item, a seleção cruzada, os totais e a exportação da interface continuam disponíveis.

Consumidores diretos de `/api/v1/logistica/formacao` devem usar `table.rows` e seus `children`; quando necessário, podem reconstruir o alias indicado por `treeFromRows`.

### 3. Reaproveitar os cálculos entre páginas do pós-venda

Em `api-server/repositories/posvenda.js`, o cache anterior guardava somente os registros brutos. Toda troca de página refazia filtros, indicadores, gráficos, agrupamentos, opções e ordenação.

Agora há um cache de quatro resultados preparados, com TTL de cinco minutos, por publicação, área e seleção. Página, tamanho da página e formato de exportação não fragmentam esse cache. A paginação recorta somente os detalhes; os indicadores permanecem calculados sobre toda a população filtrada. O CSV continua incluindo todos os registros selecionados.

A transação de leitura termina e a conexão é devolvida ao pool antes dos cálculos em JavaScript. Isso reduz o tempo de ocupação da conexão durante a preparação da resposta.

### 4. Buscar somente os detalhes quando muda a página

O pós-venda aceita `section=details` para devolver apenas `dataVersion`, `referenceDate`, `total`, `page`, `pageSize` e `table`.

Exemplo:

```text
GET /api/v1/posvenda/assistencias?page=2&pageSize=20&section=details
```

A store usa essa opção ao paginar, mudar o tamanho da página ou ordenar os detalhes. As referências dos gráficos e indicadores já carregados são preservadas. Se a publicação mudar durante uma dessas consultas, a store solicita o painel completo para sincronizar o contexto.

Filtros, mudanças de área, granularidade e atualização manual continuam carregando o painel completo.

## Evidências locais

| Cenário | Antes | Depois |
|---|---:|---:|
| Formação de Cargas: JSON descomprimido | 11.611.023 bytes | 5.821.932 bytes |
| Formação de Cargas: gzip calculado sobre a resposta | 847.183 bytes | 429.136 bytes |
| Voltar ao resumo de Abertos depois de consultar Faturados | 2.420 ms na primeira requisição de retorno | 6–8 ms nas três requisições de retorno |
| Assistências, página 2: resposta completa em cache | 101–133 ms | 4 ms nas três amostras |
| Assistências, página 2: JSON completo versus detalhes | 59.793 bytes | 15.961 bytes |
| Assistências, página 2: gzip completo versus detalhes | 12.741 bytes | 2.049 bytes |

A remoção das árvores repetidas reduziu o JSON de cargas em aproximadamente 50%. A resposta exclusiva dos detalhes do pós-venda ficou aproximadamente 73% menor que a resposta completa da mesma página, ou 84% menor ao comparar gzip.

Os tempos são amostras exploratórias locais, com dados reais publicados. Incluem HTTP e leitura da resposta; não medem a tarefa de um gestor, o ETL ou toda a renderização. A primeira chamada de cada série pode já encontrar caches aquecidos. A coleta inicial teve outros trabalhos de auditoria em paralelo; não é uma comparação estatística controlada nem uma estimativa de p95. Os tamanhos são os corpos efetivamente recebidos; gzip foi calculado pelo script e não representa necessariamente a codificação escolhida pelo navegador.

As evidências privadas ficam em `.local/audit-performance-20261103.json`, `.local/audit-performance-after-20261103.json`, `.local/audit-pagination-20261103.json` e `.local/audit-cache-20261103.json`. Dados de detalhe e credenciais não foram incluídos neste documento.

## Validação

- 103 testes públicos aprovados, incluindo regressões de cache, indisponibilidade da fonte, troca de publicação, paginação e CSV.
- 18 testes de repositórios e hierarquias aprovados com referências reais locais.
- Build TypeScript/Vue aprovado.
- Três testes de navegador aprovados: carregamento sob demanda/mapa compartilhado, seleção cruzada de cargas/pedidos e pós-venda com paginação compacta.
- Comparação integral de sete respostas reais antes/depois: visão estratégica, resumo de Abertos, Formação de Cargas, duas páginas de assistências, detalhes de devoluções e CSV de assistências. Na formação, o alias `tree` foi reconstruído antes da comparação.

O projeto foi reiniciado para a validação de 03/11/2026. Na conferência de 05/11/2026, o ambiente foi deixado parado por solicitação do autor; consulte [estado e continuidade](estado-projeto.md).

## Próximas melhorias, em ordem de prioridade

### Alta: reduzir a leitura inicial dos históricos completos

A leitura isolada do snapshot estratégico carregou 335.890 registros emitidos e 333.532 faturados, levou 8,22 segundos e chegou a aproximadamente 961 MiB de heap no processo de medição. A melhoria do cache evita releituras desnecessárias de respostas prontas, mas esse custo inicial continua existindo.

Preparar modelos de consulta no PostgreSQL para períodos, dimensões e medidas necessárias é a próxima intervenção de maior impacto. Agregações publicadas por execução podem reduzir transferência e trabalho no Node. A primeira etapa deve medir os planos de execução e definir a granularidade de cada consulta.

O recorte precisa preservar as verificações de conflitos históricos, pedidos sem faturamento, faturamentos parciais, janelas de conversão e a aritmética atualmente conciliada. Aplicar apenas um filtro de datas ou substituir as reduções por `SUM` sem verificar equivalência pode alterar indicadores.

### Alta: virtualizar as tabelas de rolagem contínua

Na tela de cargas foram observados 1.424 elementos de linha no corpo das tabelas, 19.426 células e 25.751 elementos no DOM. Uma tarefa da thread principal durou 1.125 ms em uma navegação observada no Chrome.

As tabelas de cargas usam `pagination=false` intencionalmente e possuem testes que exigem rolagem contínua e todos os registros. Para preservar essa experiência, a recomendação é virtualização com suporte a alturas variáveis, expansão hierárquica, seleção, teclado e totalizadores fixos. Paginação visível pode ser uma opção para consultas de detalhe, como já ocorre no pós-venda.

A virtualização não foi adicionada nesta alteração. Ela exige atualizar os testes para verificar acesso a todos os registros por rolagem, em vez de exigir que todas as linhas estejam simultaneamente montadas no DOM. A redução do corpo JSON não resolve, sozinha, esse custo de renderização.

### Média: dividir o módulo de gráficos por responsabilidade

O build ainda informa um chunk de gráficos de aproximadamente 795 kB minificado, ou 267 kB gzip. O componente `AnalyticChart.vue` reúne configuração de nove tipos de gráfico, mapas, métricas, tabelas e exportação.

Extrair construtores de opções por família facilita testes e manutenção. O carregamento de mapas e dos tipos de gráfico menos usados pode ser separado quando isso reduzir o custo das rotas iniciais. As rotas e o mapa já possuem mecanismos de carregamento sob demanda; eles devem ser preservados.

### Média: tornar a geração do ETL independente de pastas irmãs

`etl/scripts/build_etl.py` lê modelos da pasta irmã `Portal-Corporativo/etl`, e `build_logistica.py` depende de `.local/logistica-origem-schema.json`. Isso afeta a regeneração dos artefatos em um clone independente, embora não impeça executar os pipelines já gerados.

Manter os modelos e os metadados estruturais necessários dentro do próprio repositório e documentar explicitamente os insumos privados. A validação da geração deve ocorrer em diretório temporário antes de substituir os artefatos existentes.

### Média: revisar o tempo mínimo do indicador de carregamento

`LoadingState.vue` mantém a indicação por pelo menos dois segundos e depois aplica uma saída de 350 ms. Essa escolha é intencional e coberta por testes. Quando a API responde em poucos milissegundos, a percepção de espera permanece dominada pela apresentação.

Uma evolução possível é uma política configurável: evitar mostrar o indicador para respostas muito rápidas e manter um tempo curto de leitura somente quando ele chegar a aparecer. Essa mudança de experiência deve ser avaliada junto com os testes atuais.

### Baixa: organizar módulos e estilos pela responsabilidade atual

Extrair blocos por domínio de `commercial.js` e os construtores de opções de `AnalyticChart.vue`. Consolidar os estilos hoje distribuídos entre `style.css`, `review-layout.css` e `interface-refinements.css`, verificando a cascata visual durante a migração. Evitar reformatação geral junto com alterações de fórmula facilita revisar e reconciliar cada mudança.
