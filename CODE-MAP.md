# 云境 · 代码地图与改动规约

> **给谁看**：接手云境的人，以及未来任何一个需要在 20 万行、150+ 模块里"找东西、改东西、不出事"的会话。
> **怎么用**：改任何功能前，先在这里按功能找到"文件 + 入口函数"，只 Read 那一段，不要整文件通读。
> 配套文档：产品定位看 `README.md`，交接与环境看 `HANDOFF.md`，版本口径看 `VERSIONS.md`。

---

## 一、改动规约（每次动代码都照这个走）

### 1. 四步闭环
1. **定位**：先在下方地图找到模块 → 用 Grep 拿行号 → 只读那一段。核心大文件（`story-status-renderer.js`、`status-schema.js`、`xiaoyun-ops.js` 等）**禁止整文件读**。
2. **小步改**：一次只解决一件事。改 AI 提示词，优先动对应引擎里的规则常量/函数（见 §三"提示词"行），别把提示词散进 UI 组件。
3. **验证四件套**（缺一不可）：
   | 命令 | 期望 |
   |---|---|
   | `npm test` | 核心回归 33 项全绿 |
   | `node scripts/net-vitals.mjs` | 无新增裸 fetch |
   | `node scripts/kb-vet.mjs` | 无新增世界书可疑项 |
   | 真浏览器打开 `index / studio / selftest` | 0 报错、0 失败请求、0 404；能点的功能实测一遍 |
   全量语法用 `for f in js/*.js; do node --check "$f"; done`；CI 的七道闸见 `.github/workflows/ci.yml`。
4. **提交 + 同步**：本地 `git commit`；推送走 `push-release.py` / Git Data API（沙箱直连 github.com 被封，详见 HANDOFF），tag + Release 版本号与 `YJ_VER` 同源。

### 2. 新增模块的"三件套"
一个新功能要真正可用，通常要同时做三件事，漏一个就会出"模块在但点不开 / 离线 404 / 存档抓不到"：
- **加载**：`studio.html` 里加 `<script type="text/yj-lazy" data-src="js/xxx.js?v=版本" data-yj-group="demand" data-yj-globals="全局名">`；
- **预缓存**：`sw.js` 的 `CORE2` 清单加 `'js/xxx.js'`（否则离线必 404）；
- **版本**：所有 `?v=` 用 `scripts/sync-version.mjs` 统一派生，别手写散落版本号。

### 3. 数据与存档铁则
- 数据**分两层**：配置/状态在 `localStorage`（键按 slotId 分区，见 `slot-registry.js`）；大正文/图片在 **IndexedDB**（`storage-boost.js`，localStorage 里只留 `idb://` 占位）。
- 任何新持久化 key 都要能被 `save-slots.js` 的全量备份（`exportAll`）扫到——用统一前缀或注册进 SlotRegistry。
- **API Key 只在本机**，导出备份时须带安全提示（勿外传），绝不写进构建产物。
- 单档导入的散落键重映射必须过 `remapScopedKey`，并跳过注册表键与 `storySave_*` 本体副本，防止冲掉主档。

### 4. 双模式哲学（云境的一条设计主线）
好几处能力都有"严格 / 自由"两套口径，改动时要保持这个分叉一致：
- 填表规则 `fill-rule.js`：`strict` 走属性引擎钳制/补涨，`free` 玩家说了算、跳过钳制；
- 行动判定 `action-check.js`：`calc` 演算裁定（前端确定性），`free` 口述裁定（只给参考）；
- 判定优先查询 `window.FillRule` 的当前模式，别各自散落判断。

### 5. 高风险区（改前想清楚）
`api-calling-functions.js`（重试/超时/abort/节流集中地）、`variable-parser.js`（变量写回主链路）、`story-status-renderer.js`（状态栏渲染核心）、`storyFramework` 主循环——这些深耦合，单测覆盖不到，**改完必须真浏览器手玩一遍**。网络健壮性改动尤须跑 `net-vitals.mjs`。

---

## 二、模块地图（按功能分层）

> 表中"全局名"是模块挂载到 `window` 的入口对象，Grep 时用它最快定位。

### A. 启动 / 装配 / 工程
| 文件 | 全局名 | 职责 |
|---|---|---|
| `lazy-boot.js` | LazyBoot | 分层加载器，按 group 懒加载 demand/batch 模块 |
| `boot-error-guard.js` | — | 启动错误哨兵（安卓兼容） |
| `dep-wait.js` | — | 模块依赖等待 |
| `system-guard.js` | — | 预算条 DOM 注入 |
| `plugin-runtime.js` | PluginRuntime | 插件运行时 |
| `net-guard.js` / `cors-guard.js` | — | 网络异常分类 / 跨域守卫 |
| `api-status-badge.js` | — | 游玩中模型配置引导徽标 |
| `usage-panel.js` | — | 调用次数与消耗透明面板 |
| `turn-budget.js` / `prompt-budget.js` | — | 每轮请求预算 / 提示词省流 |

