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

## Visão Estratégica

| Identificador da API | Medida e fórmula | População / unidade |
|---|---|---|
| `strategic.loads` | Cargas distintas com alocação aberta no recorte | Carteira selecionada; cargas |
| `strategic.valueLoad` | Valor das parcelas abertas em carga | Carteira selecionada; R$ |
| `strategic.weightKg` | Peso de todo o saldo aberto | Carteira selecionada; kg, exibido em t |
| `strategic.backlogReal` | Valor aberto / média diária de receita dos 90 dias corridos terminados na referência | Mesmos filtros compartilhados; dias equivalentes; base não positiva/ausente indisponível |
| `strategic.orders30` | Pedidos distintos com emissão anterior à referência − 30 dias | Carteira selecionada; comparação estrita `> 30` |
| `strategic.serviceDays` | Média de `NIVEL_DE_SERVICO_CLEAN` | Registros faturados selecionados; dias até faturamento |
| `strategic.otif` | Média de `ON_TIME_CLEAN` × 100 | Registros faturados selecionados; percentual de pontualidade de faturamento |
| `priority.valueFree` | Valor das parcelas sem carga | Carteira selecionada; R$; preço ausente torna a medida indisponível |
| `priority.freeOrders` | Pedidos distintos com saldo livre ≥ 0,000001 | Carteira selecionada; inclui parcialmente alocados |
| `priority.overdueOrders` | Previsão do pedido válida e anterior à referência | Carteira selecionada; hoje não é vencido |
| `priority.undatedOrders` | Pedido sem previsão válida de faturamento | Carteira selecionada; não é atraso comprovado |

O identificador histórico `strategic.backlogReal` não define o mesmo indicador chamado Backlog real em Pedidos em Aberto: na Visão Estratégica entra toda a carteira logística selecionada, enquanto o painel comercial aplica situações do legacy. Não comparar os dois como equivalentes.

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
