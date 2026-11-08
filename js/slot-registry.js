/* =============================================================================
 * 云境 v4.08.0 · 存档键统一注册表（slot-registry）
 * -----------------------------------------------------------------------------
 * 背景（v4.07.2 遗留的未闭环项「多存档槽隔离从未跨槽验证」）：
 *   全项目有 20+ 处模块各自拼 localStorage 键名，拼接规则**各不相同**：
 *     · worldExt_{genre}{suffix}          suffix = '' | '~{slotId}'
 *     · yunjingWorldBook:{genre}{suffix}
 *     · yunjingBeasts~{slotId}             主档也是 '~main'（不是裸键！）
 *     · yunjingWorldRuntime~{slotId}~{genre}   ← 槽位在**中间**
 *     · yunjingCanonLedger:{slotId}:{genre}    ← 分隔符是 ':'
 *     · yunjing.clock.{slotId}~{genre}         ← 分隔符是 '.'
 *   于是「删档」时那份手写的孤儿键清理表按 `k + suffix` 统一拼接，
 *   对上面第 3~6 类键**全部拼错**，删档后数据残留；
 *   切档时又没有统一入口把各模块内存态刷盘 → 切回来丢进度。
 *
 * 本模块的作用：把「键名怎么拼」和「这个槽位名下有哪些键」收敛到一处，
 *   ① SlotRegistry.genre()   —— 唯一的界标识来源（修掉 canon-ledger 恒为 default）
 *   ② SlotRegistry.slotId()  —— 唯一的槽位来源
 *   ③ SlotRegistry.suffix()  —— 统一的后缀规则
 *   ④ SlotRegistry.keysOf()  —— 枚举某槽位名下的**全部** localStorage 键
 *   ⑤ SlotRegistry.purge()   —— 一键清空某槽位（含跨分隔符格式）
 *   ⑥ SlotRegistry.scoped()  —— 给「原本没做槽隔离」的模块补隔离（带旧键迁移）
 *   ⑦ SlotRegistry.claimLegacy() —— 旧共享键的一次性归属（不再反向摧毁主档）
 *
 * 兼容原则：主档一律使用**裸键**（老玩家零迁移）；副档使用 '~{slotId}' 后缀。
 * ============================================================================= */
