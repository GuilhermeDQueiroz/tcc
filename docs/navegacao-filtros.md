# Navegação e filtros

Os filtros de Pedidos em Aberto, Pedidos Faturados, Formação de Cargas, Visão Estratégica e Pós-venda compartilham `FilterDialog.vue` e `FilterTabs.vue`. Os campos e as regras de cada domínio permanecem nos respectivos componentes de filtros. O pós-venda deixou de implementar a janela dentro de sua página.

## Comportamento

- Cabeçalho, abas, rolagem e ações do rodapé seguem a mesma apresentação.
- Editar campos altera um rascunho. Aplicar valida e envia os filtros; Cancelar, Escape e o fechamento pela área externa descartam as edições.
- Limpar filtros remove o recorte aplicado e fecha a janela, como nos painéis de pedidos e cargas.
- Tab e Shift+Tab mantêm o foco dentro da janela. Escape em uma lista aberta fecha primeiro essa lista. O foco retorna ao botão que abriu os filtros quando ele continua visível na mesma rota.
- As abas aceitam setas esquerda/direita, Home e End. A aba ativa entra na área visível em telas menores; a rolagem do corpo volta ao topo ao mudar de categoria.
- Enter em um campo aplica o rascunho; no nome de um preset, salva o preset. Os comboboxes mantêm seu próprio tratamento de Enter.
- Uma mudança de área fecha janelas pendentes, fecha o menu móvel e retorna a rolagem do conteúdo ao início.
- A montagem inicial aguarda o carregamento da rota. Títulos e ícones do cabeçalho são derivados da URL, sem depender da área anterior da store.
- As áreas de pós-venda cancelam consultas anteriores e reiniciam seu contexto ao trocar entre Assistências, Cancelamentos e Devoluções.

As diferenças de negócio permanecem explícitas: filtros logísticos aceitam datas abertas, os intervalos estratégicos exigem as duas datas, e os campos de pós-venda seguem a publicação e a área selecionada. Presets logísticos são locais ao navegador; os presets comerciais continuam usando sua persistência existente.

## Sidebar e cabeçalho

Os grupos de ícone e texto ficam centralizados nas opções da sidebar e nas ações do rodapé, incluindo o menu recolhido. Os links têm nomes acessíveis explícitos e indicam a rota ativa. Setas acima/abaixo, Home e End movem o foco entre os links; Enter abre a opção focada.

O botão de filtros do cabeçalho é horizontal, mostra a quantidade de filtros ativos e informa seu estado aberto por `aria-expanded`. O botão da sidebar abre o mesmo contexto.

## Validação

`tests/ui/navigation-filters.spec.ts` percorre as sete áreas, valida o cabeçalho e a rota ativa, testa foco/teclado, rascunhos, histórico do navegador, menu recolhido e larguras de 320 e 390 pixels. Os testes existentes de filtros, presets, pós-venda e visão estratégica complementam a cobertura com a API real.

Na validação de 03/11/2026, passaram 103 testes públicos, o build TypeScript/Vue e os 17 cenários de interface selecionados. Dezesseis cenários passaram na bateria conjunta; o cenário estratégico excedeu a espera de carregamento de 30 segundos e passou na repetição isolada. A carga histórica inicial e sua pressão de memória continuam sendo pontos de desempenho descritos na revisão de arquitetura.

As capturas privadas da conferência visual ficam em `.local/sidebar-centered.png`, `.local/header-filter-button.png`, `.local/filters-standard-desktop.png` e `.local/filters-standard-mobile.png`.
