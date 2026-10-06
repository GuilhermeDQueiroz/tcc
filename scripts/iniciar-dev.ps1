param([switch]$SemInterface, [switch]$BancoJaIniciado)
$ErrorActionPreference = 'Stop'
$RaizProjeto = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$RuntimeProjeto = Join-Path $RaizProjeto '.local/runtime'
$NodeProjeto = (Get-Command node -ErrorAction Stop).Source
if (-not (Test-Path -LiteralPath (Join-Path $RaizProjeto 'node_modules/vite/bin/vite.js'))) {
    throw 'Execute npm ci na pasta business-intelligence-logistica antes de iniciar.'
}
if (-not (Test-Path -LiteralPath (Join-Path $RaizProjeto 'dist/index.html'))) {
    throw 'Execute npm run build antes de iniciar.'
}
$VariaveisProjeto = @('PG_HOST','PG_PORT','PG_DATABASE','PG_USER','PG_PASSWORD','API_PORT')
$AmbienteAnterior = @{}
foreach ($NomeVariavel in $VariaveisProjeto) { $AmbienteAnterior[$NomeVariavel] = [Environment]::GetEnvironmentVariable($NomeVariavel, 'Process') }
$ProcessosIniciados = @()
function Testar-PortaLivre([int]$PortaProjeto) {
    $TesteProjeto = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $PortaProjeto)
    try { $TesteProjeto.Start() } catch { throw "A porta $PortaProjeto está ocupada. Nenhum processo existente será encerrado." }
    finally { $TesteProjeto.Stop() }
}
function Iniciar-ProcessoProjeto([string]$NomeProjeto, [string[]]$ArgumentosProjeto) {
    $ProcessoProjeto = Start-Process -FilePath $NodeProjeto -ArgumentList $ArgumentosProjeto -WorkingDirectory $RaizProjeto -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $RuntimeProjeto "$NomeProjeto.log") -RedirectStandardError (Join-Path $RuntimeProjeto "$NomeProjeto.err.log")
    return @{ name=$NomeProjeto; pid=$ProcessoProjeto.Id; startedAt=$ProcessoProjeto.StartTime.ToUniversalTime().ToString('o'); executable=$NodeProjeto }
}
try {
    Testar-PortaLivre 3002
    if (-not $SemInterface) { Testar-PortaLivre 5173 }
    if ($BancoJaIniciado) {
        $ConexaoBancoProjeto = [Net.Sockets.TcpClient]::new()
        try { $ConexaoBancoProjeto.Connect('127.0.0.1',5434) }
        finally { $ConexaoBancoProjeto.Dispose() }
    } else {
        & (Join-Path $RaizProjeto 'banco/scripts/iniciar.ps1')
    }
    $env:PG_HOST='localhost'; $env:PG_PORT='5434'; $env:PG_DATABASE='dados'; $env:API_PORT='3002'
    if (-not $env:PG_USER) { $env:PG_USER = Read-Host 'Usuário PostgreSQL [API]'; if (-not $env:PG_USER) { $env:PG_USER='API' } }
    if (-not $env:PG_PASSWORD) {
        $SenhaProjeto = Read-Host 'Senha PostgreSQL' -AsSecureString
        $PonteiroSenha = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SenhaProjeto)
        try { $env:PG_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($PonteiroSenha) }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($PonteiroSenha) }
    }
    New-Item -ItemType Directory -Path $RuntimeProjeto -Force | Out-Null
    $ProcessosIniciados += Iniciar-ProcessoProjeto 'api' @('--max-old-space-size=4096','api-server/server.js')
    $ApiPronta = $false
    for ($TentativaProjeto=0; $TentativaProjeto -lt 60; $TentativaProjeto++) {
        try {
            $SaudeProjeto = Invoke-RestMethod 'http://127.0.0.1:3002/api/v1/health' -TimeoutSec 2
            if ($SaudeProjeto.dataVersion) { $ApiPronta=$true; break }
        } catch { }
        if (-not (Get-Process -Id $ProcessosIniciados[0].pid -ErrorAction SilentlyContinue)) { break }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ApiPronta) { throw 'A API não conectou à carga publicada. Confira .local/runtime/api.err.log e as credenciais.' }
    if (-not $SemInterface) { $ProcessosIniciados += Iniciar-ProcessoProjeto 'interface' @('node_modules/vite/bin/vite.js','--host','127.0.0.1') }
    @{ root=$RaizProjeto; processes=@($ProcessosIniciados) } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $RuntimeProjeto 'processos.json') -Encoding UTF8
    Write-Host 'Aplicação compilada: http://127.0.0.1:3002'
    if (-not $SemInterface) { Write-Host 'Interface de desenvolvimento: http://127.0.0.1:5173' }
} catch {
    foreach ($RegistroProjeto in $ProcessosIniciados) {
        $ProcessoProjeto = Get-Process -Id $RegistroProjeto.pid -ErrorAction SilentlyContinue
        if ($ProcessoProjeto -and $ProcessoProjeto.StartTime.ToUniversalTime().ToString('o') -eq $RegistroProjeto.startedAt) { $ProcessoProjeto.Kill() }
    }
    throw
} finally {
    foreach ($NomeVariavel in $VariaveisProjeto) { [Environment]::SetEnvironmentVariable($NomeVariavel, $AmbienteAnterior[$NomeVariavel], 'Process') }
}
