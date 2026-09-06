@echo off
setlocal EnableExtensions EnableDelayedExpansion

title Quantum Ecosystem Setup

set "SCRIPT_DIR=%~dp0"
pushd "%SCRIPT_DIR%\.."

if not exist "ide\package.json" (
	echo error: Run setup.bat from the Quantum monorepo scripts folder.
	exit /b 1
)
if not exist "agent\package.json" (
	echo error: Missing agent\package.json
	exit /b 1
)
if not exist "cli\package.json" (
	echo error: Missing cli\package.json
	exit /b 1
)

set "SETUP_CLI=1"
set "SETUP_AGENT=1"
set "SETUP_IDE=1"
set "SKIP_INSTALL=0"
set "SKIP_BUILD=0"
set "LAUNCH_IDE=0"
set "VERIFY_ONLY=0"

:parse_args
if "%~1"=="" goto args_done
if /I "%~1"=="--help" goto show_help
if /I "%~1"=="-h" goto show_help
if /I "%~1"=="--setup-only" shift & goto parse_args
if /I "%~1"=="--launch-ide" set "LAUNCH_IDE=1" & shift & goto parse_args
if /I "%~1"=="--verify-only" set "VERIFY_ONLY=1" & shift & goto parse_args
if /I "%~1"=="--skip-cli" set "SETUP_CLI=0" & shift & goto parse_args
if /I "%~1"=="--skip-agent" set "SETUP_AGENT=0" & shift & goto parse_args
if /I "%~1"=="--skip-ide" set "SETUP_IDE=0" & shift & goto parse_args
if /I "%~1"=="--skip-install" set "SKIP_INSTALL=1" & shift & goto parse_args
if /I "%~1"=="--skip-build" set "SKIP_BUILD=1" & shift & goto parse_args
echo error: unknown argument %~1
exit /b 1

:args_done

echo.
echo Quantum Ecosystem Setup
echo Repository: %CD%
echo.

where bun >nul 2>&1
if errorlevel 1 (
	echo error: Bun is required. Install from https://bun.sh
	exit /b 1
)

if "%VERIFY_ONLY%"=="1" (
	if exist "%SCRIPT_DIR%verify.sh" (
		bash "%SCRIPT_DIR%verify.sh"
		set "ERR=!ERRORLEVEL!"
	) else (
		echo error: verify.sh not found. Use Git Bash or WSL for full verification.
		set "ERR=1"
	)
	popd
	exit /b !ERR!
)

set "SUBSYS_ARGS=--setup-only"
if "%SKIP_INSTALL%"=="1" set "SUBSYS_ARGS=%SUBSYS_ARGS% --skip-install"
if "%SKIP_BUILD%"=="1" set "SUBSYS_ARGS=%SUBSYS_ARGS% --skip-build"

if "%SETUP_CLI%"=="1" (
	echo.
	echo ==^> Setting up Quantum CLI
	echo.
	pushd cli
	call scripts\setup.sh %SUBSYS_ARGS%
	if errorlevel 1 exit /b 1
	popd
)

if "%SETUP_AGENT%"=="1" (
	echo.
	echo ==^> Setting up Quantum Agent Manager
	echo.
	pushd agent
	if exist scripts\setup.sh (
		bash scripts/setup.sh %SUBSYS_ARGS%
	) else (
		bun install
		if not "%SKIP_BUILD%"=="1" bun run build
	)
	if errorlevel 1 exit /b 1
	popd
)

if "%SETUP_IDE%"=="1" (
	echo.
	echo ==^> Setting up Quantum IDE
	echo.
	pushd ide
	set "IDE_ARGS=--setup-only"
	if "%SKIP_INSTALL%"=="1" set "IDE_ARGS=%IDE_ARGS% --skip-install"
	if "%SKIP_BUILD%"=="1" set "IDE_ARGS=%IDE_ARGS% --skip-compile"
	call scripts\setup.bat %IDE_ARGS%
	if errorlevel 1 exit /b 1
	popd
)

echo.
echo Quantum ecosystem setup complete.
echo   CLI:    cli\bin\quantum
echo   Agent:  cd agent ^&^& bun run dev
echo   IDE:    cd ide ^&^& scripts\code.bat
echo.

if "%LAUNCH_IDE%"=="1" (
	if not "%SETUP_IDE%"=="1" (
		echo error: --launch-ide requires IDE setup
		exit /b 1
	)
	call ide\scripts\code.bat
)

popd
exit /b 0

:show_help
echo Quantum ecosystem setup (Windows)
echo.
echo scripts\setup.bat                  Install + build all subsystems
echo scripts\setup.bat --launch-ide     Setup, then launch Quantum IDE
echo scripts\setup.bat --verify-only    Verify setup
echo scripts\setup.bat --skip-cli        Skip CLI
echo scripts\setup.bat --skip-agent      Skip Agent Manager
echo scripts\setup.bat --skip-ide        Skip IDE
echo.
popd
exit /b 0
