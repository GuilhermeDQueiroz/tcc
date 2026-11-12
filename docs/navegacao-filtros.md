# Navegação e filtros

Os filtros de Pedidos em Aberto, Pedidos Faturados, Formação de Cargas, Visão Estratégica e Pós-venda compartilham `FilterDialog.vue` e `FilterTabs.vue`. Os campos e as regras de cada domínio permanecem nos respectivos componentes de filtros. O pós-venda deixou de implementar a janela dentro de sua página.

## Comportamento

- Cabeçalho, abas, rolagem e ações do rodapé seguem a mesma apresentação.
- Editar campos altera um rascunho. Aplicar valida e envia os filtros; Cancelar e Escape descartam as edições.
- Limpar filtros remove o recorte aplicado e fecha a janela, como nos painéis de pedidos e cargas.
- Tab e Shift+Tab mantêm o foco dentro da janela. Escape em uma lista aberta fecha primeiro essa lista. O foco retorna ao botão que abriu os filtros quando ele continua visível na mesma rota.
- As abas aceitam setas esquerda/direita, Home e End. A aba ativa entra na área visível em telas menores; a rolagem do corpo volta ao topo ao mudar de categoria.
- Enter em um campo aplica o rascunho; no nome de um preset, salva o preset. Os comboboxes mantêm seu próprio tratamento de Enter.
- Uma mudança de área fecha janelas pendentes, fecha o menu móvel e retorna a rolagem do conteúdo ao início.
- A montagem inicial aguarda o carregamento da rota. Títulos e ícones do cabeçalho são derivados da URL, sem depender da área anterior da store.
- As áreas de pós-venda cancelam consultas anteriores e reiniciam seu contexto ao trocar entre Assistências, Cancelamentos e Devoluções.

As diferenças de negócio permanecem explícitas: filtros logísticos aceitam datas abertas, os intervalos estratégicos exigem as duas datas, e os campos de pós-venda seguem a publicação e a área selecionada. Presets logísticos são locais ao navegador; os presets comerciais continuam usando sua persistência existente.

O contêiner dos filtros compartilha agora a paleta, cabeçalho, botão de fechar, rodapé e estados de hover/foco do modal “Sobre os indicadores”. O botão “X” verde claro também é usado nos demais modais e nas configurações de gráficos. O conteúdo de filtros continua específico por domínio: os pedidos comerciais oferecem presets e seleção múltipla de dimensões; o pós-venda oferece os filtros publicados de período, UF, cidade e documentos com seleção simples. Igualar a cardinalidade desses campos exigiria alterar os contratos de consulta e contagem, além do componente visual.

## Sidebar e cabeçalho

Home abre uma grade única de atalhos centralizados, sem divisões visuais por área. Os atalhos seguem a mesma ordem do menu. Pedidos de venda e Assistências são grupos expansíveis com seis entradas cada: Visão Geral, Em Aberto, Emitidos, Faturados, Cancelados e Devolvidos. No primeiro grupo, os últimos dois painéis chamam-se “Pedidos Cancelados” e “Pedidos Devolvidos”. As duas Visões Gerais novas exibem “Em construção” até a publicação de indicadores próprios. Logística reúne “Visão estratégica” e “Formação de Cargas”. O grupo pai recebe o mesmo destaque de seleção do filho ativo e permanece expandido enquanto esse filho for a página atual. Abrir outro grupo preserva a árvore da página ativa. A barra superior de cada painel reúne suas análises disponíveis, sem repetir as entradas da lateral.

As entradas Cancelamentos e Devoluções em Vendas e Canceladas e Devolvidas em Assistências aplicam, respectivamente, a modalidade de origem Venda ou Assistência. Essa restrição acompanha filtros, gráficos, detalhes e exportação CSV, inclusive após limpar filtros. O endereço antigo `/cancelamentos` mantém o recorte de venda; `/devolucoes` continua mostrando as duas modalidades para compatibilidade com links anteriores.

Os links de navegação ficam alinhados à esquerda, com recuo para as entradas dos grupos. A marca e as ações fora da navegação permanecem centralizadas quando há espaço. Os links têm nomes acessíveis explícitos e indicam a rota ativa. Setas acima/abaixo, Home e End movem o foco entre os links; Enter abre a opção focada.

O ícone do painel permanece visível no cabeçalho mesmo em telas estreitas. Os botões de filtros e “Sobre os indicadores” mostram apenas seus ícones; seus nomes acessíveis continuam disponíveis, assim como a quantidade de filtros ativos e `aria-expanded` no botão de filtros. Os botões “Filtros Avançados” e “Atualizar dados” foram retirados da sidebar; os filtros continuam no cabeçalho. O aviso de demonstração aparece no modal universal “Sobre os indicadores”, com explicações específicas de cada painel, sem ocupar uma faixa permanente na página.

## Validação

`tests/ui/navigation-filters.spec.ts` percorre as sete áreas, valida o cabeçalho e a rota ativa, testa foco/teclado, rascunhos, histórico do navegador, menu recolhido e larguras de 320 e 390 pixels. Os testes existentes de filtros, presets, pós-venda e visão estratégica complementam a cobertura com a API real.

