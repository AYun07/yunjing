# 云境 v4.08.0 缺陷清单（5 条未闭环项攻坚 + 真实模型复跑驱动）

> 规则：每条必须有**可复现的触发路径**与**根因定位**，不接受「看起来不对」。
> 状态：待修 / 已修 / 已验 / 已知非缺陷 / 能力边界
> 本轮靶子：v4.07.2 交付报告第六节列出的 **5 条未闭环项**（平台延迟稳定性、判定器语义覆盖、更高并发与长时运行、多存档槽隔离、移动端视觉），
> 外加「以玩家身份用真实模型复跑全部功能」时新暴露的缺陷。
> 真实模型只用 `agnes-3.0-flash`（免费），**并发 1、请求间隔 ≥4 秒**，全程未触发模型侧限流。

---

## 【A 组 · 网络延迟稳定性】（对应未闭环项 ①）

### A-1　`VariableAI.pending` 悬空时 `isProcessing` 永久卡死，之后所有输入被守卫拒绝

- **严重度**：高（玩家一旦踩中，除非刷新页面否则整个工作室不可用）
- **现象**：`regenerate()` / `rollback()` / `requestAI()` 三处裸 `await VariableAI.pending`；若该 Promise 因异常永不 settle，`isProcessing` 永远为 `true`，输入守卫持续拒绝玩家操作，界面无提示。
- **根因**：无超时兜底，等待无上限。
- **修法**：新增 `awaitPending(p, ms)`（20s 上限），三处调用全部改走它；等待卡加「⏹ 停止」按钮，玩家可主动中断本次生成（联动 `abortMainGeneration`）。
- **验证**：`js/user-input-handler.js` 语法通过；等待卡可点击并触发中止。
- **状态**：已修已验

### A-2　AbortError 被当成网络故障重试 4 次，用户放弃后仍退避约 60 秒

- **严重度**：高（超时放大器之一）
- **现象**：`net-guard.js` 判定中止只匹配 message 正则，而 Chrome 的 `controller.abort()` 抛出的错误 message 是 `This operation was aborted`，不含 `AbortError` 字样 → 正则不命中 → 玩家主动取消后仍被当网络抖动重试，退避 `1200×2ⁿ`。
- **根因**：错误判定依赖 message 文本而非 `name`。
- **修法**：判定改为 **name 优先 + message 兜底**，覆盖 abort / timeout / 超时 / 取消四类语义；超时与中止**绝不重试**，直接抛出。
- **验证**：`js/net-guard.js` 语法通过；中止不再触发退避序列。
- **状态**：已修已验

### A-3　超时后静默发第二次完整请求（180 秒超时的主因）

- **严重度**：**极高**（平台延迟被放大一倍）
- **现象**：`callOpenAI` / `callGemini` 的 catch 只对 `sawDelta || e.isHttpError` 抛出；AbortError 穿到函数末尾 → 再发一次携带**完整 system prompt** 的非流式请求。这是实测 180s 超时的主因。
- **根因**：错误分类遗漏超时/中止类，fallback 分支无条件执行。
- **修法**：超时/中止类错误（name 为 `AbortError`/`TimeoutError`，或 message 含 超时/timeout/abort/stream idle/取消）**直接抛出**，不再落 non-stream 回退；Gemini 路径同步修。
- **验证**：`readSSEStream` 的 `idlePromise` 由单例改为每次 `armIdle()` 新建，错误带 `streamPhase: 'first'|'idle'` 与 `isTimeout`，首字节超时与流中空闲超时可区分。
- **状态**：已修已验

### A-4　主笔无并发门闩，多请求互相踩踏；门闩自身又会卡死

