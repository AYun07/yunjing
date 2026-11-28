/* =========================================================================
 * 云境 · 统一加成引擎 BonusEngine（v4.49.0）
 * -------------------------------------------------------------------------
 * 用户诉求：「装备词条以及对应加成、增益减益都要即时计算；还要称号系统」
 *
 * 设计红线（DR-013）：
 *   ① 只读叠加，不改原始数值：variables.stats 仍归 AttributeEngine 管（钳制/审计
 *      账本/时间成长全不动）；本层在其之上叠加装备词条 + 称号加成，产出净值。
 *   ② 单一真源：所有加成汇入 netMods()，战斗/检定/prompt 一律读它，杜绝多处各算
 *      一份导致对不上。佩戴/卸下/解锁/切换任一来源变更 → recompute() 重算全量。
 *   ③ 增益与减益都算：词条有 tone=buff/debuff，正值加成、负值减益，净值里同时
 *      保留 sources 明细，面板能逐条回看「谁给了什么、是正是负」。
 *   ④ 世界自适应六维：词条可指向六维语义轴（肉身/感知/心志/谋算/修学/机缘），
 *      经 AttributeEngine.axisOf 反查当前世界的真实属性键后再落净值。
 *   ⑤ 零网络、纯函数、延迟解析依赖：localStorage 仅存玩家手动词条覆盖与快照，
 *      可在 Node vm 沙箱完整回归。
 *
 * 版权：本项目独立编写，词条名与称号均为通用语义词，未引用任何第三方项目词库。
 * ========================================================================= */
