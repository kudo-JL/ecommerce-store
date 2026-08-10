@echo off
chcp 65001 >nul
title %~n0

REM ============================================
REM   AUTO-GENERATED for: ecommerce store
REM   Default port: 3007
REM ============================================


REM ===================
REM   CUSTOMIZE HERE
REM ===================

set "PROJECT_NAME=ecommerce store"
set "DEFAULT_PORT=3007"
set "START_COMMAND=npm start"
set "INSTALL_COMMAND=npm install"
set "DATA_FOLDER=data"


REM ============================================
REM   Don't edit below
REM ============================================

cls
echo.
echo ========================================
echo   %PROJECT_NAME% - Setup
echo ========================================
echo.

REM ---------- Check Node.js ----------
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo   [X] Node.js is NOT installed!
    echo.
    echo   Download from: https://nodejs.org
    echo   Then run this script again.
    echo.
    pause
    exit /b 1
)

echo   [OK] Node.js found:
node --version
echo.

REM ---------- Create data folder ----------
if not "%DATA_FOLDER%"=="" (
    if not exist "%DATA_FOLDER%" (
        mkdir "%DATA_FOLDER%"
        echo   [OK] %DATA_FOLDER% folder created
    ) else (
        echo   [OK] %DATA_FOLDER% folder exists
    )
    echo.
)

REM ---------- Install dependencies ----------
if not exist "node_modules" (
    echo   [...] Installing packages (one-time only)
    echo.
    call %INSTALL_COMMAND%
    if %errorlevel% neq 0 (
        echo.
        echo   [X] Installation failed. Check your internet connection.
        pause
        exit /b 1
    )
    echo.
    echo   [OK] Packages installed successfully
) else (
    echo   [OK] Packages already installed (skipping)
)

echo.
echo ========================================
echo   [OK] Everything is ready!
echo ========================================
echo.

REM ---------- Auto-find a free port ----------
set "PORT=%DEFAULT_PORT%"
:find_free_port
netstat -ano | findstr ":%PORT% " >nul 2>nul
if %errorlevel% equ 0 (
    set /a "PORT+=1"
    if %PORT% gtr 65535 (
        echo   [X] No free port found up to 65535!
        echo       Close some apps and try again.
        pause
        exit /b 1
    )
    goto :find_free_port
)

if not "%PORT%"=="%DEFAULT_PORT%" (
    echo   [!] Port %DEFAULT_PORT% was in use, using %PORT% instead
) else (
    echo   [OK] Port %PORT% is free
)
echo.

echo   Press any key to start %PROJECT_NAME% now...
pause >nul

REM ---------- Start the project ----------
cd /d "%~dp0"
set "PORT=%PORT%"
call %START_COMMAND%
