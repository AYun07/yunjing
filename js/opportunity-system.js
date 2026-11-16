/* 云境 · 涌现式机缘系统 v1.0.0（整改工作单 P0-2）
 * 痛点：此前 33 条主线是写死的三幕（quest-chain.js 固定顺序、只进不退、阈值打卡），
 *       且仓库里根本没有「机缘」这个概念——一切后果的天花板都是「改几个数值」。
 *
 * 本模块把「机缘」做成真正涌现的系统：
 *   · 候选池三路：① 知识库该界的「机缘/秘辛/伏笔」条目；② 由当前世界状态（阶段/势力影响力/与玩家恩怨/张力）推导；③ AI 每回合按世界状态新增。
 *   · 触发条件读世界状态（门控）：KB 机缘若提及某势力/人物，则该实体在场才出现；状态线索按张力/恩怨/强权派生。
 *   · 机缘有代价与时限：过期即消失（这才是"真实"），且同一回合不同世界状态给出不同候选（确定性种子）。
 *   · 三幕主线改为「世界线索」：保留 quest-chain A 表为骨架，但允许 AI 新增/改写分支，同一幕的达成路径不同 → 形态不同。
 *   · 机缘了结记入「大势账本」(CanonLedger)，让世界动态性铁律闭环。
 *
 * 真源：window.storyFramework.storyState.variables.opportunities / .quest（随存档落盘、按槽隔离，不污染 entities 实体镜像）。
 */
