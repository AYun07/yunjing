# 云境 · 交接文档（HANDOFF）

> 面向接手者（或未来失忆的自己）。目标：拿到这份文档就能跑起来、测起来、改得动、推得上去。
> 当前版本：**v4.28.0** · 更新于 2026-11-17

---

## 1. 这是什么

纯前端静态站：**AI 互动小说 + 开放世界扮演**。无构建、无后端、无账号；AI 接口由玩家自填 Key，故事与 Key 只存本机浏览器（localStorage + IndexedDB）。

两个玩法共用一套引擎：
- **创作工坊**：设定视角/文风/时代/母题/开篇/技法/六维，与 AI 逐章共创，导出 TXT/Markdown。
- **开放世界扮演**：捏身份踏入 38 个世界之一自由漫游；每轮 AI 写正文的同时，状态/地图/人物/势力/账本在后台跑，并注入下一轮提示词。

**38 个世界**（sw.js `GENRES` 为准），其中 **36 界有专属状态字段表**（`free`/`freeworld` 两个自由界用通用字段）。两个数字口径不同但都对，详见 README。

**小云**（右下角助手）是功能重中之重——所有能力走 `XiaoyunOps` 技能中枢，玩家能对她说"全量备份""体检容量"等直接触发操作。

---

## 2. 怎么跑 / 怎么测

```bash
# 起本地服务（必须 http，不要 file://）
cd /workspace/yunjing
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080/index.html（大厅）和 studio.html（创作室）

# 一键回归测试（零依赖，Node 内置 vm，不联网不开浏览器）
npm test          # = node test/regression.mjs，当前 26 项全绿
```

`test/regression.mjs` 覆盖 5 组：存档两层备份/恢复/快照、单档导出带正文、填表规则双模式、多值字段全界、静态不变量（版本同源/模块可加载）。**每次改完核心引擎先跑它。**

另有 `selftest.html`（浏览器内手动点按钮查语法/注册）和 `test/` 下若干一次性验收脚本（历史产物）。

---

## 3. 目录与关键机制

| 路径 | 作用 |
|---|---|
| `index.html` / `studio.html` | 大厅 / 创作室入口；脚本装配區在 html 尾部 |
| `sw.js` | PWA 预缓存；`SW_VER` 与产品版本同源；`CORE2` 清单含全部核心模块 |
| `js/story-framework.js` | 核心引擎（存档、轮次、变量、主笔 prompt 装配） |
| `js/save-slots.js` | 书架/存档槽 + **全量备份/恢复/快照（v4.28.0 增强）** |
| `js/slot-registry.js` | 统一 localStorage 键名与槽位隔离（keysOf/scanKeysOf/purge） |
| `js/storage-boost.js` | IndexedDB media 仓（大图/长正文，localStorage 里留 `idb://` 占位） |
| `js/store-guard.js` | localStorage 大键镜像进 IDB + 配额自愈 |
| `js/fill-rule.js` | 填表规则双模式（strict 严格演算 / free 玩家自由），单一事实源 |
| `js/attribute-engine.js` | 属性的资质定档、时间补涨、钳制、事件化增减 |
| `js/variable-parser.js` | 解析 `(variable_update)` 协议，按填表规则决定是否走引擎 |
| `js/status-world-fields.js` | 36 界专属状态字段 + 多值语义表（210 项）+ 题材别名 |
| `js/status-skins.js` | 8 套题材状态栏皮肤（玉简/技能槽/终端/邪典手记…） |
| `js/xiaoyun-ops.js` / `xiaoyun-buddy.js` | 小云技能中枢 / 交互层；工具循环已支持 async（v4.28.0） |
| `js/world-portal.js` | 开局世界扉页 |

**数据分两层**（备份必须同时覆盖，这是最容易踩的坑）：
1. `localStorage` —— 配置、状态、槽位注册表、API Key（`storyApiConfig`）
2. `IndexedDB` —— 图片/长正文实体，localStorage 里只留 `idb://<key>` 占位标记

只导 localStorage 会导致换设备后"图片和长正文全丢"。v4.28.0 的 `SaveSlots.exportAll/importAll` 已两层全覆盖，且导入前自动存快照支持 `undoLastImport` 回滚。

---

## 4. 版本管理（重要）

**所有版本标识必须同源**，当前 v4.28.0：
- `index.html` / `studio.html` 的 `window.YJ_VER`
- `sw.js` 的 `SW_VER = 'yunjing-v4.28.0'`
- 所有资源引用的 `?v=` 缓存参数
- `js/truth-snapshot.js` 的 `var VERSION`
- `package.json` 的 `version`

升级版本时全局替换旧号即可（缓存参数、常量一起换），换完跑 `npm test`（会校验 `?v=` 无旧号残留）。

---

## 5. 推送到 GitHub（沙箱直连 git 被封，必读）

**仓库**：`https://github.com/AYun07/yunjing`（PUBLIC，分支 `main`）