- **严重度**：中高
- **现象**：本轮新增 `MAIN_LATCH` 主笔并发门闩；但初版把 `buildStoryMessages` 放在 try 块**外** await，消息装配阶段抛错时 finally 不执行 → 门闩永久 busy（自造缺陷，已修）。
- **修法**：消息装配移入 try 块；门闩在 finally 中无条件释放；`fetchWithTimeout` 支持外部 signal；AbortError 提示分流（玩家主动停止 → 「已停止本次生成」，超时 → 「首字节/流中阶段 N 秒内无数据返回」）。
- **验证**：`js/api-calling-functions.js` 语法通过；并发请求被门闩串行化，异常路径门闩可释放。
- **状态**：已修已验

---

## 【B 组 · 更高并发与长时运行】（对应未闭环项 ③）

### B-5　长时运行下数组无上限增长（3 处）

- **严重度**：中高（数小时级游玩后存档膨胀、内存泄漏）
- **现象**：`st.buffs` 无限 push；`mystery-ext` 的 `suspects` 与 `links` 平方级膨胀（links 键是 `线索下标:嫌疑人下标`）；`doupocangqiong-ext` 的 `owned` / `devoured` 无封顶。
- **修法**：`addBuff(st, b)`（同 id 刷新不叠加，`MAX_BUFFS = 24` 硬上限，超出淘汰回合最少者）；`MAX_SUSPECTS = 20`，截断后**重建 links 索引**；`MAX_OWNED = TOTAL(23)`、`MAX_DEVOURED = 40`。
- **验证**：`t_soak.py` 在 doupocangqiong 与 mystery 两界各 40/60 轮通过，存档体积第 10 轮后完全停滞；**灵敏度反向验证**：撤掉两处 suspects 封顶，测试立即报 `evidence.suspects 0 → 120`。
- **状态**：已修已验

### B-6　`dayEvents` 永不回收（纯内存泄漏）

- **修法**：处理完本批即 `dayEvents.length = 0`。
- **状态**：已修已验

### B-7　4 处 `localStorage.setItem` 静默失败 + 空 catch 吞异常

- **严重度**：中（配额写满时玩家看不到任何提示，进度悄悄丢）
- **修法**：`kb-vector.js` / `knowledge-manager.js` / `user-input-handler.js`（FS_KEY、SNAP_KEY）4 处加 try 保护 + toast；`world-ext-core.js` 的 `save()` 空 catch 改为 MoStore 降级 + 一次性 toast + console 留痕（`saveWarned` 防轰炸）。
- **状态**：已修已验

### D-6　切档 / 关页前 120~150ms 防抖落盘被 unload 掐掉

- **修法**：`world-runtime` / `world-bus` / `world-alive` 新增 `persist()` 立即落盘入口（WorldAlive 原本无任何落盘接口）；`save-slots.js` 的 `switchTo()` 切档前冲刷 6 个系统；`world-ext-core.js` 加 `pagehide` / `beforeunload` 双保险。
- **状态**：已修已验

---

## 【D 组 · 多存档槽隔离】（对应未闭环项 ④，本轮工作量最大）

> 根因共性：全项目 20+ 处模块**各自拼 localStorage 键名**，格式至少 5 种
> （`{base}{suffix}` / `{base}~{slotId}` / `{base}~{slotId}~{genre}` / `{base}:{slotId}:{genre}` / `{base}.{slotId}~{genre}`）。
> 任何一处手写清理代码都只能对其中一种格式生效。
> **统一基础设施**：新建 `js/slot-registry.js`，提供 `genre()/slotId()/suffix()/keysOf()/scanKeysOf()/purge()/claimLegacy()/scoped()`，
> 把「键名怎么拼」与「某槽位名下有哪些键」收敛到一处。主档沿用裸键，老玩家零迁移。

