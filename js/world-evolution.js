/* =========================================================================
 * 云境 · 世界演化引擎 WorldEvolution（v3.78.0）
 * -------------------------------------------------------------------------
 * 解决的问题：原「世界阶段」只按章节数推进（TH=[7,15]），势力/事件/区域
 * 全是写死的静态表——世界不会因为玩家做了什么而改变。本引擎把世界变成
 * 一份**可演化的结构化状态**，四个维度都会随剧情真实变动：
 *
 *   势力演化  factions —— 势(power)/对你的态度(relation)/兴衰(status)/趋势(trend)
 *   区域演化  regions  —— 归属(control)/繁荣(prosperity)/动荡(unrest)
 *   事件演化  events   —— 带因果与等级的事件链（含未了结标记）
 *   人物演化  arcs     —— 配角目标/处境/走向的角色弧
 *
 * 双驱动：
 *   ① 规则驱动 tick()     —— 每回合确定性推演：势力此消彼长、区域动荡累积、
 *                             演化度增长、阶段跃迁。没有 AI 也在动。
 *   ② 叙事驱动 applyAI()  —— 主笔按契约回报【世界演化】JSON，真实反映剧情后果。
 *
 * 阶段由**演化度**决定（不再只看章节）：
 *     evo >= 67 → 第3阶段 ；evo >= 34 → 第2阶段 ；否则第1阶段
 * 并会把 wr_stage 模块抬到不低于演化阶段，与旧系统并存不冲突。
 *
 * 状态按存档槽隔离（yunjingWorldEvo~<slotId>），与灵宠/小队一致。
 * ========================================================================= */
