# Extração e transformação no Apache Hop

## Fluxo do TCC

```text
Firebird / tabelas originais
  → pipelines/extracao/dimensoes e pipelines/extracao/fatos
  → PostgreSQL staging.stg_* (valores brutos)
  → pipelines/transformacao-carregamento (joins e cálculos no PostgreSQL)
  → dw.carga_* → dimensões e fatos dw → views dw.pedidos_*
  → API → dashboard
```

O banco do projeto é `dados`, em `localhost:5434`. Seus arquivos físicos ficam
em `../banco/data`. A aplicação em desenvolvimento consumirá somente `dw`.

## Organização dos arquivos

```text
etl/
  metadata/
    rdbms/                       DADOS (Firebird), DW (PostgreSQL)
    pipeline-run-configuration/   local
    workflow-run-configuration/   local
  pipelines/
    extracao/dimensoes/           espelhos de pessoas, produtos e contextos
    extracao/fatos/               espelhos de documentos, cargas e metas
    transformacao-carregamento/   consultas consolidadas e publicação estrela
  scripts/                       geração, validação e execução/abertura do Hop
  sql/
    fontes/                      consultas originais e metadados de tipos
    transformacoes/               consultas adaptadas ao PostgreSQL
    001_...sql a 008_...sql        estrutura, controle, índices e publicação
  workflows/
    main.hwf
    wf_extracao_dimensoes.hwf
    wf_extracao_fatos.hwf
    wf_load.hwf
  inventario-fontes.json
  project-config.json
```

`inventario-fontes.json` relaciona as 32 tabelas usadas nas consultas do legacy,
suas colunas e pipelines. `METAS_VENDAS` e `PESSOA_CONSULTORVENDAS` são as duas
fontes acrescentadas por não terem pipelines correspondentes no Portal.
As fontes do Portal sem uso nestas consultas não participam desta carga.

## Staging bruto

Cada pipeline `ext_*.hpl` contém `Table Input` na conexão `DADOS` e `Table Output`
na conexão `DW`. O SELECT projeta somente as colunas utilizadas pelas consultas,
com seus valores originais. Não executa joins, CASE, IIF, agregações,
deduplicação, limpeza ou cálculos. As linhas são gravadas em `staging.stg_*`.
Não há filtro temporal de extração nesta versão: os recortes originais das
três áreas são aplicados durante a transformação. Isso também preserva os
vínculos com pedidos anteriores ao período de faturamento.

O pipeline de pessoas preserva todos os códigos de pessoa. O filtro por
documento/deduplicação do Portal não foi reutilizado, pois alteraria os joins
originais do legacy. Os timestamps são mantidos como `timestamp`, incluindo
horários. Valores monetários e quantidades decimais usam `numeric`.

## Transformação e DW

Os cinco pipelines `load_pedidos_abertos`, `load_pedidos_emitidos`,
`load_pedidos_faturados`, `load_carteira_clientes` e `load_metas_consultores`
leem **PostgreSQL**, pela conexão `DW`. Seus Table Inputs executam os joins,
recortes e cálculos originais sobre `staging.stg_*` e escrevem em `dw.carga_*`.
Essas tabelas são áreas de trabalho da carga; o dashboard usa as views publicadas.

A adaptação converte IIF para CASE, substitui nomes de fontes por espelhos de
staging e remove RDB$DATABASE onde PostgreSQL dispensa uma tabela auxiliar.
A divisão de preço bruto/líquido por quantidade preserva o truncamento em
seis casas observado no Firebird. O conteúdo SQL completo está visível no
Table Input de cada pipeline e em `sql/transformacoes`.

`load_modelo_analitico.hpl` publica quatro dimensões conformadas e três fatos
em uma única transação, junto com carteira, metas e o registro de execução.
É um transform nativo `Execute SQL script` configurado para enviar o script
inteiro. O SQL é idêntico a `003_publicacao.sql`; o validador confere essa igualdade.
Falhas antes do COMMIT não publicam fatos parcialmente carregados.

