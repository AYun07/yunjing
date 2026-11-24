/* =========================================================================
 * 云境 · 称号系统 TitleSystem（v4.49.0）
 * -------------------------------------------------------------------------
 * 用户诉求：「还有称号系统等等」——称号可解锁、可佩戴、带加成，且加成汇入
 *   BonusEngine 统一计算层，与装备词条叠加不重复计算。
 *
 * 设计红线（DR-014）：
 *   ① 称号是云境原创的通用语义名，不引用任何第三方项目的专属称号；
 *   ② 解锁条件只读本机故事变量（章节/属性/胜场/羁绊/世界进度），零网络；
 *   ③ 同时只佩戴一个称号（主称号），避免叠叠乐失衡；切换即触发 BonusEngine 重算；
 *   ④ 称号加成由本模块定义（bonusOf 权威），BonusEngine 延迟读取；未加载时引擎
 *      用内建兜底表，二者一致；
 *   ⑤ 纯函数 + localStorage 持久化，可在 Node vm 沙箱完整回归。
 * ========================================================================= */
(function () {
  "use strict";
  var G = (typeof window !== "undefined") ? window : (typeof globalThis !== "undefined" ? globalThis : {});
  var VERSION = "5.0.0";

  function slot() { try { return (G.storyFramework && G.storyFramework.slotId) || "main"; } catch (e) { return "main"; } }
  function keyOf(base) { return base + "~" + slot(); }
  function lsGet(k, fb) { try { var raw = G.localStorage && G.localStorage.getItem(k); return raw ? JSON.parse(raw) : fb; } catch (e) { return fb; } }
  function lsSet(k, v) { try { if (G.localStorage) { G.localStorage.setItem(k, JSON.stringify(v)); return true; } } catch (e) {} return false; }
  function vars() { try { return (G.storyFramework && G.storyFramework.storyState && G.storyFramework.storyState.variables) || {}; } catch (e) { return {}; } }

  /* =====================================================================
   * 一、称号库（原创通用语义名；stat 键与 BonusEngine 一致）
   *   unlock: { type, ... } 描述解锁判定；type=always/chapter/stat/wins/bond/realm
   * ===================================================================== */
  var TITLES = [
    { id: "t_begin",    name: "初露锋芒", icon: "🌱", desc: "踏上旅途的第一份名号", bonus: { all: 1 }, unlock: { type: "chapter", min: 1 } },
    { id: "t_veteran",  name: "百战之身", icon: "⚔", desc: "身经百战，攻守皆有所长", bonus: { atk: 3, def: 2 }, unlock: { type: "wins", min: 10 } },
    { id: "t_bulwark",  name: "独当一面", icon: "🛡", desc: "可独守一方，气血与攻击俱增", bonus: { atk: 5, hp: 10 }, unlock: { type: "wins", min: 30 } },
    { id: "t_elite",    name: "人中龙凤", icon: "🐉", desc: "六维卓绝，全属性提升", bonus: { all: 2 }, unlock: { type: "stat", max: 80 } },
    { id: "t_famous",   name: "万众瞩目", icon: "✨", desc: "声名远播，出手更易击中关窍", bonus: { crit: 5 }, unlock: { type: "chapter", min: 20 } },
    { id: "t_bond",     name: "羁绊深厚", icon: "🤝", desc: "与随行存在心意相通", bonus: { spd: 3, hp: 8 }, unlock: { type: "bond", min: 80 } },
    { id: "t_realm",    name: "登堂入室", icon: "🏔", desc: "修为臻至通达，诸维精进", bonus: { all: 1, atk: 2 }, unlock: { type: "realm", min: 4 } }
  ];
  var BY_ID = {}, BY_NAME = {};
  TITLES.forEach(function (t) { BY_ID[t.id] = t; BY_NAME[t.name] = t; });

  /* =====================================================================
   * 二、解锁判定（只读本机变量）
   * ===================================================================== */
  function maxStat() {
    var v = vars(), stats = (v.stats || {}), m = 0;
    Object.keys(stats).forEach(function (k) { if (typeof stats[k] === "number" && stats[k] > m) m = stats[k]; });
    return m;
  }
  function maxBond() {
    var m = 0;
    try {
      var arr = (G.BeastSystem && G.BeastSystem.list && G.BeastSystem.list()) || [];
      arr.forEach(function (b) { if (b && (b.bond || 0) > m) m = b.bond; });
    } catch (e) {}
    return m;
  }
  function maxRealm() {
    var m = 0;
    try {
      var arr = (G.BeastSystem && G.BeastSystem.list && G.BeastSystem.list()) || [];
      arr.forEach(function (b) { if (b && (b.realmIdx || 0) > m) m = b.realmIdx; });
    } catch (e) {}
    /* 也读主角境界字段 */
    var v = vars();
    var rr = Number(v.realmIdx || (v["境界"] && v["境界"].level));
    if (rr > m) m = rr;
    return m;
  }
  function wins() {
    var n = 0;
    try {
      var w = G.WorldRuntime && G.WorldRuntime.state && G.WorldRuntime.state() && G.WorldRuntime.state().wr_combat;
      if (w) n = Number(w.wins) || 0;
    } catch (e) {}
    return n;
  }
  function isUnlocked(t, ctx) {
    if (!t) return false;
    var u = t.unlock || { type: "always" };
    var v = vars();
    ctx = ctx || {};
    if (u.type === "always") return true;
    if (u.type === "chapter") return (Number(v.chapter) || 0) >= u.min;
    if (u.type === "wins") return (ctx.wins != null ? ctx.wins : wins()) >= u.min;
    if (u.type === "stat") return maxStat() >= u.max;
    if (u.type === "bond") return maxBond() >= u.min;
    if (u.type === "realm") return maxRealm() >= u.min;
    return false;
  }

  /* =====================================================================
   * 三、状态持久化：已解锁（手动领取确认）+ 当前佩戴
   * ===================================================================== */
  function state() {
    var d = lsGet(keyOf("yunjingTitles"), null);
    if (!d || typeof d !== "object") d = { claimed: {}, worn: "" };
    d.claimed = d.claimed || {}; d.worn = d.worn || "";
    return d;
  }
  function saveState(d) { return lsSet(keyOf("yunjingTitles"), d); }

  function syncVars() {
    try {
      var v = vars();
      /* 写「名字」而非 id：BonusEngine.wornTitle() 按名字取加成（bonusOf 权威表）。 */
      var wornName = current();
      v["称号"] = wornName || "";
      v.title = wornName || "";
    } catch (e) {}
  }

  function recompute() {
    syncVars();
    try { if (G.BonusEngine && G.BonusEngine.recompute) G.BonusEngine.recompute(); } catch (e) {}
  }

  /** 可领取的称号（满足解锁条件、尚未领取） */
  function available(ctx) { return TITLES.filter(function (t) { return isUnlocked(t, ctx) && !state().claimed[t.id]; }); }

  /** 领取称号（解锁后须领取才进衣橱） */
  function claim(id) {
    var t = BY_ID[id]; if (!t) return false;
    if (!isUnlocked(t)) return false;
    var d = state(); if (d.claimed[id]) return false;
    d.claimed[id] = true; saveState(d);
    try { if (G.showToast) G.showToast("已获得称号「" + t.name + "」", "success"); } catch (e) {}
    return true;
  }

  /** 佩戴 / 切换称号（同时仅一个） */
  function wear(id) {
    var t = BY_ID[id]; if (!t) return false;
    var d = state();
    if (!d.claimed[id] && !isUnlocked(t)) return false;
    d.claimed[id] = true; d.worn = id; saveState(d);
    recompute();
    try { if (G.showToast) G.showToast("已佩戴称号「" + t.name + "」", "success"); } catch (e) {}
    if (G.MoChibi && G.MoChibi.say) G.MoChibi.say("佩戴称号「" + t.name + "」——" + t.desc, 3000);
    return true;
  }
  function unwear() {
    var d = state(); if (!d.worn) return false;
    d.worn = ""; saveState(d); recompute();
    try { if (G.showToast) G.showToast("已卸下称号"); } catch (e) {}
    return true;
  }

  /** 当前佩戴称号名（BonusEngine 读它取加成） */
  function current() { var d = state(); var t = BY_ID[d.worn]; return t ? t.name : ""; }
  /** 按名字取加成（BonusEngine 延迟解析调用） */
  function bonusOf(name) { var t = BY_NAME[name]; return t ? t.bonus : null; }

  /* =====================================================================
   * 四、面板 UI（可领取 / 已拥有 / 当前佩戴）
   * ===================================================================== */
  function ensureStyle() {
    if (G.document && G.document.getElementById && G.document.getElementById("titleStyle")) return;
    if (!G.document || !G.document.createElement) return;
    var st = G.document.createElement("style"); st.id = "titleStyle";
    st.textContent = ".ts-mask{position:fixed;inset:0;z-index:125;background:rgba(8,12,20,.62);display:none;align-items:center;justify-content:center;padding:16px}.ts-mask.show{display:flex}" +
      ".ts-panel{width:min(560px,94vw);max-height:86vh;overflow:auto;background:#11161f;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:18px 20px;color:#e9eef5;font-family:inherit}" +
      ".ts-panel h3{margin:0 0 12px;font-size:17px}.ts-x{cursor:pointer;background:none;border:none;color:inherit;font-size:20px;opacity:.7}" +
      ".ts-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:9px}.ts-card{border:1px solid rgba(201,168,106,.26);border-radius:12px;padding:10px;background:rgba(255,255,255,.03)}" +
      ".ts-card.on{border-color:#c9a86a;background:rgba(201,168,106,.1)}.ts-card.locked{opacity:.5}.ts-card .n{font-size:13px;font-weight:600;margin-bottom:4px}.ts-card .d{font-size:11px;opacity:.75;line-height:1.5;min-height:32px}" +
      ".ts-card .b{font-size:10.5px;color:#8fd9a8;margin:4px 0}.ts-card button{width:100%;margin-top:6px;padding:5px;border-radius:8px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:inherit;cursor:pointer;font-size:11px}";
    G.document.head.appendChild(st);
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }
  function bonusText(b) {
    return Object.keys(b).map(function (k) { return (k === "all" ? "全维" : ({ atk: "攻击", def: "防御", hp: "气血", spd: "速度", crit: "暴击" })[k] || k) + "+" + b[k]; }).join(" / ");
  }
  function openUI() {
    if (!G.document) return;
    ensureStyle();
    var d = state(), wornId = d.worn;
    var m = G.document.getElementById("tsMask");
    if (!m) {
      m = G.document.createElement("div"); m.id = "tsMask"; m.className = "ts-mask";
      m.innerHTML = '<div class="ts-panel"><div style="display:flex;align-items:center"><h3 style="flex:1">🏅 称号阁</h3><button class="ts-x" onclick="TitleSystem.closeUI()">✕</button></div><div id="tsBody"></div></div>';
      m.addEventListener("click", function (e) { if (e.target === m) G.TitleSystem.closeUI(); });
      G.document.body.appendChild(m);
    }
    var ctx = {};
    var cards = TITLES.map(function (t) {
      var unlocked = isUnlocked(t, ctx);
      var owned = !!d.claimed[t.id];
      var isWorn = wornId === t.id;
      var cls = "ts-card" + (isWorn ? " on" : "") + (!unlocked && !owned ? " locked" : "");
      var btn;
      if (isWorn) btn = '<button onclick="TitleSystem.unwear()">卸下</button>';
      else if (owned) btn = '<button onclick="TitleSystem.wear(\'' + t.id + '\')">佩戴</button>';
      else if (unlocked) btn = '<button onclick="TitleSystem.claim(\'' + t.id + '\')">领取</button>';
      else btn = '<button disabled>未解锁</button>';
      /* v5.0.0 自定义加成：写下任意词条，按语意附加效果（特殊说明优先） */
      var custBtn = '<button style="border-color:rgba(201,168,106,.4)!important;color:#c9a86a!important" onclick="window.BonusEngine&&BonusEngine.openAffixEditor(\'title:' + esc(t.name) + '\',{title:\'✦ ' + esc(t.name) + ' · 自定义加成\'})">✎ 自定义加成</button>';
      var custText = (window.SemanticEngine && SemanticEngine.getCustomText('title:' + t.name)) || '';
      return '<div class="' + cls + '"><div class="n">' + t.icon + ' ' + esc(t.name) + '</div>' +
        '<div class="d">' + esc(t.desc) + '</div><div class="b">' + bonusText(t.bonus) + (custText ? ' · <span style="color:#c9a86a">✎已自定义</span>' : '') + '</div>' + btn + custBtn + '</div>';
    }).join("");
    var head = wornId ? '<div style="font-size:12px;opacity:.8;margin-bottom:10px">当前佩戴：<b style="color:#c9a86a">' + esc(current()) + '</b> ｜ 加成已计入战斗与检定</div>' : '<div style="font-size:12px;opacity:.7;margin-bottom:10px">尚未佩戴称号——满足条件可领取并佩戴，加成即时生效。</div>';
    G.document.getElementById("tsBody").innerHTML = head + '<div class="ts-grid">' + cards + '</div>';
    m.classList.add("show");
  }
  function closeUI() { var m = G.document && G.document.getElementById("tsMask"); if (m) m.classList.remove("show"); }

  function stats() {
    var d = state();
    return { VERSION: VERSION, total: TITLES.length, claimed: Object.keys(d.claimed).length, worn: current(),
      available: available().length, deps: { bonus: !!(G.BonusEngine) } };
  }

  var API = {
    VERSION: VERSION, TITLES: TITLES,
    isUnlocked: isUnlocked, available: available, claim: claim, wear: wear, unwear: unwear,
    current: current, bonusOf: bonusOf, state: state,
    openUI: openUI, closeUI: closeUI, recompute: recompute, stats: stats
  };
  G.TitleSystem = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})();
