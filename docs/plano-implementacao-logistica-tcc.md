# Plano de implementação do painel logístico e conclusão do TCC

## Retomada em 04/10/2026

Ponto de retomada: Formação de Cargas ampliada e Visão Estratégica implementadas. A arquitetura prática já vai além das três áreas comerciais originalmente migradas. A conciliação abaixo atualiza o andamento, sem declarar conclusão integral do TCC.

| Etapa | Estado conferido | Trabalho que falta |
|---|---|---|
| 1 — Fontes e regras | Inventário inicial e documentação consolidada nesta retomada: [dicionário](dicionario-indicadores-logisticos.md), [regras](regras-negocio-logistica.md), [rastreabilidade](mapeamento-fontes-logisticas.md) | Homologação operacional das novas fontes e decisões abertas |
| 2 — Extração e qualidade | Quatorze fontes logísticas extraídas pelo Hop, além do fluxo comercial | Ampliação para frete, assistência e retorno; cobertura fora do recorte atual |
| 3 — Modelo | Fatos de saldo por item e ponte de alocação publicados | Eventos de conclusão integral, custos e snapshots históricos |
| 4 — API e indicadores | Carteira, medidas por parcela, previsões e Visão Estratégica entregues | Contratos novos de ciclo integral, frete e processos próprios |
| 5 — Formação de cargas | Hierarquia, seleção cruzada, mapa, filtros e medidas conciliados | Homologação funcional com a operação |
| 6 — Expedição | Classificação por marcos registrados disponível | Durações, sequência/qualidade dos eventos e comprovação de saída; campos de saída de 2026 sem cobertura no inventário |
| 7 — Frete | Inventário iniciado nesta retomada; [resultado e fontes candidatas](inventario-frete-logistico.md) | Confirmar custo real e seus vínculos antes de implementar percentual |
| 8 — Assistências e recolhimentos | Identificação inicial de tipos/campos | Validar processo e implementar extração, fatos e interface próprios |
| 9 — Operação | Publicações e caches existentes | Ensaios de restauração/falha, frequência, retenção e snapshots |
| 10 — Avaliação | Validação técnica disponível | Experimento manual × painel e questionário com participantes reais |
| 11 — Parte escrita | [Correspondência atualizada](relacao-com-tcc.md) | Incorporar revisão no texto e apresentar resultados da avaliação quando realizada |

**Contrato atual versus proposta:** a Visão Estratégica preserva Nível de Serviço e OTIF por registro faturado, incluindo a regra legacy para previsão ausente. As propostas abaixo de média por pedido integralmente atendido e exclusão de prazos ausentes continuam futuras, dependem de homologação e exigem versão explícita. Os gráficos entregues não demonstram entrega física nem In Full. O [dicionário](dicionario-indicadores-logisticos.md) é a referência do comportamento executado.

**Verificação da retomada:** `npm test`, 113 aprovados; reconciliação SQL da Visão Estratégica, sete cards, quatro prioridades e 12 competências sobre 199.490 registros. Evidências desta execução: `.local/retomada-tests.log`, `.local/retomada-sql.log` e `.local/strategic-real-verification.json`. Os cinco testes de navegador e o build de 03/10 estão registrados na entrega estratégica; não foram repetidos nesta atualização documental.

**Próxima dependência do frete:** confirmar a rotina usada para custo. As 5.152 cargas de janeiro a setembro têm frete combinado zero; isto não confirma custo zero. As consultas iniciais foram concluídas, mas a ampliação para outras fontes recebeu erro de autenticação do Firebird. A publicação e as telas existentes permanecem disponíveis. A sequência é fonte/regra → cobertura/vínculos → Hop/fatos → API/tela → reconciliação → evidência no TCC.

## Planejamento original e critérios de evolução

Planejamento elaborado em 2 de outubro de 2026 a partir da parte escrita do TCC, da implementação em `legacy-refatorado`, dos documentos de validação e das referências visuais da pasta `NOTION`.

Este plano coordena a evolução dos dados, dos indicadores, das telas e da monografia. A arquitetura existente será mantida e ampliada. A prioridade é estabelecer regras verificáveis, acompanhar pedidos e cargas até o faturamento e a expedição e reunir evidências para responder à questão de pesquisa. Este documento é um plano; não declara que as funcionalidades propostas, a homologação ou os resultados acadêmicos já foram executados.

**Andamento em 02/10/2026:** inventário técnico da cópia anonimizada iniciado e primeira entrega de formação de cargas implementada com sete fontes nativas Hop, fatos e publicação próprios e rota `/cargas`. Regras, evidências, verificações e limites estão em [implementacao-logistica-primeira-entrega.md](implementacao-logistica-primeira-entrega.md). O levantamento encontrou faturamento parcial e vínculos históricos de itens em várias cargas. `DATAENTREGA_DOCFAT` e `DATAHORALIB_SAIDA_CARGA` existem, mas estavam sem preenchimento no levantamento de 2026. As decisões e pendências abaixo descrevem o planejamento original; essa evidência inicial não representa homologação operacional nem conclusão integral do plano.

## Escopo e decisões pendentes

O autor confirmou que o acompanhamento da empresa termina no faturamento ou na saída da carga. O recorte proposto é **Business Intelligence aplicado ao atendimento de pedidos e à expedição na indústria moveleira**, incluindo formação e acompanhamento de cargas e pendências de assistências e recolhimentos disponíveis no ERP.

O título atual pode ser mantido, com esse recorte explicitado no resumo, nos objetivos, na metodologia e nas limitações. Os dados disponíveis até o levantamento atual não demonstram transporte após a saída ou recebimento pelo cliente. Faturamento e saída física serão eventos separados: saída só será exibida como realizada quando houver evidência própria na origem.

O autor decidiu manter **OTIF** na interface e informou que uma rotina subutilizada do ERP registra a data de entrega ao cliente. Também decidiu que o cálculo continuará utilizando a **data de faturamento**. O levantamento inicial identificou `DATAENTREGA_DOCFAT`, sem preenchimento nos grupos de documentos de 2026 analisados; a relação entre esse campo e a tela mencionada ainda exige conferência funcional. O nome OTIF será acompanhado de definição visível do marco de faturamento; a monografia descreverá esse uso como indicador interno de pontualidade/proxy operacional, sem afirmar que comprova entrega física no prazo. A condição de atendimento completo deverá ser verificada separadamente: uma comparação apenas de datas calcula pontualidade, sem demonstrar o componente In Full.

O autor definiu **Lead Time = Nível de Serviço** como nomenclatura operacional do projeto. A apresentação adotará **Nível de Serviço (Lead Time)**, em dias, e explicitará os marcos utilizados. Nos pedidos faturados, representa o tempo entre o início homologado e o faturamento adotado; nos pedidos abertos, o tempo decorrido até a referência será identificado como atendimento em curso. Essa convenção não transforma duração em percentual de serviço.

