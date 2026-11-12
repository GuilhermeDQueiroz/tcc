# Demonstração estática para a apresentação

Publicação de produção: [tcc-bi-logistica.vercel.app](https://tcc-bi-logistica.vercel.app), projeto `tcc-bi-logistica` na conta do autor. O endereço substitui a publicação temporária inicial.

Atualização de 12/11/2026: o código foi enviado ao GitHub no commit `41ad5d2` e a demonstração foi republicada na Vercel. A fotografia foi reexportada em 12/11/2026 com posição em 30/09/2026. As rotas `/`, `/estrategico` e `/assistencias`, além do manifesto da demonstração, responderam 200 após a publicação. O pacote estático fica fora do Git; o envio do código não aciona automaticamente a publicação da Vercel.

Use **Ocultar aviso** para recolher a faixa de demonstração e **Mostrar aviso** no cabeçalho para restaurá-la. A preferência vale durante a sessão da aba, inclusive ao recarregar ou trocar de painel.

O modo `demo` reutiliza as telas Vue e os cálculos da aplicação com uma fotografia das publicações reais do PostgreSQL. Não gera pedidos, valores ou ocorrências fictícias. Não executa API Express, PostgreSQL, Firebird ou Hop no computador de quem abre a apresentação.

O aviso superior identifica a posição da base e as limitações. As telas iniciais são exportadas prontas. Consultas adicionais usam os mesmos módulos de cálculo em um Web Worker, carregando as publicações compactadas quando necessário. O primeiro filtro de uma área com histórico extenso pode demorar mais que a abertura inicial; percorra o roteiro antes de apresentar.

## Preparar a fotografia

Com as publicações reais disponíveis no PostgreSQL **18 exclusivo em 5434**, configure as variáveis de conexão conforme [Reprodução](reproducao.md). Não é necessário iniciar a API nem reexecutar o ETL.

```powershell
npm run demo:export
```

O exporter lê `.env` quando presente e também aceita as variáveis no ambiente. Grava apenas em `.local/demo/`, fora do Git. O manifesto registra versões, posição, data da exportação, origem e hashes SHA-256. Logística e pós-venda precisam estar na mesma posição; a publicação comercial é conferida durante a extração. O programa não inicia nem encerra serviços.

Nomes e identificadores devem vir da cópia anonimizada exigida pelo projeto. A exportação não é um anonimizador geral. Os campos de endereço/CEP e coordenadas individuais da logística são omitidos; destinos por UF e cidade e as quantidades permanecem. Nenhum ponto geográfico substituto é criado. Dados, metas e arquivos exportados serão acessíveis a quem tiver acesso à hospedagem.

## Conferir e gerar o pacote

```powershell
npm run demo:dev
# Ou gerar a versão final:
npm run demo:package
```

O segundo comando verifica tipos, compila com `--mode demo`, confere os hashes e copia o resultado para `.local/apresentacao-<hash>/`, com um `vercel.json` próprio. A pasta exata é impressa no terminal. O build comum (`npm run build`) continua consultando a API. O build demonstrativo falha se faltar a fotografia; não preenche lacunas com dados fictícios.

Com a fotografia preparada, `npm run demo:test` compila a versão demonstrativa e executa os testes específicos de navegador contra o build estático em uma porta própria (4174). Os testes conferem abertura das rotas, tela móvel, filtros, granularidade, paginação e CSV, sem chamadas aos endpoints `/api/`.

## Publicar na Vercel

Entre na **pasta do pacote** impressa pelo comando e execute:

```powershell
npx vercel login
npx vercel . --prod
```

Para atualizar o projeto do autor já criado, use explicitamente o projeto e o escopo, a partir da pasta do pacote:

```powershell
npx vercel deploy . --prod --yes --project tcc-bi-logistica --scope guilherme-diniz-s-projects
```

O pacote é estático, já compilado, sem etapa de instalação ou build na Vercel. A configuração preserva arquivos de dados/assets e encaminha os caminhos de navegação, como `/assistencias`, ao `index.html`. Não há banco, `.env`, senha, código de ETL ou servidor no pacote. Publique somente essa pasta. Importar o repositório público pelo GitHub não inclui a fotografia local.

Para publicação permanente, use uma sessão autenticada e mantenha o projeto vinculado à sua conta. A pasta `.vercel/` contém metadados locais de vínculo/autenticação e fica excluída do Git, inclusive quando aparece em subpastas. Não é necessário incluir as fotografias em um commit para publicar o pacote pelo CLI.

O `.vercelignore` do pacote permite somente `index.html`, `vercel.json`, `assets/` e `demo/`. Caches e arquivos locais criados pelo CLI ficam fora do upload, inclusive em uma pasta reutilizada.

Antes de publicar, `npx vercel deploy --dry --json --project tcc-bi-logistica --scope guilherme-diniz-s-projects` permite conferir os arquivos selecionados. Execute na pasta do pacote. Os diretórios são incluídos por `!assets` e `!demo`, sem barra final, conforme o formato de allowlist do CLI. A publicação inicial de 05/11/2026 foi conferida com 62 arquivos estáticos. A atualização da navegação contém 66 arquivos estáticos (24.120.098 bytes); a padronização dos modais contém 66 arquivos (24.121.879 bytes), sem caches nem metadados locais.

Sem sessão autenticada, o CLI também oferece `npx vercel deploy --temporary --yes`. Essa publicação expira no prazo impresso pelo CLI, a menos que o autor use o link de transferência para vinculá-la à sua conta. O link de transferência dá controle da publicação e não deve ser compartilhado. Consulte a [documentação oficial de publicação sem login](https://vercel.com/docs/deployments/deploy-without-logging-in).

## Roteiro e limites

Abra Pedidos em Aberto, Visão Estratégica, Faturados, Formação de Cargas, Assistências, Cancelamentos e Devoluções. Confira filtros por UF, troca das visões de assistências, granularidade, hierarquias, pesquisa, paginação e exportação CSV. Os gráficos e as tabelas mantêm as interações dos componentes existentes. Pesquisas comerciais expõem as colunas compactas da fotografia, não todas as colunas brutas do ERP.

Os filtros selecionam eventos/emissão dentro da publicação. A posição do saldo permanece fixa na referência exportada; selecionar datas anteriores não reconstrói automaticamente um saldo histórico. Metas e presets editados ficam somente na memória da aba e são descartados ao recarregar. Atualizar dados refaz a consulta da fotografia, sem buscar o ERP. A publicação remota precisa de internet para baixar o site; não é uma aplicação instalada para uso offline.

Testes controlados do mecanismo ficam em `tests/demo.test.js`; eles não fornecem dados às telas nem constituem resultados empíricos do TCC. Builds e testes de software também não demonstram ganho gerencial.
