/* 云境 · 网络防护层 v1.0.0（v3.47.14）
   职责三件事，全部集中在此，避免散落在各调用路径：
   1) 429/5xx/网络错误 → 指数退避重试（Retry-After 优先，抖动，可中断）
   2) 响应被 max_tokens 截断 → 自动续写（把已写内容作为上下文，要求"从断点接着写"，最多 N 轮）
   3) 空回复 → 判定并向上层暴露，由上层走重写通道（不在此层强改业务）
   设计原则：全部可关闭、全部有上限、全部有日志，任何一环失败都不阻断主流程。 */
(function () {
  'use strict';

  var CFG = {
    maxRetries: 4,          // 429/5xx 最多重试次数（不含首次）
    baseDelayMs: 1200,      // 首次退避基数
    maxDelayMs: 20000,      // 单次退避上限
    jitter: 0.25,           // 抖动比例，避免多标签页同时重试
    retryOnStatus: [408, 425, 429, 500, 502, 503, 504, 520, 522, 524],
    maxContinuations: 2,    // 截断续写最多轮数（避免无限烧 token）
    minTruncatedChars: 200  // 少于这个长度不判定为"被截断"，多半是模型拒答/空回
  };

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  /** 解析 Retry-After（秒数或 HTTP 日期），失败返回 0 */
  function parseRetryAfter(resp) {
    try {
      var v = resp.headers.get('retry-after') || resp.headers.get('x-ratelimit-reset-requests');
      if (!v) return 0;
      if (/^\d+(\.\d+)?$/.test(v.trim())) return Math.round(parseFloat(v) * 1000);
      var t = Date.parse(v);
      if (!isNaN(t)) return Math.max(0, t - Date.now());
    } catch (e) {}
    return 0;
  }

  /** 计算退避时长：指数 + 抖动，Retry-After 优先 */
  function backoffMs(attempt, retryAfterMs) {
    if (retryAfterMs > 0) return Math.min(retryAfterMs, CFG.maxDelayMs);
    var base = CFG.baseDelayMs * Math.pow(2, attempt);
    var jit = base * CFG.jitter * (Math.random() * 2 - 1);
    return Math.max(300, Math.min(base + jit, CFG.maxDelayMs));
  }

  function shouldRetry(status) {
    return CFG.retryOnStatus.indexOf(status) >= 0;
  }

  /* ==================== 前置节流（v3.47.16） ====================
     借鉴自成熟预设"防429 分两层"的思路：退避重试是被动挨打，节流才是主动避让。
     云境同时跑 6 个接口（主笔/动态世界/变量AI/生图/提示词/手机），
     玩家连点、开篇多轮补全、变量AI 与主笔同轮触发——极易在同一秒打出多个请求。
     机制：
       1) 同 key 串行 + 最小间隔（并发请求排队，不并发打）
       2) 自适应：撞 429 就把该接口的间隔 ×2（上限 maxGapMs），连续成功再逐步回落
     设计约束：只在"同一接口"内串行，不同接口互不阻塞（避免一个慢接口拖死全部）。 */
  var Throttle = (function () {
    var TCFG = {
      baseGapMs: 350,        // 正常情况下的最小请求间隔
      maxGapMs: 12000,       // 自适应上限（撞限流后最多拉长到这么慢）
      recoverStep: 0.82,     // 每次成功后间隔收缩比例（渐进恢复，不突进）
      minGapMs: 120,
      perKey: {}             // key -> {last:0, gap:baseGapMs, chain:Promise}
    };

    function stateOf(key) {
      if (!TCFG.perKey[key]) TCFG.perKey[key] = { last: 0, gap: TCFG.baseGapMs, chain: Promise.resolve() };
      return TCFG.perKey[key];
    }

    /** 排队获取发送许可：返回 Promise，resolve 时表示"现在可以发了" */
    function acquire(key) {
      var st = stateOf(key);
      // 挂在链上实现同 key 串行
      st.chain = st.chain.then(function () {
        return new Promise(function (resolve) {
          var wait = st.last + st.gap - Date.now();
          if (wait <= 0) { st.last = Date.now(); resolve(); return; }
          setTimeout(function () { st.last = Date.now(); resolve(); }, wait);
        });
      }).catch(function () {});
      return st.chain;
    }

    /** 撞限流：拉长该接口的间隔 */
    function penalize(key, retryAfterMs) {
      var st = stateOf(key);
      st.gap = Math.min(TCFG.maxGapMs, Math.max(st.gap * 2, retryAfterMs || 0, TCFG.baseGapMs * 2));
      return st.gap;
    }

    /** 成功一次：逐步回落 */
    function reward(key) {
      var st = stateOf(key);
      if (st.gap > TCFG.baseGapMs) {
        st.gap = Math.max(TCFG.baseGapMs, st.gap * TCFG.recoverStep);
      }
    }

    function snapshot() {
      var out = {};
      Object.keys(TCFG.perKey).forEach(function (k) {
        out[k] = Math.round(TCFG.perKey[k].gap);
      });
      return out;
    }

    function reset() { TCFG.perKey = {}; }

    return { acquire: acquire, penalize: penalize, reward: reward, snapshot: snapshot, reset: reset, CFG: TCFG };
  })();

  function notify(msg, level) {
    try {
      var h = (typeof window !== 'undefined' && window.StoryResponseHandler) || null;
      if (h && typeof h.renderSystemMessage === 'function') {
        h.renderSystemMessage(msg, level || 'info');
        return;
      }
    } catch (e) {}
    try { console.warn('[云境·网络]', msg); } catch (e) {}
  }

  /**
   * 带退避重试的 fetch。
   * @param {Function} doFetch  返回 Promise<Response> 的工厂（每次重试重新调用，便于重放 body）
   * @param {Object} opts       {label, silent, maxRetries}
   */
  async function fetchWithRetry(doFetch, opts) {
    opts = opts || {};
    var max = typeof opts.maxRetries === 'number' ? opts.maxRetries : CFG.maxRetries;
    var label = opts.label || 'API';
    var lastErr = null;
    for (var attempt = 0; attempt <= max; attempt++) {
      var resp = null;
      try {
        // v3.47.16 前置节流：先排队再发，尽量避免撞上限流（被动重试只是兜底）
        await Throttle.acquire(opts.throttleKey || label);
        resp = await doFetch();
      } catch (netErr) {
        // 网络层异常（DNS/断网/超时）——不重试超时类，避免拖死整体等待
        lastErr = netErr;
        var isTimeout = /超时|timeout|TimeoutError|AbortError/i.test(String(netErr && netErr.message || ''));
        if (isTimeout && attempt >= 1) throw netErr;
        if (attempt >= max) throw netErr;
        var d0 = backoffMs(attempt, 0);
        if (!opts.silent) notify('⚠ ' + label + ' 网络异常（' + (netErr.message || '').slice(0, 60) + '），' + Math.round(d0 / 1000) + ' 秒后重试（' + (attempt + 1) + '/' + max + '）', 'warn');
        await sleep(d0);
        continue;
      }
      if (resp.ok) {
        Throttle.reward(opts.throttleKey || label);
        return resp;
      }
      // 非 2xx
      if (!shouldRetry(resp.status)) {
        var txt = '';
        try { txt = await resp.clone().text(); } catch (e) {}
        var e2 = new Error(label + '请求失败: ' + resp.status + ' ' + resp.statusText + ' ' + String(txt).slice(0, 200));
        e2.isHttpError = true;
        e2.status = resp.status;
        throw e2;
      }
      if (attempt >= max) {
        var txt2 = '';
        try { txt2 = await resp.clone().text(); } catch (e) {}
        var e3 = new Error(label + '请求失败（已重试 ' + max + ' 次）: ' + resp.status + ' ' + resp.statusText + ' ' + String(txt2).slice(0, 160));
        e3.isHttpError = true;
        e3.status = resp.status;
        throw e3;
      }
      var ra = parseRetryAfter(resp);
      var d = backoffMs(attempt, ra);
      // 撞限流/5xx：把该接口的常态间隔也拉长，避免"重试成功后又立刻撞上"
      var newGap = Throttle.penalize(opts.throttleKey || label, ra);
      var reason = resp.status === 429 ? '限流(429)' : ('服务端错误(' + resp.status + ')');
      if (!opts.silent) notify('⚠ ' + label + ' ' + reason + '，' + Math.round(d / 1000) + ' 秒后自动重试（' + (attempt + 1) + '/' + max + '）' + (ra ? '［按服务端 Retry-After］' : '') + '；本接口请求间隔已放宽至 ' + Math.round(newGap) + 'ms', 'warn');
      try { await resp.body && resp.body.cancel && resp.body.cancel(); } catch (e) {}
      await sleep(d);
    }
    throw lastErr || new Error(label + ' 请求失败');
  }

  /**
   * 判断回复是否疑似被 max_tokens 截断。
   * 设计要点（v3.47.16 修订）：
   *  - 协议块优先：(variable_update) 开了没关 → 必续
   *  - 行动选项段优先：只要检测到【行动选项】且其后有 3 条以上编号选项，视为协议完整收尾
   *    （选项本来就不带句末标点，旧逻辑会把它当"半句截断"误报——这是 v3.47.15 的真实误判）
   *  - 其余看结尾字符：句末标点收束完整；逗号/破折号/无标点长末行 → 截断
   */
  function looksTruncated(text) {
    var t = String(text || '').trim();
    if (!t) return false;
    // ① 变量块开了没关，必定要续（协议块必须成对）
    var opens = (t.match(/\(variable_update\)/g) || []).length;
    var closes = (t.match(/\(\/variable_update\)/g) || []).length;
    if (opens > closes) return true;
    // ② 行动选项已完整列出（≥3 条编号项）→ 视为正常收尾，不再判截断
    var optIdx = Math.max(t.lastIndexOf('【行动选项】'), t.lastIndexOf('行动选项：'), t.lastIndexOf('行动选项:'));
    if (optIdx >= 0) {
      var optPart = t.slice(optIdx);
      var items = optPart.match(/(^|\n)\s*(?:[A-Da-d]|\d+)[.、．)]/g) || [];
      if (items.length >= 3) return false;
    }
    // ③ 结尾是句末标点 → 收束完整
    if (/[。！？…”』」）\)\*～~]\s*$/.test(t)) return false;
    // ④ 结尾是"半句"标点 → 明确截断
    if (/[，、,；;：:—\-]\s*$/.test(t)) return true;
    // ⑤ 结尾无任何标点：末行有实质内容（≥8 字）即视作中途被切
    var lastLine = t.split('\n').pop() || '';
    return lastLine.trim().length >= 8;
  }

  /**
   * 截断续写：把已生成内容作为 assistant 前缀，要求模型从断点续写。
   * @param {Array} messages 原始 messages
   * @param {String} partial 已生成的部分文本
   * @param {Function} callFn  (messages, opts) => Promise<string> 实际调用函数
   * @param {Number} rounds  允许续写轮数
   * @returns {Promise<string>} 拼接后的完整文本
   */
  async function continueIfTruncated(messages, partial, callFn, rounds) {
    var max = typeof rounds === 'number' ? rounds : CFG.maxContinuations;
    var text = String(partial || '');
    for (var i = 0; i < max; i++) {
      if (!looksTruncated(text)) break;
      var tailText = text.slice(-600);
      var contMsg = messages.concat([
        { role: 'assistant', content: text },
        { role: 'system', content: '【续写指令】上一段输出因长度上限被截断。请**直接从截断处接着写**：不要重复已写内容，不要重新开头，不要加任何说明或道歉。保持同样的文风、人称与节奏。结尾处同理补全 (variable_update) 块与【行动选项】。\n\n上一段结尾是（仅供你定位，勿重抄）："…' + tailText + '"' }
      ]);
      notify('✂ 检测到输出被长度上限截断，正在续写（' + (i + 1) + '/' + max + '）…', 'info');
      var more = '';
      try {
        more = await callFn(contMsg, { isContinuation: true });
      } catch (e) {
        console.warn('[云境·续写] 失败：', e);
        break;
      }
      more = String(more || '').trim();
      if (!more) break;
      // 去掉模型可能重复的开头标点或书名
      more = more.replace(/^[\s"'“”『「]*/, '');
      text = text.replace(/\s+$/, '') + (needsNewline(text, more) ? '\n' : '') + more;
    }
    return text;
  }

  function needsNewline(prev, next) {
    if (!prev) return false;
    var endedLine = /\n$/.test(prev);
    var startsBlock = /^(【|\()/.test(next);
    return !endedLine && startsBlock;
  }

  window.MoNetGuard = {
    CFG: CFG,
    fetchWithRetry: fetchWithRetry,
    continueIfTruncated: continueIfTruncated,
    looksTruncated: looksTruncated,
    backoffMs: backoffMs,
    parseRetryAfter: parseRetryAfter,
    Throttle: Throttle
  };
})();
