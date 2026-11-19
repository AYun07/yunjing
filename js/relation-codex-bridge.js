/* =====================================================================
 * 云境 · 动态关系 × 性格世界书 桥接层（RelationCodexBridge）  v4.45.0
 * ---------------------------------------------------------------------
 * 版权：云境项目独立实现，仅调用自有模块公开接口，未引用第三方代码。
 *
 * 职责（低耦合，包装+监听，不改任何现有模块内部逻辑）：
 *   ① 监听 yj:world-tick：世界每推进一段，就用「经过时长 + 世界事件 +
 *      局势张力 + 当前世界性格倾向」驱动所有已建档角色的关系演化；
 *      玩家 explicit 设定的轴（locked）由关系引擎自动跳过。
 *   ② 包装 NPCBridge.applyDisposition：态度变更时按角色的性格倾向系数
 *      调整增益（多疑者信任增益小、热情者好感增益大）——玩家显式调用
 *      且带 opts.playerSet 时跳过性格加成，尊重玩家要求。
 *   ③ 提供 evolveAllNow() 供 UI/手动触发与调试。
 *   本地引擎始终确定、零 API；失败自动 try/catch 降级不影响主流程。
 * ===================================================================== */
(function (global) {
  'use strict';
  var VERSION = '1.1.0';
  var booted = false;
  var stats = { ticks: 0, relationsEvolved: 0, npcBiased: 0, behaviors: 0, lastSpan: 0, errors: 0 };
  /* 行为台账：按「性格 + 行为轨迹」演化的角色行为倾向，供 NPC 引擎/UI/AI 消费 */
  var behaviorLedger = [];

  function IA() { return global.IntimacyArchive || null; }
  function PC() { return global.PersonalityCodex || null; }
  function NB() { return global.NPCBridge || null; }

  /* 当前世界 key：优先 WorldExt.genre，其次 URL 参数，再次 free */
  function worldKey() {
    try {
      if (global.WorldExt && global.WorldExt.genre) return String(global.WorldExt.genre);
      if (typeof location !== 'undefined' && location.search) {
        var m = new URLSearchParams(location.search).get('genre');
        if (m) return m;
      }
    } catch (e) {}
    return 'free';
  }

  /* 局势张力：从 storyFramework.variables 取，缺省 0 */
  function tension() {
    try {
      var fw = global.storyFramework;
      var v = fw && fw.storyState && fw.storyState.variables;
      if (!v) return 0;
      return Number(v.张力 || v.tension || (v.局势 && v.局势.tension) || 0) || 0;
    } catch (e) { return 0; }
  }

  /* 世界事件 → 关系轴冲击：把事件文本按关键词映射到五维（原创启发式，非引第三方数据） */
  var EVENT_RULES = [
    { re: /救|救命|相救|护|挡刀|解围/, axis: 'trust', delta: 8 },
    { re: /背叛|出卖|背刺|暗算|设局/, axis: 'trust', delta: -12 },
    { re: /辱|羞辱|轻蔑|羞|讥/, axis: 'esteem', delta: -8 },
    { re: /敬|钦佩|敬重|义举|壮举/, axis: 'esteem', delta: 7 },
    { re: /同行|并肩|共患难|相伴|重逢/, axis: 'closeness', delta: 6 },
    { re: /争吵|反目|决裂|疏远|冷战/, axis: 'closeness', delta: -7 },
    { re: /温柔|关怀|照料|贴心/, axis: 'favor', delta: 5 },
    { re: /冒犯|无礼|冷酷|残忍/, axis: 'favor', delta: -6 },
    { re: /亲近|暧昧|倾心|动情/, axis: 'desire', delta: 6 }
  ];
  function eventsToImpacts(events) {
    var out = [];
    (events || []).forEach(function (raw) {
      var txt = String(raw == null ? '' : raw);
      EVENT_RULES.forEach(function (rule) {
        if (rule.re.test(txt)) out.push({ axis: rule.axis, delta: rule.delta, reason: txt.slice(0, 24) });
      });
    });
    return out;
  }

  /* ① 世界时钟驱动关系演化 */
  function onWorldTick(evt) {
    var A = IA(); if (!A) return;
    stats.ticks++;
    var d = (evt && evt.detail) || {};
    var days = 0, minutes = 0;
    if (d.day != null) days = Number(d.span || 1);
    if (d.moment && d.minutes != null) minutes = Number(d.minutes);
    stats.lastSpan = days || (minutes / 1440);
    var wk = worldKey();
    var ten = tension();
    var impacts = eventsToImpacts(d.ev ? [d.ev] : (d.text ? [d.text] : []));
    var rawEvents = d.ev ? [d.ev] : (d.text ? [d.text] : []);
    var roster = A.list();
    var C = PC();
    roster.forEach(function (rec) {
      try {
        var bias = {};
        if (C && C.biasFor) {
          var pb = C.biasFor(rec.name, wk);
          if (pb && !pb.name) bias = pb;   // biasFor 不传轴返回系数对象
        }
        A.evolve(rec.name, {
          days: days, hours: minutes / 60,
          events: impacts,
          tension: ten,
          world: wk,
          personalityBias: bias
        });
        stats.relationsEvolved++;
        /* 新增：按「性格 + 行为轨迹」演化角色行为倾向并留痕 */
        if (C && C.behaviorOf) {
          var bh = C.behaviorOf(rec.name, wk, { events: rawEvents, days: days, tension: ten });
          behaviorLedger.push(Object.assign({ tick: stats.ticks, world: wk }, bh));
          stats.behaviors++;
          if (behaviorLedger.length > 200) behaviorLedger = behaviorLedger.slice(-200);
        }
      } catch (e) { stats.errors++; }
    });
    /* 同世界角色即使未建档，也在世界时钟里按性格演化行为（覆盖所有角色） */
    if (C && C.behaviorOf && C.roster) {
      (C.roster(wk) || []).forEach(function (nm) {
        if (roster.some(function (r) { return r.name === nm; })) return;
        try {
          var bh2 = C.behaviorOf(nm, wk, { events: rawEvents, days: days, tension: ten });
          behaviorLedger.push(Object.assign({ tick: stats.ticks, world: wk }, bh2));
          stats.behaviors++;
        } catch (e) {}
      });
      if (behaviorLedger.length > 200) behaviorLedger = behaviorLedger.slice(-200);
    }
  }
  /* 供 UI / AI / NPC 引擎读取最近的行为演化台账 */
  function behaviorsNow(limit) {
    var n = limit || 20;
    return behaviorLedger.slice(-n).map(function (x) { return Object.assign({}, x); });
  }

  /* ② NPC 态度变更叠加性格倾向（尊重玩家显式设定） */
  function hookNPC() {
    var B = NB(); if (!B || B.__relationBiased) return;
    var orig = B.applyDisposition;
    if (typeof orig !== 'function') return;
    B.applyDisposition = function (name, patch, opts) {
      opts = opts || {};
      if (opts.playerSet || opts.noBias) return orig.call(this, name, patch, opts);
      var C = PC();
      if (C && C.biasFor && name) {
        try {
          var bias = C.biasFor(name, worldKey());
          var adj = {};
          Object.keys(patch || {}).forEach(function (k) {
            var mul = (bias && bias[k] != null) ? bias[k] : 1;
            adj[k] = Math.round(Number(patch[k]) * mul);
          });
          patch = adj;
          stats.npcBiased++;
        } catch (e) {}
      }
      return orig.call(this, name, patch, opts);
    };
    B.__relationBiased = true;
  }

  function evolveAllNow(opts) {
    var A = IA(); if (!A) return { evolved: 0 };
    opts = opts || {};
    var wk = worldKey(), n = 0;
    A.list().forEach(function (rec) {
      try {
        var C = PC();
        var bias = (C && C.biasFor) ? C.biasFor(rec.name, wk) : {};
        A.evolve(rec.name, {
          days: opts.days || 0, hours: opts.hours || 0,
          events: opts.events || [], tension: opts.tension || tension(),
          world: wk, personalityBias: (bias && !bias.name) ? bias : {}
        });
        n++;
      } catch (e) { stats.errors++; }
    });
    stats.relationsEvolved += n;
    return { evolved: n, world: wk };
  }

  function boot() {
    if (booted) return true;
    var ok = true;
    try {
      if (global.addEventListener) global.addEventListener('yj:world-tick', onWorldTick);
    } catch (e) { stats.errors++; ok = false; }
    try { hookNPC(); } catch (e) { stats.errors++; }
    booted = true;
    return ok;
  }
  function status() { return { booted: booted, world: worldKey(), stats: Object.assign({}, stats), ledgerSize: behaviorLedger.length }; }
  function resetStats() { Object.keys(stats).forEach(function (k) { if (typeof stats[k] === 'number') stats[k] = 0; }); behaviorLedger = []; return true; }

  var API = {
    VERSION: VERSION, boot: boot, status: status, resetStats: resetStats,
    onWorldTick: onWorldTick, evolveAllNow: evolveAllNow, behaviorsNow: behaviorsNow,
    worldKey: worldKey, eventsToImpacts: eventsToImpacts,
    _hooks: { hookNPC: hookNPC }
  };
  global.RelationCodexBridge = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

  try {
    if (typeof global.addEventListener === 'function') {
      global.addEventListener('DOMContentLoaded', function () { try { boot(); } catch (e) {} });
    }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