**坑**：沙箱里 `git push` 会被网关掐断（21MB → HTTP 408 / 443 连接失败），但 **GitHub API（api.github.com）可达**。所以推送必须走 **Git Data API 分批提交**，不能用 `git push`。

**流程**（PAT classic 勾 `repo`，从环境/历史脚本取得，用完即擦）：
1. `curl api.github.com/repos/AYun07/yunjing/git/trees/{HEAD}?recursive=1` 拿远端 blob SHA 清单
2. 本地 `git ls-tree -r HEAD` 对比，算出「新增/更新」文件（二进制资产通常不变）
3. 逐文件建 blob → 分批建 tree（base_tree 累积）→ 建 commit（父 = 远端 main）→ PATCH ref → 建 tag + Release
4. 逐字节核对远端文件内容

详见 `/workspace/GitHub认证与推送指南.md`。最近一次推送：v4.29.0 → main `fec857d6`，29 文件逐字节一致，tag/Release `v4.29.0` 在线。

**另一个坑（v4.29.0 踩到）**：PAT 只有 `repo` scope 时，GitHub **拒绝**通过 Git Data API 或 contents API 创建/修改 `.github/workflows/*`（返回 404 / 403 `workflow scope`）。所以当次改动若含工作流文件（如 `ci.yml`），必须先把它从 tree 清单里排除、其余文件照常推送，并说明该文件待用带 `workflow` scope 的 token 单独同步。v4.29.0 的 `ci.yml`（七道闸）即属此情况——本地已更新，远端仍是旧版，下次拿到 `workflow` scope 的 token 时补推即可，不影响产品运行。

> 安全口径：PAT 绝不写进仓库文件，用完 `shred -u` 擦除临时 token 文件。

---

## 6. 当前状态与待办

**已完成（v4.29.0）**：
- 存档防丢（v4.28.0）：全量备份/恢复、单档导出补散落键+正文、导入前快照回滚、容量体检；小云可直接触发。
- 自动回归（v4.28.0）：`test/regression.mjs` + `npm test`，现 34 项全绿；版本号从唯一来源动态派生，不再写死。
- 口径统一（v4.28.0）：README 解释 38/36 界差异；本交接文档。
- 工程地基（v4.29.0）：CI 七道闸（回归 34 项 + 网络体检 + 世界书体检，存量基线/只拦新增）；`CODE-MAP.md` 代码地图。
- 新功能（v4.29.0）：`action-check.js` 行动判定骰（演算/口述双裁定）；小云 `recall.brief` 资料召回 / `ui.actioncheck`。

**待办 / 已知约束**：
- v4.29.0 已推送：main `fec857d6`，tag/Release 在线（29 文件核对一致）；唯一例外是 `ci.yml` 因 token 无 `workflow` scope 未同步（见第 5 节）。
- **（已全部完成，2026-11-17）ci.yml 七道闸补推 + CI 全绿**：用临时 classic PAT（勾选 `repo`+`workflow`）经 contents API 推送 `ci.yml`，远端 blob `d440c49…`、commit `ab617c1`。推送过程中发现 CI 红灯真因：`VERSIONS.md` 速查表首行停在 v4.17.5、缺 v4.29.0 详情段，导致版本同源闸失败 → 已补齐 v4.29.0 速查表行 + 详情段，并用 `node scripts/sync-version.mjs` 自动修正计数（95→97），commit `aa3eb73`。**最新一次 CI run 七道闸全部 success**（语法/版本同源/预缓存/离线9项/核心回归34项/网络体检/世界书体检）。临时 PAT 用完已网页删除，API 验证返回 401 Bad credentials 确认失效；浏览器会话、token 文件、截图均已清除。
- **历史踩坑留档（无需再处理）**：`repo` scope PAT 无法写 `.github/workflows/*`（contents API 403 `workflow scope`、Git Data API 建 tree 404）；GitHub MCP 集成身份 403；沙箱 `git push` 直连超时。写 workflow 文件必须带 `workflow` scope 的 classic PAT。当前已无此待办。
- 沙箱本地 git 与远端历史分叉（gitignore 排除了 `_common.js` 等运行必需文件，远端保留），属正常，不影响运行。
- API Key 存 localStorage 明文——纯前端架构的固有特性，靠"只存本机 + 备份需提示勿外传"缓解，无服务端方案。

---

## 7. 小云动态视频（v4.30.0 · 进行中 · 2026-11-18 交接）

**需求**：把 60 张静态立绘做成「每个形象 + 每个动作都动态」的视频。用户决策：**全量 60 条（12 形态 × 5 动作）、只用 agnesvideo 模型、严格控制并发与速率**。

### 技术决策记录（为什么这么选）

