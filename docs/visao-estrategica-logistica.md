# Visão estratégica

A tela `/estrategico`, acessível pelo menu **Logística → Visão estratégica**, reúne a carteira aberta e o desempenho dos faturamentos. Ela complementa a formação de cargas com uma leitura gerencial das pendências, do volume processado e do tempo de atendimento.

## Indicadores e população

| Indicador | Definição | Base |
| --- | --- | --- |
| Backlog logístico | Valor pendente nos status logísticos ÷ faturamento médio diário dos 90 dias corridos terminados na referência | Carteira logística e faturamentos publicados |
| Carteira logística | Valor aberto dos mesmos status logísticos, sem dividir pela média diária | Publicação logística atual; R$ |
| Nível de serviço | Média do lead time entre emissão do pedido e faturamento, calculada sobre os registros faturados | Histórico selecionado |
| OTIF | Média de `ON_TIME_CLEAN` × 100 | Histórico selecionado; regra existente de faturamento |
| Conversão | Pedidos emitidos com algum faturamento no próprio mês ÷ todos os pedidos emitidos das safras observadas × 100 | Emitidos e faturados da mesma publicação; meses encerrados |
| Escoamento | Média mensal do faturamento em R$ ÷ média mensal da entrada de pedidos em R$ × 100 | Mesmo intervalo para os dois fluxos; inclui faturamentos de safras anteriores |
| R$/TON | Valor faturado total ÷ massa faturada total em toneladas | Razão ponderada pela massa; não é média simples das razões mensais |
| Volume | Volume faturado em m³ ÷ número de competências | Média mensal dos totais, incluindo meses sem movimento |
| Ticket médio | Faturamento total ÷ quantidade de itens faturados | Valor por unidade, conforme escolha do autor e cálculo do legacy |
| Peso | Soma das toneladas de cada competência ÷ número de competências | Meses sem movimento incluídos |
| Qtd itens | Soma das unidades faturadas por competência ÷ número de competências | Quantidade, não linhas ou produtos distintos |
| Qtd pedidos | Soma dos pedidos distintos de cada mês ÷ número de competências | Um pedido faturado em meses diferentes participa de cada mês |
| Grupos atendidos | Soma dos grupos de cliente distintos de cada mês ÷ número de competências | Um grupo em meses diferentes participa de cada mês |


O card **Backlog logístico** apresenta somente os dias equivalentes de faturamento da carteira nos status que contêm Documento em Carga, Logística, Faturado Parcial ou Documento Liberado, normalizando acentos e caixa. A situação aparece no card de backlog; o valor exato fica no card independente Carteira logística. O cálculo da carteira geral foi retirado deste painel; Pedidos em Aberto apresenta somente o card Backlog, calculado sobre a carteira geral e sem a linha suplementar de valor. Valores em pedidos com várias cargas são contados uma vez, sem somar novamente as alocações. Um preço ausente no recorte logístico torna sua cobertura indisponível; preço ausente fora desses status não invalida o valor logístico conhecido.

O denominador usa os mesmos filtros de localização, tipo de entrega e emissão da seleção; o filtro visual de faturamento não altera os 90 dias corridos terminados na referência publicada. Média diária nula ou negativa torna as coberturas indisponíveis. A data de referência continua identificando a posição da carteira, sem reconstrução automática de saldos históricos.

As cores seguem as faixas do legacy sobre o valor logístico **sem arredondar antes da classificação**:

| Dias logísticos | Situação | Cor |
| --- | --- | --- |
| Menos de 15 | Crítico (baixo demais) | Vermelho `#DC2626` |
| De 15 a menos de 25 | Atenção (baixo) | Amarelo `#C69214` |
| De 25 a menos de 35 | Ideal | Verde `#006A3A` |
| De 35 a menos de 45 | Atenção (alto) | Amarelo `#C69214` |
| 45 ou mais | Crítico (alto demais) | Vermelho `#DC2626` |
| Base indisponível | Indisponível | Neutro |

