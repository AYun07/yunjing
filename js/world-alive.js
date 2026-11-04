/* 云境 · 活世界双向桥 WorldAlive v3.85.0（整改工作单 P0-1 核心）
 * ---------------------------------------------------------------------------
 * 根因：机械层（world-clock 自转 / WorldBus 恩怨 / wr_stage 阶段 / SimCore 演化 /
 *       WorldRuntime.NPC）明明在算状态，却从未进入主笔提示词；主笔选择也从未回写世界。
 *       叙事层与机械层零通信 → 玩家选择改变不了世界结构（R3/R4 不成立）。
 *
 * 本模块为两层之间唯一的桥：
 *   上行（世界 → 主笔）：buildPromptBlock() 结构化注入当前世界状态。
 *   下行（主笔/变量AI → 世界）：applyAI() 解析 (world_update) 块，回写势力/恩怨/关系/阶段/NPC/张力。
 *   自转（世界自演化）：seedFactions() 初始化真实势力实体，供 world-clock 每 tick 驱动 SimCore.advance。
 *
 * 状态真源：window.storyFramework.storyState.variables（.entities / .tension / .时间），
 *          世界书/恩怨另存 WorldBus，阶段存 wr_stage 模块，NPC 存 WorldRuntime.NPC。
 */
(function () {
  "use strict";

  function slotId() { try { return (window.storyFramework && window.storyFramework.slotId) || "main"; } catch (e) { return "main"; } }
  function genre() {
    try { if (window.WorldExt && WorldExt.genre) return WorldExt.genre; } catch (e) {}
    try { return new URLSearchParams(location.search).get("genre") || "free"; } catch (e) { return "free"; }
  }
  function vars() {
    var fw = window.storyFramework;
    return (fw && fw.storyState && fw.storyState.variables) || null;
  }
  function nowRound() { try { var fw = window.storyFramework; return (fw && fw.storyState && Number(fw.storyState.turnCount)) || (fw && fw.storyState && Number(fw.storyState.variables && fw.storyState.variables.chapter)) || 0; } catch (e) { return 0; } }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function STORE() { return "yunjingWorldAlive~" + slotId() + "~" + genre(); }

  /* 持久化：活跃事件 + 上轮影响力快照（用于 ↑↓ 显示）+ 事件连锁/AI 事件/生命周期记账 */
  var mem = { events: [], prevInf: {}, chain: [], aiEvents: [], lastLifeDay: -1, facts: [], stageFallback: 0, facSeed: "" };
  function loadMem() {
    try { var raw = localStorage.getItem(STORE()); if (raw) { var d = JSON.parse(raw); if (d && typeof d === "object") { mem.events = Array.isArray(d.events) ? d.events : []; mem.prevInf = d.prevInf && typeof d.prevInf === "object" ? d.prevInf : {}; mem.chain = Array.isArray(d.chain) ? d.chain : []; mem.aiEvents = Array.isArray(d.aiEvents) ? d.aiEvents : []; mem.lastLifeDay = d.lastLifeDay != null ? Number(d.lastLifeDay) : -1; mem.facts = Array.isArray(d.facts) ? d.facts : []; mem.stageFallback = d.stageFallback != null ? Number(d.stageFallback) : 0; mem.facSeed = typeof d.facSeed === "string" ? d.facSeed : ""; } } } catch (e) {}
  }
  function saveMem() { try { localStorage.setItem(STORE(), JSON.stringify({ events: mem.events, prevInf: mem.prevInf, chain: mem.chain, aiEvents: mem.aiEvents, lastLifeDay: mem.lastLifeDay, facts: mem.facts, stageFallback: mem.stageFallback, facSeed: mem.facSeed })); } catch (e) {} }
  loadMem();

  /* ---------- 真实势力实体初始化（首轮从世界阶段静态表播种） ---------- */
  function hashStr(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; } return h; }

  /* v3.88.0 修正 P2-1：势力名改从「本界真实知识库」取（33 界各不相同），静态 fa 表降为兜底。
     原先 33 界共用同一张固定 3 名表，导致每个世界开局都是同样三个势力，不满足"每个世界对应的势力" */
  /* 从知识库条目标题中抽取「专名」当势力名。
     知识库里 category 命中"势力"的条目常常是技法/分析文（如「门规的三种功能」「门派经济与产业经营学」），
     直接拿 title 会得到一堆不是势力的名字，故此处做专名还原 + 技法词剔除。 */
  var FAC_BAD = /写作|伏笔|三幕|节奏|读者|视角|对白|爽点|描写|结构|弧光|塑造|运营|定稿|开篇|节拍|经济|经营|财政|产业|态度|困境|征兆|功能|布局|空间|划分|显性|隐性|传承|门规|仪轨|分野|读法|悟性|关系|互动|分析|研究|指南|手册|速造|原则|方法|技巧|如何|怎么|为何|浅析|漫谈|杂谈|考据|设定|时间线|世界观|生态|格局|体系|概况|简介|介绍|档案|名录|考|辨析|演变|流变|分类|种类|类型|特点|特征|意义|影响|作用|价值|逻辑|机制|原理|规律|现象|问题|误区|清单|盘点|汇总|整理|漕运|盐政|军政|军务|吏治|乡绅|宗族|大赦|逃犯|官场|朝堂|学$|论$|法$|志$|史$|的|者$/;
  /* 通名：这些词本身不是某个势力的名字，抽到就丢 */
  var FAC_GENERIC = /^(江湖|天下|武林|世界|势力|组织|门派|宗门|家族|阵营|朝廷|官府|帝国|联盟|军队|学院|庙堂|边关|人间|红尘|庙宇|修行界|修真界|修仙界|江湖势力|各方势力)$/;
  function facNameFrom(title) {
    var s = String(title || "");
    s = s.replace(/[（(][^）)]*[）)]/g, "");              /* 去括号注释 */
    s = s.replace(/^[^·：:]{1,14}[·：:]/, "");             /* 去系列/书名前缀（如「斗罗大陆·」「凡人·」） */
    s = s.replace(/[、，,。；;！!].*$/, "");              /* 去并列尾串 */
    /* 并列结构「A与B」「A和B」：取主体 A（仅当 A 足够长才切） */
    var i, CJ = ["与", "和", "及"];
    for (i = 0; i < CJ.length; i++) { var idx = s.indexOf(CJ[i]); if (idx >= 3) { s = s.slice(0, idx); break; } }
    /* 去尾部的体裁后缀 */
    s = s.replace(/(详录|详解|详述|实录|总纲|往事|秘史|纪事|纪要|概况|简介|档案|名录|兴衰|之乱|崛起|覆灭|总体战爆发|总动员|战争|战争与和平|纪年|编年)$/, "");
    s = s.replace(/^[\s·、,，.。:：\-—]+|[\s·、,，.。:：\-—]+$/g, "");
    return s.slice(0, 14);
  }
  function kbFactionNames() {
    var out = [], seen = {}, scored = [];
    try {
      var list = (window.KB_PRESETS && window.KB_PRESETS[genre()]) || [];
      var RE = /势力|组织|门派|宗门|家族|阵营|帮会|商会|镖局|集团|军团|教会|公司|机构|王朝|帝国|联盟|部落|学院|议会|军队|门派组织|江湖与庙堂/;
      list.forEach(function (it) {
        if (!it || !it.title) return;
        var cat = String(it.category || "");
        var tagstr = Array.isArray(it.tags) ? it.tags.join(" ") : "";
        var hitCat = RE.test(cat), hitTag = RE.test(tagstr);
        if (!hitCat && !hitTag) return;
        var n = facNameFrom(String(it.title));
        if (!n || n.length < 2 || n.length > 14) return;
        if (FAC_BAD.test(n) || FAC_GENERIC.test(n)) return;
        /* 注意：JS 的 \w 只含 [A-Za-z0-9_]，汉字属于 \W，故必须显式判定"含汉字或字母" */
        if (!/[A-Za-z\u4e00-\u9fa5]/.test(n)) return;
        if (seen[n]) return;
        seen[n] = 1;
        scored.push({ n: n, s: hitCat ? 2 : 1 });
      });
      /* 类目直接命中（更可信）优先，其次按 哈希 稳定排序 */
      var g = genre();
      scored.sort(function (a, b) { return (b.s - a.s) || (hashStr(g + a.n) - hashStr(g + b.n)); });
      out = scored.map(function (x) { return x.n; });
    } catch (e) {}
    return out.slice(0, 6);
  }

  /* 势力是否已被 AI/玩家/涌现改写（若已改写则不再换名，避免抹掉剧情成果） */
  function factionsUntouched(v) {
    var fs = v.entities.factions || {};
    var ks = Object.keys(fs);
    if (!ks.length) return true;
    return ks.every(function (k) { return (fs[k] || {}).origin === "world"; });
  }

  function seedFactions() {
    var v = vars(); if (!v) return;
    v.entities = v.entities || {};
    v.entities.factions = v.entities.factions || {};
    v.entities.relations = v.entities.relations || [];
    if (v.tension == null) v.tension = 20;

    var kbNames = kbFactionNames();
    var src = kbNames.length ? "kb" : "fallback";

    /* 已播种过：只有"上次用兜底名、本界真实知识库现已就绪、且势力尚未被剧情改写"时才升级换名 */
    if (Object.keys(v.entities.factions).length) {
      if (mem.facSeed === "fallback" && src === "kb" && factionsUntouched(v)) {
        Object.keys(v.entities.factions).forEach(function (k) { if ((v.entities.factions[k] || {}).origin === "world") delete v.entities.factions[k]; });
      } else {
        return v.entities.factions;
      }
    }

    /* KB 专名不足 3 个时用世界阶段静态表补齐：保证每界至少 3 方势力，不会因 KB 只抽到 1 个而只剩 1 方 */
    var names = kbNames.slice();
    try { var D = window.WorldStage && window.WorldStage.data; var c = D && D[genre()]; if (c && c.fa) c.fa.forEach(function (x) { if (x && names.indexOf(x) < 0) names.push(x); }); } catch (e) {}
    var GEN = ["主角阵营", "对立阵营", "中立势力"];
    for (var gi = 0; names.length < 3 && gi < GEN.length; gi++) { if (names.indexOf(GEN[gi]) < 0) names.push(GEN[gi]); }
    names = names.slice(0, 6);

    var GEAR = ["守序", "扩张", "中立", "隐世", "逐利", "激进"];
    var seeded = false;
    names.forEach(function (n, i) {
      var key = "fac_" + i + "_" + n;
      if (v.entities.factions[key]) return;
      var h = hashStr(genre() + n);
      v.entities.factions[key] = {
        id: key, name: n,
        members: 8 + (h % 18),
        territory: 1 + (h % 4),
        influence: clamp(38 + (h % 25) - 8, 26, 72),
        ideology: GEAR[i % GEAR.length],
        origin: "world"
      };
      seeded = true;
    });
    if (seeded) { mem.facSeed = src; saveMem(); }
    return v.entities.factions;
  }

  /* ---------- 内部结构读取 ---------- */
  function factionsList() {
    var v = vars(); if (!v || !v.entities) return [];
    return Object.values(v.entities.factions || {}).map(function (f) {
      return { name: f.name, influence: clamp(Math.round(Number(f.influence) || 0), 0, 100), members: Math.round(Number(f.members) || 0) };
    });
  }
  function stageInfo() {
    var m = null; try { m = window.WorldExt && WorldExt.modState ? WorldExt.modState("wr_stage") : null; } catch (e) {}
    /* v3.88.0 修正：模块未就绪时不再静默丢阶段，回落到 applyAI 留档的 mem.stageFallback */
    var st = m ? (Number(m.state.stage) || 1) : (Number(mem.stageFallback) || 1);
    var name = "";
    try { var D = window.WorldStage && window.WorldStage.data; var c = D && D[genre()]; if (c && c.st) name = c.st[st - 1] || ""; } catch (e) {}
    return { stage: st, name: name };
  }
  function grudgePairs() {
    var out = [];
    try { var g = window.WorldBus && window.WorldBus.grudges; if (g) for (var k in g) if (g.hasOwnProperty(k)) out.push({ name: k, v: Math.round(Number(g[k]) || 0) }); } catch (e) {}
    out.sort(function (a, b) { return a.v - b.v; });
    return out;
  }
  function recentSignals() {
    var out = [];
    /* v3.88.0 修正 P2：drainFacts() 原先全仓零调用（死 API）。此处收干残留 facts 队列并沉淀到 mem，
       使其真正进入上行注入，而不是堆在内存里没人读。 */
    try {
      if (window.WorldBus && typeof WorldBus.drainFacts === "function") {
        var drained = WorldBus.drainFacts();
        if (drained && drained.length) {
          mem.facts = (mem.facts || []).concat(drained.map(function (x) {
            return typeof x === "string" ? x : ((x && (x.text || x.msg)) || "");
          }).filter(Boolean)).slice(-8);
          saveMem();
        }
      }
    } catch (e) {}
    try { if (window.WorldBus && WorldBus.recent) out = out.concat(WorldBus.recent() || []); } catch (e) {}
    out = out.concat(mem.facts || []);
    var seen = {};
    return out.filter(function (s) { if (!s || seen[s]) return false; seen[s] = 1; return true; });
  }
  function recentAutoEvents() {
    var v = vars(); if (!v) return [];
    var out = [];
    try {
      var pending = (v.时间 && v.时间.pendingEvents) || [];
      pending.forEach(function (e) { if (e) out.push(String(e)); });
      var hist = Array.isArray(v.history) ? v.history : [];
      for (var i = hist.length - 1; i >= 0 && out.length < 4; i--) {
        var t = String(hist[i] || "");
        if (t.indexOf("【世界】") >= 0 || t.indexOf("【众生】") >= 0) out.push(t.replace(/【(?:世界|众生)】/, "").trim());
      }
    } catch (e) {}
    return out.slice(0, 4);
  }
  function npcBehaviors() {
    var out = [];
    var seen = {};
    function push(n) {
      if (!n || !n.name || seen[n.name]) return;
      if (n.faction === "离队" || n.status === "离队") return;
      if (n.goal || n.goals || n.emotion) { seen[n.name] = 1; out.push(n); }
    }
    /* 主笔人物真源（v.characters）——人格可改写层首要来源 */
    try {
      var cv = vars();
      var chars = (cv && cv.characters && typeof cv.characters === "object") ? cv.characters : {};
      Object.keys(chars).forEach(function (name) {
        var c = chars[name];
        if (!c || c.origin === "玩家") return;
        push({ name: name, goal: c.goal, goals: c.goal, emotion: c.emotion, trust: c.trust });
      });
    } catch (e) {}
    try {
      var list = window.WorldRuntime && window.WorldRuntime.NPC ? WorldRuntime.NPC.list() : [];
      list.forEach(function (n) {
        if (n.faction === "离队") return;
        if (n.goals || n.emotion) push({ name: n.name, goal: n.goals, goals: n.goals, emotion: n.emotion, trust: n.trust });
      });
    } catch (e) {}
    return out.slice(0, 3);
  }

  /* ---------- 上行：结构化注入主笔 ---------- */
  function buildPromptBlock() {
    var v = vars(); if (!v) return null;
    var parts = [];
    parts.push("【世界当前状态 · 必须遵守】");
    var day = (v.时间 && Number(v.时间.clockDay)) || 0;
    parts.push("- 世界自转：第 " + day + " 日（每 180s = 世界 1 日，脱离玩家操作也在推进；数值变化真实累积）");
    var si = stageInfo();
    if (si.name) parts.push("- 时代阶段：" + si.name + "（第 " + si.stage + "/3 阶段）");
    var facs = factionsList();
    var infLine = facs.map(function (f) {
      var prev = mem.prevInf[f.name];
      var d = (prev != null) ? (f.influence - prev) : 0;
      var arrow = d > 0 ? "↑(+" + d + ")" : d < 0 ? "↓(" + d + ")" : "";
      return f.name + " 影响力 " + f.influence + arrow;
    }).join(" ｜ ");
    if (infLine) parts.push("- 势力消长：" + infLine);
    /* 活跃事件 */
    var act = mem.events.filter(function (e) { return e.status !== "over"; });
    if (act.length) parts.push("- 当前活跃事件：" + act.map(function (e) { return e.name + "（第 " + e.round + " 回合起）"; }).join(" ｜ "));
    /* 与玩家恩怨 */
    var gs = grudgePairs();
    if (gs.length) {
      var top = gs.slice(-3).concat(gs.slice(0, 2));
      var seen = {}; var lines = [];
      top.forEach(function (g) { if (seen[g.name]) return; seen[g.name] = 1;
        var tag = g.v <= -10 ? "敌意" : g.v >= 10 ? "亲厚" : "中立";
        lines.push(g.name + " " + tag + " " + g.v + (g.v <= -10 ? "（其名单上有你）" : g.v >= 10 ? "（可托付）" : ""));
      });
      parts.push("- 与玩家有关的恩怨：" + lines.join(" ｜ "));
    }
    /* 近期世界自行发生 */
    var auto = recentAutoEvents();
    if (auto.length) parts.push("- 近期世界自行发生：" + auto.join("；"));
    /* NPC 行为约束 */
    var npcs = npcBehaviors();
    if (npcs.length) {
      parts.push("【人物行为约束】下列人物本轮须按其「当前目标 / 当前情绪」行动，不得 OOC：");
      npcs.forEach(function (n) {
        var bits = [];
        if (n.goals) bits.push("目标：" + n.goals);
        if (n.emotion) bits.push("情绪：" + n.emotion);
        bits.push("信任：" + (n.trust != null ? n.trust : 50));
        parts.push("· " + n.name + " —— " + bits.join(" ｜ "));
      });
    }
    /* 近期系统信号（原死代码队列，现为上行可见信号） */
    var sig = recentSignals();
    if (sig.length) parts.push("- 世界近期信号：" + sig.slice(-3).join("；"));
    /* P0-2 涌现式机缘 + 分支主线（有代价有时限，过期即逝；同一幕不同选择→不同形态） */
    try { if (window.OpportunitySystem && OpportunitySystem.buildPromptBlock) { var oq = OpportunitySystem.buildPromptBlock(); if (oq) parts.push(oq); } } catch (e) {}
    parts.push("【本轮硬约束】上述势力与恩怨的走向必须被正文体现；已断诱因的大事不得发生；玩家无动作时世界仍按上述状态自行演化。");
    return parts.join("\n");
  }

  /* ---------- 下行：解析 (world_update) 块并回写 ---------- */
  function numOrDelta(str, cur) {
    str = String(str).trim();
    if (str[0] === "+" || str[0] === "-") return clamp((cur || 0) + parseInt(str, 10), -100, 100);
    var n = parseInt(str, 10);
    return isFinite(n) ? clamp(n, -100, 100) : cur;
  }
  function ensureFaction(name) {
    var v = vars(); if (!v) return null;
    v.entities = v.entities || {}; v.entities.factions = v.entities.factions || {};
    var f = Object.values(v.entities.factions).find(function (x) { return x.name === name; });
    if (!f) {
      var key = "fac_user_" + name;
      f = v.entities.factions[key] = { id: key, name: name, members: 10, territory: 2, influence: 50, ideology: "未知", origin: "player" };
    }
    return f;
  }
  /* P2-3：AI 注册新物品（写入 v.entities.items，随存档持久化，供世界书/图鉴消费） */
  function ensureItem(name) {
    var v = vars(); if (!v || !name) return null;
    v.entities = v.entities || {}; v.entities.items = v.entities.items || {};
    var it = v.entities.items[name] = v.entities.items[name] || { id: "item_" + name, name: name, count: 1, source: "ai" };
    return it;
  }
  var ITEM_FIELD_MAP = { rarity: "rarity", 品阶: "rarity", desc: "desc", 描述: "desc", count: "count", 数量: "count", slot: "slot", 槽位: "slot", owner: "owner", 持有者: "owner" };
  /* v3.86.0 P1-2：把人物的情绪/目标/记忆/信任写进「主笔人物」真源 v.characters（叙事层直接引用），
     同时镜像到 WorldRuntime.NPC（生活模拟子系统）以兼容既有 NPC 面板。两者合一，不再两处各存一份。 */
  function writeChar(name, patch) {
    var v = vars(); if (!v || !name) return;
    v.characters = v.characters || {};
    var c = v.characters[name] = v.characters[name] || {};
    for (var k in patch) if (patch.hasOwnProperty(k)) c[k] = patch[k];
    try { if (window.WorldRuntime && WorldRuntime.NPC) WorldRuntime.NPC.upsert(Object.assign({ name: name }, patch)); } catch (e) {}
  }
  function setRelation(a, b, kind, strength) {
    var v = vars(); if (!v) return;
    v.entities = v.entities || {}; v.entities.relations = v.entities.relations || [];
    var r = v.entities.relations.find(function (x) { return (x.a === a && x.b === b) || (x.a === b && x.b === a); });
    if (!r) { r = { a: a, b: b, kind: kind || "陌路", strength: strength, at: Date.now(), hist: [{ t: Date.now(), v: strength, why: kind || "关系建立" }] }; v.entities.relations.push(r); }
    else { if (kind) r.kind = kind; if (r.strength !== strength) { r.hist = r.hist || []; r.hist.push({ t: Date.now(), v: strength, why: kind || "关系变动" }); if (r.hist.length > 12) r.hist.shift(); r.strength = strength; r.at = Date.now(); } }
  }
  function trackEvent(name, status, round) {
    var e = mem.events.find(function (x) { return x.name === name; });
    if (e) { e.status = status; e.round = round; }
    else mem.events.push({ name: name, status: status, round: round });
    if (mem.events.length > 12) mem.events = mem.events.slice(-12);
    saveMem();
  }
  function applyAI(block) {
    if (!block || !block.trim()) return;
    var v = vars(); if (!v) return;
    v.entities = v.entities || {};
    var lines = String(block).split("\n");
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line.indexOf("#") === 0) continue;
      var eq = line.indexOf("=");
      if (eq < 0) continue;
      var key = line.slice(0, eq).trim();
      var val = line.slice(eq + 1).trim();
      try {
        if (key === "stage") {
          var m = null; try { m = window.WorldExt && WorldExt.modState ? WorldExt.modState("wr_stage") : null; } catch (e2) {}
          var wantStage = clamp(parseInt(val, 10) || 1, 1, 3);
          /* v3.88.0 修正：模块未注册时不再静默无操作，改为留档到 mem，下一轮注入仍能看到阶段推进 */
          if (m) { m.state.stage = wantStage; }
          else { mem.stageFallback = wantStage; saveMem(); }
        } else if (key.indexOf("faction.") === 0) {
          var rest = key.slice(8);
          var dot = rest.lastIndexOf(".");
          var fname = rest.slice(0, dot);
          var field = rest.slice(dot + 1);
          var f = ensureFaction(fname);
          if (f) {
            if (field === "influence") f.influence = numOrDelta(val, Number(f.influence) || 0);
            else if (field === "members") f.members = Math.max(0, numOrDelta(val, Number(f.members) || 0));
            else if (field === "ideology") f.ideology = val;
            else if (field === "territory") f.territory = val;
            else if (field === "collapse") { f.collapsed = true; f.influence = 0; f.collapsedRound = nowRound(); pushWorldHistory("「" + fname + "」骤然覆灭。"); logTimeline("势力覆灭·" + fname, "prevented", { kind: "faction", round: nowRound() }); }
            else if (field === "emerge") { f.collapsed = false; if (!f.influence) f.influence = 40; f.origin = f.origin || "ai"; pushWorldHistory("「" + fname + "」崛起于乱世。"); logTimeline("新兴势力·" + fname, "new", { kind: "faction", round: nowRound() }); }
          }
        } else if (key.indexOf("grudge.") === 0) {
          var gn = key.slice(7).trim();
          if (window.WorldBus) WorldBus.grudge(gn, parseInt(val, 10) || 0);
        } else if (key.indexOf("npcemotion.") === 0) {
          var en = key.slice(11).trim();
          writeChar(en, { emotion: val });
        } else if (key.indexOf("npcmemory.") === 0) {
          var mn = key.slice(10).trim();
          var curMem = (vars().characters[mn] && vars().characters[mn].memory) || "";
          writeChar(mn, { memory: (String(val) + (curMem ? "；" + curMem : "")).slice(0, 220) });
        } else if (key.indexOf("npcgoal.") === 0) {
          var gn2 = key.slice(8).trim();
          writeChar(gn2, { goal: val });
        } else if (key.indexOf("npc.") === 0 && key.indexOf(".trust") > 0) {
          var tn = key.slice(4, key.indexOf(".trust")).trim();
          writeChar(tn, { trust: parseInt(val, 10) });
        } else if (key.indexOf("npc.") === 0 && key.indexOf(".goal") > 0) {
          var gn3 = key.slice(4, key.indexOf(".goal")).trim();
          writeChar(gn3, { goal: val });
        } else if (key.indexOf("npc.") === 0 && key.indexOf(".emotion") > 0) {
          var en2 = key.slice(4, key.indexOf(".emotion")).trim();
          writeChar(en2, { emotion: val });
        } else if (key.indexOf("rel.") === 0) {
          var rr = key.slice(4).split("↔");
          if (rr.length === 2) {
            var sp = val.split(":");
            setRelation(rr[0].trim(), rr[1].trim(), (sp[0] || "陌路").trim(), clamp(parseInt(sp[1], 10) || 0, -100, 100));
          }
        } else if (key.indexOf("event.") === 0 && key.indexOf(".status") > 0) {
          var evn = key.slice(6, key.indexOf(".status")).trim();
          trackEvent(evn, val.trim(), nowRound());
        } else if (key.indexOf("event.") === 0 && key.indexOf(".next") > 0) {
          /* AI 声明事件后续（事件连锁）：排入 2 回合后的链路 */
          var evn2 = key.slice(6, key.indexOf(".next")).trim();
          mem.chain = (mem.chain || []).concat([{ round: nowRound() + 2, text: val, faction: "", delta: 0, s: 1 }]).slice(-8);
          saveMem();
        } else if (key.indexOf("item.") === 0) {
          /* P2-3：AI 注册/改写物品（品阶/描述/数量/槽位/持有者），写进 v.entities.items 随存档持久化 */
          var rest2 = key.slice(5);
          var dot2 = rest2.lastIndexOf(".");
          if (dot2 > 0) {
            var iname = rest2.slice(0, dot2).trim();
            var ifield = rest2.slice(dot2 + 1).trim();
            var canonical = ITEM_FIELD_MAP[ifield] || ifield;
            var it = ensureItem(iname);
            if (it) {
              if (canonical === "count") it.count = Math.max(0, parseInt(val, 10) || 0);
              else it[canonical] = val;
              it.updatedAt = Date.now();
              try { if (window.WorldBook && WorldBook.registerItem) WorldBook.registerItem(it); } catch (e) {}
            }
          }
        } else if (key.indexOf("chance.") === 0) {
          /* AI 每回合按世界状态新增机缘候选（P0-2 路③） */
          var chT = key.slice(7).trim();
          if (window.OpportunitySystem && chT) OpportunitySystem.add(chT, val, {});
        } else if (key.indexOf("chance_cost.") === 0) {
          var ccT = key.slice(12).trim();
          if (window.OpportunitySystem && ccT) {
            var act = OpportunitySystem.activeList().filter(function (o) { return o.title === ccT; });
            if (act.length) act[0].cost = val;
          }
        } else if (key === "quest.act") {
          if (window.OpportunitySystem) OpportunitySystem.setAct(parseInt(val, 10) || 1);
        } else if (key.indexOf("quest.branch") === 0) {
          /* 支持 quest.branch[2]=形态 或 quest.branch.2=形态 */
          var m2 = key.match(/quest\.branch[\[\.]?(\d+)\]?/);
          if (m2 && window.OpportunitySystem) OpportunitySystem.setBranch(parseInt(m2[1], 10) || 1, val);
        } else if (key === "tension") {
          v.tension = numOrDelta(val, Number(v.tension) || 0);
        }
      } catch (e) {}
    }
    /* 回写影响力快照用于下一轮 ↑↓ 显示 */
    try {
      var inf = {}; factionsList().forEach(function (f) { inf[f.name] = f.influence; });
      mem.prevInf = inf; saveMem();
    } catch (e) {}
    try { var fw = window.storyFramework; fw && fw.saveStory && fw.saveStory(); } catch (e) {}
  }

  /* ---------- P2-1 势力实体化：覆灭 / 新生 / 事件连锁 ---------- */
  function factionNames() {
    try { var v = vars(); return Object.values((v.entities.factions) || {}).filter(function (f) { return !f.collapsed; }).map(function (f) { return f.name; }); } catch (e) { return []; }
  }
  function kbByCat(re) {
    var out = [];
    try {
      var list = (window.KB_PRESETS && window.KB_PRESETS[genre()]) || [];
      list.forEach(function (it) { if (it && it.title && re.test((it.category || "") + " " + (it.tags || []).join(" "))) out.push(it); });
    } catch (e) {}
    return out;
  }
  function logTimeline(name, status, opt) { try { if (window.CanonTimeline && CanonTimeline.event) CanonTimeline.event(name, status, opt || {}); } catch (e) {} }
  function pushWorldHistory(txt) {
    try { var v = vars(); if (!v) return; var h = v.history = Array.isArray(v.history) ? v.history : []; h.push("【世界】" + txt); if (h.length > 120) h.splice(0, h.length - 120); } catch (e) {}
  }

  /* 选一条「动态事件」（连锁/AI/KB 优先；返回 {t, f, d, s}，f=势力名 d=对玩家恩怨增量） */
  function pickDynamicEvent(cu, round) {
    /* ① 已排期的连锁事件（到期即发，因果最强） */
    for (var i = 0; i < mem.chain.length; i++) {
      if (mem.chain[i] && Number(mem.chain[i].round) <= round) {
        var due = mem.chain.splice(i, 1)[0]; saveMem();
        return { t: due.text, f: due.faction || "", d: Number(due.delta) || 0, s: due.s || cu, chain: true };
      }
    }
    /* ② AI 每回合新增的事件 */
    if (mem.aiEvents && mem.aiEvents.length && Math.random() < 0.6) {
      var a = mem.aiEvents.shift(); saveMem();
      return { t: a.text, f: a.faction || "", d: Number(a.delta) || 0, s: a.s || cu };
    }
    /* ③ 知识库事件条目 */
    var kb = kbByCat(/事件|历史|大事|战事|变局/);
    if (kb.length && Math.random() < 0.35) {
      var e = kb[Math.floor(Math.random() * kb.length)];
      var fns = factionNames();
      var fac = fns.length ? fns[Math.floor(Math.random() * fns.length)] : "";
      return { t: String(e.title).slice(0, 60) + (e.content ? ("：" + String(e.content).replace(/\s+/g, " ").slice(0, 36)) : ""), f: fac, d: -(3 + Math.floor(Math.random() * 4)), s: cu };
    }
    return null;
  }

  /* 事件连锁：由当前事件推导 1 条后续事件，排入 mem.chain（1~2 回合后触发） */
  function scheduleFollowUp(card, round) {
    if (!card || Math.random() > 0.45) return;
    var t = String(card.t || "");
    var nxt = null;
    if (/摩擦|对峙|冲突|战|袭|洗劫|劫|告急|失守|恐吓|报复/.test(t)) nxt = { round: round + 1 + (Math.random() < 0.5 ? 0 : 1), text: "「" + (card.f || "那一方") + "」的报复接踵而至，局势进一步恶化。", faction: card.f || "", delta: -4, s: card.s || 1 };
    else if (/合作|橄榄枝|邀|同盟|请|结盟/.test(t)) nxt = { round: round + 2, text: "合作有了实质进展——「" + (card.f || "盟友") + "」开始真正信任你。", faction: card.f || "", delta: 4, s: card.s || 1 };
    else if (/失联|骤紧|传言|异动|注意/.test(t)) nxt = { round: round + 2, text: "事态继续发酵——人心浮动，各方暗中观望。", faction: card.f || "", delta: -2, s: card.s || 1 };
    if (nxt) { mem.chain = (mem.chain || []).concat([nxt]).slice(-8); saveMem(); }
  }

  /* 势力生命周期：因果化演化 → 覆灭 → 新生（写入大势账本）
     v3.88.0 修正 P0：原实现「每次只侵蚀当前最弱者、最强永不衰减、与玩家零耦合」，
     世界会动但动的方向与剧情无关。现改为多因子共同驱动：
       ① 势力自身兴衰势能  ② 强者受制平衡  ③ 弱者颓势 / 太平回补
       ④ 与玩家的恩怨传导  ⑤ 势力间关系传导  ⑥ 活跃事件与近期大事点名
       ⑦ 阶段放大 + 张力冲突
     使「玩家选择 / 恩怨 / 事件 / 阶段」真正改变世界大势走向。 */
  function lifecycle() {
    var v = vars(); if (!v || !v.entities || !v.entities.factions) return;
    var facs = v.entities.factions;
    var keys = Object.keys(facs);
    var alive = keys.filter(function (k) { return facs[k] && !facs[k].collapsed; });
    if (!alive.length) return;

    var st = stageInfo();
    var amp = 1 + ((clamp(Number(st.stage) || 1, 1, 3) - 1) * 0.45);   /* 阶段越高，变局越剧烈 */
    var tension = clamp(Number(v.tension) || 20, 0, 100);
    var conflict = tension / 100;
    var deltas = {};
    function bump(k, d) { if (k == null || !isFinite(d) || !d) return; deltas[k] = (deltas[k] || 0) + d; }
    var byName = {}; alive.forEach(function (k) { byName[facs[k].name] = k; });

    /* ① 势力自身的兴衰势能：每方有一条长期趋势线（持久化），使世界拥有自己的宏观动态，
       而不是"永远只打当前最弱者"（那既失真又会让强弱格局退化成一潭死水）。 */
    alive.forEach(function (k) {
      var f = facs[k], cur = Number(f.influence) || 0;
      if (f.trend == null) f.trend = ((hashStr(genre() + f.name) % 120) / 100) - 0.6;   /* -0.60 ~ +0.59 */
      f.trend = clamp(Number(f.trend) + (Math.random() - 0.5) * 0.06, -0.9, 0.9);       /* 趋势本身缓慢演变 */
      bump(k, f.trend);
      /* ② 强者受制：独大者被各方制衡（修掉"最强恒不衰减"的失真） */
      if (cur > 68) bump(k, -(cur - 68) * 0.10);
      /* ③ 弱者颓势 / 太平回补：衰败会自我强化；太平年月各方休养生息，但高张力下无人能喘息 */
      if (cur < 40) bump(k, -((40 - cur) * 0.18) - 0.5);
      else if (cur < 62 && tension < 60) bump(k, 0.35);
    });

    /* ④ 与玩家的恩怨传导：玩家的敌友真实影响其消长 */
    var gm = {}; grudgePairs().forEach(function (p) { gm[p.name] = p.v; });
    alive.forEach(function (k) {
      var gv = gm[facs[k].name];
      if (gv == null) return;
      if (gv <= -25) bump(k, -(0.6 + conflict * 1.8) * amp);
      else if (gv <= -8) bump(k, -0.45 * amp);
      else if (gv >= 25) bump(k, (0.5 + conflict * 0.6) * amp);
      else if (gv >= 8) bump(k, 0.3);
    });

    /* ⑤ 势力间关系传导：盟友共振、敌对互耗 */
    var rels = Array.isArray(v.entities.relations) ? v.entities.relations : [];
    rels.forEach(function (r) {
      if (!r) return;
      var ka = byName[r.a], kb2 = byName[r.b];
      if (!ka || !kb2 || ka === kb2) return;
      var w = Number(r.strength) || 0, kind = String(r.kind || "");
      if (/盟|友|亲|合作|依附|联姻/.test(kind)) { bump(ka, w / 150); bump(kb2, w / 150); }
      else if (/敌|仇|对立|宿怨|死仇|竞争/.test(kind)) { var d = -(Math.abs(w) / 180) * amp; bump(ka, d); bump(kb2, d); }
    });

    /* ⑥ 活跃事件牵涉的势力获得张力红利 */
    (mem.events || []).forEach(function (e) {
      if (!e || e.status === "over") return;
      if (byName[e.name]) bump(byName[e.name], 1.1 * amp);
    });
    /* ⑥b 近期世界大事中点名的势力：恶化类受损、其余受益 */
    recentAutoEvents().forEach(function (txt) {
      if (!txt) return;
      alive.forEach(function (k) {
        if (txt.indexOf(facs[k].name) < 0) return;
        bump(k, /覆灭|枯竭|失守|洗劫|告急|恶化|摩擦|冲突/.test(txt) ? -2.2 * amp : 1.4 * amp);
      });
    });

    /* ⑦ 张力驱动冲突：高张力时两方因资源/地盘互耗（有因果，不是纯噪声） */
    if (alive.length >= 2 && Math.random() < conflict * 0.55) {
      var a = alive[Math.floor(Math.random() * alive.length)];
      var b = alive[Math.floor(Math.random() * alive.length)];
      if (a !== b) {
        var loss2 = (1.5 + conflict * 3) * amp;
        bump(a, -loss2); bump(b, -loss2 * 0.6);
        try { if (window.WorldBus) WorldBus.emit({ type: "world.event", text: "「" + facs[a].name + "」与「" + facs[b].name + "」因地盘与资源起了冲突，双方各有损耗。" }); } catch (e) {}
      }
    }

    /* 应用增量（保留一位小数，使跨 tick 的真实累积可见） */
    alive.forEach(function (k) {
      var cur = Number(facs[k].influence) || 0;
      var next = cur + (deltas[k] || 0);
      facs[k].influence = clamp(Math.round(next * 10) / 10, 0, 100);
    });
    /* 覆灭判定：影响力枯竭 */
    keys.forEach(function (k) {
      var f = facs[k]; if (!f || f.collapsed) return;
      if ((Number(f.influence) || 0) <= 12) {
        f.collapsed = true; f.collapsedRound = nowRound();
        var txt = "势力「" + f.name + "」影响力枯竭，分崩离析、树倒猢狲散。";
        pushWorldHistory(txt);
        logTimeline("势力覆灭·" + f.name, "prevented", { kind: "faction", now: txt, round: nowRound() });
        try { if (window.WorldBus) WorldBus.emit({ type: "world.event", text: txt }); } catch (e) {}
        try { if (window.showToast) window.showToast("🏚 " + txt, "warn"); } catch (e) {}
        /* 覆灭会把与玩家的旧怨部分清零（人已散，仇无处寻） */
        try { if (window.WorldBus) { var g = WorldBus.grudges[f.name]; if (g != null) WorldBus.grudge(f.name, -Math.round(g * 0.6)); } } catch (e) {}
      }
    });
    /* 新生：存活势力不足时，从知识库「势力/组织」中取名派生新势力 */
    var aliveNow = keys.filter(function (k) { return facs[k] && !facs[k].collapsed; });
    if (aliveNow.length < 3 && Math.random() < 0.6) {
      var present = {};
      keys.forEach(function (k) { if (facs[k]) present[facs[k].name] = 1; });
      var cand = kbByCat(/势力|组织|门派|宗门|家族|阵营/).map(function (it) { return String(it.title).slice(0, 20); }).filter(function (n) { return n && !present[n]; });
      var name = cand.length ? cand[Math.floor(Math.random() * cand.length)] : ("新兴势力" + (1 + Math.floor(Math.random() * 90)));
      var key = "fac_new_" + Date.now().toString(36);
      facs[key] = { id: key, name: name, members: 5 + Math.floor(Math.random() * 8), territory: 1 + Math.floor(Math.random() * 2), influence: 22 + Math.floor(Math.random() * 12), ideology: "新兴", origin: "emerge" };
      var txt2 = "乱世之中，新势力「" + name + "」悄然崛起，开始在各处扩张。";
      pushWorldHistory(txt2);
      logTimeline("新兴势力·" + name, "new", { kind: "faction", now: txt2, round: nowRound() });
      try { if (window.WorldBus) WorldBus.emit({ type: "world.event", text: txt2 }); } catch (e) {}
      try { if (window.showToast) window.showToast("🌱 " + txt2, "success"); } catch (e) {}
    }
    saveMem();
    try { var fw = window.storyFramework; fw && fw.saveStory && fw.saveStory(); } catch (e) {}
  }

  /* 每轮提示词装配后由 ai-message-builder 调用：刷新影响力快照（体现本轮自治变化） */
  function snapshotInfluence() {
    try { var inf = {}; factionsList().forEach(function (f) { inf[f.name] = f.influence; }); mem.prevInf = inf; saveMem(); } catch (e) {}
  }

  window.WorldAlive = {
    buildPromptBlock: buildPromptBlock,
    applyAI: applyAI,
    seedFactions: seedFactions,
    snapshotInfluence: snapshotInfluence,
    lifecycle: lifecycle,
    pickDynamicEvent: pickDynamicEvent,
    scheduleFollowUp: scheduleFollowUp,
    _mem: mem,
    _factionSeeds: kbFactionNames
  };
})();
