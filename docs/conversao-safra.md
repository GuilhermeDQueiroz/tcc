# Conversão da safra de pedidos

Implementação de 06/10/2026 na Visão Estratégica, em `/estrategico`, abaixo das prioridades da carteira. A análise relaciona a demanda emitida com suas parcelas faturadas. Não mede entrega ao cliente.

## Duas perguntas diferentes

O card comercial anterior, chamado “Conversão (Safra)”, usava o faturamento como denominador. Foi renomeado para **Participação da safra: Pedidos / Valor**, mantendo os resultados para bases positivas e explicitando as fórmulas na ajuda. Bases vazias exibem indisponibilidade.

| Análise | Numerador | Denominador |
|---|---|---|
| Participação da safra: Pedidos | Pedidos distintos emitidos e com algum faturamento no mesmo mês | Todos os pedidos distintos com algum faturamento no mês |
| Participação da safra: Valor | Valor faturado no mês de pedidos emitidos nesse mês | Todo o valor faturado no mês |
| Conversão por safra: Valor | Valor faturado dos pedidos da safra até N dias após a emissão de cada pedido | Valor emitido de todos os pedidos da safra |
| Conversão por safra: Peso | Peso faturado no mesmo intervalo | Peso emitido da safra |
| Conversão por safra: Cubagem | Cubagem faturada no mesmo intervalo | Cubagem emitida da safra |
| Conversão por safra: Pedidos | Pedidos distintos da safra com algum faturamento até N dias após a emissão | Todos os pedidos distintos emitidos na safra |

Todos os percentuais multiplicam a divisão por 100. N assume 7, 15 e 30 dias corridos, incluindo o próprio dia de emissão e o limite final. Em pedidos, o primeiro faturamento parcial já caracteriza ocorrência; múltiplos itens ou faturas não duplicam a contagem. As demais medidas somam as parcelas efetivamente faturadas. Não há indicador de conclusão integral do pedido.

## Observação e filtros

- A base inclui pedidos sem faturamento. Não é construída somente com os pedidos já faturados.
- Cada janela fica completa quando a observação alcança o último dia do mês de emissão mais N dias. Antes disso, os percentuais são nulos e a interface mostra “Em acompanhamento”, com a data necessária. O mês corrente não é comparado como se já tivesse transcorrido todo o prazo.
- A observação termina na menor data entre a referência da carteira e a maior data de faturamento publicada. Sem faturamentos publicados, nenhuma janela é considerada observada. Isso é cobertura dos dados disponíveis, não prova da completude dos registros do ERP.
- O recorte padrão reúne os últimos 12 meses de emissão até a referência. O intervalo de emissão pode restringi-lo. UF, cidade e modalidade selecionam a população dos pedidos emitidos. Seus faturamentos são vinculados por código de pedido, com data de emissão consistente, mesmo quando ultrapassam o mês ou têm outra localização na nota.
- O filtro de faturamento dos gráficos estratégicos anteriores não recorta a conversão. A interface explica esse comportamento quando o filtro está ativo, preservando as janelas de observação.
- Alterar a granularidade de toneladas não muda a conversão por safra, que permanece mensal.

A seleção inicial usa a última safra disponível com as três janelas completas. Sem uma safra madura, seleciona o último mês disponível. Pode-se alternar mês e medida; gráfico, cartões e tabela apresentam os percentuais dessa escolha. A base emitida permanece visível em valor, peso, cubagem e pedidos.

## Qualidade e interpretação

Datas de emissão inválidas, pedidos sem identificador, datas de emissão conflitantes para o mesmo pedido e faturamentos com data inválida, anterior ou divergente da emissão são excluídos do cálculo e contabilizados em `cohorts.quality`. A interface apresenta as contagens quando existentes. Pedidos faturados que não pertencem ao conjunto emitido selecionado não entram na conversão.

Medidas com base nula ou não positiva não geram um percentual conhecido. Os campos tratados do DW já aplicam as convenções de nulos e precisão do projeto; a análise não recupera ausência cadastral que já foi convertida em zero pelo ETL. Os valores e quantidades são os da publicação examinada, não snapshots imutáveis do estado original de cada pedido na data de emissão.

Não se limita artificialmente o resultado a 100%. Faturamento acima da base emitida aparece com aviso de conciliação: alterações no pedido, preços, medidas e regras de origem precisam ser investigadas. Comparações entre meses requerem observar mudanças de composição de clientes, produtos e prazos; queda no percentual não comprova, isoladamente, problema de transporte.

## Implementação e reprodução

`api-server/domain/cohorts.js` calcula os agregados. `PostgresRepository.snapshot(..., 'strategic')` lê `dw.pedidos_emitidos` e `dw.pedidos_faturados` na mesma transação PostgreSQL somente leitura com isolamento repetível, associada à mesma versão comercial. O repositório estratégico conserva cache por publicação, referência e filtros. O payload entrega apenas agregados mensais em `cohorts`, sem expor linhas individuais de origem nem criar extração adicional no Firebird.

`src/components/analytics/CohortPanel.vue` apresenta cartões, evolução e tabela usando os componentes e formatos existentes. O seletor de medida não solicita uma nova extração nem uma nova consulta à API. O projeto conserva o tratamento de cancelamento de requisições e de indisponibilidade da fonte.

```powershell
npm test
npm run test:real
npm run build
npx playwright test tests/ui/cohorts.spec.ts
# Com a API ativa e as variáveis PostgreSQL configuradas:
node scripts/verify-cohorts.mjs
```

O verificador compara a API com uma consulta SQL independente na mesma publicação, incluindo o denominador emitido, as parcelas faturadas, pedidos distintos, percentuais e datas de maturidade. Os recortes incluem todo o histórico selecionado, uma UF e um intervalo de emissão com filtro de faturamento. O relatório fica em `.local/cohorts-real-verification.json`, fora do versionamento; não armazena credenciais.

## Contribuição para o TCC

A análise amplia a ligação entre demanda e atendimento disponível no painel. Permite examinar quanto da demanda emitida foi faturado após prazos comparáveis, em diferentes medidas, e relacionar esse resultado com lead time, backlog e idade da carteira. Gráfico, base e detalhamento por safra apoiam a interpretação nas reuniões de acompanhamento sem repetir a emissão de relatórios por métrica.

Esses recursos são entregas analíticas verificáveis. Não comprovam, por si, redução do tempo de entrega, dos custos de transporte ou aumento de produtividade. A discussão acadêmica deve distinguir a existência e consistência da análise dos efeitos operacionais a serem observados após seu uso.
