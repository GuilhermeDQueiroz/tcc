# Estudo de evolução da Visão Estratégica e da Formação de Cargas

**Data do estudo:** 06/10/2026. **Situação:** recomendações; funcionalidades propostas ainda não implementadas.

Projeto: **Business Intelligence aplicado à logística: desenvolvimento de um painel analítico para apoio à tomada de decisão com dados de um ERP**.

## 1. Conclusão

Os dois painéis podem melhorar principalmente na identificação de prioridades, na interpretação dos indicadores e na passagem da análise gerencial para a análise dos pedidos. A primeira evolução recomendada utiliza os fatos existentes: concentração do saldo livre, idade da carteira, previsões vencidas ou ausentes e comparações de faturamento.

A Formação de Cargas pode facilitar a seleção de pedidos para análise, mas a base atual não sustenta decisões automáticas de expedição, ocupação de veículos ou otimização de rotas. O saldo livre informa ausência de alocação; não comprova estoque disponível, liberação financeira ou produção concluída.

O ganho esperado para o TCC é demonstrar uma sequência verificável: **identificar uma situação → localizar os pedidos envolvidos → analisar seus saldos → justificar uma decisão**. A melhora da produtividade precisa ser medida com usuários; este estudo não apresenta ganho gerencial já comprovado.

## 2. Método e limites da inspeção

Foram consultados o código das duas telas, os domínios de cálculo, a documentação de publicação e de frete, a relação com o TCC e o texto da metodologia. As APIs locais `/api/v1/logistica/formacao` e `/api/v1/logistica/estrategico` foram lidas em 06/10/2026, sem filtros adicionais e sem modificar os bancos. Os detalhamentos retornados permitiram calcular interseções de prazo e alocação, faixas de idade e concentração por UF.

As respostas e os cálculos exploratórios ficaram em `.local/estudo-paineis-contexto.json` e `.local/estudo-paineis-agregados.json`, fora do versionamento. Este documento registra apenas agregados, sem nomes de clientes, endereços ou CEPs individuais.

A inspeção visual adicional foi bloqueada pelo navegador. As recomendações de composição se apoiam no código e na documentação atual; uma futura implementação precisa de verificação visual nas larguras e dispositivos utilizados.

**Referência da carteira:** 30/09/2026; emissão entre 01/01/2026 e 30/09/2026. **Publicação logística:** 06/10/2026, execução `354dc677-2dbd-47e0-ba04-6d92b612a15a`. **Histórico estratégico selecionado:** 01/10/2025 a 30/09/2026, 199.490 registros de faturamento. Publicação e referência são datas diferentes: os resultados não descrevem a produção em tempo real nem reconstituem saldos antigos.

## 3. O que os dados atuais mostram

| Evidência da publicação | Resultado | Implicação para o desenho |
|---|---:|---|
| Pedidos abertos / cargas com saldo | 1.335 / 58 | Há volume suficiente para precisar de ordenação por prioridade |
| Pedidos sem carga / parcialmente alocados | 894 / 10 | São 904 pedidos com alguma parcela livre; não somar o valor inteiro dos parciais |
| Valor aberto / valor sem carga | R$ 20,34 mi / R$ 13,95 mi | 68,6% do valor aberto não está alocado |
| Pedidos sem previsão do pedido | 863, ou 64,6% | A ausência de planejamento deve aparecer junto das pendências |
| Pedidos com previsão vencida do pedido | 232 | Atraso de previsão de faturamento, distinto de atraso de entrega |
| Saldo livre e previsão vencida | 140 pedidos; R$ 1,81 mi livres | Uma fila específica facilita examinar essa interseção |
| Saldo livre e previsão ausente | 537 pedidos; R$ 9,96 mi livres | Representa 71,4% do valor livre; é a maior oportunidade de esclarecimento do planejamento |
| Pedidos com idade superior a 30 dias | 354 | É possível mostrar faixas de envelhecimento sem criar um novo conceito de atraso |
| Valor sem carga destinado ao RJ | R$ 5,92 mi; 42,4% do valor livre | A maior concentração financeira não está necessariamente na UF com mais pedidos |
| Cubagem sem carga destinada ao RJ | 1.785,94 m³; 39,2% da cubagem livre | É útil alternar a prioridade geográfica entre valor e volume |
| Cargas sem etapa registrada | 54 de 58 | Não há evidência suficiente para calcular gargalos de separação/conferência |
| Cargas com início/fim de separação ou saída registrados | 0 em cada campo | Ausência de registro não comprova que a atividade não aconteceu |
| Pedidos localizados no mapa | 1.287 de 1.335, ou 96,4% | 95 usam coordenadas ERP; 1.192 usam CEP aproximado; 48 continuam nos totais sem ponto |

