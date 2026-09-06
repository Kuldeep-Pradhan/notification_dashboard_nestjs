$AntigravityStorage = Join-Path $env:APPDATA "Antigravity\User\globalStorage\storage.json"
$agStorage = Get-Content $AntigravityStorage -Raw | ConvertFrom-Json
$ws = $agStorage.windowsState

Write-Host "--- Last Active Window ---"
$d = [System.Uri]::UnescapeDataString($ws.lastActiveWindow.folder) -replace "^file:///", "" -replace "/", "\"
Write-Host "  Path: $d"
$isSystem = $d -match "System32|WindowsPowerShell|AppData|Temp"
Write-Host "  Filtered out: $isSystem"

Write-Host ""
Write-Host "--- All Opened Windows ---"
foreach ($w in $ws.openedWindows) {
    $d2 = [System.Uri]::UnescapeDataString($w.folder) -replace "^file:///", "" -replace "/", "\"
    $isSystem2 = $d2 -match "System32|WindowsPowerShell|AppData|Temp"
    Write-Host "  Path: $d2  | Filtered: $isSystem2"
}
