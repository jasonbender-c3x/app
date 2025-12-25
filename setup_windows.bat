@echo off
setlocal
echo ==========================================
echo      Meowstik Environment Setup
echo ==========================================

REM Check for Winget
where winget >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Winget is not installed. Please update Windows or install App Installer from Microsoft Store.
    echo You will need to manually install Node.js and FFmpeg.
    pause
    exit /b 1
)

REM Check for Node.js
node -v >nul 2>nul
if %errorlevel% neq 0 (
    echo [INFO] Node.js not found. Installing via Winget...
    winget install -e --id OpenJS.NodeJS.LTS
    
    REM Refresh environment variables for the current session
    call RefreshEnv.cmd >nul 2>nul
    
    if %errorlevel% neq 0 (
        echo [WARNING] Could not automatically install Node.js.
        echo Please install it manually from https://nodejs.org/
    )
) else (
    echo [OK] Node.js is already installed.
)

REM Check for FFmpeg
ffmpeg -version >nul 2>nul
if %errorlevel% neq 0 (
    echo [INFO] FFmpeg not found. Installing via Winget...
    winget install -e --id Gyan.FFmpeg
    
    if %errorlevel% neq 0 (
        echo [WARNING] Could not automatically install FFmpeg.
        echo Please install it manually or ensure it is in your PATH.
    )
) else (
    echo [OK] FFmpeg is already installed.
)

REM Install Project Dependencies
echo.
echo [INFO] Installing project dependencies (npm install)...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed. Ensure Node.js is installed and in your PATH.
    echo You might need to restart your terminal or computer if you just installed Node.js.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo      Setup Complete!
echo ==========================================
echo.
echo You can now run the app using: npm run dev
pause