| 编号 | 缺陷 | 修法 | 状态 |
|---|---|---|---|
| D-1 | `remove()` 手写 8 键 + `k+suffix` 拼接，对 4 类格式全部拼错 → 删档后残留 7 类键 | 改由 `SlotRegistry.purge()` 统一清理（规则表 + localStorage 扫描兜底） | 已修已验 |
| D-2 | `canon-ledger` / `canon-timeline` 读 `config.genre \|\| config.id`，而 38 份 config **只有 `genreKey`** → 恒为 `default`，38 界共用一份账本/编年史 | 优先 `config.genreKey`，再退回 SlotRegistry；新增 `key/slotId/genreKey` 导出 | 已修已验 |
| D-3 | `world-ext-core.js` 的 `SLOT_SUFFIX` 是 IIFE 顶层常量，而该脚本在 studio.html 中**不带 defer**、先于 `story-framework.js` 执行 → `window.storyFramework` 为 undefined | 改为惰性求值函数 | 已修已验 |
| D-4 | `claimSlotKey` 在副档认领后 `removeItem(legacyKey)`，而裸键**正是主档正在使用的键** → 副档认领摧毁主档数据 | 引入 `yunjingLegacyOwner:{genre}:{legacyKey}` 归属标记；主档有存档则裸键归主档，副档不得认领 | 已修已验 |
| D-5 | `clearSave()` 用裸键清理，而主档真实键是 `yunjingBeasts~main`/`yunjingSquad~main` → 清档对主档完全无效 | 改用 `SlotRegistry.purge()` | 已修已验 |
| D-6 | 见 B 组切档冲刷 | — | 已修已验 |
| D-7 | `game-layer` / `timeline-branch` / `reader-letters` / `atlas-panel` 4 处无槽隔离 | 走 `SlotRegistry.scoped()` / `claimLegacy()`（带旧键迁移） | 已修已验 |
| D-8 | `world-book.js` 的 `ensureSeed()` 播种标记不带后缀 → 主档播种后副档永不播种 | 标记改为 `SEED_FLAG + g + slotSuffix()` | 已修已验 |
| D-9 | `game-layer.js:230` 与 `timeline-branch.js:294` 调裸 `onGenre(gk)`，但该函数只在 `api` 对象上、模块作用域不存在 → **首次渲染即 ReferenceError，面板整块空白** | 新增作用域内 `setGenre()`，`api.onGenre` 复用它 | 已修已验 |

- **验证**：`t_slots.py` 8 场景全通过（主/副档隔离、canon 界键、删档残留、认领不摧毁主档、副档播种、清档残留、面板不崩溃、页面级异常）；
  **灵敏度反向验证**：临时把 `remove()` 里的注册表调用改成 `if (false)`，测试立即报出 7 个残留键。
- **测试器自身缺陷 2 项**：① `remove()` 拒删「当前激活档」，测试却想删激活的副档 → 加 `PREPARE_MAIN` 先切回主档；② D4 断言极性写反 → 修正。

---

## 【E 组 · 移动端视觉】（对应未闭环项 ⑤）

| 编号 | 缺陷 | 根因 | 状态 |
|---|---|---|---|
| E-1 | `.ws-cat-head` 375px 溢出 3px | 缺 `box-sizing:border-box`，`width:100%` + padding 14px×2 | 已修已验 |
| E-2 | `#rpgDrawer` 溢出 28px | 同缺 `box-sizing`，`width:calc(100vw - 16px)` + padding 14px；补 `#rpgDrawer .rpg-hd button` 34px（移动端 38px） | 已修已验 |
| E-3 | `.rpg-quick` 横向溢出 **153px**，PK/回合两按钮手机上点不到 | **真凶**：`css/ui-polish.css:130` 的 `[class*="quick"]` 子串选择器带 `!important` 强制 `display:flex; flex-wrap:nowrap`，误伤 `.rpg-quick` | 已修已验 |
| E-4 | `#rpgClose` 完全无样式，退化成 13px 宽 | 补尺寸 | 已修已验 |

- **排查方法论**：CSSOM 里规则顺序正确、computed 却是旧值时，应怀疑**特异性 / `!important`** 而非缓存；
  CDP `CSS.getMatchedStylesForNode` 是定位层叠问题的决定性工具（本例 5 轮排查后靠它定位）。
