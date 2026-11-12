# Dicionário dos indicadores logísticos

Conciliação em 04/10/2026. Este documento descreve o contrato implementado. As propostas de evolução permanecem no [plano](plano-implementacao-logistica-tcc.md); não substituem silenciosamente as fórmulas atuais.

## Carteira e formação de cargas

População: pedidos de venda elegíveis com itens de composição principal, tipos 1/4, saldo aberto positivo e emissão de 01/01/2026 a 30/09/2026, conforme `etl/scripts/build_logistica.py`. O saldo é o presente na cópia local, não um snapshot reconstruído de 30/09. A referência publicada é utilizada nas comparações de datas. Item é `AUTOINC_DOCITEMDET`; pedido é `CODIGO_DOCFAT`; carga é `CODIGO_CARGA`. Empresa é conservada nas tabelas; a unicidade global dessas chaves deve ser reavaliada antes de incorporar outra origem.

| Medida | Regra atual | Unidade / grão | Ausência e limite |
|---|---|---|---|
| Quantidade aberta | `QTDEABERTA_DOCITEMDET` dos itens elegíveis | Unidade registrada no item | Não representa quantidade originalmente pedida |
| Quantidade em carga | Soma de `QTDEABERTA_CARITE` por item | Parcela aberta da alocação | Vínculos com saldo zero não participam |
| Quantidade sem carga | Aberta − aberta alocada | Parcela livre do item | Negativos/inconsistências impedem publicação; não são ocultados por truncamento a zero |
| Pedidos sem / parcialmente / totalmente em carga | Classificação pelo saldo agregado de cada pedido | Pedido distinto | Tolerância de quantidade 0,000001; não confundir classificação sem carga com qualquer saldo livre |
| Valor aberto / em carga / sem carga | Quantidade correspondente × valor unitário | R$ por parcela | Preço unitário = valor bruto líquido do detalhe / quantidade original, truncado a seis casas; divisor zero gera ausência |
| Peso aberto / em carga / sem carga | Quantidade correspondente × peso bruto unitário | kg; cards em t | Cadastro do detalhe prevalece sobre cadastro geral conforme transformação; cobertura incompleta identificada |
| Cubagem aberta / em carga / sem carga | Quantidade correspondente × cubagem unitária | m³ | Não inferir volume de embalagem nem capacidade do veículo |
| Previsão efetiva em carga | Previsão do documento da carga, depois da carga, depois do pedido | Data por alocação | Sem data permanece sem previsão |
| Previsão da parcela livre | Previsão do pedido | Data por item / pedido | Não usa previsão de outra carga |
| Etapa da carga | Último marco priorizado: saída, fechamento, fim/início de conferência, fim/início de separação | Carga distinta | Classificação dos campos existentes; não prova sequência cronológica válida |

Detalhes de medidas e hierarquia: [Formação de Cargas](formacao-cargas-analise-operacional.md). Total global de pedidos é distinto: somar contagens por carga pode repetir pedidos distribuídos em várias cargas.

Em Pedidos em Aberto, **R$/TON** = valor total do saldo selecionado ÷ (peso total do saldo em kg / 1.000). O card e os recortes dimensionais calculam a razão a partir de seus totais; não somam razões das linhas. Sem peso positivo, a medida fica indisponível. A mesma opção está nas configurações dos gráficos do painel.

## Visão Estratégica

