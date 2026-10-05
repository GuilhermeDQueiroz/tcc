. (Join-Path $PSScriptRoot 'comum.ps1')
& $ControlePostgresProjeto status -D $DadosProjeto
if ($LASTEXITCODE -ne 0) { Write-Host 'Banco do projeto já está parado.'; return }
& $ControlePostgresProjeto stop -D $DadosProjeto -m fast -w -t 30
if ($LASTEXITCODE -ne 0) { throw 'Falha ao parar o banco do projeto.' }
