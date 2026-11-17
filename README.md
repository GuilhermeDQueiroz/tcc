Business Intelligence aplicado à logística: desenvolvimento de um painel analítico para apoio à tomada de decisão com dados de um ERP

Parte prática do Trabalho de Conclusão de Curso: desenvolvimento de um painel analítico para apoio à tomada de decisão com dados de um ERP.

O projeto organiza dados do ERP Firebird em uma base analítica PostgreSQL, por meio do Apache Hop, e apresenta indicadores e consultas em uma aplicação web. O foco é acompanhar a carteira de pedidos, as parcelas em carga e sem carga e o desempenho do faturamento.

Acesso ao projeto e materiais do TCC

Material	Descrição	Acesso
Painel interativo	Aplicação web desenvolvida como parte prática do TCC	Acessar painel
Vídeo de apresentação	Demonstração do projeto e de suas funcionalidades	Assistir ao vídeo
Trabalho escrito (TCC)	Monografia com fundamentação teórica, metodologia, desenvolvimento e resultados	Acessar trabalho escrito
Código-fonte	Repositório com a implementação, pipelines ETL e documentação técnica	Acessar GitHub

Autor: Guilherme Diniz Queiroz
Repositório: GuilhermeDQueiroz/tcc

Captura da publicação local validada, com referência de carteira em 30/09/2026. Os valores da imagem pertencem àquela publicação; não são constantes nem dados fornecidos pela interface.

Funcionalidades

Área	Análises disponíveis
Visão estratégica	Treze cards com carteira, backlog, volume mensal, ticket por item e fluxo físico; comparações anuais de faturamento e R$/ton acumulado, evoluções, tabela mensal com conversão/escoamento, mapa de faturamento e análise dimensional
Formação de Cargas	Pedidos sem carga, parcialmente e totalmente alocados; quantidades, valor, peso e cubagem por parcela; seleção cruzada entre carga, pedido e item; mapa e previsões
Pedidos em Aberto	Carteira, backlog, calendário, geografia, dimensões com pedidos e valor > 60 dias, atalhos para faixa de tempo e pesquisa
Análise Logística dos Pedidos Faturados	Peso, cubagem, pedidos, lead time até faturamento, faturamento no prazo, entrega/retirada, destinos, evolução e pesquisa
Pedidos Emitidos	Área comercial preservada em sua rota, sem destaque no menu principal
Assistências	Visões em aberto e emitidas, quantidades e valores, idade, motivos, calendário, dimensões compartilhadas, hierarquias, peso, cubagem e detalhamento paginado
Cancelamentos de venda	Eventos de cancelamento, inclusive parciais, vinculados aos pedidos e itens originais
Devoluções	Devoluções de vendas e assistências por documento, item faturado original e motivo

As consultas incluem filtros, totalizadores, hierarquias, pesquisa, exportação CSV e preferências locais. A aplicação adapta a disposição dos painéis para telas menores.

Para apresentar sem API ou banco ativos, há um modo de demonstração estática com uma fotografia das publicações reais anonimizadas. npm run demo:export prepara os dados locais; npm run demo:package gera o pacote independente para a Vercel. A fotografia fica fora do Git e a interface identifica sua posição e seus limites.

Arquitetura

flowchart LR
    F[(Firebird anonimizado)] --> H[Apache Hop\nExtração nativa]
    H --> S[(PostgreSQL\nStaging bruto)]
    S --> T[Hop + SQL\nTransformação e validação]
    T --> D[(DW comercial\nFatos logísticos publicados)]
    D --> A[API Node.js / Express]
    A --> V[Vue / Pinia / ECharts]

Há 32 projeções de fontes no fluxo comercial, quatorze no fluxo logístico e quatorze no fluxo isolado de pós-venda. As publicações são versionadas e identificadas nos resultados. O ETL é executado separadamente; abrir o painel não inicia uma extração. A API utiliza a última publicação válida. As regras e os vínculos dos novos painéis estão em Painéis de pós-venda.

