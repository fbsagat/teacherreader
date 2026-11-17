@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title Teacher Reader - Servidor Local
cd /d "%~dp0"

echo ============================================================
echo  Teacher Reader - Servidor Local (Express + Vite)
echo ============================================================
echo.

rem --- 1. Node precisa existir e ser 22+ (npm start usa type stripping) ---
where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado no PATH.
  echo        Instale o Node 22 LTS em https://nodejs.org e rode de novo.
  echo.
  pause
  exit /b 1
)

set "NODE_RAW="
for /f "delims=" %%v in ('node -v 2^>nul') do set "NODE_RAW=%%v"
set "NODE_MAJOR=!NODE_RAW:~1,2!"
if "!NODE_MAJOR!"=="" set "NODE_MAJOR=0"
if !NODE_MAJOR! LSS 22 (
  echo [ERRO] Node !NODE_RAW! encontrado, mas o projeto precisa de Node 22.18 ou superior.
  echo        Atualize o Node em https://nodejs.org e rode de novo.
  echo.
  pause
  exit /b 1
)
echo [ok] Node !NODE_RAW!

rem --- 2. Dependencias ---
if not exist "node_modules\" (
  echo [..] node_modules ausente. Rodando "npm install" ^(pode demorar^)...
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERRO] Falha no "npm install". Veja as mensagens acima.
    pause
    exit /b 1
  )
  echo [ok] Dependencias instaladas.
) else (
  echo [ok] node_modules presente.
)

rem --- 3. Variaveis de ambiente (opcional: o servidor sobe sem GEMINI_API_KEY) ---
if not exist ".env" (
  echo [aviso] Sem arquivo .env: TTS/STT com Gemini ficam desativados neste ambiente.
  echo         Copie .env.example para .env e preencha GEMINI_API_KEY se quiser testar a IA.
) else (
  echo [ok] Arquivo .env encontrado.
)

rem --- 4. Porta 3000 ---
netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul 2>nul
if not errorlevel 1 (
  echo [aviso] A porta 3000 ja esta em uso. Se for outra instancia deste app,
  echo         feche-a antes; senao o servidor vai reclamar de EADDRINUSE.
)

echo.
echo ------------------------------------------------------------
echo  Abrindo http://localhost:3000 em alguns segundos...
echo  Para parar o servidor: Ctrl+C ou feche esta janela.
echo ------------------------------------------------------------
echo.

rem Abre o navegador em segundo plano (nao bloqueia o servidor).
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 4; Start-Process 'http://localhost:3000'"

call npm run dev
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%EXIT_CODE%"=="0" (
  echo [ERRO] O servidor terminou com codigo %EXIT_CODE%.
  echo        Causas comuns: porta 3000 ocupada, Node antigo ou erro de sintaxe.
) else (
  echo [ok] Servidor encerrado.
)
echo.
pause
endlocal
exit /b %EXIT_CODE%