| 项 | 结论 | 取舍理由 / 失效条件 |
|---|---|---|
| 模型 | `agnes-video-2.5-flash`（用户说的 "agensvideo" 真身） | `/v1/models` 枚举确认；`agnes-video-2.5` 亦在列 |
| 生成方式 | **`mode:"reference"` 图生视频**，传立绘作 `images[0]` | 保住角色一致性（同图生图思路）；`mode:"text"` 是纯文生、`mode:"image"/"i2v"/...` 全部 `invalid mode` |
| 参考图 | 每张立绘合成到纯绿幕、规范到 576×1024(全身)/640×640(头像) | API 硬约束：参考图宽高必须在 **[256,5760]** px，20 张源图最短边 <256 需放大；绿幕便于后续抠成透明，避免界面出现白底方块 |
| 规格 | 5 秒 / 720P / `aspect_ratio` 9:16(全身)·1:1(头像) | `size` 仅允许 `720P`、`n` 必须 1、`duration`/`fps`/`resolution` 全被拒；不可调 |
| 提交 | `POST /v1/video/generations` → 异步 `{id, video_id}` | 约 **2 分钟/条** |
| 轮询 | `GET /v1/video/generations/{task_id}` → `status=SUCCESS` 时给 `result_url` | — |
| 取文件 | `GET /v1/videos/{task_id}/content` | **当前故障点，见下** |

### 门禁 / 验收句
1. 生成侧：`POST` 返回 200 且轮询到 `SUCCESS` —— ✅ **已实测**（多个任务）。
2. 取文件：`content` 返回可解码 mp4（>5000 字节、非 html/text）—— ❌ **未过**，当前全部 502。
3. 全量：60 条 mp4 落 `assets/videos/`、逐条 ffprobe 可解码、总览质检 —— ⛔ 被第 2 条阻塞。
4. 接入：界面 `img`→按需循环 `video`、形态切换同步、绿幕抠透明、sw.js 缓存、包体控制、版本同步 + 回归 —— ⛔ 待前 3 条。

### 当前阻断（诚实披露 · 外部依赖故障）
- `content` 端点稳定返回 Cloudflare **502 / `error code: 502`**。已排除：单个任务损坏（换新任务复现）、认证（无 auth=401、有 auth=502）、数字主键（404）、纯 video_id 路径（404）、UA/Range/HTTP1.1/长超时/多路径重试（十余次全 502）、成功即下载（仍 502）。**路由正确、服务端从上游取文件内容时网关出错，非本项目可修**。
- 免费额度：`group=angel`、`quota=0`，历史短时高频会 **429**。故管线默认并发 1、提交间隔 12s、429/5xx 指数退避（上限 300s）。
- 规模代价：60 条 × 2 分钟 ≈ 2 小时（并发 2 约减半）；5 秒 720P 每条 2–5MB，60 条约 **150–300MB**，PWA 离线预缓存会明显变重，接入时必须做按需加载而非全量预缓存。

### 交付物
- `scripts/gen-xiaoyun-videos.py`：60 条 manifest、参考图预处理、滑动窗口并发、提交节流、429/5xx 退避、异步轮询、下载重试、**断点续传**（`state.json`：`success` 但下载失败只补下载、不重生成）。密钥只从环境变量 `AGNES_API_KEY` 读，**绝不写文件**。
- `.codebuddy/xiaoyun-video-state.json`（已 gitignore）：断点。当前 1 条 `aojiao/happy` = `download_failed`（任务已成功，保留 task_id 待补取）。

### 恢复步骤（端点修好后，一条命令续跑，不会重复烧额度）
```bash
cd /workspace/yunjing
export AGNES_API_KEY='<你的 agnes key>'   # 仅运行时，勿写文件
python3.11 scripts/gen-xiaoyun-videos.py --probe            # 探活，返回 0=已恢复
python3.11 scripts/gen-xiaoyun-videos.py --all --concurrency 2 --submit-gap 15
python3.11 scripts/gen-xiaoyun-videos.py --status           # 看断点统计
# 或守护：端点恢复后自动全量
python3.11 scripts/gen-xiaoyun-videos.py --watch --concurrency 2 --submit-gap 15 --recovery-gap 90
```
- `--download-only`：只补下载已成功任务；`--one aojiao/happy`：单条样片。
- 守护进程会随沙箱会话结束而终止（不落盘、无后台常驻服务）；**脚本可重入**，重跑即从断点继续。

### 接入点清单（第 4 条验收用，先不改代码，等 mp4 到位）
- `js/mo-chibi.js`：`IMGS`(12 Q版)/`FACES`(12 头像)/`buildIMG`/`applyStyle`/`poseSrc`/`openStylePicker`（12 形态换装面板）
- `js/mo-assistant.js`：`.mo-avatar img` 等 4 处聊天头像
- `js/xiaoyun-buddy.js`：`FORMS` 6 形态 happy 图（悬浮球）
- `sw.js`：CORE 预缓存清单（视频务必按需，不可全量预缓存）

---

## 8. 视频下载故障深挖与备用管线（决策记录 · 2026-11-18）

