# ==========================================================
# ANTIGRAVITY SESSION MANAGER (V15 - READ FROM SOURCE)
# ==========================================================
# Root cause fixed: Instead of parsing WMI command lines (which
# never contained project paths), we now read Antigravity's own
# storage.json to get the real workspace folders. On restore,
# we let Antigravity handle its own window restoration natively,
# which also restores chat history.
#
# Rules from @powershell-windows:
#   - Parentheses on all logical operators
#   - ASCII only
#   - Null checks before access
#   - ConvertTo-Json -Depth 10
#   - Get-Content -Raw for JSON reads
#   - Join-Path for all paths
# ==========================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

$SessionFile = Join-Path $env:USERPROFILE "work_session.json"
$MattermostLnk = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Chrome Apps\Mattermost.lnk"
$AntigravityStorage = Join-Path $env:APPDATA "Antigravity\User\globalStorage\storage.json"

function Save-Session {
    Write-Host "[1/4] Scanning open apps..." -ForegroundColor Cyan

    # --- [A] Capture File Explorer folders ---
    $explorerObj = New-Object -ComObject Shell.Application
    $windows = $explorerObj.Windows()
    $openFolders = @()
    if ($windows) {
        $openFolders = @($windows | ForEach-Object {
            try { $_.Document.Folder.Self.Path } catch { $null }
        } | Where-Object { $_ })
    }

    # --- [B] Capture Antigravity project folders from its OWN storage ---
    # This is the CORRECT source of truth. No more WMI guessing.
    $agProjects = @()
    $hasAntigravity = $false
    $agProc = Get-Process -Name "Antigravity" -ErrorAction SilentlyContinue
    if ($agProc) {
        $hasAntigravity = $true
        if (Test-Path $AntigravityStorage) {
            try {
                $agStorage = Get-Content $AntigravityStorage -Raw | ConvertFrom-Json
                $wsState = $agStorage.windowsState

                # Collect the lastActiveWindow folder
                if ($wsState.lastActiveWindow -and $wsState.lastActiveWindow.folder) {
                    $decoded = [System.Uri]::UnescapeDataString($wsState.lastActiveWindow.folder) -replace "^file:///", ""
                    # Convert forward slashes to backslashes for Windows
                    $decoded = $decoded -replace "/", "\"
                    if (($decoded) -and ($decoded -notmatch "System32|WindowsPowerShell|AppData|Temp")) {
                        $agProjects += $decoded
                    }
                }

                # Collect all openedWindows folders
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
            catch {
                Write-Host "[WARN] Could not parse Antigravity storage: $_" -ForegroundColor Yellow
            }
        }
    }

    # --- [C] Check Mattermost ---
    $mmProcs = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -match "Mattermost" }
    $hasMattermost = ($mmProcs -ne $null)

    # --- [D] Save to JSON ---
    $SessionData = @{
        Folders       = @($openFolders)
        Projects      = @($agProjects)
        HasAntigravity = $hasAntigravity
        Mattermost    = $hasMattermost
    }
    $SessionData | ConvertTo-Json -Depth 10 | Out-File $SessionFile -Encoding UTF8
    Write-Host "[OK] Session saved:" -ForegroundColor Green
    Write-Host "     Folders: $($openFolders.Count)" -ForegroundColor Gray
    Write-Host "     Antigravity Projects: $($agProjects -join ', ')" -ForegroundColor Gray
    Write-Host "     Mattermost: $hasMattermost" -ForegroundColor Gray

    # --- STEP 2: GRACEFUL CLOSE ---
    Write-Host "[2/4] Closing all apps gracefully..." -ForegroundColor Yellow

    # Close File Explorer windows via COM
    if ($windows) {
        $windows | ForEach-Object { try { $_.Quit() } catch {} }
    }

    # Send CloseMainWindow to all visible apps (NO force kill!)
    $allApps = Get-Process -ErrorAction SilentlyContinue | Where-Object {
        ($_.MainWindowHandle -ne 0) -and ($_.ProcessName -notmatch "powershell|cmd|conhost|explorer")
    }
    if ($allApps) {
        foreach ($app in $allApps) {
            try { $app.CloseMainWindow() | Out-Null } catch {}
        }
    }

    # --- STEP 3: WAIT FOR ANTIGRAVITY TO FULLY SAVE AND EXIT ---
    Write-Host "[3/4] Waiting for Antigravity to save chat history and exit..." -ForegroundColor Yellow
    $waitMax = 45
    $waited = 0
    while ($waited -lt $waitMax) {
        $remaining = Get-Process -Name "Antigravity" -ErrorAction SilentlyContinue
        if (-not $remaining) {
            Write-Host "[OK] Antigravity exited cleanly after $waited seconds." -ForegroundColor Green
            break
        }
        Start-Sleep -Seconds 3
        $waited += 3
        Write-Host "  [...] Antigravity still saving ($waited s / $waitMax s max)..."
    }

    # Wait for Chrome to save its tab session
    Write-Host "Waiting for Chrome to save tabs..."
    $waited = 0
    while ($waited -lt 20) {
        $chromeProc = Get-Process -Name "chrome" -ErrorAction SilentlyContinue
        if (-not $chromeProc) {
            Write-Host "[OK] Chrome exited cleanly." -ForegroundColor Green
            break
        }
        Start-Sleep -Seconds 3
        $waited += 3
    }

    # Final buffer for any disk flushes
    Start-Sleep -Seconds 2

    # --- STEP 4: SHUTDOWN (NO /f flag - let Windows finalize) ---
    Write-Host "[4/4] All apps saved. Shutting down NOW." -ForegroundColor Red
    C:\Windows\System32\shutdown.exe /s /t 2
    exit
}

function Restore-Session {
    if (-not (Test-Path $SessionFile)) {
        Write-Host "[!] No session file found at $SessionFile" -ForegroundColor Red
        exit
    }

    $data = Get-Content $SessionFile -Raw | ConvertFrom-Json

    # --- 1. Restore Folders (maximized) ---
    if ($data.Folders -and ($data.Folders.Count -gt 0)) {
        foreach ($f in $data.Folders) {
            if (($f) -and (Test-Path $f)) {
                Start-Process "explorer.exe" -ArgumentList "`"$f`"" -WindowStyle Maximized
                Start-Sleep -Milliseconds 500
            }
        }
    }

    # --- 2. Restore Antigravity ---
    # CRITICAL: Do NOT pass folder arguments! Antigravity's own windowsState
    # in storage.json handles multi-window restoration natively when it starts
    # without arguments. Passing a path would OVERRIDE windowsState and lose
    # the chat history context.
    if ($data.HasAntigravity) {
        Start-Process "antigravity"
        Start-Sleep -Seconds 2
    }

    # --- 3. Restore Chrome (uses "Continue where you left off" setting) ---
    Start-Process "chrome.exe"
    Start-Sleep -Seconds 1

    # --- 4. Restore Mattermost ---
    if (($data.Mattermost) -and (Test-Path $MattermostLnk)) {
        Start-Sleep -Seconds 1
        Invoke-Item $MattermostLnk
    }

    Write-Host "[OK] Session restored." -ForegroundColor Green

    # Close this script window cleanly
    $host.SetShouldExit(0)
    exit
}

# --- Entry Point ---
if ($args[0] -eq "save") { Save-Session }
elseif ($args[0] -eq "restore") { Restore-Session }
else { Write-Host "[!] Usage: SessionManager.ps1 save|restore" -ForegroundColor Red }