O diagnóstico de uma rotina subutilizada e a proposta fundamentada de aproveitamento podem compor a contribuição da pesquisa mesmo sem utilização de seus campos nos indicadores principais. Registrar a rotina, sua finalidade, a situação observada e a oportunidade identificada. A mesma distinção aplica-se ao OTIF e ao Nível de Serviço: cálculo implementado com os campos atuais, oportunidade de melhoria identificada e adoção operacional executada são resultados diferentes e serão descritos conforme sua evidência.

O modelo será preparado para pedidos fracionados, várias cargas por pedido e faturamentos parciais. O levantamento inicial encontrou faturamento parcial e itens com vínculos históricos em várias cargas. Os significados operacionais, a reabertura e o tratamento de exceções ainda exigem homologação; vínculo histórico não equivale a saldo simultâneo em várias cargas.

| Decisão | Proposta inicial | Como resolver antes de implementar a regra |
|---|---|---|
| Início do atendimento | Emissão do pedido | Verificar uso de data de conferência, liberação ou recebimento; escolher o marco oficial e nomear indicadores alternativos separadamente |
| Fim do atendimento | Faturamento integral do saldo válido | Confirmar faturamento parcial, cancelamento residual e reabertura; medir primeira e última fatura separadamente |
| Saída da carga | Evento próprio, se registrado | Mapear campo e significado; sem registro, manter status de faturamento e declarar indisponibilidade da saída |
| OTIF e rotina subutilizada | Nome OTIF mantido; marco escolhido pelo autor é o faturamento | Homologar prazo/granularidade/completude e identificar a rotina de entrega; não atribuir à rotina um cálculo que utiliza apenas outros campos |
| Pedido sem carga | Saldo válido ainda não alocado | Confirmar reservas, cargas canceladas e diferenças entre quantidade aberta e quantidade disponível para alocação |
| Prazo | Previsão de faturamento válida | Definir tratamento de revisões, data original e exceções; não tratar ausência de previsão como atraso |
| Dias | Corridos para idade e ciclo | Validar se a empresa usa dias úteis; se usar, definir calendário, feriados e horários de corte |
| Frete | Custo atribuível à operação analisada | Identificar frete contratado, realizado, cobrado do cliente, responsabilidade pelo pagamento e impostos incluídos |
| Assistência | Processo distinto de pedido comercial | Confirmar códigos, origem, vínculo com venda, etapas e critério de conclusão |
| Recolhimento | Processo de retorno/coleta, quando registrado | Confirmar se usa documento, item de assistência, ocorrência ou outra entidade |
| Limite de idade | Manter a faixa de 60 dias como indicador de envelhecimento | Validar parâmetro por empresa/canal sem confundir idade com descumprimento de previsão |
| Publicação | Carga completa coerente como base inicial | Definir frequência com a empresa e medir custo de extração antes de propor incremental |
| Homologação acadêmica | Experimento e questionário previstos no texto | Alinhar instrumento, participantes e formato final com o orientador |

As decisões serão registradas com responsável, data, evidência da origem e versão da regra. Uma decisão pendente impede apenas o indicador dependente dela; módulos com regras confirmadas podem avançar.

## Situação atual e alterações necessárias

O fluxo atual é Firebird → extração nativa Apache Hop → staging PostgreSQL → transformações SQL orquestradas pelo Hop → fatos e dimensões DW → API Node.js/Express → Vue 3 e Apache ECharts. Python auxilia a execução e a conferência; não é o extrator produtivo. A aplicação utiliza dados reais publicados no DW.

| Elemento | Evidência atual | Alteração planejada |
|---|---|---|
| Arquitetura | API, frontend, staging, DW, pipelines e workflows implementados | Ampliar o domínio logístico sem substituir o ecossistema |
| Modelo dimensional | Fatos de abertos, emitidos e faturados; dimensões cliente, comercial, geografia e produto | Acrescentar contextos de data, carga, transportador e tipo de documento quando necessários |
| Pedidos abertos | Saldo, valor, peso, cubagem, idade, geografia e previsão | Identificar saldo sem carga, parcialmente alocado e alocado |
| Cargas | Referências utilizadas nos registros faturados | Criar acompanhamento próprio de cargas em formação, abertas e faturadas |
| Extração de CARGA | Código, descrição e transportador | Extrair etapas, datas, valores e demais campos somente após mapear sua origem |
| Assistências | Consultas principais filtram tipo de pedido | Incluir documentos de assistência em fatos/regras próprios, sem contaminar faturamento comercial |
| Indicadores | Fórmulas preservadas do legacy | Versionar correções semânticas e alterações de granularidade |
| Histórico de carteira | Carteira atual agrupada por mês de emissão | Distinguir composição da carteira de evolução histórica; iniciar snapshots se esta for necessária |
| Validação | Equivalência com o legacy e evidências técnicas documentadas | Acrescentar conferência de regras logísticas, novos relacionamentos e avaliação com usuários |
| Parte escrita | Tecnologias alinhadas; diferenças de indicadores e ETL; resultados em aberto | Atualizar descrição da prática e inserir resultados realmente obtidos |

Os projetos `legacy` e `Portal-Corporativo` serão mantidos como referência. Alterações deste plano serão concentradas em `legacy-refatorado`. Metas e presets locais serão preservados durante migrações.

## Sequência de execução

| Etapa | Entrega principal | Dependência | Critério para concluir |
|---|---|---|---|
| 1 | Inventário e dicionário de regras | Acesso a metadados e exemplos reais | Campos e fórmulas prioritários têm significado e origem confirmados |
| 2 | Extração ampliada e diagnóstico da qualidade | Etapa 1 | Dados novos carregados pelo Hop e reconciliados com a origem |
| 3 | Modelo dimensional e relacionamentos | Etapas 1 e 2 | Nenhuma duplicação indevida de saldo, quantidade, receita ou frete |
| 4 | Indicadores corrigidos e API | Etapa 3 | Fórmulas, populações, filtros e casos de ausência conferidos |
| 5 | Tela de pedidos e formação de cargas | Etapa 4 | Pedido → carga → item permite explicar os totais |
| 6 | Acompanhamento de cargas e expedição | Etapas 2 a 4 | Etapas e tempos têm evidência própria e pendências são identificáveis |
| 7 | Frete e análise de faturamento | Fonte e regra financeira confirmadas | Valores reconciliados e rateio sem duplicação |
| 8 | Assistências e recolhimentos | Tipos, vínculos e etapas confirmados | Pendências próprias, filtros e conclusão conferidos |
| 9 | Integração, histórico e operação | Módulos anteriores disponíveis | Cargas repetidas/falhas e navegação integral verificadas |
| 10 | Avaliação técnica e gerencial | Versão estabilizada | Experimento e questionário realizados e documentados |
| 11 | Revisão final da monografia e demonstração | Evidências da etapa 10 | Texto, telas, fórmulas, resultados e limitações correspondem à entrega |

