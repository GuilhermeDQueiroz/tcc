# Cobertura da aplicação migrada

Este mapa relaciona blocos funcionais do legacy a código produtivo e evidências. O catálogo AST contém também variáveis intermediárias; a presença de uma expressão no catálogo não significa que cada variável tenha uma asserção independente.

| Bloco original | Implementação | Evidência principal |
|---|---|---|
| Consultas QUERY_* e extração | etl/sql/fontes, sql/transformacoes, pipelines e workflows | tests/etl*, tests/dw-treatment, relatório de carga real e tratamento de agosto |
| Loaders, limpeza e nomes | contrato-colunas-dw.json; repositories/postgres.js | tests/repositories; comparador DW por 184 campos; aliases preservados |
| Float32/Float64, soma, média, agrupamento | domain/metrics.js | tests/metrics; referência original com registros reais |
| Filtros, datas, feriados | domain/filters.js e dates.js | tests/filters, dates, contracts; testes UI/chips/presets |
| Resumo de abertos | domain/open.js e forecast.js | tests/abertos-equivalence e abertos-payload; todos os cards sobre 4.793 registros |
| Dimensões de abertos | domain/dimensions.js | tests/abertos-equivalence: linhas e totais das 23 dimensões originais |
| Calendário, carteira real/geral e backlog | domain/forecast.js; snapshot de faturamento em repositories/postgres.js | tests/forecast; oracle original; verificação da média no PostgreSQL real |
| Semanas e canais comerciais | domain/commercial.js | tests/comercial: três períodos, rankings, canais, distintos e valores de agosto |
| Acompanhamento mensal e metas | commercial.js, goals.js, settings.js | tests/comercial e goals: séries diárias, acumulados, projeção, ranking e consultores sem movimento/meta |
| Evolução mensal e anual | commercial.js | tests/comercial: totais, séries, comparação anual, mapa de calor por ano/dimensão/volume/peso |
| Geografia e dimensões comerciais | commercial.js, dimensions.js | scripts/verify-dimensions.mjs: 43 análises completas, 404.313 comparações numéricas e 155.462 de centavos contra capturas originais |
| Carteira, status, classes, RFM | customers.js | tests/customers: todos os campos capturados, carteira completa e histórico integral; oportunidades, recência, qualidade e cobertura UF |
| Hierarquias e tabelas | dimensions.js; AnalyticTable.vue | tests/hierarchy-regression: summaries, aliases, datas, limites, customização e período anterior; testes HTML reais |
| Gráficos, mapas e formatação | AnalyticChart.vue, MetricCard.vue, useFormatters.ts | testes UI de valores/charts reais, formatação, controles e captura visual |
| Pesquisa e exportação | repository.getDetails; AnalyticsPage.vue e AnalyticTable.vue | filtros SQL, paginação, ordenação, seleção de colunas, CSV e drill-down real |
| Navegação, corrida de respostas, presets/metas | stores/analytics.ts, client.ts e settings.js | testes UI de respostas fora de ordem, ciclo de presets/204, áreas, filtros e versões |
| Execução local | scripts/iniciar-dev.ps1 e parar-dev.ps1 | início/parada reais com verificação de identidade; banco preservado na porta 5434 |

As telas reutilizam src/components/analytics/AnalyticsPage.vue, com views das três áreas. A seleção de aba e parâmetros determina a análise; o domínio calcula seus resultados na API. Esse compartilhamento mantém todas as áreas sem replicar suas regras em componentes separados.

## Limites de cobertura

A origem Firebird foi comparada por amostragem de agosto, conforme a escolha do usuário. Não houve comparação integral contemporânea das cinco consultas na origem. As comparações completas descritas aqui são dos cálculos sobre o DW publicado.

Existe uma diferença de identidade no limite de filhos empatados em valor na árvore de faturados: o quicksort NumPy não é reproduzido exatamente pelo sort JavaScript. Os registros envolvidos na evidência atual possuem os mesmos indicadores comparados; raízes, RFM e totais preservam seus resultados. Isso impede prometer igualdade absoluta da identidade de todos os filhos em qualquer empate.

Fronteiras sem ocorrência nos registros disponíveis não foram exercitadas com dados artificiais. Em particular, a amostra de agosto não contém volume superior a 1.000 no ramo de conversão; a regra está preservada e a comparação distingue os campos brutos dos tratados. Falha real da publicação Hop com versão anterior intacta não foi injetada integralmente nesta rodada.
