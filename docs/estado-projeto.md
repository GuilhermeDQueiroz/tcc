# Estado do projeto e continuidade

## GitHub e demonstração Vercel — 12/11/2026

As alterações dos painéis, ETL, testes e código da demonstração foram enviadas para `main` no commit `41ad5d2`. A fotografia demonstrativa foi reexportada a partir do PostgreSQL exclusivo, com posição em 30/09/2026, e publicada no projeto Vercel `tcc-bi-logistica`. A publicação respondeu 200 nas rotas `/`, `/estrategico`, `/assistencias` e `/demo/manifest.json`. Validação anterior ao envio: 143 testes públicos, build comum, quatro testes de navegador da demonstração e inspeção do índice Git (452 arquivos, sem ocorrências nas regras verificadas). A fotografia e o pacote permanecem em `.local/`, fora do Git.

## Detalhamento e seleção na Formação de Cargas — 10/11/2026

A tabela de cargas expande carga → grupo de cliente → pedido → produto/cor; a tabela de pedidos expande pedido → produto/cor. A seleção em ambas atualiza os cards: uma carga considera somente suas parcelas alocadas, enquanto um pedido considera seu saldo completo. Repetir a seleção limpa o recorte cruzado. A publicação logística foi refeita da cópia Firebird anonimizada com grupo e cor: 4.685 itens, 1.335 pedidos, 2.125 vínculos e 58 cargas; os totais preservaram a versão anterior. Compilação, 141 testes públicos e teste de navegador da interação passaram. Detalhes das regras em [Formação de cargas](formacao-cargas-analise-operacional.md).

## Desempenho e cards — 09/11/2026

Pedidos em Aberto e Visão estratégica preenchem duas linhas de cards em telas largas, com valores em tamanho uniforme e grade responsiva nos demais tamanhos. O carregamento de tela deixou de impor dois segundos mínimos de indicador. Na API, a leitura inicial estratégica usa apenas os campos necessários ao painel; a Análise por dimensão busca seus atributos detalhados quando solicitada. A análise por safra reduz cópias e trabalho repetido sem mudar o JSON do painel padrão. A medição e seus limites estão em [Desempenho e arquitetura](revisao-desempenho-arquitetura.md). Alterações locais ainda sem commit.

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

## Continuidade — demonstração para apresentação (05/11/2026)

Após a conferência acima, foi autorizado criar uma demonstração estática para apresentação. O modo `demo` reaproveita as telas e os módulos de cálculo, usando uma fotografia real anonimizada com posição em **30/09/2026**. Os comandos de exportação, build e empacotamento estão em [Demonstração](demonstracao.md). A aplicação normal continua usando sua API.

As fotografias e os pacotes ficam em `.local/`, sem inclusão no Git. O exportador registra publicações e hashes, e omite CEP e coordenadas individuais da logística. As telas iniciais são pré-calculadas; filtros adicionais são processados em um Web Worker com as publicações compactadas. Metas/presets da demonstração são temporários à aba. A pesquisa comercial usa as colunas compactas exportadas.

O PostgreSQL exclusivo 5434 foi iniciado temporariamente para exportação e conferência de paridade, depois encerrado. A API 3002 e o Vite 5173/5174 não foram iniciados. A verificação da demonstração usa um servidor estático próprio; nenhum serviço compartilhado é encerrado. Os resultados detalhados de paridade e navegador ficam em `.local/demo-real-parity.json` e `.local/demo-browser-verification.json`, quando a respectiva verificação termina com sucesso. Não houve commit ou push dessa implementação.

Validação desta implementação: 110 testes públicos aprovados, dois testes de navegador demonstrativo aprovados, sete comparações de paridade de indicadores/séries/totais com a aplicação real e navegação adicional de filtros em Faturados, Visão Estratégica e Formação de Cargas. O pacote estático foi publicado temporariamente na Vercel e teve rotas e consulta do worker conferidas na hospedagem. O prazo e o link de transferência são privados e pertencem à saída da publicação; a permanência depende de o autor vinculá-la à sua conta. Esses testes são verificações técnicas, não medição de ganho gerencial.

## Preparação de commit e publicação de produção — 05/11/2026

