# Revisão de arquitetura, organização e desempenho

Revisão de 02/10/2026 do projeto ativo `business-intelligence-logistica`: interface, stores, componentes analíticos, API, repositórios, cache, configuração de build, testes e fluxo de publicação do ETL. `legacy` e `Portal-Corporativo` continuam como referências; banco físico, credenciais, documentos do TCC e fontes Firebird foram preservados.

## Diagnóstico

A arquitetura existente separa apresentação, transporte HTTP, regras de negócio, acesso PostgreSQL e ETL. Essa separação é adequada ao projeto. Os maiores custos observados são o tamanho das respostas hierárquicas, a renderização de tabelas completas e o processamento repetido da mesma publicação. Uma troca de framework ou de banco não é necessária para tratar esses pontos.

O PostgreSQL possui publicação identificada por execução, transações de leitura consistentes, chaves primárias e integridade entre itens e alocações. O pool já é limitado a quatro conexões. As extrações continuam exclusivamente pelo Apache Hop; nenhuma otimização desta revisão altera SQL de cálculo, carga publicada, origem dos indicadores ou granularidade.

## Alterações implementadas

| Área | Problema observado | Alteração |
|---|---|---|
| Organização | Onze estilos globais diretamente em `src`, com ordem implícita de importação | Estilos em `src/styles`, com entrada única `index.css` e ordem explícita |
| CSS e rotas | Estilos globais de tabela carregados junto com componentes podem sobrescrever alturas ao navegar | Regras globais de tabela em `styles/analytic-table.css`, antes das personalizações; regras locais permanecem no componente |
| Domínio da interface | Funções puras de formação de carga estavam em um arquivo chamado `useLoadFormation`, sem composição Vue | Movidas para `src/domain/logistics/formation.ts` |
| Carregamento | Todas as páginas importadas no início | Rotas carregadas sob demanda; carregador assíncrono de gráficos compartilhado |
| Reatividade | Payloads grandes recebiam proxies profundos, apesar de serem substituídos como uma unidade | `shallowRef` para dashboard, dimensões e detalhes; filtros e estado editável continuam reativos |
| Mapa | Cada instância baixava e analisava novamente o GeoJSON de cerca de 2 MB | Registro do Brasil e promessa de download compartilhados em `src/charts/brazilMap.ts`; falhas permitem nova tentativa |
| Gráficos | Watch profundo de opções e redimensionamentos repetidos | Dependência pelo objeto calculado e redimensionamento agrupado em um frame |
| Tabelas | Comparador de idioma criado repetidamente e raízes ordenadas duas vezes | `Intl.Collator` compartilhado e ordenação única das raízes; filhos mantêm sua ordenação |
| Seleção e cálculos | Buscas lineares repetidas de pedidos, itens e vínculos | Índices `Map` locais, preservando sequência de acumulação e regras para medidas desconhecidas |
| Animações | Medição síncrona do retângulo de todas as linhas, inclusive fora da rolagem | Visibilidade das linhas delegada ao `IntersectionObserver`; efeitos continuam ao surgir na área visível |
| Navegação | Requisições antigas podiam terminar após abandonar a página | Cancelamento/invalidação das consultas da análise no desmontar |
| Logística na API | Cada filtro relia itens e alocações completos e recalculava respostas repetidas | Snapshot por publicação e cache de payload por publicação + filtros |
| Cache | Evicção podia remover trabalho pendente e duplicar consultas; limpeza podia ser anulada por conclusão antiga | Trabalhos pendentes separados, LRU dos resultados, TTL após conclusão e geração de invalidação |
| Arquivos gerados | Caches Python não constavam nas exclusões | `__pycache__` e bytecode adicionados ao `.gitignore` |

O cache logístico conserva até duas publicações por 30 minutos e seis respostas por cinco minutos. Toda requisição verifica a publicação ativa no PostgreSQL: uma publicação nova troca a chave imediatamente e uma indisponibilidade não é escondida por dados antigos. O contrato de resposta permanece igual.

## Medição com publicação real

Publicação: `061684fb-7343-43dc-b01a-f338b3e66d9c`. Sequência: quatro consultas sem filtro e duas com `uf=SP`, em processos locais novos, antes e depois da mudança. `scripts/benchmark-logistica.mjs` mede repositório, serialização JSON e hash da resposta; não mede HTTP, renderização do navegador ou ETL no modo `--repository`.

| Medida | Antes | Depois |
|---|---:|---:|
| Leituras completas de itens/alocações na sequência | 12 | 2 |
| Mediana das três repetições sem filtro, após a primeira consulta | 309,14 ms | 106,28 ms |
| Primeira consulta sem filtro | 447,37 ms | 457,25 ms |
| Segunda consulta com `uf=SP` | 62,07 ms | 1,95 ms |
| JSON completo sem filtro | 11.475.958 bytes | 11.475.958 bytes |

A mediana repetida caiu aproximadamente 65,6%. A primeira consulta não apresentou ganho nesta medição. Os hashes SHA-256 das respostas são iguais antes e depois, tanto no recorte completo quanto no recorte por UF. O tamanho é anterior à compressão HTTP, já existente na API.

Evidências locais privadas: `.local/performance-logistics-before.json` e `.local/performance-logistics-after.json`. Seus tempos incluem serialização e hash, mesmo que a descrição textual dos primeiros arquivos não enumere essas duas etapas. A descrição do script foi corrigida para explicitar isso.