A revisão textual começará na etapa 1 e acompanhará as entregas. A etapa 11 consolida resultados e conclusões, sem deixar toda a redação para o final. Frete e assistências podem ser desenvolvidos em sequência diferente se a disponibilidade dos dados justificar. A revisão visual seguirá uma tela por vez, conforme o processo já documentado no projeto.

O calendário será definido após o inventário e a confirmação da data de entrega acadêmica. A contagem das etapas não equivale a semanas: acesso à origem, complexidade das regras e disponibilidade dos avaliadores determinam a duração.

## Etapa 1 Levantamento e contrato dos indicadores

Produzir um inventário com tabela, campo, tipo, chave, descrição, cardinalidade, origem, período disponível e proporção de preenchimento. Consultar metadados e amostras direcionadas antes de executar extrações completas. Investigar `CARGA`, `CARGA_DOCUMENTOS`, `CARGA_ITENS`, `DOCUMENTO_FATURA`, `DOCUMENTO_PEDIDO`, `DOCUMENTO_ITEM`, `DOCUMENTO_ITEM_DETALHE`, `DOCUMENTO_ENTREGA` e entidades adicionais realmente encontradas.

Para cada indicador, registrar pergunta gerencial, fórmula, unidade, granularidade, população, numerador, denominador, datas utilizadas, filtros aplicáveis, exclusões, comportamento sem dados, regras de parcial/cancelado e um exemplo real conferido. Registrar também se maior ou menor valor representa melhora; limites de alerta precisam de justificativa da empresa.

Confirmar chaves por empresa e tipo de documento e verificar colisões entre códigos. Não assumir que código de pedido, carga ou cliente é globalmente único. Datas de ocorrência e timestamps de inclusão/alteração têm funções diferentes e serão identificados separadamente.

Entregáveis previstos: `docs/dicionario-indicadores-logisticos.md`, `docs/regras-negocio-logistica.md` e `docs/mapeamento-fontes-logisticas.md`. Acrescentar uma matriz requisito → fonte → transformação → indicador → tela → teste → seção do TCC.

## Etapa 2 Extração e qualidade dos dados

Ampliar as projeções brutas e o inventário de fontes. Criar pipelines novas quando houver tabelas adicionais, mantendo o processamento produtivo no Hop. Campos do ERP conservam sua identidade na origem/staging; campos derivados recebem nomes claros e rastreáveis.

A extração atual completa será a referência inicial. Recortes temporais deverão preservar pedidos antigos ainda pendentes e vínculos de cargas/faturas recentes com pedidos anteriores ao período. Extração incremental só será adotada se existir mecanismo confiável para alterações, cancelamentos e exclusões; sem ele, a carga completa permanece documentada.

Cada execução terá identificador, versão das regras, início/fim, contagens, período e diagnóstico de qualidade. Quando a leitura de várias tabelas não garantir uma fotografia única da origem, documentar a janela de leitura, verificar consistência e utilizar a estratégia compatível com a versão do Firebird e o impacto medido no ERP.

Separar ausência de fonte, campo não extraído, valor nulo, campo não utilizado pela operação e quantidade efetivamente zero. Preservar valores brutos e motivos de rejeição. Relacionamentos órfãos, datas impossíveis e quantidades incompatíveis serão registrados em uma área de diagnóstico; não serão corrigidos silenciosamente.

Revisar a validação atual que interrompe a publicação quando certas bases estão vazias. Uma extração concluída com zero assistências ou zero pedidos abertos pode ser legítima. A aceitação de base vazia deve considerar conclusão da extração, escopo e reconciliação; uma queda inesperada de contagem continua exigindo investigação.

A publicação dos módulos interdependentes será atômica. Uma falha manterá a última versão válida disponível, com seu horário e situação de atualização visíveis. O reprocessamento do mesmo staging deve ser reproduzível, sem duplicar fatos ou histórico.

Locais principais: `etl/inventario-fontes.json`, `etl/pipelines/extracao`, `etl/pipelines/transformacao-carregamento`, `etl/workflows` e `etl/sql`.

## Etapa 3 Modelo dimensional e conservação dos valores

O desenho final depende das chaves encontradas. A estrutura proposta separa eventos e evita que um join entre dois conjuntos de itens multiplique valores.

| Estrutura proposta | Significado de uma linha | Medidas e vínculos |
|---|---|---|
| Pedido item | Item/detalhe válido de um pedido na empresa | Solicitado, cancelado, faturado e saldo, com identidade preservada |
| Alocação item carga | Vínculo identificado de uma parcela do item a uma carga | Quantidade alocada e sua situação; mantém vários vínculos legítimos |
| Faturamento item | Evento de faturamento de um item/detalhe | Quantidade e receita do evento, documento fiscal e referências ao pedido/carga |
| Carga | Carga identificada na empresa | Situação e marcos operacionais; totais derivados sem repetir medidas de cabeçalho |
| Assistência item | Item ou ocorrência de assistência | Quantidade pendente, datas, tipo, vínculo de origem e destino |
| Recolhimento item | Item/evento de recolhimento identificado | Previsto, realizado e pendente, se esses eventos existirem |
| Snapshot da carteira | Saldo de um item na data de observação | Histórico de pendências, com data da fotografia e versão da publicação |

Essas estruturas podem compartilhar fatos e dimensões quando a granularidade for compatível. O nome físico será definido após o inventário; não é necessário criar uma tabela para cada tela. O desenho será documentado em um diagrama com chaves, cardinalidades e exemplos de fracionamento.

Adicionar dimensão de data para emissão, previsão, etapas e faturamento; dimensões de carga/transportador, empresa e tipo de documento conforme o modelo exigir. Cliente, produto e geografia existentes serão reaproveitados quando seus identificadores e atributos forem compatíveis. Não agregar códigos iguais de empresas diferentes por coincidência textual.

Regras de conservação serão conferidas por item e pela mesma data de referência:

- Quantidade solicitada válida = solicitada menos cancelamentos válidos, conforme a regra de origem.
- Saldo operacional considera atendimento, cancelamentos, estornos e reaberturas; a fórmula final será reconciliada com o ERP.
- Saldo sem carga e saldo alocado formam parcelas exclusivas do saldo elegível, quando a semântica das alocações permitir essa divisão.
- Eventos faturados somam sua receita uma única vez. Valor total de cabeçalho não pode ser somado novamente a cada item.
- Frete de cabeçalho é agregado na própria granularidade ou distribuído com regra de rateio explícita e soma conservada.

Desvios terão tolerância por medida: contagens e chaves exigem igualdade; valores monetários seguem a regra de arredondamento documentada. Negativos e alocação superior ao saldo serão diagnosticados antes de qualquer ajuste. Não aplicar simplesmente `max(0, saldo)` para ocultar inconsistências.