(function (global) {
  "use strict";

  /* ---------------------------------------------------------------- 基础取源 */

  /** 当前界标识。优先级：URL query（世界页显式指定）> storyFramework.config.genreKey > free */
  function genre() {
    try {
      var q = new URLSearchParams(location.search).get("genre");
      if (q) return q;
    } catch (e) {}
    try {
      var fw = global.storyFramework;
      var cfg = fw && fw.config;
      var g = cfg && (cfg.genreKey || cfg.genre || cfg.id);
      if (g) return g;
    } catch (e) {}
    try {
      if (global.WorldExt && global.WorldExt.genre) return global.WorldExt.genre;
    } catch (e) {}
    return "free";
  }

  /** 当前槽位 id。主档为 'main'。 */
  function slotId() {
    try {
      var fw = global.storyFramework;
      if (fw && fw.slotId) return fw.slotId;
    } catch (e) {}
    try {
      var s = localStorage.getItem("storyActiveSlot_" + genre());
      if (s) return s;
    } catch (e) {}
    return "main";
  }

  /** 后缀规则：主档裸键（零迁移），副档 '~{slotId}'。 */
  function suffix(id) {
    var sid = id || slotId();
    return sid && sid !== "main" ? "~" + sid : "";
  }

  /* ------------------------------------------------------- 键名构造规则表 */
  /* kind 用于 purge() 时按格式反查，避免为每个模块手写一张孤儿键表。 */

  /* 规则 A：{base}{suffix}                     —— 主档裸键 / 副档 ~slot 结尾
   *   例：worldExt_shrouding、worldExt_shrouding~sA1
   * 规则 B：{base}~{slotId}                     —— 槽位恒在结尾，主档也带 '~main'
   *   例：yunjingBeasts~main
   * 规则 C：{base}~{slotId}~{genre}             —— 槽位在中间
   *   例：yunjingWorldRuntime~main~shrouding
   * 规则 D：{base}:{slotId}:{genre}             —— 冒号分隔
   *   例：yunjingCanonLedger:main:shrouding
   * 规则 E：{base}.{slotId}~{genre}             —— 点号分隔
   *   例：yunjing.clock.main~shrouding
   * 规则 F：{base}~{slotId}                     —— 与 B 同形，但无 genre
   */

  /* 声明式清单：kind 用于 purge 反查；build 用于生成精确键名。 */
  var RULES = [
    /* ---- 故事本体 ---- */
    { kind: "A", base: "storySave_", genreAt: "end", build: function (g, sid) { return "storySave_" + g + suffix(sid); } },
    { kind: "A", base: "imm_", genreAt: "end", build: function (g, sid) { return "imm_" + g + suffix(sid); } },
    { kind: "A", base: "tl_", genreAt: "end", build: function (g, sid) { return "tl_" + g + suffix(sid); } },
    { kind: "A", base: "immTitle_", genreAt: "end", build: function (g, sid) { return "immTitle_" + g; } },
    { kind: "A", base: "immFlash_", genreAt: "end", build: function (g, sid) { return "immFlash_" + g; } },
    /* ---- 界扩展模块 ---- */
    { kind: "A", base: "worldExt_", genreAt: "end", build: function (g, sid) { return "worldExt_" + g + suffix(sid); } },
    { kind: "A", base: "yunjingWorldBook:", genreAt: "end", build: function (g, sid) { return "yunjingWorldBook:" + g + suffix(sid); } },
    /* ---- 灵宠 / 小队 / 身份 / 关系（规则 B：主档也带 ~main）---- */
    { kind: "B", base: "yunjingBeasts", build: function (g, sid) { return "yunjingBeasts~" + sid; } },
    { kind: "B", base: "yunjingSquad", build: function (g, sid) { return "yunjingSquad~" + sid; } },
    { kind: "B", base: "yunjingStoryStance", build: function (g, sid) { return "yunjingStoryStance" + suffix(sid); } },
    { kind: "B", base: "yunjingSideChar", build: function (g, sid) { return "yunjingSideChar" + suffix(sid); } },
    { kind: "B", base: "yunjingPlayerIdentity", build: function (g, sid) { return "yunjingPlayerIdentity" + suffix(sid); } },
    { kind: "B", base: "yunjingHeroRelation", build: function (g, sid) { return "yunjingHeroRelation" + suffix(sid); } },
    /* ---- 世界运行态（规则 C：槽位在中间）---- */
    { kind: "C", base: "yunjingWorldRuntime", build: function (g, sid) { return "yunjingWorldRuntime~" + sid + "~" + g; } },
    { kind: "C", base: "yunjingWorldBus", build: function (g, sid) { return "yunjingWorldBus~" + sid + "~" + g; } },
    { kind: "C", base: "yunjingWorldAlive", build: function (g, sid) { return "yunjingWorldAlive~" + sid + "~" + g; } },
    /* ---- 正典账本 / 编年史（规则 D：冒号）---- */
    { kind: "D", base: "yunjingCanonLedger:", build: function (g, sid) { return "yunjingCanonLedger:" + sid + ":" + g; } },
    { kind: "D", base: "yunjingCanonTL:", build: function (g, sid) { return "yunjingCanonTL:" + sid + ":" + g; } },
    /* ---- 世界时钟（规则 E：点号）---- */
    { kind: "E", base: "yunjing.clock.", build: function (g, sid) { return "yunjing.clock." + sid + "~" + g; } },
    /* ---- 传承与旧共享键（规则 F）---- */
    { kind: "F", base: "worldLegacyGranted", build: function (g, sid) { return "worldLegacyGranted~" + sid; } },
    /* ---- 规则 A 的其它书内数据（原本无槽隔离，v4.08.0 补隔离）---- */
    { kind: "A", base: "gl_", genreAt: "end", build: function (g, sid) { return "gl_" + g + suffix(sid); } },
    { kind: "A", base: "rl_", genreAt: "end", build: function (g, sid) { return "rl_" + g + suffix(sid); } },
    { kind: "A", base: "storyKnowledge_", genreAt: "end", build: function (g, sid) { return "storyKnowledge_" + g + suffix(sid); } },
    { kind: "A", base: "storyAtlas_", genreAt: "end", build: function (g, sid) { return "storyAtlas_" + g + suffix(sid); } }
  ];

  /* ------------------------------------------------------------------ 枚举 */

  /** 某槽位名下的所有键（精确键名，不依赖 localStorage 扫描）。 */
  function keysOf(id, g) {
    var sid = id || slotId();
    var gg = g || genre();
    var out = [];
    for (var i = 0; i < RULES.length; i++) {
      try { out.push(RULES[i].build(gg, sid)); } catch (e) {}
    }
    return out;
  }

  /**
   * 扫描 localStorage，找出**属于该槽位**的所有键（含历史上用其它格式写的）。
   * 这是 purge 的兜底：规则表可能漏了新模块，扫描能兜住。
   * 判定：键里出现 '~{slotId}' / ':{slotId}:' / '.{slotId}~' 三种分隔形态之一。
   */
  function scanKeysOf(id, g) {
    var sid = id || slotId();
    var gg = g || genre();
    var out = [];
    var needles = ["~" + sid + "~", "~" + sid, ":" + sid + ":", "." + sid + "~"];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k) continue;
        if (k === "storyActiveSlot_" + gg) continue;
        var hit = false;
        for (var j = 0; j < needles.length; j++) {
          if (k.indexOf(needles[j]) >= 0) { hit = true; break; }
        }
        if (!hit) continue;
        /* 槽位令牌必须出现在「界标识之前或等于」，否则可能是别的界的键。
           宽松处理：只要含槽位令牌且含当前界标识，就认定属于本槽。 */
        if (gg && k.indexOf(gg) < 0) continue;
        out.push(k);
      }
    } catch (e) {}
    return out;
  }

  /* ------------------------------------------------------------------ 清理 */

  /**
   * 清空某槽位的全部存档数据。
   * @param {string} id 槽位 id；省略则用当前槽
   * @param {object} opts { genre } 界；省略则用当前界
   * @returns {string[]} 实际删除的键名
   */
  function purge(id, opts) {
    opts = opts || {};
    var sid = id || slotId();
    var gg = opts.genre || genre();
    var keys = [];
    var seen = {};
    var push = function (k) { if (k && !seen[k]) { seen[k] = 1; keys.push(k); } };
    var i;
    for (i = 0; i < RULES.length; i++) {
      try { push(RULES[i].build(gg, sid)); } catch (e) {}
    }
    var scanned = scanKeysOf(sid, gg);
    for (i = 0; i < scanned.length; i++) push(scanned[i]);
    /* 主档额外清裸键（老数据零迁移遗留在无后缀形态下） */
    if (sid === "main") {
      for (i = 0; i < RULES.length; i++) {
        try {
          var r = RULES[i];
          if (r.genreAt !== "end") continue;
          push(r.base + gg);
        } catch (e) {}
      }
    }
    var removed = [];
    for (i = 0; i < keys.length; i++) {
      try {
        if (localStorage.getItem(keys[i]) == null && keys[i].indexOf(".bak") < 0 && keys[i].indexOf(".idb") < 0) {
          /* 键可能不存在，但 .bak/.idb 变体仍需清 */
        }
        localStorage.removeItem(keys[i]);
        removed.push(keys[i]);
        /* 连带清理 .bak / .idb 变体 */
        try { localStorage.removeItem(keys[i] + ".bak"); localStorage.removeItem(keys[i] + ".idb"); } catch (e2) {}
      } catch (e) {}
    }
    /* 槽位归属标记 */
    try { localStorage.removeItem("yunjingLegacyOwner:" + gg); } catch (e) {}
    return removed;
  }

  /* -------------------------------------------------- 旧共享键的一次性归属 */

  /**
   * 旧共享键（如 imm_{genre}）的一次性归属。
   *
   * v4.07.2 之前的问题（原 story-framework.js 的 claimSlotKey）：
   *   副档「有存档但无自有键」时，把裸键数据复制进副档后 **removeItem 裸键**。
   *   但裸键正是**主档正在使用的键** → 副档一进就把主档的数据销毁了（D4）。
   *
   * v4.08.0 的做法：引入「归属标记」 yunjingLegacyOwner:{genre}:{legacyKey}
   *   · 首次遇到某裸键时判定归属：主档有存档 → 归主档；否则归当前副档。
   *   · 归属一旦确定不再变更 → 只有真正「孤儿」的旧数据才会被副档认领。
   *   · 认领时**移动**（认领方拿走后删裸键）只在其为孤儿时发生，主档数据绝不会被销毁。
   *
   * @returns {string} 本档应使用的键名
   */
  function claimLegacy(legacyKey, g) {
    var gg = g || genre();
    var sid = slotId();
    var sfx = suffix(sid);
    if (!sfx) return legacyKey;               // 主档：直接沿用裸键
    var mine = legacyKey + sfx;
    try {
      if (localStorage.getItem(mine) != null) return mine;
      if (localStorage.getItem(legacyKey) == null) return mine;
      var ownerKey = "yunjingLegacyOwner:" + gg + ":" + legacyKey;
      var owner = localStorage.getItem(ownerKey);
      if (!owner) {
        /* 首次判定归属：主档有存档 → 裸键是主档的live数据，归主档 */
        var mainHasSave = !!(localStorage.getItem("storySave_" + gg) || localStorage.getItem("storySave_" + gg + ".bak"));
        owner = mainHasSave ? "main" : sid;
        localStorage.setItem(ownerKey, owner);
      }
      if (owner !== sid) return mine;          // 不是我的，不认领
      /* 认领：孤儿数据搬进本档 */
      localStorage.setItem(mine, localStorage.getItem(legacyKey));
      localStorage.removeItem(legacyKey);
    } catch (e) {}
    return mine;
  }

  /* --------------------------------------------- 给无槽隔离模块补隔离 */

  /**
   * 返回一个「已按槽隔离」的键名；首次访问时把旧共享键的数据迁移过来一次。
   * @param {string} base  基名，如 'gl_'
   * @param {string} g     界
   * @returns {string} 完整键名
   */
  function scoped(base, g) {
    var gg = g || genre();
    var sid = slotId();
    var sfx = suffix(sid);
    var key = base + gg + sfx;
    if (!sfx) return key;                       // 主档：沿用旧裸键
    try {
      if (localStorage.getItem(key) == null) {
        var old = base + gg;
        var raw = localStorage.getItem(old);
        if (raw != null) {
          /* 与 claimLegacy 同理：只有当主档没有「活数据」时才搬走裸键 */
          var mainHasSave = !!(localStorage.getItem("storySave_" + gg) || localStorage.getItem("storySave_" + gg + ".bak"));
          localStorage.setItem(key, raw);
          if (!mainHasSave) localStorage.removeItem(old);
        }
      }
    } catch (e) {}
    return key;
  }

  /* ------------------------------------------------------------------ 导出 */
  var API = {
    genre: genre,
    slotId: slotId,
    suffix: suffix,
    keysOf: keysOf,
    scanKeysOf: scanKeysOf,
    purge: purge,
    claimLegacy: claimLegacy,
    scoped: scoped,
    RULES: RULES
  };
  global.SlotRegistry = API;
  /* 兼容旧入口：老代码直接调 window.claimSlotKey */
  if (typeof global.claimSlotKey !== "function") {
    global.claimSlotKey = function (legacyKey, g) { return API.claimLegacy(legacyKey, g); };
  }
})(typeof window !== "undefined" ? window : globalThis);