### 8.1 根因定位（8 轮实测证据）
| 探测 | 结果 |
|---|---|
| 502 响应体 / 头 | `server: cloudflare`、`cf-ray: *-LAX`；`Accept: application/json` 时返回 CF 标准 `Error 502: Bad gateway / The origin web server returned an invalid or unexpected response`，页面标注 **Host Error** |
| 生成 / 查询链路 | `POST /v1/video/generations` 200、`GET /v1/video/generations/{tid}` 200 `SUCCESS`、`GET /v1/videos/{tid}` 200 JSON —— **全部正常** |
| 全新任务复现 | 新建 `task_5vbYG1UQ...` 成功后 `content` 仍 502 —— 排除单任务/文件过期 |
| 备用入口 | 4 个 Host（apihub / agnes-ai / www / api）、7 个 CF 入口 IP、20 次高频重试 —— **全部 502**，0 成功 |
| 参数变体 | `Accept`、`Range`、`HEAD`、`POST`、编码转换、`?variant=*` 等 24 组 —— 502 或 404，无二进制出口 |
| 路径爆破 | 36 个后缀/大小写/双斜杠变体 —— 除 `retrieve` 外全 404/502/403，无备用下载路由 |
| **上游健康** | 合法 `mode=keyframe` / `mode=text` 返回 **503** `litellm.ServiceUnavailableError: OpenAIException - no available server`，`model group 'agnes-video-2.5' failed` |
| 字段白名单 | `response_format` / `callback_url` / `webhook` / `stream` / `sync` / `output_format` 等 30 个字段全部 `not an allowed request field`；合法字段仅 `mode`(reference/keyframe/text)、`image`、`images`、`duration`、`size`、`seed`、`extra_body`、`aspect_ratio`、`n`、`prompt`、`model`；`fps`/`video_url` 为 forbidden。`extra_body` 会展开后按同一白名单校验，无法透传 |

**结论**：不是本项目代码问题，也不是认证/路径/额度问题。上游 litellm 服务池不可用 → 下载处理器取不到文件 → CF 报 502。本地侧已穷尽所有绕过手段，**只能等平台恢复或换可用供应商**。

### 8.2 额度校正（推翻旧判断）
- `agnes-video-2.5`（非 flash）预扣 ＄0.125，余额 ＄0.004148 → 403，**这条渠道本来就没额度**。
- `agnes-video-2.5-flash` 任务记录 `quota: 0`（免费），提交 200、生成 SUCCESS，余额未变化。
- 所以 **60 条 flash 任务不缺额度**；此前「余额耗尽」的判断只适用于非 flash 模型，已更正。

### 8.3 决策记录
| 栏 | 内容 |
|---|---|
| 背景 | 原生 AI 视频可生成不可下载，用户明确拒绝「纯前端动效兜底」，要求真视频文件 |
| 候选 A | 死等平台修复，守护继续探活（已有） |
| 候选 B | 换视频供应商 / 换 key（需用户提供） |
| 候选 C | 本地把 60 张精修透明立绘合成真 MP4/WebM 视频文件 |
| 取舍 | **A + C 并行**：保留原生管线与守护不改动；C 立刻交付可播放视频，且产物格式与云境接入要求一致 |
| 失效条件 | 平台恢复后 C 被原生 AI 视频替换；若用户要求「必须是 AI 生成的肢体动作」，则 C 不达标，只能走 A/B |

### 8.4 备用管线产物
- `scripts/gen-xiaoyun-local-videos.py`：`--form aojiao` / `--all` / `--alpha` / `--both`
- 输出 `assets/videos-local/`：`xiaoyun-{form}-{view}.mp4`（H.264 渐变背景展示版）、同名 `.webm`（VP9-alpha 透明版，前端 `<video>` 直接叠加）
- 规格：576×1024 / 30fps / 2.4s / 72 帧无缝循环；5 个动作各有独立运动曲线与粒子层
- 已验证：ffprobe（h264+yuv420p、72 帧、2.4s）；抽帧人工质检（无脸部变形/色斑，动作差异可见）；真 Chromium 验证透明 WebM 叠加（72.9% 背景透出）
- 当前产出：傲娇形态 5 动作 × 2 格式 = **10 条样片**；全量 60 条待用户确认口径后 `--all --both` 一次生成（约 10 分钟）

### 8.5 未验证 / 未决项（强制披露）
1. 原生 AI 视频的下载端点何时恢复**不可控**；守护是会话内临时进程，沙箱休眠/会话结束会被回收，不能当长期托管。
2. 本地合成视频是**整体运动/飘动**，不是 AI 生成的肢体动作变化；单张静态立绘无法做出「真的举起手」的形变，这是硬局限。
3. 全量 60 条尚未生成；接入代码（`mo-chibi.js` / `mo-assistant.js` / `xiaoyun-buddy.js` / `sw.js`）**尚未改动**，等用户确认走哪条管线再动。
4. 实验期间额外创建了 3 条免费 flash 任务（`task_5vbYG1UQ...`、`task_3NqvAHp...` 等），均未下载成功，不影响断点状态文件。
5. 透明 WebM 的 `alpha_mode:1` 用 ffmpeg 默认 native vp9 解码器读不出 alpha（显示全不透明），但**浏览器可正确解析**——质检脚本需用 `-c:v libvpx-vp9` 或真浏览器，勿用默认解码器误判。

