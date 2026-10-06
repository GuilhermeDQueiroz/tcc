# Relação entre a implementação e o TCC

Referência: `Parte Escrita/BUSINESS INTELLIGENCE APLICADO À LOGÍSTICA_ DESENVOLVIMENTO DE UM PAINEL ANALÍTICO PARA APOIO À TOMADA DE DECISÃO COM DADOS DE UM ERP.txt`. O documento original permanece preservado.

Conciliação atualizada em 04/10/2026, incorporando Formação de Cargas e Visão Estratégica. O andamento integral está no [plano de implementação](plano-implementacao-logistica-tcc.md), com [rastreabilidade dos requisitos](mapeamento-fontes-logisticas.md).

## Correspondência da arquitetura

| Etapa descrita | Implementação em business-intelligence-logistica |
|---|---|
| Mapeamento de regras | Consultas originais em etl/sql/fontes, 32 fontes comerciais, quatorze projeções logísticas e dicionário dos indicadores entregues |
| Integração Apache Hop | Pipelines .hpl de extração e transformação; workflows .hwf de dependências, carga e publicação |
| Staging | staging.stg_* comercial e logistica_stage recebem projeções brutas Firebird; logística restringe a população conforme recorte de pedidos elegíveis |
| Transformação | Table Input lê staging no PostgreSQL; SQL realiza joins, tratamento de tipos e cálculos; Table Output grava dw.carga_* |
| Modelo dimensional | Fluxo comercial com quatro dimensões e três fatos, carteira e metas; fluxo logístico com saldo por item e ponte de alocação por vínculo, preservando parcelas entre pedidos e cargas |
| Serviços | API Node.js/Express/pg; filtros parametrizados, pesquisa paginada, cache por publicação e domínio de cálculos |
| Apresentação | Vue 3/TypeScript, Pinia, Vue Router, Tailwind e Apache ECharts; áreas comerciais preservadas, Formação de Cargas e Visão Estratégica. Emitidos mantém rota, mas saiu do menu principal |
| Validação | Referência executada do código original sobre a publicação real, comparação por amostra na origem, testes de domínio e de navegador |

A organização do ETL segue as categorias do Portal-Corporativo: metadata, pipelines/extracao/dimensoes, pipelines/extracao/fatos, pipelines/transformacao-carregamento, workflows, scripts e sql. Python inicia/verifica o Hop e executa a referência de testes; a aplicação produtiva não depende de extrator.py nem de Streamlit.

A API comercial lê as views DW. A API logística lê os fatos publicados em `logistica`; a estratégica combina essa publicação com `dw.pedidos_faturados` e identifica ambas as versões. Reduções comerciais permanecem no domínio Node para reproduzir Float32, somas pairwise e groupby Kahan do NumPy/pandas. O navegador recebe agregados estratégicos e hierarquias logísticas para a consulta interativa.

## Indicadores preservados e significado

- Nível de serviço/lead time: cálculo original entre emissão e referência/faturamento, com média por registro. Não mede confirmação de entrega física.
- Atraso: critério original de pedidos em aberto com serviço superior a 60 dias; denominadores e valor em atraso permanecem os do legacy.
- Backlog real: subconjunto de situações definido no legacy, dividido pela média financeira diária do histórico de faturamento; backlog geral usa a carteira inteira. Limiares e classificação originais são preservados.
- OTIF: proporção dos registros faturados cujo faturamento ocorreu no prazo previsto; a transformação preservada atribui zero a prazo ausente e a tela estratégica informa a cobertura. Campos de entrega existem na origem, mas não participam do indicador e não comprovam entrega física nem In Full nesta implementação.
- Ticket médio: valor por item/quantidade, conforme o cálculo existente; não substituir por valor por pedido.
- Totalizadores dimensionais: onde o legacy soma distintos por grupo, a aplicação faz a mesma soma. Distintos globais e soma de distintos por grupo têm significados diferentes.
- Comparações: intervalos anuais, mensais e semanais mantêm a última data disponível, o histórico não temporal e os tratamentos originais de bases zero e ausência de meta.

## Trechos da parte escrita que precisam refletir a prática

