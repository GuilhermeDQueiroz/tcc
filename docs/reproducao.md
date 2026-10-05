# Reprodução da parte prática

Este guia parte de um clone independente de `GuilhermeDQueiroz/tcc`. O código pode ser compilado e seus testes públicos executados sem dados. Para consultar os painéis, é necessário publicar dados da cópia Firebird anonimizada do autor. O projeto não preenche uma ausência de fonte com registros simulados.

## 1. Verificar o código

Instale Git e Node.js 24.16.0, versão registrada em `.nvmrc`.

```powershell
git clone https://github.com/GuilhermeDQueiroz/tcc.git
cd tcc
npm ci
npm test
npm run build
npm run check:repository
```

O perfil público é independente do banco e das evidências privadas. A verificação do repositório lê os arquivos **do índice Git**, inclusive arquivos forçados com `git add -f`; não imprime o conteúdo das credenciais encontradas. É uma conferência limitada às regras implementadas, não uma garantia universal de ausência de informações sensíveis.

## 2. Obter a fonte anonimizada

Combine com o autor o acesso à cópia Firebird anonimizada e ao recorte usado na avaliação. O arquivo local completo tem 98.461.810.688 bytes, aproximadamente 98 GB; ele não acompanha o clone e deve ser transportado por meio separado. Registre origem da cópia, data, recorte e integridade do material recebido. Não copie um arquivo de banco em uso como se fosse backup consistente.

Use Firebird 5 compatível com a cópia. O usuário e a senha de conexão dependem da instalação Firebird do avaliador; não vêm no Git. A publicação logística foi validada para emissão de 01/01/2026 a 30/09/2026, com referência em 30/09/2026. Outro recorte pode produzir valores diferentes e exige conferência própria.

## 3. Preparar o PostgreSQL em uma instalação nova

Ambiente de execução validado: Windows, PostgreSQL 18, porta exclusiva **5434**, host de loopback, banco **dados**. Os binários normalmente ficam em `C:\Program Files\PostgreSQL\18\bin`. Configure `POSTGRES_BIN` para os scripts do banco se a instalação estiver em outro local; os runners de backup do ETL desta versão usam o caminho padrão acima.

Os comandos de inicialização abaixo são **somente para um clone novo sem cluster**. Para uma instância já preparada, use os scripts de iniciar/status/parar e preserve os dados.

```powershell
$env:POSTGRES_BIN = 'C:\Program Files\PostgreSQL\18\bin'
& (Join-Path $env:POSTGRES_BIN 'initdb.exe') -D .\banco\data -U postgres -E UTF8 --auth=scram-sha-256 --pwprompt
@('port = 5434', "listen_addresses = 'localhost'") | Add-Content .\banco\data\postgresql.conf
.\banco\scripts\iniciar.ps1
& (Join-Path $env:POSTGRES_BIN 'psql.exe') -h localhost -p 5434 -U postgres -d postgres -W
```

No terminal interativo do `psql`, crie o usuário de carga/aplicação e o banco:

```sql
CREATE ROLE "API" LOGIN;
\password "API"
CREATE DATABASE dados OWNER "API";
\q
```

As senhas são solicitadas no terminal. O workflow cria staging, DW e estruturas de publicação; não é necessário transferir um banco da porta 5432 para reproduzir o projeto. `banco/scripts/migrar.py` documenta uma migração histórica do ambiente do autor e não é o instalador de um clone novo.

## 4. Preparar Python, Hop e conexões

Instale Python 3.12, JDK 21 e Apache Hop 2.19. A execução do Hop e os launchers foram validados no Windows; a CI verifica código/build em Linux, sem executar esse runtime Windows.

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Preencha `.env` localmente:

| Variável | Valor / finalidade |
|---|---|
| `PG_HOST`, `PG_PORT`, `PG_DATABASE` | `localhost`, `5434`, `dados` |
| `PG_USER`, `PG_PASSWORD` | Usuário `API` criado e sua senha local |
| `API_PORT` | `3002` |
| `FIREBIRD_HOST`, `FIREBIRD_PORT` | Instância da cópia local; padrão `localhost:3050` |
| `FIREBIRD_DATABASE` | Caminho absoluto da cópia `.fdb` |
| `FIREBIRD_USER`, `FIREBIRD_PASSWORD` | Credenciais da instalação local |
| `HOP_HOME` | Pasta `hop` da instalação Apache Hop |
| `HOP_JAVA_HOME` | Pasta do JDK 21 contendo `bin/java.exe` e `bin/javac.exe` |

