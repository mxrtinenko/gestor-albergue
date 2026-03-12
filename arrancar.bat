@echo off
:: Fuerza al script a trabajar en el directorio donde está el archivo .bat
cd /d "%~dp0"

echo ==========================================
echo    INICIANDO GESTOR DE ALOJAMIENTO
echo    Ruta base: %CD%
echo ==========================================

:: VERIFICACIÓN 1: BACKEND
if exist "backend" (
    echo [OK] Carpeta backend encontrada.
    echo Lanzando Python...
    start "CEREBRO PYTHON" cmd /k "cd backend && call venv\Scripts\activate && python main.py"
) else (
    echo [ERROR] No encuentro la carpeta 'backend'.
    pause
    exit
)

:: Espera de seguridad
timeout /t 3 /nobreak >nul

:: VERIFICACIÓN 2: FRONTEND
if exist "frontend" (
    echo [OK] Carpeta frontend encontrada.
    echo Lanzando React...
    start "FACHADA REACT" cmd /k "cd frontend && npm run dev -- --host"
) else (
    echo [ERROR] No encuentro la carpeta 'frontend'.
    pause
    exit
)

echo.
echo ==========================================
echo    TODO ARRANCADO CORRECTAMENTE
echo ==========================================
echo Esta ventana se cerrara en 5 segundos...
timeout /t 5
exit