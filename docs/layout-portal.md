# Correspondência visual com o Portal-Corporativo

A primeira interface da refatoração era uma adaptação. Após a revisão solicitada pelo usuário em 01/10/2026, o shell foi ajustado a partir dos arquivos reais do portal, sem modificar a referência.

| Elemento | Fonte do portal | Aplicação refatorada |
|---|---|---|
| Paleta e tipografia | src/assets/main.css, importado por src/main.ts | Inter, fundo #F4F6F4, texto #1A1A1A, verdes #006A3A/#8BC53F |
| Shell e rolagem | src/App.vue | Altura da janela, espaçamento externo de 10 px e rolagem dentro do conteúdo |
| Menu | components/layout/AppSidebar.vue | 240 px expandido, 72 px recolhido, drawer móvel de 256 px, grupo Faturamento |
| Marca | assets/Logo Salleto 2023_7.png | Cópia local do mesmo arquivo, src/assets/logo-salleto.png |
| Cabeçalho | components/layout/AppHeader.vue | 56 px, ícone do módulo, cantos de 16 px e sombra do portal |
| Cards | components/ui/MetricCard.vue e assets/main.css | Borda esquerda de 4 px, cantos de 16 px, rótulo em maiúsculas, valor em 24 px e sombra original |
| Abas | views/PedidosFaturados.vue e estilos dashboard-tab-* | Faixa branca distribuída na largura, seleção verde e borda inferior de 3,5 px |

Os estilos aplicados estão em src/portal-layout.css e o shell em src/App.vue. src/style.css do portal é um arquivo inicial do Vite que não é importado por sua aplicação; ele não foi usado como referência.

As três áreas e as 19 análises do legacy têm mais indicadores e comparações que os componentes do portal. A implementação dos cálculos foi confrontada com as funções originais; a disposição e os comportamentos de cada tela seguem em revisão. Esta correspondência descreve o padrão visual e os componentes comuns; não representa aprovação de cada tela. Cards com menos conteúdo não são esticados para ocupar a altura dos vizinhos.

Na revisão por painel, o resumo de Abertos passou a usar a composição de legacy/views/pedidos_em_aberto.py:472–886: duas linhas de cinco posições, backlog real/geral no mesmo card, calendário ao lado da previsão, evolução mensal de entrega/retirada, seus dois indicadores, mapa/status e uma dimensão ativa com configuração de gráfico e métrica. Os cards compactos desse resumo têm cantos de 10 px conforme o legacy; os cards gerais mantêm os 16 px do portal. A tabela inicia com 15 linhas por página e o nível de serviço segue a formatação decimal do código original. O [mapa de painéis](mapa-paineis-validacao.md) registra a sequência e as pendências.

Após as 14 correções do usuário, Abertos tem uma composição contínua, sem introdução nem guias de painel. O cabeçalho verde compartilha a ampulheta da sidebar; Emitidos usa carrinho e Faturados usa documento fiscal. Metas/filtros/atualização ficam na sidebar. AnalysisFrame concentra configuração e tela cheia; AnalyticChart concentra métrica, visualização, limite/Outros, ordenação, CSV, imagem e restauração em seu menu. AnalyticTable concentra colunas, expansão e CSV. Dimensões incorporam configuração de visualização/métrica/hierarquia e uma análise ativa, incluindo Faixa de Tempo e pesquisa consolidada. A expansão preserva os dados e as escolhas; Esc fecha e o foco retorna ao botão. Tooltips respondem a mouse/teclado. LoadingState é compartilhado pelos carregamentos, com animação reduzida conforme a preferência do sistema.

Não foram incorporados login, módulos adicionais nem dados demonstrativos do portal. Metas, filtros e atualização são ações da aplicação independente; o cabeçalho não exibe controles de usuário corporativo sem implementação.

tests/ui/layout-portal.spec.ts confere medidas e tokens computados no navegador, navegação móvel e preservação dos valores reais ao recolher o menu. A regressão foi observada com dois testes falhando antes da alteração e dois aprovados depois. A fonte Inter da interface mantém o carregamento Google Fonts do portal; sua disponibilidade depende da rede, com fallback sans-serif. Em 02/10/2026, por solicitação do usuário, os cards passaram a usar Roboto local com números tabulares, pesos 500/700 e ícones SVG de fundo relacionados ao indicador. Os arquivos WOFF2 e a licença SIL OFL estão em src/assets/fonts; src/metric-cards.css define as marcas d’água, sem interceptar cliques ou esconder tooltips. O backlog combinado usa a mesma fonte e uma ampulheta de fundo. A revisão de desktop/celular confirmou carregamento da fonte, dez ícones dos cards principais, tooltips e ausência de overflow horizontal; evidência .local/cards-appearance-verification.json.