Essas faixas são convenções de acompanhamento do projeto, não SLA ou comprovação de estoque pronto, expedição ou entrega física. Não pressupõem homologação de uma meta gerencial. A regra de status acompanha o legacy; os valores podem diferir do painel comercial pela publicação, cobertura e filtros usados no denominador.

**Cargas em aberto** fica em Formação de Cargas (`logistica.loads`), com a mesma contagem distinta de cargas com saldo, anteriormente rotulada “Cargas com saldo”. A Visão Geral removeu os cards Valor em carga, Peso em aberto e Pedidos > 30 dias; as medidas operacionais pertinentes continuam disponíveis na Formação de Cargas.

O nome **OTIF** foi mantido conforme a definição adotada no projeto. Neste recorte, o cálculo verifica faturamento até a previsão de faturamento e não atesta entrega ao cliente nem atendimento integral. A transformação existente atribui zero quando não existe previsão; essa regra foi preservada. A cobertura de previsão é fornecida em `meta.history.forecastCoverage` e na ajuda do card. A rotina de registro de entrega ao cliente não participa deste cálculo, portanto sua utilização não deve ser descrita como realizada por esta implementação.

Nível de serviço e OTIF são calculados sobre os registros selecionados, sem tirar a média das médias mensais. Na conversão no mês, a unidade é o pedido distinto: vários itens e notas não duplicam sua contagem, e o primeiro faturamento parcial já caracteriza ocorrência no percentual principal. A média do período é ponderada pelo número de pedidos de cada safra, incluindo os que não foram faturados. Esse card difere da participação da safra no faturamento e da conversão em até 30 dias.

O card **Conversão** exibe somente o percentual principal. O detalhamento de faturamento integral saiu do card; sua apuração permanece disponível em `meta.flow.fullyConvertedOrders`, `fullConversionUnknownOrders` e `fullSameMonthConversion`. As quantidades são conciliadas por pedido, produto e cor, com tolerância de 0,000001 unidade; parcelas são somadas, excedentes não compensam faltas de outra combinação e ausência de dados torna a taxa integral indisponível.

Os dois novos cards usam o intervalo comum entre o histórico exibido e o filtro de emissão, quando presente. Conversão no mês considera apenas competências inteiras dentro do recorte, cujo último dia já foi observado: meses iniciais ou finais selecionados parcialmente não entram no percentual. Faturamentos são vinculados pelo pedido e pela data de emissão; os filtros de localização e entrega selecionam a população emitida, sem descartar suas notas emitidas para outro destino. Datas inválidas e pedidos com datas de emissão conflitantes ficam fora da base.

No escoamento, cada fluxo usa os filtros de localização e entrega do próprio evento e a mesma janela de calendário. O filtro de emissão delimita a janela comum; os faturamentos de safras anteriores continuam incluídos. As médias mensais de faturamento e entrada ficam em `meta.flow`; o card Escoamento exibe somente o percentual. Meses sem movimento participam do denominador temporal; recortes parciais são identificados e divididos pelo número de competências incluídas, sem projeção de fechamento. A razão equivale a faturamento total ÷ entrada total no intervalo, sem calcular a média aritmética dos percentuais mensais. Bases não positivas ficam indisponíveis e resultados acima de 100% permanecem visíveis. Esse resultado não confirma entrega ou, isoladamente, redução do saldo da carteira, que também depende de cancelamentos, devoluções e ajustes.

Os 13 indicadores ficam na faixa principal, com o estilo dos cards de Pedidos em Aberto: tipografia, preenchimento, bordas, ícones e espaçamento compartilhados. As bases dos novos cards e o período efetivamente utilizado são fornecidos em `meta.flow`.

## Consulta da carteira

