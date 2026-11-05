# Assistências, cancelamentos de venda e devoluções

## Regra confirmada no catálogo do ERP

O levantamento consulta as descrições de `RDB$RELATION_FIELDS` e `RDB$FIELDS` do Firebird, em transação somente leitura. `DOCUMENTO_FATURA.TIPO_DOCFAT` identifica **1 = Pedido de venda** e **2 = Assistência**. O campo `OPCAO_DOCFAT` identifica **1 = Emissão**, **2 = Cancelamento** e **4 = Devolução**. `ENTREGA_DOCFAT = 'N'` seleciona documentos originais, evitando contar novamente comprovantes de entrega. Portanto, trocar apenas o tipo é suficiente para identificar a população inicial de assistências, mas não implementa os três processos.

| Painel | População e grão | Medida e período |
|---|---|---|
| Assistências em aberto | Tipo 2, opção 1, item raiz 1 ou 4, saldo aberto positivo; um registro por detalhe | Saldo `QTDEABERTA_DOCITEMDET` do ERP na referência publicada, filtrado pela emissão da assistência |
| Assistências emitidas | Mesma população, inclusive itens atendidos, cancelados e de valor zero | Quantidade original `QTDECHAPAS_DOCITEMDET` e valor do item; emissão no período |
| Cancelamentos de venda | Tipo 1, opção 2, vínculo de `DOCUMENTO_DEVOLUCAOCANCELA` para detalhe original de venda | Quantidade positiva do evento; data de emissão do documento de cancelamento, incluindo cancelamentos parciais |
| Devoluções | Tipos 1 e 2, opção 4; um registro por `DOCUMENTO_ENTREGA_DEVCAN` ligado ao item original por `DOCUMENTO_ENTREGA` | Quantidade do vínculo devolvido × preço do detalhe original; tipo de venda/assistência visível |

Todos preservam o filtro de item raiz (`AUTOINC_DOCITEM = COMPOSICAOITEM_DOCITEM`) e tipos de item 1 ou 4. O grupo interno de teste 1603 é excluído, seguindo o fluxo comercial, sem eliminar grupos nulos. Não são criadas linhas artificiais para ausência de movimentação.

## Período filtrado e posição da base

O período apresentado vem de `meta.start` e `meta.end` e acompanha as datas aplicadas, limitado ao início e à referência da publicação. Assistências são selecionadas pela emissão; cancelamentos e devoluções, pela emissão do documento do evento.

`referenceDate` é a data de referência da publicação, usada para idade, situação da previsão e interpretação do saldo pendente. Por exemplo, selecionar agosto em uma base referenciada em 30/09/2026 mostra as assistências emitidas em agosto ainda pendentes naquela posição publicada; não mostra automaticamente o saldo que havia em 31/08. Reconstruir essa posição exige histórico de movimentos ou snapshots próprios.

“Última atualização” informa quando os dados foram publicados/atualizados, não a data de emissão nem o fim do filtro. Os rótulos atuais da tela são “Período” e “Referência”; a melhoria textual sugerida é “Período filtrado” e “Posição da base”. Essa sugestão ainda não altera a interface ou o cálculo.

## Vínculos e limites

Cancelamento usa `DOCUMENTO_DOCDEV` para o documento do evento e `AUTOINCITEMDETDOC_DOCDEV` para `DOCUMENTO_ITEM_DETALHE`. Este se relaciona a `DOCUMENTO_ITEM` e ao pedido de venda original. A quantidade do evento é multiplicada pelo valor unitário do detalhe original. O saldo cumulativo `QTDECANCELADO_DOCITEMDET` é preservado para rastreabilidade, mas não é somado novamente. O painel não mede cancelamento de notas fiscais, conforme escopo solicitado.