(function () {
  "use strict";
  var VER = "v1.0.0";

  function genre() {
    try { if (window.WorldExt && WorldExt.genre) return WorldExt.genre; } catch (e) {}
    try { return new URLSearchParams(location.search).get("genre") || "free"; } catch (e) { return "free"; }
  }
  function vars() {
    try { var fw = window.storyFramework; return (fw && fw.storyState && fw.storyState.variables) || null; } catch (e) { return null; }
  }
  function nowRound() {
    try { var fw = window.storyFramework; return (fw && fw.storyState && Number(fw.storyState.turnCount)) || (vars() && Number(vars().chapter)) || 0; } catch (e) { return 0; }
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function hashStr(s) { var h = 2166136261 >>> 0; s = String(s || ""); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function save() { try { var fw = window.storyFramework; fw && fw.saveStory && fw.saveStory(); } catch (e) {} }

  function ensureState() {
    var v = vars(); if (!v) return null;
    v.entities = v.entities || {};
    if (!Array.isArray(v.opportunities)) v.opportunities = [];
    if (!v.quest || typeof v.quest !== "object") v.quest = { act: 1, branch: {}, title: "" };
    if (typeof v.quest.branch !== "object" || v.quest.branch === null) v.quest.branch = {};
    if (!v.quest.title) v.quest.title = questTitle();
    return v;
  }

  /* 世界状态摘要：作为确定性种子 + 分支选择的依据（不同状态 => 不同机缘候选 / 不同主线形态） */
  function worldSig() {
    var v = vars(); var parts = [genre()];
    try {
      var facs = (v.entities && v.entities.factions) || {};
      Object.keys(facs).forEach(function (k) { parts.push("F" + k + ":" + Math.round(facs[k].influence || 0)); });
      var g = (window.WorldBus && window.WorldBus.grudges) || {};
      for (var n in g) { if (g.hasOwnProperty(n)) parts.push("G" + n + ":" + g[n]); }
      parts.push("T" + (Number(v.tension) || 0));
      var st = (window.WorldExt && WorldExt.modState) ? WorldExt.modState("wr_stage") : null;
      parts.push("S" + (st ? (Number(st.state.stage) || 1) : 1));
    } catch (e) {}
    return parts.join("|");
  }

  /* ---------- 候选池：路① 知识库机缘/秘辛/伏笔 ---------- */
  function kbChances() {
    var out = [];
    try {
      var list = (window.KB_PRESETS && window.KB_PRESETS[genre()]) || [];
      list.forEach(function (it) {
        if (!it || !it.title) return;
        var hay = (it.category || "") + " " + (it.tags || []).join(" ") + " " + (it.title || "");
        if (!/机缘|秘辛|伏笔|机会|奇遇|异象/.test(hay)) return;
        out.push({
          title: String(it.title).slice(0, 40),
          desc: String(it.content || "").replace(/\s+/g, " ").slice(0, 160),
          cost: defaultCost(it), ttl: 6, kb: true, refs: refsIn(it)
        });
      });
    } catch (e) {}
    return out;
  }
  function refsIn(it) {
    var txt = (it.title || "") + " " + (it.content || "") + " " + (it.tags || []).join(" ");
    var v = vars(); var refs = [];
    try {
      var facs = (v.entities && v.entities.factions) || {};
      Object.keys(facs).forEach(function (k) { var nm = facs[k].name || k; if (txt.indexOf(nm) >= 0) refs.push(nm); });
      var chars = v.characters || {};
      Object.keys(chars).forEach(function (k) { if (txt.indexOf(k) >= 0) refs.push(k); });
    } catch (e) {}
    return refs;
  }
  function defaultCost(it) {
    var t = (it.title || "") + (it.content || "");
    if (/以命|献祭|血祭|牺牲|燃寿/.test(t)) return "需付出重大代价（风险极高）";
    if (/资源|灵石|金钱|物资|宝物/.test(t)) return "消耗若干身家资源";
    if (/试炼|闯关|历练|死战/.test(t)) return "需通过一番凶险试炼";
    return "时机稍纵即逝，宜速决";
  }

  /* ---------- 候选池：路② 由世界状态派生线索 ---------- */
  function stateClues() {
    var v = vars(); var out = [];
    try {
      var g = (window.WorldBus && window.WorldBus.grudges) || {};
      for (var n in g) {
        if (!g.hasOwnProperty(n)) continue;
        if (g[n] <= -25) out.push({ title: "雪耻契机·" + n, desc: "与「" + n + "」的宿怨已深，正可寻机了断或借势反制。", cost: "直面强敌的风险", ttl: 5, kb: false, refs: [n] });
        else if (g[n] >= 25) out.push({ title: "盟友相邀·" + n, desc: "「" + n + "」视你为可托付之人，或有要事相托。", cost: "需分心助盟友一臂", ttl: 6, kb: false, refs: [n] });
      }
      var facs = Object.values((v.entities && v.entities.factions) || {});
      facs.forEach(function (f) { if ((Number(f.influence) || 0) >= 70) out.push({ title: "强权之下·" + f.name, desc: f.name + "独大，或招贤纳士，或镇压异己——你已是局中人。", cost: "卷入大势的代价", ttl: 6, kb: false, refs: [f.name] }); });
      var T = Number(v.tension) || 0;
      if (T >= 60) out.push({ title: "乱世契机", desc: "世道纷乱，趁势攫取者众，亦有人趁火打劫。", cost: "乱局本身的凶险", ttl: 4, kb: false, refs: [] });
      else if (T <= 15) out.push({ title: "游历奇遇", desc: "时局稍安，行旅之间或偶遇异人、遗泽。", cost: "需主动外出寻访", ttl: 7, kb: false, refs: [] });
      var st = (window.WorldExt && WorldExt.modState) ? WorldExt.modState("wr_stage") : null;
      var s = st ? (Number(st.state.stage) || 1) : 1;
      if (s >= 2) out.push({ title: "变局之机", desc: "大势已入中段，旧秩序松动，新机缘随之浮现。", cost: "顺势而动的眼光", ttl: 6, kb: false, refs: [] });
    } catch (e) {}
    return out;
  }

  function eligible(t) {
    if (t.kb && t.refs && t.refs.length) {
      var v = vars(); var ok = false;
      try {
        var facs = (v.entities && v.entities.factions) || {};
        var names = Object.keys(facs).map(function (k) { return facs[k].name || k; });
        t.refs.forEach(function (r) { if (names.indexOf(r) >= 0) ok = true; });
      } catch (e) {}
      if (!ok) return false;
    }
    return true;
  }

  function expirePassed(r) {
    var v = ensureState(); if (!v) return;
    r = (r != null) ? r : nowRound();
    (v.opportunities || []).forEach(function (o) { if (o.status === "active" && r > o.expiryRound) o.status = "expired"; });
  }

  /* 主入口：每回合（或世界自转每 tick）涌现机缘。round 相同时不同世界状态 => 不同候选 */
  function roll(round) {
    var v = ensureState(); if (!v) return [];
    round = (round != null) ? round : nowRound();
    expirePassed(round);
    var active = (v.opportunities || []).filter(function (o) { return o.status === "active"; });

    var cands = kbChances().concat(stateClues()).filter(eligible);
    var seed = hashStr(worldSig() + "#" + round);
    var rnd = mulberry32(seed);
    var pool = cands.slice();
    var chosen = [];
    while (chosen.length < 3 && pool.length) {
      var i = Math.floor(rnd() * pool.length);
      chosen.push(pool.splice(i, 1)[0]);
    }
    var existing = {}; active.forEach(function (o) { existing[o.title] = 1; });
    chosen.forEach(function (t) {
      if (existing[t.title]) return;
      var id = "op_" + Date.now().toString(36) + "_" + Math.floor(rnd() * 1e4).toString(36);
      var op = {
        id: id, title: t.title, desc: t.desc, cost: t.cost, ttl: t.ttl,
        expiryRound: round + t.ttl, createdRound: round, status: "active",
        branch: t.kb ? (t.refs && t.refs[0] || "") : "", source: t.kb ? "kb" : "state"
      };
      v.opportunities.push(op);
    });
    save();
    return (v.opportunities || []).filter(function (o) { return o.status === "active"; });
  }

  function add(title, desc, opts) {
    opts = opts || {};
    var v = ensureState(); if (!v || !title) return null;
    var r = nowRound();
    var op = {
      id: "op_" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
      title: String(title).slice(0, 40), desc: String(desc || "").slice(0, 200),
      cost: opts.cost || "由你把握时机", ttl: opts.ttl || 6,
      expiryRound: r + (opts.ttl || 6), createdRound: r, status: "active",
      branch: opts.branch || "", source: "ai"
    };
    v.opportunities.push(op);
    save();
    return op;
  }
  function resolve(id, note) {
    var v = vars(); if (!v) return false;
    var arr = v.opportunities || [];
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === id) {
        arr[i].status = "taken"; arr[i].resolvedRound = nowRound(); if (note) arr[i].note = note;
        try { if (window.CanonLedger) CanonLedger.claim(arr[i].title, "player", { note: note || "机缘了结", round: nowRound() }); } catch (e) {}
        save();
        return true;
      }
    }
    return false;
  }
  function list() { expirePassed(); var v = vars(); return (v && v.entities && v.opportunities) || []; }
  function activeList() { return list().filter(function (o) { return o.status === "active"; }); }

  /* ---------- 分支主线（路③ + 世界线索） ---------- */
  function questTitle() {
    try { var A = window.QuestChain && window.QuestChain.arcs; var c = A && A[genre()]; return c ? c.title : ""; } catch (e) { return ""; }
  }
  function ensureQuest() { var v = ensureState(); return v ? v.quest : null; }
  function setAct(a) { var q = ensureQuest(); if (q) { q.act = clamp(Number(a) || 1, 1, 3); save(); } }
  function setBranch(act, form) {
    var q = ensureQuest(); if (!q) return;
    var a = Number(act); if (!a || a < 1) a = 1;
    q.branch[a] = String(form).slice(0, 120); save();
  }
  /* 涌现式主线形态：无显式分支时，依当前世界状态推导本幕形态（不同状态 => 不同形态） */
  function autoBranch(act) {
    var q = ensureQuest(); if (!q) return "";
    if (q.branch[act]) return q.branch[act];
    var form = "";
    try {
      var g = (window.WorldBus && window.WorldBus.grudges) || {}; var top = null;
      for (var n in g) { if (g.hasOwnProperty(n)) { if (!top || g[n] < top.v) top = { n: n, v: g[n] }; } }
      var st = (window.WorldExt && WorldExt.modState) ? WorldExt.modState("wr_stage") : null;
      var s = st ? (Number(st.state.stage) || 1) : 1;
      if (top && top.v <= -25) form = "以与「" + top.n + "」的死结为轴，走出另类变局";
      else if (top && top.v >= 25) form = "借「" + top.n + "」之援，开辟同盟路线";
      else if (s >= 2) form = "于旧秩序松动处，另辟蹊径";
      else form = "循本界常轨推进";
    } catch (e) {}
    if (form) q.branch[act] = form;
    return form;
  }
  function questDesc() {
    var q = ensureQuest(); if (!q) return "";
    var title = q.title || questTitle();
    var act = q.act || 1;
    var form = autoBranch(act);
    return "主线「" + title + "」第 " + act + " 幕" + (form ? ("（形态：" + form + "）") : "");
  }

  /* ---------- 上行注入（由 WorldAlive.buildPromptBlock 汇总） ---------- */
  function buildPromptBlock() {
    expirePassed();
    var v = vars(); if (!v) return "";
    var lines = [];
    var active = (v.opportunities || []).filter(function (o) { return o.status === "active"; });
    if (active.length) {
      lines.push("【当前机缘（涌现 · 有代价有时限，过期即逝）】");
      var r = nowRound();
      active.slice(0, 5).forEach(function (o) {
        var left = Math.max(0, o.expiryRound - r);
        lines.push("· " + o.title + " —— " + (o.desc || "") + (o.cost ? (" 代价：" + o.cost) : "") + " 余 " + left + " 回合");
      });
    }
    var qd = questDesc();
    if (qd) lines.push("【主线走向】" + qd + "（同一幕可因选择不同而有不同形态，须在正文体现你的路径）");
    return lines.join("\n");
  }

  window.OpportunitySystem = {
    roll: roll, add: add, resolve: resolve, list: list, activeList: activeList,
    setAct: setAct, setBranch: setBranch, questDesc: questDesc,
    buildPromptBlock: buildPromptBlock, ensureState: ensureState, _ver: VER
  };
})();
