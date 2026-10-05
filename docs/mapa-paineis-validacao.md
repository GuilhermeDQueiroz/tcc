# Mapa de validação painel por painel

Fluxo acordado em 01/10/2026: mapear, implementar uma tela, conferir código/dados/navegador e apresentar ao usuário. A próxima revisão visual depende da avaliação da tela anterior. A implementação matemática já existente não significa aprovação da disposição visual.

## Ordem das telas

| Ordem | Área e painel | Base original | Revisão visual |
|---|---|---|---|
| 1 | Abertos — resumo completo | views/pedidos_em_aberto.py e pedidos_em_aberto_charts.py | Primeira entrega para validação |
| 2 | Abertos — calendário e detalhamento por dia | build_forecast_calendar/filter_forecast_backlog e render_pedidos_em_aberto | Após avaliar o resumo |
| 3 | Abertos — geografia | _render_mapa_brasil e render_summary_table | A revisar |
| 4 | Abertos — dimensões/hierarquias | render_summary_table, _render_dim_chart e views/shared.py | A revisar; integrado também ao resumo |
| 5 | Abertos — pesquisa | pesquisa/listagem em render_pedidos_em_aberto | Integrada à dimensão Pesquisa de Pedidos; grão e filtros locais confrontados com o original; avaliação do usuário pendente |
| 6 | Emitidos — semanal | view original de emitidos, helpers comerciais/semanais | A revisar |
| 7 | Emitidos — mensal e metas | view original de emitidos e consultor_metas.py | A revisar |
| 8 | Emitidos — evolução | evolução mensal/anual original | A revisar |
| 9 | Emitidos — geografia | agrupamentos geográficos originais | A revisar |
| 10 | Emitidos — carteira | status, RFM e oportunidades originais | A revisar |
| 11 | Emitidos — dimensões | views/shared.py e configuração de dimensões original | A revisar |
| 12 | Emitidos — pesquisa | pesquisa, filtros e exportação originais | A revisar |
| 13 | Faturados — semanal | view original de faturados, helpers comerciais/semanais | A revisar |
| 14 | Faturados — mensal e metas | view original de faturados e consultor_metas.py | A revisar |
| 15 | Faturados — evolução/serviço/OTIF | evolução mensal/anual original | A revisar |
| 16 | Faturados — geografia | agrupamentos geográficos originais | A revisar |
| 17 | Faturados — carteira | status, RFM e oportunidades originais | A revisar |
| 18 | Faturados — dimensões | views/shared.py e configuração de dimensões original | A revisar |
| 19 | Faturados — pesquisa | pesquisa, filtros e exportação originais | A revisar |

Todas as fontes acima são do diretório legacy preservado. Os nomes precisos de cada função/caminho constam do catálogo de equivalência; o quadro define a ordem de revisão, sem declarar concluídas as telas posteriores.

## Painel 1: resumo de pedidos em aberto

| Bloco | Código legacy | Disposição e verificação |
|---|---|---|
| Indicadores | pedidos_em_aberto.py:472–515 | Duas linhas de cinco posições; backlog real/geral no mesmo card; 13 valores lógicos preservados, com entrega/retirada em outra seção |
| Backlog e aging | linhas 520–534; charts _render_backlog_evolution/_render_aging_donut | Proporção 1,7:1,1; cores por faixa preservadas; valores de referência original |
| Calendário e previsão | linhas 541–598; build_forecast_calendar | Controles de mês e real/geral integrados ao resumo; mesma função Node já comparada com a original; cores por intensidade da função _forecast_calendar_color |
| Entrega mensal e donut | linhas 605–733 | Groupby mensal por tipo de entrega; alternância KG/R$; referência nova executa a expressão AST original com os registros reais |
| Cards de entrega e retirada | linha 736; _render_entrega_cards | Duas colunas abaixo dos gráficos; peso, pedidos e participação preservados |
| Mapa e status | linhas 743–759 | Proporção 1,3:1; mapa dos 27 estados; top nove status mais Outros |
| Dimensões | linhas 768–886; render_summary_table/_render_dim_chart | Uma dimensão ativa, configuração de gráfico/métrica, tabela com hierarquia, totalizador e CSV; usa o endpoint de dimensões já confrontado com as capturas originais |
| Pesquisa integrada | df_grouped/tot_ped_aberto, linhas 914–961 | Uma linha por pedido, filtros locais de supervisor/consultor/status, totalizadores originais, ordenação, paginação e CSV |

Implementação: src/components/abertos/OpenOverview.vue, OpenOrders.vue, src/overview-layout.css, src/review-layout.css e api-server/domain/open.js/open-orders.js. Nenhum valor de screenshot é fixado no código. Imagens de cargas diferentes podem ter valores diferentes.

Correções solicitadas pelo usuário em 01/10/2026: a introdução, as guias superiores de Abertos, os botões redundantes do cabeçalho, “Ver dados do gráfico” e “Outras análises de previsão e canais” foram removidos. O cabeçalho verde usa o mesmo ícone semântico da sidebar. Gráficos e dimensões têm ícones e configuração com exportação, visualização, ordenação/limites quando aplicáveis e tela cheia (Esc para sair). A seleção KG/R$ de entrega usa botões. Cards têm tooltips por mouse/teclado; carregamentos de painel, filtros, dimensões, pesquisa e mapa têm spinner. Faixa de Tempo e Pesquisa de Pedidos estão na faixa de dimensões. Os antigos endpoints continuam como contratos de compatibilidade; as guias não são exibidas no painel de Abertos.

Referência da pesquisa: scripts/reference-open-orders.py executou as expressões AST originais com os mesmos registros reais. tests/open-orders.test.js comparou exatamente 1.378 pedidos e seus totalizadores, além de três recortes reais. scripts/verify-open-orders.mjs repetiu a comparação pela API PostgreSQL: 22.760 campos, totalizadores iguais e CSV com 1.378 linhas. Não houve nova extração nem dados substitutos.

Referências: scripts/reference_full.py (funções originais), scripts/reference-open-layout.py (groupby inline original), tests/open-organization.test.js e tests/ui/open-organization.spec.ts. A ferramenta de referência consulta somente os arquivos privados já normalizados e não extrai dados nem alimenta a aplicação.

Cada próxima entrega deve registrar: fontes/cálculos usados, filtros e controles presentes, comparação sobre a mesma versão, navegação/exportação, resultado dos testes e observações do usuário. Uma divergência de layout ou comportamento permanece aberta até ser corrigida e verificada.