Na cópia inspecionada, os vínculos em `DOCUMENTO_DEVOLUCAOCANCELA` observados no intervalo pertencem à opção 2. Os documentos da opção 4 não têm itens próprios em `DOCUMENTO_ITEM` nem itens diretos em `DOCUMENTO_ENTREGA`. Seus cabeçalhos possuem quantidades/valores zerados, que não representam o movimento real. A população correta usa `DOCUMENTO_ENTREGA_DEVCAN.DOCUMENTO_DOCENTDEV` para o documento de devolução e `AUTOINCDOCENT_DOCENTDEV` para `DOCUMENTO_ENTREGA.AUTOINC_DOCENT`. Este último aponta ao detalhe original por `AUTOINCITEMDETDOC_DOCENT`. A quantidade vem de `QTDECHAPAS_DOCENTDEV`, com opção 4 e tipo de entrega 1. A implementação não inclui devoluções a fornecedores nem declara recolhimento físico pelo simples registro do documento. `RECOLHIMENTO` e `RECOLHIMENTO_ENTREGA` são entidades distintas e não participam dessa entrega.

Os motivos de assistência são selecionados no item, com fallback ao documento. Os motivos de cancelamento vêm do evento, com fallback ao documento. Devoluções usam o motivo de `DOCUMENTO_ENTREGA_DEVCAN`, com fallback ao documento. As descrições vêm de `MOTIVO`. Valores zero são legítimos e permanecem nas contagens. Preço ausente torna o total monetário indisponível, sem transformar ausência em zero. Valores de assistência não representam custo de atendimento ou receita adicional. O valor de devolução usa o preço do item original e não é apresentado como crédito fiscal ou valor da nota de entrada.

## Fluxo implementado

1. `scripts/inventariar-posvenda.py`: metadados, de/para dos tipos e agregações de conferência; resultado privado em `.local/`.
2. `etl/scripts/build_posvenda.py`: gera os pipelines nativos Hop, contratos e preparação de staging com os tipos reais inspecionados.
3. `etl/workflows/posvenda_local.hwf`: extrai campos brutos para `posvenda_stage`, sem alterar o staging comercial.
4. `etl/sql/posvenda/002_publicar.sql`: cria os fatos de grão explícito, valida vínculos, registra a execução e troca o ponteiro da publicação atomicamente.
5. `etl/workflows/posvenda_dimensoes_local.hwf`: publica os atributos reais complementares por `003_dimensoes.sql`, depois de liberar o bloqueio da carga base. O launcher encadeia as duas etapas.
6. `api-server/repositories/posvenda.js`: lê uma publicação consistente em transação somente leitura. `api-server/domain/posvenda.js`, `posvenda-analysis.js` e `posvenda-dimensions.js` calculam métricas, séries, filtros, hierarquias e paginação. A API consulta PostgreSQL, sem acesso direto ao Firebird.
7. `src/views/PosVenda.vue`: apresenta cartões, evolução mensal, motivos, produtos, UFs, análise dimensional, detalhes paginados e exportação CSV. Navegação em `/assistencias`, `/cancelamentos` e `/devolucoes`.

Credenciais são fornecidas pelo ambiente. A carga exige arquivo Firebird local explícito e destino `dados` na porta 5434, usa o mesmo bloqueio de carga do projeto e preserva publicações comerciais/logísticas. Reexecuções mantêm versões anteriores de pós-venda e fazem backup do schema publicado.

```powershell
python etl/scripts/run_posvenda.py --database CAMINHO_DA_COPIA_ANONIMIZADA.fdb --start-date 2025-01-01 --reference-date 2026-09-30
```

## Verificação

`scripts/verificar-posvenda.py` compara contagem de linhas, documentos distintos, pedidos afetados, quantidades e valores por consulta agregada no Firebird com a publicação PostgreSQL e com a API. O relatório real fica em `.local/posvenda-verificacao.json`. Dados reais, relatórios privados e credenciais não são versionados. Testes públicos verificam cálculos e filtros; o teste de interface percorre as quatro visões com a publicação real.

Conferência local realizada em **27/10/2026**, com janela de emissão/eventos de **01/01/2025 a 30/09/2026** e saldos referenciados em **30/09/2026**:

