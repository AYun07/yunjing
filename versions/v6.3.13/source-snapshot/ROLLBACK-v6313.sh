#!/bin/bash
# v6.3.13 回滚：从 _bak_v6313/ 还原改动前的核心文件。在项目根目录执行。
set -e
cd "$(dirname "$0")/.."
for f in scripts/realm-ladders.mjs scripts/gen-realm-rules.mjs js/realm-rules.js \
         js/compare-engine.js js/compare-panel.js DECISIONS.md sw.js \
         studio.html opening.html map-verified.html; do
  if [ -f "_bak_v6313/$(basename "$f")" ]; then
    cp "_bak_v6313/$(basename "$f")" "$f"
    echo "已还原 $f"
  fi
done
node scripts/gen-realm-rules.mjs >/dev/null 2>&1 || true
echo "完成。版本号回退 6.3.12。新增测试 test/v6313-browser-check.mjs 如不需要可手动删除。"