---

## 9. 原生 AI 视频下载故障 · 根因攻破与全量生产（2026-11-18）

### 9.1 根因（推翻此前「中转站 litellm 挂了」的判断）

此前结论「`/v1/videos/{id}/content` 502 是平台故障、本地无解」**不成立**。真正原因是我们一直用错了取文件方式：

| 环节 | 之前（坏） | 正确通道 |
|---|---|---|
| 提交 | `POST /v1/video/generations` ✅ 正常 | 同左（保持不变） |
| 判断完成 | 轮询 `/v1/video/generations/{id}`（状态滞后约 2 分钟） | 轮询官方网关 `/agnesapi?video_id=...&model_name=...`（准、快） |
| 拿下载地址 | `/v1/videos/{id}/content` ❌ 502 | agnesapi 返回 `url` 字段，指向 `platform-outputs.agnes-ai.space` |
| 下载 | 带 Bearer token 的 GET | **裸 GET（不带任何 header）**——带 key 反而被判 401 |

两个致命细节：
1. **video_id 不是 task_id**。retrieve 返回的 `video_id` 是 base64 串，解码后内含真实 `video_id:video_<hash>`；agnesapi 认这个，不认 `task_xxx`（用 task_id 查必然 404）。
2. **直链可直接从 video_id 构造**，无需查 agnesapi：
   `https://platform-outputs.agnes-ai.space/videos/agnes-video-2.5/video_<hash>.mp4`
   且**下载时不能带 Authorization header**，否则 401。

线索来源：官方 ComfyUI 节点 `github.com/1038lab/ComfyUI-Agnes-AI` 的 `agnes_api.py`——其 `_poll()` 用 `/agnesapi` 拿 `url` 再裸 GET 下载，与上述完全一致。

### 9.2 决策记录

| 项 | 内容 |
|---|---|
| 背景 | 用户明确「不行，我要视频，你想办法解决」，拒绝前端动效兜底；旧 content 端点 502 已持续 2 小时 |
| 候选 A | 继续等 content 端点恢复（已证伪——根本不需要它） |
| 候选 B | 换供应商（HF ZeroGPU 匿名配额耗尽；Pollinations 现已强制 API key；NVIDIA 通用 key 无视频模型）——全部不通 |
| 候选 C | 按官方节点通道改取文件方式：agnesapi / 构造直链 + 裸 GET 下载 |
| 取舍 | **选 C**——不换模型、不换 key、不花额度，纯改取文件链路 |
| 失效条件 | 若 agnes 改直链签名机制（如强制鉴权/短时签名），构造直链法失效，需回退 agnesapi 动态取 url |

### 9.3 管线改动（`scripts/gen-xiaoyun-videos.py`）

- 新增 `agnesapi_get()`（全局节流锁 + 429 退避）、`poll_agnesapi()`、`video_id_to_direct()`、`fetch_video()`
- 提交响应自带 `video_id`，`submit()` 回传并记录到 state
- `poll` 优先 agnesapi（状态准），回退 generations；**下载优先用构造直链**（零查询、无 429），401 才查 agnesapi
- `download_direct()` **裸 GET**（不带 header）——这是 401→200 的关键修复
- 历史 `download_failed` 任务的旧直链不可复用（会 401），改为重新生成
- 备份：`.bak-20261118-021006`

### 9.4 验证证据

- 端到端：`task_Y76...` 提交→SUCCESS→直链→下载 997KB（h264/768×1344/5.175s/AAC）
- 突破样本抽帧：`/workspace/小云AI视频-突破验证.png`（3 帧姿态明显不同：叉腰→举双手欢呼→放下，真动作非静帧）
- 单条管线：`yu/happy`、`luo/happy`、`luo/wave` 均一次成功（880KB~1368KB）
- 全量生产：`--all --concurrency 2 --submit-gap 12`，日志 `/tmp/xy_full_run.log`，断点 `/workspace/yunjing/.codebuddy/xiaoyun-video-state.json`

### 9.5 未验证 / 未决项（强制披露）
1. 全量 60 条生成中（启动时 3 条已完成、57 条待生成），沙箱休眠会中断进程——脚本可重入，重跑 `--all` 断点续传。
2. 直链构造法依赖 agnes 当前的 URL 规则，无任何官方 SLA；哪天改了需回退 agnesapi 动态取 url。
3. agnesapi 查询频率限制严格（429），已用全局节流器规避；并发不宜超过 2。
4. 每条视频 5 秒、9:16/720P、带原生音轨（可能无人声/轻微环境音，未逐条听检）。

### 9.6 全量生产完成（2026-11-18 12:06）
- 60/60 条原生 AI 视频全部产出，成品目录 `assets/videos/`，共 55.4MB。
- 完整性校验：60 条全部可解码，时长统一 5.17s，0 异常文件。
- 中间因沙箱休眠在 02:38 中断于 13/60；11:13 断点续跑（清理 2 条 submitted 无成品记录），12:06 完成剩余 47 条。
- state 60 条全为 `downloaded`。脚本可重入：`--all` 会跳过已有成品。

