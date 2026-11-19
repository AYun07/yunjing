/* ============================================================================
 * NPC 编年史桥接层 · npc-bridge.js
 * ----------------------------------------------------------------------------
 * 把 npc-chronicle.js 的六项机制接入云境现有运行时，采用低耦合方式：
 *   - 不改动 world-runtime.js / world-clock.js 内部逻辑；
 *   - 通过包装 WorldRuntime.NPC 的公开方法 + 监听 yj:world-tick 事件接入；
 *   - 目标对象缺失时优雅降级（try/catch），不影响原有功能。
 *
 * 版权：本项目独立编写，仅调用自有 NPCChronicle 的公开接口，未引用任何第三方代码。
 * ========================================================================== */
(function () {
  "use strict";
  var G = (typeof window !== "undefined") ? window : (typeof globalThis !== "undefined" ? globalThis : {});

  var VERSION = "1.0.0";
  var attached = false;
  var stats = { synced: 0, autonomyTicks: 0, gated: 0, archived: 0, errors: 0 };

  function N() { return G.NPCChronicle || null; }
  function WR() { return G.WorldRuntime || null; }

  /* 把 WorldRuntime 的 NPC 记录转成编年史档案（字段映射集中在映射层，便于返工时只改一处）。 */
  function toChronicle(e) {
    var NC = N(); if (!NC || !e) return null;
    var rec = NC.ensure({
      id: e.id || e.name,
      name: e.name,
      npcTag: e.npcTag || (e.faction === "离队" ? "native" : "contractor"),
      tier: e.tier || "mid",
      importance: e.isBond ? "core" : "normal",
      isBond: !!e.isBond,
      attr: e.attr != null ? e.attr : (e.stats && Number(e.stats.力量)) || 30,
      disposition: {
        trust: Number(e.trust) || 0,
        favor: Number(e.好感) || Number(e.favor) || 0,
        esteem: Number(e.敬重) || Number(e.esteem) || 0,
        guard: Number(e.戒备) || Number(e.guard) || 0
      }
    });
    // 已有生平/自治状态则继承，避免重复同步丢失
    if (Array.isArray(e.chronicleDeeds)) rec.deeds = e.chronicleDeeds.slice();
    if (e.chronicleAuto) rec.auto = e.chronicleAuto;
    return rec;
  }

  /* 把编年史档案的核心字段写回 NPC 记录（随 WorldRuntime 的 save() 自动持久化）。 */
  function fromChronicle(e, rec) {
    if (!e || !rec) return;
    e.trust = rec.disposition.trust;
    e.好感 = rec.disposition.favor;
    e.敬重 = rec.disposition.esteem;
    e.戒备 = rec.disposition.guard;
    e.chronicleDeeds = rec.deeds.slice(-60);
    e.chronicleAuto = rec.auto;
    // 类型字段写回自定义属性：WorldRuntime.NPC.upsert 有字段白名单会丢弃它们，
    // 故经此桥接写回，随 save() 整体序列化持久化，绕开 upsert 白名单。
    e.npcTag = rec.npcTag;
    e.isBond = !!rec.isBond;
    e.tier = rec.tier;
  }

  /* 态度 patch 键名归一化：调用方可能用中文键（好感/敬重/戒备）或英文键。 */
  function normalizePatch(patch) {
    var src = patch || {}, out = {};
    var map = {
      trust: 'trust', 信任: 'trust',
      favor: 'favor', 好感: 'favor',
      esteem: 'esteem', 敬重: 'esteem',
      guard: 'guard', 戒备: 'guard'
    };
    Object.keys(map).forEach(function (k) {
      if (src[k] != null) out[map[k]] = Number(src[k]);
    });
    return out;
  }

  var API = {
    VERSION: VERSION,
    stats: function () { return Object.assign({}, stats); },

    /** B2：把当前所有 NPC 同步进编年史档案并写回持久化字段。 */
    syncAll: function () {
      var NC = N(), WRx = WR(); if (!NC || !WRx || !WRx.NPC) return 0;
      var list = WRx.NPC.list ? WRx.NPC.list() : [];
      var n = 0;
      list.forEach(function (e) {
        try {
          var rec = toChronicle(e);
          if (!rec) return;
          fromChronicle(e, rec);
          n++;
        } catch (err) { stats.errors++; }
      });
      stats.synced += n;
      return n;
    },

    /** B2：态度变更经编年史棘轮后写回运行时（供玩家交互/AI 上报调用）。 */
    applyDisposition: function (name, patch, opts) {
      var NC = N(), WRx = WR(); if (!NC || !WRx || !WRx.NPC) return null;
      var e = WRx.NPC.get ? WRx.NPC.get(name) : null; if (!e) return null;
      var rec = toChronicle(e);
      var out = NC.applyDisposition(rec, normalizePatch(patch), opts);
      fromChronicle(e, out.record);
      if (WRx.NPC.upsert) WRx.NPC.upsert(e);
      return out.record.disposition;
    },

    /** 标记 NPC 类型（随从/土著/契约者/羁绊），写入自定义属性绕开 upsert 白名单。 */
    setRole: function (name, role, opts) {
      var NC = N(), WRx = WR(); if (!NC || !WRx || !WRx.NPC) return null;
      var e = WRx.NPC.get ? WRx.NPC.get(name) : null; if (!e) return null;
      var rec = toChronicle(e);
      if (role) rec.npcTag = role;
      if (opts && opts.bond != null) rec.isBond = !!opts.bond;
      if (opts && opts.tier) rec.tier = opts.tier;
      fromChronicle(e, rec);
      return { npcTag: rec.npcTag, isBond: rec.isBond, tier: rec.tier };
    },

    /** B2：把离场 NPC 完整快照归档（只增不删），在真正删除前调用。 */
    archiveBeforeRemove: function (name) {
      var NC = N(), WRx = WR(); if (!NC || !WRx || !WRx.NPC) return null;
      var e = WRx.NPC.get ? WRx.NPC.get(name) : null; if (!e) return null;
      var rec = toChronicle(e);
      var r = NC.archive(rec, "before-remove");
      stats.archived++;
      return r;
    },

    /** B3+B5：对一个 NPC 先过驱动力闸门，通过才跑离场自治，结果写回运行时。 */
    driveOne: function (name, ctx) {
      var NC = N(), WRx = WR(); if (!NC || !WRx || !WRx.NPC) return null;
      var e = WRx.NPC.get ? WRx.NPC.get(name) : null; if (!e) return null;
      var rec = toChronicle(e);
      var gate = NC.driveGate(rec, ctx || {});
      if (!gate.active) { stats.gated++; return { name: name, active: false, reason: gate.reason }; }
      var out = NC.autonomyTick(rec, ctx || {});
      fromChronicle(e, out.record);
      stats.autonomyTicks++;
      return {
        name: name, active: true, reason: gate.reason,
        phase: out.phase, deed: out.deed, growthDelta: out.growthDelta
      };
    },

    /** B3：用认知边界过滤世界事件——公开事件全给，私密事件仅点名知情人可见。 */
    visibleEventsFor: function (name, events) {
      var NC = N(); if (!NC) return (events || []).slice();
      var rec = NC.ensure({ name: name });
      return (events || []).filter(function (ev) { return NC.canKnow(rec, ev); });
    },

    /** 世界时钟每拍回调：对所有 NPC 走 B5 静滞判定 + B3 自治，返回本轮推进者。 */
    onWorldTick: function (evt) {
      var WRx = WR(); if (!WRx || !WRx.NPC) return [];
      var round = 0;
      try {
        var sf = G.storyFramework;
        round = (sf && sf.storyState && Number(sf.storyState.turnCount)) || 0;
      } catch (e) {}
      var ctx = { round: round, seed: "world", situation: {} };
      var list = WRx.NPC.list ? WRx.NPC.list() : [];
      var advanced = [];
      list.forEach(function (e) {
        try {
          var r = API.driveOne(e.name, ctx);
          if (r && r.active) advanced.push(r);
        } catch (err) { stats.errors++; }
      });
      if (advanced.length && G.showToast) {
        // 低频提示：仅当有实质经历产出时
        try { G.showToast("📖 " + advanced.length + " 位离场角色有了新的动向", "info"); } catch (e) {}
      }
      return advanced;
    },

    /** 一次性挂载：包装 WorldRuntime.NPC.remove（归档）+ 监听时钟事件（自治）。 */
    attach: function () {
      if (attached) return true;
      var NC = N(), WRx = WR(); if (!NC || !WRx || !WRx.NPC) return false;

      // 包装 remove：删除前先归档快照
      try {
        var origRemove = WRx.NPC.remove;
        if (typeof origRemove === "function" && !origRemove.__chronicleWrapped) {
          var wrapped = function (name) {
            try { API.archiveBeforeRemove(name); } catch (e) { stats.errors++; }
            return origRemove.apply(WRx.NPC, arguments);
          };
          wrapped.__chronicleWrapped = true;
          WRx.NPC.remove = wrapped;
        }
      } catch (e) { stats.errors++; }

      // 监听世界时钟事件
      try {
        if (G.addEventListener) G.addEventListener("yj:world-tick", API.onWorldTick);
      } catch (e) { stats.errors++; }

      attached = true;
      API.syncAll();
      return true;
    },

    isAttached: function () { return attached; }
  };

  G.NPCBridge = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;

  // 自动挂载：等 DOM 就绪（WorldRuntime 为懒加载，轮询等待其出现）
  if (typeof G.addEventListener !== "undefined") {
    var tries = 0;
    var timer = G.setInterval ? G.setInterval(function () {
      tries++;
      try { if (API.attach()) { G.clearInterval && G.clearInterval(timer); } }
      catch (e) { stats.errors++; }
      if (tries > 60) G.clearInterval && G.clearInterval(timer); // 最多等 ~6 秒
    }, 100) : null;
  }
})();