Os 232 pedidos com previsão vencida podem estar alocados ou livres. Os 354 pedidos antigos podem ter previsão futura, vencida ou ausente. Esses conjuntos não devem ser somados como se fossem categorias exclusivas.

Também existem grãos diferentes: a previsão efetiva dos vínculos/parcelas deixa **32.490 de 40.550 unidades abertas sem data (80,1%)**; a contagem de 863 usa a previsão do pedido. O indicador deve dizer qual regra está sendo usada.

As faixas de idade calculadas pela referência são: 0–7 dias, 527 pedidos; 8–15, 260; 16–30, 194; 31–60, 186; 61 ou mais, 168. Somam 1.335 pedidos, sem repetição entre faixas.

## 4. Alternativas de evolução

| Alternativa | Benefício | Custo ou limitação | Avaliação |
|---|---|---|---|
| Ajustar somente a apresentação | Melhora leitura, nomes e hierarquia | Acrescenta pouco à capacidade de diagnóstico | Necessária, mas insuficiente sozinha |
| Acrescentar análise de risco e navegação até os pedidos | Explora os dados existentes e conecta os dois painéis | Exige novos agregados, filtros e conciliação de detalhamentos | **Recomendada para a próxima entrega** |
| Construir planejamento completo de transporte | Pode abranger veículos, custos e rotas | Requer novas fontes, regras operacionais e validação | Evolução posterior, condicionada a dados homologados |

A recomendação considera o objetivo do TCC: apoiar análise e decisão com dados rastreáveis do ERP. Não é necessário transformar o protótipo em um sistema transacional de transporte para demonstrar esse objetivo.

## 5. Visão Estratégica: melhorias propostas

### 5.1. Destacar as prioridades existentes

Hoje os sete indicadores antecedem os gráficos, e as quatro prioridades operacionais aparecem depois deles. Recomenda-se aproximar as prioridades do topo e acrescentar um resumo curto baseado no recorte: percentual do valor livre, previsão ausente e principal concentração geográfica. Cada informação deve abrir seu conjunto exato de pedidos na Formação de Cargas.