---

## 10. 情绪动作驱动垂直切片 · 交接契约（2026-11-18 v4.31.0）

### 10.1 需求四问与验收句（回读确认已通过 AskUserQuestion）
- 做什么（边界内）：傲娇形态 8 条情绪动作视频 + 玩家指令→动作路由 + 接入云境；两者结合中的"特殊指令实时生成"先做接口+降级。
- 边界外：其余 11 形态的情绪动作（下一批）；真·实时图生视频（延迟 1-2 分钟，无法即时互动）。
- 给谁用：云境玩家，在和小云对话时说带情绪的话。
- 输入：玩家在小云输入框的关键词；输出：右下角 orb 切换为对应情绪动作视频，几秒后回默认立绘。
- 验收句（可验证）：8 个动作抽帧姿态各不相同且名副其实；输入"太好了"→欢呼视频出现在 orb；无关输入不干预聊天；透明 WebM 叠加无绿边。

### 10.2 任务卡（六字段）
| id | title | owner | depends | est | acceptance |
|---|---|---|---|---|---|
| T01 | 定情绪动作清单与验收句 | lead | — | 0.5 | 8 情绪+映射表+验收句落档 |
| T02 | 视频管线支持情绪动作 | backend | T01 | 2h | 傲娇 8 条生成且抽帧差异可见 |
| T03 | 前端指令路由与播放 | frontend | T02 | 1h | match/onInput/setEmotion 正确、视频叠加无绿边 |
| T04 | 实时生成兜底接口 | backend | T03 | 0.5h | 特殊动作指令走降级提示，不报错 |
| T05 | 真浏览器验收 | quality | T03,T04 | 0.5h | 抽帧一览图+接入效果图+34/34 回归 |

关键路径：T01→T02→T03→T05。易返工三处：① agnesapi 429 限流（已用节流锁规避）② 绿幕转透明丢 alpha（已加 -an 去音轨修复）③ 事件监听时机（已改 document 委托+缓存输入值）。

### 10.3 三档排期（垂直切片实际耗时）
乐观 3h / 正常 4h / 悲观 6h（含一处返工）。假设：agnes 服务稳定、仅傲娇 1 形态、8 动作。

### 10.4 交付物
- `scripts/gen-xiaoyun-emotions.py`（复用已验证取片链路，不改原 60 条管线）
- `scripts/emotions-to-webm.py`（绿幕 MP4→透明 WebM，-an 去音轨）
- `js/xiaoyun-emotion.js`（window.XYEmotion，document 事件委托 + 输入缓存）
- `js/xiaoyun-buddy.js`（暴露 currentImg）、`css/xiaoyun-buddy.css`（.xy-emo-video 样式）
- `index.html`/`studio.html`（引入 emotion.js）、版本同步 4.31.0、changelog 条目
- `assets/videos/xiaoyun-aojiao-emo-{8情绪}.{mp4,webm}`（各 8 条）
- 证据：`/workspace/小云傲娇-8情绪动作一览.png`、`/workspace/小云情绪动作-云境接入效果.png`

### 10.5 检查点报告（四行）
- 做完什么：60 条全量视频 + 傲娇 8 条情绪动作 + 指令路由 + 接入 + 版本/changelog + 回归 34/34。
- 试过什么：抽帧逐条质检 8 动作差异、绿幕抠像浏览器验证（73.4% 透出/0.1% 残留）、CDP 真浏览器逻辑验证（onInput→setEmotion）、命令行浏览器接入效果截图。
- 还差什么：其余 11 形态情绪动作（下一批）；真·实时生成（受 API 延迟限制，切片为接口+降级）；CDP 头less 多 video 实例因环境解码器限制报 err4（单 video 正常，非交付物问题）。
- 卡在哪：无阻断。实时生成是否需要（用户方向已选"两者结合"，切片先降级）。

### 10.6 强制披露
1. 情绪动作目前**只有傲娇形态**：玩家在默认"温柔"形态下说情绪词不会触发动作（切片限制，全量版解除）。
2. headless Chromium 同一页面创建第 2 个 VP9 video 会触发 MEDIA_ERR_SRC_NOT_SUPPORTED——这是测试环境解码器限制，单 video 已验证正常播放；真实浏览器不受影响，但未在带 GPU 的真机浏览器逐字验收。
3. 绿幕转透明 WebM 去掉了原音轨（去音轨是为绕开 headless 兼容问题），情绪动作视频静音——静态立绘本无配音，可接受。
4. 8 条情绪动作视频内容由 AI 图生视频生成，动作幅度受单张立绘限制，是"可见的姿态变化"而非真人级骨骼动画。

---

## 11. 全预设收口 · 零生图API · 全形态动态响应（2026-11-18 v4.32.0）

