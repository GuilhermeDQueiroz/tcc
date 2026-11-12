# Layout e análise dimensional de pós-venda

Assistências, Cancelamentos de venda e Devoluções usam os componentes e as regras visuais de Pedidos em Aberto: indicadores, títulos, separação das linhas de gráficos, calendário, abas, configurações, tabelas com rolagem contida, valores monetários completos e estados de carregamento. As análises operacionais próprias de cada painel foram preservadas.

## Organização das dimensões

`shared/analysis-dimensions.json` define a sequência e os ícones usados em Pedidos em Aberto e no pós-venda. A sequência comum é:

1. Resumo Mensal;
2. Previsão de Faturamento;
3. UF;
4. Região da UF;
5. Tipo de Entrega;
6. Status do Pedido, contextualizado como Status da Assistência naquele painel;
7. Supervisor;
8. Consultor;
9. Grupo de Cliente;
10. Grupo do Item;
11. Subgrupo;
12. Linha;
13. Tipo de produto;
14. Coleção;
15. Produto;
16. Classificação;
17. Origem;
18. Órgão;
19. Faixa de Tempo;
20. Cidade;
21. Microregião.

Cliente, Motivo, Tipo de documento, Empresa e Situação da previsão complementam a sequência. Pesquisa de documentos permanece no final. O resumo mensal é a seleção inicial.

As configurações seguem a mesma organização do painel de referência: tipo de gráfico, métrica, hierarquia, colunas e exportação. Estão disponíveis tabela, barras horizontais/verticais, pizza, donut, treemap e evolução mensal, com valor, peso, volume, quantidade, pedidos vinculados e documentos.

As hierarquias podem ser expandidas e configuradas com até oito níveis efetivos. Aceitam os nomes do painel de referência, por exemplo `Mes_Grupo,UF,CLIENTE,DOCUMENTO,ITEM`. Documento e item são sempre os dois últimos níveis, mesmo quando omitidos na configuração. Cada item identifica o produto e o registro publicado; registros distintos do mesmo produto no mesmo documento permanecem separados. Os totais contam documentos e pedidos distintos; essas contagens não devem ser somadas entre grupos que compartilham documentos. Em assistências, o identificador vinculado é o próprio documento de assistência, conforme o fato existente. Idade média é calculada por registro desde a emissão do evento até a referência; não é lead time de entrega.

Ramos com muitos filhos exibem vinte grupos e um agrupamento “Outros”, que conserva integralmente as medidas do restante. Esse agrupamento também é usado para conter o tamanho de árvores muito grandes. Não se descartam quantidades e valores para limitar a visualização.

## Origem e publicação

O workflow nativo `etl/workflows/posvenda_dimensoes_local.hwf` executa `etl/sql/posvenda/003_dimensoes.sql`. Ele usa os espelhos reais já extraídos pelo Hop, identifica o pedido original e grava uma fotografia descritiva em `posvenda.dimensoes`. Os fatos e os valores financeiros de `posvenda.registro` não são alterados.

A publicação usa uma transação e o bloqueio do ETL do projeto. A chave e a referência estrangeira preservam uma dimensão por registro de pós-venda. Qualquer multiplicação indevida interrompe a publicação; a contagem final deve coincidir com todos os registros da publicação base.

A tabela registra as versões de pós-venda e da carga comercial usada nos atributos. A API lê a revisão dimensional na mesma transação dos fatos e inclui sua versão no `dataVersion`, invalidando os caches quando uma nova revisão é publicada. Ela consulta somente a camada publicada, sem executar enriquecimento sobre o staging a cada requisição.

O launcher `run_posvenda.py` publica as dimensões automaticamente depois de concluir a carga base e liberar seu bloqueio de ETL. Para atualizar os atributos de uma carga já publicada, após atualizar os espelhos comerciais, execute:

```powershell
npm run etl:aftersales:dimensions
```

O comando exige as conexões locais configuradas no `.env`, Hop 2.19 e JDK 21, conforme o guia de reprodução. Não extrai dados artificiais nem altera o Firebird. Quem executar apenas o workflow base pela interface do Hop deve executar também o workflow complementar; o launcher Python já encadeia os dois.

A geografia corresponde ao documento do evento. Supervisor, consultor, modalidade de entrega e classificação correspondem ao pedido original. Peso e volume usam a quantidade do evento, ou a quantidade pendente na visão de assistências em aberto, com as medidas unitárias do detalhe do item e os fallbacks válidos do cadastro de produto. Ausência de medida suficiente mantém a totalização indisponível. Comissões principais conflitantes não são escolhidas arbitrariamente: ficam sem atribuição e são contabilizadas na cobertura da análise.

## Carregamento e validação

Abrir o painel, atualizar dados e alterar o recorte geral usam a cortina de carregamento compartilhada. Trocar a dimensão e paginar os detalhes carregam apenas a área analítica correspondente, preservando os indicadores e os gráficos visíveis. Erros locais permitem repetir a consulta sem apagar o restante do painel.

A publicação real foi verificada nas três áreas: os indicadores e gráficos anteriores permaneceram equivalentes e os totais se conservaram ao alternar as dimensões. Os testes públicos cobrem medidas desconhecidas, contagens distintas, hierarquias e conservação nos agrupamentos “Outros”. Os testes de navegador verificam a ordem, as configurações, a hierarquia, a comparação visual com Abertos, os carregamentos locais e a responsividade.
