# Automation Scripts: Workspace Management

This directory contains the automation scripts used to manage the development environment and Antigravity sessions.

## 1. SessionManager.ps1 (The Core)
This is a PowerShell script that captures and restores the state of your entire workspace.

- **How to Save**:
  ```powershell
  ./SessionManager.ps1 save
  ```
  - Scans all open File Explorer windows.
  - Queries Antigravity's internal storage for active project folders.
  - Checks if Mattermost and Chrome are running.
  - Gracefully closes apps and **shuts down the laptop**.
  
- **How to Restore**:
  ```powershell
  ./SessionManager.ps1 restore
  ```
  - Reopens all previously open File Explorer folders.
  - Launches Antigravity (which natively restores your windows and chat history).
  - Restores Chrome tabs and Mattermost.

## 2. run.bat
A convenience batch file to quickly bootstrap a project.
- Detects if `package.json` exists in the current folder.
- Opens the folder in Antigravity.
- Automatically starts `npm run dev` in a new terminal window.

## 3. agv.bat
A simple shorthand alias for the `antigravity` command. 
Instead of typing `antigravity .`, you can just type `agv .`.

## 4. Initialization & Testing
- `test_paths.ps1`: Used to verify that project paths are correctly resolved on this system.
- `test_save_dryrun.ps1`: Used to test the "save" logic without actually shutting down the computer.

## Setup on New Laptop (Step-by-Step)

Follow these steps exactly to restore your automated workspace on the new system:

### Step 1: Create the Scripts Directory
Open PowerShell as **Administrator** and create the dedicated folder:
```powershell
New-Item -Path "C:\" -Name "scripts" -ItemType "Directory" -Force
```

### Step 2: Restore the Script Files
1. Clone the `notification_dashboard_nestjs` repository.
2. Copy all files from the `scripts/` folder in the project to `C:\scripts\`.
3. You should see `SessionManager.ps1`, `agv.bat`, and `run.bat` in `C:\scripts\`.

### Step 3: Grant Execution Permissions
Windows restricts running scripts by default. In your Administrator PowerShell, run:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
```

### Step 4: Add to System PATH (Critical)
To use `agv` and `run` from any folder, you must add `C:\scripts` to your environment variables:
1. Press `Win + R`, type `sysdm.cpl`, and hit Enter.
2. Go to **Advanced** tab -> **Environment Variables**.
3. Under **User variables**, find `Path` and click **Edit**.
4. Click **New** and add `C:\scripts`.
5. Click **OK** on all windows. 
6. *Note: Restart your terminal/Antigravity for this to take effect.*

### Step 5: Verify Application Paths
`SessionManager.ps1` looks for Mattermost and Antigravity in standard locations:
- **Mattermost**: It expects a Chrome App shortcut at `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Chrome Apps\Mattermost.lnk`. If you install it differently, you may need to update line 23 of `SessionManager.ps1`.
- **Antigravity**: Ensure it is installed and the `antigravity` command works in your terminal.

### Step 6: Test the Setup
Before relying on it, run a dry-run test to ensure paths and permissions are correct:
```powershell
cd C:\scripts
.\test_save_dryrun.ps1
```
If it lists your open folders and Antigravity projects without errors, you are ready!

### Step 7: How to Use Daily
- **To Save & Shutdown**: Type `agv save` (if paths are set) or run `C:\scripts\SessionManager.ps1 save`.
- **To Restore Workspace**: Run `C:\scripts\SessionManager.ps1 restore` after logging in.

> [!TIP]
> You can create a Desktop Shortcut for `powershell.exe -File C:\scripts\SessionManager.ps1 restore` to launch your whole workspace with one click.
