@echo off
SETLOCAL

REM Check if package.json exists in current directory
IF EXIST "package.json" (
    echo [INFO] Node project detected.

    REM Open project in Antigravity
    antigravity .

    REM Start dev server in new terminal
    start "" cmd /K "npm run dev"
    
) ELSE (
    echo [ERROR] Not a Node project (package.json not found)
    echo [HINT] Make sure you are inside the correct project folder.
)

ENDLOCAL