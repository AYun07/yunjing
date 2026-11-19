/* =====================================================================
 * 云境 · AI 增强接入桥（AIAugmentBridge）
 * ---------------------------------------------------------------------
 * 版权声明：本模块为云境项目独立实现，未使用任何第三方项目源码。
 *
 * 职责：把统一增强层（AIAugment）接到四个真实游戏环节——
 *   ① 亲密互动润色（IntimacyArchive）  ② NPC 档案演化（NPCBridge）
 *   ③ 世界事件演化（WorldClock）       ④ 表格/推演（VariableAI/Planner 已有通道）
 *
 * 接入方式：低耦合——包装现有全局方法 + 监听已有 yj:world-tick 事件，
 *           不改动任何现有模块内部逻辑，降低回归风险。
 *   本地引擎始终先产出保底结果；AI 增强异步、失败自动降级，绝不阻塞主流程。
 * ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '1.0.0';
  var booted = false;

  function AI() { return global.AIAugment; }

  /* ① 亲密互动：包装 IntimacyArchive.recordInteraction —— AI 开启且采样命中时润色文本 */
  function hookIntimacy() {
    var IA = global.IntimacyArchive;
    if (!IA || IA.__aiHooked) return;
    var orig = IA.recordInteraction;
    IA.recordInteraction = function (name, text, opts) {
      var base = orig.call(this, name, text, opts); /* 本地保底先入档 */
      var A = AI();
      if (base && A && A.isTaskAvailable('intimacy') && opts && opts.allowAI !== false) {
        /* 提示词随玩家表达尺度切换（含蓄/直白/露骨）；露骨档不再注入硬禁令，
           尺度由玩家自有模型与其判断决定——云境自身不生成露骨色情文本。 */
        var system = (typeof IA.systemHint === 'function')
          ? IA.systemHint()
          : '你是文风润色师，只输出改写后的一段话，不要解释。';
        A.enhance('intimacy', '原始片段：' + text, {
          system: system, maxTokens: 200, temperature: 0.8,
          parse: null
        }).then(function (r) {
          if (r.ok && typeof IA.sanitize === 'function') {
            var clean = IA.sanitize(r.text);
            if (clean) base.text = clean; /* 覆盖本地文本；已被护栏过滤 */
          }
        }).catch(function () {});
      }
      return base;
    };
    IA.__aiHooked = true;
  }

  /* ② NPC 档案演化：包装 NPCBridge.driveOne —— AI 开启时把本地 deed 润色成更有文采的经历 */
  function hookNPC() {
    var B = global.NPCBridge;
    if (!B || B.__aiHooked) return;
    var orig = B.driveOne;
    B.driveOne = function (name, ctx) {
      var base = orig.call(this, name, ctx); /* 本地自治先跑 */
      var A = AI();
      if (base && base.active && base.deed && A && A.isTaskAvailable('npc')) {
        var system = '你是叙事润色师。把这条角色动向改写成一句凝练、有画面感的中文，不要解释，只输出一句话。';
        A.enhance('npc', '角色：' + name + '\n动向：' + base.deed, {
          system: system, maxTokens: 160, temperature: 0.8
        }).then(function (r) {
          if (r.ok) base.deed = r.text;
        }).catch(function () {});
      }
      return base;
    };
    B.__aiHooked = true;
  }

  /* ③ 世界事件演化：监听 yj:world-tick —— AI 开启时把待注入事件润色后写回 */
  function hookWorld() {
    if (global.__yjWorldAIHooked) return;
    var add = global.addEventListener && global.addEventListener.bind(global);
    if (!add) return;
    add('yj:world-tick', function () {
      var A = AI();
      if (!A || !A.isTaskAvailable('world')) return;
      var sf = global.storyFramework;
      var v = sf && sf.storyState && sf.storyState.variables;
      if (!v || !v.时间 || !Array.isArray(v.时间.pendingEvents) || !v.时间.pendingEvents.length) return;
      var ev = v.时间.pendingEvents[0];
      var system = '你是世界_event 播报润色师。把这条世界事件改写成一句有氛围感、简洁的中文播报，不要解释，只输出一句话。';
      A.enhance('world', '事件：' + ev, {
        system: system, maxTokens: 160, temperature: 0.75
      }).then(function (r) {
        if (r.ok && v.时间.pendingEvents[0] === ev) v.时间.pendingEvents[0] = r.text;
      }).catch(function () {});
    });
    global.__yjWorldAIHooked = true;
  }

  /* ④ 表格/推演：这两条链路本身已有大模型通道（VariableAI 第三接口/主笔兜底、Planner.generate）。
        这里不重复调用，只做「可用性说明」——增强层开关开启时，若它们尚未激活，
        提示玩家去对应面板配置；不做重复 fetch，避免翻倍烧钱。 */
  function noteExistingChannels() {
    return {
      variable: !!(global.VariableAI && (global.VariableAI.isReady ? global.VariableAI.isReady() : false)
        || (global.VariableAI && global.VariableAI.isFallbackActive && global.VariableAI.isFallbackActive())),
      planner: !!(global.Planner && typeof global.Planner.generate === 'function')
    };
  }

  function boot() {
    if (booted) return true;
    hookIntimacy();
    hookNPC();
    hookWorld();
    booted = true;
    return true;
  }

  function status() {
    return {
      booted: booted,
      intimacyHooked: !!(global.IntimacyArchive && global.IntimacyArchive.__aiHooked),
      npcHooked: !!(global.NPCBridge && global.NPCBridge.__aiHooked),
      worldHooked: !!global.__yjWorldAIHooked,
      existingChannels: noteExistingChannels()
    };
  }

  var API = { VERSION: VERSION, boot: boot, status: status, _hooks: { hookIntimacy: hookIntimacy, hookNPC: hookNPC, hookWorld: hookWorld } };
  global.AIAugmentBridge = API;

  /* 自动引导：DOMContentLoaded 后尝试接入（各模块已挂载） */
  try {
    if (typeof global.addEventListener === 'function') {
      global.addEventListener('DOMContentLoaded', function () { try { boot(); } catch (e) {} });
    }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