Em 09/11/2026, a seção “Prioridades da carteira” foi removida da Visão Geral por solicitação do autor, incluindo os quatro cards e os botões de consulta e análise. Os pedidos e as cargas continuam acessíveis pelo menu Logística → Formação de Cargas. O contrato da API mantém `operationalMetrics` para compatibilidade; esses agregados não são renderizados na Visão Geral.

O rodapé com definições de OTIF, Nível de Serviço, R$/kg e cobertura de previsão foi removido em 09/11/2026 por solicitação do autor. As ajudas individuais dos cards mantêm as definições; fórmulas e limites continuam documentados neste guia.

## Gráficos, período e filtros

- **ESCOAMENTO POR MÊS:** faturamento em R$ ÷ entrada válida em R$ de cada competência × 100, incluindo notas de pedidos mais antigos. Sem entrada positiva, o percentual fica indisponível; valores acima de 100% são preservados. Cada ponto usa a mesma interseção de calendário do card; a média do card permanece razão dos totais, não média simples dos percentuais.
- **QTD. ITENS POR MÊS:** unidades faturadas de cada competência, em linha amarela.
- **QTD. PEDIDOS POR MÊS:** pedidos distintos em cada competência, em barras verdes.
- **GRUPOS ATENDIDOS POR MÊS:** grupos de cliente distintos por competência, em barras verde-claras.
- **NÍVEL DE SERVIÇO POR MÊS**, em dias.
- **R$/TON POR MÊS:** valor faturado dividido pelo peso faturado em toneladas. Representa valor dos produtos por massa, não custo do frete.
- **PESO POR MÊS / SEMANA / DIA**, escolhido em Configurações → Tipo de análise do próprio gráfico. A medida continua em toneladas. Semanas começam na segunda-feira; a alteração do agrupamento mantém a população e o total.
- **OTIF POR MÊS**.
- Distribuição do valor faturado por entrega e retirada, preservando categorias adicionais ou não informadas.

O período inicial vai de 01/01 do ano anterior até a data atual em America/Sao_Paulo. O filtro vem preenchido e aceita outro intervalo, sem limite implícito de 12 meses e sem reduzir suas datas aos limites observados na publicação. Intervalos sem registros retornam agregados vazios e razões indisponíveis; a seleção não é substituída por outro período. As faixas de datas da carteira, do histórico e dos comparativos foram removidas da área principal. A referência publicada continua em metadados e na ajuda.

Localização (UF e cidade), entrega/retirada e emissão restringem carteira e histórico. Período de faturamento restringe os gráficos e os cards de desempenho; a carteira mantém o saldo de sua publicação. A tela não reconstrói saldos de uma data passada. Os rótulos logísticos `Entrega`/`Retirada` e os rótulos do DW `ENTREGA`/`RETIRA` são conciliados explicitamente no módulo estratégico.

Meses sem registros têm médias e razões indisponíveis. Para toneladas, períodos anteriores à primeira data disponível ficam sem valor; períodos sem faturamento entre as datas disponíveis recebem zero. Essa cobertura expressa a disponibilidade dos registros publicados, não uma garantia de completude do ERP. Quando faltam medidas necessárias da carteira, o card e sua ajuda não apresentam zero como valor conhecido.

## Análise por dimensão

A seção **ANÁLISE POR DIMENSÃO** usa os faturamentos selecionados e as dimensões disponíveis na publicação: UF, região, modalidade de entrega, supervisor, consultor, grupo de cliente, cliente, produto, grupo do item, subgrupo, linha, tipo, coleção, classificação, origem, órgão, cidade e microregião. Cliente e produto preservam a identificação junto da descrição; valores não informados permanecem em um grupo próprio.

A tabela contém faturamento, toneladas, R$/ton, médias mensais de itens, pedidos e grupos, nível de serviço e OTIF. Os totais são recalculados sobre toda a seleção. Pedidos e grupos podem estar em mais de uma linha de dimensão; somar suas médias por linha não produz necessariamente a média global. R$/ton e médias de prazo também não são somados. As configurações oferecem seleção de medida, tabela, barras, pizza/donut, treemap, seleção de colunas e CSV. A tabela dimensional usa rolagem contínua e preserva o total e a exportação da seleção completa.

