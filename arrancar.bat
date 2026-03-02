@echo off
echo ==========================================
echo    INICIANDO GESTOR DE ALOJAMIENTO
echo ==========================================

:: 1. Arrancar el Backend (Python) en una ventana nueva
:: Entra en la carpeta backend, activa el entorno virtual y lanza el servidor
start "CEREBRO PYTHON" cmd /k "cd backend && call venv\Scripts\activate && python main.py"

:: Esperamos 2 segundos para que Python arranque un poco
timeout /t 2 /nobreak >nul

:: 2. Arrancar el Frontend (React) en otra ventana nueva
:: Entra en frontend y lanza el servidor visible para la red
start "FACHADA REACT" cmd /k "cd frontend && npm run dev -- --host"

:: 3. Mensaje final y cierre de esta ventana lanzadora
echo.
echo Todo arrancado correctamente.
echo Ya puedes escanear DNIs con el movil.
echo.
echo Esta ventana se cerrara en 5 segundos...
timeout /t 5
exit