(function () {
  "use strict";
  var G = (typeof window !== "undefined") ? window : (typeof globalThis !== "undefined" ? globalThis : {});
  var VERSION = "5.1.0";

  /* ---------- 依赖延迟解析 ---------- */
  function AE() { return G.AttributeEngine || null; }
  function SE() { return G.SemanticEngine || null; } /* v5.0.0 语义词缀引擎 */
  function slot() { try { return (G.storyFramework && G.storyFramework.slotId) || "main"; } catch (e) { return "main"; } }
  function keyOf(base) { return base + "~" + slot(); }

  function lsGet(k, fallback) {
    try {
      var raw = G.localStorage && G.localStorage.getItem(k);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function lsSet(k, v) { try { if (G.localStorage) { G.localStorage.setItem(k, JSON.stringify(v)); return true; } } catch(e){console.warn("[swallowed] bonus-engine",e)} return false; }

  function clamp(n, lo, hi) { n = Number(n); if (!isFinite(n)) n = lo; return n < lo ? lo : (n > hi ? hi : n); }
  function hash(str) {
    var h = 2166136261; str = String(str == null ? "" : str);
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }

  /* =====================================================================
   * 一、词条库（云境原创通用词，分增益/减益）
   *   apply 单位：战斗四维 hp/atk/def/spd 为整数点；atkPct 等为百分比点数；
   *   六维轴 body/sense/mind/wit/learn/luck 为整数点（当前世界真实键上叠加）。
   *   min/max 为生成区间，seed 决定具体值（同装备名恒定）。
   * ===================================================================== */
  var AFFIX_POOL = [
    { id: "sharp",    name: "锋锐",   tone: "buff",   stat: "atk",     min: 2, max: 5,  desc: "攻击提升" },
    { id: "bulwark",  name: "坚壁",   tone: "buff",   stat: "def",     min: 2, max: 5,  desc: "防御提升" },
    { id: "vigor",    name: "健魄",   tone: "buff",   stat: "hp",      min: 6, max: 15, desc: "气血上限提升" },
    { id: "swift",    name: "迅影",   tone: "buff",   stat: "spd",     min: 2, max: 5,  desc: "速度提升" },
    { id: "keen",     name: "会心",   tone: "buff",   stat: "crit",    min: 3, max: 8,  desc: "暴击率提升" },
    { id: "fury",     name: "强攻",   tone: "buff",   stat: "atkPct",  min: 5, max: 12, desc: "攻击百分比提升" },
    { id: "bedrock",  name: "磐石",   tone: "buff",   stat: "defPct",  min: 5, max: 12, desc: "防御百分比提升" },
    { id: "acumen",   name: "锐思",   tone: "buff",   stat: "wit",     min: 1, max: 3,  desc: "谋算轴提升" },
    { id: "insight",  name: "洞察",   tone: "buff",   stat: "sense",   min: 1, max: 3,  desc: "感知轴提升" },
    { id: "resolve",  name: "笃志",   tone: "buff",   stat: "mind",    min: 1, max: 3,  desc: "心志轴提升" },
    { id: "ironbody", name: "锻体",   tone: "buff",   stat: "body",    min: 1, max: 3,  desc: "肉身轴提升" },
    { id: "aptitude", name: "敏学",   tone: "buff",   stat: "learn",   min: 1, max: 3,  desc: "修学轴提升" },
    { id: "fortune",  name: "福缘",   tone: "buff",   stat: "luck",    min: 1, max: 3,  desc: "机缘轴提升" },
    { id: "blunt",    name: "钝锋",   tone: "debuff", stat: "atk",     min: -3, max: -1, desc: "攻击下降" },
    { id: "brittle",  name: "脆甲",   tone: "debuff", stat: "def",     min: -3, max: -1, desc: "防御下降" },
    { id: "sluggish", name: "迟滞",   tone: "debuff", stat: "spd",     min: -3, max: -1, desc: "速度下降" },
    { id: "drain",    name: "耗元",   tone: "debuff", stat: "hp",      min: -12, max: -4, desc: "气血上限下降" }
  ];
  var POOL_BY_ID = {};
  AFFIX_POOL.forEach(function (a) { POOL_BY_ID[a.id] = a; });

  /* 稀有度与 gear-core 同口径（名字关键词启发），决定词条条数：品级越高越多 */
  function rarityOf(name) {
    var s = String(name);
    if (/神|帝|圣|仙|准帝|十万年|异火|皇|本命/.test(s)) return 5;
    if (/灵宝|魂骨|魔核|源石|秘籍|皇级|万年/.test(s)) return 4;
    if (/宝|丹|符|器|魂环|千年/.test(s)) return 3;
    if (/药|石|剑|刀|甲|书|信|币|卡/.test(s)) return 2;
    return 1;
  }
  var AFFIX_COUNT = { 1: 0, 2: 1, 3: 1, 4: 2, 5: 3 }; /* 凡品无词条，逐级递增 */

  function rollValue(a, seed) {
    var span = a.max - a.min;
    var v = a.min + (span > 0 ? (seed % (span + 1)) : 0);
    return v;
  }

  /** 玩家手动词条覆盖：key = 装备名 */
  function overrides() { return lsGet(keyOf("yunjingAffixOverrides"), {}); }
  function setAffixOverride(name, affixes) {
    var o = overrides(); o[String(name)] = affixes || []; lsSet(keyOf("yunjingAffixOverrides"), o); recompute(); return o[String(name)];
  }
  function clearAffixOverride(name) {
    var o = overrides(); delete o[String(name)]; lsSet(keyOf("yunjingAffixOverrides"), o); recompute();
  }

  /**
   * 取某件装备的词条——v5.0.0 语义驱动三级管线：
   *   ① 玩家自定义文本（semantic-engine.setCustom("gear:"+名字)）——特殊说明优先
   *   ② 玩家显式数值覆盖（旧 setAffixOverride，兼容）——同样视为特殊说明
   *   ③ 语义引擎：解读装备名语意 + 结合情境种子动态生成（世界奇妙，什么都可能发生）
   * 引擎未加载时回退旧固定池，老档/降级行为完全不变。
   * @returns {Array<{id,name,tone,stat,value,desc,text}>}
   */
  function affixesFor(item) {
    var name = typeof item === "string" ? item : (item && item.name);
    if (!name) return [];
    var se = SE();

    /* ① 玩家自定义文本（含显式数值声明）——最高优先 */
    if (se && se.customAffixes) {
      var cust = se.customAffixes("gear:" + name, hash(name));
      if (cust.length) return cust;
    }

    /* ② 旧显式数值覆盖（兼容）——玩家早先写的特殊说明继续生效 */
    var ov = overrides()[name];
    if (Array.isArray(ov) && ov.length) {
      return ov.map(function (x) {
        var def = POOL_BY_ID[x.id] || x;
        var val = Number(x.value != null ? x.value : def.value);
        if (!isFinite(val)) val = 0;
        return { id: def.id || x.id, name: def.name || x.name || "词条", tone: def.tone || x.tone || "buff",
          stat: def.stat || x.stat || "atk", value: val, desc: def.desc || "玩家特殊说明", text: (def.name || x.name || "词条") + " " + (val > 0 ? "+" : "") + val };
      }).filter(function (a) { return a.stat && a.value !== 0; });
    }

    /* ③ 语义引擎：装备名语意解读优先（名字即性质，如「剑」→攻击），
       情境动态生成补充到目标条数（世界奇妙，同一件在不同情境可有异象）。 */
    if (se && se.interpret) {
      var ctx = semCtx();
      var r = rarityOf(name);
      var count = AFFIX_COUNT[r] || 0;
      /* 名字本身语意（遣词即性质）——这是词条的主干 */
      var fromName = se.interpret(name, hash(name + "|name")).filter(function (a) { return a.confidence >= 0.5; });
      if (count <= 0) return fromName.slice(0, 1); /* 凡品：仅保留名字的明确语意（弱异象） */
      var out = fromName.slice(0, count);
      /* 情境动态生成补足条数（含骰子/战斗/世界性质，异情境不同） */
      if (out.length < count && se.generate) {
        var gen = se.generate({ genre: ctx.genre, round: ctx.round, diceSeed: ctx.diceSeed,
          inBattle: ctx.inBattle, nature: name, ownerName: name }, count - out.length, name);
        var seen = {};
        out.forEach(function (a) { seen[a.stat] = 1; });
        gen.forEach(function (g) { if (!seen[g.stat] && out.length < count) { out.push(g); seen[g.stat] = 1; } });
      }
      if (out.length) return out;
    }

    /* ④ 回退：旧固定池（引擎缺失时的降级行为） */
    var rr = rarityOf(name);
    var cnt = AFFIX_COUNT[rr] || 0;
    if (cnt <= 0) return [];
    var seed = hash(name);
    var buffs = AFFIX_POOL.filter(function (a) { return a.tone === "buff"; });
    var debuffs = AFFIX_POOL.filter(function (a) { return a.tone === "debuff"; });
    var out = [], used = {};
    var debuffSlots = rr >= 5 ? 1 : (rr === 4 ? (seed % 2) : 0);
    for (var i = 0; i < cnt; i++) {
      var pool, wantDebuff = (i >= cnt - debuffSlots);
      pool = wantDebuff ? debuffs : buffs;
      var pick = pool[(seed + i * 7) % pool.length];
      var tries = 0;
      while (used[pick.id] && tries < pool.length) { pick = pool[(seed + i * 7 + (++tries)) % pool.length]; }
      used[pick.id] = 1;
      var val = rollValue(pick, hash(name + "#" + pick.id));
      out.push({ id: pick.id, name: pick.name, tone: pick.tone, stat: pick.stat, value: val,
        desc: pick.desc, text: pick.name + " " + (val > 0 ? "+" : "") + val + " " + statLabel(pick.stat) });
    }
    return out;
  }

  /** 采集当前情境种子（世界/回合/骰子/战斗状态/世界性质）——供语义引擎动态生成 */
  function semCtx() {
    var v = vars();
    var diceSeed = 0;
    try {
      var hist = G.localStorage && G.localStorage.getItem("storyDiceHistory");
      var arr = hist ? JSON.parse(hist) : [];
      if (arr && arr[0] && arr[0].ts) diceSeed = Number(arr[0].ts) % 100000;
    } catch(e){console.warn("[swallowed] bonus-engine",e)}
    var inBattle = false;
    try {
      var wm = G.WorldExt && G.WorldExt.modState && G.WorldExt.modState("wr_combat");
      inBattle = !!(wm && wm.inBattle);
    } catch(e){console.warn("[swallowed] bonus-engine",e)}
    return {
      genre: (function () { try { return new URLSearchParams(G.location && G.location.search).get("genre") || "free"; } catch (e) { return "free"; } })(),
      round: Number(v.chapter) || 0,
      diceSeed: diceSeed,
      inBattle: inBattle,
      nature: v["世界性质"] || v["世界基调"] || v.worldNature || ""
    };
  }

  function statLabel(stat) {
    return ({ hp: "气血", atk: "攻击", def: "防御", spd: "速度", crit: "暴击", atkPct: "攻击%", defPct: "防御%",
      body: "肉身", sense: "感知", mind: "心志", wit: "谋算", learn: "修学", luck: "机缘" })[stat] || stat;
  }

  /* =====================================================================
   * 二、来源采集：装备（与 gear-core 同源字段）+ 称号（title-system 写入字段）
   * ===================================================================== */
  function vars() { try { return (G.storyFramework && G.storyFramework.storyState && G.storyFramework.storyState.variables) || {}; } catch (e) { return {}; } }

  function equippedNames() {
    var v = vars();
    /* gear-core.read 从这三个字段读佩戴，这里同源；另兼容 WorldExt 模块态里的 equipped */
    var raw = v["装备"] != null ? v["装备"] : (v["穿戴"] != null ? v["穿戴"] : v.equip);
    var names = [];
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      Object.keys(raw).forEach(function (k) { var it = raw[k]; var nm = typeof it === "object" ? (it.name || it.名称) : it; if (nm) names.push(String(nm)); });
    } else if (Array.isArray(raw)) {
      raw.forEach(function (x) { var nm = typeof x === "object" ? (x.name || x.名称) : x; if (nm) names.push(String(nm)); });
    } else if (raw) {
      String(raw).split(/[；;\n、]+/).forEach(function (x) {
        var m = String(x).match(/([^：:]{1,10})[：:]\s*(.+)$/); names.push(m ? m[2].trim() : String(x).trim());
      });
    }
    /* 兼容：WorldExt 挂载的 gear 模块 state（若可读） */
    try {
      var wm = G.WorldExt && G.WorldExt.all && G.WorldExt.all();
      if (wm && wm.gear && wm.gear.equipped) {
        Object.keys(wm.gear.equipped).forEach(function (k) { var it = wm.gear.equipped[k]; if (it && it.name && !it.missing && names.indexOf(it.name) < 0) names.push(it.name); });
      }
    } catch(e){console.warn("[swallowed] bonus-engine",e)}
    return names.filter(Boolean).slice(0, 24);
  }

  function wornTitle() {
    var v = vars();
    return v["称号"] || v.title || v["当前称号"] || "";
  }

  /* 称号加成表：由 title-system 维护权威定义，这里延迟读取；未加载时用内建兜底 */
  var TITLE_FALLBACK = {
    "初露锋芒": { all: 1 },
    "百战之身": { atk: 3, def: 2 },
    "独当一面": { atk: 5, hp: 10 },
    "人中龙凤": { all: 2 },
    "万众瞩目": { crit: 5 },
    "羁绊深厚": { spd: 3, hp: 8 }
  };
  function titleAffixes(name) {
    if (!name) return [];
    var se = SE();
    /* ① 玩家自定义（玩家的特殊说明）——最高优先 */
    if (se && se.customAffixes) {
      var cust = se.customAffixes("title:" + name, hash(name));
      if (cust.length) return cust;
    }
    /* ② 系统权威 bonus 表（称号库是设计者的明确设定，等同「特殊说明」，优先于语意猜测） */
    var TS = G.TitleSystem;
    if (TS && TS.bonusOf) { var b = TS.bonusOf(name); if (b) return normalizeTitleBonus(b, name); }
    var fb = TITLE_FALLBACK[name];
    if (fb) return normalizeTitleBonus(fb, name);
    /* ③ 语义引擎解读语意——无预设的称号（如玩家自创称号）走这里，口径与装备/随行一致 */
    if (se && se.interpret) {
      var sem = se.interpret(name, hash("title|" + name)).filter(function (a) { return a.confidence >= 0.5; });
      if (sem.length) return sem;
    }
    return [];
  }
  function normalizeTitleBonus(b, name) {
    var out = [];
    Object.keys(b).forEach(function (k) {
      var v = Number(b[k]) || 0; if (!v) return;
      if (k === "all") {
        ["body", "sense", "mind", "wit", "learn", "luck"].forEach(function (ax) {
          out.push({ id: "title_all_" + ax, name: name, tone: "buff", stat: ax, value: v, desc: "全维提升", text: name + " +" + v + " " + statLabel(ax) });
        });
      } else {
        out.push({ id: "title_" + k, name: name, tone: "buff", stat: k, value: v, desc: "称号加成", text: name + " " + (v > 0 ? "+" : "") + v + " " + statLabel(k) });
      }
    });
    return out;
  }

  /* =====================================================================
   * 三、净值计算（单一真源）
   * ===================================================================== */
  function emptyNet() {
    return { hp: 0, atk: 0, def: 0, spd: 0, crit: 0, atkPct: 0, defPct: 0,
      axes: {}, stats: {}, sources: [], buffs: [], debuffs: [], equipped: [], title: "" };
  }

  /** 六维语义轴 → 当前世界真实属性键（经 AttributeEngine.axisOf 反查） */
  function axisToStatKey(axisId) {
    var v = vars();
    var stats = v.stats || {};
    var keys = Object.keys(stats).filter(function (k) { return typeof stats[k] === "number"; });
    var engine = AE();
    for (var i = 0; i < keys.length; i++) {
      if (engine && engine.axisOf) {
        try { var ax = engine.axisOf(keys[i], keys[i]); if (ax && ax.id === axisId) return keys[i]; } catch(e){console.warn("[swallowed] bonus-engine",e)}
      }
    }
    /* 兜底：若真实键名恰好就是轴 id */
    if (stats[axisId] != null) return axisId;
    return null;
  }

  /* =====================================================================
   * v5.1.0 大模型双重解读：惰性补充器
   *   本地语素解读是同步即时结果；大模型解读是异步增强。本补充器在加成重算后
   *   防抖触发，把「当前佩戴装备名 / 称号 / 随行特性」中尚未被大模型解读过的
   *   文本交给 SemanticEngine.enrich()；结果写缓存后，下次 interpret() 自动
   *   采用大模型结果并派发 bonus-change —— 因缓存已命中，collectPending 返回
   *   空，补充器自然收敛，不会形成请求循环。无 fetch / 未配置 / 关闭时零请求。
   * ===================================================================== */
  var enrichTimer = null, enriching = false;
  function collectPendingTexts() {
    var se = SE();
    if (!se || !se.llmEnabled || !se.llmEnabled() || !se.llmGet) return [];
    var texts = [], seen = {};
    function add(t) {
      t = String(t == null ? "" : t).trim();
      if (!t || seen[t]) return;
      seen[t] = 1;
      if (se.llmGet(t)) return;                                   /* 已有有效缓存 */
      if (se.parseExplicit && se.parseExplicit(t).found) return;  /* 显式声明无需大模型 */
      texts.push(t);
    }
    try {
      equippedNames().forEach(add);
      add(wornTitle());
      var bs = G.BeastSystem;
      if (bs && bs.all) (bs.all() || []).forEach(function (b) {
        add(b && b.trait);
        var sk = (b && b.skills) || [];
        for (var i = 0; i < sk.length; i++) add(sk[i]);
      });
    } catch(e){console.warn("[swallowed] bonus-engine",e)}
    return texts.slice(0, 8);
  }
  /** 防抖调度大模型补充解读；delay 默认 400ms。返回是否真的排了队。 */
  function scheduleEnrich(delay) {
    var se = SE();
    if (!se || !se.enrich || typeof G.fetch !== "function") return false;  /* Node/离线：纯本地 */
    if (typeof G.setTimeout !== "function") return false;
    if (enrichTimer) { try { G.clearTimeout(enrichTimer); } catch(e){console.warn("[swallowed] bonus-engine",e)} }
    enrichTimer = G.setTimeout(function () {
      enrichTimer = null;
      if (enriching) return;
      var pending = collectPendingTexts();
      if (!pending.length) return;
      enriching = true;
      try {
        var p = se.enrich(pending);
        if (p && typeof p.then === "function") {
          p.then(function () { enriching = false; }, function () { enriching = false; });
        } else enriching = false;
      } catch (e) { enriching = false; }
    }, delay == null ? 400 : delay);
    return true;
  }
  /** 立即触发一次（面板打开/玩家点「深度解读」时用） */
  function enrichNow() {
    var se = SE();
    if (!se || !se.enrich || typeof G.fetch !== "function") return Promise.resolve({ source: "unavailable" });
    var pending = collectPendingTexts();
    if (!pending.length) return Promise.resolve({ source: "cached", done: 0 });
    return se.enrich(pending, { force: false });
  }

  var CACHE = emptyNet();
  /* v7.6.4：silent=true 时只重算快照、不派发 yj:bonus-change。
     渲染路径/提示词构建调用重算仅为取值，若派发事件会被 story-status-renderer 再次监听重绘，
     而重绘又调 recompute → 无限递归栈溢出。装备/称号真实变更仍走无参调用保留即时反馈。 */
  function recompute(silent) {
    var net = emptyNet();
    var names = equippedNames();
    net.equipped = names.slice();
    var title = wornTitle();
    net.title = title;
    var all = [];
    names.forEach(function (nm) {
      affixesFor(nm).forEach(function (a) { all.push({ affix: a, from: nm, kind: "gear" }); });
    });
    titleAffixes(title).forEach(function (a) { all.push({ affix: a, from: title, kind: "title" }); });

    all.forEach(function (entry) {
      var a = entry.affix, stat = a.stat, val = Number(a.value) || 0;
      var src = { from: entry.from, kind: entry.kind, name: a.name, tone: a.tone, stat: stat, value: val, text: a.text,
        source: a.source || "semantic", by: a.by || "" };
      if (val >= 0) net.buffs.push(src); else net.debuffs.push(src);
      net.sources.push(src);
      if (stat === "hp" || stat === "atk" || stat === "def" || stat === "spd" || stat === "crit" || stat === "atkPct" || stat === "defPct") {
        net[stat] = Math.round((net[stat] + val) * 10) / 10;
      } else if (["body", "sense", "mind", "wit", "learn", "luck"].indexOf(stat) >= 0) {
        net.axes[stat] = Math.round(((net.axes[stat] || 0) + val) * 10) / 10;
        var realKey = axisToStatKey(stat);
        if (realKey) net.stats[realKey] = Math.round(((net.stats[realKey] || 0) + val) * 10) / 10;
      }
    });
    CACHE = net;
    /* 派发即时反馈：状态栏/面板据此闪动刷新（silent 时跳过，断开渲染路径递归） */
    if (!silent) {
      try {
        if (G.dispatchEvent) {
          var Ctor = G.CustomEvent || G.Event;
          G.dispatchEvent(new Ctor("yj:bonus-change", { bubbles: false, detail: { net: net } }));
        }
      } catch(e){console.warn("[swallowed] bonus-engine",e)}
    }
    lsSet(keyOf("yunjingBonusSnapshot"), {
      at: Date.now(), hp: net.hp, atk: net.atk, def: net.def, spd: net.spd, crit: net.crit,
      atkPct: net.atkPct, defPct: net.defPct, axes: net.axes, stats: net.stats, title: net.title,
      sources: net.sources.map(function (s) { return { from: s.from, text: s.text, tone: s.tone, source: s.source, by: s.by }; })
    });
    /* v5.1.0：惰性触发大模型补充解读（无 fetch/未配置/关闭时内部直接跳过，零开销） */
    scheduleEnrich();
    return net;
  }
  function netMods() { return CACHE; }
  function refresh() { return recompute(); }

  /** 战斗修正（给 WRCombat 读）：扁平化净值 */
  function combatMods() {
    var n = netMods();
    return { hp: n.hp || 0, atk: n.atk || 0, def: n.def || 0, spd: n.spd || 0,
      crit: n.crit || 0, atkPct: n.atkPct || 0, defPct: n.defPct || 0 };
  }

  /** 有效六维（给 ActionCheck/检定读）：原始 stats + 六维轴加成，不写回原对象 */
  function effectiveStats() {
    var v = vars();
    var base = v.stats || {};
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    var n = netMods();
    Object.keys(n.stats || {}).forEach(function (k) {
      out[k] = Math.round(((Number(out[k]) || 0) + n.stats[k]) * 10) / 10;
      out[k] = clamp(out[k], 0, 100);
    });
    return out;
  }

  /** 人类可读的净加成摘要（面板用） */
  function describe() {
    var n = netMods();
    var parts = [];
    ["hp", "atk", "def", "spd", "crit", "atkPct", "defPct"].forEach(function (k) {
      if (n[k]) parts.push(statLabel(k) + " " + (n[k] > 0 ? "+" : "") + n[k]);
    });
    Object.keys(n.axes || {}).forEach(function (ax) {
      if (n.axes[ax]) parts.push(statLabel(ax) + " " + (n.axes[ax] > 0 ? "+" : "") + n.axes[ax]);
    });
    return parts.length ? parts.join(" / ") : "无加成";
  }

  /** prompt 注入块：让主笔知道当前佩戴与净加成（增益/减益都在） */
  function buildPromptBlock() {
    var n = netMods();
    if (!n.equipped.length && !n.title) return "";
    var lines = ["【当前加成（装备词条 + 称号，引擎即时结算，行文须与之一致）】"];
    var seg = [];
    if (n.title) seg.push("称号「" + n.title + "」");
    if (n.equipped.length) seg.push("佩戴：" + n.equipped.join("、"));
    lines.push(seg.join("；"));
    if (n.buffs.length) lines.push("增益：" + n.buffs.map(function (s) { return s.text; }).join("、"));
    if (n.debuffs.length) lines.push("减益：" + n.debuffs.map(function (s) { return s.text; }).join("、"));
    /* v5.1.0：标注大模型深度解读的来源，行文可据此把该词条演绎得更贴切 */
    var llm = (n.buffs || []).concat(n.debuffs || []).filter(function (s) { return s.source === "llm"; });
    if (llm.length) lines.push("深度解读（大模型语意）：" + llm.map(function (s) { return s.text + "［" + (s.by || "大模型") + "］"; }).join("、"));
    lines.push("净效应：" + describe());
    return lines.join("\n");
  }

  function stats() {
    var n = netMods();
    var se = SE();
    var llmCount = (n.sources || []).filter(function (s) { return s.source === "llm"; }).length;
    return { VERSION: VERSION, sources: n.sources.length, buffs: n.buffs.length, debuffs: n.debuffs.length,
      equipped: n.equipped.length, title: n.title, llmSources: llmCount,
      deps: { attr: !!AE(), semantic: !!SE(), title: !!G.TitleSystem,
        llm: !!(se && se.llmEnabled && se.llmEnabled()) } };
  }

  var API = {
    VERSION: VERSION,
    AFFIX_POOL: AFFIX_POOL,
    affixesFor: affixesFor,
    setAffixOverride: setAffixOverride,
    clearAffixOverride: clearAffixOverride,
    rarityOf: rarityOf,
    statLabel: statLabel,
    recompute: recompute,
    refresh: refresh,
    netMods: netMods,
    combatMods: combatMods,
    effectiveStats: effectiveStats,
    describe: describe,
    buildPromptBlock: buildPromptBlock,
    stats: stats,
    /* v5.0.0：语义词缀自定义便捷入口（转发到 SemanticEngine） */
    customAffix: function (target, text) {
      var se = SE(); if (!se) return false;
      if (text == null) { se.clearCustom(target); recompute(); return true; }
      se.setCustom(target, text); recompute(); return true;
    },
    /* v5.0.0：任意目标的语义词缀预览（UI 实时展示语意解读结果） */
    preview: function (text, seed) { var se = SE(); return se ? se.interpret(text, seed) : []; },
    /* v5.1.0：大模型双重解读 */
    enrichNow: enrichNow,
    scheduleEnrich: scheduleEnrich,
    collectPendingTexts: collectPendingTexts,
    openAffixEditor: openAffixEditor
  };

  /* =====================================================================
   * v5.0.0 通用语义词缀编辑器 UI
   *   任意系统（装备/称号/随行）均可调用，给任意 target 写词条文本：
   *   —— 玩家写的每一句都会被解读成语意加成，显式数值声明优先覆盖。
   * ===================================================================== */
  function openAffixEditor(target, opts) {
    var se = SE();
    if (!se || !G.document || !G.document.body) return;
    opts = opts || {};
    var title = opts.title || "✦ 自定义词条";
    var current = se.getCustomText(target) || "";
    var hostId = "semAffixMask";
    var mask = G.document.getElementById(hostId);
    if (!mask) {
      mask = G.document.createElement("div"); mask.id = hostId;
      mask.setAttribute("style", "position:fixed;inset:0;z-index:130;background:rgba(8,12,20,.66);display:flex;align-items:center;justify-content:center;padding:16px");
      mask.innerHTML = '<div style="width:min(480px,94vw);max-height:86vh;overflow:auto;background:#11161f;border:1px solid rgba(201,168,106,.4);border-radius:16px;padding:18px 20px;color:#e9eef5;font-family:inherit">' +
        '<div style="display:flex;align-items:center;margin-bottom:12px"><h3 id="semAffixTitle" style="flex:1;margin:0;font-size:16px"></h3>' +
        '<button onclick="BonusEngine.closeAffixEditor()" style="background:none;border:none;color:inherit;font-size:20px;opacity:.7;cursor:pointer">✕</button></div>' +
        '<div style="font-size:11.5px;opacity:.75;line-height:1.7;margin-bottom:8px">写下任意词条，引擎按<b>语意</b>附加效果；也可写显式数值（如「锋锐 +9攻击」「坚壁 防御-3」）直接指定。</div>' +
        '<textarea id="semAffixText" rows="3" style="width:100%;box-sizing:border-box;background:rgba(0,0,0,.3);border:1px solid rgba(201,168,106,.3);border-radius:10px;color:#e8dcc0;padding:9px 11px;font-size:13px;font-family:inherit;outline:none;resize:vertical"></textarea>' +
        '<div id="semAffixPreview" style="font-size:11.5px;line-height:1.9;margin:10px 0;min-height:26px"></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button onclick="BonusEngine.saveAffixEditor()" style="flex:1;padding:8px;border-radius:9px;border:1px solid rgba(201,168,106,.5);background:rgba(201,168,106,.18);color:#e8dcc0;cursor:pointer;font-size:12.5px">保存并结算</button>' +
        '<button onclick="BonusEngine.clearAffixEditor()" style="padding:8px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:inherit;cursor:pointer;font-size:12px">清除</button>' +
        '<button onclick="BonusEngine.closeAffixEditor()" style="padding:8px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:none;color:inherit;cursor:pointer;font-size:12px">取消</button></div></div>';
      mask.addEventListener("click", function (e) { if (e.target === mask) G.BonusEngine.closeAffixEditor(); });
      G.document.body.appendChild(mask);
    }
    G.document.getElementById("semAffixTitle").textContent = title;
    var ta = G.document.getElementById("semAffixText");
    ta.value = current;
    ta.oninput = function () { renderPreview(ta.value); };
    API._editTarget = target;
    renderPreview(current);
    mask.style.display = "flex";
    ta.focus();
  }
  function renderPreview(text) {
    var host = G.document && G.document.getElementById("semAffixPreview");
    if (!host) return;
    if (!text || !text.trim()) { host.innerHTML = '<span style="opacity:.6">尚未写下词条——留空保存即恢复自动语意生成。</span>'; return; }
    var lines = String(text).split(/[；;\n、]+/).map(function (x) { return x.trim(); }).filter(Boolean);
    var html = lines.map(function (line) {
      var afs = API.preview(line);
      if (!afs.length) return "<div>" + esc(line) + " → <span style='opacity:.6'>（无法解读）</span></div>";
      return "<div>" + esc(line) + " → " + afs.map(function (a) {
        return "<b style='color:" + (a.value < 0 ? "#e07070" : "#8fd9a8") + "'>" + esc(a.text) + "</b>";
      }).join("、") + "</div>";
    }).join("");
    host.innerHTML = html;
  }
  function saveAffixEditor() {
    var ta = G.document && G.document.getElementById("semAffixText");
    if (!ta || !API._editTarget) return;
    API.customAffix(API._editTarget, ta.value);
    API.closeAffixEditor();
    try { if (G.showToast) G.showToast("词条已按语意结算，加成已更新", "success"); } catch(e){console.warn("[swallowed] bonus-engine",e)}
    try {
      var body = G.document.getElementById("immBody");
      if (body && G.WorldExt && G.WorldExt.panelHTML) body.innerHTML = G.WorldExt.panelHTML();
    } catch(e){console.warn("[swallowed] bonus-engine",e)}
  }
  function clearAffixEditor() {
    if (!API._editTarget) return;
    API.customAffix(API._editTarget, null);
    API.closeAffixEditor();
    try { if (G.showToast) G.showToast("已清除自定义，恢复自动语意生成"); } catch(e){console.warn("[swallowed] bonus-engine",e)}
  }
  function closeAffixEditor() {
    var mask = G.document && G.document.getElementById("semAffixMask");
    if (mask) mask.style.display = "none";
    API._editTarget = null;
  }
  /* 把 UI 控制函数挂到 API（供内联 onclick 调用） */
  API.saveAffixEditor = saveAffixEditor;
  API.clearAffixEditor = clearAffixEditor;
  API.closeAffixEditor = closeAffixEditor;
  G.BonusEngine = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})();
