#!/bin/bash
# v6.3.12 回滚脚本：从 _bak_v6312/ 还原改动前的 11 个核心文件。
# 用法：在项目根目录执行 bash _bak_v6312/ROLLBACK-v6312.sh
set -e
cd "$(dirname "$0")/.."
for f in scripts/realm-ladders.mjs scripts/gen-realm-rules.mjs js/realm-rules.js \
         js/compare-engine.js js/compare-panel.js DECISIONS.md sw.js \
         studio.html opening.html map-verified.html; do
  if [ -f "_bak_v6312/$(basename "$f")" ]; then
    cp "_bak_v6312/$(basename "$f")" "$f"
    echo "已还原 $f"
  fi
done
echo "完成。如需重建规则档：node scripts/gen-realm-rules.mjs"
