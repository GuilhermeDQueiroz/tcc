# Orientações para agentes — parte prática do TCC

Este repositório contém a aplicação de BI logístico de Guilherme Diniz Queiroz. Em uma cópia dentro do workspace TCC, observe também o `AGENTS.md` da pasta superior. Este arquivo acompanha o clone e concentra as instruções técnicas; registros privados em `.agents/` ou `.local/` não são necessários para compilar ou executar testes públicos.

## Arquitetura e fontes

- Fluxo: cópia Firebird anonimizada → Apache Hop → PostgreSQL 18 → API Express → Vue 3/Pinia/ECharts. Node.js 24, conforme `.nvmrc`. PostgreSQL exclusivo em `localhost:5434`, banco `dados`.
- O ETL é separado da aplicação. Requisições HTTP consultam publicações PostgreSQL; nunca iniciam extração ou consultam diretamente o Firebird.
- Preserve a granularidade e os vínculos originais, valores zero legítimos e medidas desconhecidas como indisponíveis. Não gere registros simulados para preencher o painel. Pequenos casos controlados de testes não são evidências empíricas.
- Publicações comercial, logística e pós-venda são versionadas. A revisão de `posvenda.dimensoes` também participa do `dataVersion`; não altere fatos financeiros para enriquecer atributos.

## Datas, fórmulas e evidências

- O período aplicado filtra emissão/evento e é limitado à cobertura da publicação. No pós-venda, `meta.start/end` informa esse intervalo efetivo; `referenceDate` informa a posição da base.
- Assistências em aberto representam saldo pendente na referência publicada, selecionado pela emissão. Filtrar um mês anterior não reconstrói o saldo ao fim daquele mês. Idade e situação da previsão usam a referência publicada. Para outra regra, defina o contrato e a fonte histórica antes de mudar cálculos.
- No pós-venda, o modal “Sobre os indicadores” apresenta “Período filtrado” e “Posição da base”. As definições estão em `docs/paineis-posvenda.md`.
- Não apresente faturamento como entrega física, valor de assistência como custo, ou devolução como recolhimento comprovado. Consulte o dicionário e as regras de negócio em `docs/`.
- Volumetrias, tempos e resultados de avaliação precisam de fonte, recorte, método e data. Documentos antigos do workspace não bastam para afirmar ganhos gerenciais ou avaliação concluída. Testes técnicos e tempos HTTP não comprovam produtividade dos gestores.

## Interface e desempenho

- Use Pedidos em Aberto como referência de estilo, espaçamento, carregamento e organização para Assistências, Cancelamentos e Devoluções; preserve suas análises operacionais específicas.
- `shared/analysis-dimensions.json` define ordem e ícones comuns. `posvenda-dimensions.js` agrega medidas e hierarquias. Preserve contagens distintas e o agrupamento “Outros” sem perda de medidas.
- Filtros usam `FilterDialog.vue`, `FilterTabs.vue` e drawers por domínio. Preserve rascunho/aplicação, validação, teclado, foco, Escape e comportamento móvel. Rotas estão em `src/router/index.ts`.
- Consulte caches derivados antes de carregar snapshots. Inclua publicação, filtros e contexto na chave, limite retenção e compartilhe consultas simultâneas. Não aumente caches de históricos completos sem medir memória.
- No pós-venda, paginação recorta detalhes, mantendo totais de toda a seleção; CSV exporta a seleção completa. Respostas parciais de análise/detalhes preservam os demais gráficos. Não imponha paginação às tabelas contínuas sem revisar seu contrato.
- A árvore logística evita duplicação JSON por `treeFromRows`; a store reconstrói o alias. Preserve esse contrato nos consumidores.

## Execução e validação

```powershell
npm ci
npm test
npm run build
npm run check:repository
```

`check:repository` inspeciona o índice Git, não todas as alterações da árvore de trabalho. Confira também arquivos novos antes de preparar o commit. Classifique novos testes em `scripts/test-suites.mjs`. Testes reais e de navegador precisam das publicações e evidências indicadas no guia de reprodução. Não inicie serviços só para conferir documentação.

Para iniciar: `scripts/iniciar-dev.ps1 -BancoJaIniciado` após preparar o banco. Para parar: `scripts/parar-dev.ps1` e `banco/scripts/parar.ps1`. O primeiro encerra apenas os processos registrados pelo launcher. Inspecione instâncias adicionais pelo caminho do projeto, identidade do processo e portas; nunca encerre todos os processos Node/Python/PostgreSQL da máquina. Firebird 3050 e PostgreSQL 5432 podem atender outros projetos.

## Git e continuidade

- Preserve alterações já existentes. Inspecione `git status`, diff e remoto antes de trabalhar; não descarte mudanças nem envie arquivos privados para tornar testes verdes.
- Não versione `.env`, bancos, dumps, logs, screenshots privados, runtimes, credenciais ou metas reais. Preserve `.env.example`, contratos, SQL e workflows públicos. `AGENTS.md` é público; `.agents/` permanece local.
- Atualize documentação junto de contratos e fórmulas. Não faça commit, push ou reinicie serviços como efeito de uma simples conferência de estado.
- Estado e pendências da revisão de 05/11/2026: `docs/estado-projeto.md`. Arquitetura/desempenho: `docs/revisao-desempenho-arquitetura.md`. Layout/filtros: `docs/navegacao-filtros.md`. Pós-venda: `docs/paineis-posvenda.md` e `docs/dimensoes-posvenda.md`.
