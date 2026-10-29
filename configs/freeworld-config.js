const FreeWorldForge = {
  /** 量表配色（微信级克制渐变，玩家在创世台四选一/五选一） */
  GAUGE_COLORS: {
    jade: "linear-gradient(90deg,#68c8a0,#a8e0c8)",
    gold: "linear-gradient(90deg,#e0b45c,#e8d898)",
    azure: "linear-gradient(90deg,#68a8e8,#98c8f8)",
    rose: "linear-gradient(90deg,#e07898,#f0b0c8)",
    violet: "linear-gradient(90deg,#9878e0,#c0a8f0)"
  },
  /** 未自定义时的兜底量表（通用两枚：状态/生计——任何世界都成立） */
  DEFAULT_GAUGES: [
    { key: "状态", label: "状态", icon: "✚", color: "linear-gradient(90deg,#68c8a0,#a8e0c8)", default: 70 },
    { key: "生计", label: "生计", icon: "🪙", color: "linear-gradient(90deg,#e0b45c,#e8d898)", default: 50 }
  ],
  /** 量表清洗：玩家填的名称/配色/初值 → 结构化量表定义
   *  规则：空名丢弃、超长截断（6字）、同名去重、最多 3 枚、
   *        初值 0-100 整数、配色按代号取（未知代号回翡翠） */
  sanitizeGauges(raw) {
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    (Array.isArray(raw) ? raw : []).forEach((g, i) => {
      var _a;
      if (!g) return;
      const label = String(g.label || "").trim().slice(0, 6);
      if (!label || seen.has(label)) return;
      seen.add(label);
      let v = parseInt((_a = g.default) != null ? _a : g.val, 10);
      if (!Number.isFinite(v)) v = 50;
      v = Math.max(0, Math.min(100, v));
      out.push({
        key: label,
        label,
        icon: ["✚", "◈", "⚡"][i % 3],
        color: this.GAUGE_COLORS[g.color] || this.GAUGE_COLORS.jade,
        default: v
      });
      if (out.length >= 3) return;
    });
    return out.length ? out.slice(0, 3) : this.DEFAULT_GAUGES.map((g) => ({ ...g }));
  },
  /** 势力清洗：名称必填（≤6字）、立场一句（≤24字）、最多 4 家 */
  sanitizeFactions(raw) {
    const out = [];
    (Array.isArray(raw) ? raw : []).forEach((f) => {
      if (!f) return;
      const name = String(f.name || "").trim().slice(0, 6);
      if (!name) return;
      const stance = String(f.stance || "").trim().slice(0, 24);
      if (out.length < 4) out.push({ name, stance });
    });
    return out;
  },
  /** 从存档/运行态安全取 worldCode（旧档/未开篇 → null） */
  worldCodeOf(fw) {
    var _a, _b, _c;
    const wc = (_c = (_b = (_a = fw || window.storyFramework) == null ? void 0 : _a.storyState) == null ? void 0 : _b.setup) == null ? void 0 : _c.worldCode;
    return wc && typeof wc === "object" ? wc : null;
  },
  /** 本世量表（创世台定义 → 运行态；缺席回兜底） */
  gaugesOf(fw) {
    var _a;
    const wc = this.worldCodeOf(fw);
    if (wc && Array.isArray(wc.gauges) && wc.gauges.length) return wc.gauges;
    const cfg = (_a = fw || window.storyFramework) == null ? void 0 : _a.config;
    return cfg && Array.isArray(cfg.gauges) && cfg.gauges.length ? cfg.gauges : this.DEFAULT_GAUGES.map((g) => ({ ...g }));
  },
  /** 本世势力名单（创世台定义；可空——玩家可以造一个没有势力的世界） */
  factionsOf(fw) {
    const wc = this.worldCodeOf(fw);
    return wc && Array.isArray(wc.factions) ? wc.factions : [];
  },
  /** 通讯形态 → 世界通讯铁律文案（AI 据此约束一切联络方式） */
  commRule(comm) {
    switch (comm) {
      case "none":
        return "本世界没有远距通讯——消息靠腿、靠吼、靠烽烟与驿站，重要的话要当面说";
      case "letter":
        return "本世界的远距通讯以书信/信使为主——慢是常态，一封信走数日，急事靠捎口信";
      case "instant":
        return "本世界存在即时通讯（如聊天软件/传讯法阵/心灵网络）——人际联络即时可达，消息即生活的一部分";
      case "mixed":
        return "本世界通讯形态新旧并存（如电报与信使并存/法阵与飞鸽并用）——按场景与阶层如实区分";
      default:
        return "本世界通讯形态未特别约定——按世界之魂的质感与时代常识自行校准";
    }
  },
  /** 世界宪法正文（玩家亲笔设定的结构化呈现——系统提示词与宪法卡共用）
   *  只拼非空段；世界之魂必在（创世必填），其余任选 */
  constitutionOf(wc) {
    if (!wc) return "";
    const parts = [];
    if (wc.soul) parts.push(`◆ 世界之魂：${wc.soul}`);
    const rules = [];
    if (wc.power) rules.push(`力量体系——${wc.power}`);
    if (wc.death) rules.push(`生死法则——${wc.death}`);
    if (wc.era) rules.push(`时代与历法——${wc.era}`);
    if (rules.length) parts.push(`◆ 世界法则：${rules.join("；")}`);
    if (wc.geo) parts.push(`◆ 舞台地理：${wc.geo}`);
    if (Array.isArray(wc.factions) && wc.factions.length) {
      parts.push(`◆ 势力版图：${wc.factions.map((f) => `${f.name}（${f.stance || "立场未述"}）`).join("／")}`);
    }
    if (wc.comm) parts.push(`◆ 通讯形态：${this.commRule(wc.comm)}`);
    if (Array.isArray(wc.amendments) && wc.amendments.length) {
      parts.push(`◆ 运行时增补（玩法中途立的新法，与创世法则同等效力）：
${wc.amendments.map((a, i) => `  ${i + 1}. ${a}`).join("\n")}`);
    }
    return parts.join("\n");
  },
  /** 量表上报契约（variable_update 顶层字段，每轮如实增减） */
  gaugeContract(gauges) {
    const gs = gauges && gauges.length ? gauges : this.DEFAULT_GAUGES;
    return gs.map((g) => `${g.key}: 当前值（0-100 整数，按处境如实增减）`).join("\n");
  },
  /** 势力声望契约（与势力互动后才变动；变量名用间隔号，避免与角色卡的点号冲突） */
  factionContract(factions) {
    if (!factions || !factions.length) return "";
    return factions.map((f) => `声望·${f.name}: 玩家在「${f.name}」的声望（0-100 整数，有实质互动才变动）`).join("\n");
  }
};
const fullSystemPrompt = `角色设定：你是「自由世界」的世界模拟引擎——不是小说主持人，不是编剧，而是这个世界本身。这个世界的法则、历史、地理、势力与质感，由玩家在创世台亲笔创造（见下方【世界宪法】）；你的唯一使命：把玩家写的世界一丝不苟地运转起来。这里没有预设剧本、没有主线任务、没有命运安排——只有因果：世界如何回应一个人的所思、所言、所行。

【世界宪法至上（本世界最高法则）】
1. 宪法即现实：下方【世界宪法】是本世界的一切边界——力量体系、生死法则、时代历法、地理势力、通讯形态，逐条如实运转；宪法没有写到的，按世界之魂的质感与内在逻辑自行推导，不得引入宪法之外的设定体系。
2. 一致性自检：每轮正文涉及的每一件物品、每一种能力、每一项制度、每一个称呼，都须与宪法相符；出现宪法之外的存在方式（玩家中途增补的除外）即为重大违规。
3. 玩家亲笔至上：玩家在创世台写下的每一个字都是设定正文——写多细，世界就执行多细；含糊处由你按世界质感补全，但补全须服从不含糊的部分。
4. 运行时增补：玩法中途玩家可通过「世界宪法卡」立新法（增补条款）；增补与创世法则同等效力，即刻生效，不得追溯已发生的剧情。

【无剧情铁律（与世界宪法同级）】
1. 零剧本：本世界没有任何预设情节、主线任务、隐藏危机或"注定的事件"。你不制造戏剧——一切波澜只能来自玩家的行动、世界的偶然（天气、行情、纷争、他人的自由意志），以及它们的自然后果。
2. 无主角光环：世界不围着玩家转。NPC 各有自己的人生日程，不会刻意与玩家发生交集；大人物不认识玩家，也不会因玩家而改变决定。
3. 平凡即默认：日常生活是世界的基调。大多数日子就是作息、营生、饭食与闲谈；把普通日子写出质感，比凭空制造事件高级得多。
4. 拒绝巧合轰炸：连续的"恰好""突然""偏偏"是廉价叙事。偶然事件须符合本世界的真实概率——连续两次以上的戏剧性巧合即视为违规。
5. 因果守恒：玩家的每个行动都有符合本世界逻辑的后果，好坏皆然；后果可以延迟显形，但不会凭空消失，也不会被"剧情需要"豁免。

【世界运转引擎（开放世界运转方式）】
- 世界自走：玩家不在场之处，世界照常运转——别处有传闻、市集有行情、邻里有家常、势力有进退；玩家的缺席不改变任何事的进程。
- 生活系统：吃饭、住宿、赶路、营生、求医、办事各有其流程与代价；玩家的一切行为都落到具体的钱、时间与体力上（度量与货币按世界之魂自洽）。
- 时间如实流动：每轮代表的时间跨度按行动实情而定（一炷香、一趟远行、一个下午、数月乃至数年），在 variable_update 的 date 中如实推进。
- 风险真实：冒险有风险，违逆有代价，疾病有病程，承诺有分量；世界不优待玩家，也不刻意迫害玩家。
- 生死有常：按生死法则运转——若玩家定义了"会死"，角色会老、会病、会死，死亡须有充分铺垫与合理因果，不得突然处刑；死亡或玩家主动结束时，坦然收束并标记【人生终章】。

【势力如实运转（若宪法定义了势力）】
势力各有其立场、利益与日程：他们按自身逻辑结盟、倾轧、涨落，不为玩家而存在；玩家与势力的每一次交集都记入声望（声望是水到渠成的积累，不是任务的奖惩）。未定义势力的世界，此节自然失效。

【正文风格（按玩家文风执行 + 世界质感）】
1. 文风按玩家在创世台选定的基调执行；未指定时默认写实白描——细节说话，情绪克制。
2. 世界质感：器物、称谓、度量、口头禅、禁忌全部贴合世界之魂；让读者从细节里"闻到"这个世界。
3. 对白见人：每个 NPC 的措辞、口音、信息量与其出身、行当、教养相符；同一世界的市井与庙堂各有其腔。
4. 克制的抒情：情绪藏在动作与物件里，不点破、不渲染；深情都是省着用的。
5. 节奏即生活：有的事一轮写三遍（一场谈判、一趟赶路），有的岁月三轮并作一句；时间跨度服务于生活本身，而非戏剧结构。
禁止：现代网络流行语乱入异质世界、"作为AI""根据设定"等出戏表述、上帝视角剧透未发生之事。

【扮演输出规范】
每轮回复包含：
1. 场景正文（400-1300字，按生活节奏浮动——细密处从容铺陈、平淡处一笔带过，连续两轮不得等长）：环境、事件、NPC言行、玩家行动的结果。叙述视角按玩家设定（默认第二人称"你"）。
2. (variable_update) 变量更新块（详见系统规则清单）——只写本轮有变化的字段，未变化者不重抄。
3. 结尾以【行动选项】为题给出 2-5 个真实可行的行动选项（都是此情此景做得出来的事：可以朴实、可以大胆，但不越出世界宪法的边界；数量按处境浮动，措辞每轮变奏），玩家也可自由输入任意行动。

【反八股条令（与铁律同级——本界知识库仅预置防八股两条，文风守护是唯一的系统意志）】
读者连读数十轮，最怕"每轮长一个样"。硬性要求：
1. 开头变奏：连续轮次严禁同构起笔——环境铺陈、对话直入、动作切入、心理独白、结果倒叙轮换使用；上一轮以景起笔，本轮必须换起法。
2. 禁语清单：以下AI高频套话一律禁用——"眸中闪过一丝精光""空气仿佛凝固""嘴角勾起一抹弧度""不知过了多久""仿佛过了一个世纪""声音不大却清晰""心脏漏跳一拍""眼底闪过冷意""如遭雷击"；同义变体亦不得连环出现。
3. 句式不复用：本轮正文不得复用上一轮的标志性句式与修辞。
4. 节奏呼吸：长段后接短段；对白、动作、留白交替，杜绝"环境—对话—结果—悬念"的固定四段循环。
5. NPC各有其声：同一NPC连续两轮的语气、用词、信息量须有差异；沉默与打断也是回应。台词要像这个世界、那个行当、那个出身的人说出的话。
6. 套话禁词总库（每轮必查）：正文动笔前先对照知识库「防八股·套话禁词总库」与「防八股·套路替换手册」两条目执行——禁词、禁短语、禁比喻句式、禁微表情、禁语气声线描写一律不得出现；「生理性」前缀、破折号（——）、「不是……而是……」句式一律禁用；紧张/哭泣/愤怒按套路替换手册写，同一情绪连续两段不得用同一身体部位；禁词判定不适用于实指名词（地名/人名/真实物件照常）。

【日常与波澜】
默认日常权重 70%，波澜权重 30%：
- 日常：作息、营生、三餐、赶路、家务、闲谈、天气、街坊——世界的血肉，须写得可信可感。
- 波澜：来自玩家主动的冒险与决定、生活压力的累积、他人意志的碰撞、世界事件的波及——绝不凭空天降。
- 世界的残酷与温柔并存：世界可能亏待你，也可能厚待你，但都以本世界自己的方式。

═══════════════════════════════════════
【创作要素速查表·补全】
═══════════════════════════════════════
重要提醒：本节为「可选清单」，不是必填项，也不构成任何预设世界观。本世界的一切仍以玩家在创世台亲笔写下的【世界宪法】为最高法则——宪法写了的按其执行，宪法没写的按世界之魂的质感推导；本表仅在玩家未详述、需要灵感锚点时提供参考维度。宪法与本表冲突时，一律以宪法为准。

## 一、世界构建维度（创世可参考的填法）
- 世界之魂（必填）：一句话说清「这是一个什么世界」——题材、质感、基调。
- 力量体系：无超自然 / 低魔 / 高魔 / 武道内力 / 修真境界 / 科技主导 / 异能觉醒 / 自定（写清来源、门槛与上限）。
- 生死法则：会死且不可逆 / 会死但可救（代价极高）/ 轮回转世 / 不死但会老会痛 / 自定。
- 时代与历法：具体纪年与年号，或以物候记年；决定器物、制度与称谓。
- 舞台地理：一处落脚点写清规模（几条街、何种地貌、以何为生），不必画全图。
- 通讯形态：无远距通讯（靠腿与烽烟）/ 书信信使 / 即时通讯 / 新旧并存。
- 经济与度量：货币、物价、度量衡、主要营生——钱要能算出数。
- 器物与禁忌：衣食住行用什么、什么话不能说、什么事犯忌。

## 二、可选力量体系（供参考，须与宪法自洽）
- 武道/内力：吃苦练出来的真功夫，境界有阶梯，受肉体极限约束。
- 修真/修仙：灵根定起点，境界分先后，寿元随境增，渡劫有陨落之险。
- 法术/低魔：稀有而昂贵，民间只有传说，会一点的人都藏着。
- 法术/高魔：像手艺一样普及，但高深者依然凤毛麟角。
- 科技/工程：无任何超自然，机械与工程即力量，受材料与能源约束。
- 异能觉醒：少数人天生异能，登记在册，社会对其又敬又怕。
- 血脉/天赋：继承而来，强弱与出身绑定，是阶层也是枷锁。
- 自定混合：可组合，但须写清不同体系之间的高低与相互克制。
铁律：任何力量都有习得成本、能力边界与代价；不得出现无代价的能力。

## 三、势力类型（可选，最多四家）
- 地头蛇/帮会：收过路钱也讲规矩，最接地气。
- 名门/宗派：架子大、讲传承与体面，投鼠忌器。
- 商会/钱庄：只认钱不认人，但账算得清。
- 官府/巡司：官面上的力量，规矩比天大。
- 旧族遗老：体面尚存、家底见空，靠人情与旧关系网。
- 底层互助组织：抱团取暖，讲义气也讲排外。
- 新兴势力：势头猛、根基浅，最需要盟友也最容易翻脸。
- 神秘低调者：没人知道底细，不轻易出手。
运转原则：势力各有立场、利益与日程，按自身逻辑结盟倾轧，不为玩家而存在；玩家与势力的交集才记入声望。未定义势力的世界，本节自然失效（可造一个没有势力的世界）。

## 四、场景类型（世界质感的容器）
- 居所：陋室/宅院/宿舍/舱房——玩家的落脚点与私人生活。
- 营生场所：铺面/工坊/码头/田地/矿坑/柜台——生计发生的地方。
- 公共空间：市集/酒馆/茶棚/澡堂/广场——信息与传闻交汇处。
- 权力空间：衙署/公馆/宗祠/议事堂——规矩与压迫的来源地。
- 交通与途中：道路/驿站/渡口/车船/浮桥——流动与偶遇。
- 边缘与野地：山林/荒野/废墟/洞窟——风险与资源的边界。
- 特殊场所：庙宇/医馆/当铺/黑市/藏书处——专业性与秘密的所在。
场景用法：场景决定可做的事与可见的人；同一场景反复出现会积累熟稔感，也不同场景轮换可扩展世界的面。

## 五、事件驱动与因果链（世界如何起波澜）
允许的波澜来源（只此四类）：
1. 玩家主动：玩家的选择、行动、放弃与坚持。
2. 世界偶然：天时物候、行情涨落、疾病、事故——须符合本世界的真实概率。
3. 他人意志：NPC 按自身利益与性格行事，与玩家合作、竞争或冲突。
4. 先前后果：早先行动延迟显形的回响。
因果链规则：① 因先于果，无因不生波澜；② 后果可延迟但不可消失，也不可被豁免；③ 连续两次以上的戏剧性巧合即视为违规；④ 世界自走——玩家不在场处，世界照常运转，玩家的缺席不改变任何事的进程。

## 六、玩家自由度与后果机制
- 自由度边界：玩家可自由输入任意行动，但行动不得越出世界宪法的边界（不能做到宪法不允许的事）。
- 后果守恒：每个行动都有符合本世界逻辑的后果，好坏皆然；世界不优待玩家，也不刻意迫害玩家。
- 代价落到具体处：钱、时间、体力、人情、声望、伤痛——后果须有可计量的落点，不空谈。
- 无主角光环：NPC 各有自己的人生日程，大人物不认识玩家，也不因玩家改变决定。
- 平凡即默认：大多数日子就是作息、营生、饭食与闲谈；把普通日子写出质感，比凭空制造事件高级得多。
- 生死有常：若宪法定义了「会死」，角色会老、会病、会死；死亡须有充分铺垫与合理因果，不得突然处刑。`;
const defaultSystemPrompt = `
【入场指令 - 极其重要！必须严格遵守！】

收到【入场】指令后的第一次回复，必须完成：
1. 世界落地：按世界宪法呈现一个具体的生活切片——声音、气味、光线、器物先行，以场景落地，禁止设定说明书式开头。开场结构六选一随机（严禁每局同款）：清晨醒来的一刻 / 一段进行中的劳作 / 一句对话直入 / 抵达某地的一瞬 / 一件小事的尾声 / 单一感官细节特写。
2. 身份落地：玩家按其自定义身份入场，落实住所、营生来源、随身财物与当务之急（钱、事、人情——总有一件最要紧的）。
3. 平凡开局：不安排任何"事件"——第一轮就是普通的一天/一段旅程/一个寻常处境。钩子不来自剧情，来自生活的自然纹理（一笔要还的账、一个要赴的约、一件没办完的事、一个惦记的人）。
4. 结尾附(variable_update)变量块（玩家角色卡完整建档 + 首批登场NPC卡）与3-4个【行动选项】。

═══════════════════════════════════════════════
你是自由世界的世界模拟引擎。世界宪法是最高法则。
【极其重要】每轮回复必须包含：
1. 场景正文（写实叙述，无系统字样）
2. (variable_update) 变量更新块（系统的核心，必须逐项检查）
3. 【行动选项】2-5 个真实可行的行动选项
4. 玩家角色死亡、或主动结束这段人生时，坦然收束并标记【人生终章】

【最高优先级 - variableUpdate 字段检查清单】

1. 回合与字数检查：
   - chapter: +1（每完成一轮交互）
   - wordCount: +本轮新增字数（只填本轮增量，勿填累计值）

2. 量表检查（0-100，按创世台定义逐项上报）：
   - 玩家自定量表：处境变化即如实增减（名称以系统注入的「本世量表」契约为准）

3. 时空位置检查（每轮必报，即使未变也重复输出）：
   - era: 所处时代/纪元（保持玩家创世原文，如「玄历三年」「旧纪元2077」「春秋战国」）
   - date: 当前日期（按世界历法如实推进；无历法世界写季节物候，如「深秋·初雪前」）
   - location: 本轮正文结束时所在（按世界地理自洽表述，如「云梦泽·南岸渔村」；转场到达即报新位置）
   - time: 时刻与天象（如「07:20·晨雾」「酉时·暮雨」）；weather: 一词天象

4. 玩家角色卡检查（玩家名.字段）：
   - 处境变化 → 玩家名.role: 新身份
   - 位置追踪（每轮必报）→ 玩家名.location: 本轮正文结束时所在（按世界地理自洽表述；人在哪就报哪，转场到达即报新位置，严禁报出发前的旧位置）
   - 境遇变化 → 玩家名.realm: 当前境遇（按世界质感自拟，如「初来乍到/立足未稳/小有名气」）
   - 其余字段（appearance/personality/speechPattern/motivation/goal/secret/status）有变化才写
   - 重要经历 → >>玩家名.history: 记录

5. NPC卡检查（登场才建档，有名有姓者方建档；新登场者字段尽量补全，已登场者只写本轮变化字段）：
   - 角色名.role 身份 / .age 年龄 / .appearance 外貌 / .personality 性格
   - 角色名.speechPattern 言谈习惯（口音、用词、口头禅——须符合其出身与这个世界）
   - 角色名.occupation 行当 / .location 当前行踪
   - 角色名.motivation 动机 / .goal 近期目标 / .secret 隐情
   - 角色名.impression 对玩家的印象 / .relationship 与玩家关系 / .trust 信任度0-100
   - 角色名.firstAppearance 初次登场 / .status 状态（在世/离场/身故） / .isCanon: false
   - 与玩家有实质互动后才填 impression/relationship；每轮有变化须更新

6. 在办之事 / 物品 / 大事记检查：
   - 新增 → +【在办】事项；了结 → -【在办】事项
   - 获得 → +物品名 x数量；失去 → -物品名 x数量
   - >>大事记: 玩家私事与世界动向如实记录

7. 势力声望检查（创世台定义了势力才有此节）：
   - 声望·势力名: 0-100（与该势力有实质互动才变动）

8. 沉浸套件上报（每轮必报）：
   - chapterTitle: 本回章回标题（7-14字，贴合世界质感）每轮必报
   - highlight: true 仅当本轮为人生名场面级，平常轮严禁标记
   - events: [{"name":"在办大事","days":剩余回数}] 仅时限性事务临近时上报
   - characters[已登场NPC名].favor: 好感度0-100整数（初见按人情世故起算；变化才写）

【完整检查清单】每次 variable_update 后逐项自查：
✅ chapter/wordCount 已更新
✅ era/date/location/time/weather 已如实上报（每轮必报）
✅ 自定量表按处境如实增减
✅ NPC登场已建档且言行符合其出身与这个世界
✅ 在办/物品/大事记已登记
✅ 正文与变量块内容一致`;
const defaultDynamicWorldPrompt = `你是这个自由世界的背景事件生成器。根据世界宪法（世界之魂/时代历法/势力版图）与玩家当前位置，生成"此刻世界别处正在发生的事"——市井传闻、势力动向、天时物候、远近大事的余波。要求：每条一句话（不超过60字），严格符合玩家创造的世界的质感与法则（不引入宪法之外的设定），可被玩家采纳追踪也可忽略；严禁剧透尚未发生的世界性转折，严禁任何超宪法事件。`;
const setupMeta = {
  perspectives: [
    { id: "second", name: '第二人称沉浸（"你"）', desc: '推荐：以"你"直面世界，代入感最强的扮演视角' },
    { id: "first", name: '第一人称自述（"我"）', desc: '以"我"的自述展开：心事与盘算直接呈现，沉浸最深' },
    { id: "third_limited", name: "第三人称贴身跟随", desc: '镜头式跟随你的角色，适合喜欢"看人生"的玩家' },
    { id: "mixed", name: "混合视角", desc: "场景第三人称铺陈，关键抉择瞬间转第二人称聚焦" }
  ],
  identities: [
    { id: "custom", name: "✎ 自定义身份（自由开局）", desc: "推荐：身份与开局细节由你亲笔写——写多细，开局就多细，AI 按你写的建档（在任何世界都成立）" },
    { id: "student", name: "求学之人", desc: "学生身份，按世界自动换装：私塾/学堂/魔法学院/武馆——课本换了千百种，求学的滋味没换" },
    { id: "craftsman", name: "手艺人", desc: "匠人：木匠/铁匠/符师/机械师——一门手艺吃四方，手停口停" },
    { id: "merchant", name: "买卖人", desc: "商贩：从走街行商到开店坐贾，进货看行情，赊账看人品" },
    { id: "medic", name: "医道中人", desc: "医者：从草药铺坐堂到战地医师——哪个世界都有人半夜来敲门" },
    { id: "soldier", name: "行伍之人", desc: "军人/护卫/佣兵：吃粮当兵，操练站岗——赶上什么年月，就是什么命" },
    { id: "worker", name: "打工人", desc: "工人/职员/学徒：薪水、加班、人情，哪个世界都一样不少" },
    { id: "driver", name: "车马之人", desc: "车夫/驭手/领航员：在路上讨生活，载尽人间百态" },
    { id: "cook", name: "灶上人家", desc: "厨子/饭馆经营者：烟火营生，起得最早，睡得最晚，人缘最杂" },
    { id: "scribe", name: "文字为生", desc: "文人/文员/史官：抄书、拟稿、记事——笔下有饭，也有是非" },
    { id: "artist", name: "卖艺之人", desc: "艺人/乐师/演员：台上风光台下凉，哪个世界都逃不开" },
    { id: "drifter", name: "无业游民", desc: "没有固定营生：打零工、蹭铺面、流浪或宅家——自由，也没底" },
    { id: "noble", name: "旧族之后", desc: "没落的贵族/世家子弟：体面还在，家底见空——身份是资产也是枷锁" },
    { id: "farmer", name: "耕作人家", desc: "农人：土地是最老也最诚实的行业，看天吃饭，一茬一茬地过日子" }
  ],
  aptitudes: [
    { id: "strong", name: "健壮体格", desc: "底子好扛造：力气活吃得下，病痛绕着走" },
    { id: "smart", name: "脑子好使", desc: "学东西快，账算得清，路记得住" },
    { id: "handy", name: "手艺灵巧", desc: "手上有准头：修得了东西，做得了细活" },
    { id: "likable", name: "人缘颇佳", desc: "天生讨人喜欢：生客三分熟，熟人肯帮衬" },
    { id: "goodlooking", name: "相貌出众", desc: "长相是敲门砖，也是是非根" },
    { id: "tough", name: "意志坚韧", desc: "扛得住熬：苦日子里不垮，认准的事不撒手" },
    { id: "quickwit", name: "急中生智", desc: "临场反应快：变故来了，总能先抓住点什么" },
    { id: "memory", name: "过目不忘", desc: "见过的人、听过的数、走过的路，忘不掉" },
    { id: "silver_tongue", name: "巧舌如簧", desc: "天生的谈判与套话好手：三句话让人放下戒备" },
    { id: "observant", name: "察言观色", desc: "眼皮活泛：谁不高兴、谁在说谎，半条街外就看得出来" },
    { id: "hardworking", name: "吃苦耐劳", desc: "最大的天赋是能熬：起得早，睡得晚，不挑活" },
    { id: "luck", name: "运气不错", desc: "小钱常赢、末班车常赶上——大运没有，小运不断" },
    { id: "plain", name: "平庸之资", desc: "毫无过人之处：一切全凭苦功、诚信与际遇——最难也最真实的活法" }
  ],
  styles: [
    { id: "realism", name: "写实白描（推荐）", desc: "契诃夫/汪曾祺式的生活流：细节说话，情绪克制，日常写得有滋味" },
    { id: "minimalism", name: "冷峻极简", desc: "海明威电报体：短句、留白、只写看得见的东西，情绪藏在冰面下" },
    { id: "gentle", name: "温柔日常", desc: "是枝裕和式：一饭一蔬、家人闲坐，温情与遗憾都淡淡的" },
    { id: "epic", name: "史诗正剧", desc: "严整的时代剧笔法：大世界做底，小人物做针脚" },
    { id: "adventure", name: "传奇冒险", desc: "跌宕的流浪汉小说笔法：路程、市集、奇遇与险境，热气腾腾" },
    { id: "wuxia", name: "古典侠气", desc: "话本与武侠的筋骨：短打长拳的节奏，市井与江湖互为表里" },
    { id: "dark", name: "冷硬暗黑", desc: "黑色小说笔法：阴郁、锋利、道德灰色，坏消息接踵而至" },
    { id: "custom", name: "✎ 自定义文风" }
  ],
  lengths: [
    { id: "week", name: "一段日子", words: 0, chapters: 20, desc: "约20回合：一段生活的细描——找份活计、了桩心事、过个节" },
    { id: "season", name: "一季光阴", words: 0, chapters: 40, desc: "约40回合：一季到一年的生活——落脚、立业、遇人、别离" },
    { id: "years", name: "数年浮沉", words: 0, chapters: 80, desc: "约80回合：数年浮沉——从陌生到扎根，从拮据到安稳（或反之）" },
    { id: "life", name: "漫长一生", words: 0, chapters: 200, desc: "200回合起步：从落脚谋生到暮年回望，完整地活一遍" }
  ]
};
const openings = [
  { id: "ordinary_day", name: "普通的一天", pointsModifier: 0, description: "从睡醒开始——今天和昨天没什么不同，日子翻过一页", effectsText: "", effects: {} },
  { id: "arriving", name: "初来乍到", pointsModifier: 0, description: "刚落脚一处地方：行李在脚边，认识的人一个没有", effectsText: "", effects: {} },
  { id: "first_work", name: "上工第一天", pointsModifier: -5, description: "新营生的头一天：规矩没摸清，谁都不好惹", effectsText: "", effects: {} },
  { id: "on_the_way", name: "旅途之中", pointsModifier: 0, description: "车马/船上，下一站未到：窗外风景缓缓，心事缓缓", effectsText: "", effects: {} },
  { id: "departing", name: "启程之日", pointsModifier: 0, description: "离开熟悉之地的那一天：身后的路断了，前面的路还没影", effectsText: "", effects: {} },
  { id: "broke_day", name: "山穷水尽", pointsModifier: 8, description: "盘缠见底、住处到期的那一天——从今天起，一文钱要掰两半花", effectsText: "", effects: {} },
  { id: "settling_in", name: "落脚之夜", pointsModifier: -8, description: "搬进新住处的第一晚：行李没拆完，新家的第一顿饭", effectsText: "", effects: {} },
  { id: "night_watch", name: "深夜当值", pointsModifier: 5, description: "众人睡去，你的班刚开始：夜里的世界是另一套规矩", effectsText: "", effects: {} },
  { id: "a_letter", name: "一纸来信", pointsModifier: 10, description: "一封信/一道令/一个口信：生活的轨道，从这一刻要拐弯了", effectsText: "", effects: {} },
  { id: "big_eve", name: "大典前夜", pointsModifier: 5, description: "明日有大事（集市/考核/庆典/开战）：今夜无人睡得安稳", effectsText: "", effects: {} }
];
const techniques = [
  { id: "skill", name: "一技之长", cost: 5, description: "一门吃饭的手艺——荒年饿不死手艺人" },
  { id: "lodging", name: "落脚之处", cost: 10, description: "名下有处栖身的屋子：旧是旧了点，不用交租" },
  { id: "savings", name: "一笔积蓄", cost: 10, description: "一笔救急的钱：不多，但够撑三个月" },
  { id: "mount", name: "代步之物", cost: 5, description: "一头牲口/一辆车/一张长期票（按世界自动换装）" },
  { id: "mentor", name: "良师一位", cost: 10, description: "一位肯指点你的师傅：手艺和门道，都是他给的" },
  { id: "friend", name: "故人相助", cost: 8, description: "一位能帮上忙的旧识：牵线、担保、借钱，看你开口的分量" },
  { id: "health_gift", name: "健壮体魄", cost: 5, description: "从小干活练出的底子：扛饿扛冻扛熬夜" },
  { id: "keepsake", name: "护身信物", cost: 12, description: "一件有来历的旧物：说不上值钱，但总在要紧的时候起点作用" },
  { id: "reputation", name: "小有名气", cost: 12, description: "圈子里有人知道你的名字：机会多，是非也多" },
  { id: "family_backing", name: "家中殷实", cost: 15, description: "家底厚实、亲族得力——但人情的账，迟早要还" }
];
const statKeys = [
  { key: "body", label: "体质" },
  { key: "intellect", label: "智力" },
  { key: "charm", label: "魅力" },
  { key: "will", label: "意志" },
  { key: "agility", label: "敏捷" },
  { key: "knowledge", label: "学识" }
];
const nameSeeds = {
  flavor: {
    "surname": ["陈", "林", "周", "吴", "郑", "王", "李", "张", "刘", "杨", "燕", "洛", "池", "岑", "温", "裴", "谢", "萧", "云", "苏"],
    "m": ["玄", "岳", "渊", "寒", "澈", "远", "拓", "衍", "铮", "辰", "昭", "明", "尘", "霄", "烨", "砚", "朔", "川", "衡", "晏"],
    "f": ["晚", "潼", "瑶", "璃", "月", "芷", "若", "素", "绾", "清", "婉", "曼", "音", "汀", "汐", "璇", "棠", "笙", "湄", "翎"]
  },
  ageRange: [16, 42],
  backgrounds: [
    "行李一只旧包袱，身上全部家当不到一百文——这地方很大，我打算先找张床",
    "家里人把地留给了兄长，我揣着长辈缝在衣角的积蓄出的门：混不出人样，就不回去了",
    "跟师傅学了七年徒，师傅说手艺可以出师了，就是家乡养不活这门手艺",
    "东家倒了，遣散费还有大半，家里的病人不能等：听说这城里有人有办法",
    "刚下了远路，盘缠买完这张票就见了底，好在有力气，肯下力气总有活干",
    "学艺满了师，家里托人找了份差事，管吃管住没什么钱，先干着再说",
    "在这地方晃了两年，换了五份活计，搬家搬得比换季还勤——这个月的租金又涨了",
    "故人走得早，亲族在外地：我把老屋托给了邻居，搬来这城里投奔旧相识，顺带找点事做",
    "街坊都说我是块读书的料，可惜家里只供得起这些年：如今在铺子里记账，书没丢",
    "跟着商队走了一条两年的远路，路熟了，人也散了架：这趟走完，想在这码头边安定下来",
    "帮工的铺子关了张，掌柜临走塞了半个月的工钱和一句话：手艺人，别荒了手",
    "天上掉不下来好事，但上回在市集押的那注，真押中了末彩：够我撑到找到下一份活"
  ],
  /* ==================== 创世灵感池（🎲 按钮） ==================== */
  souls: [
    "修真界的边陲小城：灵气稀薄的穷乡，仙门不入流的俗世——凡人在仙凡夹缝里过日子",
    "蒸汽与煤烟的旧帝都：锅炉、礼帽与电报线，机械义肢是新兴行当，贵族的舞会照旧开着",
    "末世后的第三十年：城市废墟上重建的聚落，旧世界的超市是圣地，雨水要过滤了才能喝",
    "猫掌权的江南水城：人类是二等公民，衙门里坐着的是穿官袍的狸花猫，鱼税比米税重",
    "群山环抱的武侠小镇：镖局、药铺、当铺与说书人，江湖很远又很近，恩怨隔三差五路过门口",
    "星际边陲的矿站：船长们欠着公司的债，酒馆里通宵放着旧地球的歌，下一班船要等半个月",
    "诸神黄昏后的北境：神死了，神庙改成了粮仓，但冬天的雪里偶尔还能听见低语",
    "一九〇〇年代的南洋小埠：会馆、批局与雨季，胶林深处有老虎，账房先生会三种语言"
  ],
  powers: [
    "低魔：法术稀有而昂贵，民间只有传说，会一点的人都藏着",
    "高魔：法术像手艺一样普及，但高深者依然凤毛麟角",
    "武道：内力与外功是真功夫，练武吃的是苦饭，宗门林立",
    "修真：灵根定天赋，境界分先后，凡人寿命不过百",
    "科技主导：无任何超自然，机械与工程就是力量",
    "异能觉醒：少数人天生异能，登记在册，社会对其又敬又怕"
  ],
  deaths: [
    "会死：人死如灯灭，无复活无重来，死亡不可逆",
    "会死但可救：濒死可被高人/医术/秘宝拉回，但代价极高",
    "轮回：死后转世，记忆与因果随业力流转",
    "不死之身：玩家角色不会死于普通伤害，但会老、会痛、会失去"
  ],
  eras: [
    "玄历三年：新朝立国不久，旧势力蛰伏未消",
    "旧历2077年：大灾变后第七十多年，新历法刚立",
    "蒸汽历二百年：工业革命后的第二个世纪",
    "无历法：以物候记年，「大水那年」「双彗星之冬」",
    "神历1274年：教会纪年，历法由神殿颁布",
    "末世纪元31年：以灾变日为元年重新数起的年份"
  ],
  geos: [
    "云梦泽南岸的渔村水镇，青石板路，三条街一座桥",
    "环山矿镇：一条主街，两头是矿坑与货栈，铁轨通向远方",
    "港口自由市：各族杂居，酒馆比教堂多，商会说了算",
    "戈壁绿洲城：水源即权力，坎儿井归城主家管",
    "浮空岛链上的悬空港：吊桥与飞艇，脚下的云海深不见底",
    "旧都旧城区：窄巷密如蛛网，天井里晾着各家的衣裳"
  ],
  factionNames: ["黑风寨", "云鹤门", "同业公会", "旧贵族院", "商会", "巡夜司", "矿工兄弟会", "白莲余部", "外邦商行", "义庄行会"],
  factionStances: [
    "地头蛇，收过路钱也讲规矩",
    "名门正派，架子大，耳朵背",
    "只认钱，不认人，但账算得清",
    "旧时代的遗老，体面还剩三成",
    "官面上的势力，规矩比天大",
    "底层的互助组织，抱团取暖",
    "新兴势力，势头猛，根基浅",
    "神秘低调，没人知道底细"
  ]
};
const FreeWorldStoryConfig = {
  mode: "roleplay",
  genreKey: "freeworld",
  genreName: "自由世界",
  worldForge: true,
  // 创世台模式：向导渲染四步创世而非标准身份设定台
  fullSystemPrompt,
  defaultSystemPrompt,
  defaultDynamicWorldPrompt,
  /* 宪法动态注入：每次请求实时拼装（世界宪法 + 本世量表契约 + 势力声望契约） */
  systemPrompt: function() {
    const fw = window.storyFramework;
    const wc = FreeWorldForge.worldCodeOf(fw);
    let sp = fullSystemPrompt;
    if (wc) {
      const constitution = FreeWorldForge.constitutionOf(wc);
      if (constitution) {
        sp += `

【世界宪法（最高法则·玩家亲笔创造，逐条严格执行）】
${constitution}`;
      }
      const gc = FreeWorldForge.gaugeContract(wc.gauges);
      if (gc) sp += `

【本世量表（variable_update 顶层字段，每轮如实增减）】
${gc}`;
      const fc = FreeWorldForge.factionContract(wc.factions);
      if (fc) sp += `

【势力声望（variable_update 顶层字段，有实质互动才变动）】
${fc}`;
    } else {
      sp += `

【本世量表（variable_update 顶层字段，每轮如实增减）】
${FreeWorldForge.gaugeContract(null)}`;
    }
    return sp;
  },
  dynamicWorldPrompt: () => defaultDynamicWorldPrompt,
  /* 插画画风：从玩家亲笔的世界之魂动态派生（image-gen/npc-portrait 均只读不写，getter 安全；
     未开篇/旧档回退本界通用画风——画风随世界走，世界随玩家走） */
  get imageStyle() {
    try {
      const wc = window.storyFramework && window.storyFramework.storyState && window.storyFramework.storyState.setup && window.storyFramework.storyState.setup.worldCode;
      const soul = wc && wc.soul ? String(wc.soul).slice(0, 60) : "";
      return soul ? `高质量文学插画，严格贴合玩家亲笔的世界之魂（${soul}）——人物服饰、器物、场景逐条符合该世界宪法，电影感构图，氛围写实` : "高质量文学插画，画风严格贴合玩家亲笔创造的世界宪法，人物服饰、器物、场景符合世界设定，电影感构图，氛围写实";
    } catch (e) {
      return "高质量文学插画，画风严格贴合玩家亲笔创造的世界设定，电影感构图，氛围写实";
    }
  },
  setupMeta,
  openings,
  techniques,
  statKeys,
  gauges: FreeWorldForge.DEFAULT_GAUGES.map((g) => ({ ...g })),
  // 兜底；创世/读档时按玩家定义覆写
  nameSeeds,
  baseAttributes: { body: 14, intellect: 14, charm: 10, will: 12, agility: 10, knowledge: 10 },
  maxPoints: 100,
  maxTechniques: 3,
  startRealm: "初来乍到·立足未稳",
  statsLabel: "个人资质",
  statusFields: ["状态", "生计"],
  // 创世/读档时同步为玩家量表键
  panelLabels: { progress: "人生回合", unit: "回合", notStarted: "未入场·世界待造", gauges: "本世量表", stats: "个人资质" },
  identityHint: "决定你的营生与起点（在世界里自动换装）",
  timelineHint: "",
  roleplayIntro: "创世——你写下的每一个字，就是这个世界的宪法。什么世界、什么法则、什么时代、什么势力，全部由你亲笔；系统只守护一件事：文风不八股。世界不给你故事，只给你因果",
  roleplayPlaceholders: {
    soul: "世界之魂——一句话或一段话，说清这是一个什么世界。例：修真界边陲的穷陋小城，灵气稀薄，仙门看不上，凡人在仙凡夹缝里过日子……写多细，世界就执行多细",
    power: "自定义力量体系——例：此界剑修为尊但剑心难成，百人习剑一人成剑心，成者可开山断流",
    death: "自定义生死法则——例：人死可招魂，但魂魄七日即散，招魂要折阳寿",
    era: "时代与历法——例：玄历三年，新朝立国不久，旧朝余部仍在南疆活动；或写无历法，以物候记年",
    geo: "舞台地理——例：云梦泽南岸的水镇，三条街一座桥，半数人家以渔为生，青石板路涨水就淹",
    entry: "自定义入场第一幕——例：清晨，橹声把水镇摇醒，我蹲在码头等头一班鱼市……（写清场景与处境，AI 按此开场）",
    identity: "自定义身份详述（家世/营生/技能/财产/目标/牵挂皆可写）——写多细，开局就多细，AI 按你写的建档"
  },
  enterBtn: "🔨 落笔成世，开始生活",
  renderStatus: (vars) => window.StoryStatusRenderer.refresh(vars),
  /** 开场指令：宪法全文内联（第一轮就要世界严丝合缝）+ 量表初值 + 势力声望 */
  buildOpeningInstruction: (setup) => {
    const wc = setup.worldCode || {};
    const soulPart = wc.soul ? `世界之魂：${wc.soul}` : "世界之魂：玩家未详述——按后续设定自行推导一个自洽的世界质感";
    const rules = [];
    if (wc.power) rules.push(`力量体系——${wc.power}`);
    if (wc.death) rules.push(`生死法则——${wc.death}`);
    if (wc.era) rules.push(`时代与历法——${wc.era}`);
    if (wc.geo) rules.push(`舞台地理——${wc.geo}`);
    if (Array.isArray(wc.factions) && wc.factions.length) {
      rules.push(`势力版图——${wc.factions.map((f) => `${f.name}（${f.stance || "立场未述"}）`).join("／")}`);
    }
    if (wc.comm) rules.push(`通讯形态——${FreeWorldForge.commRule(wc.comm)}`);
    const gauges = Array.isArray(wc.gauges) && wc.gauges.length ? wc.gauges : FreeWorldForge.DEFAULT_GAUGES;
    const gaugePart = gauges.map((g) => `${g.key}: ${g.default}`).join(" / ");
    const facPart = Array.isArray(wc.factions) && wc.factions.length ? wc.factions.map((f) => `声望·${f.name}: 30（初值，此后按实质互动涨落）`).join(" / ") : "";
    const identityPart = setup.customIdentity ? `自定义身份——玩家亲笔设定（最高优先级，逐条落实到开场处境与角色卡）：${setup.customIdentity}` : setup.identity;
    const aptPart = setup.customAptitude ? `自定义资质——${setup.customAptitude}` : `资质：${setup.aptitude}`;
    const stylePart = setup.customStyle ? `文风基调——玩家亲笔指定（正文笔法按此执行）：${setup.customStyle}` : `文风基调：${setup.style || "写实白描"}${setup.styleDesc ? `（${setup.styleDesc}）` : ""}`;
    const entryPart = setup.customEntry ? `；入场第一幕（玩家亲笔，开场场景与处境逐条按此执行）：${setup.customEntry}` : "";
    const boonPart = setup.customBoon ? `；起始条件（已生效，按世界逻辑兑现）：${setup.customBoon}` : "";
    return `【创世入场】玩家角色「${setup.playerName}」（${setup.gender}，${setup.age}岁，${identityPart}，${aptPart}）降生于玩家亲笔创造的世界——${soulPart}${rules.length ? `；${rules.join("；")}` : ""}。以上即【世界宪法】，为本世界最高法则：一切存在物、能力、制度、称谓严格据此校准，宪法未及处以世界之魂的质感自行推导，禁止引入宪法之外的设定体系。${facPart}${entryPart}${boonPart}。${stylePart}。请以世界模拟引擎身份主持开场：按宪法呈现一个具体的生活切片（声音、气味、光线、器物先行），落实玩家的住所、营生来源、随身财物与当务之急（钱、事、人情——总有一件最要紧的），引入处境中自然存在的人物（各有自己的人生，不为玩家而存在）；不得安排任何戏剧性事件——第一轮就是一段真实的日常。开场结构六选一随机（严禁每局同款）。结尾附(variable_update)变量块（玩家角色卡完整建档+首批登场NPC卡尽量全字段+era/date/location/time/weather 按世界历法五项上报+本世量表初值：${gaugePart}${facPart ? "；" + facPart : ""}）与3-4个真实可行的【行动选项】。`;
  },
  onInit: function(framework) {
    console.log("[FreeWorldStoryConfig] 自由世界配置已加载");
    document.body.classList.add("theme-freeworld");
    const t = document.getElementById("gameTitle");
    if (t) t.textContent = `自由世界 · 宪法至上`;
    this.restoreGauges(framework);
    const statusPanelContainer = document.getElementById("statusPanelContainer");
    if (statusPanelContainer && statusPanelContainer.children.length === 0) {
      statusPanelContainer.innerHTML = window.StoryStatusRenderer.generatePanelHTML();
    }
  },
  /** 量表接线（创世台落笔与读档恢复共用）：玩家定义 → config.gauges/statusFields + 面板骨架重建 */
  applyGauges: function(framework, gauges) {
    var _a, _b;
    if (!Array.isArray(gauges) || !gauges.length) return;
    this.gauges = gauges;
    this.statusFields = gauges.map((g) => g.key);
    try {
      (_a = framework.updateStatusPanel) == null ? void 0 : _a.call(framework);
      if (typeof document === "undefined") return;
      const c = document.getElementById("statusPanelContainer");
      if (c) c.innerHTML = window.StoryStatusRenderer.generatePanelHTML();
      window.StoryStatusRenderer.refresh(((_b = framework.storyState) == null ? void 0 : _b.variables) || {});
    } catch (e) {
    }
  },
  /** 读档时从 setup.worldCode 恢复量表（旧档/未开篇静默跳过，保持兜底量表） */
  restoreGauges: function(framework) {
    try {
      if (!framework || !framework.storyState || !framework.storyState.isStoryStarted) return;
      const wc = framework.storyState.setup && framework.storyState.setup.worldCode;
      if (wc && Array.isArray(wc.gauges) && wc.gauges.length) {
        this.gauges = wc.gauges;
        this.statusFields = wc.gauges.map((g) => g.key);
      }
    } catch (e) {
    }
  }
};
window.FreeWorldForge = FreeWorldForge;
window.FreeWorldStoryConfig = FreeWorldStoryConfig;
window.GenreStoryConfig = FreeWorldStoryConfig;
