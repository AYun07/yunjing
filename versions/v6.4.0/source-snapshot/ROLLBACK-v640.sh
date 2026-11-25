#!/bin/bash
# v6.4.0 回滚：从 _bak_v640/ 还原改动前的核心文件。在项目根目录执行。
# 退回后版本 = v6.3.14（回滚前 GitHub 远端 main）。
set -e
cd "$(dirname "$0")/.."
echo "=== v6.4.0 回滚开始 ==="
for f in story-framework.js js/time-axis.js js/floor-state.js sw.js studio.html DECISIONS.md; do
  b="_bak_v640/$(basename "$f")"
  if [ -f "$b" ]; then
    cp "$b" "$f"
    echo "已还原 $f"
  else
    echo "警告：备份缺失 $b"
  fi
done
# 本次新增的独立模块/测试/文档，回退时需一并删除
for f in js/creation-hub.js js/fanwork-publisher.js js/github-client.js \
         test/creation-hub-regression.mjs test/v640-browser-check.mjs \
         docs/二创版块-设计契约-v6.4.0.md; do
  if [ -f "$f" ]; then
    rm -f "$f"
    echo "已删除新增文件 $f"
  fi
done
echo "=== 完成。版本号回退 6.3.14 ==="
echo "注意：二创版块为纯静态数据（仓库 community/ 目录 + 索引 JSON），"
echo "回滚不影响玩家本地存档。若已改动 SW_VER，回滚脚本已还原 sw.js。"
