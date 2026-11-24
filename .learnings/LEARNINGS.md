# Learnings

Corrections, insights, and knowledge gaps captured during development.

**Categories**: correction | insight | knowledge_gap | best_practice

---

## [LRN-20251122-001] correction

**Logged**: 2026-11-22T16:45:00+08:00
**Priority**: high
**Status**: resolved
**Area**: config

### Summary
境界考据漏收原著已有锚点，且把单 genre 世界误当单一力量体系钉死。

### Details
v6.3.7 建 38 世界境界阶梯时：①斗罗 config 原文第80行明明写了神官→神王层级，我只看称号段写到百级成神就停，漏收神界之上；②斗罗四部（魂力/魂导器/斗铠/神级遍地走）力量体系不同，项目虽只有单 genre 我却只钉第一部；③超神按凯莎神体单一路钉死，违背 config「玩家为自定义角色非原著主角」。用户逐条指出。根因：抽取 config 时只读境界章节前几行、未读全；且未意识到"单 genre 内可含多分部体系"。

### Suggested Action
建立境界阶梯时：①把该世界 config 的境界章节**从头到尾读完**（尤其"完整""速查表"小节尾部的高阶层）；②系列文/多体系世界用 subSystems 分部字段而非压成单轴；③叙事型世界先查"玩家定位"铁律再决定钉什么。已落实 DR-040。

### Metadata
- Source: user_feedback
- Related Files: scripts/realm-ladders.mjs, configs/douluodalu-config.js, configs/chaoshenxueyuan-config.js
- Tags: 考据, 原著设定, 境界体系, 分部

---

## [LRN-20251122-002] correction

**Logged**: 2026-11-22T18:00:00+08:00
**Priority**: critical
**Status**: resolved
**Area**: config

### Summary
多个世界的显示名用了避讳名/同音字/简称而非原著书名，且贯穿全项目（境界/地图/一览表）。

### Details
用户指出「你那同音字我都看不懂，原著世界原著名称要对」。核查发现：古真人=蛊真人（净网避讳）、全知法师=全职法师、万象之王=万相之王、大地铁犁=开局地摊卖大力、盗墓=帝霸、凡人修仙=凡人修仙传、战痕=我在精神病院学斩神、重生都市=重生之都市修仙、网游创作=寰宇纪元。根因：早期建项目时为规避敏感词用了避讳名，后续所有数据层沿用了这个名字，没回到 config/atlas source 里已注明的原著真名。另境界名「全职法师·法神」是杜撰（原著顶点为禁咒）。

### Suggested Action
建立/校对世界数据时，**世界显示名以 config 开头注明的原著书名 + atlas source 字段为权威**，不要用避讳名/简称/同音字；genre id 可与显示名不同但要分离。境界阶梯顶点逐一联网核对，不凭印象加「法神」之类不存在的阶。改名前先确认该词是否为正文普通词汇（盗墓者/重生都市题材），只替换 name 字段形态。已落实 DR-041。

