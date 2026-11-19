/* 云境 · 全局动态并发闸门 AIGovernor v1.0.0（v4.41.0）
 *
 * 为什么有它
 *   云境里有 6 类接口都会向上游大模型发真实请求（主笔/变量AI/动态世界/手机分身/提示词/生图/小云）。
 *   旧版只在「同一接口内」串行（MoNetGuard.Throttle），不同接口之间互不阻塞——
 *   玩家一次操作若同时开了动态世界+责编自审+变量AI+多候选，就能在同一秒打出 4~6 个并发请求。
 *   后果：① 更容易撞限流(429)→触发重试→烧更多额度；② 付费端点短时间内费用飙升；
 *        ③ 慢推理模型并发时互相拖累。玩家原话：「不希望云境让我在大模型这方面花很多钱」。
 *
 * 它做什么（严格按玩家拍板的三条口径）
 *   ① 动态并发上限，因人而异、偏保守——不是拍死的单一数字：
 *      · 起点保守（默认上限 2）；撞限流/5xx 自动收紧（最低 1）；连续顺畅逐步回升；
 *      · 玩家可在「并发偏好」里选 保守(1~2) / 均衡(2~3,默认) / 激进(3~5)，因机器/端点而异。
 *   ② 不设强制熔断——不因累计次数/费用到顶就拦玩家（玩家明确「不要闸」）。
 *      本模块只做「同时在途数」的排队，请求最终都会发出，只是别同一秒打爆端点。
 *      TokenUsage/UsagePanel 继续负责透明展示调用次数与花费估算（只记不拦）。
 *   ③ 额外付费功能（动态世界/责编自审/多候选）默认关 + 明示成本——见各模块文案，本模块不碰开关。
 *
 * 硬约束
 *   - 只排队、不丢弃、不拒绝：每个 acquire 最终一定 resolve（除非页面销毁）。
 *   - 有界等待：排队超时（默认 120s）后仍放行，绝不永久挂起玩家请求。
 *   - 单飞兼容：与 YJTurnBudget（单次操作重试预算）、MoNetGuard.Throttle（同接口间隔）叠加，
 *     三者管的是不同维度：本模块=跨接口并发数，Throttle=同接口节奏，TurnBudget=单次重试次数。
 *
 * 用法
 *   await AIGovernor.acquire('主笔');   // 发请求前排队
 *   try { ...fetch... } finally { AIGovernor.release('主笔'); }  // 无论成败都释放
 *   AIGovernor.penalize();              // 撞限流/5xx 时调用，收紧上限
 *   AIGovernor.reward();                // 成功时调用，逐步回升
 */
(function () {
  'use strict';

  var LS_KEY = 'yj_ai_concurrency_pref_v1';
  /* 偏好档：min/max 是动态上限的活动区间。默认 balanced（2~3，起点 2 偏保守）。 */
  var PRESETS = {
    frugal:    { label: '保守', min: 1, max: 2, start: 1 },
    balanced:  { label: '均衡', min: 2, max: 3, start: 2 },
    aggressive:{ label: '激进', min: 3, max: 5, start: 3 }
  };
  var WAIT_TIMEOUT_MS = 120000;   // 有界等待：排队最久 2 分钟仍放行

  var pref = 'balanced';
  var limit = 2;          // 当前动态上限
  var inflight = 0;       // 在途请求数
  var queue = [];         // 等待者 [{resolve}]
  var successStreak = 0;  // 连续成功计数（用于回升）
  var penalizedUntil = 0; // 收紧后的冷静期时间戳

  function loadPref() {
    try {
      var v = (localStorage.getItem(LS_KEY) || '').trim();
      if (PRESETS[v]) return v;
    } catch (e) {}
    /* 老玩家/新玩家都从均衡偏保守起步 */
    return 'balanced';
  }
  function preset() { return PRESETS[pref] || PRESETS.balanced; }

  function init() {
    pref = loadPref();
    limit = preset().start;
  }
  init();

  /** 放行等待队列中所有还能启动的请求 */
  function pump() {
    while (inflight < limit && queue.length) {
      var item = queue.shift();
      if (item.timer) { try { clearTimeout(item.timer); } catch (e) {} }
      inflight++;
      item.resolve();
    }
  }

  /** 发请求前排队，resolve 时表示拿到一个并发名额 */
  function acquire(tag) {
    return new Promise(function (resolve) {
      if (inflight < limit && !queue.length) { inflight++; resolve(); return; }
      var item = { tag: tag || '', resolve: function () { resolve(); } };
      /* 有界等待：超时后强制放行，绝不永久挂起 */
      item.timer = setTimeout(function () {
        var idx = queue.indexOf(item);
        if (idx >= 0) queue.splice(idx, 1);
        inflight++;
        resolve();
      }, WAIT_TIMEOUT_MS);
      queue.push(item);
    });
  }

  /** 请求结束（成功或失败）后释放名额 */
  function release(tag) {
    inflight = Math.max(0, inflight - 1);
    pump();
  }

  /** 撞限流(429)/5xx：立即收紧上限到该档下限，进入冷静期，清连续成功计数 */
  function penalize() {
    var p = preset();
    limit = p.min;
    successStreak = 0;
    penalizedUntil = Date.now() + 30000;  // 30s 冷静期，期间不回升
    pump();
  }

  /** 成功一次：冷静期后累计到阈值就回升一格（渐进，不突进） */
  function reward() {
    if (Date.now() < penalizedUntil) return;
    var p = preset();
    if (limit >= p.max) { successStreak = 0; return; }
    successStreak++;
    /* 连续 4 次顺畅才回升一格，避免抖动 */
    if (successStreak >= 4) {
      limit = Math.min(p.max, limit + 1);
      successStreak = 0;
      pump();
    }
  }

  /** 玩家切换偏好档：即时生效（在途不打断），上限重置为该档起点 */
  function setPref(v) {
    if (!PRESETS[v]) return false;
    pref = v;
    limit = preset().start;
    successStreak = 0;
    penalizedUntil = 0;
    try { localStorage.setItem(LS_KEY, v); } catch (e) {}
    pump();
    return true;
  }
  function getPref() { return pref; }
  function prefLabel() { return preset().label; }

  /** 供用量面板/诊断展示的瞬时快照 */
  function status() {
    return {
      pref: pref, label: prefLabel(), limit: limit, inflight: inflight,
      queued: queue.length, min: preset().min, max: preset().max,
      penalized: Date.now() < penalizedUntil
    };
  }

  /** 一次性包装：await AIGovernor.run(tag, () => fetch(...)) —— 自带 try/finally 释放 */
  async function run(tag, fn) {
    await acquire(tag);
    try { return await fn(); }
    finally { release(tag); }
  }

  window.AIGovernor = {
    PRESETS: PRESETS,
    acquire: acquire, release: release, run: run,
    penalize: penalize, reward: reward,
    setPref: setPref, getPref: getPref, prefLabel: prefLabel,
    status: status
  };
})();
