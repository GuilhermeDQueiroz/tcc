param([switch]$Conectar)
$ErrorActionPreference = 'Stop'
$RaizAplicacaoHop = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$PythonAplicacaoHop = Join-Path $RaizAplicacaoHop '../legacy/.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $PythonAplicacaoHop)) { $PythonAplicacaoHop = 'python' }
$ArgumentosAplicacaoHop = @((Join-Path $PSScriptRoot 'abrir_hop.py'))
if ($Conectar) { $ArgumentosAplicacaoHop += '--conectar' }
& $PythonAplicacaoHop @ArgumentosAplicacaoHop
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível iniciar o Hop.' }
