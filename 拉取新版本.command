#!/bin/bash
# ============================================================
#  云境 · 拉取新版本（macOS / Linux，一条命令）
#  1) 拉取上游最新版本
#  2) 在 云境/versions/vX.Y.Z/ 自动建该版本的文件夹
#  3) 把该版本完整文件放进去（附「版本信息.txt」）
# ============================================================
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "[!] 没有找到 node，请先安装 Node.js 18+"
  exit 1
fi

echo
echo "=== 拉取云境最新版本，并建立版本快照 ==="
echo
node scripts/snapshot-version.mjs --pull

echo
echo "=== 已完成的版本快照 ==="
node scripts/snapshot-version.mjs --list
echo
echo "提示：版本文件夹在 云境/versions/ 下，每个文件夹都是一份可直接运行的完整工程。"