Pedidos distintos são contados globalmente por sua identidade. A soma de pedidos por carga ou região pode superar o total global quando um pedido participa de vários grupos; a interface explicará essa não aditividade.

Snapshots históricos começarão na primeira coleta confiável. O gráfico atual de saldo agrupado por mês de emissão será denominado composição da carteira por mês de emissão. Histórico anterior só será reconstruído com eventos suficientes, método documentado e reconciliação; não será inventado a partir da carteira atual.

## Etapa 4 Indicadores e contratos da API

| Indicador proposto | Regra a implementar | Exceções essenciais |
|---|---|---|
| Carteira pendente | Soma do valor do saldo elegível | Cancelados excluídos conforme regra; assistências sem valor comercial separadas |
| Pedidos com saldo sem carga | Distintos com parcela elegível não alocada positiva | Separar totalmente sem carga de parcialmente alocado |
| Valor peso e cubagem sem carga | Medidas correspondentes apenas à parcela não alocada | Não usar valor/peso do pedido inteiro quando só uma parte estiver livre |
| Idade média dos pedidos abertos | Média por pedido de data de referência menos marco inicial | Sem data: indisponível e cobertura informada; dias futuros inválidos diagnosticados |
| Pedidos antigos | Distintos com idade acima do limite configurado | Limite e comparação `>` ou `>=` explícitos; identidade diferente de atraso |
| Previsão de faturamento vencida | Saldo elegível positivo e previsão válida anterior à referência | Sem previsão em grupo próprio; regra para vencimento no dia documentada |
| Tempo até primeira fatura | Primeira fatura válida menos marco inicial do pedido | Não representa conclusão integral do atendimento |
| Tempo até faturamento integral | Conclusão confirmada do saldo válido menos marco inicial | Faturamento parcial permanece em curso; política de saldo cancelado explícita |
| Pontualidade de faturamento | Proporção de pedidos/eventos elegíveis concluídos até a previsão definida | Granularidade única; sem previsão fora do denominador com cobertura exibida |
| OTIF como nome interno | Pontualidade baseada no faturamento, com fórmula/granularidade homologadas e identificação como proxy | Não confirma entrega ao cliente; verificar separadamente atendimento completo, sem afirmar In Full quando o cálculo usa somente datas |
| Backlog em dias equivalentes | Valor do saldo selecionado dividido pela média diária histórica definida | Denominador zero/ausente gera indisponível; dias corridos/úteis e janela explícitos |
| Cargas e tempo por etapa | Distintos e diferenças entre marcos reais da carga | Etapas abertas usam referência para tempo em curso; não misturar com duração concluída |
| Frete sobre faturamento | Soma do custo atribuível dividida pela receita correspondente, vezes 100 | Mesma população/período; custo ausente não equivale a zero; base zero indisponível |
| Frete previsto sobre valor da carga | Frete contratado/estimado sobre valor correspondente da carga | Separado do indicador realizado e identificado como previsto |
| Assistências e recolhimentos pendentes | Distintos e saldos dos processos próprios | Quantidade sem valor financeiro continua visível; conclusão exige evento válido |
| Conferência de carregamento | Quantidade conferida sobre prevista na mesma unidade e população | Depende de registros reais de conferência; não é confirmação de recebimento pelo cliente |

As médias principais serão por pedido, caso esse contrato seja confirmado. Médias por item ou ponderadas poderão existir como análises adicionais claramente nomeadas. Prazos revisados serão identificados: pontualidade frente à previsão atual e frente à previsão original só serão comparadas quando houver ambas as evidências.

### Indicadores de faturamento e séries mensais

O autor propôs acrescentar Nível de Serviço, Entregue no Prazo (OTIF), Toneladas por Mês, Média de Nível de Serviço por Mês, Volume e Evolução do OTIF por Mês. A decisão final de planejamento mantém o nome OTIF e utiliza faturamento como marco do cálculo, embora exista, segundo o autor, uma rotina de registro da entrega ao cliente. A apresentação explicará o significado interno e seus limites. O card do período e a série mensal representam o mesmo indicador em granularidades temporais diferentes.

| Proposta do autor | Apresentação planejada | Definição e população |
|---|---|---|
| Nível de Serviço | Nível de Serviço (Lead Time), em dias | Nomenclatura definida pelo autor; subtítulo e tooltip explicitam tempo até faturamento; proposta de média por pedido integralmente atendido no período, conforme marcos homologados |
| Entregue no Prazo (OTIF) | OTIF, em percentual, com subtítulo baseado no faturamento | Comparação com a previsão de faturamento na população homologada; retirar a expressão Entregue no Prazo quando não se utiliza o evento de entrega; a completude por item exige cálculo próprio |
| Toneladas por Mês | Toneladas faturadas por mês | Soma do peso dos eventos válidos faturados no mês, convertido de kg para toneladas; considerar somente a quantidade faturada em eventos parciais |
| Média de Nível de Serviço por Mês | Tempo médio até faturamento por mês | Mesmo contrato do card, agrupado pelo mês de conclusão integral do pedido; primeira fatura pode ser série adicional com nome distinto |
| Volume por | Cubagem faturada em m³ por mês, carga ou região | Agrupamentos propostos para a indicação ainda incompleta de volume; não confundir m³, quantidade de itens e quantidade de volumes/embalagens |
| Evolução do OTIF (% No Prazo) por Mês | Evolução do OTIF por mês, baseada no faturamento | Mesmo contrato do card e limites do indicador interno; período/coorte definidos sem misturar compromisso de entrega com previsão de faturamento |

Nível de Serviço e Lead Time serão tratados como nomes equivalentes da métrica de duração adotada no projeto, com definição visível de tempo até faturamento. Não será descrita na monografia como percentual de atendimento ou tempo até entrega física. Se a regra homologada utilizar emissão até primeira fatura, conferência até fatura ou média por item, o subtítulo, a população e a documentação serão ajustados explicitamente; não haverá substituição silenciosa da regra.

Sem previsão válida, o pedido não entra no denominador de pontualidade e aparece na cobertura de dados. Mês com denominador zero terá percentual indisponível. Totalizadores de pontualidade serão recalculados pelo numerador/denominador do período inteiro, e a média de tempo será recalculada sobre os pedidos elegíveis; não usar média simples de percentuais ou médias mensais.

Para o indicador interno denominado OTIF, homologar a população e o período: percentual dos pedidos faturados no período e cumprimento dos pedidos com compromisso de faturamento no período são análises diferentes. A segunda inclui compromissos vencidos ainda não atendidos; a primeira deve informar que sua população inclui somente faturados. No mês em curso, não classificar compromissos futuros como falha. Documentar prazo ausente, cancelamento e reprogramação, além do marco de primeira fatura ou conclusão integral escolhido para pedidos parciais.