Carteira e backlog são saldos na referência publicada; conversão e escoamento relacionam populações de emissão e faturamento. Carteira e backlog são apresentados nos cards principais. Conversão e escoamento podem ser consultados na análise dimensional por UF, cidade e modalidade de entrega; os outros recortes não publicam essas duas taxas. `dimension` é validada na API e participa da chave de cache junto das publicações, filtros e granularidade.

Os novos cards mensais usam o número de competências do histórico, incluindo meses sem movimento, conforme escolha do autor. Recortes parciais participam sem projeção. Cadastro ou quantidade ausente torna a medida dependente indisponível; os dados não são preenchidos artificialmente.

## Comparações anuais, tabela e mapa de faturamento

As três análises do print foram incorporadas: **EVOLUÇÃO MENSAL DO FATURAMENTO POR ANO**, **EVOLUÇÃO ACUMULADA DO FATURAMENTO POR ANO** e **COMPARATIVO ACUMULADO DE REAIS POR TONELADA (R$/T) · FATURAMENTO POR ANO**. Usam o ano mais recente no filtro e o mesmo intervalo do ano anterior. Quando o filtro atravessa dois anos, os comparativos anuais começam em janeiro do ano final; as demais análises continuam sobre todo o filtro. O início comparável respeita o corte de extração de 01/01/2025, mesmo que a primeira nota seja posterior. Os intervalos de comparação permanecem nos metadados; a área principal não exibe faixas de datas da fonte. Não é inserido faturamento zero antes da cobertura conhecida nem além da referência. Cobertura por limites de datas não comprova completude dos registros do ERP.

Os acumulados começam juntos no início do intervalo comparável; não pressupõem janeiro completo quando o filtro começa depois. R$/ton acumulado é valor acumulado ÷ toneladas acumuladas, não soma ou média simples das razões mensais. As variações acumuladas usam as bases equivalentes exibidas e ficam indisponíveis sem denominador positivo.

**TICKET MÉDIO POR MÊS** usa faturamento de cada competência ÷ quantidade faturada, conforme definição escolhida pelo autor. O card resume o período por valor total ÷ unidades totais. O nome foi mantido como no legacy; a ajuda explicita que é valor por item, não por pedido. O card **Volume** mantém a média mensal, embora o termo “média” tenha sido retirado dos títulos por solicitação do autor. As fórmulas continuam nas ajudas.

**TABELA DE EVOLUÇÃO MENSAL** é a primeira aba da ANÁLISE POR DIMENSÃO. Contém valor, participação, superávit/déficit frente ao mesmo recorte um ano antes, ticket, R$/ton, pedidos, itens, toneladas, volume, grupos, tempo até faturamento, OTIF, conversão e escoamento. A conversão mensal exige competência de emissão completa; meses parciais ou sem pedidos elegíveis ficam indisponíveis. O escoamento usa a interseção de calendário com os filtros de emissão, quando aplicados. Os totais de contagens e razões são recalculados para o período, sem somar grupos ou pedidos que reaparecem em meses diferentes. Diferenças mensais são apresentadas com cobertura da competência anterior. A fonte comercial inicia a extração em 01/01/2025; a ausência de notas de 01 a 05/01/2025 não torna janeiro descoberto. O total da diferença e a variação nas dimensões comparam apenas o intervalo equivalente do ano final do filtro com o ano anterior; as demais medidas continuam cobrindo todo o período selecionado.

**MAPA DE FATURAMENTO** apresenta o Brasil por UF, com a soma do faturamento no período filtrado e escala verde. Usa a mesma seleção dos indicadores de desempenho e independe da aba escolhida na análise por dimensão. Estados sem registros ficam neutros; valores com UF ausente ou inválida permanecem no contrato da API sem atribuição artificial a um estado; o aviso textual foi retirado do painel. O mapa de calor e seus controles foram removidos da tela. O contrato antigo da API permanece para compatibilidade.

