#!/bin/bash
# 云境 · 本地跨域代理启动器（macOS / Linux）
# 首次使用若提示没有执行权限，在终端执行： chmod +x start-proxy-mac.command
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "  [!] 没找到 Node.js —— 本地跨域代理需要 Node 18 或更高版本。"
  echo ""
  echo "      两条路可选："
  echo "        1) 装一个 Node.js： https://nodejs.org/   然后重新运行本文件"
  echo "        2) 不装也行：在云境「接口设置」里改用一个【支持跨域的中转站】地址"
  echo ""
  read -n 1 -s -r -p "  按任意键退出"
  exit 1
fi

echo ""
echo "  正在启动云境本地跨域代理..."
echo ""
node tools/cors-proxy.mjs "$@"
echo ""
read -n 1 -s -r -p "  按任意键退出"