- **验证**：`t_mobile.py` 375×667 与 414×896 双视口 × 4 界面（大厅/工作室/RPG 面板/存档槽），
  **溢出 0 / 过小热区 0 / 输入框遮挡 0**；截图输出到 `/workspace/云境-v4.08.0-截图/`。
  测量器新增 `onScreen()` 排除关闭态抽屉误报（`transform: translateX(105%)` 推到屏外曾被判 20 个溢出元素）。

---

## 【F 组 · 判定器升级为真值差分校验】（对应未闭环项 ②）

> v4.07.2 的判定器是**规则式**：只查「正文里的数值/专名是否在静态名单里」。
> 但引擎真值是**有状态的**——正文说的金币/等级/进度必须与**本轮动作后的引擎快照**一致，
> 而不只是「在某个允许集合里」；跨轮次倒退也查不出。
> 本轮新建 `js/truth-snapshot.js`（引擎侧全量真值快照）与 `yunjing-test/scripts/truthdiff.py`（判定器），
> 并实现「引擎真值快照差分 + 知识库全文合法名单 + 运行时真值 + 跨轮次状态一致性」四层校验。

### F-1　差分分支一条都匹配不到（`endswith(".gold")` 对 `$gold` 失效）

- **严重度**：**极高**（差分判定形同虚设，是自检样本①的误报把它抓出来的）
- **根因**：`truth-snapshot.js` 里引擎数值入 flat 时键是 `"$gold"` / `"$lv"`（`$` 前缀），而判定器判断用 `endswith(".gold")` → 分支从未匹配。
- **修法**：新增 `_isField(key, name)`，同时认 `"$"+name` 与 `endswith("."+name)`。
- **状态**：已修已验

### F-2　`pairs` 为空时整段跳过进度判定

- **根因**：`if pairs:` 才判 → 引擎此刻无委托时，正文凭空写「2/3」永远不被拦。
- **修法**：改为始终判定（pairs 为空 ≠ 免检，而是「本轮不存在任何合法进度对」）。
- **状态**：已修已验

### F-3　势力提取靠「后缀词法」，无标准后缀的专名结构性漏报

- **根因**：`FAC_SUFFIX` 只认 家族/公会/行会/联盟/…/盟 →「寒鸦九司」「玄夜司」这类专名根本进不了候选列表。
- **修法**：加**语义触发**层——成员身份词（`MEMBER_ROLE`，引号内专名紧邻密探/会长/盟主…）+ 玩家自建句式（`PLAYER_FAC2`）；「识别候选」与「判定合法性」分离。
- **状态**：已修已验

### F-4　`GOLD` 正则 `\s*` 跨换行，把装备面板的「攻击：+17」+「金币奖励」拼成「17 金币」

- **修法**：`\s*` → `[ \t]*`，商品价/攻击加成与「金币」二字必须同一行相邻才算金币主张；补自检样本 ②-b 与灵敏度变异验证。
- **状态**：已修已验

### F-5　误报修正（4 类，均为真实模型复跑中暴露）

| 误报样本 | 根因 | 修法 |
|---|---|---|
| 「没有任何行会的庇护」 | 否定陈述被当势力名 | 虚词表补存在性否定词组 |
| 「需分心助盟友一臂」/「而非任何行会的徽记」 | 动词/连词短语被 `盟`/`行会` 后缀误抓 | 虚词表补 `需分心助\|分心\|一臂\|而非\|任何\|…` 组合词（只加组合词，不加单字，避免误杀真实势力名） |
| 玩家自建势力「灰烬同盟」 | `legal` 只在开篇采一次，运行时真值随玩法变化 | `t_truthdiff.py` 每轮重新采集运行时真值 |
| `Lv.3` 主语不含「我/主角」 | 等级提取主语口径过窄 | 加第二人称 `PLAYER_LV_WIDE` + 零主语兜底 |