O build passou de um arquivo de entrada JavaScript de 226,61 kB para entrada de 73,26 kB, mais um módulo compartilhado pré-carregado de 84,42 kB e módulos de rota. Esses números não representam redução de 67% de todo o JavaScript transferido: cada página ainda carrega suas dependências. O pacote assíncrono de gráficos continua próximo de 795 kB / 267 kB gzip.

## Organização resultante

```text
src/
  api/                    cliente HTTP e downloads
  charts/                 recursos compartilhados do ECharts
  components/             componentes de apresentação
  composables/            composição de estado e utilidades existentes
  domain/
    analytics/            ordenação pura de tabelas
    logistics/            seleção, medidas e destinos da formação
  router/                 páginas sob demanda
  stores/                 estado e coordenação de consultas
  styles/                 estilos globais em ordem explícita
  types/                  contratos TypeScript
  views/                  composição das páginas
api-server/
  domain/                 cálculos e validação de contratos
  repositories/           leituras consistentes no PostgreSQL
  app.js                  rotas e tratamento HTTP
  cache.js                cache assíncrono compartilhado
  server.js               inicialização e encerramento
etl/                      extração, transformação e publicação Hop
tests/                    equivalência, contratos, cache e interface
scripts/                  verificação e medições reproduzíveis
```

## Próximas melhorias, por prioridade

| Prioridade | Situação restante | Implementação proposta e critério de aceite |
|---|---|---|
| Alta | JSON de formação ainda tem 11,5 MB e repete as árvores em `rows` e `tree` | Contrato compacto versionado, com entidades de pedidos/itens/vínculos e referências. Comparar todos os recortes, totais, exportação e seleção antes de substituir o contrato atual |
| Alta | Sem paginação, todas as linhas e células continuam no DOM | Virtualização da área rolável preservando acesso a todos os registros, hierarquia, cabeçalho e rodapé fixos, seleção e exportação. Medir tarefas longas e navegação por teclado; não reintroduzir paginação |
| Alta | Cache limitado por quantidade de respostas, sem orçamento em bytes | Medir heap/RSS durante navegação longa entre áreas e filtros. Adicionar orçamento por tamanho se houver crescimento material; não reduzir cache sem comparar consultas ao banco |
| Média | Regras comerciais e opções de gráficos concentradas em módulos grandes | Extrair construtores por tipo de gráfico e serviços por análise, com as atuais referências reais como critério de equivalência |
| Média | Camada HTTP concentra parsing e rotas no `app.js` | Separar routers por módulo e parsing de contexto; preservar códigos de erro, validação e respostas existentes |
| Média | CSS ainda contém várias camadas históricas de sobrescrita | Consolidar por componente/token após comparar estilos computados em desktop e celular. A reorganização atual preserva essas regras; não é uma eliminação de toda a dívida de CSS |
| Média | Banco e ETL não foram perfilados integralmente nesta revisão | Coletar `EXPLAIN (ANALYZE, BUFFERS)` em consultas reais de leitura e tempos por etapa Hop. Propor índices somente a partir dos planos e verificar custo adicional da publicação |
| Média | Fonte Inter ainda tem dependência externa no shell | Avaliar distribuição local com licença e validação visual; Manrope já é local. Não trocar novamente a tipografia sem necessidade |
| Média | Não foi encontrado repositório Git no projeto ativo | Versionar código e contratos, excluindo banco físico, credenciais, runtimes e evidências privadas; adicionar CI com testes independentes e separar verificações que exigem publicação real |
| Baixa | Alguns utilitários puros ainda se chamam composables e há JS sem contrato estático no servidor | Padronizar nomes progressivamente e introduzir JSDoc/check de tipos por módulo, sem migração integral simultânea |

## Validação

O build TypeScript/Vite e 91 testes de domínio/API passaram nesta revisão. Foram acrescentados testes de invalidação, TTL, evicção concorrente, publicação logística, recuperação de falha e ordenação sobre pedidos reais. A navegação e o mapa possuem um teste específico em `tests/ui/architecture-performance.spec.ts`; o conjunto de navegador também verifica alturas, todos os registros, rótulos, seleção cruzada, loaders e movimento reduzido.

Dez cenários de interface foram exercitados. Na rodada conjunta, nove passaram e a seleção cruzada atingiu o limite global de 45 segundos ao limpar um filtro. A API permaneceu saudável. A repetição isolada, sem mudança no código da aplicação, passou em 25,6 segundos; navegação/mapa também passaram nessa repetição. A causa exata desse atraso não foi determinada. O limite da rodada de testes não foi aumentado para esconder a falha; a estabilidade em sessões longas continua sendo um ponto de acompanhamento.

Para separar artefatos quando houver outras execuções de navegador no mesmo workspace, use `--output .local/revisao-ui-results`. Os seis resultados da medição anterior/posterior também foram comparados com a API reiniciada por HTTP, com os mesmos hashes.

O aviso de tamanho do chunk de gráficos permanece visível no build e está registrado como melhoria futura. Nenhum resultado desta revisão comprova tempo de entrega ao cliente, adoção de rotina operacional ou redução de prazo logístico; as medições são técnicas da aplicação local.
