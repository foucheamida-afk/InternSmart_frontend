@echo off
title InternSmart - Ultimate All-in-One Launcher and Restarter
color 0A

echo =======================================================================
echo               INTERNSMART ULTIMATE SERVICE RESTARTER AND LAUNCHER
echo =======================================================================
echo.

:: -------------------------------------------------------------------------
:: STEP 1: Kill any processes already blocking the app ports
:: -------------------------------------------------------------------------
echo [1/4] Releasing blocked ports: 3000, 1234, 5173...
call :KILL_PORT 3000
call :KILL_PORT 1234
call :KILL_PORT 5173

echo Waiting 3 seconds for sockets to release...
timeout /t 3 /nobreak >nul
echo.

:: -------------------------------------------------------------------------
:: STEP 2: Ensure MySQL is running on port 3306
:: -------------------------------------------------------------------------
call :ENSURE_MYSQL
echo.

:: -------------------------------------------------------------------------
:: STEP 3: Launch Backend API Server (Port 3000)
:: -------------------------------------------------------------------------
echo [3/4] Starting Backend services...
echo [START] Launching Backend API Server on port 3000...
start "InternSmart - Backend (Port 3000)" /D "%~dp0server" cmd /k "node server.js"

echo [START] Launching Collaboration Server on port 1234...
start "InternSmart - Collab (Port 1234)" /D "%~dp0server" cmd /k "node collaboration.js"

echo.
echo Waiting for backend to become ready on port 3000...
call :WAIT_FOR_PORT 3000 20
echo.

:: -------------------------------------------------------------------------
:: STEP 4: Launch Frontend Client (Port 5173)
:: -------------------------------------------------------------------------
echo [4/4] Starting Frontend...
start "InternSmart - Frontend (Port 5173)" /D "%~dp0client" cmd /k "npm run dev"

echo.
echo =======================================================================
echo                  ALL INTERNSMART SERVICES STARTED!
echo =======================================================================
echo   MySQL Database       : port 3306
echo   Backend API          : http://localhost:3000
echo   Collaboration Server : ws://localhost:1234
echo   Frontend App         : http://localhost:5173
echo =======================================================================
echo.
echo Opening app in browser...
timeout /t 4 /nobreak >nul
start http://localhost:5173
goto :EOF


:: =========================================================================
:: SUBROUTINE: Kill any process listening on PORT
:: =========================================================================
:KILL_PORT
set _P=%~1
set _KILLED=0
for /f "tokens=5" %%A in ('netstat -aon ^| findstr ":%_P% " ^| findstr "LISTENING"') do (
    set _KILLED=1
    echo   [KILL] PID %%A found on port %_P% - terminating...
    taskkill /F /PID %%A >nul 2>&1
)
if "%_KILLED%"=="0" echo   [OK] Port %_P% is free.
goto :EOF


:: =========================================================================
:: SUBROUTINE: Ensure MySQL is running, start it if not
:: =========================================================================
:ENSURE_MYSQL
echo [2/4] Checking MySQL on port 3306...
set _DB=0
for /f "tokens=5" %%A in ('netstat -aon ^| findstr ":3306 " ^| findstr "LISTENING"') do set _DB=1

if "%_DB%"=="1" (
    echo   [OK] MySQL is already running.
    goto :EOF
)

echo   [START] MySQL is not running. Attempting to start...
if exist "C:\xampp\mysql_start.bat" (
    start "" /min cmd /c "C:\xampp\mysql_start.bat"
) else if exist "C:\xampp\mysql\bin\mysqld.exe" (
    start "" /min "C:\xampp\mysql\bin\mysqld.exe" --defaults-file="C:\xampp\mysql\bin\my.ini" --standalone
) else (
    echo   [WARN] Cannot find XAMPP MySQL. Start it manually via XAMPP Control Panel.
    goto :EOF
)

echo   Polling for MySQL on port 3306...
set _C=0
:DB_POLL
timeout /t 1 /nobreak >nul
set /a _C+=1
set _DB=0
for /f "tokens=5" %%A in ('netstat -aon ^| findstr ":3306 " ^| findstr "LISTENING"') do set _DB=1
if "%_DB%"=="1" (
    echo   [OK] MySQL is now running.
    goto :EOF
)
if %_C% LSS 12 goto :DB_POLL
echo   [WARN] MySQL did not respond after 12 seconds. Check XAMPP Control Panel.
goto :EOF


:: =========================================================================
:: SUBROUTINE: Poll until PORT is listening or timeout (in seconds)
:: =========================================================================
:WAIT_FOR_PORT
set _WP=%~1
set _MAX=%~2
set _N=0
:WFP_LOOP
timeout /t 1 /nobreak >nul
set /a _N+=1
set _OPEN=0
for /f "tokens=5" %%A in ('netstat -aon ^| findstr ":%_WP% " ^| findstr "LISTENING"') do set _OPEN=1
if "%_OPEN%"=="1" (
    echo   [READY] Port %_WP% is now listening. Backend is UP.
    goto :EOF
)
if %_N% LSS %_MAX% (
    echo   Waiting... %_N%/%_MAX%s
    goto :WFP_LOOP
)
echo   [WARN] Port %_WP% not responding after %_MAX% seconds. Backend may have crashed - check its console window.
goto :EOF
