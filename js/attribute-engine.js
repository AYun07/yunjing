/* =========================================================================
 * 云境 · 属性引擎 AttributeEngine（v3.55.27）
 *
 * 用户诉求：「六维属性不能只是个数字——每种属性对应强项偏向，属性数值要随
 *   游玩增长，且要做好数值平衡；只要玩家没要求，不得突然冒出离谱数值」
 *   「天赋社会反响要真的实现效果，不是看说明文档」
 *   「出现时间跨越（几天/几月/几年）时，对应数值增长要合理计算并增加」
 *
 * 真实机制（全部引擎侧强制，非仅提示词约定）：
 * 1) 资质定档 classifyAptitude：按资质名/描述关键词自动定档 顶级/稀有/中平/低劣
 *    （自定义资质交主笔首轮定档）；档位随存档持久化（v.talent）。
 * 2) 天赋状态机 absorbTalent：解析「天赋.定档 / 天赋.暴露 / 天赋.名称」——
 *    档位归一化四档；暴露单向（hidden→exposed），已暴露不可改回隐藏
 *    （暴露过的事收不回去），归一化非法档位。
 * 3) 数值平衡钳制 applyStatDelta：变量块 stats.* 增量经此落表——
 *    · 单项单轮 |Δ| ≤ 6（无时间跨越时；有跨越时按该轴时间额度放宽）
 *    · 单轮全部属性合计 |Δ| ≤ 10（有跨越时按时间总预算放宽）
 *    · 值域钳制 [0, 100]；绝对值写入视为「当前值→目标值」的增量再钳制
 * 4) 强项偏向 buildLiveBlock：每轮随状态面板注入当前六维值 + 强项（前二）
 *    的行为偏向语义（按语义轴归类，世界自适应——凡人的「神识」与都市的
 *    「精神力」同走感知轴），天赋档位/暴露状态同块注入。
 * 5) 懒种子 seed：老档/新档统一在首次读取时补种（v.stats ← setup.stats，
 *    v.talent ← 定档），旧档零迁移成本。
 * 6) v3.55.27 时间跨越成长（引擎侧真实落表，不是提示词自觉）：
 *    · parseSpanDays 跨度解析：变量块「时间.跨度: 三年」优先，正文
 *      「闭关三年后 / 一晃三载」兜底（须带跨越语境，避免「三年之约」误判）
 *    · timeAllowance 时间额度：按轴差异化——修学最吃时间、肉身感知次之、
 *      心志谋算靠阅历缓慢增长、机缘近乎天生不随苦修暴涨；再乘 天赋档位
 *      系数 × 期间活动系数（闭关苦修 > 寻常度日 > 囚禁养伤），并用
 *      「cap·(1-0.5^(raw/cap))」做边际递减（越久越难涨，永不破顶）
 *    · 越接近满值涨得越慢（瓶颈系数 1-0.55·(cur/100)²）
 *    · settleTimeGrowth 自动补齐：AI 变量块上报的成长先落表并抵充额度，
 *      不足部分由引擎按公式真实补涨（AI 一个字没写也会涨）；AI 已报足或
 *      报跌落则不重复给；同一章同一跨度只结算一次（防逐楼重复结算）
 *    · 时间账本 v.time：累计世界天数、本轮跨度、期间状态、上次结算明细
 * ========================================================================= */
