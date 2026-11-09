@echo off
title Radar Universitario Web
cd /d "%~dp0"
echo Iniciando servidor do Radar Universitario...
if exist "C:\TI\node\node.exe" (
    "C:\TI\node\node.exe" scripts\server.js
) else (
    node scripts\server.js
)
pause