Caso a fórmula passe a incorporar completude, ela será conferida por item e unidade compatível, acumulando as quantidades faturadas válidas até o prazo. Quantidade de um produto não compensará falta de outro produto. Essa extensão seria atendimento completo no marco do faturamento, e não comprovação de recebimento integral pelo cliente. A previsão de faturamento será comparada ao faturamento; não será substituta automática da data prometida de entrega.

Meses sem movimento terão peso/cubagem zero apenas quando a cobertura daquele período for confirmada; períodos sem cobertura permanecerão indisponíveis. O mês em curso será identificado como parcial. Comparações com ano anterior usarão períodos equivalentes e informarão a cobertura, evitando comparar um mês parcial com um mês completo sem indicação. Peso/cubagem do faturamento não serão nomeados como mercadoria expedida sem evento de saída física.

Validar séries e cards contra o mesmo conjunto de dados e filtros, verificar faturamentos e atendimentos parciais atravessando meses, conclusão no último dia do mês, prazo ausente/revisado, estornos, compromisso vencido sem atendimento e valores de peso/cubagem ausentes. Gráficos de tempo, percentual e medidas físicas terão unidades próprias; não compartilhar um eixo que dificulte a interpretação.

### Papel da rotina de entrega na pesquisa

Segundo o autor, a rotina registra entrega ao cliente, mas esse campo não será o marco do indicador OTIF planejado nem do Nível de Serviço (Lead Time) baseado em faturamento. Sua identificação e a proposta de aproveitamento serão consideradas uma contribuição de diagnóstico e planejamento, independentemente de alimentar esses cálculos. A adoção efetiva será uma contribuição adicional somente se realizada. Também é possível utilizar o registro de entrega em uma validação complementar ou indicador próprio, caso essa atividade seja incorporada. As atividades previstas para documentar essa contribuição são:

1. Identificar a rotina, tabelas e campo de data real de entrega informado pelo autor. Verificar cobertura, vínculo ao pedido, fonte da confirmação e se existem quantidade por item, prazo de entrega e tratamento de parcelas/cancelamentos.
2. Levantar seu uso atual com evidências: proporção de registros preenchidos, cobertura por período e relato do procedimento pelos usuários. Distinguir rotina não utilizada, utilização irregular e informação existente que ainda não era aproveitada pelo painel.
3. Definir com a empresa o procedimento de registro, responsáveis, frequência e tratamento de erros. Se o evento for entrega ao cliente, verificar como a confirmação chega ao ERP; registro interno de fatura não confirma esse evento.
4. Se a adoção fizer parte do escopo, realizar piloto com operações reais, início e população identificados. Integrar o campo pelo Hop e conferir a evidência de entrega. O cálculo principal continuará usando faturamento conforme a decisão do autor.
5. Medir cobertura, consistência e esforço de registro após a adoção. Separar melhoria no registro dos dados de melhoria no desempenho operacional; passar a medir OTIF não demonstra por si só aumento de OTIF.
6. Avaliar, quando houver evidência, diferença entre data de faturamento e data de entrega como análise complementar. Uma medida de entrega no prazo exigirá prazo de entrega; OTIF de entrega também exigirá completude. Histórico anterior só será incluído com evidência suficiente.
7. Incorporar o processo e os resultados medidos à metodologia e ao capítulo de resultados. A redação de que a rotina passou a ser utilizada dependerá da execução documentada do piloto ou da adoção; até então será descrita como proposta.

Mesmo sem utilizar o campo de entrega no cálculo, a pesquisa poderá apresentar o diagnóstico documentado da rotina subutilizada e a proposta de seu aproveitamento, além da transformação e visualização dos registros de faturamento e demais funções entregues. O nome OTIF permanecerá como convenção interna explicada; o texto não apresentará pontualidade de faturamento como evidência de entrega no prazo e completa. Falta de dados deixará a análise complementar indisponível, sem valores substitutos.

Preservar as definições originais em documentação de compatibilidade e versionar as novas. Uma mudança semântica não será apresentada como simples equivalência matemática com o legacy. Rever também ticket médio e R$/kg ou R$/ton para que nome, denominador e unidade correspondam ao cálculo.

Os endpoints novos terão respostas com publicação, referência, definição do indicador, unidade, contagem elegível, cobertura dos campos e totais. Nenhum cálculo de negócio será duplicado no frontend.

Filtros de emissão, previsão, faturamento e etapa terão funções distintas. Totais, gráficos, detalhamento e CSV compartilharão o mesmo contrato de filtros. Cache incluirá publicação, versão da regra, área, referência, filtros e configuração relevante. Respostas de filtros e painel de publicações diferentes serão recusadas/recarregadas para manter consistência.

Paginação terá ordenação estável e desempate por chave. Exportação terá os mesmos filtros, unidade, valores e granularidade da consulta, com limites de volume definidos e proteção para textos que possam ser interpretados como fórmulas por planilhas.

Locais principais: `api-server/domain`, `api-server/repositories/postgres.js`, `api-server/domain/contracts.js`, `api-server/app.js`, `src/types/analytics.ts` e `src/api/client.ts`. Rotas de logística serão adicionadas por domínio; URLs atuais permanecerão funcionais durante a migração.

## Etapas 5 e 6 Pedidos cargas e expedição

A navegação proposta reúne **Visão logística**, **Pedidos em aberto**, **Cargas e expedição**, **Faturamento e desempenho logístico** e **Assistências e recolhimentos**. Conforme o alinhamento posterior com o autor, Pedidos Emitidos sairá da navegação principal; sua base continuará sustentando emissão, idade, ciclo e entrada de demanda. A área de Faturados será orientada a desempenho logístico, com indicadores renomeados quando necessário. URLs antigas terão compatibilidade ou redirecionamento explícito, e a retirada do menu não apagará dados, consultas ou referências necessárias. Análises comerciais existentes poderão permanecer acessíveis separadamente quando houver necessidade, sem disputar destaque no resumo do TCC.

| Tela | Conteúdo | Decisão apoiada |
|---|---|---|
| Visão logística | Saldo, parcelas sem carga, previsão vencida, idade, backlog, cargas por etapa e previsão próxima | Identificar a fila prioritária e onde se concentram pendências |
| Pedidos | Filtros por empresa, tipo, situação, alocação, região, entrega/retirada e datas; itens e vínculos | Explicar quais pedidos ainda precisam de alocação ou atendimento |
| Formação de cargas | Cargas e documentos vinculados, parcelas livres/alocadas, peso e cubagem por destino | Apoiar agrupamento operacional e análise de demanda |
| Detalhe da carga | Pedidos/itens, valores, transportador, marcos, pendências e faturamento | Identificar por que a carga ainda não avançou |
| Expedição | Distribuição por etapa e tempos; conferência prevista/realizada quando disponível | Localizar gargalos de separação, conferência ou liberação |
| Faturamento e desempenho logístico | Nível de serviço com definição de tempo até faturamento, toneladas e cubagem mensais, indicador interno OTIF e sua evolução baseados no faturamento e frete por período/carga/região | Avaliar vazão física associada ao faturamento, pontualidade operacional definida e representatividade do custo |
| Assistências e recolhimentos | Pendências separadas por processo, idade, localização e vínculo com carga | Planejar atendimento pós-venda e retorno |

