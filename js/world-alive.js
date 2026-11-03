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

  /* 持久化：活跃事件 + 上轮影响力快照（用于 ↑↓ 显示） */
  var mem = { events: [], prevInf: {} };
  function loadMem() {
    try { var raw = localStorage.getItem(STORE()); if (raw) { var d = JSON.parse(raw); if (d && typeof d === "object") { mem.events = Array.isArray(d.events) ? d.events : []; mem.prevInf = d.prevInf && typeof d.prevInf === "object" ? d.prevInf : {}; } } } catch (e) {}
  }
  function saveMem() { try { localStorage.setItem(STORE(), JSON.stringify({ events: mem.events, prevInf: mem.prevInf })); } catch (e) {} }
  loadMem();

  /* ---------- 真实势力实体初始化（首轮从世界阶段静态表播种） ---------- */
  function seedFactions() {
    var v = vars(); if (!v) return;
    v.entities = v.entities || {};
    v.entities.factions = v.entities.factions || {};
    v.entities.relations = v.entities.relations || [];
    if (v.tension == null) v.tension = 20;
    var names = [];
    try { var D = window.WorldStage && window.WorldStage.data; var c = D && D[genre()]; if (c && c.fa) names = c.fa.slice(); } catch (e) {}
    if (!names.length) names = ["主角阵营", "对立阵营", "中立势力"];
    var seeded = false;
    names.forEach(function (n, i) {
      var key = "fac_" + i + "_" + n;
      if (v.entities.factions[key]) return;
      var h = 0; for (var k = 0; k < n.length; k++) h = (h * 31 + n.charCodeAt(k)) >>> 0;
      v.entities.factions[key] = {
        id: key, name: n,
        members: 8 + (h % 10),
        territory: 2 + (h % 3),
        influence: clamp(48 + (h % 15) - 7, 30, 70),
        ideology: (i === 0 ? "守序" : i === 1 ? "扩张" : "中立"),
        origin: "world"
      };
      seeded = true;
    });
    if (seeded) saveMem();
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
    var st = m ? (Number(m.state.stage) || 1) : 1;
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
    try { return (window.WorldBus && window.WorldBus.recent && window.WorldBus.recent()) || []; } catch (e) { return []; }
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
    try {
      var list = window.WorldRuntime && window.WorldRuntime.NPC ? WorldRuntime.NPC.list() : [];
      list.forEach(function (n) {
        if (n.faction === "离队") return;
        if (n.goals || n.emotion) out.push(n);
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
  function setRelation(a, b, kind, strength) {
    var v = vars(); if (!v) return;
    v.entities = v.entities || {}; v.entities.relations = v.entities.relations || [];
    var r = v.entities.relations.find(function (x) { return (x.a === a && x.b === b) || (x.a === b && x.b === a); });
    if (!r) { r = { a: a, b: b, kind: kind || "陌路", strength: strength }; v.entities.relations.push(r); }
    else { if (kind) r.kind = kind; r.strength = strength; }
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
          if (m) { m.state.stage = clamp(parseInt(val, 10) || 1, 1, 3); }
        } else if (key.indexOf("faction.") === 0) {
          var rest = key.slice(8);
          var dot = rest.lastIndexOf(".");
          var fname = rest.slice(0, dot);
          var field = rest.slice(dot + 1);
          var f = ensureFaction(fname);
          if (f) {
            if (field === "influence") f.influence = numOrDelta(val, Number(f.influence) || 0);
            else if (field === "members") f.members = Math.max(0, numOrDelta(val, Number(f.members) || 0));
          }
        } else if (key.indexOf("grudge.") === 0) {
          var gn = key.slice(7).trim();
          if (window.WorldBus) WorldBus.grudge(gn, parseInt(val, 10) || 0);
        } else if (key.indexOf("npcemotion.") === 0) {
          var en = key.slice(11).trim();
          if (window.WorldRuntime && WorldRuntime.NPC) WorldRuntime.NPC.upsert({ name: en, emotion: val });
        } else if (key.indexOf("npcgoal.") === 0) {
          var gn2 = key.slice(8).trim();
          if (window.WorldRuntime && WorldRuntime.NPC) WorldRuntime.NPC.upsert({ name: gn2, goals: val });
        } else if (key.indexOf("npc.") === 0 && key.indexOf(".trust") > 0) {
          var tn = key.slice(4, key.indexOf(".trust")).trim();
          if (window.WorldRuntime && WorldRuntime.NPC) WorldRuntime.NPC.upsert({ name: tn, trust: parseInt(val, 10) });
        } else if (key.indexOf("rel.") === 0) {
          var rr = key.slice(4).split("↔");
          if (rr.length === 2) {
            var sp = val.split(":");
            setRelation(rr[0].trim(), rr[1].trim(), (sp[0] || "陌路").trim(), clamp(parseInt(sp[1], 10) || 0, -100, 100));
          }
        } else if (key.indexOf("event.") === 0 && key.indexOf(".status") > 0) {
          var evn = key.slice(6, key.indexOf(".status")).trim();
          trackEvent(evn, val.trim(), nowRound());
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

  /* 每轮提示词装配后由 ai-message-builder 调用：刷新影响力快照（体现本轮自治变化） */
  function snapshotInfluence() {
    try { var inf = {}; factionsList().forEach(function (f) { inf[f.name] = f.influence; }); mem.prevInf = inf; saveMem(); } catch (e) {}
  }

  window.WorldAlive = {
    buildPromptBlock: buildPromptBlock,
    applyAI: applyAI,
    seedFactions: seedFactions,
    snapshotInfluence: snapshotInfluence,
    _mem: mem
  };
})();
