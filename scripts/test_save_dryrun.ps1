# Dry-run test: runs the Save-Session logic without actually shutting down
Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

$SessionFile = Join-Path $env:USERPROFILE "work_session_TEST.json"
$AntigravityStorage = Join-Path $env:APPDATA "Antigravity\User\globalStorage\storage.json"

Write-Host "[TEST] Simulating Save-Session..." -ForegroundColor Cyan

# [A] Capture folders
$explorerObj = New-Object -ComObject Shell.Application
$windows = $explorerObj.Windows()
$openFolders = @()
if ($windows) {
    $openFolders = @($windows | ForEach-Object {
        try { $_.Document.Folder.Self.Path } catch { $null }
    } | Where-Object { $_ })
}
Write-Host "  Folders found: $($openFolders.Count)"
foreach ($f in $openFolders) { Write-Host "    - $f" }

# [B] Capture Antigravity projects from storage.json
$agProjects = @()
$hasAntigravity = $false
$agProc = Get-Process -Name "Antigravity" -ErrorAction SilentlyContinue
if ($agProc) {
    $hasAntigravity = $true
    if (Test-Path $AntigravityStorage) {
        $agStorage = Get-Content $AntigravityStorage -Raw | ConvertFrom-Json
        $wsState = $agStorage.windowsState

        if ($wsState.lastActiveWindow -and $wsState.lastActiveWindow.folder) {
            $decoded = [System.Uri]::UnescapeDataString($wsState.lastActiveWindow.folder) -replace "^file:///", ""
            $decoded = $decoded -replace "/", "\"
            if (($decoded) -and ($decoded -notmatch "System32|WindowsPowerShell|AppData|Temp")) {
                $agProjects += $decoded
            }
        }
        if ($wsState.openedWindows) {
            foreach ($w in $wsState.openedWindows) {
                if ($w.folder) {
                    $decoded = [System.Uri]::UnescapeDataString($w.folder) -replace "^file:///", ""
                    $decoded = $decoded -replace "/", "\"
                    if (($decoded) -and ($decoded -notmatch "System32|WindowsPowerShell|AppData|Temp")) {
                        $agProjects += $decoded
                    }
                }
            }
        }
        $agProjects = @($agProjects | Select-Object -Unique)
    }
}
Write-Host "  Antigravity running: $hasAntigravity"
Write-Host "  Projects found: $($agProjects.Count)"
foreach ($p in $agProjects) { Write-Host "    - $p" }

# [C] Check Mattermost
$mmProcs = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -match "Mattermost" }
$hasMattermost = ($mmProcs -ne $null)
Write-Host "  Mattermost running: $hasMattermost"

# [D] Save test JSON
$SessionData = @{
    Folders        = @($openFolders)
    Projects       = @($agProjects)
    HasAntigravity = $hasAntigravity
    Mattermost     = $hasMattermost
}
$SessionData | ConvertTo-Json -Depth 10 | Out-File $SessionFile -Encoding UTF8
Write-Host ""
Write-Host "[OK] Test session saved to: $SessionFile" -ForegroundColor Green
Write-Host ""
Write-Host "--- JSON Contents ---" -ForegroundColor Yellow
Get-Content $SessionFile -Raw