Os cards não exibem mais “por mês”: Peso, Qtd itens, Qtd pedidos e Grupos atendidos mantêm suas médias mensais e fórmulas nas ajudas. R$/TON mantém a razão dos totais. As evoluções existentes seguem os cards: Peso, itens, pedidos, grupos, nível de serviço, ticket, R$/TON, OTIF, conversão por safra e escoamento. Conversão e escoamento ficam lado a lado. A conversão por safra conserva as janelas de 7/15/30 dias, distintas do percentual de conversão mensal do card. Os três comparativos anuais permanecem no início da área de gráficos; entrega/retirada permanece após as evoluções. Carteira e backlog continuam como saldos na posição publicada, sem gerar séries históricas artificiais.

A dimensão analítica e a dimensão/métrica do mapa são validadas na API e fazem parte da chave de cache. Estado do Pedido, Família e Cor completam as dimensões do print. As medidas de faturamento, peso, volume, itens, pedidos, grupos, ticket, R$/kg, R$/ton e diferença anual podem ser consultadas na análise acumulada; comparações e totais não alteram os fatos publicados.

## Apresentação das tabelas

A tabela mensal mantém a apresentação compacta com paginação no topo, cabeçalhos ordenáveis, barras de participação, variações anuais sinalizadas por cor e seta e total destacado em verde. Mês é ordenado pela competência cronológica.

A **ANÁLISE POR DIMENSÃO** compartilha as regras de apresentação da tabela de Pedidos em Aberto: abas, espaçamento, tipografia, primeira coluna fixa, linhas alternadas, total verde e viewport de rolagem contínua, sem paginação. Inicia com 13 colunas de faturamento, acrescidas de conversão e escoamento nos três recortes compatíveis: dimensão, faturamento, diferença anual, participação, nível de serviço, ticket, R$/TON, pedidos, itens, peso, volume, grupos e OTIF. Médias mensais e R$/ton permanecem disponíveis nas configurações, junto das visualizações e exportação CSV. A seleção de colunas não altera os totais de todo o recorte nem a exportação completa das linhas nas colunas selecionadas.

Trocar a dimensão consulta `GET /api/v1/logistica/estrategico?section=analysis&dimension=...&filters=...` e atualiza somente `analysis`. Cards, gráficos e mapa mantêm seus dados e instâncias. O carregamento e os erros ficam dentro da área dimensional, com tentativa local. Uma nova troca, atualização de filtro ou saída da página cancela a resposta anterior; somente a resposta atual pode ser aplicada. Uma versão de publicação diferente é recusada localmente e solicita atualizar o painel antes de combinar dados.

A consulta parcial usa a mesma seleção de faturamentos e a mesma regra do período anterior da consulta completa. Recalcula os agregados dimensionais e, nos recortes compatíveis, as duas taxas de fluxo, sem reconstruir carteira ou séries financeiras. Resultados completos e parciais compartilham o cache limitado a oito entradas, com chaves que incluem as versões publicadas, filtros, dimensão e seção. O modo demonstrativo suporta o mesmo contrato parcial.

O gráfico de conversão se chama **CONVERSÃO POR MÊS · VALOR**, com o sufixo acompanhando a medida escolhida nas configurações. Suas janelas de 7/15/30 dias foram preservadas. Os cards **Conversão** e **Escoamento** mantêm suas fórmulas.

## Implementação e rastreabilidade

O fluxo usa as publicações existentes de `logistica.item_pedido`, `logistica.alocacao`, `dw.pedidos_emitidos` e `dw.pedidos_faturados`. Não cria extração adicional no Firebird nem altera o ETL. `api-server/domain/strategic.js` concentra os indicadores gerais e `api-server/domain/cohorts.js` calcula a conversão por safra. Emitidos e faturados são lidos em uma única transação somente leitura com isolamento repetível, sob a mesma versão comercial. `api-server/repositories/strategic.js` combina os snapshots imutáveis e mantém cache por ambas as versões, filtros e granularidade. A API é `GET /api/v1/logistica/estrategico`.