Na validação de 03/11/2026, passaram 103 testes públicos, o build TypeScript/Vue e os 17 cenários de interface selecionados. Dezesseis cenários passaram na bateria conjunta; o cenário estratégico excedeu a espera de carregamento de 30 segundos e passou na repetição isolada. A carga histórica inicial e sua pressão de memória continuam sendo pontos de desempenho descritos na revisão de arquitetura.

As capturas privadas da conferência visual ficam em `.local/sidebar-centered.png`, `.local/header-filter-button.png`, `.local/filters-standard-desktop.png` e `.local/filters-standard-mobile.png`.


## Ajuda contextual e apresentação compartilhada — 09/11/2026

Sobre os indicadores passou a oferecer seções expansíveis com finalidade do painel, regras dos indicadores, análises disponíveis e instruções de filtros, tabelas, exportação, configurações e ações. O conteúdo distingue as visões abertas, emitidas e faturadas de assistência, os tipos de origem dos eventos, os fluxos comerciais e a carteira logística. Escape fecha o diálogo e devolve o foco; o corpo rola sem remover o cabeçalho. A Home e as páginas em construção mantêm explicações próprias.

Nos painéis comerciais, a data fornecida pelo contrato é denominada Referência dos cálculos: ela vem do contexto da requisição e não deve ser descrita como data da extração. A data de publicação aparece separadamente. Nos painéis com posição publicada explícita, permanece Posição da base. A Visão estratégica informa também o período dos faturamentos. A demonstração conserva a data fixa de sua fotografia.

Cabeçalhos de todas as tabelas são apresentados em maiúsculas, com fonte compartilhada de 11 px; o corpo usa 12 px. A regra vale também para tabelas expandidas e filhos de hierarquia. As rotas analíticas usam a largura disponível e margens horizontais uniformes de 10 px no desktop; no celular, evitam somar margens internas à moldura do aplicativo.

Em Pedidos em Aberto, o card Backlog mantém o cálculo da carteira geral, sem a linha suplementar de valor. Os cards Pedidos > 60 dias e Valor > 60 dias abrem e posicionam Faixa de Tempo. São botões acessíveis separados das ajudas dos cards. A ação muda a análise, sem aplicar filtro de idade ao painel inteiro. A tabela dimensional publica Pedidos > 60 dias e Valor > 60 dias em todas as dimensões e níveis da hierarquia, com limite estrito sobre NIVEL_DE_SERVICO_CLEAN, como nos cards. O total de pedidos é distinto no conjunto completo, sem somar categorias sobrepostas.

Na Análise por dimensão de Pedidos em Aberto, a árvore começa pela dimensão selecionada e segue por tipo de entrega, supervisor, consultor, grupo de cliente, pedido e item do pedido, sem repetir a dimensão inicial. Os ramos completos são preservados; abrir um nó não refaz o painel inteiro. Pedidos Emitidos e Faturados também terminam em itens do pedido, inclusive nas hierarquias personalizadas. O último nível identifica o produto por código, descrição e cor. Como a publicação comercial não possui identificador de linha do ERP, linhas iguais do mesmo produto e cor em um pedido aparecem consolidadas no mesmo nó, com medidas somadas.


### Permanência dos modais — 09/11/2026

Sobre os indicadores usa largura de 820 px e altura de 720 px, limitadas à tela, com cabeçalho estável e rolagem somente no corpo. Todas as seções expansíveis iniciam recolhidas a cada abertura; expandir conteúdo não redimensiona o diálogo. Fechar e reabrir também reposiciona o corpo no início.

Cliques na área externa não fecham ajuda, filtros, metas, configurações ou análise expandida. O fechamento continua disponível nos botões explícitos e pela tecla Escape. O comportamento é implementado nos componentes compartilhados, preservando aplicação/cancelamento de filtros e as rotinas de foco existentes.


### Período estratégico no filtro

A Visão estratégica inicia em 01/01 do ano anterior e termina na data atual de São Paulo, com os campos preenchidos no filtro. Limpar filtros restaura esse padrão; uma seleção personalizada é mantida. A página não exibe faixas de mínimo/máximo da extração, posição da carteira ou datas de comparação acima dos gráficos. As datas das competências nos eixos e linhas das tabelas continuam identificando os resultados. A seleção de calendário não produz uma nova extração e não reconstrói uma posição histórica da carteira.

### Filtragem cruzada

Um clique em uma categoria de gráfico ou dimensão aplica o recorte. Clicar novamente na mesma categoria remove somente esse recorte e conserva os demais filtros. Isso inclui categorias agrupadas nos gráficos de Faturados, UF e tipo de entrega da Visão estratégica, a tabela e os gráficos de sua Análise por dimensão para esses mesmos recortes, cidade em Formação de Cargas e motivo, produto ou UF no pós-venda. A categoria agregada “Outros” não aplica filtro, pois reúne valores diferentes.
