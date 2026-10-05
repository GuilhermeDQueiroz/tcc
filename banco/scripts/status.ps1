. (Join-Path $PSScriptRoot 'comum.ps1')
& $ControlePostgresProjeto status -D $DadosProjeto
if ($LASTEXITCODE -eq 0) { Write-Host 'Projeto: localhost:5434 / dados'; exit 0 }
exit $LASTEXITCODE