Coloque os drivers JDBC em `etl/lib`, conforme [versões e hashes verificados](../etl/lib/README.md). Esses binários não acompanham o Git. O arquivo `.env` também não é versionado. Os comandos npm do ETL carregam `.env` com o Node e passam as variáveis ao Python/Hop; chamadas diretas ao Python exigem as mesmas variáveis no ambiente do processo.

O launcher Python prefere `.venv` do próprio clone; `PYTHON` pode indicar outro executável. O ambiente original `../legacy/.venv` não é necessário para executar o painel e o ETL. Ele só participa de ferramentas históricas de comparação com o código legacy.

## 5. Publicar os dados

Execute primeiro o fluxo comercial. Ele extrai as 32 projeções, transforma e publica as áreas comerciais.

```powershell
npm run etl:commercial
```

Depois execute o fluxo logístico com a mesma cópia local e o recorte validado. Substitua o caminho pelo arquivo obtido com o autor:

```powershell
npm run etl:logistics -- --database C:\DadosAnonimizados\DADOS.FDB --start-date 2026-01-01 --reference-date 2026-09-30
```

Para caminhos com espaços, use aspas. Os runners verificam variáveis, controle de execução e publicação, e mantêm relatórios em `.local`. Execute um fluxo por vez. A extração completa pode ser demorada e exige espaço para Firebird, staging, fatos e backups; sua duração não é o tempo de resposta da interface.

A Visão Estratégica precisa das **duas publicações**: carteira logística e faturamentos comerciais. Conexão estabelecida com um banco vazio não significa que o painel esteja pronto. Sem publicação válida, a API informa indisponibilidade.

Reprocessar apenas o staging comercial já existente:

```powershell
npm run etl:commercial -- --somente-dw
```

Essa opção não cria dados de origem nem substitui a primeira extração. Para abrir os diagramas no Hop, configure `HOP_HOME`/`HOP_JAVA_HOME` no ambiente PowerShell e use `etl/scripts/abrir-hop.ps1`. Detalhes do workflow: [configuração do ETL](../etl/CONFIGURACAO_EXTRACAO_PEDIDOS.md).

## 6. Abrir a aplicação

```powershell
npm run build
.\scripts\iniciar-dev.ps1 -BancoJaIniciado
```

Acesse http://127.0.0.1:3002/estrategico ou http://127.0.0.1:5173/estrategico. O launcher solicita `PG_USER` e `PG_PASSWORD` se não estiverem no ambiente; não lê automaticamente `.env` antes desse prompt. As credenciais devem corresponder às configuradas no banco. `-SemInterface` inicia apenas API/interface compilada. Não execute outra API sobre a mesma porta.

Metas locais podem ser configuradas pela interface. O clone usa `data/metas-inicial.example.json` sem metas definidas. Se houver um arquivo privado `data/metas-inicial.json`, ele continua sendo utilizado; configurações persistidas em `data/local` têm precedência. Nenhum desses arquivos reais será enviado ao Git.

## 7. Executar as verificações adicionais

```powershell
npm run test:etl
npm run test:ui
```

Playwright requer o Chrome instalado e a API real em 3002; a interface Vite em 5173 pode ser iniciada pelo teste. Testes que esperam evidências da publicação do autor não passam automaticamente com outra publicação: compare recorte, versões e resultados.

`npm run test:real` conserva a suíte completa anterior, incluindo referências matemáticas privadas em `.local` e testes históricos que usam o ambiente original do legacy. Ela não é a suíte usada na CI e exige, entre outros, `domain-reference.json`, `legacy-reference.json`, `real-load.json`, bases `normalized-*`, referências de dimensões/hierarquias e a amostra genuína. Não publique esses arquivos para tornar um teste verde.

Regenerar as referências do legacy exige obter esse código de comparação e seu ambiente próprio com pandas/NumPy/Plotly, conferir a publicação e executar as ferramentas `reference_full.py`, `prepare-core-reference.py` e as verificações documentadas em [validação de equivalência](validacao-equivalencia.md). Os oracles não fornecem dados à aplicação. A ausência dessas evidências não impede os testes públicos, o build nem a execução do painel com as publicações válidas.

## Falhas comuns

| Situação | Conferência |
|---|---|
| Cluster ausente | Concluir a preparação PostgreSQL; os arquivos físicos não vêm no clone |
| Autenticação recusada | Conferir usuário/senha/porta da instalação local, sem gravar a senha no Git |
| API sem dados | Confirmar as publicações comercial e logística, seus estados e recortes |
| Hop/JDK indisponível | Conferir `HOP_HOME`, `HOP_JAVA_HOME` e drivers em `etl/lib` |
| Referências privadas ausentes | Usar `npm test` para o perfil público; preparar a evidência antes de `test:real` |
| Porta ocupada | Identificar a instância; os scripts não encerram processos de outros projetos |