Capturas finais ficam em tests/ui/screenshots. Como no portal, a página usa rolagem interna: a captura da janela mostra o trecho visível, não a extensão inteira de todas as análises. A validação funcional percorre também tabelas e gráficos fora do primeiro trecho visível.

Atualização em 02/10/2026: após solicitar outra opção de fonte, o usuário recebeu Manrope nos cards, substituindo a Roboto. Manrope é servida localmente por src/assets/fonts/manrope.css, com arquivos WOFF2 e licença SIL OFL. A interface restante mantém sua fonte anterior. Build/TypeScript e carregamento da Manrope na versão compilada foram conferidos; os dez ícones principais e a largura no desktop/celular foram preservados. Evidência: .local/cards-manrope-verification.json; capturas cards-manrope-desktop.png e cards-manrope-mobile.png na mesma pasta.

Na revisão posterior dos controles, o botão de configuração passou a exibir apenas um ícone discreto de ajustes, com nome acessível e indicação por hover/foco. O botão de dimensões fica na mesma linha do título; a faixa de dimensões ocupa sua própria linha. Tabela, barras horizontais/verticais, Pizza, Donut, Treemap e Evolução Mensal estão disponíveis no menu das dimensões. Pizza e Donut têm apresentações distintas; Donut usa a mesma consulta de distribuição do backend, preservando o agrupamento original.

Gráficos e suas tabelas usam a mesma área de visualização, incluindo tela cheia. As tabelas dos gráficos mostram os indicadores disponíveis nos registros reais, além da métrica selecionada. Nas dimensões, tabela e gráfico ocupam a mesma área; paginação fica dentro dessa seção. Quando há poucos registros, as linhas se distribuem pela altura disponível, com cabeçalho e totalizador compactos. A tabela de entrega com dois registros foi conferida no desktop, no celular e em tela cheia; contagens e totalizadores foram preservados. Evidências: .local/analysis-controls-verification.json e .local/table-filled-verification.json; capturas analysis-controls-table.png e table-filled-delivery.png.

O loading segue o código do legacy: anel verde de 56 px, giro de 0,75 s e fundo #F4F6F4, conforme legacy/assets/styles.css. Nas tabelas e visualizações, a cortina branca usa anel de 32 px e quatro linhas shimmer nas proporções 100%, 82%, 94% e 76%, conforme legacy/views/shared.py. LoadingState acompanha um sinal active persistente e mantém o feedback por no mínimo 2 segundos, inclusive em respostas imediatas, seguido de fade de 350 ms. Consultas e cálculos continuam sem atraso artificial no backend.

O conteúdo é preparado atrás da cortina e surge após sua saída, com cubic-bezier(0.22,0.61,0.36,1), deslocamento de 8 px e duração de 700 ms (850 ms nos cards). Os cards aparecem em sequência com intervalos de 35 ms, limitados a 210 ms; fill backwards mantém sua opacidade inicial durante a espera. Animações em andamento não reiniciam com eventos intermediários de renderização. O efeito se repete no conteúdo atualizado mesmo quando Vue reutiliza os elementos, nas trocas locais de tabela/gráfico e nos diálogos. Elementos fixos, menus de configuração e linhas de tabela usam apenas opacidade para preservar posição e altura. Na preferência de movimento reduzido, o surgimento usa somente opacidade, o shimmer fica desativado e o anel mantém um giro mais lento de 1,1 s. Essa regra prevalece sobre a redução global de duração do CSS. O feedback continua por no mínimo 2 segundos, com saída suave de 350 ms.

Build/TypeScript e cinco testes de interface passaram, incluindo filtros reais, dimensão, pesquisa, exportação e tela cheia. Na versão compilada da porta 3002, a duração foi aproximadamente 2,38 s, o viewport de dimensão permaneceu com 508 px durante o loading e os dois registros de entrega foram preservados. Evidências: .local/loading-effects-verification.json, .local/ui-loading-effects.log e capturas loading-legacy-screen.png/loading-legacy-table.png.