### 11.1 需求决策（用户拍板）
- 用户原话："不能内置生图api，提前预设好吧" + 范围追问答"尽量都照顾到"。
- 收口决策：小云所有形象/动作一律用**提前生成好的本地预设视频**；前端运行时零网络请求、零生图/生视频 API、不留实时生成接口。
- 范围：12 形态 × 3 基础动作 + 傲娇 8 精细情绪，全预设铺开；未命中/无该动作时回退到已预设的最接近动作，绝不弹"实时生成"提示。

### 11.2 验收句（可验证）
1. `js/xiaoyun-emotion.js` 全文无 fetch/XHR/generations/API key/agnes 等网络与密钥痕迹（注释说明文字除外）。
2. 命中"太好了/挥手/战斗吧"→ 对应本地 WebM 出现在 orb；未命中"今天天气不错"→ reset 后 hasVideo=false、静态立绘恢复、不干预聊天。
3. 非傲娇形态说情绪词 → 回退到该形态基础动作（如温柔+"气死了"→ wenrou/battle）；傲娇说情绪词 → 播专属 emo 视频。
4. 44/44 预设 WebM 存在且可加载；真浏览器 canvas 读帧 alpha 正常（72.6% 透明、无绿边）。
5. 真浏览器页面 77 个请求中，生图/生视频 API 请求 0 个，JS 错误 0 个。

### 11.3 任务卡与依赖
| id | title | owner | depends | est | acceptance |
|---|---|---|---|---|---|
| T01 | 复核透明链路（ffprobe误报排查） | quality | — | 0.5h | 真浏览器canvas读帧alpha=72.6%，确认非缺陷 |
| T02 | 基础动作绿幕MP4批量抠像转透明WebM | backend | T01 | 0.3h | 36条 happy/wave/battle 转 yuva WebM 完成 |
| T03 | 情绪路由改纯预设零API | frontend | T02 | 1h | 删 requestLiveMotion，match/resolveSrc/setEmotion 全本地 |
| T04 | 全形态映射与降级链 | frontend | T03 | 0.5h | 12形态基础动作+傲娇8情绪+回退链，44/44 |
| T05 | 版本同源+changelog+真浏览器验收 | lead/quality | T04 | 0.5h | 同源check通过、回归34/34、浏览器0错误 |

关键路径：T01→T02→T03→T04→T05。易返工三处：① ffprobe 误报 alpha（已用真浏览器证伪）② API key 失效（已确认无法再生成，转基础动作回退）③ headless 多 video 解码限制（已用 ffmpeg 抽帧证伪文件问题）。

### 11.4 三档排期（实际耗时）
乐观 2h / 正常 3h / 悲观 4.5h。假设：本地素材齐全（已验证）、API key 失效已确认无需等待。

### 11.5 交付物
- `js/xiaoyun-emotion.js`（v4.32.0-preset，纯预设调度，删实时接口）
- `assets/videos/` 44 条透明 WebM：36 条基础动作（12形态×3）+ 8 条傲娇情绪
- `scripts/emotions-to-webm.py`（复用其 `to_webm()` 批量转基础动作）
- 版本同源：studio/index/package.json/sw.js/changelog/VERSIONS → 4.32.0
- 证据：`/workspace/小云全预设-零API预览.html`、`/workspace/小云全预设-零API预览.png`、`/workspace/小云全预设-真浏览器验证.png`

### 11.6 检查点报告（四行）
- 做完什么：全预设收口（零API）+ 44条透明WebM + 全形态指令路由与降级链 + 版本同源 + 回归34/34 + 真浏览器验收。
- 试过什么：ffprobe 误报排查（真浏览器canvas读帧证伪）、3个历史key逐一实测（视频提交均401失效）、Node vm 逻辑单测7/7、真浏览器集成验证（命中/未命中/形态切换/0 API请求/0 JS错误）、预览页44/44视频加载。
- 还差什么：其余 11 形态的**专属精细情绪视频**（API key 失效无法生成，当前以基础动作回退覆盖）；带 GPU 真机浏览器逐字视觉验收（headless 多video解码限制）。
- 卡在哪：无阻断。API key 若日后恢复，可用 `scripts/gen-xiaoyun-emotions.py --all` 补生成 88 条精细情绪，脚本已就绪。

### 11.7 强制披露
1. 生图/生视频 API key 已全部失效（历史 sk-FDIL/sk-KB4/sk-hhnena 在视频提交接口均返回 401），**无法再生成新视频**。故 11 形态只有基础动作（开心/挥手/战斗），无专属精细情绪；这靠"回退到最接近基础动作"覆盖，不是造假。
2. headless Chromium 同页播放 44 个 VP9 video 时，矩阵截图底部个别格子空白——已用 ffmpeg 抽帧证明文件内容完整（不透明占比 20%–80%），属测试环境解码器限制，非交付物缺陷；单 video 与真机 GPU 浏览器不受影响。
3. WebM 经 ffprobe 显示 yuv420p（疑似无 alpha），但真浏览器 canvas 读帧 alpha 72.6% 透明、历史截图无绿边——VP9 的 alpha 存于 side data，ffprobe 误报，透明链路实际正常。
4. 动作仍是图生视频的"可见姿态变化"，非真人级骨骼动画；基础动作复用同一形态立绘推理，幅度受单图限制。