Tecnologias verificadas: Node.js 24.16.0, Vue 3, TypeScript, Pinia, Vue Router, Tailwind CSS, Apache ECharts, Express, PostgreSQL 18, Apache Hop 2.19, JDK 21, Python 3.12 e Firebird 5.

Começar após clonar

git clone https://github.com/GuilhermeDQueiroz/tcc.git business-intelligence-logistica
cd business-intelligence-logistica
npm ci
npm test
npm run build

Esses comandos verificam o código e geram a interface sem precisar do banco da empresa ou das evidências privadas. A aplicação não fornece registros simulados ou modo de demonstração integrado à execução local.

Para abrir o painel com dados, siga o guia de reprodução: obter a cópia Firebird anonimizada, preparar o PostgreSQL local em localhost:5434, configurar as conexões e executar as publicações comercial e logística pelo Hop. Depois:

.\scripts\iniciar-dev.ps1 -BancoJaIniciado

Serviço	Endereço
Aplicação compilada e API	http://127.0.0.1:3003
Interface de desenvolvimento	http://127.0.0.1:5173
PostgreSQL do projeto	localhost:5434, banco dados

O launcher solicita credenciais ausentes em memória e mantém logs em .local/runtime. Para encerrar os processos que ele iniciou e o banco exclusivo:

.\scripts\parar-dev.ps1
.\banco\scripts\parar.ps1

Instâncias iniciadas por outros terminais precisam de conferência própria. Não encerre processos pelo nome globalmente: Firebird 3050 e PostgreSQL 5432 podem atender outros projetos. A conferência de 05/11/2026 deixou o ambiente deste projeto parado; veja estado e continuidade.

Dados e configuração

A fonte da parte prática é uma cópia Firebird anonimizada, que deve ser obtida com o autor por meio separado. O repositório contém código, consultas, metadados, pipelines, workflows e documentação; não contém o arquivo Firebird, o cluster PostgreSQL, dumps, senhas ou referências privadas de validação. O arquivo local completo tem cerca de 98 GB e não integra o histórico Git.

Copie .env.example para .env e configure apenas o arquivo local. As conexões Hop usam variáveis; nenhum segredo deve ser gravado nos metadados. Metas comerciais reais também ficam fora do versionamento: em um clone novo, as metas começam sem valores definidos. A configuração pública com zeros não fornece dados do ERP.

Verificação

Comando	Escopo e pré-requisitos
npm test	Perfil público: contratos, datas, cache, filtros, relações, indicadores estratégicos, configurações e organização estática do ETL; sem banco
npm run build	Verificação TypeScript/Vue e compilação da interface
npm run check:repository	Inspeção dos arquivos no índice Git contra as regras de arquivos privados, tamanho e credenciais
npm run check	Perfil público, build e inspeção do índice
npm run test:etl	Linhagem e estrutura nativa do Hop; exige Python, sem conectar aos bancos
npm run test:real	Suíte completa, incluindo equivalência com referências privadas reais; exige ambiente e evidências descritos no guia
npm run test:ui	Navegação e interface com Chrome e API real ativa

Os pequenos casos controlados dos testes públicos exercitam regras e falhas; não alimentam o painel nem representam observações da empresa. O perfil real compara publicações e referências executadas sobre dados reais. Novos arquivos de teste precisam de classificação explícita; nenhum perfil é escolhido pela existência acidental dos dados locais.

A CI executa a verificação pública em pushes e pull requests. Ela não extrai dados nem executa testes gerenciais. Veja o escopo de validação e suas evidências.

Definições e limites do TCC