Selecionar uma carga deve mostrar suas parcelas e pedidos. Selecionar um pedido deve mostrar todas as cargas e faturas relacionadas. Pedido parcialmente alocado exibirá suas parcelas com clareza; o mesmo pedido não será somado integralmente em cada carga.

Mapa de UF/cidade será uma visão de distribuição e apoio ao agrupamento. Os prints com título de roteirização não comprovam a existência de otimização de rotas; cálculo de sequência ótima, distância ou ETA dependeria de outro requisito e fica fora da entrega principal.

Reutilizar os componentes existentes de cards, gráficos, tabelas e filtros. Preservar tipografia padronizada, botão de configuração acessível, sidebar suave, alturas consistentes de tabela, totalizadores, pesquisa, CSV, tela cheia, tooltips e navegação por teclado. Estados de loading manterão a tabela montada com spinner interno centralizado; primeira carga do painel terá indicação central apropriada. Animações respeitarão movimento reduzido.

Cada tela terá estados de primeira carga, atualização com dados anteriores, vazio legítimo, filtros sem resultado, módulo sem fonte disponível, publicação antiga e erro com tentativa de recuperação. Ausência de fonte não aparecerá como zero. Data da publicação e referência dos cálculos serão visíveis.

Locais principais: `src/router/index.ts`, `src/App.vue`, `src/stores/analytics.ts`, `src/views`, `src/components/analytics`, `src/components/abertos` e novos componentes específicos de logística.

## Etapa 7 Frete

Mapear a granularidade do frete: pedido, documento, nota, carga ou contratação. Registrar se o valor é estimado, contratado, realizado ou repassado ao cliente. Fretes pagos por terceiros e retiradas terão políticas explícitas de inclusão.

Quando um frete atender várias notas ou períodos, preferir vínculo real; se for necessário rateio, validar a base com a empresa, como peso, cubagem ou valor. Distribuir o resíduo do arredondamento de forma determinística para conservar o total em centavos. Um frete de carga não será repetido integralmente em cada pedido.

Cargas mistas com pedidos comerciais e assistências exigem atribuição consistente do custo. Sem base confiável, apresentar o custo agregado da carga e declarar a limitação do rateio. Registro sem frete será classificado como zero confirmado, não informado ou não aplicável, conforme evidência.

Se não existir custo realizado confiável, implementar apenas a análise do frete contratado/previsto disponível e revisar a promessa acadêmica. O percentual sobre faturamento realizado permanece pendente até a fonte permitir sua demonstração; não será preenchido por estimativa não identificada.

## Etapa 8 Assistências e recolhimentos

Validar o de/para dos tipos no ERP. O texto cita código 2 para assistência, mas sua interpretação operacional será confirmada antes do uso. Identificar abertura, itens, quantidade, previsão, alocação, faturamento/expedição de reposição e conclusão. Vínculo com a venda original é desejável; ausência desse vínculo será informada.

Separar pendência de assistência, produto de reposição a expedir e material a recolher. Um recolhimento registrado como solicitado não será marcado realizado apenas porque houve faturamento de uma reposição.

Documentos com valor zero permanecem nas contagens e quantidades. Não inferir taxa de defeito de fabricação ou satisfação do cliente pela simples quantidade de assistências: esses indicadores exigem motivos, população e vínculos específicos.

Recolhimentos sem fonte identificada serão registrados como lacuna de escopo. Se existirem, incluir previstos/realizados/pendentes, localização, idade e vínculo com a carga. A conclusão será conferida conforme o evento que a operação utiliza.

## Matriz de situações e tratamento

Esta matriz cobre os casos identificados e os casos preventivos do desenho. Situações novas encontradas no inventário serão acrescentadas com regra e evidência; não existe promessa de cobrir estados do ERP ainda desconhecidos.

| Situação | Tratamento esperado | Conferência necessária |
|---|---|---|
| Pedido totalmente sem carga | Exibir apenas seu saldo elegível como livre | Saldo versus vínculos ativos |
| Pedido parcialmente em carga | Separar parcela alocada e parcela livre | Conservação por item e por pedido |
| Pedido em várias cargas | Manter todos os vínculos; total global distinto | Quantidades e identidades de cada alocação |
| Vários pedidos em uma carga | Somar parcelas da carga, sem repetir cabeçalhos | Total da carga versus seus itens |
| Item com variantes/composição | Preservar detalhe e regra de composição | Evitar dupla contagem de produto pai e componentes |
| Carga com pedidos e assistências | Separar tipos e somar somente medidas compatíveis | Quantidade e receita por tipo |
| Pedido faturado parcialmente | Manter saldo; distinguir primeira fatura e conclusão | Eventos fiscais e saldo remanescente |
| Saldo parcialmente cancelado | Aplicar cancelamento válido ao saldo elegível | Quantidade solicitada, atendida e cancelada |
| Pedido/carga cancelado | Excluir de pendências ativas, conservar evidência necessária | Código/status/data da anulação |
| Estorno devolução ou reabertura | Registrar efeito próprio no saldo; não apagar a história | Vínculo com evento original e sinal dos valores |
| Troca de carga | Encerrar/remover alocação antiga conforme evidência; manter vigente | Não contar ambas como reservas ativas |
| Retirada pelo cliente | Manter grupo separado de entrega sob responsabilidade da empresa | Regra de alocação, expedição e frete |
| Carga sem transportador | Agrupar como não informado | Não inferir motorista ou responsável |
| Carga sem documentos | Mostrar cadastro/etapa se relevante, sem criar medidas | Distinguir carga vazia de falha de extração |
| Código zero ou marcador sem carga | Normalizar somente após confirmar semântica | Não criar uma carga fictícia pelo código marcador |
| Pedido bloqueado | Exibir bloqueio e motivo quando disponíveis | Distinguir impedimento de atraso/idade |
| Sem previsão | Grupo próprio, fora da pontualidade elegível | Cobertura e contagem sem previsão |
| Previsão revisada | Distinguir prazo original e vigente quando disponíveis | Não reconstruir histórico inexistente |
| Previsão vencida hoje | Aplicar limite documentado do dia/horário | Testar igualdade e mudança de referência |
| Data futura inválida | Diagnóstico e exclusão da duração inválida | Evitar idade negativa como resultado normal |
| Datas de etapas invertidas | Sinalizar inconsistência | Não converter duração negativa em zero silenciosamente |
| Faturada sem saída registrada | Exibir faturada; saída indisponível | Não inferir expedição física |
| Rotina de entrega sem dados suficientes | Análise complementar de entrega indisponível, com cobertura identificada | OTIF interno baseado no faturamento mantém definição explícita; não afirma comprovação de entrega |
| Atendimento completo após o prazo | Falha de OTIF para o compromisso correspondente | Conferir última parcela necessária e prazo do mesmo evento |
| Atendimento parcial dentro do prazo | Componente no prazo não basta para sucesso de OTIF | Conferir completude por item até o compromisso |
| Registro inserido após a ocorrência | Separar data real do evento e data de lançamento | Usar evento comprovado para o prazo; atraso no registro integra diagnóstico de qualidade |
| Etapa não registrada | Não informada ou não aplicável conforme regra | Não inventar passagem por todas as etapas |
| Fila ou etapa ainda em curso | Tempo até referência identificado como em curso | Separar da média de etapas concluídas |
| Peso/cubagem nulos | Medida indisponível e cobertura | Não confundir cadastro incompleto com produto sem peso |
| Unidades diferentes | Conversão documentada por produto e unidade | Não somar peças, volumes e chapas como mesma medida |
| Frete duplicado após join | Agregar/ratear na granularidade correta | Total deve reconciliar com a fonte |
| Frete ausente ou não aplicável | Categorias distintas do zero confirmado | Cobertura e responsabilidade pelo custo |
| Base financeira zero | Percentual indisponível | Nunca retornar infinito ou zero enganoso |
| Duplicidade técnica | Diagnosticar pela chave real e corrigir a causa | Não eliminar eventos legítimos com DISTINCT genérico |
| Vínculo órfão | Registrar diagnóstico e impacto | Não associar por descrição semelhante |
| Mesmo código em empresas distintas | Usar identidade completa | Filtros e joins não cruzam empresas indevidamente |
| Pedido atravessa períodos | Manter emissão, previsão e faturamento como recortes distintos | Saldo/receita conforme objetivo da análise |
| Histórico não disponível | Indicar início da série confiável | Não desenhar backlog antigo a partir do saldo de hoje |
| Nenhum registro legítimo | Exibir estado vazio e totais aplicáveis | Publicação pode ser válida após conferência |
| Extração interrompida | Preservar publicação anterior | Falha e horário da última atualização identificáveis |
| Carga executada novamente | Resultado idempotente | Sem duplicação de fatos/snapshots |
| Publicação muda durante navegação | Recarregar ou fixar versão coerente | Cards, tabelas e CSV não misturam versões |
| Filtro sem resultados | Estado específico e opção de limpar filtro | Não mostrar falha de infraestrutura |
| Limite de exportação | Informar limite e estratégia de consulta | Sem exportação silenciosamente truncada |
| Divergência do legacy após correção | Registrar alteração intencional com versão | Testar contrato novo e compatibilidade separadamente |