| Identificador da API | Medida e fórmula | População / unidade |
|---|---|---|
| `strategic.backlogReal` | Valor aberto nos status Documento em Carga, Logística, Faturado Parcial e Documento Liberado / média diária de faturamento dos 90 dias corridos terminados na referência | Carteira logística selecionada; dias equivalentes; base não positiva/ausente indisponível |
| `strategic.portfolioValue` | Valor aberto nos status logísticos | Saldo na referência publicada; R$ |
| `strategic.revenueKg` | Faturamento total / massa faturada total em kg | Razão ponderada; R$/kg |
| `strategic.monthlyVolume` | Cubagem faturada total / competências | Média mensal em m³; card Volume |
| `strategic.ticket` | Faturamento total / unidades faturadas | Valor médio por item, conforme legacy; não por pedido |
| `strategic.monthlyTonnage` | Soma das massas mensais / meses / 1.000 | Média de toneladas por competência |
| `strategic.monthlyQuantity` | Unidades faturadas / competências | Média de unidades por mês |
| `strategic.monthlyOrders` | Soma de pedidos distintos por competência / competências | Média mensal, sem duplicar notas no mesmo mês |
| `strategic.monthlyGroups` | Soma de grupos distintos por competência / competências | Média mensal; totais dimensionais recalculados |
| `strategic.serviceDays` | Média de `NIVEL_DE_SERVICO_CLEAN` | Registros faturados selecionados; dias até faturamento |
| `strategic.otif` | Média de `ON_TIME_CLEAN` × 100 | Registros faturados selecionados; percentual de pontualidade de faturamento |
| `priority.valueFree` | Valor das parcelas sem carga | Carteira selecionada; R$; preço ausente torna a medida indisponível |
| `priority.freeOrders` | Pedidos distintos com saldo livre ≥ 0,000001 | Carteira selecionada; inclui parcialmente alocados |
| `priority.overdueOrders` | Previsão do pedido válida e anterior à referência | Carteira selecionada; hoje não é vencido |
| `priority.undatedOrders` | Pedido sem previsão válida de faturamento | Carteira selecionada; não é atraso comprovado |

O identificador `strategic.backlogReal` agora representa o backlog dos status logísticos, seguindo a seleção e as faixas de cor do legacy. Somente a cobertura e o valor logísticos ficam em `meta.backlog` deste painel; o backlog geral é apresentado no card de Pedidos em Aberto. A publicação e o denominador podem diferir do painel comercial; comparar resultados exige conferir referência, cobertura e filtros. `logistica.loads` exibe Cargas em aberto somente na Formação de Cargas; os antigos cards estratégicos de cargas, valor em carga, peso aberto e pedidos acima de 30 dias foram retirados.

OTIF mantém a convenção interna por faturamento e a média por registro do legacy. Prazo ausente recebe zero na transformação atual; a cobertura de previsão é exibida separadamente. A proposta de excluir prazos ausentes e medir conclusão integral por pedido requer nova versão e homologação; ainda não está implementada. O indicador atual não comprova entrega física nem In Full.

| Série | Agregação | Significado |
|---|---|---|
| Nível de serviço mensal | Média dos registros faturados no mês | Tempo até faturamento, não tempo até entrega |
| OTIF mensal | Média dos registros do mês × 100 | Mesma regra do card; não fazer média simples dos percentuais mensais |
| Toneladas faturadas | Soma do peso faturado / 1.000 | Mês, semana com início segunda-feira ou dia |
| R$/kg | Valor faturado / peso faturado | Valor dos produtos por massa; não é custo de frete |
| Entrega / retirada | Soma do valor faturado por modalidade | Distribuição financeira; não confirmação de entrega |

## Datas e cobertura

A janela padrão abrange até 12 meses e termina na menor data entre referência logística e último faturamento. UF, cidade, modalidade e emissão restringem ambas as bases. Data de faturamento restringe o histórico e não muda a carteira nem os 90 dias do backlog. Séries sem cobertura não recebem médias/percentuais zero. Publicações logística e comercial são identificadas separadamente na API.

Verificação independente: `scripts/verify-strategic.mjs`, `scripts/verify-logistica.py` e `scripts/verify-logistica-operacional.mjs`. Casos de regra, filtros e navegação: `tests/strategic.test.js`, `tests/logistics-filters.test.js` e `tests/logistics-selection.test.js`. Os testes de navegação e API documentados em [Visão Estratégica](visao-estrategica-logistica.md) complementam a validação; a aprovação técnica não substitui homologação gerencial.

## Indicadores ainda pendentes

Frete sobre faturamento, tempo até conclusão integral por pedido, duração por etapa, confirmação de saída/entrega, capacidade do veículo, assistência e recolhimento com conclusão própria, e evolução histórica do saldo ainda não têm entrega completa conciliada. São requisitos do plano, não resultados já demonstrados.