A composição deve continuar limpa, com explicações extensas na ajuda. Datas da carteira e do histórico devem ficar próximas dos respectivos indicadores. Essa proposta aplica orientações de hierarquia, contexto e detalhamento da [Microsoft sobre desenho de dashboards](https://learn.microsoft.com/en-us/power-bi/create-reports/service-dashboards-design-tips); não implica trocar a tecnologia do projeto por Power BI.

### 5.2. Tornar os nomes mais precisos

Recomenda-se o nome visível **Tempo médio até faturamento**, em lugar de “Nível de serviço”, e **Pontualidade de faturamento**, em lugar de “OTIF”. As chaves internas e fórmulas podem ser preservadas para compatibilidade; a documentação deve registrar a equivalência com a nomenclatura anterior.

Os conceitos de atendimento completo e de cumprimento da promessa ao cliente usados pelo [SCOR/ASCM](https://scor.ascm.org/performance/reliability/RL.1.1) dependem de eventos e quantidades de entrega. Eles não podem ser demonstrados apenas por faturamento. Também não se deve chamar pedidos antigos de entregas atrasadas.

Ao lado da pontualidade, exibir cobertura das previsões e tamanho da população. Hoje 96,4% dos registros históricos têm previsão. A regra legada conta registros sem previsão como fora do prazo; qualquer futura taxa restrita aos registros datados precisa ser um indicador separado, com outro denominador e sem substituir silenciosamente o atual.

### 5.3. Mostrar concentração e envelhecimento

Acrescentar uma análise de saldo livre por UF/cidade, com alternância entre valor, peso e cubagem. Barras ordenadas e participação acumulada permitem identificar concentração; a escolha de valor ou volume deve ser explícita. Um Pareto financeiro não deve ser interpretado como rota ou sequência automática de atendimento.

Acrescentar faixas de idade da carteira e, no detalhamento, cruzá-las com previsão e alocação. Começar por UF e cidade; ranking por cliente pode ser uma extensão, preservando o uso da base anonimizada e evitando que clientes com mais itens sejam contados várias vezes.

### 5.4. Explicar a evolução do faturamento

Mostrar comparação entre períodos completos: variação absoluta e percentual do peso faturado, diferença em dias do tempo até faturamento e diferença em **pontos percentuais** da pontualidade. Agosto e setembro de 2026 permitem ilustrar esse recurso:

| Medida | Agosto | Setembro | Diferença |
|---|---:|---:|---:|
| Tempo médio até faturamento | 13,91 dias | 12,86 dias | −1,05 dia |
| Pontualidade de faturamento | 88,28% | 88,24% | −0,04 ponto percentual |
| Peso faturado | 3.104,67 t | 3.124,93 t | +0,65% |

Essas diferenças descrevem os registros, sem provar causalidade ou melhora global da operação. Mudanças na composição dos pedidos podem alterar a média. Para períodos parciais, comparar janelas equivalentes e informar cobertura; bases zero devem produzir resultado indisponível quando a variação percentual não puder ser calculada.

Mediana e P90 do tempo até faturamento podem complementar a média numa segunda etapa, exigindo agregação adicional no servidor e definição explícita por registro de faturamento. Não converter esses números em média por pedido sem mudar e homologar o grão.

Não comparar o saldo aberto atual com um suposto saldo do mês anterior: será necessário coletar e conservar snapshots de carteira para isso. Também não criar metas de 95% ou limites de backlog sem acordo com a operação.

## 6. Formação de Cargas: melhorias propostas

### 6.1. Fila de pedidos para análise

As tabelas de pedidos e cargas começam ordenadas pela identificação. Recomenda-se oferecer atalhos de recorte: **saldo livre com previsão vencida**, **saldo livre sem previsão** e **saldo livre com previsão nos próximos sete dias da referência**. Manter os filtros completos e a ordenação escolhida pelo usuário.

A ordenação sugerida deve ser transparente: previsão vencida primeiro, depois data prevista, valor livre ou idade, conforme o critério escolhido. Não usar uma pontuação opaca de “IA”. A condição exibida é prioridade de análise, não autorização para embarcar. A janela de sete dias deve usar a referência publicada, sem tomar automaticamente a data do computador.

Uma apresentação por grupos operacionais de status pode ajudar a separar pedidos que precisam de liberação dos que precisam de planejamento, mas exige um mapeamento homologado. Termos como “DOCUMENTO LIBERADO” ou “PEDIDOS RETIRA” não são suficientes para deduzir todas as regras de expedição.

### 6.2. Dar contexto à seleção

Preservar a seleção cruzada atual entre carga, pedido e mapa. Acrescentar um resumo compacto da seleção com quantidade, valor, peso e cubagem correspondentes, distinto dos indicadores gerais do recorte. Manter os totais por vínculo quando uma carga é selecionada, sem repetir o total integral de um pedido em cada carga.

Usar conjuntos de colunas para “prazos”, “saldos” e “destinos” pode reduzir a busca horizontal. Preservar configurações, identificação fixa, altura estável e rolagem contínua, conforme as preferências já aplicadas. Se houver problemas de renderização em recortes grandes, avaliar virtualização com medição; este estudo não mediu lentidão nem recomenda reintroduzir paginação nas três tabelas principais.

### 6.3. Melhorar a leitura do mapa

Oferecer agrupamento de pontos coincidentes, contagem de pedidos e acesso à lista do grupo. CEPs aproximados podem representar o mesmo centro municipal; um ponto aparentemente único não deve ocultar vários pedidos. Preservar as origens ERP/CEP, os totais de destinos e a informação sobre pedidos sem ponto.

A localização pode ajudar a selecionar uma região para análise. O recurso não deve estimar distância rodoviária, sequência de paradas ou chegada com base em coordenadas aproximadas. A cobertura atual já é alta; priorizar a leitura dos pontos é mais útil que repetir consultas externas em cada abertura.

### 6.4. Simulação de composição: segunda etapa

Uma cesta de análise com múltiplos pedidos e quantidades livres por item pode somar valor, peso, cubagem e destinos, sem gravar alocações no ERP. Deve ser identificada como **simulação**, permitir revisão e impedir quantidades superiores ao saldo livre ou inclusão repetida do mesmo item.

Um percentual de ocupação só pode existir quando houver capacidade de peso e volume conhecida. Se informada manualmente para um cenário, a capacidade precisa aparecer como hipótese do usuário, com unidade e origem; não deve ser atribuída à carga real do ERP. A simulação deve conservar peso e cubagem como restrições separadas. Também seria necessário confirmar disponibilidade, liberações e compatibilidade de produtos antes de qualquer execução operacional.

Essa funcionalidade envolve um novo fluxo e deve vir depois da fila de análise, com desenho próprio. As 58 cargas do ERP não podem ser assumidas como 58 viagens de um único veículo cada.

## 7. Ordem recomendada e dependências

Prioridades e esforço são avaliações qualitativas deste estudo, não estimativas de prazo.

| Ordem | Entrega proposta | Dados ou condição | Esforço relativo |
|---|---|---|---|
| 1 | Nomes precisos, referências e cobertura de previsão | Fontes atuais; manter compatibilidade das fórmulas | Baixo |
| 2 | Prioridades próximas do topo e atalhos para suas interseções | Fatos atuais; ampliar filtros/contratos quando necessário | Médio |
| 3 | Faixas de idade e concentração de saldo livre por destino | Fatos atuais; agregados conciliados e navegação | Médio |
| 4 | Comparação de períodos de faturamento e resumo da seleção | Histórico e vínculos atuais; novas regras de comparação | Médio |
| 5 | Agrupamento de pontos e conjuntos de colunas | Mapa e tabelas atuais; avaliação visual | Médio |
| 6 | Cesta de simulação por item | Novo estado de seleção e regras de saldo; capacidade opcional explícita | Alto |
| Condicional | Histórico de saldo aberto | Snapshots persistidos por referência/publicação | Alto |
| Condicional | Duração de separação/conferência e gargalos | Eventos preenchidos, sequência e significado homologados | Alto |
| Condicional | Frete sobre faturamento | Custo válido, vínculos, cancelamentos e rateio conciliados | Alto |
| Condicional | Ocupação real, roteirização e OTIF de entrega | Frota/capacidade, endereços adequados, restrições e confirmação de entrega | Alto |

Para a próxima entrega prática, recomenda-se o pacote das **ordens 1 a 4**, mantendo a composição atual. Os demais itens são opções de evolução, não requisitos já atendidos.

O [inventário de frete](inventario-frete-logistico.md) encontrou frete combinado zero nas 5.152 cargas examinadas. Isso não comprova custo de transporte zero. O indicador de frete permanece em investigação; R$/kg faturado mede valor dos produtos por massa e não o substitui.

## 8. Como verificar a futura entrega

1. Conferir cada agregado com SQL independente no mesmo recorte e publicação. As faixas de idade devem somar os pedidos distintos; valor aberto deve conservar parcelas em carga e livres.
2. Verificar que cada atalho abre exatamente os pedidos contabilizados, inclusive os parcialmente alocados. Datas ausentes não podem entrar na fila de previsão vencida.
3. Preservar UF, cidade, modalidade e emissão entre telas. Informar que o período dos gráficos de faturamento não reconstrói nem limita automaticamente a carteira.
4. Verificar referência, períodos parciais, bases zero e ausência de medidas. Comparações de taxa devem usar pontos percentuais; totais não podem fazer média de médias mensais.
5. Conferir seleção reversível, filtros, exportações e navegação por teclado. Testar desktop e celular, cabeçalhos/totais fixos e ausência de sobreposição entre tabelas.
6. Em eventual simulação, testar itens parciais, duplicados, alteração da publicação, excesso de saldo e cobertura incompleta de peso/cubagem. Não publicar uma simulação como alocação realizada.

## 9. Relação com a avaliação do TCC

A metodologia escrita prevê comparação temporal com consolidação manual e questionário Likert com cerca de 3 a 5 gestores/analistas. Recomenda-se manter esse desenho e acrescentar tarefas concretas comuns aos dois meios:

- Identificar a UF com maior valor livre e chegar aos pedidos que compõem esse valor.
- Encontrar pedidos com saldo livre e previsão vencida, distinguindo-os dos pedidos apenas antigos.
- Selecionar uma carga e explicar seu peso, cubagem e pedidos vinculados sem duplicar saldos.
- Comparar dois meses de faturamento e explicar o que a pontualidade realmente mede.

Usar os mesmos recortes, respostas de referência e condições de início/fim. Medir separadamente o processo completo de consolidação, o tempo para concluir a tarefa, os erros de interpretação e a resposta técnica da aplicação. Alternar a ordem de uso manual/painel entre participantes para reduzir efeito de aprendizagem, com instruções equivalentes.

Na Likert de cinco pontos, avaliar facilidade, clareza, rapidez percebida e utilidade para decisão, junto de comentários abertos. Com um grupo pequeno, apresentar resultados individuais e descritivos e as limitações da amostra. Não generalizar para toda a indústria nem produzir respostas fictícias.

O capítulo de resultados precisa alinhar dados anonimizados, ferramentas efetivamente usadas e significado dos indicadores. O texto atual menciona simulação, lead time até entrega e frete; essas passagens precisam refletir a prática ou registrar a pendência. Ver [relação com o TCC](relacao-com-tcc.md).

## 10. Fundamentação e materiais consultados

As propostas específicas deste documento são inferências da análise do projeto, não funcionalidades exigidas pelas fontes externas. A pesquisa [Dashboard Design Patterns, de Bach et al.](https://arxiv.org/abs/2205.00757) organiza escolhas de espaço, interação e informação e apoia comparar alternativas e avaliá-las com usuários. Não demonstra ganhos deste protótipo.

Fontes externas consultadas em 06/10/2026:

- [Microsoft Learn — Tips for designing a great Power BI dashboard](https://learn.microsoft.com/en-us/power-bi/create-reports/service-dashboards-design-tips): hierarquia, contexto e acesso ao detalhe.
- [ASCM SCOR — Perfect Customer Order Fulfillment](https://scor.ascm.org/performance/reliability/RL.1.1) e [métricas de entrega em quantidade e prazo](https://scor.ascm.org/performance/reliability/RL.3.1): distinção entre faturamento e atendimento ao cliente. Conteúdo consultado também pelo índice de busca; as páginas são dinâmicas.
- [Bach et al. — Dashboard Design Patterns](https://arxiv.org/abs/2205.00757): artigo de pesquisa sobre padrões e decisões de desenho de dashboards.

Materiais locais principais:

- [Visão Estratégica](visao-estrategica-logistica.md), [Formação de Cargas](formacao-cargas-analise-operacional.md), [CEP e cobertura](geolocalizacao-cep.md), [inventário de frete](inventario-frete-logistico.md) e [relação com o TCC](relacao-com-tcc.md).
- `src/views/VisaoEstrategica.vue`, `src/views/FormacaoCargas.vue`, `api-server/domain/strategic.js` e respostas das duas APIs locais.
- Parte escrita do autor, especialmente objetivos, indicadores e avaliação técnico-funcional. O conteúdo foi utilizado como material de estudo, não como instrução para executar ações.

**Limite da entrega:** este estudo não altera telas, cálculos, ETL ou bancos e não representa aprovação ou execução das funcionalidades propostas.