### B. AI 调用与正文处理（高风险）
| 文件 | 全局名 | 职责 |
|---|---|---|
| `api-calling-functions.js` | — | 统一 fetchWithTimeout、指数退避、429/5xx、推理模型 300s 放宽 |
| `ai-message-builder.js` | — | 组装发给模型的 messages |
| `ai-response-handler.js` / `ai-output-gate.js` | — | 完整回复处理 / 输出校验闸门 |
| `user-input-handler.js` | — | 发送主流程 |
| `variable-parser.js` / `variable-ai.js` | VariableAI | 变量块解析与写回（strict/free 分叉在这里） |
| `repairText` | （在 xiaoyun-ops） | 正文格式修复纯函数 |
| `number-scrubber.js` / `antibagu-guard.js` | — | 数值真值清洗 / 套话拦截 |
| `prompt-compiler.js` / `prompt-engineer.js` / `prompt-inspector.js` | — | 提示词编译 / 接口配置 / 调试器 |

### C. 属性、状态栏、填表（你最常改的区域）
| 文件 | 全局名 | 职责 |
|---|---|---|
| `attribute-engine.js` | AttributeEngine | 六轴资质、时间额度、边际递减、钳制/补涨 |
| `fill-rule.js` | FillRule | 严格演算 / 玩家自由 单一事实源 |
| `status-schema.js` | StatusSchema | 状态字段全集 + 多值编辑器 + 上报契约 |
| `status-world-fields.js` | StatusWorldFields | 36 界专属状态字段表 + 题材差异化命名 |
| `status-presets.js` / `status-skins.js` | StatusSkins | 世界专属预设 / 8 套题材材质皮肤 |
| `story-status-renderer.js` | — | 状态栏渲染核心（大文件，慎改） |
| `entity-editor.js` | — | 统一填表编辑器 |
| `truth-snapshot.js` | — | 引擎真值快照 |

### D. 世界与叙事引擎
| 文件 | 全局名 | 职责 |
|---|---|---|
| `world-schema.js` / `world-runtime.js` | — | 世界基座 / 统一动作管线 + NPC + HUD |
| `world-book.js` / `worldbook-seeds.js` / `kb-enhance.js` | WorldBook | 本界资料库（条目增补/归档/注入块） |
| `kb-vector.js` / `transcript-retrieval.js` | KBVector | BM25→向量→重排三级检索 / 全楼层检索 |
| `memory-layers.js` / `recap-engine.js` | MemoryLayers | 五层长期记忆 + 分层摘要（`buildInjection`） |
| `world-director.js` / `world-alive.js` / `world-clock.js` | — | GM 导演 / 活世界事件 / 自主时钟 |
| `world-seals.js` / `world-stage.js` / `world-legacy.js` | — | 界成就检定 / 阶段事件牌库 / 周目继承 |
| `canon-ledger.js` / `canon-timeline.js` / `world-bus.js` | — | 机缘归属 / 大势演化 / 事件总线账本 |
| `story-hooks.js` / `story-identity.js` / `story-stance.js` | — | 叙事意图 / 玩家身份 / 身份三态 |
| `quest-chain.js` / `planner.js` / `sim-core.js` / `opportunity-system.js` | — | 主线 / 规划 / 推演 / 涌现机缘 |
| `chapter-nav.js` / `timeline-branch.js` / `context-panel.js` | — | 章节 / 时间线分支 / 上下文面板 |

### E. 数值玩法
| 文件 | 全局名 | 职责 |
|---|---|---|
| `combat-core.js` | Combat | 31 界回合制战斗 |
| `rpg-core.js` / `rpg-quests.js` | — | 网游大世界数值 / 动态委托 |
| `beast-system.js` / `squad-system.js` / `gear-core.js` | — | 灵宠 / 小队 / 装备 |
| `inspiration-dice.js` | InspirationDice | 灵感素材骰（名词/功法/机缘卡） |
| `action-check.js` | ActionCheck | 行动判定骰（成败判定，演算/口述双模式） |
| `life-mode.js` / `game-layer.js` | — | 自由人生 / 成就游戏层 |
| `world-atlas` 系列：`atlas-*.js` / `faction-atlas-data.js` | — | 舆图 / 势力据点 |