O código da demonstração foi revisado e preparado no índice Git, sobre o commit `e19e19b` já existente. Não foi criado outro commit nem realizado push nesta preparação. Os 110 testes públicos e o build demonstrativo passaram; a inspeção do índice verificou 427 arquivos sem ocorrências nas regras do repositório. Fotografias, pacotes, credenciais e metadados `.vercel/` permanecem fora do Git. O pacote permite no upload somente `index.html`, `vercel.json`, `assets/` e `demo/`.

Após autenticação da conta do autor, foi criado o projeto `tcc-bi-logistica` e publicado o pacote em produção: [tcc-bi-logistica.vercel.app](https://tcc-bi-logistica.vercel.app). O endereço de produção substitui o link temporário inicial. A publicação é feita pelo pacote local; a integração automática com o GitHub não foi configurada, pois o repositório público não inclui a fotografia dos dados.

O upload final foi conferido pelo dry-run do CLI: 62 arquivos estáticos, aproximadamente 23,85 MB. As rotas `/abertos` e `/assistencias` e a troca de granularidade das assistências passaram no navegador sem autenticação Vercel. O relatório privado está em `.local/demo-permanent-verification.json`.

## Continuidade — visões de assistência e Home (05/11/2026)

A navegação local organiza Vendas e Assistências em grupos expansíveis. Assistências inclui Em Aberto, Emitidas, Faturadas, Canceladas e Devolvidas. A Home traz atalhos para as análises existentes, data local e ícones coerentes entre menu, cartões e cabeçalhos. Os títulos dos painéis usam os mesmos nomes das entradas do menu. Essas mudanças ainda **não** estão no endereço de produção acima.

O workflow nativo do Apache Hop publicou nova versão de pós-venda com referência em 30/09/2026; a etapa complementar de dimensões também terminou. `scripts/verificar-posvenda.py` reconciliou origem Firebird, PostgreSQL e API para visões abertas, emitidas e faturadas, cancelamentos e devoluções. A API separou 2.039 parcelas de cancelamento de assistência e 23.923 de venda. O relatório privado está em `.local/posvenda-verificacao.json`. Uma fotografia estática nova foi exportada em `.local/demo/`, sem dados sintéticos.

O build comum e os testes públicos passaram, e o layout da Home foi inspecionado em desktop e celular. O build demonstrativo, a suíte completa de navegador, o pacote atualizado e a republicação Vercel seguem pendentes: o sandbox recusou o acesso ao arquivo do Web Worker no build local e a revisão automática necessária para executar essa etapa fora do sandbox informou falta de créditos. Não houve commit nem push desta continuidade. API e PostgreSQL exclusivo foram encerrados; serviços compartilhados não foram tocados.

## Estado mais recente — navegação, verificação e republicação (05/11/2026)

As pendências do parágrafo anterior foram retomadas e concluídas. O PostgreSQL exclusivo 5434, a API 3002 e a interface Vite estão ativos para teste local; a interface solicitada pelo autor está em `http://127.0.0.1:5180/`. Os serviços Firebird 3050 e PostgreSQL 5432 compartilhados não foram encerrados. Antes de parar o ambiente, confira as identidades em `.local/runtime/processos.json` e `.local/runtime/interface-5180.json`.

O workflow nativo Apache Hop publicou a fotografia de pós-venda na posição de 30/09/2026. A reconciliação de leitura Firebird → PostgreSQL → API passou para assistências abertas, emitidas e faturadas, cancelamentos e devoluções; o relatório privado está em `.local/posvenda-verificacao.json`. A demonstração foi exportada da publicação real anonimizada, sem dados sintéticos.

A Home mostra 14 atalhos centralizados em uma grade única. Os grupos expansíveis são “Pedidos de venda”, “Assistências” e “Logística”. Os dois primeiros seguem a ordem Visão Geral, Em Aberto, Emitidos, Faturados, Cancelados e Devolvidos; as duas novas Visões Gerais exibem “Em construção”. A visão estratégica existente passou para Logística. Cabeçalhos mantêm o ícone em telas estreitas; filtros e informações usam botões só com ícone. O aviso de demonstração e as regras específicas de interpretação estão no modal “Sobre os indicadores” de cada página, incluindo a Home.

Verificação final: 115 testes públicos, 3 testes demonstrativos de navegador contra o build estático, build TypeScript/Vue e `git diff --check` aprovados. O dry-run selecionou somente 66 arquivos estáticos (24.120.098 bytes). O pacote `.local/apresentacao-f176884f78f4/` foi publicado em produção na Vercel como `dpl_8Y2zr8RASnq8bNq9QD2cXSiD3amC`: [tcc-bi-logistica.vercel.app](https://tcc-bi-logistica.vercel.app). A URL pública e as rotas `/abertos` e `/assistencias` responderam HTTP 200; o HTML corresponde ao asset compilado do pacote. A integração automática com GitHub continua não configurada. As mudanças locais ainda não foram commitadas nem enviadas ao GitHub.

## Ajuste visual dos modais — 05/11/2026

O modal compartilhado de filtros foi alinhado ao modal “Sobre os indicadores” em cores, bordas, cabeçalho, sombra e rodapé. Os botões de ação, abas e presets receberam estados de hover, pressão e foco mais claros. O botão de fechar verde claro com “X” passou a ser compartilhado pelos modais de filtros, indicadores e metas, além das configurações e da visualização expandida dos gráficos. O ícone de filtro permanece no cabeçalho.

A estrutura visual é comum, mas os campos continuam específicos: pedidos comerciais oferecem presets e seleção múltipla; pós-venda publica seleção simples para UF e cidade. O build comum e o demonstrativo passaram. A inspeção local em 390 px confirmou modal e rodapé dentro da tela, sem rolagem horizontal. O pacote `.local/apresentacao-8145f00e936f/` (66 arquivos, 24.121.879 bytes) foi publicado como `dpl_E4YwWcUfkXum5pb9ua2yKnffFG6W`; a URL de produção respondeu com os assets do novo pacote. O serviço local em `http://127.0.0.1:5180/` permaneceu ativo para teste.

## Backlog logístico e execução local — 09/11/2026

Por solicitação do autor, o projeto foi iniciado em `http://127.0.0.1:5173/`, com API na porta **3003** e PostgreSQL exclusivo na **5434**. A porta 3002 já estava ocupada por um serviço não identificado como este projeto, que foi preservado. A interface usa um launcher privado que encaminha `/api` para 3003; o registro atualizado fica em `.local/runtime/processos.json`. Os serviços compartilhados 3050 e 5432 foram preservados.

A Visão Geral de Logística agora tem cinco cards: Backlog logístico, Nível de serviço, OTIF, Conversão no mês e Escoamento. Cargas em aberto aparece na Formação de Cargas, reaproveitando a contagem distinta de `logistica.loads`, sem duplicá-la. Valor em carga, Peso em aberto e Pedidos > 30 dias foram retirados da Visão Geral.

O backlog apresenta coberturas Logístico e Geral em dias, situação e valor da carteira logística. O recorte de status e as faixas de cor seguem o legacy; o denominador mantém os 90 dias corridos terminados na posição publicada e os filtros comuns. Definição completa em [Visão Estratégica de Logística](visao-estrategica-logistica.md). A conferência SQL de leitura reconciliou as coberturas e a contagem de cargas na referência de 30/09/2026; não houve nova extração nem mudança nos fatos publicados. Os relatórios e screenshots permanecem privados em `.local/`.

Validação: 117 testes públicos, build TypeScript/Vue e quatro testes de navegador aprovados, incluindo cards, filtros, cores, erro de publicação, Formação de Cargas e layout em 390 px. Alterações locais sem novo commit, push ou publicação na Vercel.

Na sequência de 09/11/2026, o autor solicitou retirar também as seções Prioridades da carteira e Conversão da safra de pedidos da Visão Geral, incluindo cards, gráfico, tabela comparativa, botões e textos do rodapé. O atalho de Faturados para a safra foi removido. Os cinco cards principais e gráficos logísticos permanecem; os contratos de cálculo da API foram preservados.

Correção de escopo na mesma sequência: o gráfico de linha da conversão por safra foi mantido, com séries de 7, 15 e 30 dias e alternância de medida. Os cards, tabela, bases emitidas e textos continuam removidos.

O agrupamento Meses/Semanas/Dias de Toneladas faturadas passou para Configurações → Tipo de análise, com seleção por rádio. O espaço dos controles acima do gráfico foi eliminado.

As medidas Valor/Peso/Cubagem/Pedidos da linha de conversão também foram movidas para Configurações → Tipo de análise. Os dois gráficos usam o mesmo slot de configurações compartilhado.

Os ícones dos cards de Formação de Cargas e Visão Geral de Logística seguem o padrão de Pedidos em Aberto: marcas de fundo de 78 px com recuo de 12 px no desktop, 62 px com recuo de 10 px no celular; ajuda de 24 px com símbolo de 16 px, ancorada no canto superior direito sem variar com o conteúdo do card. O tooltip continua relativo ao card.

O painel passou a se chamar Visão estratégica no menu, Home, cabeçalho e filtros. Os cards principais agora se chamam Média de conversão no mês e Média de escoamento mensal, exibindo apenas seus percentuais. Subtítulos e detalhamentos desses dois cards foram retirados; fórmulas e bases em `meta.flow` foram preservadas.

A separação de backlog foi refinada: Visão estratégica calcula e apresenta somente o logístico; Pedidos em Aberto apresenta somente o card Backlog geral, com dias, valor total da carteira e situação calculada sobre a cobertura geral. Os filtros real/geral do calendário continuam sendo recortes operacionais próprios. Os cards compartilham a mesma apresentação e não exibem o par de dias anterior.

## Ampliação da Visão estratégica — 09/11/2026

A Visão estratégica reúne 12 cards: Backlog logístico, Carteira logística, Nível de serviço, OTIF, Média de conversão mensal, Média de escoamento mensal, Média R$/kg faturado, Toneladas faturadas, Média toneladas por mês, Qtd. itens por mês, Qtd. pedidos por mês e Grupos atendidos por mês. O valor da carteira saiu do card de backlog e passou a um card próprio. A apresentação reutiliza `overview-metrics`, com o mesmo padrão de Pedidos em Aberto, conferido no navegador: altura mínima de 122 px, preenchimento de 14 px, raio de 16 px e sombra compartilhada.

Os cards de itens, pedidos e grupos usam médias mensais, conforme escolha explícita do autor. Pedidos e grupos são contados distintos em cada mês, e as competências sem movimento participam do denominador. R$/kg é faturamento total dividido pela massa total. A série de escoamento calcula faturamento/entrada de cada competência e preserva resultados acima de 100%; o card continua usando a razão dos totais do mesmo período. Títulos dos gráficos em maiúsculas e paleta verde, verde-claro e amarelo seguem a referência visual enviada.

A Análise por dimensão oferece 18 recortes dos faturamentos, tabela paginada com exportação completa e visualizações configuráveis. Os totais de contagens e razões são recalculados para toda a seleção. Os atributos adicionais são lidos apenas da fonte de faturados da publicação comercial existente; os emitidos mantêm a projeção reduzida. Não foi executado ETL nem alterado fato financeiro. A dimensão participa do cache derivado, mantido com limite de oito resultados; as retenções de históricos não foram ampliadas. A revisão observou 431,6 MiB de memória residente e 1.439,0 MiB privados na API após o exercício dos painéis, medida pontual sem comparação causal com versões anteriores.

Verificações: 120 testes públicos, build TypeScript/Vue e cinco testes de navegador aprovados; conferência SQL independente dos 12 cards, séries mensais, escoamento por competência e agregados por UF aprovada. A posição continua em 30/09/2026 e o histórico padrão observado vai de 01/10/2025 a 30/09/2026, com 199.492 registros faturados. Os relatórios e capturas ficam em `.local/`. API 3003, interface 5173 e PostgreSQL exclusivo 5434 permanecem ativos. Nenhum commit, push ou publicação Vercel foi realizado nesta ampliação.

## Complementação das análises do print — 09/11/2026

O autor solicitou retirar o card Toneladas faturadas, incluir Volume e Ticket médio e remover “Média” dos títulos dos cards. O painel agora tem 13 cards. Volume é a cubagem faturada total dividida pelas competências do filtro, sem mudança na regra de média mensal. Ticket médio é faturamento dividido pela quantidade de itens faturados, conforme confirmação explícita do autor; não representa valor por pedido. Suas fórmulas ficam na ajuda dos cards. Na consulta padrão de 01/10/2025 a 30/09/2026, Volume apresentou 5.641,63 m³ por mês e Ticket médio R$ 486,23 por item.

As análises complementares incluem evolução mensal e acumulada do faturamento por ano, comparação acumulada de R$/ton, evolução mensal do ticket, tabela mensal com participação e diferença frente ao ano anterior, mapa de calor com cruzamento e medida configuráveis e análise dimensional ampliada para 21 recortes, incluindo Status do Pedido, Família e Cor. Permanecem as evoluções físicas, prazos, escoamento e conversão já solicitadas. Títulos gráficos em maiúsculas; cores verde, verde-claro e amarelo; estilo dos cards compartilhado com Pedidos em Aberto.

As comparações anuais usam o ano final do filtro contra o mesmo intervalo do anterior e explicitam as datas comparáveis. Nesta publicação, o início disponível foi 06/01/2025: o comparativo padrão foi limitado a 06/01–30/09 em 2026 e 2025. Isso não altera o intervalo dos cards nem da tabela mensal. Diferenças sem cobertura anterior suficiente permanecem indisponíveis, inclusive no total quando parte do período anterior não está coberta. Categorias presentes somente no ano anterior continuam na comparação dimensional. R$/ton e ticket são razões dos totais acumulados, sem somar médias. As colunas dos fatos publicados foram preservadas; não houve ETL nem alteração financeira.

Verificação: 123 testes públicos aprovados, build TypeScript/Vue aprovado, cinco testes de navegador aprovados após ajustar as asserções às camadas de canvas do mapa de calor. SQL independente reconciliou os 13 cards, as séries mensais, ticket, Volume, comparativos anuais, acumulados, R$/ton e células do mapa de calor. Inspeção visual em desktop e 390 px concluída, sem alteração do estilo de Pedidos em Aberto. Relatórios e capturas continuam em `.local/`; nenhum commit, push ou publicação Vercel foi realizado.

A ordem visual dos cards da Visão estratégica passou a acompanhar os equivalentes de Pedidos em Aberto: Carteira logística (valor), Toneladas por mês (peso), Volume, Qtd. itens por mês, Qtd. pedidos por mês, Grupos atendidos por mês, Nível de serviço e Backlog logístico. Os indicadores exclusivos seguem depois: Ticket médio, OTIF, Conversão mensal, Escoamento mensal e R$/kg faturado. A ordenação também vale para os placeholders durante a carga. Apenas apresentação alterada; build aprovado.


## Nomes dos cards, sequência dos gráficos e mapa por UF — 09/11/2026

Os cards passaram a se chamar Peso, Qtd itens, Qtd pedidos, Grupos atendidos e R$/KG. O termo “por mês” saiu dos títulos dos cards; suas médias mensais e as demais fórmulas foram preservadas, com explicação nas ajudas. As evoluções existentes seguem a ordem dos cards correspondentes. A conversão por safra permanece com suas janelas de 7/15/30 dias; comparativos anuais e entrega/retirada aparecem depois das evoluções associadas aos cards.

O MAPA DE FATURAMENTO substituiu o mapa de calor na tela: mapa geográfico do Brasil com faturamento agregado por UF, no período filtrado. A seleção da análise dimensional não muda esse agrupamento. Registros com UF inválida ou ausente ficam em aviso separado; estados sem registros ficam neutros. O contrato anterior de mapa de calor permanece na API para compatibilidade, sem controles na interface. Não houve extração nem alteração dos fatos publicados.

Validação: 124 testes públicos e build aprovados; dois testes de navegador aprovados, incluindo nomes, sequência, filtros, mapa e layout móvel. A conferência SQL somente leitura reconciliou o mapa por UF e os 13 cards na mesma publicação, para 01/10/2025–30/09/2026. Captura privada em `.local/strategic-billing-map.png` e relatório em `.local/strategic-real-verification.json`. Interface 5173, API exclusiva 3003 e PostgreSQL 5434 permanecem ativos. Nenhum commit, push ou publicação foi realizado.


## Títulos e apresentação das tabelas estratégicas — 09/11/2026

Os cards foram simplificados para Conversão e Escoamento. Os gráficos agora usam NÍVEL DE SERVIÇO POR MÊS, OTIF POR MÊS, ESCOAMENTO POR MÊS, R$/KG POR MÊS e CONVERSÃO POR MÊS · VALOR, com o sufixo da conversão acompanhando a medida selecionada. Na instrução que mencionava tanto “EVOLUÇÃO” quanto “CONVERSÃO POR MÊS · VALOR” para o mesmo gráfico, foi aplicada a última denominação explícita. As janelas de conversão e as fórmulas dos indicadores foram preservadas. Os três comparativos anuais voltaram ao início da área de gráficos.

As tabelas mensal e dimensional receberam apresentação compartilhada e exclusiva da Visão estratégica: paginação no topo, cabeçalhos em maiúsculas, primeira coluna fixa, linhas alternadas, barras de participação e variações sinalizadas por cor e seta. O total fica destacado e visível na área de rolagem. A dimensão UF usa coluna estreita; nomes mais longos têm largura própria. A análise dimensional inicia com 13 colunas principais e mantém as demais nas configurações. Mês é ordenado pela competência cronológica. Paginação, seleção de colunas, CSV e totais completos foram preservados.

Validação: 124 testes públicos, build TypeScript/Vue, política do índice Git e diff sem erros. Dois testes de navegador passaram; o teste de evolução foi repetido após incluir a conferência da ordenação cronológica, paginação e colunas adicionais. A inspeção final em desktop e 390 px confirmou cabeçalhos, colunas fixas, total dentro da área rolável e ausência de rolagem horizontal na página. Capturas privadas `.local/strategic-report-final-monthly.png`, `.local/strategic-report-final-dimensions.png` e `.local/strategic-report-final-mobile.png`. API 3003 e interface 5173 seguem ativas. Nenhuma extração, commit, push ou publicação foi realizada nesta alteração.


## Dimensão estratégica com estilo e carga local de Pedidos em Aberto — 09/11/2026

A ANÁLISE POR DIMENSÃO da Visão estratégica passou a compartilhar as regras visuais da tabela de Pedidos em Aberto: fonte, espaçamento, cores, primeira coluna fixa, total verde e altura da área rolável. A apresentação anterior de relatório paginado foi retirada somente dessa seção; a tabela mensal mantém sua própria apresentação. As dimensões usam rolagem contínua, sem paginação, preservando colunas configuráveis, seleção de visualização e CSV.

A troca de dimensão chama o contrato parcial `section=analysis`. A API calcula e retorna somente os agregados dimensionais, usando as mesmas regras de seleção e cobertura anterior da consulta completa. Cards, evoluções, comparação anual e mapa não são recalculados nem substituídos. O cache continua com oito entradas compartilhadas, sem ampliar retenção de históricos. A demonstração suporta a mesma requisição. A store mantém carregamento, erro, cancelamento e sequência próprios da análise; recusa respostas de outra publicação, oferece nova tentativa local e não aplica respostas ultrapassadas ao painel.

Validação: 125 testes públicos, build, política do índice e diff sem erros; dois testes de navegador aprovados, incluindo resposta parcial, preservação das instâncias dos cards/gráficos durante a troca, erro local e recusa de publicação diferente. A comparação visual automatizada confirmou igualdade das propriedades de tabela com Pedidos em Aberto, incluindo viewport de 438 px no desktop de 1440 × 1000. Layout em 390 px conferido, sem rolagem horizontal da página. Capturas privadas `.local/strategic-dimension-shared-desktop.png` e `.local/strategic-dimension-shared-mobile.png`. Interface 5173 e API 3003 permanecem ativas. Nenhuma extração, alteração de fatos, commit, push ou publicação foi feita.


## Cobertura das métricas, padronização e ajuda dos painéis — 09/11/2026

A evolução mensal estratégica passou a apresentar R$/KG, Conversão e Escoamento. A conversão usa pedidos distintos emitidos e faturados no próprio mês, somente em competências completas; o escoamento preserva a razão entre os fluxos do mesmo intervalo. O resumo do período reproduz os 11 indicadores de desempenho dos cards, incluindo médias mensais de peso, volume, itens, pedidos e grupos e razões ponderadas pelos seus denominadores. Carteira e backlog têm uma tabela própria por UF, com posição publicada e base de 90 dias, sem produzir saldos históricos. Na análise dimensional, R$/KG é visível por padrão; conversão e escoamento aparecem apenas em UF, Cidade e Tipo de entrega. Origens emitidas sem faturamento permanecem na base; as taxas gerais são recalculadas, sem somar percentuais de categorias. A troca continua carregando apenas a análise dimensional.

Pedidos em Aberto recebeu as colunas Pedidos > 60 dias e Valor > 60 dias nos agregados dimensionais e na hierarquia. A regra é estrita sobre o mesmo nível de serviço dos cards; o total de pedidos é distinto sobre a seleção completa. O card Backlog conserva a cobertura geral, foi renomeado e perdeu a linha de valor da carteira. Os dois cards > 60 dias abrem e posicionam a análise Faixa de Tempo por botões acessíveis, sem aplicar um filtro global de idade.

Todas as tabelas usam cabeçalhos em maiúsculas com 11 px e corpo com 12 px, inclusive em visualizações expandidas. As rotas analíticas passaram a usar largura disponível e margens horizontais uniformes; em telas largas os cards estratégicos podem usar cinco colunas. Os modais Sobre os indicadores têm seções expansíveis próprias por painel, explicando finalidade, fórmulas, análises, filtros, configurações, exportação, seleção cruzada e limites de interpretação. A ajuda distingue posição publicada de referência dos cálculos: nos painéis comerciais, o contrato traz a referência da requisição e a data de publicação é mostrada separadamente. Nenhuma data de extração é inferida a partir do relógio da aplicação.

Validação: 129 testes públicos, build TypeScript/Vue, política do índice Git e diff sem erros. Cinco testes de navegador passaram, incluindo os oito painéis analíticos, tipografia, largura, modais e foco, novos atalhos, métricas, recusa de publicação divergente e carregamento local. A conferência SQL somente leitura reconciliou os 13 cards, conversões por mês, R$/KG e resumo sobre a publicação de 199.492 registros faturados no recorte 01/10/2025–30/09/2026. A conferência API comparou as novas colunas de Faixa de Tempo com os cards: 298 pedidos e R$ 4.684.560,14 no recorte padrão consultado, sem tratá-los como volumetria definitiva do TCC. Capturas privadas `.local/dashboard-final-*.png` cobrem desktop 1920 px e celular 390 px; relatório SQL em `.local/strategic-real-verification.json`. API 3003, interface 5173 e PostgreSQL exclusivo 5434 seguem ativos. Não houve ETL, alteração de fatos publicados, commit, push ou publicação nesta continuidade.

## Período automático e permanência dos modais — 09/11/2026

A Visão estratégica inicia o filtro em 1º de janeiro do ano anterior e termina no dia atual, calculado no fuso America/Sao_Paulo. Em 09/11/2026, o intervalo inicial é 01/01/2025–09/11/2026. A última orientação do autor substituiu o encerramento em anos completos pelo encerramento em hoje. A escolha manual é preservada, sem ajustar silenciosamente suas extremidades às datas disponíveis na extração; o reset restaura o período automático. O período automático é atualizado ao carregar o painel. A publicação e a maturidade das safras continuam limitando o que foi efetivamente observado, sem inferir faturamentos após a posição da base.

Foram retiradas da página as faixas de datas sob os cards e acima dos comparativos anuais, além das seções RESUMO DO PERÍODO · MESMAS MÉTRICAS DOS CARDS e CARTEIRA LOGÍSTICA ATUAL com suas explicações. Os agregados de resumo e carteira permanecem no contrato da API por compatibilidade. As datas selecionadas ficam no filtro; a ajuda mantém a distinção entre seleção e posição publicada.

Sobre os indicadores passou a ter largura de 820 px e altura de 720 px, limitadas pela tela, com rolagem interna. Cada abertura recolhe todas as seções e retorna ao início do conteúdo. Cliques externos deixam abertos os modais de indicadores, filtros, metas e análises expandidas, assim como as configurações dos gráficos. Os controles explícitos de fechamento e Escape continuam disponíveis.

A inspeção das consultas da publicação comercial confirmou corte inicial em 01/01/2025: emitidos por DOCUMENTO_FATURA.DTEMISSAO_DOCFAT; faturados por ENTREGA.DTEMISSAO_DOCFAT (DT_FATURA). Essas consultas não definem limite superior explícito. Na publicação consultada, os faturados disponíveis vão de 06/01/2025 a 30/09/2026; emitidos começam em 01/01/2025 e contêm datas futuras anômalas, incluindo 30/03/3015. O snapshot estratégico limita a emissão à referência publicada de 30/09/2026. Não foi executada extração nem correção desses registros.

Validação: 131 testes públicos e nove testes de navegador aprovados; política do índice Git aprovada. A conferência SQL somente leitura reconciliou os 13 cards no novo período padrão, com 333.532 registros faturados e 23 competências de calendário, das quais 21 têm movimento. Outubro e novembro de 2026 participam das médias mensais de quantidades com zero; taxas sem denominador são indisponíveis, e a conversão observada se encerra em setembro de 2026. A conferência visual em desktop e celular confirmou o tamanho estável e a reabertura recolhida da ajuda. Capturas privadas `.local/strategic-final-*.png` e `.local/indicators-fixed-*.png`; relatório SQL `.local/strategic-real-verification.json`. API 3003, interface 5173 e PostgreSQL exclusivo 5434 permanecem ativos. Nenhum ETL, commit, push ou publicação foi realizado.

## Consolidação da tabela e comparação anual — 09/11/2026

A barra deslizante de navegação foi retirada dos gráficos; os eixos passam a mostrar a série completa. A TABELA DE EVOLUÇÃO MENSAL saiu da seção isolada e tornou-se a primeira aba da ANÁLISE POR DIMENSÃO, mantendo paginação, configuração de colunas e exportação. As demais dimensões preservam a requisição parcial e o carregamento local. A ajuda e o filtro estratégico perderam textos explicativos redundantes na superfície do painel.

O início da cobertura comercial foi alinhado ao corte de extração de 01/01/2025, documentado em `etl/sql/fontes/QUERY_FATURADOS.sql`. O primeiro faturamento em 06/01/2025 não implica falta de extração nos cinco dias anteriores. Assim, janeiro de 2026 compara sua competência a janeiro de 2025. A coluna de variação anual das dimensões e o total correspondente da tabela mensal usam o intervalo equivalente do ano final do filtro contra o ano anterior; valor, peso e demais medidas mantêm todo o intervalo selecionado. Na publicação consultada, janeiro de 2026 tem R$ 13.272.507,49 e janeiro de 2025 tem R$ 11.154.932,32; a diferença é R$ 2.117.575,17. O total anual comparável das tabelas foi R$ 22.335.952,44. Valores são evidências desse recorte e publicação, não resultados finais do TCC.

No painel Pedidos em Aberto, o gráfico Tipo de entrega deixou de exibir os botões R$ e KG diretamente no cabeçalho; as opções Valor (R$) e Peso continuam nas configurações. Na Visão estratégica, o gráfico TIPO DE ENTREGA oferece essas mesmas medidas e visualizações, com peso faturado agregado por tipo sem alterar os fatos. A API 3003 foi reiniciada pelo processo registrado do próprio projeto. Nenhum ETL, alteração de banco, commit ou push foi executado.

## Navegação e R$/TON em Pedidos em Aberto — 09/11/2026

O menu lateral retirou os botões Filtros Avançados e Atualizar dados. O filtro continua acessível no cabeçalho. O grupo pai de cada rota ativa recebe o mesmo destaque do link filho; um clique nesse pai não recolhe a árvore ativa, inclusive quando outro grupo é expandido. A regra vale para Pedidos de venda, Assistências e Logística.

Pedidos em Aberto ganhou o card R$/TON e essa medida nas configurações dos gráficos e da análise dimensional. A fórmula divide o valor da carteira selecionada pelo peso total em toneladas; totais dimensionais são recalculados com seus denominadores. Sem peso positivo, o resultado é indisponível. A razão não é somada na opção “Outros”. Os títulos dos gráficos usam a escala do painel Pedidos em Aberto nas demais áreas, inclusive em telas estreitas.

Validação: 133 testes públicos, build TypeScript/Vue e política do repositório aprovados. O teste de interface da demonstração confirmou seleção e permanência da árvore ativa. Nenhuma extração, alteração de banco, commit ou push foi realizada.

## Recuperação dos painéis vazios — 09/11/2026

A interface em `127.0.0.1:5173` estava enviando `/api` à porta 3002, ocupada por outro serviço, enquanto a API do projeto respondia na 3003. O proxy do Vite, o padrão da API, o exemplo de ambiente e o launcher foram alinhados à porta 3003, preservando o processo na 3002. A API registrada em `.local/runtime/processos.json` foi reiniciada após conferência de identidade; a interface e o PostgreSQL exclusivo 5434 permaneceram ativos.

Pedidos em Aberto também falhava ao renderizar quando recebia uma resposta da versão anterior da API, sem a nova métrica R$/TON. O card e o texto central do gráfico agora toleram a ausência desse campo durante a atualização da API. A rota voltou a mostrar cards e gráficos; os demais painéis analíticos foram conferidos no navegador. Um teste de interface cobre o proxy e a resposta antiga.