As cinco antigas tabelas consolidadas que estavam em staging são preservadas
como `etl.referencia_*`. Elas não alimentam os pipelines novos.

## Abrir no Hop GUI

Na raiz de `business-intelligence-logistica`, execute no PowerShell:

```powershell
.\etl\scripts\abrir-hop.ps1
```

O script cadastra o projeto numa configuração local em `.local/hop-config`,
define `PROJECT_HOME` como a pasta `etl` e abre `workflows/main.hwf` no Hop.
Não inicia uma carga. Para apenas visualizar os diagramas, não precisa de senhas.
As conexões continuam usando variáveis, sem credenciais salvas nos arquivos.

Para habilitar conexões reais na sessão, inicie assim:

```powershell
.\banco\scripts\iniciar.ps1
.\etl\scripts\abrir-hop.ps1 -Conectar
```

As senhas são solicitadas em memória e passadas ao processo Java. Não salve
as senhas nos metadados de conexão. Na barra do Hop, selecione o projeto
`business-intelligence-logistica`; no explorador, abra um `.hpl` ou `.hwf`. Duplo clique em
um transform permite inspecionar seu SQL, conexão e tabela de destino.

Se já tiver o Hop aberto por outro atalho, crie um projeto com nome
`business-intelligence-logistica`, Home igual à pasta `business-intelligence-logistica/etl` e configuração
`project-config.json`. A pasta de metadados é `${PROJECT_HOME}/metadata`.
Para executar com variáveis de conexão em memória, prefira o launcher acima.

## Executar e validar

Requisitos: Apache Hop 2.19, JDK 21, PostgreSQL 18 e Python com psycopg2 para
o executor. `HOP_HOME`, `HOP_JAVA_HOME` e `POSTGRES_BIN` podem substituir os
caminhos locais detectados. Drivers JDBC ficam em `etl/lib`: Jaybird 6.0.6 e
PostgreSQL JDBC. Os drivers e os dados físicos não são versionados.

`run_hop.py` exige as variáveis listadas em `.env.example` no ambiente do
processo, com `PG_DATABASE=dados`, `PG_PORT=5434` e host de loopback.

```powershell
python .\etl\scripts\run_hop.py
python .\etl\scripts\validate_raw_etl.py
```

O Python inicia o Hop, mantém o bloqueio de carga, acompanha o resultado e
confere contagens; não extrai registros do ERP. O workflow também executa os
scripts de criação da estrutura. A extração e as transformações são realizadas
pelos pipelines nativos do Hop. O relatório real e os logs ficam em `.local`.

Execute uma carga por vez. O executor mantém um advisory lock durante a carga;
ao executar diretamente no GUI, não inicie outra sessão concorrente. O staging
é atualizado por full refresh, e o DW publicado é substituído atomicamente.

## Reprocessar o DW sem extrair novamente

Com PG_USER e PG_PASSWORD no ambiente, o comando abaixo usa exclusivamente
os espelhos já existentes no staging. As credenciais Firebird são dispensadas.
O executor cria um backup de dw/etl em banco/backups antes da migração do modelo.

```powershell
python .\etl\scripts\run_hop.py --somente-dw
python .\etl\scripts\verify_dw_treatment.py
```

No Hop GUI, abra workflows/reprocessar_dw.hwf para visualizar a orquestração.
Ela atualiza o modelo, prepara somente dw.carga_*, executa wf_load e publica
os resultados. Nenhuma tabela staging é truncada por esse workflow.

O contrato dos nomes fica em contrato-colunas-dw.json e sua correspondência
com o legacy em ../docs/contrato-colunas-dw.md. Campos copiados mantêm o nome
de origem; cálculos, descrições compostas e tratamentos têm nomes em português.
Os campos *_tratado e *_tratada reproduzem o pós-processamento do extrator;
as métricas que usavam *_CLEAN ou *_DATE devem usar seus campos correspondentes,
conforme o contrato. Os valores anteriores ao tratamento
continuam disponíveis para auditoria. O comparador usa dados reais e preserva
duplicidades; ele não efetua cargas e não comprova equivalência da base inteira.
