# Visão Estratégica de Logística

A tela `/estrategico`, acessível pelo menu **Visão Estratégica**, reúne a carteira aberta e o desempenho dos faturamentos. Ela complementa a formação de cargas com uma leitura gerencial das pendências, do volume processado e do tempo de atendimento.

## Indicadores e população

| Indicador | Definição | Base |
| --- | --- | --- |
| Cargas em aberto | Cargas distintas com quantidade aberta vinculada aos pedidos selecionados | Publicação logística atual |
| Valor em carga | Quantidade aberta alocada × valor unitário | Publicação logística atual |
| Peso em aberto | Quantidade aberta × peso bruto unitário, incluindo saldo em carga e sem carga | Publicação logística atual; apresentação em toneladas |
| Backlog | Valor total aberto ÷ faturamento médio diário dos 90 dias corridos terminados na referência da carteira | Carteira logística e faturamentos publicados |
| Pedidos > 30 dias | Pedidos distintos com emissão anterior à referência menos 30 dias | Publicação logística atual |
| Nível de serviço | Média do lead time entre emissão do pedido e faturamento, calculada sobre os registros faturados | Histórico selecionado |
| OTIF | Média de `ON_TIME_CLEAN` × 100 | Histórico selecionado; regra existente de faturamento |
| Conversão no mês | Pedidos emitidos com algum faturamento no próprio mês ÷ todos os pedidos emitidos das safras observadas × 100 | Emitidos e faturados da mesma publicação; meses encerrados |
| Escoamento | Média mensal do faturamento em R$ ÷ média mensal da entrada de pedidos em R$ × 100 | Mesmo intervalo para os dois fluxos; inclui faturamentos de safras anteriores |

O backlog desta tela considera **toda a carteira logística selecionada**. Ele difere do “Backlog real” de Pedidos em Aberto, que aplica o recorte de status do cálculo original. Os dois valores não devem ser apresentados no TCC como indicadores idênticos. O denominador usa a mesma localização, tipo de entrega e emissão da seleção; o filtro visual de faturamento não altera os 90 dias de cálculo. Faturamento médio nulo ou negativo torna esse indicador indisponível.

Pedidos com mais de 30 dias representam tempo em aberto, não necessariamente atraso perante uma promessa. Alocação em carga também não comprova faturamento, expedição ou entrega.

O nome **OTIF** foi mantido conforme a definição adotada no projeto. Neste recorte, o cálculo verifica faturamento até a previsão de faturamento e não atesta entrega ao cliente nem atendimento integral. A transformação existente atribui zero quando não existe previsão; essa regra foi preservada. A cobertura de previsão é fornecida em `meta.history.forecastCoverage` e na ajuda do card. A rotina de registro de entrega ao cliente não participa deste cálculo, portanto sua utilização não deve ser descrita como realizada por esta implementação.

Nível de serviço e OTIF são calculados sobre os registros selecionados, sem tirar a média das médias mensais. Na conversão no mês, a unidade é o pedido distinto: vários itens e notas não duplicam sua contagem, e o primeiro faturamento parcial já caracteriza ocorrência em **Algum faturamento**. A média do período é ponderada pelo número de pedidos de cada safra, incluindo os que não foram faturados. Esse card difere da participação da safra no faturamento e da conversão em até 30 dias.

O mesmo card exibe **Integral no mês**: pedidos com todas as quantidades de cada produto e cor faturadas até o último dia do mês de entrada, divididos pela mesma base emitida. Parcelas de notas são somadas por pedido, produto e cor; faturamento excedente de uma combinação não compensa faltas em outra. A tolerância numérica é de 0,000001 unidade. Ausência de identificação de produto ou quantidades válidas torna a taxa integral indisponível e é informada na ajuda. Cancelamento não é faturamento, e integralidade de faturamento não comprova entrega física. As contagens e a qualidade dessa apuração ficam em `meta.flow.fullyConvertedOrders`, `fullConversionUnknownOrders` e `fullSameMonthConversion`.

Os dois novos cards usam o intervalo comum entre o histórico exibido e o filtro de emissão, quando presente. Conversão no mês considera apenas competências inteiras dentro do recorte, cujo último dia já foi observado: meses iniciais ou finais selecionados parcialmente não entram no percentual. Faturamentos são vinculados pelo pedido e pela data de emissão; os filtros de localização e entrega selecionam a população emitida, sem descartar suas notas emitidas para outro destino. Datas inválidas e pedidos com datas de emissão conflitantes ficam fora da base.

