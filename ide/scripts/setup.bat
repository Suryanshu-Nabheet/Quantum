@echo off
setlocal EnableExtensions

title Quantum Dev Setup

pushd %~dp0\..

if not exist "package.json" (
	echo error: Run setup.bat from the Quantum repository root scripts folder.
	exit /b 1
)

findstr /C:"\"name\": \"quantum\"" package.json >nul 2>&1
if errorlevel 1 (
	echo error: Expected package name 'quantum' in package.json.
	exit /b 1
)

set "SETUP_ONLY=0"
set "LAUNCH_ONLY=0"
set "SKIP_INSTALL=0"
set "SKIP_COMPILE=0"
set "CODE_ARGS="

:parse_args
if "%~1"=="" goto args_done
if /I "%~1"=="--setup-only" set "SETUP_ONLY=1" & shift & goto parse_args
if /I "%~1"=="--launch-only" set "LAUNCH_ONLY=1" & set "SKIP_INSTALL=1" & set "SKIP_COMPILE=1" & shift & goto parse_args
if /I "%~1"=="--skip-install" set "SKIP_INSTALL=1" & shift & goto parse_args
if /I "%~1"=="--skip-compile" set "SKIP_COMPILE=1" & shift & goto parse_args
if /I "%~1"=="--help" goto show_help
if /I "%~1"=="-h" goto show_help
set "CODE_ARGS=%CODE_ARGS% %~1"
shift
goto parse_args

:args_done

echo Quantum dev setup (root: %CD%)

if "%SKIP_COMPILE%"=="0" goto check_out
if exist "out\main.js" goto node_check
echo error: --skip-compile requires an existing build (missing out\main.js).
exit /b 1

:check_out
:node_check
echo.
echo ==^> Checking Node.js (.nvmrc)
echo.
node -e "const fs=require('fs');const r=fs.readFileSync('.nvmrc','utf8').trim();const m=/^(\\d+)\\.(\\d+)\\.(\\d+)/.exec(r);if(!m)process.exit(1);const[rm,ri,rp]=m.slice(1).map(Number);const c=/^(\\d+)\\.(\\d+)\\.(\\d+)/.exec(process.versions.node);const[cm,ci,cp]=c.slice(1).map(Number);if(cm!==rm||ci<ri||(ci===ri&&cp<rp)){console.error('Node '+process.versions.node+' does not satisfy '+r);process.exit(1);}"
if errorlevel 1 (
	echo error: Install Node.js version from .nvmrc. See README.md.
	exit /b 1
)

if "%SKIP_INSTALL%"=="1" goto maybe_compile

echo.
echo ==^> Installing npm dependencies
echo.
set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
call npm install
if errorlevel 1 exit /b 1

:maybe_compile
if "%SKIP_COMPILE%"=="1" goto maybe_launch
echo.
echo ==^> Compiling sources (this may take several minutes)
echo.
call npm run compile
if errorlevel 1 exit /b 1

:maybe_launch
if "%SETUP_ONLY%"=="1" (
	echo.
	echo Setup complete.
	echo   Launch: scripts\code.bat
	echo   Fast:   scripts\setup.bat --launch-only
	exit /b 0
)

echo.
echo ==^> Launching Quantum
echo.
call scripts\code.bat %CODE_ARGS%
exit /b %ERRORLEVEL%

:show_help
echo Quantum dev setup (Windows)
echo.
echo   scripts\setup.bat                 Install, compile, and launch
echo   scripts\setup.bat --setup-only    Install and compile only
echo   scripts\setup.bat --launch-only   Launch only
echo   scripts\setup.bat --skip-install  Skip npm install
echo   scripts\setup.bat --skip-compile  Skip compile
echo.
echo See README.md for prerequisites.
popd
exit /b 0
