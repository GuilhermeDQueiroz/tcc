export interface IndicatorGuideSection {title:string;entries:{label:string;text:string}[]}
const section=(title:string,entries:[string,string][]):IndicatorGuideSection=>({title,entries:entries.map(([label,text])=>({label,text}))})
export function indicatorGuide(path:string,view:string,kind:string):IndicatorGuideSection[]{
 const tools=section('Filtros e recursos',[
  ['Filtros','Abra o funil, ajuste o recorte e aplique. O indicador de filtros e os marcadores da página mostram a seleção ativa. Limpar restaura o recorte inicial.'],
  ['Configurações das análises','O ícone de ajustes abre as opções disponíveis em cada análise: medida, visualização, colunas, exportação e expansão em tela cheia.'],
  ['Tabelas','Clique no cabeçalho para ordenar. Use a rolagem horizontal para ver outras colunas; nas tabelas com hierarquia, as setas abrem os níveis. O total considera a seleção inteira.'],
  ['Ajuda e atualização','O ponto de interrogação de cada card apresenta sua regra. Atualizar dados refaz a consulta da publicação disponível; não inicia uma extração do ERP.'],
 ])
 if(path==='/')return [section('Como navegar',[
  ['Pedidos de venda','Acompanhe demanda emitida, saldo aberto, faturamento e eventos de cancelamento e devolução.'],
  ['Assistências','Consulte assistências abertas, emitidas e faturadas, além de seus cancelamentos e devoluções.'],
  ['Logística','Use a Visão estratégica para acompanhamento dos resultados e a Formação de Cargas para consultar pedidos, alocações e destinos.'],
  ['Em construção','As visões gerais sinalizadas assim ainda não possuem indicadores. Os demais atalhos abrem os painéis disponíveis.'],
 ])]
 if(path.endsWith('/visao-geral'))return [section('Análises disponíveis', [['Navegação','Use os itens específicos do menu para consultar os painéis publicados. Esta página é uma identificação de funcionalidade em construção.']])]
 if(path==='/abertos')return [section('Indicadores e cálculos',[
  ['Valor, peso, volume e itens','Somam somente o saldo ainda aberto no recorte. Peso é mostrado em toneladas e volume em metros cúbicos.'],
  ['Pedidos e grupos aguardando','Contam pedidos e grupos de clientes distintos; vários itens não representam vários pedidos.'],
  ['Nível de serviço','Média dos dias dos registros abertos na referência de cálculo; indica o tempo da carteira, não o prazo de uma entrega concluída.'],
  ['Backlog','Valor total aberto dividido pelo faturamento médio diário da base de 90 dias. Mostra dias equivalentes de faturamento; sua cor segue as faixas do projeto.'],
  ['Pedidos e valor > 60 dias','Contam pedidos distintos com registros acima de 60 dias e somam o saldo desses registros. Exatamente 60 dias não entra nesse recorte.'],
 ]),section('Análises e ações do painel',[
  ['Evolução e faixas de tempo','A evolução agrupa o saldo atual pelo mês de emissão. As faixas distribuem esse mesmo saldo por tempo em aberto; não são fotografias de saldos de meses anteriores.'],
  ['Previsão de faturamento','O calendário apresenta os saldos por previsão. Clique em uma data para consultar os pedidos daquele dia. Previsão vencida e ausência de previsão aparecem separadamente.'],
  ['Entrega, situação e mapa','Compare modalidades, status e concentração da carteira por UF. Os gráficos usam as medidas disponíveis em suas configurações.'],
  ['Análise por dimensão','Troque entre mês, previsão, UF, região, status, consultor, cliente e produto. A árvore começa pela dimensão escolhida e segue por tipo de entrega, supervisor, consultor, grupo de cliente, pedido e produto/cor. A troca carrega somente essa análise. As colunas de pedidos e valor > 60 dias seguem a regra dos cards.'],
  ['Atalhos dos cards','Clique em Pedidos > 60 dias ou Valor > 60 dias para abrir Faixa de Tempo. Essa ação muda a análise; não aplica automaticamente um filtro de idade ao painel inteiro.'],
  ['Pesquisa','A aba Pesquisa de Pedidos oferece consulta e filtros próprios para examinar os documentos da carteira.'],
 ]),tools]
 if(path==='/estrategico')return [section('Indicadores e cálculos',[
  ['Valor','Soma dos valores faturados no período selecionado. O valor do card não representa a carteira em aberto.'],
  ['Peso, volume, itens, pedidos e grupos','Os cards mostram médias mensais do período, incluindo competências sem movimento. Pedidos e grupos são contados distintos em cada mês.'],
  ['Ticket médio e R$/TON','Ticket é faturamento dividido pelas unidades faturadas. R$/TON é faturamento dividido pelo peso em toneladas. São razões dos totais, não médias simples das razões mensais.'],
  ['Nível de serviço e OTIF','Nível de serviço mede o tempo médio de emissão até faturamento por registro. O OTIF deste projeto mede faturamento até a previsão; sem previsão conta como fora do prazo. Não comprova entrega física nem atendimento integral.'],
  ['Conversão','Pedidos emitidos que tiveram algum faturamento no próprio mês, inclusive parcial, divididos pelos pedidos emitidos. Usa competências completas e é ponderada por pedidos.'],
  ['Escoamento','Faturamento dividido pela entrada de pedidos em R$ no mesmo intervalo. Inclui faturamento de pedidos antigos e pode superar 100%.'],
 ]),section('Análises e recursos do painel',[
  ['Comparativos anuais','Os selos dos cards comparam janelas equivalentes do último ano disponível e do ano anterior. O número principal continua usando todo o período filtrado. Sem base anterior positiva, o selo não aparece. Queda no nível de serviço em dias é favorável; para os demais valores, aumento é favorável.'],
  ['Período inicial','O filtro começa em 01/01 do ano anterior e termina hoje, pelo horário de São Paulo. Você pode escolher outro intervalo; ele não será reduzido às datas com registros. A consulta utiliza a publicação disponível.'],
  ['Evoluções','Acompanhe peso, itens, pedidos, grupos, prazos, ticket, OTIF, escoamento e R$/TON. Nas configurações de Peso, escolha meses, semanas ou dias.'],
  ['Conversão por mês','O gráfico por emissão usa janelas de 7, 15 e 30 dias após o fim do mês. Essas janelas são diferentes da conversão no próprio mês apresentada no card.'],
  ['Tabela de evolução mensal','Primeira aba da Análise por dimensão. As linhas mostram os resultados de cada mês, incluindo conversão, escoamento e R$/TON. O total é recalculado e não soma percentuais ou contagens que se repetem. Quantidades mensais diferem das médias dos cards.'],
  ['Dimensões e mapa','O mapa soma faturamento por UF. A análise dimensional detalha os faturamentos; conversão e escoamento estão disponíveis em UF, cidade e modalidade de entrega. Trocar dimensão carrega apenas essa análise.'],
 ]),tools]
 if(path==='/cargas')return [section('Indicadores e interpretação',[
  ['Carteira e backlog logístico','Carteira é o saldo dos pedidos nos status Documento em Carga, Logística, Faturado Parcial e Documento Liberado. Backlog divide esse saldo pelo faturamento médio diário dos últimos 90 dias até a posição publicada. As cores indicam as faixas de acompanhamento: abaixo de 15 dias, crítico baixo; de 15 a menos de 25, atenção baixo; de 25 a menos de 35, ideal; de 35 a menos de 45, atenção alto; a partir de 45, crítico alto. A seleção de um pedido ou carga não altera esses dois cards, que representam o conjunto filtrado.'],
  ['Cargas em aberto','Conta cargas distintas com saldo nos vínculos publicados. Uma carga com vários pedidos não deve ser contada várias vezes.'],
  ['Saldo em carga e sem carga','Mostram a parcela alocada e a parcela livre dos pedidos. Alocação não comprova estoque pronto, faturamento, saída ou entrega.'],
  ['Medidas físicas','Peso e cubagem correspondem às quantidades pendentes do recorte, nas unidades indicadas. Preço ou medida ausente pode tornar um resultado indisponível.'],
 ]),section('Como explorar a formação',[
  ['Pedidos e cargas','As duas tabelas mostram pedidos/itens e cargas/vínculos. Expanda as setas para percorrer a hierarquia.'],
  ['Seleção cruzada','Selecione um pedido ou carga para recortar seus vínculos na tabela complementar e no mapa. Limpe a seleção para voltar ao conjunto filtrado.'],
  ['Destinos','O mapa e o detalhamento por UF/cidade mostram os destinos disponíveis. Pontos derivados de CEP são aproximações e têm origem identificada.'],
 ]),tools]
 if(['/assistencias','/cancelamentos','/devolucoes'].includes(path)){
  const origin=kind==='Assistência'?'assistências':'pedidos de venda'
  const event=path==='/cancelamentos'?'cancelamento':'devolução'
  const assistance=path==='/assistencias'
  return [section('Indicadores e cálculos',assistance?[
   ['População',view==='faturadas'?'Itens com quantidade faturada acumulada na posição publicada. O filtro e a evolução mensal usam a emissão da assistência, não a data de cada parcela faturada.':view==='emitidas'?'Assistências emitidas no período, inclusive atendidas, canceladas e itens sem valor comercial.':'Assistências com saldo pendente na posição publicada, inclusive atendimentos parciais. O período seleciona a emissão.'],
   ['Valor e medidas físicas','Multiplicam a quantidade correspondente à visão pelo preço e pelas medidas unitárias disponíveis. Esses valores não representam o custo da assistência.'],
   ['Documentos e grupos','Contam assistências e grupos de clientes distintos. Itens e parcelas de um documento não são novos documentos.'],
   ['Tempo e previsão','Na carteira aberta, o tempo mede a idade dos registros até a posição publicada. Os indicadores > 30 dias usam limite estrito; a situação da previsão é apresentada separadamente.'],
  ]:[
   ['População',`Eventos de ${event} de ${origin}, inclusive parciais. O período seleciona a emissão do documento do evento.`],
   ['Quantidade e valor',`Usam a quantidade da parcela de ${event} e o preço unitário do item original. Não somam novamente o saldo cumulativo do documento.`],
   ['Documentos de origem','Contam vendas ou assistências distintas afetadas. Documentos de evento são identificados separadamente.'],
   ['Prazo e > 30 dias',`O prazo vai da emissão do documento original até o ${event}. Registros sem datas válidas não entram na média; continuam nos totais gerais. O limite > 30 dias é estrito.`],
  ]),section('Análises e recursos do painel',[
   ['Evolução e dimensões','Compare períodos, UFs, produtos, motivos, clientes e demais atributos disponíveis. Use as configurações para escolher medidas e visualizações.'],
   ['Detalhamento','A tabela de registros permite examinar os eventos ou itens. Paginação altera as linhas visíveis; os totais e a exportação consideram a seleção completa.'],
   ['Carregamento local','As trocas dimensionais e a navegação dos detalhes atualizam suas próprias áreas, preservando o restante do painel.'],
   ['Limites',assistance?'Faturamento e saldo não comprovam entrega nem conclusão do atendimento. Selecionar uma emissão antiga não reconstrói o saldo que existia naquela data.':path==='/devolucoes'?'Um registro de devolução no ERP não comprova recolhimento físico nem representa automaticamente crédito fiscal.':'Este painel acompanha cancelamento de pedidos, inclusive parcial; não é um painel de notas fiscais canceladas.'],
  ]),tools]
 }
 return [section('Indicadores e leitura do período',[
  ['População',path==='/emitidos'?'Pedidos emitidos no período selecionado; indicam a entrada de demanda.':'Registros faturados no período selecionado; indicam processamento comercial e físico no faturamento.'],
  ['Totais e contagens','Valor, peso, volume e itens representam as medidas do evento. Pedidos e grupos são contados conforme o recorte; não some contagens repetidas em categorias diferentes.'],
  ['Prazo',path==='/emitidos'?'Emissão não comprova faturamento, expedição ou entrega.':'Tempo e pontualidade usam emissão, faturamento e previsão disponíveis. Faturamento não comprova entrega ao cliente.'],
 ]),section('Análises e recursos do painel',[
  ['Períodos e comparações','As abas disponíveis oferecem leituras semanal, mensal, evolução e geografia. Confira os intervalos indicados antes de comparar os resultados.'],
  ['Dimensões e clientes','Use os atributos e hierarquias disponíveis para localizar as categorias que explicam os resultados. Taxas e contagens distintas exigem totais recalculados.'],
  ['Filtros e tabelas','O período se aplica à data do evento do painel. Colunas, ordenação, exportação e expansão são acessadas nas configurações de cada análise.'],
 ]),tools]
}
