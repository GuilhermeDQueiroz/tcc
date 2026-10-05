$ErrorActionPreference = 'Stop'
$RaizProjeto = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$ArquivoProcessosProjeto = Join-Path $RaizProjeto '.local/runtime/processos.json'
if (-not (Test-Path -LiteralPath $ArquivoProcessosProjeto)) { Write-Host 'Não há processos registrados pelo launcher.'; return }
$RegistroProjeto = Get-Content -LiteralPath $ArquivoProcessosProjeto -Raw | ConvertFrom-Json
if ($RegistroProjeto.root -ne $RaizProjeto) { throw 'O registro de processos pertence a outra pasta.' }
foreach ($ItemProjeto in $RegistroProjeto.processes) {
    $ProcessoProjeto = Get-Process -Id $ItemProjeto.pid -ErrorAction SilentlyContinue
    if (-not $ProcessoProjeto) { continue }
    # PowerShell 7.5 may deserialize an ISO JSON timestamp as DateTime.
    $InicioRegistradoProjeto = if ($ItemProjeto.startedAt -is [datetime]) { $ItemProjeto.startedAt.ToUniversalTime() } else {
        [datetime]::Parse($ItemProjeto.startedAt, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::RoundtripKind).ToUniversalTime()
    }
    if ($ProcessoProjeto.StartTime.ToUniversalTime().Ticks -ne $InicioRegistradoProjeto.Ticks -or $ProcessoProjeto.Path -ne $ItemProjeto.executable) {
        throw "O PID $($ItemProjeto.pid) foi reutilizado ou mudou de identidade; não será encerrado."
    }
    $ProcessoProjeto.Kill()
}
Remove-Item -LiteralPath $ArquivoProcessosProjeto
Write-Host 'API e interface deste launcher encerradas. O PostgreSQL permanece disponível.'
