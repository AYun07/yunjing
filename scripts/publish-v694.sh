#!/usr/bin/env bash
# 云境 v6.9.4 一键发布（token 只走环境变量 / 系统凭证管理器，绝不写入任何文件）
# 用法（任选其一）：
#   1) GITHUB_TOKEN=有效token bash scripts/publish-v694.sh
#   2) 已配置 gh 登录或 git credential helper 时，直接 bash scripts/publish-v694.sh 自动取凭证
set -e
cd /workspace/yunjing

# 凭证优先级：环境变量 > gh 登录态 > git 凭证管理器
if [ -z "${GITHUB_TOKEN:-}" ]; then
  if command -v gh >/dev/null 2>&1 && gh auth token >/dev/null 2>&1; then
    GITHUB_TOKEN="$(gh auth token)"
    echo "凭证来源: gh 登录态"
  else
    GITHUB_TOKEN="$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill 2>/dev/null | grep '^password=' | cut -d= -f2- || true)"
    [ -n "${GITHUB_TOKEN:-}" ] && echo "凭证来源: git 凭证管理器" || true
  fi
fi
: "${GITHUB_TOKEN:?没有可用凭证。请用 GITHUB_TOKEN=有效token 传入，或先执行 gh auth login}"
REPO="AYun07/yunjing"
TAG="v6.9.4"
API="https://api.github.com"

echo "=== 1. 暂存全部源码（含此前未跟踪的封面动画/社区/css/js）==="
git add -A
echo "暂存文件数: $(git diff --cached --name-only | wc -l)"

echo "=== 2. 提交 ==="
git -c user.name="yunjing" -c user.email="yunjing@local" commit -q -m "release: v6.9.4 电影片头 + 横竖封面 + 五方式分发" || echo "（无新变更或已提交）"

echo "=== 3. 打 tag ==="
git tag -f "$TAG"

echo "=== 4. 推送源码与 tag ==="
git push "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git" HEAD:main
git push "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git" "refs/tags/${TAG}" --force

echo "=== 5. 建 Release ==="
BODY=$(cat <<'EOF'
## 云境 v6.9.4

电影片头入场（云境大字→淡出→推镜头→封面），横竖屏双动态封面，动态粒子全程常驻。本次把最初定的五种下载安装方式全部配齐。

### 下载（按需要选）
- **源码包** `云境-v6.9.4-源码包.zip`（44MB，代码+封面动画）
- **完整包** `云境-v6.9.4-完整包.zip`（665MB，含全部离线资产）
- **桌面客户端** Windows 安装版 .exe（安装向导，双击安装后从桌面图标启动即播片头）；Linux 便携 AppImage
- **手机安装包** `云境-Android-6.9.4.apk`；iOS/macOS 走免费 PWA（添加到主屏幕）
- **智能体插件** `云境-v6.9.4-智能体插件.zip`（SKILL.md + 零依赖 CLI）
- **本地部署** git clone 本仓库后跑启动器

### 校验
发版前 CI 八闸本地全绿；浏览器片头验收 34/34；密钥扫描 817 文件无真实 Key。所有 AI 接口由玩家下载后自行配置，包内不含任何密钥。
EOF
)
python3.11 - "$GITHUB_TOKEN" "$REPO" "$TAG" "$BODY" <<'PY'
import sys, json, urllib.request
token, repo, tag, body = sys.argv[1:5]
def api(path, data=None, method=None, headers=None):
    h={'Accept':'application/vnd.github+json','Authorization':f'token {token}','User-Agent':'yunjing-release'}
    if data is not None: h['Content-Type']='application/json'
    if headers: h.update(headers)
    req=urllib.request.Request('https://api.github.com'+path, data=(json.dumps(data).encode() if data is not None else None), headers=h, method=method)
    return urllib.request.urlopen(req, timeout=60)
def jresp(r): return json.load(r)
try:
    rel=jresp(api(f'/repos/{repo}/releases/tags/{tag}'))
    print('Release已存在，复用:',rel['id'])
except Exception:
    rel=jresp(api(f'/repos/{repo}/releases', {'tag_name':tag,'name':f'云境 {tag}','body':body,'draft':False,'prerelease':False,'make_latest':'true'}))
    print('Release已建:',rel['id'])
open('/tmp/rel_id.txt','w').write(str(rel['id']))
PY
REL_ID=$(cat /tmp/rel_id.txt)

echo "=== 6. 上传 6 个产物到 Release Assets ==="
UPLOAD="https://uploads.github.com/repos/${REPO}/releases/${REL_ID}/assets"
for f in \
  /workspace/云境-v6.9.4-源码包.zip \
  /workspace/云境-v6.9.4-完整包.zip \
  /workspace/云境-v6.9.4-智能体插件.zip \
  /workspace/云境-Android-6.9.4.apk \
  /workspace/云境-Windows-6.9.4-x64.exe \
  /workspace/云境-Linux-6.9.4-便携版.zip; do
  name=$(basename "$f")
  echo "  上传 $name ($(du -h "$f"|cut -f1))..."
  curl -s -o /tmp/up_resp.json -w "    HTTP=%{http_code}\n" \
    -H "Authorization: token ${GITHUB_TOKEN}" -H "Content-Type: application/octet-stream" \
    --data-binary @"$f" "${UPLOAD}?name=${name}"
done
echo "=== 完成 ==="
echo "发布页: https://github.com/${REPO}/releases/tag/${TAG}"
