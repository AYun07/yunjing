/* 云境 v4.08.0 · 引擎真值快照（truth snapshot）
 *
 * 动机
 * ----
 * 防幻觉判定长期停在「规则式」：正文里出现一个地名/势力名/数值，就去静态名单里查，
 * 没查到就报幻觉。这条路有结构性缺陷：
 *
 *   ① 静态名单永远追不上运行时真值。玩家本轮刚自建「灰烬同盟」、刚接了委托、
 *      刚打出了掉落物——这些**此刻确实存在**的东西不在名单里 → 误报。
 *   ② 静态名单永远含不全合法专名。知识库正文里出现过的名字，名单未必收录 → 误报。
 *   ③ 单轮判定看不出**倒退**：上一轮正文说 Lv.3，这一轮引擎里仍是 Lv.3，
 *      正文却写 Lv.1 —— 这是幻觉，但任何单轮快照都判不出来。
 *
 * 本模块提供判定器需要的三个真值来源：
 *
 *   A. 引擎真值快照（snapshot）
 *      把「当前界所有模块状态 + 引擎数值 + 运行时派生事实」压平成一张
 *      {path: value} 表。两张快照逐项相减 = 本轮真实发生的变化（差分）。
 *
 *   B. 合法名表（legalNames）
 *      把静态名单（地图节点 / 知识库条目 / 世界书 / 势力表）与**运行时新增实体**
 *      （玩家自建势力、NPC 名字、已接委托标题、已获物品）合并，
 *      保证「本轮真实存在的东西」一定合法。
 *
 *   C. 跨轮次一致性（history / consistency）
 *      记录历轮正文里出现过的等级/金币/委托进度，检测倒退与无依据跳变。
 *
 * 设计约束
 * --------
 * · 纯前端、无构建、零依赖。
 * · 快照必须是**可序列化**的（localStorage 里只存 JSON），不得含函数/循环引用。
 * · 采集失败不得抛异常打断主流程——快照是诊断设施，不能反过来成为故障源。
 */
