# PostgreSQL do projeto

Banco: `dados`. Host: `localhost`. Porta: **5434**.
Arquivos físicos: `banco/data`. PostgreSQL 18 instalado é o runtime; os binários
não foram copiados para o projeto. A instância pertence ao usuário Windows que
a inicializou e escuta somente em loopback, com autenticação SCRAM.

Na raiz de `legacy-refatorado`:

```powershell
.\banco\scripts\iniciar.ps1
.\banco\scripts\status.ps1
.\banco\scripts\parar.ps1
```

Depois de reiniciar o Windows, use `iniciar.ps1`. Não há serviço Windows novo.
Para mover/copiar a pasta, pare esta instância antes. Use PostgreSQL da mesma
versão principal; para transportar entre versões/sistemas, prefira pg_dump.

## pgAdmin

Registre um servidor chamado `Legacy Refatorado`, com host `localhost`, porta
`5434`, maintenance database `postgres` e usuário `postgres`. Use a senha
administrativa informada para esta instância. Expanda Databases → dados → Schemas.
O papel `API` é o proprietário de `dados` e é utilizado na carga da aplicação.

Para confirmar a localização, no Query Tool como administrador:

```sql
SHOW data_directory;
SHOW port;
SELECT current_database();
```

## Migração realizada

A carga real da instância anterior, porta 5432, foi transferida por
pg_dump/pg_restore. Locale, tabelas, sequências, proprietários e histórico foram
preservados. As 15 tabelas originais e sequências tiveram contagens/fingerprints
comparados. Evidência em `.local/database-migration.json`.
O banco da porta 5432 permanece preservado. A porta 5433 pertence a outro projeto.

`backups` contém os dumps da migração. `logs` contém o log do servidor. Essas
pastas e `data` ficam fora do versionamento. Não copie arquivos de um banco
em execução como se fossem um backup consistente.

`scripts/migrar.py` é o instalador da transferência inicial: recusa sobrescrever
um cluster já existente. Senhas são recebidas por ambiente/getpass; o bootstrap
define a senha pela entrada padrão do PostgreSQL em modo single-user, antes
de abrir a porta TCP. Nenhum arquivo de senha ou dump de papéis é gerado.