(function () {
  "use strict";

  /* ---------- 语义轴：把各世界资质键归入六大行为轴（世界自适应） ----------
   * dpp = 时间成长「涨 1 点所需有效天数」；cap = 单次跨越该轴的成长硬顶。
   * 差异化理由：修学/感知靠日积月累最吃时间，肉身次之，心志谋算靠阅历缓慢
   * 增长，机缘（气运/魅力一类）近乎天生，不随苦修暴涨。 */
  var AXES = [
    { id: "body", name: "肉身", dpp: 40, cap: 18, bias: "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
      kw: ["力量", "体魄", "体质", "气血", "肉身", "拳", "根骨", " constitution", "strength", "body", "体"] },
    { id: "sense", name: "感知", dpp: 30, cap: 19, bias: "危险预感、搜寻踪迹、识破隐匿、斗法先知先觉一类判定占优",
      kw: ["神识", "感知", "精神", "灵觉", "直觉", "眼力", "spirit", "sense", "perception"] },
    { id: "mind", name: "心志", dpp: 70, cap: 13, bias: "抵抗诱惑、幻术、恐惧与心魔，苦熬瓶颈不崩、绝境不乱",
      kw: ["心性", "意志", "道心", "坚韧", "temper", "will", "毅"] },
    { id: "wit", name: "谋算", dpp: 90, cap: 11, bias: "谋划布局、辩才谈判、破译推演占优，能想他人想不到的一步",
      kw: ["谋略", "智计", "智慧", "智力", "心机", "wit", "intellect", "logic", "谋"] },
    { id: "learn", name: "修学", dpp: 18, cap: 26, bias: "修炼进度快、功法武技学得快、举一反三融会贯通",
      kw: ["资质", "悟性", "修炼", "学习", "灵根", "root", "aptitude", "learn", "悟"] },
    { id: "luck", name: "机缘", dpp: 300, cap: 5, bias: "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
      kw: ["气运", "运道", "幸运", "机缘", "fortune", "luck", "魅力", "亲和", "人缘", "charm", "缘"] }
  ];
  var GENERIC_AXIS = { id: "generic", name: "专精", dpp: 50, cap: 15, bias: "该维度主导的同类行动天然占优" };

  function axisOf(key, label) {
    var t = String(key || "") + " " + String(label || "");
    var tl = t.toLowerCase();
    for (var i = 0; i < AXES.length; i++) {
      var kws = AXES[i].kw;
      for (var j = 0; j < kws.length; j++) {
        if (tl.indexOf(kws[j]) >= 0) return AXES[i];
      }
    }
    return GENERIC_AXIS;
  }

  /* ---------- 资质定档（关键词启发，世界自适应由主笔校准） ---------- */
  var TIER_NAMES = ["顶级", "稀有", "中平", "低劣"];
  function classifyAptitude(setup) {
    if (!setup) return "";
    /* 自定义资质：玩家亲笔，档位交主笔首轮按世界观定档（引擎不猜） */
    if (setup.customAptitude && !setup.aptitude) return "";
    var text = String(setup.aptitude || "") + " " + String(setup.aptitudeDesc || "") + " " + String(setup.customAptitude || "");
    if (/万中无一|百年难遇|千年难遇|冠绝|绝世|无双|顶尖|顶级|惊世|震古|盖世/.test(text)) return "顶级";
    if (/平庸|杂灵根|伪灵根|几乎无望|难望|低劣|愚钝|迟钝|缓慢如|凡人之姿|最难/.test(text)) return "低劣";
    if (/上等|极佳|出众|罕见|难得|天赋异禀|万里挑一|拔尖|过人|好苗子|香饽饽|胚子/.test(text)) return "稀有";
    return "中平";
  }
  function normalizeTier(s) {
    var t = String(s || "");
    if (/顶级|绝世|万中无一|盖世|震古/.test(t)) return "顶级";
    if (/稀有|争抢/.test(t)) return "稀有";
    if (/低劣|低下|垫底|废/.test(t)) return "低劣";
    if (/中平|普通|中等|中人之资/.test(t)) return "中平";
    return TIER_NAMES.indexOf(t) >= 0 ? t : "";
  }

  /* ---------- 懒种子：老档零迁移 ---------- */
  function seed(state) {
    try {
      if (!state || !state.variables) return;
      var v = state.variables;
      var ss = state.setup && state.setup.stats;
      if ((!v.stats || typeof v.stats !== "object" || !Object.keys(v.stats).length) && ss && Object.keys(ss).length) {
        v.stats = Object.assign({}, ss);
      }
      if (!v.talent || typeof v.talent !== "object") {
        v.talent = {
          name: String((state.setup && (state.setup.aptitude || state.setup.customAptitude)) || "").slice(0, 30) || "未定",
          tier: classifyAptitude(state.setup) || "待定档",
          exposure: "hidden"
        };
      }
      if (v.talent.exposure !== "exposed") v.talent.exposure = "hidden";
    } catch (e) { /* 种子失败不阻断 */ }
  }

  /* ================= v3.55.27 时间跨越：跨度解析 + 时间成长结算 ================= */

  /* 中文数字 → 阿拉伯数字（含 十/十五/二十/百/千/半/数） */
  var CN_DIGIT = { 零: 0, 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  function cn2num(raw) {
    var s = String(raw == null ? "" : raw).trim();
    if (!s) return NaN;
    if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
    if (s === "半") return 0.5;
    if (s === "数" || s === "几") return 3;
    if (s.indexOf("十") >= 0) {
      var parts = s.split("十");
      var a = parts[0] ? CN_DIGIT[parts[0]] : 1;
      var b = parts[1] ? CN_DIGIT[parts[1]] : 0;
      if (a != null && b != null) return a * 10 + b;
    }
    var m = s.match(/^([一二两三四五六七八九]?)\s*(百|千|万)/);
    if (m) {
      var base = { 百: 100, 千: 1000, 万: 10000 }[m[2]];
      var pre = m[1] ? CN_DIGIT[m[1]] : 1;
      if (pre != null) return pre * base;
    }
    return CN_DIGIT[s] != null ? CN_DIGIT[s] : NaN;
  }

  /* 单位 → 天（顺序敏感：长单位先测） */
  var UNIT_DAYS = [
    [/甲子/, 21600], [/春秋|周岁|年|载/, 360], [/季/, 90],
    [/月/, 30], [/旬/, 10], [/日|天|昼夜/, 1]
  ];
  /* 跨越语境：仅当数字附近出现这些词才认定「时间真的过去了」——
     否则「三年之约」「百日誓师」这类静态期限会被误判成跨越 */
  var SPAN_CTX = /后|之后|过去|已过|过了|飞逝|流逝|转眼|一晃|弹指|光阴|岁月|年间|期间|历时|历经|匆匆|闭关|坐关|死关|苦修|潜心|修炼|打坐|吐纳|运功|苦练|勤修|不辍|浸淫|钻研|研习|参悟|悟道|淬炼|炼体|修行|苦读|操练|蛰伏|沉眠|沉睡|昏迷|囚|牢|禁|养伤|卧床|重病|流落|逃亡|藏匿|隐匿|封印|冰封|长眠|软禁|度日|虚度|浑噩|游历|走遍|跋涉|赶路|潜伏|隐居|闭门|征战|历练|远行|飘泊|漂泊|再|又过|方|才|满|足足|整|整整/;

  /**
   * 解析文本中的时间跨度（天）
   * @returns {{days:number, text:string}} days=0 表示未检出跨越
   */
  function parseSpanDays(text, strict) {
    var src = String(text || "");
    /* 显式上报（「时间.跨度: 五年」）无需语境校验：文本自带标记时自动识别 */
    var needCtx = strict !== false && !/(时间\s*\.\s*跨度|时间跨度|time\s*\.\s*span)\s*[:：]/i.test(src);
    if (!src) return { days: 0, text: "" };
    var re = /(\d+(?:\.\d+)?|[零一两二三四五六七八九十百千万半数几]{1,4})\s*(甲子|春秋|周岁|年|载|季|个月|月|旬|日|天|昼夜)/g;
    var m, best = 0, bestText = "";
    while ((m = re.exec(src))) {
      var n = cn2num(m[1]);
      if (!isFinite(n) || n <= 0) continue;
      var days = 0;
      for (var u = 0; u < UNIT_DAYS.length; u++) {
        if (UNIT_DAYS[u][0].test(m[2])) { days = UNIT_DAYS[u][1]; break; }
      }
      if (!days) continue;
      var total = n * days;
      if (total < 1) continue;                       /* 时辰/刻级不算跨越 */
      if (needCtx) {
        var ctx = src.slice(Math.max(0, m.index - 10), m.index + m[0].length + 10);
        if (!SPAN_CTX.test(ctx)) continue;
      }
      if (total > best) { best = total; bestText = m[0]; }
    }
    return { days: best, text: bestText };
  }

  /** 天数 → 人类可读（「三载」「三月」「十日」） */
  function daysText(d) {
    d = Number(d) || 0;
    if (d >= 720) return (Math.round(d / 360 * 10) / 10) + "年";
    if (d >= 60) return (Math.round(d / 30 * 10) / 10) + "个月";
    if (d >= 1) return (Math.round(d * 10) / 10) + "天";
    return "";
  }

  /* 期间活动系数：这段时间玩家在做什么，决定成长快慢 */
  var ACT_RULES = [
    { name: "勤修苦练", rate: 1.15, re: /闭关|苦修|潜心|打坐|吐纳|运功|修炼|苦练|勤修|不辍|浸淫|钻研|研习|历练|征战|搏杀|淬炼|炼体|悟道|参悟|勤学|苦读|操练|修行|操演|对练/ },
    { name: "困顿虚度", rate: 0.45, re: /囚禁|牢|昏迷|沉睡|沉眠|重伤|养伤|卧床|重病|残疾|残废|浑噩|消沉|颓废|醉生|赶路|流落|逃亡|藏匿|隐匿|蛰伏|封印|冰封|长眠|软禁/ }
  ];
  var ACT_DEFAULT = { name: "寻常度日", rate: 0.8 };

  /* 天赋档位成长系数：顶级天赋闭关一年胜过常人苦修数年 */
  var TIER_RATE = { "顶级": 1.8, "稀有": 1.35, "中平": 1.0, "低劣": 0.55 };

  /* 时间成长的规模约束 */
  var MIN_SPAN_DAYS = 7;      /* 一周以内按「本轮日常」处理，不另结算时间成长 */
  var CAP_TIME_TOTAL = 80;    /* 单次跨越六维合计成长硬顶（防一跃满值） */
  var DECAY_K = 1.38;         /* 边际递减速率：软顶放远一点，让三年与十年拉开差距 */
  /* 模块级最近结算记录：登记官会对同一回复二次解析，且合并后账本可能被覆盖——
     用它兜底防重复（只看 v.time 会漏） */
  var LAST_SETTLE = { days: 0, text: "", chapter: -1 };

  /**
   * 某属性在给定跨越下的时间成长额度（点）
   * 边际递减：cap·(1-0.5^(raw/cap))——raw=cap 得 0.5cap，2cap 得 0.75cap，
   * 永不破顶，且「越往后越难涨」符合修炼规律。
   */
  function timeAllowance(key, label, days, tierRate, actRate) {
    var ax = axisOf(key, label);
    var dpp = ax.dpp || 50, cap = ax.cap || 12;
    var eff = days * (tierRate || 1) * (actRate || 1);
    if (eff < MIN_SPAN_DAYS) return 0;
    var raw = eff / dpp;
    var g = cap * (1 - Math.pow(0.5, raw / (cap * DECAY_K)));
    return Math.round(g * 10) / 10;
  }

  /** 瓶颈系数：越接近满值涨得越慢（100 时只剩 45%） */
  function bottleneck(cur) {
    var c = Math.max(0, Math.min(100, Number(cur) || 0));
    return 1 - 0.55 * Math.pow(c / 100, 2);
  }

  /* ---------- 数值平衡钳制 ---------- */
  var TURN = { total: 0, gain: {}, allow: {}, span: { days: 0, text: "" }, act: ACT_DEFAULT, tierRate: 1, actTotal: 0 };
  /**
   * 每轮开始：重置预算 + 解析本轮时间跨度 + 预算各属性的时间成长额度
   * @param {string} [replyText] AI 本轮回复全文（含变量块，用于检出跨度与期间状态）
   * @param {object} [vars] 当前变量集（定天赋档位与属性键）
   */
  function beginTurn(replyText, vars) {
    TURN.total = 0; TURN.gain = {}; TURN.allow = {};
    TURN.span = { days: 0, text: "" };
    TURN.act = ACT_DEFAULT; TURN.tierRate = 1; TURN.actTotal = 0;
    try {
      var fw = typeof window !== "undefined" ? window.storyFramework : null;
      var st = null;
      if (vars && vars.stats) st = { variables: vars, setup: fw && fw.storyState && fw.storyState.setup };
      else if (fw && fw.storyState) st = fw.storyState;
      if (!st) return;
      seed(st);
      var v = st.variables || {};
      TURN.tierRate = TIER_RATE[v.talent && v.talent.tier] || 1;
      var txt = String(replyText || "");
      /* 1) 变量块显式上报优先：「时间.跨度: 三年」 */
      var ex = txt.match(/(?:时间\s*\.\s*跨度|时间\s*\.\s*推进|时间\s*\.\s*流逝|时间跨度|time\s*\.\s*span)\s*[:：]\s*([^\n]{1,24})/i);
      var sp = ex ? parseSpanDays(ex[1], false) : { days: 0, text: "" };
      if (!(sp && sp.days > 0)) sp = parseSpanDays(txt);
      if (sp && sp.days > 0) TURN.span = sp;
      /* 2) 期间活动性质 */
      TURN.act = ACT_DEFAULT;
      for (var i = 0; i < ACT_RULES.length; i++) {
        if (ACT_RULES[i].re.test(txt)) { TURN.act = ACT_RULES[i]; break; }
      }
      /* 3) 各属性的时间成长额度（供钳制放宽与自动补齐共用） */
      var cfg = (fw && fw.config) || {};
      var labelMap = {};
      (cfg.statKeys || []).forEach(function (sk) { if (sk && sk.key) labelMap[sk.key] = sk.label; });
      var stats = v.stats && typeof v.stats === "object" ? v.stats : {};
      Object.keys(stats).forEach(function (k) {
        if (typeof stats[k] !== "number") return;
        TURN.allow[k] = timeAllowance(k, labelMap[k] || k, TURN.span.days, TURN.tierRate, TURN.act.rate);
      });
    } catch (e) { /* 解析失败退回默认预算 */ }
  }
  var CAP_PER_STAT = 6;    /* 单项单轮硬上限（无时间跨越时）：无正文依据的跳变在此拦截 */
  var CAP_PER_TURN = 10;   /* 单轮全部属性合计上限（无时间跨越时） */

  /** 本轮单项上限：无跨越时 6；有跨越时按该轴时间额度放宽（×1.2 容差给主笔发挥，
      再多就是离谱跳变——引擎照旧拦） */
  function capForStat(key) {
    var allow = TURN.allow[key] || 0;
    return Math.max(CAP_PER_STAT, Math.round(allow * 1.2 * 10) / 10);
  }
  /** 本轮合计上限：无跨越时 10；有跨越时按时间总预算放宽 */
  function capForTurn() {
    var sum = 0;
    for (var k in TURN.allow) sum += TURN.allow[k];
    return Math.max(CAP_PER_TURN, Math.min(CAP_TIME_TOTAL, Math.round(sum * 1.2 * 10) / 10));
  }

  function clampStatDelta(cur, delta, capStat) {
    var d = delta;
    var clipped = false;
    var cap = typeof capStat === "number" ? capStat : CAP_PER_STAT;
    if (d > cap) { d = cap; clipped = true; }
    if (d < -cap) { d = -cap; clipped = true; }
    var remain = capForTurn() - TURN.total;
    if (Math.abs(d) > Math.abs(remain)) { d = remain >= 0 ? Math.min(d, remain) : Math.max(d, remain); clipped = true; }
    if (d !== 0) TURN.total += Math.abs(d);
    var val = Math.max(0, Math.min(100, Math.round(((typeof cur === "number" ? cur : 0) + d) * 100) / 100));
    return { val: val, clipped: clipped, delta: d };
  }

  /** 变量块 stats.* 落表入口：rawValue 为 "+5"/"-3"/"42" */
  function applyStatDelta(target, key, rawValue) {
    try {
      var s = String(rawValue).trim();
      var cur = typeof target[key] === "number" ? target[key] : 0;
      var m = s.match(/^([+-])\s*(\d+(?:\.\d+)?)$/);
      var delta = m ? parseFloat(m[2]) * (m[1] === "-" ? -1 : 1)
        : (/^\d+(?:\.\d+)?$/.test(s) ? (parseFloat(s) - cur) : 0);
      if (!isFinite(delta)) return;
      var r = clampStatDelta(cur, delta, capForStat(key));
      target[key] = r.val;
      /* 记录本轮该属性实际落表增量：供 settleTimeGrowth 抵充时间额度，避免重复给 */
      TURN.gain[key] = Math.round(((TURN.gain[key] || 0) + (r.val - cur)) * 10) / 10;
      if (r.clipped && window.YJ_DEBUG) console.log("[AttributeEngine] 数值平衡钳制:", key, "请求Δ" + delta, "→ 实际Δ" + r.delta);
    } catch (e) { /* 钳制失败退回直写由调用方处理 */ }
  }

  /**
   * 时间跨越成长结算：AI 已上报的成长抵充额度，不足部分引擎按公式真实补涨
   * @param {object} vars 变量集（会就地写入 v.stats 与 v.time）
   * @param {boolean} isStory 是否正文登记路径（动态世界的旁白推演不结算）
   * @returns {object|null} 结算明细
   */
  function settleTimeGrowth(vars, isStory) {
    try {
      if (!isStory) return null;
      var days = TURN.span.days;
      if (!(days >= MIN_SPAN_DAYS)) return null;
      var fw = typeof window !== "undefined" ? window.storyFramework : null;
      if (fw && fw.config && fw.config.mode !== "roleplay") return null; /* 创作模式六维是文风权重 */
      if (!vars || typeof vars !== "object") return null;
      var stats = vars.stats && typeof vars.stats === "object" ? vars.stats : null;
      if (!stats || !Object.keys(stats).length) return null;
      /* 防重复：同一章、同一跨度只结算一次（否则「三年后」被逐楼反复结算） */
      var chapter = Number(vars.chapter) || 0;
      var tv = vars.time && typeof vars.time === "object" ? vars.time : (vars.time = {});
      if (tv.lastSpanDays === days && tv.lastSpanChapter === chapter && tv.lastSpanText === TURN.span.text) return null;
      if (LAST_SETTLE.days === days && LAST_SETTLE.chapter === chapter && LAST_SETTLE.text === TURN.span.text) return null;
      var applied = {}, sum = 0;
      Object.keys(stats).forEach(function (k) {
        if (typeof stats[k] !== "number") return;
        var allow = TURN.allow[k] || timeAllowance(k, "", days, TURN.tierRate, TURN.act.rate);
        if (!(allow > 0)) return;
        var got = TURN.gain[k] || 0;
        if (got < 0) return;                       /* AI 明确报跌落：尊重正文，不补 */
        var need = Math.round((allow - got) * 10) / 10;
        if (need <= 0.05) return;                  /* AI 已报足（或超出）：不重复给 */
        if (sum + need > CAP_TIME_TOTAL) need = Math.round(Math.max(0, CAP_TIME_TOTAL - sum) * 10) / 10;
        if (need <= 0) return;
        var cur = stats[k];
        need = Math.round(need * bottleneck(cur) * 10) / 10;   /* 越接近满值涨得越慢 */
        var nv = Math.max(0, Math.min(100, Math.round((cur + need) * 10) / 10));
        var real = Math.round((nv - cur) * 10) / 10;
        if (real > 0) { stats[k] = nv; applied[k] = real; sum = Math.round((sum + real) * 10) / 10; }
      });
      /* 时间账本：累计天数 / 本轮跨度 / 期间状态 / 上次结算明细 */
      tv.days = Math.round(((Number(tv.days) || 0) + days) * 10) / 10;
      tv.span = days;
      tv.spanText = TURN.span.text || daysText(days);
      tv.lastSpanDays = days;
      tv.lastSpanChapter = chapter;
      tv.lastSpanText = TURN.span.text || daysText(days);
      tv.activity = TURN.act.name;
      tv.lastGrowth = applied;
      tv.lastGrowthTotal = sum;
      LAST_SETTLE = { days: days, chapter: chapter, text: TURN.span.text };
      if (window.YJ_DEBUG) console.log("[AttributeEngine] 时间跨越结算:", daysText(days), TURN.act.name, JSON.stringify(applied));
      return { days: days, spanText: tv.spanText, activity: TURN.act.name, applied: applied, total: sum };
    } catch (e) {
      return null;
    }
  }

  /** 变量块「时间.跨度/纪元/期间」容器入口 */
  function absorbTime(vars, field, rawValue) {
    try {
      if (!vars || typeof vars !== "object") return;
      vars.time = vars.time && typeof vars.time === "object" ? vars.time : {};
      var val = String(rawValue == null ? "" : rawValue).trim();
      if (!val) return;
      if (/跨度|推进|流逝|经过|过去|span/i.test(field)) {
        var sp = parseSpanDays(val, false);
        if (sp.days > 0) { TURN.span = sp; vars.time.spanText = sp.text; }
        return;
      }
      if (/纪元|年号|年代|日期|era/i.test(field)) { vars.time.era = val.slice(0, 30); return; }
      if (/期间|状态|活动|activity/i.test(field)) {
        vars.time.activity = val.slice(0, 20);
        for (var i = 0; i < ACT_RULES.length; i++) {
          if (ACT_RULES[i].re.test(val)) { TURN.act = ACT_RULES[i]; break; }
        }
      }
    } catch (e) { /* 不阻断 */ }
  }

  /* ---------- 天赋状态机 ---------- */
  function absorbTalent(vars, field, rawValue) {
    try {
      var v = vars;
      v.talent = v.talent && typeof v.talent === "object" ? v.talent : {};
      var val = String(rawValue == null ? "" : rawValue).trim();
      if (!val) return;
      if (/定档|档位|等级|评级/.test(field)) {
        var t = normalizeTier(val);
        if (t) v.talent.tier = t;
        else v.talent.tierRaw = val.slice(0, 20); /* 主笔自定义档位描述保真保留 */
      } else if (/暴露|曝光|公开|传开|reveal/.test(field)) {
        if (/已?暴露|公开|传开|人尽皆知|reveal/.test(val)) {
          if (v.talent.exposure !== "exposed") v.talent.exposedAt = Number(vars.chapter) || undefined;
          v.talent.exposure = "exposed"; /* 单向：暴露过就收不回 */
        }
        /* 请求改回「隐藏」：忽略（状态机拒绝），暴露状态不变 */
      } else if (/名称|名字|talent/.test(field)) {
        v.talent.name = val.slice(0, 30);
      }
    } catch (e) { /* 不阻断 */ }
  }

  /* ---------- 每轮注入：当前值 + 强项偏向 + 天赋状态 + 增长纪律 ---------- */
  function buildLiveBlock(fw) {
    try {
      fw = fw || window.storyFramework;
      if (!fw || !fw.storyState || !fw.storyState.variables) return "";
      if (fw.config && fw.config.mode !== "roleplay") return ""; /* 创作模式六维是文风权重，不适用 */
      var state = fw.storyState;
      seed(state);
      var v = state.variables;
      var cfg = fw.config || {};
      var labelMap = {};
      (cfg.statKeys || []).forEach(function (s) { if (s && s.key) labelMap[s.key] = s.label; });
      var stats = v.stats && typeof v.stats === "object" ? v.stats : {};
      var keys = Object.keys(stats).filter(function (k) { return typeof stats[k] === "number"; });
      if (!keys.length) return "";
      var vals = keys.map(function (k) { return { k: k, label: labelMap[k] || k, v: stats[k] }; });
      var line1 = "属性：" + vals.map(function (x) { return x.label + " " + x.v; }).join(" / ");
      /* 强项 = 值最高的前二（并列取靠前） */
      var sorted = vals.slice().sort(function (a, b) { return b.v - a.v; });
      var top = sorted.slice(0, 2).filter(function (x) { return x.v >= 55; });
      var lines = [line1];
      if (top.length) {
        var seenAxis = {};
        var biases = [];
        top.forEach(function (x) {
          var ax = axisOf(x.k, x.label);
          if (seenAxis[ax.id]) return;
          seenAxis[ax.id] = 1;
          biases.push("「" + x.label + "」（" + ax.name + "轴）——" + ax.bias);
        });
        if (biases.length) lines.push("强项偏向（强项场景行文天然占优、他人据此另眼相待；弱项场景可受阻）：\n· " + biases.join("\n· "));
      }
      var t = v.talent || {};
      var tierDesc = { "顶级": "顶级·万中无一（顶尖势力会为之惊动）", "稀有": "稀有·强宗名门争抢", "中平": "中平", "低劣": "低劣·被倨傲者轻视（温和者不以天赋取人）" };
      var tline = "天赋：" + (t.name || "未定") + " · 定档「" + (tierDesc[t.tier] ? t.tier + "——" + tierDesc[t.tier] : (t.tier || "待定档")) + "」· " + (t.exposure === "exposed" ? "已暴露（社会反响按档位发酵、口耳相传）" : "隐藏中（知情者仅限剧情已揭示者，不得未卜先知）");
      lines.push(tline);
      /* v3.55.27 时间账本：让主笔知道世界时间走到哪了 */
      var tv = v.time && typeof v.time === "object" ? v.time : null;
      if (tv && (tv.days > 0 || tv.span)) {
        var segs = [];
        if (tv.era) segs.push("纪元 " + tv.era);
        segs.push("累计推进 " + daysText(tv.days || 0));
        if (tv.span) segs.push("上一轮跨越 " + (tv.spanText || daysText(tv.span)) + "（期间：" + (tv.activity || "寻常度日") + "）");
        if (tv.lastGrowthTotal > 0) {
          var gs = Object.keys(tv.lastGrowth || {}).map(function (k) { return (labelMap[k] || k) + " +" + tv.lastGrowth[k]; }).join("、");
          if (gs) segs.push("该次跨越已按公式结算成长：" + gs);
        }
        lines.push("⏳ 世界时间：" + segs.join("；"));
      }
      var capNow = capForTurn();
      var discipline = "属性增长纪律（引擎强制钳制，越界部分会被真实截掉）：本轮全部属性增减合计≤" + capNow + "、单项≤" + capForStat(keys[0] || "") + "；常规修炼每轮 0-2 点；突破/丹药/机缘单项≤6 且正文须有明确缘由；值域 0-100；无正文依据的跳变一律无效。";
      if (TURN.span.days >= MIN_SPAN_DAYS) {
        var allowStr = keys.map(function (k) { return (labelMap[k] || k) + " ≤+" + (TURN.allow[k] || 0); }).join("、");
        discipline += "\n【本轮发生时间跨越：" + daysText(TURN.span.days) + "，期间" + TURN.act.name + "】属性须按跨越幅度相应增长（闭关三年不得只涨两点），上限参考：" + allowStr +
          "；可在变量块直接写 stats.某某: +N 上报（引擎按额度放行），未写或写不足的部分由引擎按公式自动补齐——但补齐只看跨度与期间状态，若这段时间玩家另有奇遇/跌落，请自行在变量块写明以免与事实不符。";
      } else {
        discipline += "\n若本轮剧情发生时间跨越（数日/数月/数年），请在变量块写「时间.跨度: 三年」并让属性按幅度增长——引擎会据此放宽钳制、并按公式补齐未上报的成长。";
      }
      lines.push(discipline);
      return lines.join("\n");
    } catch (e) {
      return "";
    }
  }

  function stats() {
    return { turnTotal: TURN.total, capPerStat: CAP_PER_STAT, capPerTurn: CAP_PER_TURN };
  }

  window.AttributeEngine = {
    classifyAptitude: classifyAptitude,
    normalizeTier: normalizeTier,
    seed: seed,
    beginTurn: beginTurn,
    applyStatDelta: applyStatDelta,
    absorbTalent: absorbTalent,
    absorbTime: absorbTime,
    settleTimeGrowth: settleTimeGrowth,
    parseSpanDays: parseSpanDays,
    timeAllowance: timeAllowance,
    daysText: daysText,
    buildLiveBlock: buildLiveBlock,
    axisOf: axisOf,
    stats: stats,
    TIER_NAMES: TIER_NAMES
  };
})();
