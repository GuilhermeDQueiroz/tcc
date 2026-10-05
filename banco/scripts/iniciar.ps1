. (Join-Path $PSScriptRoot 'comum.ps1')
& $ControlePostgresProjeto status -D $DadosProjeto
if ($LASTEXITCODE -eq 0) { return }
New-Item -ItemType Directory -Path (Join-Path $BancoProjeto 'logs') -Force | Out-Null
& $ControlePostgresProjeto start -D $DadosProjeto -l (Join-Path $BancoProjeto 'logs/postgresql.log') -w -t 30
if ($LASTEXITCODE -ne 0) { throw 'Falha ao iniciar o banco do projeto. Consulte banco/logs/postgresql.log.' }
