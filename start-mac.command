#!/bin/bash
# 云境 · AI 短篇小说生成器 一键启动（Mac / Linux）
cd "$(dirname "$0")"
echo "============================================"
echo "  云境 · AI 短篇小说生成器"
echo "  本地服务启动中..."
echo "============================================"
echo "启动后浏览器将自动打开 http://localhost:8080"
echo "按 Ctrl+C 停止服务"
echo ""
(sleep 1 && (open http://localhost:8080 2>/dev/null || xdg-open http://localhost:8080 2>/dev/null)) &
python3 -m http.server 8080
