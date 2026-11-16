@echo off
title Yunjing CORS Proxy
chcp 65001 >nul 2>nul
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [!] 没找到 Node.js —— 本地跨域代理需要 Node 18 或更高版本。
  echo.
  echo       两条路可选：
  echo         1) 装一个 Node.js： https://nodejs.org/   然后重新双击本文件
  echo         2) 不装也行：在云境「接口设置」里改用一个【支持跨域的中转站】地址
  echo.
  pause
  exit /b 1
)
echo.
echo   正在启动云境本地跨域代理...
echo.
node "%~dp0tools\cors-proxy.mjs" %*
echo.
pause
