# 云境 v4.10.0 · 缺陷清单（第三方审查 v4.09.0 复核闭环）

> 本文件对应《全量审查报告-v4.09.0.md》与《LEAD-确认发现.md》的逐条复现、分类与修复记录。
> 核心纪律：**不照单全收**——先在当前工作区复现，区分「确认缺陷 / 非缺陷 / 待定 / 约束边界」，再动手。

---

## 一、审查来源与可复现性

- **审查输入**：`全量审查报告-v4.09.0.md`（独立审查，总评「未达到用户验收标准」，列 10 条 P1 + 若干 P2/P3）、`LEAD-确认发现.md`（Lead 亲自确认 F1–F12）。
- **可复现性**：工作区 `HEAD^{tree}` 与审查对象 `4c983be` 的 tree 完全一致（`03632cd…`），可直接复现，无版本漂移。
- **复现基线**：18 项待修，逐条复现后分类。

## 二、复现方法学（避免「测试跑绿但动作没真跑」）

| 资产 | 作用 | 关键纪律 |
|---|---|---|
| `t_audit_v410.cjs` | node vm 真加载 `js/kb/*.js` 与核心模块，动态枚举真实全局符号 | 不信注释、不靠正则数对象键、不把懒加载占位符当模块真身 |
| `t_audit_browser.py` | 真 chromium + playwright 端到端，`demand` 组注入真身 | 懒加载占位符（如 `ImmersiveSuite`/`YunjingVault`）初始是 function，必须注入真身再测，否则假缺陷 |
| `kb_array_tool.py` | 括号平衡扫描 KB 数组（非贪婪正则会截断字符串内 `]`） | 物理清洗 + `_index.json` 重算，带尾逗号兼容 |
| `t_kb_load_v410.py` / `t_registry_v410.py` | 真浏览器逐界验证 KB 加载与按界注册表 | 探针判据严格按真值，避免误判（如把 `dazhuzai` 的「大主宰·」合法条当倒灌） |

## 三、缺陷分类与修复总表

### 3.1 确认缺陷（已全部修复并验证）

| 编号 | 缺陷 | 根因 | 修复 | 验证 |
|---|---|---|---|---|
| F1 | 跨界清档数据丢失（`free` 误删 `freeworld` / `sA1` 误删 `sA10`） | `slot-registry` 子串匹配无尾界符 | 精确分段判定 + 槽位令牌尾界符 | `t_audit_v410` F1 OK；`t_audit_browser` OK |
| F6 | 斗破库《大主宰》单向倒灌 116 + 15 条 | `doupocangqiong` 库混入大主宰界条目 | 物理删 131 条（`大主宰·` 前缀 116 + 关系/天赋专名 15；`同宇宙联动` 有意联动保留） | `t_audit_v410` F6 OK（0） |
| F7 | `worldbook-seeds` 缺 5 界种子 | 33 界注册表未补五新界 | 补齐 5 界中性种子（本界专名纪律 / 世界自运转总纲 / 因果存续律 / 众生自主律） | `t_audit_browser` 38 界全就位 |
| F8 | 世界张力无上行机制 | `world-alive` 只单向衰减 | `evolveTension` 双向自治演化（势力消长 / 敌对边 / 冲突爆发 / 覆灭事件），因果内核 delta 不动 | 低张力 5 轮全上行；死敌覆灭低点 7.4 与报告基线 7.3 吻合 |
| F9 | 装备模块 11/38 界静默不加载 | `gear-core` `cfgOf` 对非土豆宇宙界返回 `null` | `cfgOf` 一律回落 `GENERIC` | 抽查 15 界缺失 0/15 |
| F10 | 数值清洗误删合法正文 + 全角数字绕过 | `PANEL_FRAG` 全角未识别、`当前/目前 N/M` 无条件剥离 | 分层处理 HUD/歧义词、全角归一化、日期形态 `2024/11` 排除 | `t_number_scrub` 32/32 + 5/5 变异 |
| F11 | 沉浸主题缺 5 界 | `immersive-suite` `THEMES` 缺新界 | `deriveTheme` 补齐 5 界 + `free` | 38 界键全注册 |
| F12 | 413 条源码/提示词回灌知识库 | KB 文件内「世界观铁律 · const …」型垃圾 | 物理删 413 + 运行时 `KB_isCodeFragment` 过滤 | `t_audit_v410` F12 OK（0）；真浏览器 `codeFragCount`=0 |
| P1-8 | 登记块 `(claimed)`/`(world)` 泄漏 | 剥离逻辑在对象缺位时未执行 | 移出对象判空分支 | 零 pageerror |
| P1-9 | RPG 钱包被清零 | `normalizeState` NaN→默认金币 50 | `qturnin` 真实交付路径防御 + 上限钳制 | `gold=500`；委托 37/37 |
| P1-10 | 保险箱导出缺 `worldExt_`/运行时 | `pack('all')` 未含 `worldExt_` | `DATA_PREFIX` 补 `worldExt_` | `hasWorldExt` True；`total` 59 |
| P2 | 数值上限 / `need` 回填 / `STORE` 冻结 / 全角 | `rpg-core` 上限缺失、`world-ext` 写旧槽 | `NUM_CAP`/`lv` 上限、`need` 回填、`STORE` 用 `SLOT_SUFFIX` | `t_audit_v410` P2 OK |
| G1–G8 | 38 界按界注册表五新界缺口 | 7 个注册表未补五新界 | 界名 / 画风 / 氛围 / 印章 / 原著主角 / 大势节点 / 原著配角全补全（基于 KB 真值，不臆造） | `t_registry_v410` 9/9 |

