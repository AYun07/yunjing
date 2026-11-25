#!/bin/bash
# v6.3.14 回滚：从 _bak_v6314/ 还原改动前的核心文件。在项目根目录执行。
# 退回后版本 = v6.3.13（GitHub 远端当前 main）。
set -e
cd "$(dirname "$0")/.."
for f in story-framework.js js/time-axis.js sw.js studio.html DECISIONS.md; do
  if [ -f "_bak_v6314/$(basename "$f")" ]; then
    cp "_bak_v6314/$(basename "$f")" "$f"
    echo "已还原 $f"
  fi
done
echo "完成。版本号回退 6.3.13。"
echo "注意：本次改动涉及 IndexedDB 中的新键（fieldState/、floor/）。"
echo "回档脚本不会删除这些 IDB 数据；它们对旧版引擎不可见、无害。"
echo "如需彻底清理，请在浏览器 DevTools → Application → IndexedDB 删除 fieldState/ 与 floor/ 开头的键。"
