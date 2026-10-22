param(
    [string]$BinaryPath,
    [string]$GhidraDirectory = $env:GHIDRA_INSTALL_DIR,
    [string]$JdkDirectory = $env:JAVA_HOME,
    [switch]$InspectBinary
)
# Read-only local collection. Does not change ArtCAM files or upload collected evidence.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$projectDir = Split-Path $PSScriptRoot -Parent
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$evidenceDir = Join-Path $projectDir "evidence/private/artcam-$stamp"
New-Item -ItemType Directory -Path $evidenceDir -Force | Out-Null
Start-Transcript -Path (Join-Path $evidenceDir 'collection.log')
function Save-Command([string]$Name, [string[]]$Arguments) {
    $text = & rea @Arguments 2>&1 | Out-String
    $exitCode = $LASTEXITCODE
    $text | Set-Content -Encoding UTF8 -Path (Join-Path $evidenceDir "$Name.txt")
    [pscustomobject]@{at=(Get-Date).ToString('o');command='rea';arguments=$Arguments;exit_code=$exitCode} |
        ConvertTo-Json -Compress | Add-Content -Encoding UTF8 -Path (Join-Path $evidenceDir 'actions.jsonl')
    if ($exitCode -ne 0) { Write-Warning "$Name failed ($exitCode). See saved output." }
}
try {
    $processes = @(Get-Process | Where-Object { $_.ProcessName -match '(?i)artcam' })
    $processes | Select-Object Id, ProcessName, Path, MainWindowTitle |
        ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 -Path (Join-Path $evidenceDir 'artcam-processes.json')
    if (-not $BinaryPath) {
        $candidates = @($processes | ForEach-Object { $_.Path } | Where-Object { $_ } | Select-Object -Unique)
        if ($candidates.Count -ne 1) { throw 'Cannot select one ArtCAM EXE. Run with -BinaryPath C:\full\path\ArtCAM.exe' }
        $BinaryPath = $candidates[0]
    }
    $binary = Get-Item -LiteralPath $BinaryPath
    $hash = Get-FileHash -LiteralPath $binary.FullName -Algorithm SHA256
    [pscustomobject]@{
        collected_at=(Get-Date).ToString('o');path=$binary.FullName;size=$binary.Length;
        sha256=$hash.Hash;file_version=$binary.VersionInfo.FileVersion;
        product_version=$binary.VersionInfo.ProductVersion;
        note='Local read-only evidence. No ArtCAM binaries copied or uploaded.'
    } | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 -Path (Join-Path $evidenceDir 'target.json')
    if ($GhidraDirectory) { $env:GHIDRA_INSTALL_DIR = $GhidraDirectory }
    if ($JdkDirectory) { $env:JAVA_HOME = $JdkDirectory }
    $env:REA_ANALYSIS_PROVIDER = 'ghidra'
    if (-not (Get-Command rea -ErrorAction SilentlyContinue)) {
        throw 'REA command is unavailable. Official installation: npm install --global rea-agents. Then restart PowerShell. No automatic installation performed.'
    }
    Save-Command -Name 'rea-version' -Arguments @('--version')
    Save-Command -Name 'rea-help' -Arguments @('--help')
    Save-Command -Name 'rea-doctor' -Arguments @('doctor','--json')
    Save-Command -Name 'rea-providers' -Arguments @('providers','--json')
    if ($InspectBinary) {
        # First native import can take several minutes. Capture diagnostics before targeted queries.
        Save-Command -Name 'artcam-inspect' -Arguments @('inspect',$binary.FullName,'--provider','ghidra','--json')
        Save-Command -Name 'search-help' -Arguments @('search','--help')
        foreach ($term in @('Vector Doctor','Coincident','Remove Loops','Duplicate')) {
            $safeName = $term.Replace(' ','-').ToLowerInvariant()
            Save-Command -Name "strings-$safeName" -Arguments @('search',$binary.FullName,$term,'--kind','strings','--provider','ghidra','--json')
        }
    }
    Write-Host "Evidence saved to: $evidenceDir" -ForegroundColor Green
} finally { Stop-Transcript }