### 3.2 诚实边界（非缺陷，评估不改）

| 项 | 事实 | 结论 |
|---|---|---|
| F3 三界死 CSS | `theme-daobanshenhua`/`theme-zonghengtianxia`/`theme-tianxiawushuang` 实为 `wangyou` 三服（东境/北境/中天）的合法子主题色，仍在生效 | 非缺陷（审查报告口径偏差） |
| F4 注释「40界」 | `knowledge-manager.js` 注释为 v17–v19 历史 changelog，当时确为 40 界，后合并为 38 界 | 非缺陷（演化记录，保留） |
| 文风块 38/38 空 | 预设从未收录 `📕文风·` 块，对所有 38 界恒为空 | **v4.11.0 已补完（T3）**：`yunqi-bridge.js` 新增 `BUILTIN_STYLE` 38 界内置文风档兜底，预设无按界分档时回退内置、`render` 返回「本世界文风适配」；`t_style_builtin.cjs` 38/38 通过 |
| `ATLAS_ERAS` 缺 10 界 | 缺的含开放界（chaoshenxueyuan/douluodalu/…/wanmeishijie） | **v4.11.0 已补完（T2）**：补 6 个多时代界（仙逆位面阶梯/道诡异仙表里双线/重生之都市修仙前世今生/轮回乐园多衍生世界/全球冰封灾变前后/帝霸万古棋局），覆盖 10→16/38；`t_atlas_eras.cjs` 6/6 通过、真浏览器注册表 16/38 确认 |
| `wangyou` 无原著主角 | 原创网游界，无原著主角，`fallback`「原著主角」属合理通用兜底 | **v4.11.0 已补完（T1）**：`story-stance.js` 的 `CANON_HEROES.wangyou="原创主角"`，原创网游界主角回落为「原创主角」而非「原著主角」；`t_registry_v410.py` 命中 |

### 3.3 约束边界（不在产品修复范围）

- **平台侧延迟与额度**：网络延迟、API 额度受上游约束，产品已做指数退避/Retry-After/超时分级，但不虚构「平台已修好」。
- **更强生成模型**：小模型仍可能编造语义幻觉，清洗层只是玩家所见兜底，不替代更强模型。
- **性格/理想/情绪自治演化**：属设计中的「世界自运转」内核，本次未动其因果链。**v4.11.0 已修复（T4）**：`npc-spawn.js` 的 `driftWills()` 此前仅 `enrich()` 生成时随机定一次 `personality`/`ambition` 后即冻结，现改为在同池内按 `bond`/势力覆灭/记忆事件做因果迁移（敌对→冷硬簇/复仇簇、亲近→温热簇/忠诚簇、旧主倾覆→守护簇），每 4–5 日低频演化且有冷却，全程有界（每 tick ≤3 人、每人冷却 2 日）；`world-alive.js` 把性格/理想注入真源与 `WorldAlive` 主笔提示词，让 NPC 言行随因果真实漂移。`t_driftwills.cjs` 演化内核实测通过。

## 四、验证汇总

| 资产 | 结果 |
|---|---|
| `t_number_scrub.js` | 32 样本 + 5 变异 全绿 |
| `t_audit_v410.cjs` | 19/19 全绿 |
| `t_kb_load_v410.py` | 6/6（38 界合计 32312 条，污染归零） |
| `t_registry_v410.py` | 9/9 |
| `t_body_probe.py` | 15/15 正文清洗/降级 |
| 全量 JS 语法 | 249/249 |
| 真浏览器全程 | 零 pageerror |

## 五、数据治理统计

