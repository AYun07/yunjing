#!/usr/bin/env bash
# 云境智能体插件 · 安装脚本
# 把技能装到常见 agent 的技能目录；不联网、不写密钥、只复制文件。
set -e
SRC="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:-$HOME/.agents/skills/yunjing}"
mkdir -p "$TARGET"
cp -f "$SRC/SKILL.md" "$TARGET/SKILL.md"
cp -f "$SRC/yj.py" "$TARGET/yj.py"
chmod +x "$TARGET/yj.py"
echo "云境技能已安装到：$TARGET"
echo "验证：$TARGET/yj.py --repo <云境仓库根目录> list"