No escoamento, cada fluxo usa os filtros de localização e entrega do próprio evento e a mesma janela de calendário. O filtro de emissão delimita a janela comum; os faturamentos de safras anteriores continuam incluídos. São exibidas as médias mensais de faturamento e entrada. Meses sem movimento participam do denominador temporal; recortes parciais são identificados e divididos pelo número de competências incluídas, sem projeção de fechamento. A razão equivale a faturamento total ÷ entrada total no intervalo, sem calcular a média aritmética dos percentuais mensais. Bases não positivas ficam indisponíveis e resultados acima de 100% permanecem visíveis. Esse resultado não confirma entrega ou, isoladamente, redução do saldo da carteira, que também depende de cancelamentos, devoluções e ajustes.

Os nove indicadores ficam na faixa principal. As bases dos novos cards e o período efetivamente utilizado são fornecidos em `meta.flow`.

## Prioridades da carteira e acesso aos pedidos

A visão geral apresenta quatro prioridades operacionais abaixo dos gráficos, sempre calculadas sobre a carteira da referência publicada:

| Prioridade | Regra | Detalhamento |
| --- | --- | --- |
| Valor sem carga | Quantidade ainda não alocada × valor unitário; preços ausentes tornam a medida indisponível | Pedidos com saldo sem carga |
| Pedidos com saldo sem carga | Pedidos distintos com saldo livre maior ou igual a 0,000001 unidade | Inclui os parcialmente alocados |
| Previsão vencida | Pedidos distintos com previsão de faturamento anterior à referência | Previsões para a própria referência não são vencidas |
| Pedidos sem previsão | Pedidos distintos sem previsão de faturamento válida | Não representa atraso comprovado |

Os botões **Analisar pedidos** abrem Formação de Cargas com o recorte da prioridade. UF, cidade, modalidade de entrega e intervalo de emissão são preservados. O período de faturamento não é transferido: ele restringe eventos históricos, não a carteira atual. Filtros antigos da formação de cargas são substituídos pelo recorte solicitado para que não ocultem pedidos da prioridade. Pedidos com vários itens são contados uma vez.

As definições de OTIF, Nível de Serviço (Lead Time) e R$/kg e a cobertura de previsão ficam visíveis no rodapé. A cobertura mede a presença de previsão nos registros faturados, não o percentual de entrega física. As ajudas individuais mantêm os detalhes das fórmulas.

## Gráficos, período e filtros

- Nível de serviço por mês, em dias.
- R$/kg faturado: valor faturado dividido pelo peso faturado. Representa valor dos produtos por massa, não custo do frete.
- Toneladas faturadas por mês, semana ou dia. Semanas começam na segunda-feira; a alteração do agrupamento mantém a população e o total.
- Evolução mensal do OTIF.
- Distribuição do valor faturado por entrega e retirada, preservando categorias adicionais ou não informadas.

A janela máxima é de 12 meses, terminando na menor data entre a referência da carteira e o último faturamento publicado. O período informado nos filtros pode reduzir essa janela ou consultar outra janela histórica. O cabeçalho mostra as datas efetivas e identifica mês parcial. Intervalos totalmente posteriores à cobertura são recusados.

Localização (UF e cidade), entrega/retirada e emissão restringem carteira e histórico. Período de faturamento restringe os gráficos e os cards de desempenho; a carteira mantém o saldo de sua publicação. A tela não reconstrói saldos de uma data passada. Os rótulos logísticos `Entrega`/`Retirada` e os rótulos do DW `ENTREGA`/`RETIRA` são conciliados explicitamente no módulo estratégico.

Meses sem registros têm médias e razões indisponíveis. Para toneladas, períodos anteriores à primeira data disponível ficam sem valor; períodos sem faturamento entre as datas disponíveis recebem zero. Essa cobertura expressa a disponibilidade dos registros publicados, não uma garantia de completude do ERP. Quando faltam medidas necessárias da carteira, o card e sua ajuda não apresentam zero como valor conhecido.

## Implementação e rastreabilidade