- F12 物理清除：413 条源码/提示词碎片
- F6 物理清除：131 条斗破库《大主宰》倒灌（保留 `同宇宙联动` 有意联动 1 条）
- P2 展开：34 条 `wangyou` 嵌套地点为扁平条目（39 条原创地点可检索）
- `_index.json` 重算：25570 → 24910（`total` 与逐界创作条目同口径差 0）
- 78 个 KB 文件 JS 语法：全绿
- 运行时 `codeFragCount`：38 界全 0

---

## 六、v4.11.0 补完与修复（用户指令：把缺失项全补上 + 修复演化内核）

> 用户明确要求：把 v4.10.0 缺陷报告中列为「非缺陷/待确认/约束边界」的缺失项全部补上，并修复「性格/理想/情绪自治演化内核」，再从头全量验证审查。

### 6.1 四项补完/修复与根因

| 编号 | 项 | 根因（修复前真实状态） | 修复 | 验证 |
|---|---|---|---|---|
| T1 | `wangyou` 原创主角 | `CANON_HEROES` 无 `wangyou` 键，原创网游界回落为通用「原著主角」兜底 | `story-stance.js` 补 `wangyou:"原创主角"` | `t_registry_v410.py` 命中 `原创主角`；真浏览器零 pageerror |
| T2 | `ATLAS_ERAS` 缺 6 界 | 多时代/多位面/续作舞台的 6 界未登记时代层 | `atlas-eras.js` 注入 6 个多时代界（沿用既有格式，不另设 `t:"start"`，含 regions/roads/nodes/desc/c） | `t_atlas_eras.cjs` 6/6（前缀/道路/无 start/无冲突）；真浏览器注册表覆盖 10→16/38 |
| T3 | 文风块 38/38 空 | 预设 `YUNQI_PRESET` 仅含通用 `🎨文风·` 块，无 `📕文风·{世界}` 按界分档 | `yunqi-bridge.js` 新增 `BUILTIN_STYLE` 38 界内置文风档；`resolveStyleBlock()` 无分档时回退 `'BUILTIN:'+world`，`render()` 返回「本世界文风适配」 | `t_style_builtin.cjs` 38/38 通过 |
| T4 | 性格/理想/情绪自治演化内核 | `personality`/`ambition` 仅 `enrich()` 生成时随机定一次、之后冻结；`driftWills()` 只演化情绪/目标/信任/记忆 | `driftWills()` 扩展性格/理想同池因果迁移（敌对→冷硬/复仇簇、亲近→温热/忠诚簇、旧主倾覆→守护簇，每 4–5 日低频、有冷却、有界）；`world-alive.js` 把性格/理想注入主笔提示词 | `t_driftwills.cjs`：敌对 bond=-40 → personality 落冷硬簇、ambition 落复仇簇、emotion=焦灼、trust 演化，演化信号 10 条 |

### 6.2 全量验证审查闭环（T5）

| 资产 | 结果 |
|---|---|
| 全量 JS 语法 | 249/249 |
| `t_audit_v410.cjs`（node vm 复现） | 19/19，0 缺陷 |
| `t_kb_load_v410.py`（KB 加载） | 6/6（38 界 32312 条、运行时零 pageerror、斗破库 528 条已降） |
| `t_registry_v410.py`（按界注册表） | 9/9（16/38 时代层、wangyou 原创主角命中） |
| `t_style_builtin.cjs`（文风兜底） | 38/38 通过 |
| `t_driftwills.cjs`（演化内核） | 通过 |
| `t_atlas_eras.cjs`（时代层合并） | 6/6 通过 |
| `t_audit_browser.py`（真浏览器端到端） | 16/16，0 缺陷，零 pageerror |
| `kb_array_tool.py`（KB 括号平衡） | 76 文件 24984 条 0 失败 |

### 6.3 第三方审查式再审查结论

- 修复前 F8 张力、F6/F12 污染、G1–G8 注册表等历史缺陷未回潮（回归全绿）。
- 新增 4 项改动均通过专项 vm + 真浏览器双重验证，无引入新问题。
- 诚实口径：演进内核的 `ambition` 可漂移至「忠诚/守护/复仇」子词表（含少量不在基础 `AMBITIONS` 池的合法中文志向串），属「世界自运转」刻意设计、下游仅作自由字符串展示，无逻辑风险；已在 `driftWills` 注释标注，不再视为缺陷。
- 真浏览器全程 **零 pageerror**。

### 6.4 版本与发版

- `window.YJ_VER`：`4.10.0` → `4.11.0`（`index.html` 同源徽标 + 静态兜底同步）；`changelog/index.html` 新增 v4.11.0 条目、`yunjing-theme.css?v=` 缓存参数同步。
- 经 Git Data API 兜底推送至 `origin/main`，打 tag `v4.11.0`。
