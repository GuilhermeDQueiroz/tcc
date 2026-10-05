$ErrorActionPreference = 'Stop'
$BancoProjeto = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$DadosProjeto = Join-Path $BancoProjeto 'data'
$BinPostgresProjeto = if ($env:POSTGRES_BIN) { $env:POSTGRES_BIN } else { 'C:\Program Files\PostgreSQL\18\bin' }
$ControlePostgresProjeto = Join-Path $BinPostgresProjeto 'pg_ctl.exe'
if (-not (Test-Path -LiteralPath $ControlePostgresProjeto)) { throw 'Defina POSTGRES_BIN com a pasta bin do PostgreSQL 18.' }
if (-not (Test-Path -LiteralPath (Join-Path $DadosProjeto 'PG_VERSION'))) { throw 'O cluster do projeto ainda não foi inicializado.' }
if ((Get-Content -LiteralPath (Join-Path $DadosProjeto 'PG_VERSION') -Raw).Trim() -ne '18') { throw 'Este banco requer PostgreSQL 18.' }