- **验证**：`truthdiff.py` 自检 **34 条样本全通过**；**完整灵敏度反向验证 17+ 变异体全检出**
  （金币差分 / 等级差分 / 字段键 $ 前缀 / 成员身份词 / 自建句式 / 第二人称 / 零主语 / KB 全文 / 运行时势力·地名 / 历史等级 / 经验条 / 血条 / 历史金币 / 他人等级排除 / 委托进度 / 跨作品专名 / pairs 空免检 / GOLD 不跨行 / 世界阶段真值 / 新增虚词）。
  每个分支都有对应自检样本，杜绝「测试跑了但动作没真跑」。

---

## 【G 组 · 真实模型复跑新发现的确定性产品缺陷】

> 承接本轮「以玩家身份用真实模型复跑全部功能」：wangyou 深度旅程 13 步反复复跑，
> 每轮把判定器告警逐条核验为真缺陷 / 判定误报 / 能力边界，只修确定性缺陷。

### G-1　【D-27 重演】测试器 `@active0` 取错委托 → 交付动作从未真跑 → 模型整段脑补报酬

- **严重度**：**极高**（本轮最有价值的发现）
- **现象**：真值快照 `nums.quests` 把 `offers`（可接委托）与 `active`（进行中委托）**合并**成一个数组；测试器 `@active0` 取 `quests[0]` 拿到的是 offers 第一条「讨伐·霜狼」，而玩家真正接的是 active 里的「悬赏·缉拿雷阵守卫」→ `qturnin` 传错 id → 引擎返回「没有这条进行中的委托」→ **交付动作从未执行**。模型在完全没有结算依据的情况下整段脑补：编出「奖励：金币 x100，声望 +5」「58 金币 + 100 = 158 金币」「金币剩余：28」。
- **根因**：快照未区分 offers / active；测试器占位符口径错误。这与 v4.07.2 的 D-27 同类——**「跑过了」不等于「真的跑了」**。
- **修法**：快照新增 `activeQuests` / `questOffers` 两个独立导出（`nums.quests` 保留合并口径供判定器用）；`resolve_payload` 严格分流——接委托只认 `questOffers`，交付只认 `activeQuests`。
- **验证**：纯引擎复现确认交付动作真跑——引擎真实结算「金币 +30、声望 +4、经验 +40（升级至 Lv.2！）」、`gold 58→88`、`activeQuests 1→0`；修复后重跑深度旅程 **turnin 步通过**，模型不再编造报酬数字。
- **状态**：已修已验

### G-2　系统块换了「」+加粗外壳，绕过只认【】的剥离

- **现象**：`「奖励：金币 x100，声望 +5」`、`**「已购买：松木林巨剑」**`、`**「金币剩余：28」**` 原样出现在正文。
- **修法**：`_isSystemNoticeLine` 按外壳分流——方括号沿用原宽松口径；引号外壳**只认「UI 字段:值」固定白名单且不带句读**（引号是对白主要载体，不能沿用宽口径否则「我终于获得了自由！」会被误剥）。提示词格式契约补 4.1。
- **状态**：已修已验

### G-3　思维链泄漏进正文（玩家看到模型内心戏）

- **严重度**：**极高**
- **现象**：模型输出 `(Thinking process: The user wants me to continue… Current state: … Wait, the engine log says -16 HP…)` 整块英文推理；且推理里把 `304+42` 自己加成 `346`，随后把这个错数写进正文（这正是 HP 346/403 的来源）。
- **修法**：`_stripThinkingChain` 逐行剥离（初版闭合块非贪婪匹配吃到中途第一个右括号，只删前半段 → 改为「整块都在一行内才整块删，跨行一律逐行剥」）；提示词补 4.3。
- **验证**：真实泄漏样本 2621 → 1191 字，英文推理全清，中文正文与英文专名（HP/NPC）零误伤。
- **状态**：已修已验

### G-4　整块装备面板抄进正文（D-29 同型，换了装备名标题）

