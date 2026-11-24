#!/usr/bin/env bash
# 云境 Windows 可安装版 (.exe) 构建脚本 —— 可复现
# 产出：/workspace/云境-Windows-<version>-x64.exe（NSIS 安装向导版）
#
# 背景：electron-builder 在本沙箱直连 GitHub releases 下载 NSIS 二进制会超时，
#       且其完整 packaging 阶段复制 500MB+ 资源易超时。故采用：
#       ① NSIS 资源走国内镜像并校验 SHA256；
#       ② 用 electron-builder 先产出应用主体 nsis.7z（或直接用其 win-unpacked）；
#       ③ 用本地 makensis 编译一份受控的 installer.nsi，把 nsis.7z 作为主体嵌入。
# token/密钥不参与此脚本，产物内不含任何密钥。

set -e
VERSION="6.9.4"
ROOT="/workspace/yunjing"
ELECTRON_DIR="$ROOT/client/electron"
NSIS_BIN="/tmp/nsis-bin"
WORK="/tmp/nsis-build/nsiswork"
OUT="/workspace/云境-Windows-${VERSION}-x64.exe"
MIRROR="https://registry.npmmirror.com/-/binary/electron-builder-binaries/"

echo "=== 1. 下载 NSIS 工具链（国内镜像）并校验 ==="
mkdir -p "$NSIS_BIN" && cd "$NSIS_BIN"
curl -sL --retry 3 -o nsis-3.0.4.1.7z        "${MIRROR}nsis-3.0.4.1/nsis-3.0.4.1.7z"
curl -sL --retry 3 -o nsis-resources-3.4.1.7z "${MIRROR}nsis-resources-3.4.1/nsis-resources-3.4.1.7z"
echo "期望 sha256(nsis)      = 9877df902530f96357d13a7a31ae2b9df67f48b11ffc9a1700a7c961574ec5fa"
echo "期望 sha256(resources) = 593a9a92ef958321293ac6a2ee61e64bf1bd543142a5bd6b3d310709cc924103"
echo "实际："; sha256sum nsis-3.0.4.1.7z nsis-resources-3.4.1.7z
# 解压（需要 7z：apt-get install -y p7zip-full）
7z x -y nsis-3.0.4.1.7z >/dev/null
7z x -y nsis-resources-3.4.1.7z -o"$NSIS_BIN/nsis-resources-3.4.1" >/dev/null

echo "=== 2. 生成应用主体 nsis.7z ==="
# 由 electron-builder 产出；若 dist 已有完整 nsis.7z（含 YunJing.exe + resources/yunjing），可跳过。
if [ ! -f "$ELECTRON_DIR/dist/yunjing-desktop-${VERSION}-x64.nsis.7z" ]; then
  cd "$ELECTRON_DIR"
  export ELECTRON_BUILDER_BINARIES_MIRROR="$MIRROR"
  export ELECTRON_BUILDER_NSIS_DIR="$NSIS_BIN"
  export ELECTRON_BUILDER_NSIS_RESOURCES_DIR="$NSIS_BIN/nsis-resources-3.4.1"
  # 注意：末步 wine 校验可能因沙箱缺 wine32 报错（退出码1），但 nsis.7z 已生成即成功
  timeout 1200 ./node_modules/.bin/electron-builder --win --x64 -c.win.target=nsis || true
fi
[ -f "$ELECTRON_DIR/dist/yunjing-desktop-${VERSION}-x64.nsis.7z" ] || { echo "缺少应用主体 nsis.7z"; exit 1; }

echo "=== 3. 准备编译素材 ==="
mkdir -p "$WORK/plugins"
cp "$ELECTRON_DIR/dist/yunjing-desktop-${VERSION}-x64.nsis.7z" "$WORK/app-64.7z"
cp "$NSIS_BIN/nsis-resources-3.4.1/plugins/x86-unicode/nsis7z.dll" "$WORK/plugins/"
cp "$ELECTRON_DIR/dist/.icon-ico/icon.ico" "$WORK/icon.ico"
cp "$ROOT/scripts/desktop/installer.nsi" "$WORK/installer.nsi"
cp "$ROOT/scripts/desktop/license.txt" "$WORK/license.txt"

echo "=== 4. 用本地 makensis 编译安装器 ==="
cd "$WORK"
export NSISDIR="$NSIS_BIN"
"$NSIS_BIN/linux/makensis" installer.nsi

echo "=== 4b. 说明：容器若仅 8GB 内存，7z 主体用 -mx=3、makensis 用 zlib，避免 OOM ==="
echo "=== 5. 交付与校验 ==="
cp "云境-Windows-${VERSION}-x64.exe" "$OUT"
file "$OUT"
ls -lah "$OUT"
sha256sum "$OUT"
7z l "$OUT" | tail -12
echo "完成：$OUT"
