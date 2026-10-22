param([switch]$Serve)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$projectDir = Split-Path $PSScriptRoot -Parent
Set-Location $projectDir
New-Item -ItemType Directory -Path 'logs' -Force | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
Start-Transcript -Path (Join-Path $projectDir "logs/build-$stamp.log")
function Invoke-Checked([string]$Command, [string[]]$Arguments) {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Command failed with exit code $LASTEXITCODE" }
}
try {
    foreach ($name in @('cargo', 'rustc', 'rustup', 'node', 'npm')) {
        if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
            throw "Missing $name. Install Rust from https://rustup.rs and Node.js from https://nodejs.org, then reopen PowerShell."
        }
    }
    Invoke-Checked -Command 'rustc' -Arguments @('--version')
    Invoke-Checked -Command 'cargo' -Arguments @('test', '--locked')
    Invoke-Checked -Command 'npm' -Arguments @('ci')
    Invoke-Checked -Command 'npm' -Arguments @('test')
    Invoke-Checked -Command 'rustup' -Arguments @('target', 'add', 'wasm32-unknown-unknown')
    Invoke-Checked -Command 'cargo' -Arguments @('build', '--locked', '--release', '--target', 'wasm32-unknown-unknown')
    Copy-Item 'target/wasm32-unknown-unknown/release/relief_forge.wasm' 'web/engine.wasm' -Force
    Invoke-Checked -Command 'node' -Arguments @('scripts/check-wasm.mjs')
    Write-Host 'PASS: Rust native tests, JavaScript tests and WASM integration checks.' -ForegroundColor Green
} finally { Stop-Transcript }
if ($Serve) { Invoke-Checked -Command 'npm' -Arguments @('run', 'serve') }
