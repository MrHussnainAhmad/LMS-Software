@echo off
setlocal EnableExtensions EnableDelayedExpansion

title Nisaab360 Desktop Build
cd /d "%~dp0"

echo.
echo ============================================================
echo   Nisaab360 Institution Panel - Full Desktop Build
echo ============================================================
echo.

REM --- Step 0: prerequisites ---
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not on PATH.
    echo         Install Node.js 20+ from https://nodejs.org/
    pause
    exit /b 1
)

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed or not on PATH.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo Using Node %NODE_VER%
echo.

REM --- Step 1: install dependencies ---
echo [1/5] Installing npm dependencies...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [FAILED] npm install
    pause
    exit /b %errorlevel%
)
echo.

REM --- Step 2: rebuild native SQLite module for Electron ---
echo [2/5] Rebuilding better-sqlite3 for Electron...
call npm run rebuild:native
if %errorlevel% neq 0 (
    echo.
    echo [FAILED] Native module rebuild. Try: npm run rebuild:native
    pause
    exit /b %errorlevel%
)
echo.

REM --- Step 3: TypeScript check ---
echo [3/5] Running TypeScript check...
call npx tsc --noEmit
if %errorlevel% neq 0 (
    echo.
    echo [FAILED] TypeScript errors found.
    pause
    exit /b %errorlevel%
)
echo.

REM --- Step 4: Vite production build ---
echo [4/5] Building frontend (Vite)...
call npx vite build
if %errorlevel% neq 0 (
    echo.
    echo [FAILED] Vite build
    pause
    exit /b %errorlevel%
)
echo.

REM --- Step 5: Electron installer ---
echo [5/5] Packaging Electron app (this may take a few minutes)...
call npx electron-builder
if %errorlevel% neq 0 (
    echo.
    echo [FAILED] electron-builder
    pause
    exit /b %errorlevel%
)

echo.
echo ============================================================
echo   BUILD SUCCESSFUL
echo ============================================================
echo.
echo Installer output:
echo   %~dp0dist-electron\
echo.
if exist "%~dp0dist-electron\Nisaab360 Setup 1.0.1.exe" (
    echo   Nisaab360 Setup 1.0.1.exe
) else (
    dir /b "%~dp0dist-electron\*.exe" 2>nul
)
echo.
echo First run: log in once with internet so data syncs to local SQLite.
echo.
pause
exit /b 0