### Metadata
- Source: user_feedback
- Related Files: scripts/realm-ladders.mjs, js/world-rules.js, js/atlas-verified-all.js, configs/*
- Tags: 原著名称, 同音字, 避讳名, 世界显示名

---

## [LRN-20251122-003] correction

**Logged**: 2026-11-22T18:15:00+08:00
**Priority**: high
**Status**: resolved
**Area**: config

### Summary
境界审定时把同一世界的「两套分类体系」混成一条升级轴，以及过渡阶次序写反。

### Details
用户要求自查后，联网核对发现：①龙族把「混血血统评级 S/A/B/C/D/E/F」与「龙类按代（初代/次代/白王黑王）」两套不同轴的分类并成一条升级轴，还把芬格尔留级梗「G档」当正式最低阶；②元尊把「伪法域/法域」「圣者/准神」两对过渡阶顺序写反。根因：审定 tier 时只看 config 条目罗列顺序，没分清「评级轴 vs 分类轴」，也没意识到「伪X」是前置过渡阶。

### Suggested Action
审定境界阶梯时：①一个世界若含多套分类（评级/代际/职业），先确认哪套是「升级主轴」，其余移 subSystems，不可混成一条轴；②「伪X/半步X/准X」这类过渡阶要按原著定义放对位置（通常是前置或两阶之间），不能照 config 条目编号顺序照抄；③梗/玩笑档位（如 G 档）不入正式阶梯。已落实 DR-042。

### Metadata
- Source: self_review + web_verification
- Related Files: scripts/realm-ladders.mjs, configs/longzu-config.js, configs/yuanzun-config.js
- Tags: 体系混轴, 过渡阶次序, 境界审定

---

---

## [LRN-20251122-004] best_practice

**Logged**: 2026-11-22T18:40:00+08:00
**Priority**: high
**Status**: resolved
**Area**: testing

### Summary
E2E 断言不能直接点隐藏 tab 里的按钮——报告会写进 DOM 但用户看不见，截图呈现假象。

### Details
v6.3.12 首次 E2E 里，脚本直接 `click('#cx-go')` 验证跨体系拒绝，断言全过，但截图显示的仍是阶梯页。根因：`#cx-out` 所在的 cross 页 `display:none`，只有真实用户先点「② 跨境界对敌」tab 才看得见报告。断言验的是 DOM 文本，不是用户可见结果。另有一处测试期望写反：武夫「金身」序 7 高于「武胆」序 6，我却断言 `tierDiff > 0`。

### Suggested Action
①带 tab / 折叠 / 弹层的界面 E2E，必须先切到目标可见区再断言，并截图确认可见性；②期望的序/数值要从原著顺序手算或独立依据取，不从程序输出反推，失败时先审期望再审实现。已落实 DR-044 验证段。

### Metadata
- Source: e2e_visual_review
- Related Files: test/v6312-browser-check.mjs, test/compare-regression.mjs
- Tags: E2E, 可见性断言, 测试期望, 视觉审阅

---

## [LRN-20251122-005] correction

**Logged**: 2026-11-22T19:05:00+08:00
**Priority**: high
**Status**: resolved
**Area**: compare-panel / compare-engine

### Summary
同类结构报告共字段时，reportText 的分支顺序决定成败；跨函数作用域误用导致 E2E 才暴露的 ReferenceError。

### Details
v6.3.13 跨层对敌上线时：①`layerTierOpts` 定义在 `html()` 内却从 `bind()` 调用，Node 单元测试全部通过（不加载 DOM 绑定），只有真浏览器 E2E 的控制台哨兵抓到 ReferenceError；②跨层报告与跨境界报告都有 `{ok,from,to,cost}`，`reportText()` 的通用 cost 分支排在跨层分支前面，先命中后用 `rep.from.name`/`rep.energyDiff` 取值，界面渲染出 `undefined·undefined 能级+undefined`。单元测试最初只断言「含需/档」，没断言「无 undefined」，漏掉了。

### Suggested Action
①DOM 事件绑定函数只能调用模块级函数，局部 helper 不要跨 html/bind 边界用——这类错误 Node 单测抓不到，必须有真浏览器 E2E；②结构化报告若共享字段名，reportText 的特化分支必须排在通用分支之前，且通用分支要加排除条件；③报告文本测试必须断言「不出现 undefined/NaN」这类脏值，不能只断言正向关键词。已落实 DR-045。

### Metadata
- Source: e2e_visual_review
- Related Files: js/compare-panel.js, js/compare-engine.js, test/compare-regression.mjs
- Tags: 作用域, 分支优先级, 报告文本, undefined, E2E

---

## LRN-20251122-006 · 快照类功能的 E2E 构造必须复刻真实时序

### Context
v6.3.14 全量楼层快照 E2E 首轮 9 FAIL：回档后 storyState 字段全差 1（off-by-one），但旁路键和历史长度却对。

### Details
测试构造时把 `variables` 设在 `pushTurnSnapshot()` 之前、旁路键设在之后，导致二者在快照里的"所属轮"错开一位。实现本身正确（Node 单测 503/0 全过），是测试的构造时序不符合真实游戏——真实游戏里 `pushTurnSnapshot` 在轮开始前调用，此刻所有字段（storyState + 旁路）都还是上一轮结束后的结果，AI 回复落定后才推进。

### Suggested Action
①测"快照/回档"这类功能，E2E 造数据的顺序必须复刻真实主循环：先 pushTurnSnapshot，等写队列排空，再推进所有字段；②storyState 字段与旁路键必须在同一时点更新，不能一个在 push 前一个在 push 后；③Node 单测过而 E2E 字段错 1，优先怀疑测试构造时序，别急着改实现。

### Metadata
- Source: e2e_visual_review
- Related Files: test/v6314-browser-check.mjs, story-framework.js, js/floor-state.js
- Tags: E2E, 快照, 回档, 时序, off-by-one