O fluxo usa as publicações existentes de `logistica.item_pedido`, `logistica.alocacao`, `dw.pedidos_emitidos` e `dw.pedidos_faturados`. Não cria extração adicional no Firebird nem altera o ETL. `api-server/domain/strategic.js` concentra os indicadores gerais e `api-server/domain/cohorts.js` calcula a conversão por safra. Emitidos e faturados são lidos em uma única transação somente leitura com isolamento repetível, sob a mesma versão comercial. `api-server/repositories/strategic.js` combina os snapshots imutáveis e mantém cache por ambas as versões, filtros e granularidade. A API é `GET /api/v1/logistica/estrategico`.

O payload entrega agregados, prioridades em `operationalMetrics`, conversão mensal em `cohorts`, opções e referências das duas publicações, sem repetir tabelas detalhadas de pedidos e cargas. A interface utiliza Pinia, carregamento de gráficos sob demanda e os componentes existentes. Requisições anteriores são canceladas e descartadas; falha na fonte remove os resultados anteriores para evitar associá-los a filtros novos.

## Conversão por safra

A seção adicional acompanha a demanda emitida em cada mês e suas parcelas faturadas em até 7, 15 e 30 dias corridos. Valor, peso, cubagem e pedidos podem ser alternados sem emitir relatórios separados. A última safra com todas as janelas completas é selecionada inicialmente; meses mais recentes ficam disponíveis para acompanhamento. O gráfico e a tabela comparam as mesmas janelas entre meses. Veja as [fórmulas, filtros e limites da análise](conversao-safra.md).

As versões e os horários ficam em `meta.publications`; o período e a cobertura, em `meta.history`; a base de 90 dias, em `meta.backlog`. Essas informações permitem rastrear o recorte usado nos resultados do TCC.

## Verificação

`npm test` verifica cálculos, ponderação por registros, agrupamento temporal, filtros compartilhados, datas inválidas, medidas ausentes, indisponibilidade de fonte e transferência dos recortes operacionais. `npm run build` verifica tipos e gera a interface de produção. Os testes de navegador `strategic.spec.ts`, `strategic-errors.spec.ts` e `strategic-priorities.spec.ts` cobrem navegação, gráficos, filtros, adaptação móvel, falhas de recarga e abertura dos pedidos reais de uma prioridade.

`node scripts/verify-strategic.mjs`, com as variáveis de conexão PostgreSQL do projeto já configuradas, executa consultas somente leitura independentes dos cálculos da API. Confere os nove cards, as médias e bases de fluxo, as quatro prioridades e cada competência dos quatro gráficos mensais e grava um relatório local em `.local/strategic-real-verification.json`, sem gravar credenciais.

A implementação amplia a parte prática. A avaliação dos resultados, a discussão das limitações e a correspondência com a metodologia escrita devem incorporar estas definições para que o documento descreva o que foi efetivamente realizado.

### Evidências da entrega de 03/10/2026

- `npm test`: 113 testes aprovados, incluindo contagem de pedidos distintos, ausência de medidas e igualdade do limite mínimo de saldo entre card e detalhamento.
- `npm run build`: compilação TypeScript/Vue e produção aprovadas. Permanece o aviso de tamanho do módulo de gráficos ECharts, sem impedir a compilação.
- `npx playwright test tests/ui/strategic.spec.ts tests/ui/strategic-errors.spec.ts tests/ui/strategic-priorities.spec.ts`: cinco testes aprovados com a API real; filtros, navegação aos pedidos, celular, falha de recarga e preço ausente conferidos.
- SQL independente: sete cards principais, quatro prioridades e 12 competências mensais aprovados sobre 199.490 registros faturados do histórico selecionado. Relatório em `.local/strategic-real-verification.json`.

A carteira desta conferência tem referência em 30/09/2026, publicação logística `061684fb-7343-43dc-b01a-f338b3e66d9c` e publicação de faturamentos `2647add2-e8fe-4c70-a6b5-96d2b0d67d6d`. Sem filtros: 58 cargas com saldo, 904 pedidos com saldo livre, 232 pedidos com previsão vencida e 863 sem previsão. Esses valores identificam a publicação verificada; não são constantes da aplicação.

As capturas locais `.local/strategic-final-desktop.png`, `.local/strategic-final-priorities.png` e `.local/strategic-priorities-mobile.png` documentam a composição renderizada. Esta verificação técnica não substitui a avaliação gerencial prevista na metodologia do TCC.
