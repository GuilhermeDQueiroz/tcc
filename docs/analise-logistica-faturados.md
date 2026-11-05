# Análise Logística dos Pedidos Faturados

O painel `/faturados`, apresentado no menu como **Faturados · Logística**, acompanha o fluxo processado até o faturamento. Sua contribuição ao TCC é ligar a demanda e a carteira aberta aos resultados observados: massa e cubagem processadas, tempo de atendimento, pontualidade e distribuição dos destinos. Esses dados apoiam o planejamento de capacidade e a investigação de gargalos; não demonstram, por si, redução de custos ou melhoria da entrega.

## Organização e decisões apoiadas

| Análise | Conteúdo | Uso logístico |
|---|---|---|
| Mensal, tela inicial | Peso, cubagem, pedidos, itens, lead time e faturamento no prazo; fluxo por dia; modalidade de atendimento | Identificar concentração do processamento, variação do atendimento e perfil da demanda atendida |
| Semanal | Mesmo conjunto logístico, com detalhamento diário da semana de referência | Apoiar reuniões de acompanhamento e comparação dos volumes dos cards com semanas anteriores |
| Evolução | Peso, cubagem, lead time, pontualidade, pedidos e itens por mês; mapa de calor | Investigar sazonalidade e mudanças no ritmo de processamento |
| Destinos | Distribuição por UF, cidade e região; mapa por UF | Identificar destinos que concentram peso ou cubagem e aprofundar o planejamento de atendimento |
| Dimensões | Peso, cubagem, valor, itens ou pedidos por dimensão; evolução da métrica escolhida | Investigar concentrações por destino, produto ou modalidade |
| Pesquisa | Pedidos e parcelas faturadas, filtros, paginação e exportação | Consultar os registros que explicam os agregados |

O peso é a métrica inicial dos gráficos configuráveis. O mapa de calor inicia por UF. As hierarquias geográficas aprofundam UF → cidade → cliente → pedido; a evolução mensal usa mês → UF → cidade → cliente → pedido. O usuário pode configurar outras hierarquias.

O valor faturado permanece como contexto econômico. Metas financeiras, projeções de vendas, ticket médio, R$/tonelada, rankings por consultor/supervisor e segmentação RFM deixam de ocupar a apresentação principal de Faturados. As análises comerciais de Emitidos e suas fórmulas permanecem disponíveis na rota correspondente.

## Definições e cuidados de interpretação

- **Peso e cubagem:** soma das parcelas faturadas, apresentadas em toneladas e m³. Não medem capacidade disponível, ocupação do veículo ou volume efetivamente entregue.
- **Pedidos com faturamento:** pedidos distintos com registro de faturamento no recorte. Faturamento parcial conta como pedido com algum atendimento, sem provar conclusão integral.
- **Lead time até faturamento:** média de `NIVEL_DE_SERVICO_CLEAN` por registro, preservando a regra do DW. Não se calcula pela média das médias dos dias ou dos meses. Um pedido com várias parcelas pode participar várias vezes.
- **Faturamento no prazo:** média de `ON_TIME_CLEAN`. A regra compara faturamento com previsão de faturamento; registros sem previsão recebem zero na transformação existente. A ajuda do card informa a quantidade de registros com previsão, e a API publica `meta.forecastCoverage`. Não é OTIF completo de entrega.
- **Entrega e retirada:** modalidade cadastrada no ERP; não confirmação de um evento de entrega. RETIRA/RETIRADA são agrupados. Valores ausentes aparecem como “Não informado”. As categorias conciliadas são informativas; os filtros avançados usam os valores originais publicados.
- **Totais de pedidos e grupos:** distintos no recorte total. Um pedido ou grupo pode aparecer em vários dias, meses ou modalidades; essas contagens não devem ser somadas para reconstruir o total.
- **Destinos:** distribuição geográfica dos registros faturados. O mapa não calcula roteiros, distância, custo de frete ou prazo de transporte.

Mensal considera o mês da última data faturada disponível após os filtros, até essa data. Semanal considera a semana definida pela referência e pela última data disponível. Os períodos aparecem na tela; nenhum mês futuro é projetado como realização. Evolução utiliza o histórico filtrado. As tabelas dimensionais de Destinos/Dimensões mantêm o recorte do ano da última data disponível; filtros de emissão e faturamento continuam aplicáveis.

## Relação com a Visão Estratégica e o texto do TCC

O acesso **Conversão por safra** leva ao indicador da Visão Estratégica. A conversão usa todos os pedidos emitidos como base, incluindo os ainda não faturados, e observa janelas de 7, 15 e 30 dias. Já a participação da safra nos cards mensais de Faturados utiliza o faturamento do próprio mês como base. São indicadores complementares e não intercambiáveis; veja [a definição de conversão](conversao-safra.md).

Formulação sugerida para o trabalho: “O painel de pedidos faturados foi organizado como análise do fluxo logístico até o faturamento, permitindo acompanhar peso, cubagem, tempo de atendimento, pontualidade de faturamento e concentração dos destinos. Em conjunto com a carteira aberta, a formação de cargas e a conversão por safra, oferece informações para apoiar o planejamento e a investigação de gargalos. Sua abrangência atual não comprova expedição, entrega física ou atendimento integral.”

O uso futuro das rotinas de registro de entrega e preenchimento sistemático da previsão deve ser tratado no TCC como evolução operacional proposta. A comparação relatada pelo autor — 30 a 40 segundos no ERP para obter valor, peso e volume, contra 3 segundos no painel — permanece um relato operacional, sem ser apresentada como experimento controlado ou ganho causado exclusivamente por esta reorganização.

## Validação técnica

Os testes públicos verificam os totais físicos, faturamento parcial, médias por registro, semanas vazias e filtros geográficos com variantes nos textos originais. O perfil real verifica os totalizadores mensais e a hierarquia por destino contra os registros publicados. Os testes de navegador exercitam a seleção de cubagem, pesquisa e navegação para a safra.

A leitura estratégica utiliza apenas as colunas necessárias aos seus indicadores, mantendo emissão e faturamento na mesma transação de leitura. O cache das bases completas conserva uma entrada e a libera antes de carregar outra área ou referência; voltar a uma área pode exigir nova leitura do banco. A conversão detecta conflitos de data em toda a população elegível, mas calcula as janelas somente para safras dentro do período analisado. Essas medidas reduzem retenção e alocação desnecessárias; não constituem uma medição de ganho de produtividade.