- **现象**：`【新手木剑】\n品级：白装\n槽位：胸甲\n攻击：+17\n金币奖励：+11\n当前总金币：99` 6 行原样残留，还夹带编造的 HP 346/470、怒气 72/106、基础攻击 92。
- **根因**：`panelDepth` 只认「【状态栏】」这类固定标题，不认装备名标题；`_isLeakedLine` 单行剥「字段:值」，带括号注记的行漏网。
- **修法**：新增 `_stripEquipPanel`——严格判定「装备名标题 + 其后连续 ≥3 行装备字段」整段剥离，防误伤正文「【苍狼】」强调；提示词补 4.4（禁止界面结算行、装备面板与自编数字）。
- **验证**：真实 loot 正文 594 → 518 字，面板块全清；防误伤 3 类样本（【苍狼】强调 / 正常对白 / 独立面板）全通过。
- **状态**：已修已验

### G-5　孤立 `<status>` 协议开标签残骸

- **现象**：模型写到状态栏开头被 maxTokens 截断，`<status>` 开标签留下、闭合标签没有；现有 `YunqiPresetRegex.process` 只抽成对闭合块，孤立标签以裸 XML 留在正文。
- **修法**：清洗链末尾按位置判定配对（开标签往后找闭标签、闭标签往前找开标签），只删孤立残骸，不碰成对块。
- **验证**：loot 尾部 `<status>` 剥离；成对块完整链路验证 `proseHasStatus=false / proseHasClose=false`，且粘在 `</status>` 后的正文「那幽绿的眼球」完整保留。
- **状态**：已修已验

### G-6　数值契约 / 结算 directive / 世界阶段 directive 措辞加固

- `rpg-core.js`：上一轮结算标题由「必须照此写」改为「判定依据 · 不得写进正文」（原措辞被小模型理解成「把这段话抄进正文」，实测出现「⚔️ 基本斩击 对「雷阵守卫」造成 35 点伤害」被逐行搬进正文）；明确「当前值一律照抄快照，增量绝不参与当前值计算」；委托报酬明确标注「尚未到账」。
- `world-stage.js`：世界阶段改为「背景基调，只用来调整基调，严禁写成「当前世界阶段：X（第 N/M 阶段）」字段式说明放进正文」。
- `ai-message-builder.js`：格式契约补 4.1（禁止系统块）、4.2（禁止面板口吻）、4.3（禁止思考过程）、4.4（禁止界面结算行/装备面板/自编数字）。
- **状态**：已修已验

### G-7　SW 预缓存漏掉两个新核心模块

- **严重度**：中（PWA 离线打开必 404）
- **现象**：新建的 `js/slot-registry.js`（存档槽隔离核心）与 `js/truth-snapshot.js`（真值快照）都是 studio/index 静态引用，却没进 `sw.js` 的 `CORE` 清单。
- **修法**：补进清单（slot-registry 缺失会让全部存档键名退回旧拼接口径）。
- **状态**：已修已验

---

## 【H 组 · 能力边界与已知非缺陷】（诚实列出，不假装修掉）

### H-1　小模型自编经济/UI 数值 —— **能力边界，非可确定性修复的产品缺陷**

- **现象**：`agnes-3.0-flash` 在长叙事里偶发自编商品价（「木剑才卖 5 金币」「皮甲 30 金币」「剩下 20 金币」）、奖励数值（「经验 +10000」「声望 +50」）、背包格数（「目前 1/1」）、面板字段（「HP 346/470」「怒气 72/106」「总金币 99」）。
- **定性**：这些是**模型能力边界**，不是产品逻辑错误。提示词 4.1~4.4 与 directive 数值契约已多层压制，判定器能如实检出（`fakeGold` / `fakeProgress`），清洗层剥掉确定性 UI 块，但**不能声称能穷尽小模型的偶发编造**——这与 v4.07.2 报告「判定器仍是规则式，不能穷尽所有幻觉」同源，只是本轮把它从「静态名单」升级为「真值差分」后，检出能力显著增强。
- **处置**：提示词压制 + 判定器如实检出 + 报告如实登记；不为了「让测试变绿」而放宽判定器。
- **状态**：能力边界（已知限制）