## Etapa 9 Operação migração e recuperação

Antes das mudanças de schema, preparar backup consistente e procedimento de restauração; conferir a restauração em destino isolado. Criar migrações aditivas quando possível, publicar API compatível e habilitar telas novas somente após conferir a carga.

Bloquear execuções concorrentes do ETL, definir timeout por etapa, registrar falhas e evitar publicação de conjunto misturado de extrações. Repetição automática será limitada e não publicará registros duplicados. Definir política de retenção de logs, staging de diagnóstico e snapshots conforme volume medido.

Medir duração de extração, transformação, publicação e consultas. A frequência de atualização será baseada na necessidade operacional e no custo sobre a origem. Mostrar última publicação e condição de atualização; painel local atualizado por lote não será descrito como tempo real.

Validar API sem publicação, PostgreSQL indisponível, carga em execução e publicação concluída durante uma requisição. Verificar consulta fria e com cache, diferentes filtros e volume de exportação. Corrigir gargalos medidos; não refatorar por hipótese sem necessidade.

Para reversão, registrar compatibilidade entre versão do frontend, API e schema. Desabilitar módulos novos ou retornar aos contratos anteriores preservando dados e configurações. Mudanças de fórmula não serão escondidas por um rollback só visual.

## Plano de testes e critérios de aceite

| Frente | Verificação | Evidência esperada |
|---|---|---|
| Origem e staging | Contagens, chaves, tipos e amostras por situação | Relatório da execução Hop e consultas de conferência |
| Relacionamentos | Cardinalidades e conservação de saldos/valores | Reconciliação por item, pedido, carga e período |
| Indicadores | Fórmulas, filtros, denominadores e ausências | Casos reais com cálculo independente conferido |
| Histórico | Repetição, mudança de saldo, estorno e reabertura | Snapshots/eventos sem duplicação, conforme disponibilidade |
| API | Contratos, validação, paginação, cache e exportação | Testes de domínio e HTTP com publicação identificada |
| Interface | Desktop/celular, teclado, detalhes, estados e loading | Testes de navegador e revisão visual por tela |
| Regressão | Emitidos, faturados, metas, filtros e presets existentes | Contratos preservados ou mudanças intencionais documentadas |
| Falha e recuperação | ETL incompleto, banco indisponível e restauração | Última publicação íntegra e procedimento recuperável |
| Desempenho | ETL e consultas com/sem cache | Tempos, volume, ambiente e limitações registrados |

Dados produtivos e referências de validação permanecerão reais. Não criar modo demo ou dados substitutos para preencher lacunas. Casos sem ocorrência real serão classificados como não exercitados; inspeção da lógica não será descrita como prova empírica. Se posteriormente houver autorização para cenários controlados em teste isolado, sua natureza será identificada e nunca apresentada como observação da empresa.

Testes apropriados serão executados conforme cada mudança: `npm test`, `npm run build`, testes Playwright focados e scripts de reconciliação/benchmark aplicáveis. A suíte completa será rodada na estabilização da integração. Testes focados aprovados não representarão aprovação automática de todas as áreas.

Cada módulo será concluído quando sua regra estiver confirmada, sua fonte disponível, seus valores reconciliados, seus estados excepcionais tratados, seus testes relevantes aprovados e sua revisão funcional/visual registrada. Toda limitação remanescente terá impacto, responsável e destino explícito na entrega ou nos trabalhos futuros.

## Etapa 10 Avaliação da contribuição do painel

Escolher tarefas reais, como identificar pedidos com previsão vencida sem carga, localizar cargas retidas numa etapa e calcular o indicador de frete quando disponível. Para cada tarefa, definir a pergunta, os filtros, a publicação de dados e o resultado correto antes da medição.

Comparar o procedimento manual efetivamente utilizado com o painel para a mesma tarefa e população. Medir tempo de obtenção da resposta correta, esforço/etapas e erros encontrados. Registrar separadamente custo do ETL e tempo de interação do usuário. Cache frio/quente, treinamento, repetição e ordem das tarefas serão controlados ou descritos para não confundir efeitos de aprendizagem com ganhos da ferramenta.

Planejar participantes e repetições com o orientador. O texto estima 3 a 5 usuários estratégicos; isso é planejamento, não amostra já realizada. Registrar função, experiência relevante e respostas sem expor identidade pessoal. Usar questionário Likert de 5 pontos sobre facilidade, clareza, rapidez e utilidade, acompanhado de espaço para comentários e exemplos de decisões.