Na revisão seguinte, valores completos dos cards passaram a ajustar a fonte pela largura do próprio card e pelo número de caracteres formatados, sem truncar ou alterar cálculos. As comparações de Varejo e E-commerce ficam nos tooltips, acessíveis por mouse e teclado. O título do painel usa 16 px no desktop e 14 px no celular; Business Intelligence fica centralizado a 10 px do logo. A fonte atual dos cards é Inter, com valores de peso 800 e tamanho máximo de 26 px.

A sidebar tem dois separadores com o mesmo traço de legacy/assets/styles.css (1 px, #E5E7E6): um entre a marca/legenda e o menu, outro acima dos filtros. Ambos são recuados 20 px da borda externa. Última atualização mostra meta.publishedAt, proveniente do fim da carga Hop publicada, formatado em America/Sao_Paulo. Não usa o horário de abertura da página nem o de aplicação dos filtros. Ausência de metadata é exibida como traço, sem inventar um horário. A suíte interface-refinements verifica a correspondência entre o timestamp da API e o time da sidebar, título, espaçamento, menu e carregamentos. Quatro testes passaram; os dois testes de loading-effects também passaram.

Por solicitação explícita do usuário, src/assets/favicon-legacy.svg contém exatamente o SVG configurado como page_icon em legacy/dashboard.py. O mesmo arquivo é usado como favicon e como logo centralizado na sidebar, com 56 px no menu aberto e 40 px recolhido. A validação na versão compilada confirmou o mesmo endereço de asset para ambos e diferença de 0 px entre o centro do logo e o centro da sidebar. Valores foram conferidos nas larguras 1440, 1024, 902, 390 e 320 px, sem ultrapassar os cards nem gerar rolagem horizontal da página. Evidência: .local/card-fit-responsive-verification.json. Build e teste de identidade/ajustes passaram; os testes anteriores de loading e revisão de Abertos também passaram, usando dados reais.

Revisão dos filtros em 02/10/2026, a pedido do usuário para apoiar o trabalho
no Antigravity: FilterDrawer mantém o modal e a integração com Pinia;
useFilterDraft concentra rascunho, compilação, contadores e atalhos. MultiSelect
usa combobox/listbox reais, busca sem distinção de acentos, chips, teclado e
listas progressivas de 40 opções. Foram removidos controles invisíveis usados
apenas por testes e classes que imitavam o Streamlit.

Modal: Inter, título 16px/14px, campos 14px/rótulos 12px, fundo branco,
cabeçalho/rodapé #F4F6F4, bordas #E5E7E6, seleção #E2F2D9 e verde #006A3A.
Cantos 16px no modal e 10px em controles. Abas seguem os estados do projeto.
O corpo concentra a rolagem; ações permanecem visíveis no celular; dropdowns
abrem acima quando necessário. Loading limita-se ao corpo, com o componente
compartilhado e fade das opções, sem reiniciar a animação do modal inteiro.

Os contratos das bases Abertos/Emitidos não possuem data de faturamento;
esses filtros apresentam emissão. Em Faturados são apresentadas ambas as
datas e um seletor explícito do alvo dos atalhos, inicialmente faturamento
conforme o legacy. O atalho não altera as duas datas simultaneamente. Este mês
vai até hoje; ano é calculado; datas usam America/Sao_Paulo. Cancelar preserva
os filtros aplicados. Validam-se intervalos completos, datas/ordem e números
finitos; zero é válido. Carregar preset altera o rascunho e informa que aplicar
é necessário. Escape, navegação entre abas, contenção e retorno de foco foram
conferidos, inclusive ao ocultar a sidebar no celular.

Build/vue-tsc PASS. Seis cenários únicos validados: estilo/teclado/mobile,
períodos/validação/cancelamento, presets, respostas concorrentes e duas
regressões de loading. Cinco passaram em ui-filter-complete.log; a validação
de Faturados excedeu o prazo inicial de 12s para sua consulta real. Com espera
apropriada, os dois testes de filtros passaram em 41,2s em
.local/ui-filter-period-final.log. As capturas filter-aligned-desktop.png,
filter-aligned-390.png e filter-aligned-320.png estão em tests/ui/screenshots.
O repasse de código/estilo/regras está em docs/revisao-filtros-gemini.txt.
Não houve alteração em cargas, DW, métricas, cálculos ou fontes de referência.