### H-2　`_lastRank` / `_lastRealm` reload「消失」—— **已知非缺陷**

- **现象**：`t_persist.py` 报 `ladder._lastRank` / `spirit._lastRealm` 动作后字段消失。
- **根因**：这两个是**运行时派生记忆槽**（下次 `onVars` 时重算），不落盘是设计如此；v4.07.2 的 D-25 同型问题已修。
- **验证**：reload 后状态一致（`_lastRank` 恒 -1、rank 一致），破境留痕功能无损；两文件本轮未改动，非本轮回归。
- **本轮 t_persist.py 全量复跑的补充核验**：报 5 界共 5 条 `lost`（`comm._order/lastRound/_feedHash`、`gear.custom/log`、`wr_town`/`wr_xjfield`/`wr_xjalchemy` 的 `cooldowns.*` 与 `resources.*`、`ladder._lastRank`、`spirit._lastRealm`）。
  - `comm-core.js` 的 `init()` 默认就含 `_order: []` / `lastRound: 0` / `_feedHash: ""` —— 后两者是 feed 指纹与渲染顺序的**派生缓存**，reload 按设计重建；
  - 关键核验：以 `xuanjianxianzu` 界精确复现（播种/浇灌/炼丹 → 强制落盘 → reload），
    **存档与内存里的 `resources: {灵石:30,灵种:4,灵药:1}` / `cooldowns: {plant2:1,water2:2}` / `logs` 在 reload 前后逐字一致**，
    业务数据零丢失。探测器用扁平路径 `wr_xjfield.resources.灵药` 比对，而该字段在模块懒加载完成后才出现 → 属**探测口径的加载时序问题**，不是数据丢失。
  - 报告实际分类：`stateMismatch`（业务数据不一致）**0 条**、`crash` **0 条**，5 条全为 `lost`（派生槽）；相关模块本轮均未改动，非本轮回归。
- **状态**：已知非缺陷（探测口径需说明）

### H-3　平台侧延迟与额度

- `agnes-3.0-flash` 端到端延迟在 5.8s ~ 62.8s 波动（v4.07.2 基线）；本轮按 180s 阈值配置。
- 本轮曾遇到 WorkBuddy 平台侧 429 额度提示导致一次回复中断，但真实模型复跑走独立 agnes 端点脚本，不受平台额度影响，恢复后完整复跑通过。
- **状态**：已知限制

---

## 附：本轮新增 / 修改的测试设施

| 文件 | 用途 |
|---|---|
| `js/truth-snapshot.js`（新） | 引擎侧全量真值快照（模块状态 + 引擎数值 + 运行时派生事实 + 合法名表） |
| `js/slot-registry.js`（新） | 存档键统一注册表 |
| `yunjing-test/scripts/truthdiff.py`（新） | 真值差分判定器（34 条自检 + 完整灵敏度反向验证） |
| `yunjing-test/scripts/t_truthdiff.py`（新） | 真实模型端到端真值差分实测 |
| `yunjing-test/scripts/t_slots.py`（新） | 多存档槽隔离 8 场景 |
| `yunjing-test/scripts/t_soak.py`（新） | 长时运行稳定性（含动作有效性自检，杜绝假通过） |
| `yunjing-test/scripts/t_mobile.py`（新） | 375/414 双视口 × 4 界面小屏回归 |
| `t_player.py`（修） | 修配置写入时序（`resetCache` 会 `saveApiConfig` 把空配置落盘） |

> **一条经验值得记下来**：本轮至少三次踩到「测试跑了但动作没真跑」——
> ① G-1 交付动作传错委托 id；② soak 首版只改变量不调 `onVars`；③ 判定器灵敏度变异体锚点写错导致变异测试自身失效。
> 每一次都是靠**反向灵敏度验证**（故意破坏、测试必须立刻失败）才暴露的。