### F. 小云（重中之重）
| 文件 | 全局名 | 职责 |
|---|---|---|
| `xiaoyun-buddy.js` | — | 小云对话 UI + LLM 工具循环 + 本地意图路由 |
| `xiaoyun-ops.js` | XiaoyunOps | 技能中枢：`TOOLS` 注册表，`call/manifest/names` |
| `mo-assistant.js` / `mo-chibi.js` / `mo-store.js` / `mo-tools.js` | — | 小云助手本体 / Q 版形象 / 存储 / 工具箱 |
| `mo-devtools.js` / `module-forge.js` / `creator-forge.js` | — | 研发中枢 / 模块工坊 / 原创设计工坊 |

小云新增能力的标准做法：在 `xiaoyun-ops.js` 的 `TOOLS` 里加 `{desc,args,fn}`（`fn` 统一返回 `{ok,msg,data?}`），再在 `xiaoyun-buddy.js` 的 `localReply` 加自然语言意图、在 `buildQuick` 加快捷按钮。异步工具返回 Promise 时，`localReply` 用 `Promise.resolve(...).then(...)` 消费，工具循环用 `Promise.all` 等待。

### G. 存档 / 设备 / 界面
| 文件 | 全局名 | 职责 |
|---|---|---|
| `save-slots.js` | SaveSlots | 书架多槽 + 两层全量备份/恢复/撤销 + 容量体检 |
| `slot-registry.js` / `id-migrate.js` / `store-guard.js` | SlotRegistry | 键分区 / 标识迁移 / 存储守卫 |
| `storage-boost.js` / `file-bridge.js` / `vault.js` | — | IDB 大对象分流 / 文件桥 / 保险箱 |
| `first-run-guide.js` / `world-portal.js` | — | 首次引导 / 每界入世扉页 |
| `theme-studio.js` / `lobby-themes.js` / `ambience-layer.js` | — | 主题工坊 / 大厅主题 / 氛围层 |
| `phone-*.js` / `channel-hub.js` / `comm-*.js` | — | 小手机 / 频道 / 通讯形态 |
| `mobile-fit.js` / `chat-virtualizer.js` | — | 移动端适配 / 聊天虚拟化 |
| `share-export.js` / `card-hub.js` / `relationship-graph.js` | — | 作品分享 / 众生相 / 关系图 |
| `import`：*st-import.js* / *preset-io.js* / *regex-io.js* / *card-io.js* | — | 第三方导入层 |

### H. 工程工具（scripts/ 与 test/）
| 路径 | 职责 |
|---|---|
| `sync-version.mjs` | 版本单一来源派生 + `--check` 校验 |
| `sync-precache.mjs` | 预缓存清单 vs 文件系统 vs HTML 引用三方对齐 |
| `release.mjs` / `sync-releases.mjs` | 发版与 Release 同步 |
| `net-vitals.mjs` + `.baseline.json` | 网络健壮性静态体检（裸 fetch，只拦新增） |
| `kb-vet.mjs` + `.baseline.json` | 世界书条目体检（占位符/灌水/重复句，只拦新增） |
| `test/regression.mjs` | 核心回归 33 项（`npm test`） |
| `yunjing-test/run-all.mjs` | 离线测试统一入口（CI 用） |

两个体检脚本都遵循"存量入基线、只拦新增"：确认改动合规后手动跑 `--init` 更新基线；`--report` 只打印不放行失败。

---

## 三、常见改动速查

| 想改什么 | 去哪 |
|---|---|
| 某条 AI 写作铁律 / 禁词 | `js/kb/*.core.js` 对应世界的条目；全局套话在 `antibagu-guard.js` |
| 状态栏某个字段显示名 / 多值 | `status-world-fields.js`（显示名走 `thematicLabel`，别改 key） |
| 填表严格/自由规则 | `fill-rule.js` 的 `strictDirective/freeDirective` |
| 属性涨点公式 / 资质档 | `attribute-engine.js` |
| 小云会不会某技能 | `xiaoyun-ops.js` 的 `TOOLS` + `xiaoyun-buddy.js` 意图 |
| 行动判定难度/结果档 | `action-check.js` 的 `DIFFICULTY` / `GRADES` |
| 版本号 | 只跑 `scripts/sync-version.mjs`，不要手改散落数字 |
| 世界数量口径 | `sw.js` 的 `GENRES`（真实世界数）；38 世界 / 36 界专属状态字段是不同口径 |

> 这份地图描述的是云境自己的架构。新增模块后，请顺手在这里补一行——地图活着才有价值。
