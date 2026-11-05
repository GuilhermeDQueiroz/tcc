# Estado do projeto e continuidade

Conferência em **05/11/2026**. Este documento registra uma fotografia da revisão, sem substituir a consulta atual aos processos, Git ou GitHub.

## Ambiente encerrado

A API/interface compilada (3002), o Vite (5173/5174) e o PostgreSQL exclusivo (5434) estão parados. `pg_ctl status -D banco/data` confirmou ausência de servidor, não foram encontrados processos de aplicação ou ETL identificados pelo caminho do projeto e as quatro portas estavam livres. O registro antigo `.local/runtime/processos.json` foi removido após conferir que as identidades registradas já não estavam ativas.

Firebird 3050 e PostgreSQL 5432 são serviços compartilhados da máquina e ficaram preservados. Não há justificativa para interrompê-los ao encerrar apenas este projeto.

Para iniciar novamente, configure as conexões locais descritas em [Reprodução](reproducao.md), inicie `banco/scripts/iniciar.ps1` e depois `scripts/iniciar-dev.ps1 -BancoJaIniciado`. O acesso aos dados continua exigindo as publicações reais existentes; o clone não inclui bancos ou credenciais.

## GitHub conferido

- Repositório público: [GuilhermeDQueiroz/tcc](https://github.com/GuilhermeDQueiroz/tcc), branch padrão `main`.
- Após `git fetch --prune origin`, `HEAD` e `origin/main` apontavam para `eac99865473b16bb7b8ab00e7d5d30112bf569ac`, sem commits locais à frente ou atrás.
- A última [execução da CI](https://github.com/GuilhermeDQueiroz/tcc/actions/runs/37459987278) terminou com sucesso para esse commit. Não foram encontrados pull requests ou issues abertos.
- As implementações recentes e esta atualização de documentação estão na árvore de trabalho, ainda sem commit e sem envio. A CI remota aprovada não valida essas alterações locais.

## Alterações locais a preservar

- Visão estratégica e conversão por safra, análise logística de faturados e painéis de assistência, cancelamento e devolução.
- Cache derivado antes do snapshot, cache de resultados de pós-venda, paginação compacta e remoção de árvores duplicadas no transporte de cargas.
- Filtros compartilhados, navegação/sidebar e padronização visual do pós-venda segundo Pedidos em Aberto.
- Catálogo comum de dimensões, hierarquias, medidas físicas e publicação complementar nativa Hop de atributos de pós-venda.
- Documentação de contratos, validação, limites e desempenho em `docs/`. Não descartar arquivos novos por ainda não estarem rastreados pelo Git.

## Datas e pendências

O período do pós-venda acompanha o filtro aplicado, limitado à cobertura publicada. Já a referência identifica a posição da base: idade, situação da previsão e saldo pendente não são automaticamente recalculados como uma fotografia histórica no fim do filtro. A interface ainda exibe “Período” e “Referência”. Melhorar os rótulos para “Período filtrado” e “Posição da base” permanece pendente; a conversa sobre datas não alterou as fórmulas.

Próximas melhorias técnicas: reduzir leitura inicial dos históricos completos com consultas/agregações PostgreSQL reconciliadas, virtualizar tabelas contínuas, dividir o módulo de gráficos e tornar a regeneração do ETL independente de pastas irmãs. Veja as medições e prioridades em [Desempenho e arquitetura](revisao-desempenho-arquitetura.md).

Resultados históricos citados em memórias do workspace, como 1.335 pedidos, 4.685 itens, 58 cargas, redução de 90–92,5% e avaliação com três colaboradores, precisam de evidências próprias e identificação do recorte antes de inclusão como resultado científico. As verificações técnicas recentes não comprovam essas conclusões gerenciais.

## Verificação desta revisão

O escopo desta revisão é encerramento, conferência Git/GitHub e atualização de exclusões, documentação e orientações. Testes públicos, build e inspeção de arquivos podem ser executados sem reiniciar o ambiente. As execuções anteriores com dados e navegador estão descritas nos documentos específicos; não representam uma nova validação com serviços ativos nesta revisão.

Resultados em 05/11/2026:

- **106 testes públicos aprovados**, incluindo rejeição de artefatos locais adicionados à força e preservação de contratos públicos.
- **TypeScript/Vue e build aprovados**. Permanece o aviso conhecido do chunk de gráficos de aproximadamente 795 kB minificado.
- Índice Git: **349 arquivos**, aproximadamente **4,53 MiB**, sem ocorrências nas regras verificadas. Esse índice ainda corresponde aos arquivos preparados anteriormente.
- Inspeção adicional da árvore de trabalho, incluindo arquivos novos não ignorados: **411 arquivos**, aproximadamente **4,94 MiB**, sem ocorrências nas mesmas regras. Foram conferidos **36 casos** de inclusão/exclusão no `.gitignore`, sem divergências. O relatório detalhado fica em `.local/repository-review-20261105.json`.
- `git diff --check` sem erros de whitespace; existem avisos de normalização CRLF/LF em arquivos já modificados.

Nenhum commit ou push foi realizado e nenhum serviço da aplicação foi iniciado para essas verificações. A política inspeciona regras explícitas de caminho, tamanho e credenciais; sua aprovação não substitui a revisão do conteúdo antes da publicação.
