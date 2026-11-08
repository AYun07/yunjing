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
  /* v3.93.0 势力据点：从本界真实舆图节点中稳定分配，保证「新势力落在对应位置」。
     原实现 territory 是 1~4 的数字，落图时 matchNode 无法命中，节点只能随机散落。 */
  function anchorFor(name) {
    /* ① 静态基准表：同步脚本，开局必就绪；不受地图懒加载桩影响（此前踩坑：
          StoryAtlas.factionAnchors 是 demand 桩，同步调用恒返回 undefined，据点退化为数字） */
    try {
      var st = window.FactionAtlasData && window.FactionAtlasData.anchors(genre());
      if (st && st.length) return { n: st[hashStr(genre() + name) % st.length] };
    } catch (e) {}
    /* ② 地图脚本已真正加载时改用带坐标的真实舆图锚点 */
    try {
      var A = window.StoryAtlas;
      if (A && !A.__yjLazyShadow && A.factionAnchors) {
        var pool = A.factionAnchors(genre());
        if (pool && pool.length) return pool[hashStr(genre() + name) % pool.length];
      }
    } catch (e) {}
    return null;
  }
  function territoryOf(name) { var a = anchorFor(name); return a ? a.n : ""; }
  /* 势力变化后立即刷新舆图（不等下一轮变量上报，做到「实时体现」） */
  function refreshAtlas() {
    try {
      var v = vars();
      if (window.StoryAtlas && StoryAtlas.syncFactions && v) StoryAtlas.syncFactions(v);
    } catch (e) {}
  }

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
    s = s.replace(/^[^：:]{1,6}[：:]\s*/, "");             /* v3.93.0 去「势力：」「组织：」类栏目前缀 */
    s = s.replace(/(政局|格局|体系|事务|趋势|态势|现状|结构|关系|变化)$/, ""); /* v3.93.0 去抽象尾缀，避免把「安苏王国政局」当势力 */
    if (s.length > 8 && s.indexOf("·") > 0) s = s.slice(0, s.indexOf("·"));    /* 长名截到主机构名 */
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
        /* 纯地理通名收尾且无机构后缀的一律不是势力（「北寒大陆」「血天境」「乱星海」） */
        var GEO_TAIL = /(大陆|境|域|海|草原|山脉|盆地|沙漠|高原|平原|群岛|半岛|大洲|星域|位面|界域)$/;
        var ORG0 = /宗|门|派|教|殿|盟|会|阁|府|军|国|朝|族|帮|寺|观|司|局|廷|宫|组织|集团|学院|家族|公司|议会|部落|兵团|战队|联盟|联邦|帝国|王朝|世家|圣地|神庭|教廷|门阀|商队|镖局|公会|势力|阵营/;
        if (GEO_TAIL.test(n) && !ORG0.test(n)) return;
        /* 注意：JS 的 \w 只含 [A-Za-z0-9_]，汉字属于 \W，故必须显式判定"含汉字或字母" */
        if (!/[A-Za-z\u4e00-\u9fa5]/.test(n)) return;
        /* v3.93.0 准确性：本界舆图里的地标（黄枫谷 / 血色禁地 / 越国七派地界…）不是势力。
           抽到的专名若与地标同名、或嵌了地标名却又没有任何机构后缀，一律不当势力播种，
           否则开局会出现「黄枫谷」「北寒大陆」这类地名被当成一方势力的错误。 */
        try {
          var ORG = /宗|门|派|教|殿|盟|会|阁|府|军|国|朝|族|帮|寺|观|司|局|廷|宫|组织|集团|学院|家族|公司|议会|部落|兵团|战队|联盟|联邦|帝国|王朝|世家|圣地|神庭|教廷|门阀|商队|镖局|公会|势力|阵营/;
          var places = (window.FactionAtlasData && window.FactionAtlasData.names(genre())) || [];
          var isPlace = places.some(function (p) { return p === n; }) ||
            (!ORG.test(n) && places.some(function (p) { return p.length >= 2 && n.indexOf(p) >= 0; }));
          if (isPlace) return;
        } catch (e) {}
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
      var home = anchorFor(n);
      v.entities.factions[key] = {
        id: key, name: n,
        members: 8 + (h % 18),
        territory: home ? home.n : (1 + (h % 4)),
        homeNode: home ? home.n : "",
        influence: clamp(38 + (h % 25) - 8, 26, 72),
        ideology: GEAR[i % GEAR.length],
        status: "active",
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
    /* v3.94.0 差分注入：首轮（或隔了 3 轮以上）发全量状态，其余轮只发「变化项 + 折叠摘要」。
       真实评测里单界 system 约 1.9 万 token，主笔状态块占比虽小，但每轮重复全量是纯浪费；
       势力名仍完整保留一行，保证 (world_update) 协议里的「势力名与上文一致」有据可依。 */
    var rd = nowRound();
    var full = rd <= 1 || !mem.lastBlockRound || (rd - mem.lastBlockRound > 3);
    parts.push("【世界当前状态 · 必须遵守】");
    var day = (v.时间 && Number(v.时间.clockDay)) || 0;
    parts.push("- 世界自转：第 " + day + " 日（脱离玩家操作也在推进；数值变化真实累积）");
    var si = stageInfo();
    if (si.name) parts.push("- 时代阶段：" + si.name + "（第 " + si.stage + "/3 阶段）");
    /* v3.94.0 注意：factionsList() 返回的是只含 name/influence/members 的拷贝，
       判断覆灭/衰退状态必须读原始实体对象，否则「已覆灭」一行永远为空。 */
    var rawFacs = Object.values((v.entities || {}).factions || {}).filter(function (f) { return f && f.name; });
    var facs = rawFacs;
    var names = facs.map(function (f) { return f.name; });
    var changed = [], dead = [], curInf = {};
    facs.forEach(function (f) {
      curInf[f.name] = f.influence;
      var prev = mem.prevInf[f.name];
      var d = (prev != null) ? (f.influence - prev) : null;
      if (f.collapsed || f.status === "destroyed") dead.push(f.name);
      else if (d !== null && d !== 0) changed.push(f.name + " 影响力 " + prev + "→" + f.influence + (d > 0 ? "↑" : "↓"));
    });
    if (full) {
      var infLine = facs.map(function (f) {
        var prev = mem.prevInf[f.name];
        var d = (prev != null) ? (f.influence - prev) : 0;
        var arrow = d > 0 ? "↑(+" + d + ")" : d < 0 ? "↓(" + d + ")" : "";
        return f.name + " 影响力 " + f.influence + arrow;
      }).join(" ｜ ");
      if (infLine) parts.push("- 势力消长：" + infLine);
    } else {
      if (names.length) parts.push("- 已登记势力（" + names.length + "）：" + names.join("、"));
      if (changed.length) parts.push("- 本轮势力变化：" + changed.join(" ｜ "));
      else parts.push("- 其余势力影响力本轮未变，按上一轮状态延续。");
      if (dead.length) parts.push("- 已覆灭：" + dead.join("、"));
    }
    mem.prevInf = curInf; mem.lastBlockRound = rd;
    /* 活跃事件 */
    var act = mem.events.filter(function (e) { return e.status !== "over"; });
    if (act.length) parts.push("- 当前活跃事件：" + act.slice(-3).map(function (e) { return e.name + "（第 " + e.round + " 回合起）"; }).join(" ｜ "));
    /* 与玩家恩怨：只列本轮有变化的，其余折叠为一行 */
    var gs = grudgePairs();
    var prevG = mem.prevGrudge || {}, curG = {}, gChanged = [];
    gs.forEach(function (g) { curG[g.name] = g.v; if (prevG[g.name] != null && prevG[g.name] !== g.v) gChanged.push(g.name + " " + g.v + "（原 " + prevG[g.name] + "）"); });
    if (full || gChanged.length === gs.length) {
      if (gs.length) parts.push("- 与玩家有关的恩怨：" + gs.slice(-3).map(function (g) { return g.name + " " + g.v; }).join(" ｜ "));
    } else if (gChanged.length) parts.push("- 恩怨变化：" + gChanged.join(" ｜ ") + "；其余维持上一轮。");
    mem.prevGrudge = curG;
    var auto = recentAutoEvents();
    if (auto.length) parts.push("- 近期世界自行发生：" + auto.join("；"));
    /* NPC 行为约束：只列目标/情绪/信任本轮有变化的人 */
    var npcs = npcBehaviors();
    var prevN = mem.prevNpc || {}, curN = {}, nChanged = [];
    npcs.forEach(function (n) {
      var sig = [n.goals, n.emotion, n.trust].join("|");
      curN[n.name] = sig;
      if (prevN[n.name] !== sig) nChanged.push(n);
    });
    if (full || (npcs.length && nChanged.length === npcs.length)) {
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
    } else if (nChanged.length) {
      parts.push("【人物行为约束·本轮变化】" + nChanged.map(function (n) {
        return n.name + "（目标：" + (n.goals || "—") + "／情绪：" + (n.emotion || "—") + "／信任：" + (n.trust != null ? n.trust : 50) + "）";
      }).join(" ｜ ") + "；其余人物仍按上一轮目标与情绪行动，不得 OOC。");
    } else if (npcs.length) {
      parts.push("【人物行为约束】人物目标与情绪本轮无变化，仍按上一轮约束行动，不得 OOC。");
    }
    mem.prevNpc = curN;
    var sig2 = recentSignals();
    if (sig2.length) parts.push("- 世界近期信号：" + sig2.slice(-3).join("；"));
    try { if (window.OpportunitySystem && OpportunitySystem.buildPromptBlock) { var oq = OpportunitySystem.buildPromptBlock(); if (oq) parts.push(oq); } } catch (e) {}
    parts.push("【本轮硬约束】上述势力与恩怨的走向必须被正文体现；已断诱因的大事不得发生；玩家无动作时世界仍按上述状态自行演化。");
    /* 下行协议：首轮完整、后续一行提醒（省 token，模型仍被提醒要上报） */
    if (rd <= 1) {
      parts.push("【势力变更上报协议】本轮剧情若出现新势力建立、势力覆灭、势力迁徙或影响力剧变，必须在回复末尾另附 (world_update) 块（无变化则完全不写），块内逐行纯文本：\n" +
        "faction.势力名.emerge=据点地名       ← 新势力建立（据点用本界真实地名）\n" +
        "faction.势力名.collapse=覆灭缘由     ← 势力覆灭\n" +
        "faction.势力名.influence=+8         ← 影响力增减\n" +
        "faction.势力名.territory=新据点地名  ← 势力迁徙\n" +
        "铁律：势力名与上文「已登记势力」完全一致；禁止 JSON；此块不计入正文字数；之后每轮仍按此协议上报。");
    } else {
      /* v3.95.0：真实模型连续多轮不写 (world_update)，根因是「按开局协议上报」这句太抽象。
         改成每轮都给一个可照抄的单行示例，把遵从成本压到「抄一行」，且不再要求包块。 */
      parts.push("【势力变更·极简上报】本轮若发生新势力建立、覆灭、迁徙或影响力剧变，只需在回复最末尾另起一行抄一条（无变化则完全不写、不要解释）：\n" +
        "faction.势力名.collapse=缘由\n" +
        "可换关键词：emerge=据点地名（新建） / influence=+8（增减） / territory=据点地名（迁徙）。势力名须与上文「已登记势力」完全一致；写一行即可，不必包 (world_update) 块。");
    }
    saveMem();
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
      f = v.entities.factions[key] = { id: key, name: name, members: 10, territory: territoryOf(name) || 2, influence: 50, ideology: "未知", status: "active", origin: "player" };
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
            else if (field === "collapse" || field === "destroyed") { f.collapsed = true; f.status = "destroyed"; f.collapseNote = String(val || "势力覆灭"); f.influence = 0; f.collapsedRound = nowRound(); pushWorldHistory("「" + fname + "」骤然覆灭。"); logTimeline("势力覆灭·" + fname, "prevented", { kind: "faction", round: nowRound() }); }
            else if (field === "emerge") {
              f.collapsed = false; f.status = "active";
              if (!f.influence || Number(f.influence) <= 12) f.influence = 40;
              var tv = String(val || "").trim();
              /* 协议约定 emerge=据点地名；模型也可能只写 1，此时退回本界真实锚点 */
              if (tv && !/^[\d\.\+\-\s]+$/.test(tv)) f.territory = tv;
              if (!f.territory || /^\d+$/.test(String(f.territory))) f.territory = territoryOf(fname);
              f.origin = f.origin || "ai";
              pushWorldHistory("「" + fname + "」崛起于乱世。"); logTimeline("新兴势力·" + fname, "new", { kind: "faction", round: nowRound() });
            }
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
    /* v3.93.0 主笔上报的势力新生/覆灭/迁徙，当场反映到舆图 */
    refreshAtlas();
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
    var conflictFiredFlag = false;   /* v4.10.0 F8：本轮是否爆发资源冲突（张力出清信号） */
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
        conflictFiredFlag = true;   /* v4.10.0 F8：冲突实际发生 = 矛盾释放，计入张力回落 */
        try { if (window.WorldBus) WorldBus.emit({ type: "world.event", text: "「" + facs[a].name + "」与「" + facs[b].name + "」因地盘与资源起了冲突，双方各有损耗。" }); } catch (e) {}
      }
    }

    /* 应用增量（保留一位小数，使跨 tick 的真实累积可见） */
    var swing = 0;   /* 本轮势力消长剧烈度：本函数新增，供张力演化用 */
    alive.forEach(function (k) {
      var cur = Number(facs[k].influence) || 0;
      var next = cur + (deltas[k] || 0);
      swing += Math.abs(deltas[k] || 0);
      facs[k].influence = clamp(Math.round(next * 10) / 10, 0, 100);
    });

    /* ------------------------------------------------------------------
     * v4.10.0 修 F8（第三方审查 P2「张力没有任何上行机制」）★★
     * 现状（已硬证明）：lifecycle() 体内 tension 六处全是读、零写入；
     * 唯一上行源 sim-core.js:212 要求敌对边 strength≥40（每 tick 衰减 1-2，
     * 升温窗口仅约 2 tick），world-clock.js:95 又每 tick 单向 −0.5。
     * 净效果：张力长期只降不升，「矛盾自然积累到爆发」无法自治涌现。
     *
     * 这里给 lifecycle() 补张力的双向自治演化，全部基于本轮真实发生的因果量，
     * 不是随机数噪声，也不改动上面 ①~⑦ 任何势力 deltas（保护死敌覆灭内核）：
     *   · 升温项 = 势力消长剧烈度 swing + 敌对边强度 + 活跃冲突事件；
     *     低张力时矛盾容易积累（系数 ∝ (100-tension)），高张力时趋缓。
     *   · 降温项 = 高张力下爆发的实际冲突（⑦ 命中） + 势力覆灭（矛盾出清）；
     *     高张力时回落更快（系数 ∝ tension）。
     *   · 弱回归项：极端值（<8 或 >92）向中值轻微回拉，避免锁死在 0/100。
     * 用 v.tensionTrend 做一位小数的平滑累积（跨 tick 可见，避免单轮跳变）。
     * ------------------------------------------------------------------ */
    (function evolveTension() {
      var t = clamp(Number(v.tension) || 20, 0, 100);
      /* 敌对边强度总量（有向边的 strength，取绝对值，只算敌对类） */
      var hostile = 0;
      rels.forEach(function (r) {
        if (!r) return;
        if (/敌|仇|对立|宿怨|死仇|竞争/.test(String(r.kind || ""))) hostile += Math.abs(Number(r.strength) || 0);
      });
      /* 升温：消长越剧烈、敌对越强、事件越多，张力上行越明显；低张力灵敏度更高 */
      var pressure = swing * 0.9 + Math.min(hostile, 120) * 0.05 + Math.min((mem.events || []).length, 6) * 0.6;
      var riseCoef = (100 - t) / 100;                    // 低张力时升温快
      var rise = pressure * 0.10 * (0.35 + riseCoef) * amp;
      /* 降温：高张力时，若本轮确有冲突爆发 / 势力覆灭，矛盾得到释放 */
      var collapseNow = 0;
      keys.forEach(function (k) { if (facs[k] && !facs[k].collapsed && (Number(facs[k].influence) || 0) <= 12) collapseNow++; });
      var fallCoef = t / 100;                            // 高张力时回落快
      var fall = (tension >= 55 ? (0.4 + fallCoef * 1.6) : 0)   // 高张力本身缓慢出清
               + (conflictFiredFlag ? (1.0 + fallCoef * 2.0) : 0)  // 实际冲突 = 矛盾释放
               + collapseNow * 0.8;                     // 势力覆灭 = 一支矛盾消失
      /* 弱回归：极端值向 50 回拉，防锁死 */
      var regression = 0;
      if (t < 8) regression = (8 - t) * 0.25;
      else if (t > 92) regression = -(t - 92) * 0.25;
      var delta = rise - fall + regression;
      /* 平滑：把 delta 累积进 v.tensionTrend（一位小数），满 1 才进整数位，
         使跨 tick 的变化真实可见，又不会被单轮随机性带飞 */
      var trend = Number(v.tensionTrend) || 0;
      trend = clamp(trend + delta, -3, 3);
      var step = Math.trunc(trend);
      if (step !== 0) {
        v.tension = clamp(t + step, 0, 100);
        trend -= step;
      }
      v.tensionTrend = Math.round(trend * 10) / 10;
    })();

    /* 覆灭判定：影响力枯竭 */
    keys.forEach(function (k) {
      var f = facs[k]; if (!f || f.collapsed) return;
      if ((Number(f.influence) || 0) <= 12) {
        f.collapsed = true; f.status = "destroyed"; f.collapseNote = "影响力枯竭，分崩离析"; f.collapsedRound = nowRound();
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
      facs[key] = { id: key, name: name, members: 5 + Math.floor(Math.random() * 8), territory: territoryOf(name) || 1, homeNode: territoryOf(name), influence: 22 + Math.floor(Math.random() * 12), ideology: "新兴", status: "active", origin: "emerge" };
      var txt2 = "乱世之中，新势力「" + name + "」悄然崛起，开始在各处扩张。";
      pushWorldHistory(txt2);
      logTimeline("新兴势力·" + name, "new", { kind: "faction", now: txt2, round: nowRound() });
      try { if (window.WorldBus) WorldBus.emit({ type: "world.event", text: txt2 }); } catch (e) {}
      try { if (window.showToast) window.showToast("🌱 " + txt2, "success"); } catch (e) {}
    }
    saveMem();
    try { var fw = window.storyFramework; fw && fw.saveStory && fw.saveStory(); } catch (e) {}
    /* v3.93.0 自转导致的势力覆灭/新生，同样当场反映到舆图 */
    refreshAtlas();
  }

  /* ---------- v3.93.0 剧情文本兜底：模型不写 (world_update) 也能识别势力生死 ----------
     真实模型（含本次实测）常忽略结构化上报协议，但正文里会实实在在写
     「青刀会一夜倾覆」「另立云岚盟」。此处只做高置信度识别：
       ① 覆灭：仅限已登记的势力名 + 同句强覆灭动词，排除「险些／据说／三百年前」等背景语境；
       ② 新生：仅限明确的「另立／创立／组建」动作后紧跟的机构专名，且名字未登记过；
     命中即回写实体库、写世界大事、并立即刷新舆图。宁可漏，不可错标。 */
  function detectFactionEvents(reply) {
    var v = vars(); if (!v || !reply) return 0;
    var body = String(reply)
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
      .replace(/(?:\(variable_update\)|【variable_update】|<variable_update>)[\s\S]*?(?:(?:\(\/variable_update\)|【\/variable_update】|<\/variable_update>)|$)/gi, "");
    var facs = (v.entities = v.entities || {}).factions = v.entities.factions || {};
    var byName = {};
    Object.values(facs).forEach(function (f) { if (f && f.name) byName[f.name] = f; });
    var found = 0;
    /* v3.94.0 通道①：模型把协议行散写在正文里（没有 (world_update) 包裹）也认。
       真实评测中模型三轮都不写结构化块，但会写「faction.野狼帮.collapse=…」这类行。 */
    var loose = /(?:^|\n)\s*faction\.([^.\s=]{2,14})\.(collapse|destroyed|emerge|influence|territory)\s*=\s*([^\n]{0,60})/g;
    var lm, looseLines = [];
    while ((lm = loose.exec(body))) {
      looseLines.push("faction." + lm[1] + "." + lm[2] + "=" + String(lm[3] || "").trim());
    }
    if (looseLines.length) {
      try { applyAI("(world_update)\n" + looseLines.join("\n") + "\n(/world_update)"); found += looseLines.length; } catch (e) {}
    }
    var DEAD = "(?:覆灭|被灭|灭门|分崩离析|土崩瓦解|就此除名|不复存在|灰飞烟灭|彻底垮台|一夜倾覆|夷为平地|满门被屠|从此除名)";
    var HEDGE = /(?:险些|差点|几乎|倘若|假如|传说|据说|当年|曾经|百年前|千年前|万年前|多年前|未必|谣传)/;
    var WEAK = /(?:垮台|人心惶惶|转投|名存实亡|式微|摇摇欲坠|日渐衰微|分崩|内乱|溃散|大不如前|日薄西山|一蹶不振)/;
    Object.keys(byName).forEach(function (n) {
      var f = byName[n];
      if (f.collapsed || f.status === "destroyed") return;
      var esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      var m = body.match(new RegExp(esc + "([^。！？\\n]{0,24})" + DEAD));
      if (m && !HEDGE.test(String(m[1] || ""))) {
        f.collapsed = true; f.status = "destroyed"; f.collapseNote = "剧情中覆灭";
        f.influence = 0; f.collapsedRound = nowRound();
        pushWorldHistory("「" + n + "」在剧情中覆灭。");
        found++; return;
      }
      /* v3.94.0 通道②：弱信号只标衰退 + 调影响力，绝不误杀。
         实测模型常写「野狼帮劫掠」「马帮人心惶惶」「老药童转投剑术堂」这类线索；
         旧版只认强覆灭动词 → 99 轮里势力状态全 active、地图毫无演化。 */
      var w = body.match(new RegExp(esc + "([^。！？\\n]{0,24})" + WEAK.source));
      if (w && !HEDGE.test(String(w[1] || ""))) {
        if (f.status !== "waning") {
          f.status = "waning";
          f.influence = Math.max(15, (Number(f.influence) || 50) - 8);
          pushWorldHistory("「" + n + "」显露颓势。");
          found++;
        }
      }
    });
    var NEW = /(?:另立|创立|建立|组建|自立|成立|树起|拉起|创下)[^。！？\n]{0,16}?[「“"'《]?([\u4e00-\u9fa5]{2,10}(?:盟|宗|门|派|教|会|阁|府|帮|团|族|司))[」”"'》]?/g;
    var mm;
    while ((mm = NEW.exec(body))) {
      var nm = String(mm[1] || "");
      if (nm.length < 3 || /^[一新个那这]/.test(nm) || byName[nm]) continue;
      var nf = ensureFaction(nm);
      if (!nf) continue;
      nf.collapsed = false; nf.status = "active";
      nf.influence = Math.max(Number(nf.influence) || 0, 30);
      nf.territory = territoryOf(nm); nf.origin = nf.origin || "ai";
      byName[nm] = nf;
      pushWorldHistory("新兴势力「" + nm + "」在剧情中登场。");
      found++;
    }
    if (found) {
      refreshAtlas();
      try { window.storyFramework && window.storyFramework.saveStory && window.storyFramework.saveStory(); } catch (e) {}
    }
    return found;
  }

  /* v3.94.0 通道③（最可靠）：玩家自己宣告「另立云岚盟 / 灭掉野狼帮」时，
     不等模型配合，直接驱动势力表并即时上图。真实评测里模型会借 NPC 之口否决玩家，
     但机械层的世界状态不该跟着一起被否决——玩家说的话就是既成事实。 */
  function applyPlayerDirective(text) {
    var s = String(text || "").trim();
    if (!s || s.length > 400) return 0;
    var v = vars(); if (!v) return 0;
    if (mem.lastDirective === s) return 0;   /* 同轮重复装配幂等 */
    mem.lastDirective = s; saveMem();
    var n = 0;
    var reNew = /(?:另立|创立|建立|组建|自立|成立|拉起|树起)[「“"'《]?([\u4e00-\u9fa5]{2,10}(?:盟|宗|门|派|教|会|阁|府|帮|团|族|司|堂|宫|殿|城))[」”"'》]?/g;
    var m;
    while ((m = reNew.exec(s))) {
      var nm = m[1];
      if (nm.length < 3 || /^[一新个那这]/.test(nm)) continue;
      var f = ensureFaction(nm);
      if (!f || f.origin === "player-directive") continue;
      f.collapsed = false; f.status = "active";
      f.influence = Math.max(Number(f.influence) || 0, 35);
      f.territory = f.territory || territoryOf(nm);
      f.origin = "player-directive";
      pushWorldHistory("玩家另立「" + nm + "」。");
      n++;
    }
    var facs = Object.values((v.entities || {}).factions || {}).filter(function (f) { return f && f.name; });
    var reKill = /(?:灭掉|剿灭|铲除|覆灭|解散|踏平|端掉|除掉)\s*[「“"'《]?([\u4e00-\u9fa5]{2,12})[」”"'》]?/g;
    while ((m = reKill.exec(s))) {
      var target = m[1];
      var hit = facs.find(function (f) { return f.name === target || (target.length >= 2 && (f.name.indexOf(target) >= 0 || target.indexOf(f.name) >= 0)); });
      if (!hit || hit.collapsed || hit.status === "destroyed") continue;
      hit.collapsed = true; hit.status = "destroyed"; hit.influence = 0;
      hit.collapseNote = "玩家指令覆灭"; hit.collapsedRound = nowRound();
      pushWorldHistory("「" + hit.name + "」被玩家剿灭。");
      n++;
    }
    if (n) {
      refreshAtlas();
      try { window.storyFramework && window.storyFramework.saveStory && window.storyFramework.saveStory(); } catch (e) {}
    }
    return n;
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
    detectFactionEvents: detectFactionEvents,
    applyPlayerDirective: applyPlayerDirective,
    pickDynamicEvent: pickDynamicEvent,
    scheduleFollowUp: scheduleFollowUp,
    /* v4.08.0：切档冲盘入口（此前 WorldAlive 无任何落盘接口，切档时活跃事件/影响力快照会丢） */
    persist: saveMem,
    _mem: mem,
    _factionSeeds: kbFactionNames
  };
})();