O payload entrega agregados, prioridades em `operationalMetrics`, conversão mensal em `cohorts`, opções e referências das duas publicações, sem repetir tabelas detalhadas de pedidos e cargas. A interface utiliza Pinia, carregamento de gráficos sob demanda e os componentes existentes. Requisições anteriores são canceladas e descartadas; falha na fonte remove os resultados anteriores para evitar associá-los a filtros novos.

## Conversão por safra

Em 09/11/2026, o autor pediu manter somente o gráfico de linha da conversão por mês de emissão, com as séries de 7, 15 e 30 dias e alternância entre Valor, Peso, Cubagem e Pedidos em Configurações → Tipo de análise. Foram removidos o cabeçalho de seleção de safra, bases emitidas, cards, tabela comparativa e textos explicativos do painel. O atalho de Faturados também foi retirado. O gráfico usa os mesmos cálculos publicados de `cohorts`, inclusive percentuais indisponíveis para janelas ainda imaturas. As [fórmulas e os limites](conversao-safra.md) permanecem documentados; Conversão no mês é uma análise distinta nos cards principais.

As versões e os horários ficam em `meta.publications`; o período e a cobertura, em `meta.history`; a base de 90 dias, em `meta.backlog`. Essas informações permitem rastrear o recorte usado nos resultados do TCC.

## Verificação

`npm test` verifica cálculos, ponderação por registros, agrupamento temporal, filtros compartilhados, datas inválidas, medidas ausentes, indisponibilidade de fonte e transferência dos recortes operacionais. `npm run build` verifica tipos e gera a interface de produção. Os testes de navegador `strategic.spec.ts`, `strategic-errors.spec.ts`, `logistics-backlog.spec.ts` e `strategic-evolution.spec.ts` cobrem gráficos, filtros, adaptação móvel, falhas de recarga, backlog e Formação de Cargas. Os testes antigos dos atalhos de prioridades foram retirados junto da seção.

`node scripts/verify-strategic.mjs`, com as variáveis de conexão PostgreSQL do projeto já configuradas, executa consultas somente leitura independentes dos cálculos da API. Confere os 13 cards, as médias e bases de fluxo, os quatro agregados operacionais mantidos no contrato, o mapa de faturamento por UF, as evoluções mensais, o escoamento por competência e as medidas dimensionais por UF e grava um relatório local em `.local/strategic-real-verification.json`, sem gravar credenciais.

A implementação amplia a parte prática. A avaliação dos resultados, a discussão das limitações e a correspondência com a metodologia escrita devem incorporar estas definições para que o documento descreva o que foi efetivamente realizado.

### Evidências da entrega de 03/10/2026

- `npm test`: 113 testes aprovados, incluindo contagem de pedidos distintos, ausência de medidas e igualdade do limite mínimo de saldo entre card e detalhamento.
- `npm run build`: compilação TypeScript/Vue e produção aprovadas. Permanece o aviso de tamanho do módulo de gráficos ECharts, sem impedir a compilação.
- `npx playwright test tests/ui/strategic.spec.ts tests/ui/strategic-errors.spec.ts tests/ui/strategic-priorities.spec.ts`: cinco testes aprovados com a API real; filtros, navegação aos pedidos, celular, falha de recarga e preço ausente conferidos.
- SQL independente: sete cards principais, quatro prioridades e 12 competências mensais aprovados sobre 199.490 registros faturados do histórico selecionado. Relatório em `.local/strategic-real-verification.json`.