Apresentar resultados descritivos compatíveis com o tamanho da amostra, divergências e limitações. Não extrapolar avaliação local para todas as empresas do setor. Equivalência matemática com o legacy, desempenho HTTP e utilidade gerencial serão evidências separadas.

Entregáveis previstos: protocolo, roteiro de tarefas, questionário, resultados de tempo/acurácia, respostas agregadas e relato da homologação. Nenhum ganho percentual será escrito antes de existir medição.

Se realizado, o estudo da rotina de entrega integrará a avaliação com situação inicial, adoção/piloto, cobertura posterior e análise complementar efetivamente viabilizada. A análise distinguirá os efeitos da mudança de procedimento no ERP dos efeitos da visualização no dashboard. O texto identificará o faturamento como marco do indicador interno OTIF, sem atribuir seu cálculo à rotina de entrega não utilizada na fórmula.

Se houver somente diagnóstico e proposta de utilização, esses resultados serão apresentados como contribuição de levantamento de requisitos e identificação de oportunidades, para OTIF e Nível de Serviço (Lead Time). Relatar os registros/telas examinados e a melhoria proposta; não exigir adoção operacional para reconhecer essa contribuição, nem relatar adoção ou impacto medido sem execução.

## Etapa 11 Revisão da parte escrita e apresentação

| Parte do TCC | Atualização necessária |
|---|---|
| Resumo | Delimitar atendimento/expedição e listar somente indicadores entregues; substituir expectativas por resultados medidos ao final |
| Introdução e objetivos | Explicitar limite no faturamento/saída registrada e decisões gerenciais apoiadas |
| Referencial de indicadores | Distinguir OTIF de entrega no prazo e completa da convenção interna baseada no faturamento; definir idade, ciclo, pontualidade, backlog equivalente e custo de frete |
| ETL e tecnologias | Descrever projeções completas, staging bruto, SQL de transformação e transforms/workflows realmente usados |
| Modelo dimensional | Diagramar fatos, dimensões, granularidades e relação de parcelas entre pedido e carga |
| Trabalhos relacionados | Verificar referências, acesso e suporte das comparações; substituir fontes não verificáveis |
| Metodologia | Documentar levantamento, regras, validação, protocolo temporal e instrumento gerencial efetivamente aplicados |
| Resultados | Apresentar arquitetura executada, telas, reconciliações, casos de decisão, medições e avaliação |
| Considerações finais | Responder à questão de pesquisa com as evidências e delimitar limitações |
| Apêndices | Dicionário, instrumentos, matriz de rastreabilidade e regras pertinentes |

Revisar a afirmação atual sobre dados anonimizados/simulados: a aplicação utiliza dados reais; o texto deve explicar separadamente como imagens e evidências acadêmicas são preparadas para preservar identidades e informações comerciais. Preparar cópias próprias para apresentação, conservando consistência de códigos e sem alterar o banco operacional para produzir screenshots.

Verificar todas as referências antes de manter afirmações apoiadas nelas, especialmente citações incompletas dos trabalhos relacionados. Este plano não certifica a bibliografia. Uniformizar numeração dos capítulos, datas, siglas, unidades e linguagem de projeto executado. A conclusão dependerá dos resultados observados.

O roteiro de demonstração mostrará um fluxo rastreável: indicador agregado → região/situação → pedido → parcela/carga → etapa/fatura. Demonstrar também uma pendência de assistência quando implementada, a data da publicação, o pipeline de origem e a evidência de conferência. Preparar capturas e explicações de contingência para ausência de acesso à rede, sem declarar dados antigos como atualização corrente.

## Priorização e conclusão do escopo

**Prioridade 1:** inventário, contrato semântico, pedidos/parcelas/cargas, previsão vencida, idade e correção dos rótulos atuais. Esta entrega torna o painel operacionalmente explicável.

**Prioridade 2:** etapas da carga, frete confirmado e assistências/recolhimentos com fontes disponíveis. Esses módulos ampliam a cobertura logística e sustentam as análises previstas no texto.

**Prioridade 3:** snapshots da carteira, conferência de carregamento e visão para TV quando existirem dados e necessidade. A série histórica exige coleta antecipada; sua estrutura poderá ser iniciada na etapa 3 mesmo que a tela seja entregue depois.

**Conclusão acadêmica obrigatória:** redação aderente, resultados, avaliação, referências conferidas, preparação das evidências e demonstração. Ela acompanha todas as prioridades. Se um dado essencial não estiver disponível, a decisão será implementar a fonte, redefinir o indicador com nome fiel ou revisar formalmente o escopo; nunca simular sua disponibilidade.

Entrega completa significa que cada requisito do escopo final possui implementação validada ou limitação explicitamente aceita e refletida no texto. Não significa cobertura integral de transporte, estoque, produção e toda a cadeia de suprimentos.

## Primeira entrega de implementação

A execução começará pelo inventário e por exemplos reais de pedidos sem carga, parcialmente alocados, em várias cargas e faturados parcialmente, quando existirem. Em seguida será produzido o dicionário com as definições de idade, previsão vencida e saldo sem carga, junto do desenho dos vínculos.

Depois dessa conferência, a primeira tela será **Pedidos e formação de cargas**, com saldos reconciliados e navegação para os detalhes. Etapas, frete e assistências virão apoiados em fontes confirmadas. Esta ordem evita construir gráficos sobre relacionamentos ainda ambíguos.

## Fontes do planejamento

- Parte escrita: `Parte Escrita/BUSINESS INTELLIGENCE APLICADO À LOGÍSTICA_ DESENVOLVIMENTO DE UM PAINEL ANALÍTICO PARA APOIO À TOMADA DE DECISÃO COM DADOS DE UM ERP.txt`.
- Pasta `NOTION`: referências de formação de carga, pedidos, frete, assistências, recolhimentos, conferência e acompanhamento de carga. Prints são referências de necessidade e apresentação; não comprovam campos ou regras da base atual.
- [Relação entre a implementação e o TCC](relacao-com-tcc.md), [evidências de validação](validacao-equivalencia.md), [mapa de revisão visual](mapa-paineis-validacao.md) e [configuração de extração](../etl/CONFIGURACAO_EXTRACAO_PEDIDOS.md).
- [Kimball Group — Fact Tables](https://www.kimballgroup.com/2008/11/fact-tables/): fundamentação para granularidade de fatos, snapshots periódicos e acompanhamento de processos.
- [SAP — Order Fulfillment On Time In Full by Order](https://help.sap.com/docs/SAP_BUSINESS_BYDESIGN/2754875d2d2a403f95e58a41a9c7d6de/2b67ce24cf0049de8bf31239ee329cce.html): referência primária para distinguir atendimento no prazo e completo de uma comparação exclusiva de datas de faturamento.
