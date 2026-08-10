@echo off
chcp 65001 >nul
title ecommerce store

REM Auto-generated start script for ecommerce store

set "DEFAULT_PORT=3007"
set "START_COMMAND=npm start"

REM Auto-find free port
set "PORT=%DEFAULT_PORT%"
:find_free_port
netstat -ano | findstr ":%PORT% " >nul 2>nul
if %errorlevel% equ 0 (
    set /a "PORT+=1"
    goto :find_free_port
)

if not "%PORT%"=="%DEFAULT_PORT%" (
    echo   [!] Port %DEFAULT_PORT% was in use, using %PORT% instead
)
echo   Starting ecommerce store on port %PORT%...
echo.

cd /d "%~dp0"
set "PORT=%PORT%"
call %START_COMMAND%