| Recorte | Documentos distintos | Registros no grão do painel | Quantidade |
|---|---:|---:|---:|
| Assistências em aberto | 1.132 | 1.862 detalhes | 3.677 pendentes |
| Assistências emitidas | 26.976 | 43.109 detalhes | 87.718 emitidas |
| Cancelamentos de venda | 2.640 | 23.923 parcelas de cancelamento | 54.467 canceladas |
| Devoluções | 228 | 707 parcelas de devolução | 2.855 devolvidas nos documentos |

Os cancelamentos alcançam **17.598 pedidos originais distintos**; um documento de cancelamento pode abranger vários pedidos. As contagens são evidência dessa publicação, não constantes da aplicação. As consultas agregadas independentes no Firebird, os fatos publicados e os totais da API coincidiram; o teste de interface passou com filtros, paginação, CSV e viewport móvel.

## Análises e apresentação

Os três painéis reutilizam o estilo de Pedidos em Aberto: cards, gráficos sobre fundo transparente, divisórias leves e análise por dimensão. Explicações extensas ficam recolhidas em “Sobre os indicadores”.

A evolução permite **mês, semana e dia**. As semanas começam na segunda-feira; o agrupamento não altera os filtros nem os totais, e períodos sem registros recebem quantidade zero. Nas assistências abertas, a evolução representa **saldo atual por período de emissão**, não um histórico diário de saldos. As datas são limitadas à cobertura da publicação.

“Análise por dimensão” segue o catálogo compartilhado com Pedidos em Aberto, incluindo mês, previsão, UF, região, entrega, status, supervisor, consultor, grupos comerciais, atributos de produto, origem, órgão, idade, cidade e microregião. Cliente, motivo, tipo, empresa e situação da previsão complementam a seleção. Cliente e produto são agrupados por identidade, evitando juntar códigos diferentes com a mesma descrição. A tabela e os gráficos usam toda a população filtrada, independentemente da página da pesquisa. O total de documentos é distinto; a soma das contagens por grupos pode ultrapassá-lo quando um documento participa de mais de um grupo. A pesquisa de documentos permite filtros, ordenação, paginação e CSV.

As análises de assistência adaptadas de Pedidos em Aberto são:

- Faixas de idade de 0–15, 16–30, 31–45, 46–60 e mais de 60 dias, calculadas na referência publicada. Na visão emitidas, idade não significa pendência atual.
- Cronograma e status da previsão, sempre sobre **quantidades ainda pendentes**, inclusive na visão emitidas. Previsões ausentes ficam em “Sem previsão” e não são lançadas em um dia fictício do calendário.
- Tipo de assistência, motivos, geografia por UF e status do ERP, com quantidades como medida principal.
- Seleção de um dia do calendário para pesquisar os documentos daquele prazo.

Não são reproduzidos indicadores que exigiriam dados adicionais, como custo da assistência, margem ou comprovação de entrega/recolhimento. Faturamento de reposição não é tratado como conclusão física do atendimento.

## Padronização visual e dimensões

Os três painéis seguem a organização visual, os componentes e o carregamento de Pedidos em Aberto. A análise dimensional compartilha as 21 dimensões daquele painel, na mesma sequência, complementadas pelas dimensões próprias de pós-venda e pela pesquisa de documentos no final.

As medidas de peso e cubagem estão disponíveis na análise dimensional após a publicação complementar dos atributos reais de itens e pedidos. São calculadas com as quantidades dos eventos, ou com o saldo pendente na visão de assistências em aberto. Não comprovam carga transportada ou recolhimento físico. Essa publicação usa os espelhos já extraídos pelo Hop e não altera os fatos financeiros nem exige nova extração do ERP.

Consulte [Dimensões e layout de pós-venda](dimensoes-posvenda.md) para conhecer a linhagem, as hierarquias, a cobertura, os tipos de gráfico e o comando de publicação complementar.
