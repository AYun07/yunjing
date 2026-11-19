/* ============================================================================
 * NPC 编年史引擎 · npc-chronicle.js
 * ----------------------------------------------------------------------------
 * 用途：为云境的角色扮演提供完整的 NPC 生命周期档案能力。
 *
 * 版权声明（重要）：
 *   本文件实现的是通用角色扮演游戏设计中的**机制思想**——角色态度维度、
 *   生平经历时间线、只增不删档案、离场确定性自治、事件认知边界、驱动力
 *   节流。这些机制属于游戏设计的通用概念，不受著作权保护。
 *   本文件的字段命名、数据结构、算法实现、状态机、注释与接口均为本项目
 *   独立编写，未复制、改写或翻译任何第三方项目的源码、标识符、提示词
 *   文案或数据定义。
 *
 * 设计约束：
 *   - 零依赖、原生 JS、无构建；挂到 window.NPCChronicle。
 *   - 核心逻辑为纯函数 / 确定性计算，可在 Node vm 沙箱中回归测试。
 *   - 离场自治全程不发起任何网络请求（零 API），仅靠种子伪随机推进。
 *
 * 作者：云境项目组
 * ========================================================================== */
(function () {
  "use strict";
  var G = (typeof window !== "undefined") ? window : (typeof globalThis !== "undefined" ? globalThis : {});

  var VERSION = "1.0.0";

  /* ---------- 内部工具（独立实现） ---------- */
  function clampInt(n, lo, hi) {
    n = Number(n);
    if (!isFinite(n)) n = lo;
    n = Math.round(n);
    return n < lo ? lo : (n > hi ? hi : n);
  }
  // 32 位字符串散列（FNV-1a 变体），用于把 id/种子映射到确定随机数
  function hashStr(s) {
    var h = 2166136261;
    s = String(s == null ? "" : s);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  // mulberry32：小巧的确定性 PRNG，同种子必得同序列
  function prng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function nowTag(ctx) {
    return (ctx && ctx.round != null) ? ("第" + ctx.round + "轮") : (ctx && ctx.day != null) ? ("第" + ctx.day + "日") : "某时";
  }

  /* 四轴态度：本项目自定义为 信任 / 好感 / 敬重 / 戒备。
     前三者为正向轴（越高越亲近），戒备为负向轴（越高越疏离）。 */
  var AXES = ["trust", "favor", "esteem", "guard"];
  var AXIS_LABEL = { trust: "信任", favor: "好感", esteem: "敬重", guard: "戒备" };
  function isPositiveAxis(k) { return k !== "guard"; }

  // 经历留存上限：重要角色留全生平，普通角色留近况，路人只留片段
  var DEED_CAP = { core: 60, normal: 12, minor: 5 };
  function deedCapOf(rec) {
    if (rec && (rec.isBond || rec.importance === "core")) return DEED_CAP.core;
    if (rec && rec.importance === "minor") return DEED_CAP.minor;
    return DEED_CAP.normal;
  }

  // 成长封顶：按 tier 限制属性上限，防止离场自治把低阶角色养成碾压级
  var TIER_CAP = { low: 30, mid: 60, high: 90, epic: 100 };
  function tierCapOf(rec) {
    var t = rec && rec.tier;
    return TIER_CAP[t] || TIER_CAP.mid;
  }

  /* ---------- 活动档案库与只增不删库房 ---------- */
  // vault 只增不删：任何"删除"都先把完整快照存进来，再从活动视图移除。
  var vault = Object.create(null);
  var vaultOrder = [];

  /* ---------- 对外 API ---------- */
  var API = {
    VERSION: VERSION,
    AXES: AXES.slice(),
    AXIS_LABEL: AXIS_LABEL,

    /** 把一条外部角色记录规范化为带完整档案字段的对象（不改入参）。 */
    ensure: function (rec) {
      rec = rec && typeof rec === "object" ? rec : {};
      var out = {};
      Object.keys(rec).forEach(function (k) { out[k] = rec[k]; });
      out.id = String(rec.id || rec.name || ("npc-" + hashStr(JSON.stringify(rec)).toString(36)));
      out.name = String(rec.name || "无名");
      out.disposition = out.disposition && typeof out.disposition === "object" ? out.disposition : {};
      AXES.forEach(function (k) { out.disposition[k] = clampInt(out.disposition[k], 0, 100); });
      if (!Array.isArray(out.deeds)) out.deeds = [];
      if (!out.npcTag) out.npcTag = "contractor"; // contractor | native | companion | pet
      if (!out.tier) out.tier = "mid";            // low | mid | high | epic
      if (!out.importance) out.importance = "normal";
      if (!out.auto || typeof out.auto !== "object") {
        out.auto = { phase: "away", ticks: 0, phaseRound: 0, growth: 0 };
      }
      if (typeof out.attr === "number") out.attr = clampInt(out.attr, 0, tierCapOf(out));
      if (!out.attr) out.attr = 30;
      return out;
    },

    /** 态度变更。patch 为四轴增量（可为负）。ratchet=true 时仅正向轴（信任/好感/敬重）只升不降，
     *  防止已积累的关系进度倒退；戒备轴为负向轴，保持双向可变（既可被安抚下降，也可被激怒上升）。 */
    applyDisposition: function (rec, patch, opts) {
      rec = API.ensure(rec);
      opts = opts || {};
      var ratchet = opts.ratchet !== false;
      patch = patch || {};
      var changed = false;
      AXES.forEach(function (k) {
        if (patch[k] == null) return;
        var cur = clampInt(rec.disposition[k], 0, 100);
        var next = clampInt(cur + Number(patch[k]), 0, 100);
        if (ratchet && isPositiveAxis(k)) next = Math.max(cur, next);
        if (next !== cur) { rec.disposition[k] = next; changed = true; }
      });
      return { record: rec, changed: changed };
    },

    /** 追加一条生平经历；按角色重要度自动裁剪到上限，保留最新。 */
    addDeed: function (rec, deed, ctx) {
      rec = API.ensure(rec);
      deed = deed || {};
      var entry = {
        text: String(deed.text || deed || "").slice(0, 200),
        kind: String(deed.kind || "event"),
        weight: clampInt(deed.weight == null ? 1 : deed.weight, 1, 5),
        at: deed.at != null ? deed.at : nowTag(ctx)
      };
      if (!entry.text) return { record: rec, added: false };
      rec.deeds.push(entry);
      var cap = deedCapOf(rec);
      if (rec.deeds.length > cap) rec.deeds = rec.deeds.slice(-cap);
      return { record: rec, added: true, entry: entry };
    },

    /** 只增不删归档：返回库房 id；活动视图由调用方决定是否移除。 */
    archive: function (rec, reason) {
      rec = API.ensure(rec);
      var id = rec.id;
      var snap = JSON.parse(JSON.stringify(rec));
      snap.archivedAt = Date.now();
      snap.archiveReason = String(reason || "unknown");
      if (!vault[id]) vaultOrder.push(id);
      // 同一 id 反复归档保留最后一次全量快照
      vault[id] = snap;
      return { vaultId: id, archived: true, vaultSize: vaultOrder.length };
    },

    /** 从库房取回快照（不删除库房记录，库房永远只增）。 */
    restore: function (id) {
      var snap = vault[id];
      return snap ? JSON.parse(JSON.stringify(snap)) : null;
    },
    vaultSize: function () { return vaultOrder.length; },
    vaultIds: function () { return vaultOrder.slice(); },

    /** 离场确定性自治：零网络请求。按 npcTag 分流推进相位、经历与有界成长。 */
    autonomyTick: function (rec, ctx) {
      rec = API.ensure(rec);
      ctx = ctx || {};
      var seed = hashStr(String(rec.id) + "|" + (ctx.seed || "") + "|" + (ctx.round || ctx.day || 0));
      var rnd = prng(seed);
      var auto = rec.auto;
      auto.ticks = (auto.ticks || 0) + 1;
      var before = auto.phase;
      var produced = null;

      if (rec.npcTag === "native") {
        // 土著：留在故土过本地生活，不触碰契约者术语
        auto.phase = "home";
        if (rnd() < 0.35) {
          produced = "在故地照旧过日子，起居如常";
        }
      } else if (rec.npcTag === "companion" || rec.npcTag === "pet") {
        // 随从/宠物：恒在主角一侧
        auto.phase = "along";
        if (rnd() < 0.4) {
          produced = "随在身侧，处理些零碎事务";
        }
      } else {
        // 契约者/默认：任务地与休整地双相轮转
        var span = 2 + Math.floor(rnd() * 3); // 2~4 tick 换一次相
        if (auto.ticks - (auto.phaseRound || 0) >= span) {
          auto.phase = (auto.phase === "mission" ? "rest" : "mission");
          auto.phaseRound = auto.ticks;
        }
        if (!before || before === "away") auto.phase = "mission";
        if (rnd() < 0.45) {
          produced = auto.phase === "mission"
            ? "投身一场新的差事，归来时身上带着风尘"
            : "在休整地盘整收获，少有露面";
        }
      }

      // 有界成长：小概率 +1，封顶按 tier
      var growthDelta = 0;
      var cap = tierCapOf(rec);
      if (rnd() < 0.25 && rec.attr < cap) {
        rec.attr = clampInt(rec.attr + 1, 0, cap);
        auto.growth = (auto.growth || 0) + 1;
        growthDelta = 1;
      }

      if (produced) {
        API.addDeed(rec, { text: produced, kind: "auto", weight: 1 }, ctx);
      }
      return { record: rec, phase: auto.phase, phaseChanged: before !== auto.phase, deed: produced, growthDelta: growthDelta };
    },

    /** 驱动力闸门：判断离场角色本轮有没有理由消耗 AI 演化额度。 */
    driveGate: function (rec, ctx) {
      rec = API.ensure(rec);
      ctx = ctx || {};
      if (rec.archivedAt || rec.frozenAt) return { active: false, reason: "静滞·已归档或冻结" };
      if (rec.npcTag === "companion" || rec.npcTag === "pet") return { active: true, reason: "随从恒有驱动" };

      var disp = rec.disposition;
      var sig = ctx.situation || {};
      var hasBond = !!rec.isBond || disp.favor >= 70 || disp.trust >= 70;
      var hasTask = !!(sig.taskFor && sig.taskFor[rec.name]);
      var hasTension = !!(sig.tension && sig.tension >= 60);
      var hasSocial = !!(sig.social && sig.social[rec.name]);

      if (rec.npcTag === "native") {
        if (hasBond || hasTask || hasTension) return { active: true, reason: "土著·羁绊/任务/局势" };
        return { active: false, reason: "静滞·土著无本地驱动" };
      }
      // 契约者/默认
      if (hasBond || hasTask || hasTension || hasSocial) return { active: true, reason: "契约者·羁绊/任务/局势/社交" };
      return { active: false, reason: "静滞·无行动驱动" };
    },

    /** 认知边界：判断某 NPC 是否有"资格"知道某事件。私密事件仅点名知情人可见。 */
    canKnow: function (rec, event) {
      rec = API.ensure(rec);
      event = event || {};
      var vis = event.visibility || "known";
      if (vis === "known" || vis === "direct") return true;
      var knownBy = Array.isArray(event.knownBy) ? event.knownBy : [];
      return knownBy.some(function (n) { return String(n) === rec.name; });
    },

    /** 批量自治：只驱动满足驱动力条件的离场角色，返回本轮实际推进者。 */
    tickRoster: function (records, ctx) {
      records = Array.isArray(records) ? records : [];
      var advanced = [];
      records.forEach(function (r) {
        var gate = API.driveGate(r, ctx);
        if (gate.active) {
          var res = API.autonomyTick(r, ctx);
          advanced.push({ id: res.record.id, reason: gate.reason, phase: res.phase, deed: res.deed });
        }
      });
      return advanced;
    }
  };

  G.NPCChronicle = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})();