(function () {
  "use strict";

  var VERSION = "1.0.0";
  var STAGE_TH = [34, 67];                  /* 演化度 → 阶段阈值 */
  var MAX_EVENTS = 14, MAX_ARCS = 24, MAX_LOG = 30;
  var STAGE_FALLBACK = ["初起之世", "变局之世", "鼎革之世"];
  var FACTION_FALLBACK = ["主导势力", "对立势力", "游离势力"];
  var REGION_FALLBACK = [];

  /* ---------- 基础设施 ---------- */

  function slotId() {
    try { return (window.storyFramework && window.storyFramework.slotId) || "main"; }
    catch (e) { return "main"; }
  }
  function storeKey() { return "yunjingWorldEvo~" + slotId(); }

  function genreKey() {
    try {
      var fw = window.storyFramework;
      if (!fw || !fw.config) return "free";
      return fw.config.genre || fw.config.genreKey || fw.config.id || "free";
    } catch (e) { return "free"; }
  }
  function genreName() {
    try { return (window.storyFramework && window.storyFramework.config && window.storyFramework.config.genreName) || ""; }
    catch (e) { return ""; }
  }
  function nowRound() {
    try {
      var fw = window.storyFramework, v = fw && fw.storyState ? fw.storyState.variables : null;
      return (v && Number(v.chapter)) || (fw && fw.storyState && Number(fw.storyState.turnCount)) || 0;
    } catch (e) { return 0; }
  }
  function clamp(n, lo, hi) { n = Number(n); if (!isFinite(n)) n = lo; return Math.max(lo, Math.min(hi, n)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function trim(s, n) { s = String(s == null ? "" : s).trim(); return s.length > n ? s.slice(0, n) : s; }
  function uid() { return "we_" + Date.now().toString(36) + "_" + (uid._i = (uid._i || 0) + 1).toString(36); }

  function toast(m, t) { try { if (window.showToast && m) window.showToast(String(m), t || "info"); } catch (e) {} }
  function say(m, ms) { try { if (window.MoChibi && MoChibi.say) MoChibi.say(m, ms || 3400); } catch (e) {} }
  function fact(text) {
    try {
      if (window.WR && window.WR.fact) {
        var s = null;
        try { s = window.WorldExt && window.WorldExt.modState ? window.WorldExt.modState("wr_stage") : null; } catch (e) {}
        window.WR.fact(s, text);
      }
    } catch (e) {}
  }
  function busEmit(ev) { try { if (window.WorldBus) WorldBus.emit(ev); } catch (e) {} }

  /* ---------- 状态 ---------- */

  function blank() {
    return {
      v: 1, round: 0, evo: 0, stage: 1,
      stageNames: null, factions: [], regions: [], events: [], arcs: [], log: []
    };
  }

  var G = null;

  function stageNamesOf() {
    var d = null;
    try { d = window.WorldStage && window.WorldStage.data && window.WorldStage.data[genreKey()]; } catch (e) {}
    return (d && d.st && d.st.length) ? d.st.slice() : STAGE_FALLBACK.slice();
  }
  function factionSeed() {
    var d = null;
    try { d = window.WorldStage && window.WorldStage.data && window.WorldStage.data[genreKey()]; } catch (e) {}
    var names = (d && d.fa && d.fa.length) ? d.fa.slice() : FACTION_FALLBACK.slice();
    return names.map(function (n, i) {
      return { name: trim(n, 20), power: i === 0 ? 60 : i === 1 ? 52 : 40, status: "均衡", trend: 0, note: "", lastR: 0 };
    });
  }

  function seed() {
    var s = blank();
    s.round = nowRound();
    s.stageNames = stageNamesOf();
    s.factions = factionSeed();
    s.regions = REGION_FALLBACK.slice();
    return s;
  }

  function load() {
    if (G) return G;
    try {
      var raw = localStorage.getItem(storeKey());
      if (raw) {
        var d = JSON.parse(raw);
        if (d && typeof d === "object" && Number(d.v) >= 1) {
          G = blank();
          for (var k in G) if (G.hasOwnProperty(k) && d[k] != null) G[k] = d[k];
          if (!Array.isArray(G.factions) || !G.factions.length) G.factions = factionSeed();
          if (!Array.isArray(G.stageNames) || !G.stageNames.length) G.stageNames = stageNamesOf();
          if (!Array.isArray(G.regions)) G.regions = [];
          if (!Array.isArray(G.events)) G.events = [];
          if (!Array.isArray(G.arcs)) G.arcs = [];
          if (!Array.isArray(G.log)) G.log = [];
          return G;
        }
      }
    } catch (e) {}
    G = seed();
    return G;
  }

  var saveTid = 0;
  function save() {
    if (saveTid) return;
    saveTid = setTimeout(function () {
      saveTid = 0;
      try { localStorage.setItem(storeKey(), JSON.stringify(G)); } catch (e) {}
    }, 140);
  }
  function saveNow() {
    if (saveTid) { clearTimeout(saveTid); saveTid = 0; }
    try { localStorage.setItem(storeKey(), JSON.stringify(G)); } catch (e) {}
  }

  function pushLog(text) {
    var s = load();
    s.log.unshift({ r: s.round, text: trim(text, 90) });
    if (s.log.length > MAX_LOG) s.log.length = MAX_LOG;
  }

  /* ---------- 势力 / 区域 工具 ---------- */

  function findFaction(s, name) {
    name = trim(name, 20);
    if (!name) return null;
    for (var i = 0; i < s.factions.length; i++) if (s.factions[i].name === name) return s.factions[i];
    return null;
  }
  function ensureFaction(s, name) {
    var f = findFaction(s, name);
    if (f) return f;
    if (s.factions.length >= 12) return null;
    f = { name: trim(name, 20), power: 40, status: "新兴", trend: 0, note: "", lastR: s.round };
    s.factions.push(f);
    return f;
  }
  function factionStatus(power, trend) {
    if (power >= 80) return "如日中天";
    if (power >= 62) return "强势";
    if (power <= 14) return "名存实亡";
    if (power <= 30) return trend < 0 ? "风雨飘摇" : "式微";
    return trend > 4 ? "上升" : trend < -4 ? "下滑" : "均衡";
  }
  /** 势力对你（玩家）的态度：优先读 WorldBus 恩怨账本 */
  function factionRelation(name) {
    try {
      if (window.WorldBus && window.WorldBus.grudges && window.WorldBus.grudges[name] != null) return Number(window.WorldBus.grudges[name]) || 0;
    } catch (e) {}
    return 0;
  }
  function relationWord(v) {
    if (v >= 60) return "死忠";
    if (v >= 25) return "亲善";
    if (v > -25) return "中立";
    if (v > -60) return "敌视";
    return "死敌";
  }

  function findRegion(s, name) {
    name = trim(name, 20);
    if (!name) return null;
    for (var i = 0; i < s.regions.length; i++) if (s.regions[i].name === name) return s.regions[i];
    return null;
  }
  function ensureRegion(s, name) {
    var r = findRegion(s, name);
    if (r) return r;
    if (s.regions.length >= 14) return null;
    r = { name: trim(name, 20), control: "", prosperity: 50, unrest: 20, note: "", lastR: s.round };
    s.regions.push(r);
    return r;
  }

  /* ---------- 阶段 ---------- */

  function stageFromEvo(evo) {
    return evo >= STAGE_TH[1] ? 3 : evo >= STAGE_TH[0] ? 2 : 1;
  }
  function chapterStage() {
    try {
      if (window.WorldStage && window.WorldStage.stageOf) return Number(window.WorldStage.stageOf(genreKey(), null, nowRound())) || 1;
    } catch (e) {}
    return 1;
  }
  /** 演化驱动的阶段：与章节阶段取高者（章节仍保底，世界可加速） */
  function stageNow() {
    var s = load();
    return Math.max(stageFromEvo(s.evo), chapterStage());
  }
  function stageLabel(n) {
    var s = load();
    var names = s.stageNames && s.stageNames.length ? s.stageNames : stageNamesOf();
    return names[clamp(n, 1, names.length) - 1] || STAGE_FALLBACK[n - 1] || ("第" + n + "阶段");
  }

  /** 把旧 wr_stage 模块抬到不低于演化阶段，保持两套系统一致 */
  function syncStage() {
    try {
      var target = stageNow();
      var m = window.WorldExt && window.WorldExt.modState ? window.WorldExt.modState("wr_stage") : null;
      if (!m) return;
      var cur = Number(m.state.stage) || 1;
      if (target > cur) {
        m.state.stage = target;
        fact("🕰 世界因事态演变进入新阶段——「" + stageLabel(target) + "」。");
        busEmit({ type: "stage.up", stage: target });
      }
    } catch (e) {}
  }

  /* ---------- ① 规则驱动：每回合确定性推演 ---------- */

  function tick(round) {
    var s = load();
    var r = Number(round) || nowRound();
    if (r && r === s.round && s._ticked) return;   /* 同轮只推一次 */
    s.round = r || s.round;
    s._ticked = true;

    var i, f, reg;

    /* 势力：按趋势飘移 + 均值回归，此消彼长 */
    var totalDelta = 0;
    for (i = 0; i < s.factions.length; i++) {
      f = s.factions[i];
      var drift = (Math.random() - 0.5) * 6;                 /* 自然波动 */
      drift += (Number(f.trend) || 0) * 0.6;                 /* 趋势惯性 */
      drift += (50 - Number(f.power)) * 0.04;                /* 均值回归，避免一家独大到底 */
      var before = Number(f.power);
      f.power = clamp(before + drift, 0, 100);
      totalDelta += Math.abs(f.power - before);
      f.trend = Math.round((Number(f.trend) || 0) * 0.7 + (f.power - before));
      f.trend = clamp(f.trend, -20, 20);
      f.status = factionStatus(f.power, f.trend);
      f.lastR = s.round;
    }

    /* 区域：繁荣受所属势力强弱影响，动荡自累积并可回落 */
    for (i = 0; i < s.regions.length; i++) {
      reg = s.regions[i];
      var ctrl = reg.control ? findFaction(s, reg.control) : null;
      var pull = ctrl ? (Number(ctrl.power) - 50) * 0.05 : 0;
      reg.prosperity = clamp(Number(reg.prosperity) + pull + (Math.random() - 0.5) * 4, 0, 100);
      var u = Number(reg.unrest) + (Math.random() - 0.35) * 5;
      if (reg.prosperity > 65) u -= 2.2;                     /* 富庶则相对安定 */
      if (ctrl && Number(ctrl.power) < 25) u += 3.5;          /* 控制力崩溃 → 动荡 */
      reg.unrest = clamp(u, 0, 100);
      /* 动荡极高且原主虚弱 → 易主 */
      if (reg.unrest >= 88 && reg.control) {
        var challenger = null;
        for (var j = 0; j < s.factions.length; j++) {
          if (s.factions[j].name === reg.control) continue;
          if (!challenger || s.factions[j].power > challenger.power) challenger = s.factions[j];
        }
        if (challenger && challenger.power > (ctrl ? ctrl.power : 0) + 8) {
          var old = reg.control;
          reg.control = challenger.name;
          reg.unrest = 40;
          pushLog("「" + reg.name + "」脱离「" + old + "」，落入「" + challenger.name + "」之手");
          fact("🗺 「" + reg.name + "」易主——由「" + challenger.name + "」掌控。");
          busEmit({ type: "region.flip", region: reg.name, from: old, to: challenger.name });
        }
      }
      reg.lastR = s.round;
    }

    /* 演化度：基础推进 + 世界不稳定度 + 势力动荡 */
    var avgUnrest = 0;
    for (i = 0; i < s.regions.length; i++) avgUnrest += Number(s.regions[i].unrest) || 0;
    avgUnrest = s.regions.length ? avgUnrest / s.regions.length : 16;
    var gain = 1.6 + avgUnrest / 28 + totalDelta / 26;
    var beforeStage = stageFromEvo(s.evo);
    s.evo = clamp(s.evo + gain, 0, 100);
    var afterStage = stageFromEvo(s.evo);
    s.stage = Math.max(afterStage, chapterStage());
    if (afterStage > beforeStage) {
      pushLog("世界演化度突破 " + STAGE_TH[afterStage - 2] + "，进入「" + stageLabel(afterStage) + "」");
      toast("🕰 世界进入「" + stageLabel(afterStage) + "」", "info");
    }

    syncStage();
    saveNow();   /* 每回合一次的关键状态，立即落盘而非防抖 */
    try { if (window.WorldEvolutionUI && WorldEvolutionUI.isOpen && WorldEvolutionUI.isOpen()) WorldEvolutionUI.render(); } catch (e) {}
    return s;
  }

  /* ---------- ② 叙事驱动：解析并应用 AI 结构化回报 ---------- */

  /** 从正文中抽取【世界演化】JSON 块（容错：无闭合标签/多余文字/代码围栏） */
  function parseBlock(raw) {
    var text = String(raw == null ? "" : raw);
    var m = text.match(/【世界演化】([\s\S]*?)(?:【\/世界演化】|$)/);
    if (!m) return null;
    var body = m[1].replace(/```[a-zA-Z]*/g, "").trim();
    if (!body) return null;
    /* 先按整段解析，失败则取第一个平衡花括号片段，再失败则尝试修复截断 JSON */
    var obj = tryJSON(body);
    if (!obj) {
      var seg = firstBalanced(body);
      if (seg) obj = tryJSON(seg);
    }
    if (!obj) obj = repairJSON(body);
    return obj && typeof obj === "object" ? obj : null;
  }

  /**
   * 修复被截断的 JSON（AI 输出超长被切断是常态）：
   * 补全未闭合的字符串与括号、去掉悬空逗号/冒号后重试。
   * 只补结构不猜内容——解析出来的部分随后一律经 applyAI 的范围钳制。
   */
  function repairJSON(t) {
    var s = String(t || "").trim();
    if (!s || s.charAt(0) !== "{") {
      var lb = s.indexOf("{");
      if (lb < 0) return null;
      s = s.slice(lb);
    }
    var stack = [], inStr = false, escd = false;
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (inStr) {
        if (escd) escd = false;
        else if (c === "\\") escd = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') { inStr = true; continue; }
      if (c === "{") stack.push("}");
      else if (c === "[") stack.push("]");
      else if (c === "}" || c === "]") stack.pop();
    }
    if (inStr) s += '"';
    s = s.replace(/[\s,]+$/, "");
    s = s.replace(/:\s*$/, ":null");
    s = s.replace(/[\s,]+$/, "");
    while (stack.length) s += stack.pop();
    return tryJSON(s);
  }
  function tryJSON(t) {
    try { var o = JSON.parse(t); return o && typeof o === "object" ? o : null; } catch (e) { return null; }
  }
  function firstBalanced(t) {
    var start = t.indexOf("{");
    if (start < 0) return null;
    var depth = 0, inStr = false, escd = false;
    for (var i = start; i < t.length; i++) {
      var c = t[i];
      if (inStr) {
        if (escd) escd = false;
        else if (c === "\\") escd = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') { inStr = true; continue; }
      if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) return t.slice(start, i + 1); }
    }
    return null;
  }

  /**
   * 从正文中摘掉【世界演化】块（供 ai-response-handler 使用）。
   * 安全性：未闭合且取不到平衡 JSON 时**原样返回**，绝不吃掉正文；
   * 闭合标签存在时只删标签之间的内容。
   */
  function stripBlock(text) {
    var t = String(text == null ? "" : text);
    var open = t.indexOf("【世界演化】");
    if (open < 0) return t;
    var tag = "【/世界演化】";
    var close = t.indexOf(tag, open);
    if (close >= 0) return t.slice(0, open) + t.slice(close + tag.length);
    var rest = t.slice(open);
    var seg = firstBalanced(rest);
    if (!seg) return t;
    var at = rest.indexOf(seg);
    if (at < 0) return t;
    var end = open + at + seg.length;
    return t.slice(0, open) + t.slice(end);
  }

  /** 应用 AI 回报的增量（全部做范围钳制，AI 不能跳变世界） */
  function applyAI(raw) {
    var data = (raw && typeof raw === "object") ? raw : parseBlock(raw);
    if (!data) return false;
    var s = load();
    var i, o, f, reg, arc, changed = [];
    var CAP = 26;   /* 单次单项最大变动 */

    if (Array.isArray(data.factions)) {
      for (i = 0; i < data.factions.length; i++) {
        o = data.factions[i]; if (!o || !o.name) continue;
        f = ensureFaction(s, o.name); if (!f) continue;
        if (o.power != null) {
          var dp = clamp(o.power, -CAP, CAP);
          /* AI 给出的若是绝对值（>CAP）则按目标值处理 */
          if (Math.abs(Number(o.power)) > CAP) dp = clamp(Number(o.power) - f.power, -CAP, CAP);
          f.power = clamp(f.power + dp, 0, 100);
          f.trend = clamp((Number(f.trend) || 0) + dp, -20, 20);
        }
        if (o.status) f.status = trim(o.status, 12);
        else f.status = factionStatus(f.power, f.trend);
        if (o.note) f.note = trim(o.note, 40);
        if (o.relation != null) {
          /* 关系变化进 WorldBus 恩怨账本，与战斗/市集共享 */
          var dr = clamp(o.relation, -CAP, CAP);
          if (dr) { try { if (window.WorldBus && window.WorldBus.grudge) window.WorldBus.grudge(f.name, dr); } catch (e) {} }
        }
        f.lastR = s.round;
        changed.push("势力「" + f.name + "」势 " + Math.round(f.power) + " · " + f.status);
      }
    }

    if (Array.isArray(data.regions)) {
      for (i = 0; i < data.regions.length; i++) {
        o = data.regions[i]; if (!o || !o.name) continue;
        reg = ensureRegion(s, o.name); if (!reg) continue;
        if (o.control) reg.control = trim(o.control, 20);
        if (o.prosperity != null) reg.prosperity = clamp(Number(reg.prosperity) + clamp(o.prosperity, -CAP, CAP), 0, 100);
        if (o.unrest != null) reg.unrest = clamp(Number(reg.unrest) + clamp(o.unrest, -CAP, CAP), 0, 100);
        if (o.note) reg.note = trim(o.note, 40);
        reg.lastR = s.round;
        changed.push("区域「" + reg.name + "」繁荣 " + Math.round(reg.prosperity) + " · 动荡 " + Math.round(reg.unrest) + (reg.control ? " · " + reg.control : ""));
      }
    }

    if (Array.isArray(data.events)) {
      for (i = 0; i < data.events.length; i++) {
        o = data.events[i];
        var txt = typeof o === "string" ? o : (o && o.text);
        if (!txt) continue;
        s.events.unshift({
          id: uid(), r: s.round, text: trim(txt, 90),
          level: clamp((o && o.level) || 1, 1, 3),
          resolved: !!(o && o.resolved)
        });
        changed.push("事件：" + trim(txt, 34));
        busEmit({ type: "world.event", text: trim(txt, 90) });
      }
      if (s.events.length > MAX_EVENTS) s.events.length = MAX_EVENTS;
    }

    if (Array.isArray(data.arcs)) {
      for (i = 0; i < data.arcs.length; i++) {
        o = data.arcs[i]; if (!o || !o.name) continue;
        arc = null;
        for (var k = 0; k < s.arcs.length; k++) if (s.arcs[k].name === trim(o.name, 16)) { arc = s.arcs[k]; break; }
        if (!arc) {
          if (s.arcs.length >= MAX_ARCS) continue;
          arc = { name: trim(o.name, 16), role: "", goal: "", status: "", note: "", lastR: s.round };
          s.arcs.push(arc);
        }
        if (o.role) arc.role = trim(o.role, 20);
        if (o.goal) arc.goal = trim(o.goal, 50);
        if (o.status) arc.status = trim(o.status, 24);
        if (o.note) arc.note = trim(o.note, 40);
        arc.lastR = s.round;
        changed.push("人物「" + arc.name + "」" + (arc.status || arc.goal || "处境更新"));
      }
    }

    /* 演化度：叙事有实质推进则额外加速 */
    if (changed.length) {
      s.evo = clamp(s.evo + Math.min(6, 1 + changed.length * 0.8), 0, 100);
      s.stage = Math.max(stageFromEvo(s.evo), chapterStage());
      syncStage();
    }
    for (i = 0; i < changed.length && i < 4; i++) pushLog(changed[i]);
    saveNow();   /* 主笔回报的世界变化必须立刻持久化，避免刷新丢失 */
    try { if (window.WorldEvolutionUI && WorldEvolutionUI.isOpen && WorldEvolutionUI.isOpen()) WorldEvolutionUI.render(); } catch (e) {}
    return changed.length > 0;
  }

  /* ---------- 注入主笔 ---------- */

  /** 给主笔的世界现状 + 演化回报契约 */
  function buildPromptBlock() {
    var s = load();
    if (!s.factions.length && !s.regions.length && !s.events.length && !s.arcs.length && s.evo === 0) {
      /* 尚未开局推演：只给契约，不给空面板 */
      return "";
    }
    var lines = [];
    lines.push("\n【世界演化现状（系统维护 · 只读）】");
    lines.push("当前时代：第 " + stageNow() + " 阶段「" + stageLabel(stageNow()) + "」（演化度 " + Math.round(s.evo) + "/100）");

    if (s.factions.length) {
      lines.push("势力格局：");
      for (var i = 0; i < s.factions.length && i < 8; i++) {
        var f = s.factions[i];
        var rel = factionRelation(f.name);
        lines.push("  · " + f.name + "：实力 " + Math.round(f.power) + "（" + (f.status || "—") + "）"
          + "，对你「" + relationWord(rel) + "」" + (f.note ? "，近况：" + f.note : ""));
      }
    }
    if (s.regions.length) {
      lines.push("区域态势：");
      for (var j = 0; j < s.regions.length && j < 8; j++) {
        var r = s.regions[j];
        lines.push("  · " + r.name + "：" + (r.control ? "属" + r.control + "；" : "")
          + "繁荣 " + Math.round(r.prosperity) + "，动荡 " + Math.round(r.unrest) + (r.note ? "；" + r.note : ""));
      }
    }
    if (s.events.length) {
      lines.push("演化中事件：");
      for (var k = 0; k < s.events.length && k < 6; k++) {
        var e = s.events[k];
        lines.push("  · （第" + e.r + "回" + (e.resolved ? "·已了结" : "") + "）" + e.text);
      }
    }
    if (s.arcs.length) {
      lines.push("人物走向：");
      for (var m = 0; m < s.arcs.length && m < 8; m++) {
        var a = s.arcs[m];
        lines.push("  · " + a.name + (a.role ? "（" + a.role + "）" : "") + "：" + (a.goal ? "目标 " + a.goal + "；" : "")
          + (a.status ? "现况 " + a.status : "") + (a.note ? "；" + a.note : ""));
      }
    }
    lines.push("以上是这个世界当前的真实格局，请让剧情与之自洽：势力强弱会影响人物的态度与资源，区域动荡会影响旅途见闻，事件链会继续发展而非凭空消失。");
    lines.push("【演化回报契约】正文结束后，另起一段输出世界的变化（只写本轮确有实质变化的项，无变化则不输出该块）：");
    lines.push('【世界演化】{"factions":[{"name":"势力名","power":-8,"relation":-5,"status":"下滑","note":"一句话近况"}],');
    lines.push('"regions":[{"name":"区域名","control":"势力名","prosperity":-5,"unrest":8,"note":"一句话"}],');
    lines.push('"events":[{"text":"本轮发生的大事","level":1}],');
    lines.push('"arcs":[{"name":"人物名","role":"身份","goal":"目标","status":"现况"}]}【/世界演化】');
    lines.push("字段说明：power/relation/prosperity/unrest 写**增量**（±1~26），status/note/goal 写文字；level 1=小事 2=要事 3=震动天下。此块不出现在读者可见正文中。");
    return lines.join("\n");
  }

  /** 给动态世界（远方推演）的条款：让远方按同一份格局推演 */
  function buildWorldClause() {
    var s = load();
    if (!s.factions.length) return "";
    var parts = [];
    for (var i = 0; i < s.factions.length && i < 8; i++) {
      var f = s.factions[i];
      parts.push(f.name + "(" + Math.round(f.power) + (f.trend >= 0 ? "↑" : "↓") + ")");
    }
    var out = "- 当前势力格局：" + parts.join("、") + "；远方的兴衰须承此格局推演，不得凭空出现压制一切的新势力";
    for (var j = 0; j < s.regions.length && j < 6; j++) {
      var r = s.regions[j];
      if (Number(r.unrest) >= 60) out += "\n- 「" + r.name + "」正高度动荡（" + Math.round(r.unrest) + "）——远方事件可围绕此地展开";
    }
    return out;
  }

  /* ---------- 事件订阅 ---------- */

  var hooked = false;
  function hook() {
    if (hooked || !window.WorldBus) return;
    hooked = true;
    var WB = window.WorldBus;
    /* 战斗胜负也会推动世界：赢了压制当地势力，输了助长对手气焰 */
    WB.on("combat.win", function (ev) {
      var s = load();
      var target = null;
      try { target = WB.topGrudge && WB.topGrudge(); } catch (e) {}
      if (target && target.name) {
        var f = findFaction(s, target.name);
        if (f) { f.power = clamp(f.power - 2.5, 0, 100); f.trend = clamp((f.trend || 0) - 3, -20, 20); f.status = factionStatus(f.power, f.trend); }
      }
      s.evo = clamp(s.evo + 0.8, 0, 100);
      save();
    });
    WB.on("combat.loss", function () {
      var s = load();
      s.evo = clamp(s.evo + 1.2, 0, 100);
      save();
    });
    WB.on("stage.up", function () { save(); });
  }

  /* ---------- 对外接口 ---------- */

  var WorldEvolution = {
    VERSION: VERSION,
    STAGE_TH: STAGE_TH,

    state: function () { return load(); },
    stageNow: stageNow,
    stageLabel: stageLabel,
    evolution: function () { return Math.round(load().evo); },
    factions: function () { return load().factions.slice(); },
    regions: function () { return load().regions.slice(); },
    events: function () { return load().events.slice(); },
    arcs: function () { return load().arcs.slice(); },
    log: function () { return load().log.slice(); },

    /** 势力对你（玩家）的态度值 */
    relationOf: factionRelation,
    relationWord: relationWord,

    tick: tick,
    parseBlock: parseBlock,
    stripBlock: stripBlock,
    applyAI: applyAI,
    buildPromptBlock: buildPromptBlock,
    buildWorldClause: buildWorldClause,
    syncStage: syncStage,

    /** 手动登记一个势力 / 区域（玩家或事件发起） */
    addFaction: function (name, power) {
      var s = load();
      var f = ensureFaction(s, name);
      if (!f) return null;
      if (power != null) f.power = clamp(power, 0, 100);
      f.status = factionStatus(f.power, f.trend);
      save();
      try { if (window.WorldEvolutionUI) WorldEvolutionUI.render(); } catch (e) {}
      return f;
    },
    addRegion: function (name, control) {
      var s = load();
      var r = ensureRegion(s, name);
      if (!r) return null;
      if (control) r.control = trim(control, 20);
      save();
      try { if (window.WorldEvolutionUI) WorldEvolutionUI.render(); } catch (e) {}
      return r;
    },
    removeFaction: function (name) {
      var s = load();
      s.factions = s.factions.filter(function (f) { return f.name !== trim(name, 20); });
      save();
      try { if (window.WorldEvolutionUI) WorldEvolutionUI.render(); } catch (e) {}
    },
    removeRegion: function (name) {
      var s = load();
      s.regions = s.regions.filter(function (r) { return r.name !== trim(name, 20); });
      save();
      try { if (window.WorldEvolutionUI) WorldEvolutionUI.render(); } catch (e) {}
    },

    /** 面板入口（供小云菜单 / 沉浸面板调用） */
    openUI: function () { if (window.WorldEvolutionUI) WorldEvolutionUI.open(); },
    closeUI: function () { if (window.WorldEvolutionUI) WorldEvolutionUI.close(); },

    reset: function () {
      G = seed(); saveNow(); hooked = false; hook();
      try { if (window.WorldEvolutionUI) WorldEvolutionUI.render(); } catch (e) {}
    },
    /** 存档切换后重新载入（串档隔离） */
    reload: function () { G = null; load(); hook(); try { if (window.WorldEvolutionUI) WorldEvolutionUI.render(); } catch (e) {} },
    /** 供存档导出/导入 */
    exportState: function () { return load(); },
    importState: function (d) {
      if (!d || typeof d !== "object") return false;
      G = blank();
      for (var k in G) if (G.hasOwnProperty(k) && d[k] != null) G[k] = d[k];
      saveNow();
      try { if (window.WorldEvolutionUI) WorldEvolutionUI.render(); } catch (e) {}
      return true;
    },
    saveNow: saveNow,
    _load: load
  };

  window.WorldEvolution = WorldEvolution;

  /* ---------- 启动 ---------- */
  function boot() {
    load();
    hook();
    /* 每轮回合推演一次（章节变化即视为新一轮） */
    var last = -1;
    setInterval(function () {
      try {
        if (document.hidden) return;
        var r = nowRound();
        if (r && r !== last) {
          last = r;
          if (window.storyFramework && window.storyFramework.storyState && window.storyFramework.storyState.isStoryStarted) tick(r);
        }
      } catch (e) {}
    }, 12000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 900); });
  else setTimeout(boot, 900);
})();