1. A introdução menciona substituição dos dados por simulação. A prática utiliza registros da cópia local anonimizada informada pelo autor e publicações reais, sem modo sintético. Explicitar origem, recorte, proteção das imagens e limites de generalização. A rotina operacional da produção não foi observada em tempo real pelo painel local.
2. O texto cita filtros temporais na extração, Stream Lookup, Calculator e Value Mapper como componentes usados. As 32 projeções comerciais são completas; as quatorze logísticas usam recorte de pedidos elegíveis. Joins e cálculos são executados em SQL sobre staging, orquestrados pelo Hop. A descrição deve citar os componentes efetivamente presentes nos arquivos .hpl e .hwf.
3. O resumo e a construção do painel citam percentual de frete sobre faturamento. O indicador continua pendente; o [inventário inicial](inventario-frete-logistico.md) encontrou campos candidatos, mas frete combinado zero em todas as 5.152 cargas do recorte. Isso não prova custo zero nem autoriza substituir frete por R$/kg de produtos.
4. A avaliação com gestores, questionário Likert e comparação contra consolidação manual descritos na metodologia ainda precisam ser realizados pelo pesquisador. Os testes e o benchmark HTTP local não substituem essas etapas nem comprovam ganhos de produtividade gerencial.
5. O texto descreve Lead Time até entrega e atraso perante prazo acordado. A implementação distingue tempo até faturamento, idade de carteira e previsão de faturamento vencida. Revisar referencial e resultados para que esses três significados não se confundam. OTIF permanece convenção interna por faturamento, explicada com suas limitações.
6. O capítulo de construção/resultados deve incluir Formação de Cargas, parcelas livres/alocadas, mapa e previsões, além da Visão Estratégica com sete cards, cinco gráficos e quatro prioridades ligadas ao detalhamento. Assistência, recolhimento, duração por etapa e histórico real do saldo continuam pendentes.

## Texto técnico para incorporar à parte escrita

O protótipo integra dados do ERP Firebird por pipelines e workflows nativos do Apache Hop. No PostgreSQL, as projeções brutas são organizadas em staging, e transformações SQL publicam as estruturas analíticas. A API Node.js disponibiliza os cálculos e filtros, enquanto a interface Vue apresenta a formação de cargas e a visão estratégica. Os fatos logísticos distinguem saldo aberto, parcelas alocadas e parcelas livres por item, permitindo analisar quantidade, valor, peso e cubagem sem repetir o total do pedido em cada carga.

A visão estratégica relaciona a carteira publicada ao histórico de faturamento, com identificação das duas publicações e dos períodos utilizados. São apresentados cargas com saldo, valor alocado, peso aberto, backlog equivalente, pedidos antigos, tempo médio até faturamento e o indicador interno denominado OTIF. Neste protótipo, OTIF representa pontualidade de faturamento por registro, sem comprovação de entrega física ou atendimento integral. As prioridades permitem consultar os pedidos com saldo livre, previsão vencida ou previsão ausente. A conciliação SQL independente verifica os agregados; a avaliação com usuários e a comparação do esforço manual permanecem etapas a executar.

Esses parágrafos são uma proposta baseada na prática executada. Não introduzem resultados gerenciais medidos, referências bibliográficas novas ou afirmação de que a metodologia inteira já foi concluída.

## Roteiro de demonstração

1. Iniciar o PostgreSQL do projeto e mostrar, no pgAdmin, dados na porta 5434, staging e dw.
2. Abrir etl/workflows/main.hwf no Hop; mostrar uma extração de tabela bruta, uma transformação e a publicação. Executar carga completa somente quando houver acesso à rede da origem; reprocessamento somente DW usa o staging existente.
3. Abrir `/estrategico`: mostrar referências, sete indicadores, cinco gráficos, cobertura da previsão e definições de OTIF/Lead Time. Explicar que o período de faturamento não altera o saldo da carteira.
4. Abrir uma prioridade em Formação de Cargas. Mostrar o recorte transferido, pedidos/itens, parcela livre/alocada, seleção cruzada com cargas e mapa. Diferenciar valor dos produtos, frete e faturamento/saída/entrega.
5. Demonstrar os painéis comerciais e o recorte agosto/2026 como validação de compatibilidade; Emitidos continua acessível por sua rota. Mostrar detalhamento e exportação.
6. Apresentar o dicionário e a matriz de rastreabilidade, `docs/visao-estrategica-logistica.md` e as evidências de origem/SQL, distinguindo equivalência técnica da avaliação gerencial ainda pendente.