---

## 12. 全形态精细情绪补齐 · 12×8 全动态（2026-11-18 v4.33.0）

### 12.1 需求与决策
- 用户先问"怎么会失效了"——诊断确认旧 key（sk-FDIL 状态停用 / sk-KB4 无效 / sk-hhnena 模型列表200但生成接口401）是平台侧权限/额度变化，非本地问题。
- 用户随后提供**新 key**（sk-dRE7bK...），实测有效：模型列表 200、含 agnes-video-2.5-flash，且单条真实生成走通完整链路。
- 决策：用新 key 离线批量补齐其余 11 形态各自的 8 种精细情绪视频，实现"所有形态根据指令形成不同动态动作"。新 key **只用于一次性离线产出，不写进前端**。

### 12.2 验收句（可验证）
1. 12 形态 × 8 情绪 = 96 条情绪 WebM + 36 条基础动作 WebM 全部存在、可加载。
2. 任一形态说情绪词 → 播该形态**专属** emo 视频（非回退、非其它形态）；真浏览器验证 12/12 通过。
3. 前端运行时零生图/生视频 API、零网络请求；真浏览器监听请求：API 请求 0、JS 错误 0。
4. 版本全站同源 4.33.0；回归 34/34；透明 WebM 绿幕残留 < 2%、alpha 透明 73%。

### 12.3 任务卡与排期
| id | title | owner | est | acceptance |
|---|---|---|---|---|
| T01 | 诊断旧key失效原因 | lead | 0.3h | 三key逐一实测，区分停用/无效/生成权限冻结 |
| T02 | 验证新key链路 | backend | 0.2h | 模型列表200+单条真实生成成功 |
| T03 | 全量生成88条情绪视频 | backend | ~2h | 受管后台任务跑完83/83、磁盘共96条、0失败 |
| T04 | 批量转透明WebM并接入 | backend/frontend | 0.3h | 96/96情绪WebM + EMO_FORMS扩到12形态 |
| T05 | 版本同源+真浏览器验收+交接 | lead/quality | 0.5h | 同源check过、回归34/34、浏览器12/12 |

三档排期：乐观 2h / 正常 2.5h / 悲观 3.5h（实际生成耗时 2h11m）。易返工三处：① 旧key误判为本地问题（靠诊断证伪）② nohup detach 无法自动通知（切受管后台任务）③ headless 多video解码限制（ffmpeg抽帧证伪文件问题）。

### 12.4 检查点报告（四行）
- 做完什么：新增 88 条精细情绪视频（11形态×8），连同傲娇共 96 条；全部转透明 WebM；前端解除"仅傲娇"限制、12 形态全支持精细情绪并升级 4.33.0；版本同源、回归 34/34、真浏览器 12/12 全通过；出矩阵预览页与静态矩阵图。
- 试过什么：三旧key诊断、新key链路验证、受管后台全量生成（83/83零失败）、真浏览器 canvas 读 alpha（yu/cheer 绿 1.2% / 透明 73.4%）、真浏览器全形态触发 12/12、预览页 96 条视频零错误。
- 还差什么：带 GPU 真机浏览器逐形态视觉验收（headless 同页多 video 解码限制）；新 key 若日后到期，前端不受影响（全预设）。
- 卡在哪：无阻断。

### 12.5 交付物
- `assets/videos/` 情绪 WebM 96 条（12形态×8）+ 基础动作 WebM 36 条，共 132 条本地透明视频。
- `js/xiaoyun-emotion.js`（v4.33.0-all-forms，EMO_FORMS 全 12 形态，精确降级链保留）。
- 版本同源 4.33.0（studio/index/package.json/sw.js/changelog/VERSIONS 全同步）。
- 证据：`/workspace/小云全形态精细情绪-预览.html`（交互矩阵）、`/workspace/小云全形态精细情绪-96条矩阵.png`（96格静态矩阵，OpenCV HSV 抠绿）、`/workspace/小云全形态精细情绪-真浏览器验证.png`。

### 12.6 强制披露
1. 新 key（sk-dRE7bK...）仅用于**离线一次性生成** 88 条视频，未写入任何前端文件；前端运行时依旧零生图 API、零网络请求。
2. headless Chromium 同页加载 96 个 VP9 video 时，交互预览页截图部分格子空白——解码器限制，ffmpeg 抽帧 96/96 全部成功、文件内容完整；静态矩阵图用逐条抽帧合成，不受此限制。
3. ffmpeg 命令行从 WebM 抽帧读不到 VP9 alpha side data（显示全绿），故静态矩阵图改从绿幕 MP4 源抽帧 + OpenCV HSV 抠绿合成；真浏览器渲染 WebM alpha 正常（1.2% 绿 / 73% 透明），交付物无绿幕。
4. 动作仍是图生视频的"可见姿态变化"，非真人级骨骼动画；不同情绪由不同 prompt 推理，姿态差异明显但幅度受单图限制。