* Nível de Serviço / Lead Time: tempo médio até faturamento, com média por registro; não confirma entrega ao cliente.
* OTIF: convenção interna de pontualidade de faturamento. A regra atual e a cobertura de previsão são exibidas; não comprova entrega física nem In Full.
* Pedidos antigos: idade da carteira, distinta de previsão vencida.
* Backlog estratégico: valor aberto dos status logísticos dividido pela média diária de faturamento dos 90 dias corridos da referência; o card geral fica em Pedidos em Aberto e o valor da carteira logística tem card próprio.
* R$/kg: valor dos produtos faturados por massa; não é custo de frete.
* Conversão da safra: parcelas faturadas em até 7, 15 e 30 dias corridos após a emissão de cada pedido, divididas pela base emitida da safra mensal. Inclui pedidos sem faturamento no denominador. Em pedidos, mede algum faturamento, inclusive parcial. Janelas incompletas aparecem como “Em acompanhamento”; não confirma entrega.
* Participação da safra no faturamento: participação dos pedidos emitidos no próprio mês no faturamento desse mês. Preserva o cálculo comercial anterior, agora com nome que explicita sua base; difere da conversão dos pedidos emitidos.
* Mapa: distribuição por UF/cidade e pontos de pedidos. Coordenadas do ERP têm prioridade; destinos sem coordenadas podem usar localização aproximada pelo CEP de entrega, inclusive centro municipal. A origem aparece no mapa. Não há otimização de rotas.

No pós-venda, o intervalo acompanha o filtro de emissão/evento, dentro da cobertura publicada. A referência indica a posição da base usada para idade, previsão e saldo de assistências: um filtro de mês anterior não reconstrói a carteira daquele mês. Veja as regras de datas.

Frete sobre faturamento, recolhimento físico, duração por etapa e histórico real do saldo permanecem no plano de evolução. Assistências já têm painel próprio, mas não comprovam conclusão física do atendimento. O experimento manual × painel e a avaliação com gestores ainda precisam ser aplicados ou ter suas evidências identificadas. Testes técnicos não demonstram, isoladamente, ganho de produtividade gerencial.

Documentação para a banca

Materiais de apresentação

* Vídeo de apresentação do TCC — demonstração da aplicação e de suas funcionalidades.
* Trabalho escrito (monografia) — documentação acadêmica do desenvolvimento e da pesquisa.
* Painel online — acesso à aplicação publicada.

Documentação técnica e metodológica

* Estado do projeto, conferência GitHub e continuidade
* Painéis de pós-venda e dimensões, layout e linhagem
* Navegação e filtros e desempenho e arquitetura
* Contribuição do painel de Faturados ao tema logístico
* Reprodução do ambiente e das publicações
* Roteiro de demonstração e avaliação
* Correspondência entre implementação e monografia
* Dicionário de indicadores e regras de negócio
* Fontes, telas, testes e capítulos do TCC
* Visão Estratégica e Formação de Cargas
* Conversão por safra: fórmulas, observação das janelas, filtros, conciliação e contribuição para o TCC.
* Plano de implementação e pendências
* Localização aproximada por CEP: consulta em lote, cache local e limites de precisão.
* Validação de equivalência com o legacy

Organização

api-server/    API, repositórios e cálculos
shared/        Catálogos comuns à API e à interface
src/           Interface, filtros, gráficos e consultas
etl/           Pipelines, workflows, metadados e SQL do Apache Hop
banco/         Instruções e scripts da instância PostgreSQL
scripts/       Execução e verificações do projeto
tests/         Testes públicos, equivalência e navegador
docs/          Contratos, metodologia, reprodução e evidências
data/          Modelo público de metas; configurações reais locais

Reutilização e créditos

A licença do código autoral ainda não foi definida pelo autor. Dependências, fontes e recursos de terceiros conservam suas próprias licenças e créditos em THIRD_PARTY_NOTICES.md. Dados e configurações locais não são licenciados nem distribuídos pelo repositório.

Orientações para alterações: CONTRIBUTING.md e AGENTS.md. Para relatar problemas de exposição de informação, consulte SECURITY.md.