(function () {
  "use strict";

  var VERSION = "v4.08.0";
  /* 快照里最多保留多少条历史轮次。超出的部分丢弃——快照是诊断设施，
     不是存档，不该无限增长（否则它自己就成了长时运行的一个泄漏点）。 */
  var MAX_HISTORY = 24;

  /* ── 通用工具 ─────────────────────────────────────────────── */

  function safe(fn, dflt) {
    try { var v = fn(); return v === undefined ? dflt : v; }
    catch (e) { return dflt; }
  }

  function isPlainObj(v) {
    return !!v && typeof v === "object" && !Array.isArray(v) &&
      Object.prototype.toString.call(v) === "[object Object]";
  }

  /* 把任意值压平成 {路径: 标量} 表。
   * 数组按下标展开（st.quests.offers[0].gold → "quests.offers[0].gold"），
   * 对象按 key 展开，函数/循环引用直接跳过。
   * 深度上限 6 层，防止深层嵌套把快照撑爆。 */
  function flatten(obj, prefix, out, depth) {
    depth = depth || 0;
    if (depth > 6 || out === null || out === undefined) return out;
    if (Array.isArray(obj)) {
      for (var i = 0; i < obj.length && i < 200; i++) {
        var ip = prefix + "[" + i + "]";
        var it = obj[i];
        if (it === null || it === undefined) continue;
        if (typeof it === "object") {
          var before = Object.keys(out).length;
          flatten(it, ip, out, depth + 1);
          // 空对象也要留痕（否则「有这条记录」与「没这条记录」在差分里无法区分）
          if (Object.keys(out).length === before) out[ip] = "∅";
        } else if (typeof it !== "function") {
          out[ip] = it;
        }
      }
      return out;
    }
    if (isPlainObj(obj)) {
      var keys = Object.keys(obj);
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        var v = obj[key];
        if (v === null || v === undefined) continue;
        if (typeof v === "function") continue;
        var p = prefix ? prefix + "." + key : key;
        if (typeof v === "object") {
          var b2 = Object.keys(out).length;
          flatten(v, p, out, depth + 1);
          if (Object.keys(out).length === b2) out[p] = "∅";
        } else {
          out[p] = v;
        }
      }
      return out;
    }
    if (prefix) out[prefix] = obj;
    return out;
  }

  function diffMaps(a, b) {
    var res = { added: {}, changed: {}, removed: {} };
    var ka = a || {}, kb = b || {};
    var key;
    for (key in kb) {
      if (!Object.prototype.hasOwnProperty.call(kb, key)) continue;
      if (!(key in ka)) { res.added[key] = kb[key]; continue; }
      var va = ka[key], vb = kb[key];
      if (typeof va === "number" && typeof vb === "number") {
        if (va !== vb) res.changed[key] = { from: va, to: vb, delta: +(vb - va).toFixed(4) };
      } else if (String(va) !== String(vb)) {
        res.changed[key] = { from: va, to: vb };
      }
    }
    for (key in ka) {
      if (!Object.prototype.hasOwnProperty.call(ka, key)) continue;
      if (!(key in kb)) res.removed[key] = ka[key];
    }
    return res;
  }

  /* ── A. 引擎真值快照 ───────────────────────────────────────── */

  /* 采集本界所有模块的状态。模块清单来自 WorldExt.moduleList()，
     状态从 WorldExt.modState(id) 取——这是引擎自己的真值，不做任何加工。 */
  function collectModules() {
    var out = {};
    var list = safe(function () { return window.WorldExt && window.WorldExt.moduleList ? window.WorldExt.moduleList() : []; }, []);
    for (var i = 0; i < (list || []).length; i++) {
      var id = list[i].id;
      if (!id) continue;
      var st = safe(function () {
        var m = window.WorldExt.modState(id);
        return m && m.state ? m.state : null;
      }, null);
      if (st) out[id] = st;
    }
    /* 实体引擎（恩怨/关系/人物档案）——独立于模块清单，但同样是引擎真值 */
    var ent = safe(function () {
      return window.WorldExt && window.WorldExt.entState ? window.WorldExt.entState() : null;
    }, null);
    if (ent) out.__ent = ent;
    return out;
  }

  /* 引擎数值真值：等级/金币/声望/经验/血蓝/委托等「玩家面板上真实存在的量」。
   * 这些是正文里最容易被编造的数值（金币、等级、委托进度），必须能被差分。 */
  function collectEngineNumbers(genre) {
    var nums = {};
    var st = safe(function () {
      var w = window.WorldExt && window.WorldExt.modState ? window.WorldExt.modState("wr_rpg") : null;
      return w && w.state ? w.state : null;
    }, null);
    if (!st) return nums;
    var simple = ["lv", "exp", "gold", "rep", "points", "kills", "round", "hp", "mp",
      "worldDay", "worldTurn", "arenaWins", "arenaLoss", "arenaStreak", "arenaBest",
      "enhSeq", "mapIdx"];
    for (var i = 0; i < simple.length; i++) {
      var k = simple[i];
      if (typeof st[k] === "number") nums[k] = st[k];
    }
    if (st.goldTrail) nums.goldTrail = (st.goldTrail || []).slice();
    if (st.actLog) nums.actLog = (st.actLog || []).slice();
    /* 派生上限：血条/蓝条上限、升级所需经验——正文常写这些（引擎真值，非编造） */
    nums.derived = safe(function () {
      var d = window.RPGCore && window.RPGCore.Engine && window.RPGCore.Engine.derive
        ? window.RPGCore.Engine.derive(st) : null;
      var e = window.RPGCore && window.RPGCore.Engine && window.RPGCore.Engine.expToNext
        ? window.RPGCore.Engine.expToNext(st.lv) : null;
      return { maxHp: d && d.maxHp, maxMp: d && d.maxMp, expNext: e };
    }, {});
    /* 委托：在手 + 面板可见的全部委托（id/标题/进度/报酬/期限）。
       注意保留合并口径——判定器的 _gold_allow（报酬）与 _prog_pairs（进度对）都读它。 */
    nums.quests = safe(function () {
      var q = (st.quests && st.quests.offers || []).concat(st.quests && st.quests.active || []);
      return q.map(function (x) {
        return { id: x.id, title: x.title, cur: x.cur, need: x.need, gold: x.gold, due: x.due, place: x.place };
      });
    }, []);
    /* v4.08.0 修测试器 D-27 同类缺陷：offers（可接）与 active（进行中）混成一个数组，
       测试脚本 @active0 取 nums.quests[0] 拿到的是 offers 第一条（讨伐霜狼），
       而玩家真正接的是 active 里的「悬赏·缉拿雷阵守卫」，
       于是 qturnin 传错 id → 引擎返回「没有这条进行中的委托」→ 交付动作从未真跑，
       模型在没有结算依据下整段脑补报酬（金币 x100 / 58+100=158 / 金币剩余 28）。
       这里单独导出**进行中委托**，交付类动作必须只认它。 */
    nums.activeQuests = safe(function () {
      var a = (st.quests && st.quests.active) || [];
      return a.map(function (x) {
        return { id: x.id, title: x.title, cur: x.cur, need: x.need, gold: x.gold, due: x.due, place: x.place };
      });
    }, []);
    /* 可接委托（面板候选）：接委托动作只认它，与 activeQuests 严格分流 */
    nums.questOffers = safe(function () {
      var o = (st.quests && st.quests.offers) || [];
      return o.map(function (x) {
        return { id: x.id, title: x.title, cur: x.cur, need: x.need, gold: x.gold, due: x.due, place: x.place };
      });
    }, []);
    /* 玩家自建势力：运行时真值——正文提到它是合法的 */
    nums.guild = safe(function () {
      return st.guild && st.guild.name ? { name: st.guild.name, level: st.guild.level, contrib: st.guild.contrib } : null;
    }, null);
    /* 世界阶段（v4.08.0 补 D-35 的真值缺口）：
       世界阶段是独立于 RPG 引擎的一套真值（WorldStage 模块，wr_stage），
       它的「当前阶段/总阶段数」会作为「N/3」形态出现在正文里。
       此前快照不采集它 → 判定器把合法的「第 1/3 阶段」当成编造进度（假阳性）。
       与 RPG 模块无关，必须单独取。 */
    nums.stage = safe(function () {
      var cur = (window.WorldStage && window.WorldStage.current) ? Number(window.WorldStage.current()) : null;
      if (!cur) return null;
      var total = null;
      try {
        var sw = window.WorldStage && window.WorldStage.data && window.WorldStage.data[genre];
        if (sw && sw.st && sw.st.length) total = sw.st.length;
      } catch (e) { }
      return { current: cur, total: total };
    }, null);
    return nums;
  }

  /* 当前界标识：URL query > storyFramework.config > free。
     统一在这里取一次，避免各处各算一遍导致不一致。 */
  function currentGenre() {
    return safe(function () {
      var q = (new URLSearchParams(location.search || "") || {}).get("genre");
      if (q) return q;
      var c = window.storyFramework && window.storyFramework.config;
      if (c) return c.genreKey || c.genre || c.id || "";
      return "free";
    }, "free");
  }

  function snapshot() {
    var genre = currentGenre();
    var mods = collectModules();
    var flat = flatten(mods, "", {}, 0);
    var nums = collectEngineNumbers(genre);
    var numsFlat = flatten(nums, "", {}, 0);
    for (var k in numsFlat) flat["$" + k] = numsFlat[k];
    return {
      v: VERSION,
      genre: genre,
      slot: safe(function () {
        return window.SlotRegistry && window.SlotRegistry.slotId ? window.SlotRegistry.slotId() : "main";
      }, "main"),
      t: Date.now(),
      /* 扁平表：可直接逐项 diff */
      flat: flat,
      /* 结构化数值：判定器直接消费 */
      nums: nums,
      /* 模块 id 列表：差分时能区分「模块新增」与「字段新增」 */
      modules: Object.keys(mods)
    };
  }

  /* ── B. 合法名表 ───────────────────────────────────────────── */

  /* 把知识库全文也纳入「合法文本」兜底：知识库里出现过的专名一定合法。
   * 上一版判定器只在势力上做子串兜底，这版把**所有类别**都纳入。 */
  function collectKBText(genre) {
    var kb = "";
    safe(function () {
      var K = (window.KB_PRESETS && window.KB_PRESETS[genre]) || [];
      for (var i = 0; i < K.length && i < 6000; i++) {
        kb += String(K[i].title || "") + " " + String(K[i].content || "") + "\n";
      }
    });
    return kb.slice(0, 600000);
  }

  function collectStaticNames(genre) {
    var out = { places: [], factions: [], people: [], items: [], texts: [] };
    safe(function () {
      var A = window.ATLAS_DATA && window.ATLAS_DATA[genre];
      if (A) (A.layers || []).forEach(function (L) {
        (L.nodes || []).forEach(function (n) {
          out.places.push(n.n);
          (n.aliases || []).forEach(function (x) { out.places.push(x); });
          if (n.desc) out.texts.push(String(n.desc));
        });
      });
    });
    safe(function () {
      var W = window.RPGCore && window.RPGCore.WORLD && window.RPGCore.WORLD[genre];
      if (W) {
        (W.factions || []).forEach(function (f) { out.factions.push(f.n || f); });
        (W.monsters || []).forEach(function (m) { out.items.push(m); });
        (W.materials || []).forEach(function (m) { out.items.push(m); });
        (W.classes || []).forEach(function (c) { out.items.push(c); });
        (W.hidden || []).forEach(function (c) { out.people.push(c.n); });
        (W.maps || []).forEach(function (m) { out.places.push(m.n || m); });
      }
    });
    safe(function () {
      var N = window.KB_NAMES && window.KB_NAMES[genre];
      if (N) {
        (N.places || []).forEach(function (x) { out.places.push(x); });
        (N.factions || []).forEach(function (x) { out.factions.push(x); });
        (N.arts || []).forEach(function (x) { out.items.push(x); });
        (N.people || []).forEach(function (x) { out.people.push(x); });
      }
    });
    /* 知识库条目标题里的专名（按「类别·专名」结构取末段） */
    safe(function () {
      var K = (window.KB_PRESETS && window.KB_PRESETS[genre]) || [];
      for (var i = 0; i < K.length && i < 6000; i++) {
        var t = String(K[i].title || "");
        var parts = t.split("·");
        if (parts.length >= 3) {
          var last = parts[parts.length - 1] || "";
          if (!last) continue;
          if (/人物|角色|NPC/i.test(parts[1])) out.people.push(last);
          else if (/势力|组织|门派|家族/i.test(parts[1])) out.factions.push(last);
          else if (/物品|功法|技能|装备/i.test(parts[1])) out.items.push(last);
          else out.places.push(last);
        }
      }
    });
    return out;
  }

  /* 运行时真值名字：本轮**确实存在**的东西。
   * 玩家自建势力、已接委托标题、当前地点、背包物品、NPC 名——
   * 这些上一版判定器完全看不到，于是把玩家真实行为误判成「AI 编造」。 */
  function collectRuntimeNames(genre) {
    var out = { places: [], factions: [], people: [], items: [], titles: [] };
    safe(function () {
      var w = window.WorldExt && window.WorldExt.modState ? window.WorldExt.modState("wr_rpg") : null;
      var st = w && w.state;
      if (!st) return;
      if (st.guild && st.guild.name) out.factions.push(st.guild.name);
      if (st.map) out.places.push(st.map);
      if (st.zone) out.places.push(st.zone);
      (st.bag || []).forEach(function (b) { if (b && b.n) out.items.push(b.n); });
      (st.buffs || []).forEach(function (b) { if (b && b.n) out.items.push(b.n); });
      var q = (st.quests && st.quests.offers || []).concat(st.quests && st.quests.active || []);
      q.forEach(function (x) {
        if (x && x.title) out.titles.push(x.title);
        if (x && x.place) out.places.push(x.place);
        if (x && x.foe) out.people.push(x.foe);
      });
    });
    /* 实体引擎里的人名 / 关系名 */
    safe(function () {
      var ent = window.WorldExt && window.WorldExt.entState ? window.WorldExt.entState() : null;
      if (!ent) return;
      (ent.characters || []).forEach(function (c) {
        var n = c && (c.name || c.n);
        if (n) out.people.push(n);
      });
      (ent.factions || []).forEach(function (f) {
        var n = f && (f.name || f.n);
        if (n) out.factions.push(n);
      });
      (ent.places || []).forEach(function (p) {
        var n = p && (p.name || p.n);
        if (n) out.places.push(n);
      });
    });
    /* 世界时钟/活世界里的活跃势力名 */
    safe(function () {
      var alive = window.WorldAlive && window.WorldAlive._mem ? window.WorldAlive._mem : null;
      if (alive && alive.factions) {
        Object.keys(alive.factions).forEach(function (k) { out.factions.push(k); });
      }
    });
    return out;
  }

  function legalNames(genre) {
    var st = collectStaticNames(genre);
    var rt = collectRuntimeNames(genre);
    function merge(a, b) {
      var seen = {}, out = [];
      (a || []).concat(b || []).forEach(function (x) {
        x = String(x || "").trim();
        if (!x || x.length > 40) return;
        if (seen[x]) return;
        seen[x] = 1; out.push(x);
      });
      return out;
    }
    return {
      places: merge(st.places, rt.places),
      factions: merge(st.factions, rt.factions),
      people: merge(st.people, rt.people),
      items: merge(st.items, rt.items),
      titles: merge(st.titles, []),
      kbText: collectKBText(genre)
    };
  }

  /* ── C. 跨轮次一致性 ───────────────────────────────────────── */

  var history = [];   // [{ t, genre, nums: {lv,gold,...}, claims: {lv:[],gold:[]} }]

  /* 记录本轮正文里「模型声称的数值」，用于下一轮做倒退检测。
   * claims 由判定器解析正文得到，模块只负责存取。 */
  function pushTurn(genre, nums, claims) {
    history.push({
      t: Date.now(),
      genre: genre || "",
      nums: nums || {},
      claims: claims || {}
    });
    if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
  }

  function turns() { return history.slice(); }
  function clearTurns() { history.length = 0; }

  /* ── 导出 ──────────────────────────────────────────────────── */

  var API = {
    version: VERSION,
    snapshot: snapshot,
    diff: diffMaps,
    legalNames: legalNames,
    collectKBText: collectKBText,
    collectRuntimeNames: collectRuntimeNames,
    pushTurn: pushTurn,
    turns: turns,
    clearTurns: clearTurns,
    flatten: flatten,
    _history: history
  };

  window.TruthSnapshot = API;
  try {
    if (window.storyFramework && window.storyFramework.debugVersion) {
      /* 与主版本号同源，避免两处漂移 */
    }
  } catch (e) { }
})();
