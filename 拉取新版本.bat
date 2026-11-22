@echo off
REM ============================================================
REM  云境 · 拉取新版本（一条命令）
REM  1) 拉取上游最新版本
REM  2) 在 云境\versions\vX.Y.Z\ 自动建该版本的文件夹
REM  3) 把该版本完整文件放进去（附「版本信息.txt」）
REM  用法：双击本文件，或在命令行执行  拉取新版本.bat
REM ============================================================
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [!] 没有找到 node，请先安装 Node.js 18+ 或把 node 加入 PATH
  pause
  exit /b 1
)

echo.
echo === 拉取云境最新版本，并建立版本快照 ===
echo.
node scripts\snapshot-version.mjs --pull
if errorlevel 1 (
  echo.
  echo [!] 拉取或建快照失败，详见上面的提示
  pause
  exit /b 1
)

echo.
echo === 已完成的版本快照 ===
node scripts\snapshot-version.mjs --list
echo.
echo 提示：版本文件夹在 云境\versions\ 下，每个文件夹都是一份可直接运行的完整工程。
echo.
pause
