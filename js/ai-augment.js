/* =====================================================================
 * 云境 · 统一 AI 增强调度层（AIAugment）
 * ---------------------------------------------------------------------
 * 版权声明：本模块为云境项目独立实现，未使用任何第三方项目源码。
 *
 * 职责：把「NPC 档案演化 / 世界演化 / 表格填写 / 推演 / 亲密互动」等
 *       环节的「大模型增强」统一收口到一处，做到：
 *         ① 复用主笔 callOpenAI（其内层 MoNetGuard 已接 AIGovernor 闸门
 *            与 TokenUsage 记账）——本层绝不重复 acquire，避免死锁；
 *         ② 采样策略：默认低频，只在关键节点调，控制真实调用量与成本；
 *         ③ 成本透明：按 tag 累计 calls/token，玩家可随时查看；
 *         ④ 总开关 + 分项开关，默认全关，开启时明示「会产生真实调用」；
 *         ⑤ 失败降级：AI 异常自动回落本地结果，绝不阻塞游戏主流程。
 *
 * 设计哲学：本地引擎是骨架（省钱、确定、离线可用），AI 增强是血肉
 *          （追求效果）。二者叠加，AI 失败不影响骨架。
 * ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '1.0.0';
  var LS_KEY = 'yunjing.ai-augment.v1';

  /* 分项：每个功能一个开关 + 采样间隔（每 N 次关键节点触发一次真实调用） */
  var TASKS = {
    intimacy: { label: '亲密互动润色', every: 3 },   /* 每3次亲密互动调一次大模型润色 */
    npc:      { label: 'NPC 档案演化', every: 3 },   /* 每3次离场演化调一次 */
    world:    { label: '世界事件演化', every: 4 },   /* 每4次世界演化调一次 */
    variable: { label: '表格智能填写', every: 2 },   /* 每2轮调一次 */
    planner:  { label: '推演规划增强', every: 2 }    /* 每2次推演调一次 */
  };

  var state = {
    enabled: false,             /* 总开关 */
    tasks: {},                  /* tag -> {enabled} */
    counters: {},               /* tag -> 触发计数（用于采样） */
    cost: {},                   /* tag -> {calls, tokIn, tokOut} */
    errors: 0,
    fallbacks: 0
  };
  Object.keys(TASKS).forEach(function (t) {
    state.tasks[t] = { enabled: false };
    state.counters[t] = 0;
    state.cost[t] = { calls: 0, tokIn: 0, tokOut: 0 };
  });

  try {
    var raw = global.localStorage && global.localStorage.getItem(LS_KEY);
    if (raw) {
      var d = JSON.parse(raw);
      if (typeof d.enabled === 'boolean') state.enabled = d.enabled;
      if (d.tasks) Object.keys(d.tasks).forEach(function (t) {
        if (state.tasks[t] && typeof d.tasks[t].enabled === 'boolean') state.tasks[t].enabled = d.tasks[t].enabled;
      });
    }
  } catch(e){console.warn("[swallowed] ai-augment",e)}

  function persist() {
    try {
      if (global.localStorage) global.localStorage.setItem(LS_KEY, JSON.stringify({
        enabled: state.enabled,
        tasks: state.tasks
      }));
    } catch(e){console.warn("[swallowed] ai-augment",e)}
  }

  function isTaskAvailable(tag) {
    return !!(state.enabled && state.tasks[tag] && state.tasks[tag].enabled);
  }

  /* 采样：返回 true 表示本节点应真实调用大模型 */
  function shouldCall(tag, opts) {
    if (!isTaskAvailable(tag)) return false;
    opts = opts || {};
    if (opts.force) return true;                 /* 手动/关键节点强制 */
    var cfg = TASKS[tag];
    if (!cfg) return false;
    var every = Math.max(1, Number(opts.every || cfg.every || 1));
    state.counters[tag] = (state.counters[tag] || 0) + 1;
    return (state.counters[tag] % every) === 0;
  }

  function estimateTok(text) {
    var n = String(text == null ? '' : text).length;
    return Math.max(1, Math.round(n / 1.6));
  }

  /* 核心：调用主笔接口做增强。复用 callOpenAI（内层已接闸门与记账）。
     opts: {system, prompt, maxTokens, temperature, force, every, parse}
     返回 {ok, text, parsed, error, sampled, fallback} */
  async function enhance(tag, prompt, opts) {
    opts = opts || {};
    if (!shouldCall(tag, opts)) {
      return { ok: false, sampled: false, fallback: true, text: null, reason: 'not-sampled' };
    }
    var call = global.callOpenAI;
    if (typeof call !== 'function') {
      state.fallbacks++;
      return { ok: false, sampled: true, fallback: true, text: null, reason: 'no-callOpenAI' };
    }
    var messages = [
      { role: 'system', content: opts.system || '你是云境的文本增强引擎。只输出用户要求的内容，不要解释、不要加前缀。' },
      { role: 'user', content: String(prompt || '') }
    ];
    /* 记账：输入 token（用 TokenUsage 已有 recordRequest，tag 用增强项名） */
    try { if (global.TokenUsage && global.TokenUsage.recordRequest) global.TokenUsage.recordRequest(messages, '增强·' + tag); } catch(e){console.warn("[swallowed] ai-augment",e)}
    try {
      var text = await call(messages, {
        maxTokens: opts.maxTokens || 512,
        temperature: opts.temperature != null ? opts.temperature : 0.7
      });
      if (typeof text !== 'string' || !text.trim()) throw new Error('空响应');
      var clean = text.trim();
      /* 记账：调用数 + 输出 token（增强项口径） */
      state.cost[tag].calls++;
      state.cost[tag].tokIn += messages.reduce(function (a, m) { return a + estimateTok(m.content); }, 0);
      state.cost[tag].tokOut += estimateTok(clean);
      try { if (global.TokenUsage && global.TokenUsage.recordOutput) global.TokenUsage.recordOutput(clean, '增强·' + tag); } catch(e){console.warn("[swallowed] ai-augment",e)}
      var parsed = null;
      if (typeof opts.parse === 'function') {
        try { parsed = opts.parse(clean); } catch(e){console.warn("[swallowed] ai-augment",e)}
      }
      /* 奖励闸门：增强成功也算一次顺畅调用 */
      try { if (global.AIGovernor && global.AIGovernor.reward) global.AIGovernor.reward(); } catch(e){console.warn("[swallowed] ai-augment",e)}
      return { ok: true, sampled: true, fallback: false, text: clean, parsed: parsed };
    } catch (err) {
      state.errors++;
      state.fallbacks++;
      /* 惩罚闸门：限流/失败交给主笔接口内部的 MoNetGuard 处理，这里只记录 */
      return { ok: false, sampled: true, fallback: true, text: null, error: String((err && err.message) || err) };
    }
  }

  function status() {
    var total = { calls: 0, tokIn: 0, tokOut: 0 };
    Object.keys(state.cost).forEach(function (t) {
      total.calls += state.cost[t].calls;
      total.tokIn += state.cost[t].tokIn;
      total.tokOut += state.cost[t].tokOut;
    });
    return {
      enabled: state.enabled,
      tasks: JSON.parse(JSON.stringify(state.tasks)),
      counters: JSON.parse(JSON.stringify(state.counters)),
      cost: JSON.parse(JSON.stringify(state.cost)),
      total: total,
      errors: state.errors,
      fallbacks: state.fallbacks,
      taskDefs: JSON.parse(JSON.stringify(TASKS))
    };
  }

  function setEnabled(v) { state.enabled = !!v; persist(); return state.enabled; }
  function setTask(tag, v) {
    if (!state.tasks[tag]) return false;
    state.tasks[tag].enabled = !!v;
    persist();
    return true;
  }
  function resetStats() {
    Object.keys(state.cost).forEach(function (t) {
      state.cost[t] = { calls: 0, tokIn: 0, tokOut: 0 };
      state.counters[t] = 0;
    });
    state.errors = 0; state.fallbacks = 0;
    return true;
  }

  var API = {
    VERSION: VERSION,
    TASKS: TASKS,
    enhance: enhance,
    shouldCall: shouldCall,
    isTaskAvailable: isTaskAvailable,
    setEnabled: setEnabled,
    setTask: setTask,
    isEnabled: function () { return state.enabled; },
    status: status,
    resetStats: resetStats,
    _state: state
  };
  global.AIAugment = API;
})(typeof window !== 'undefined' ? window : globalThis);