A carteira desta conferência tem referência em 30/09/2026, publicação logística `061684fb-7343-43dc-b01a-f338b3e66d9c` e publicação de faturamentos `2647add2-e8fe-4c70-a6b5-96d2b0d67d6d`. Sem filtros: 58 cargas com saldo, 904 pedidos com saldo livre, 232 pedidos com previsão vencida e 863 sem previsão. Esses valores identificam a publicação verificada; não são constantes da aplicação.

As capturas locais `.local/strategic-final-desktop.png`, `.local/strategic-final-priorities.png` e `.local/strategic-priorities-mobile.png` documentam a composição renderizada. Esta verificação técnica não substitui a avaliação gerencial prevista na metodologia do TCC.


## Correspondência entre cards e tabelas

A tabela de evolução mensal expõe R$/TON, Conversão e Escoamento diretamente. Seu total de conversão é ponderado pelos pedidos emitidos elegíveis; o total de escoamento é a razão dos valores dos dois fluxos. Não são médias simples dos percentuais das linhas.

O agregado RESUMO DO PERÍODO · MESMAS MÉTRICAS DOS CARDS da API reproduz os 11 indicadores de desempenho: médias mensais de peso, volume, itens, pedidos e grupos; ticket, nível de serviço, OTIF, R$/TON, conversão e escoamento. Contagens distintas são apuradas em cada competência antes da média. Taxas e razões usam suas bases completas. Esse resumo e a tabela CARTEIRA LOGÍSTICA ATUAL foram retirados da interface em 09/11/2026 por solicitação do autor, junto dos textos de apresentação. Seus agregados permanecem no contrato da API para compatibilidade. Carteira e backlog continuam nos cards principais; não é criada série de saldos históricos.

Na dimensão, pedidos e valores de emissão sem faturamento continuam na população das taxas. Conversão é atribuída à categoria do pedido emitido e aceita suas notas com destino diferente; escoamento usa a categoria de cada evento. Um pedido com mais de uma categoria de emissão pode participar de mais de uma linha, mas o total é recalculado sem duplicação. As razões por categoria não são somadas. Medidas de média mensal de peso e volume também estão nas configurações. Recortes incompatíveis retiram conversão/escoamento das colunas e medidas, sem apresentar zero como substituto.


## Filtro automático de calendário e limite de observação

`shared/strategic-period.js` define o padrão de calendário usado pela store e pelo domínio: 01/01 do ano anterior até hoje, usando America/Sao_Paulo. Na inicialização e ao limpar filtros, o intervalo vem preenchido. Uma atualização refaz o período automático se ele ainda estiver ativo; intervalos personalizados são preservados. O intervalo solicitado consta integralmente em `meta.history.start/end`, inclusive sem dados, e o denominador das médias mensais usa suas competências, como definido nas ajudas dos cards. Meses sem registros da publicação entram como zero nas quantidades; isso não estima o fechamento de meses nem atesta completude do ERP. Razões sem base positiva ficam indisponíveis.

O calendário selecionado não amplia a observação da publicação. Faturamentos posteriores à referência do snapshot ficam fora dos cálculos; a conversão no próprio mês considera somente competências encerradas até a menor data entre fim selecionado e referência publicada. O gráfico de safras recebe o mesmo recorte de calendário, mantendo suas regras próprias de maturação das janelas. Carteira e backlog seguem na posição publicada, independentes do filtro de faturamento. Não foi alterado o ETL.

Na conferência somente leitura de 09/11/2026, a transformação de emitidos usa DOCUMENTO_FATURA.DTEMISSAO_DOCFAT >= 01/01/2025; faturados usa ENTREGA.DTEMISSAO_DOCFAT, denominada DT_FATURA, com o mesmo início e sem corte superior explícito nesses SQLs. Os faturados publicados observados vão de 06/01/2025 a 30/09/2026. Foram identificados 13 registros emitidos após 30/09/2026, oito após o ano de 2026, chegando a 3015; esses registros foram apenas diagnosticados, sem correção da origem ou dos fatos. A consulta estratégica de emitidos usa o limite da referência publicada.
