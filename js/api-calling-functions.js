window.TokenUsage = {
  /** 中文语境估算：字符数 → token */
  estimate(text) {
    return Math.round(String(text || "").length / 1.6);
  },
  /** 请求侧记账：system 层与历史层分开计，tag 区分接口（主笔/变量AI/灵感/世界） */
  recordRequest(messages, tag) {
    try {
      const st = this._state();
      let sysChars = 0, histChars = 0;
      (Array.isArray(messages) ? messages : []).forEach((m) => {
        const len = String(m && m.content || "").length;
        if (m && m.role === "system") sysChars += len;
        else histChars += len;
      });
      const entry = {
        tag: tag || "主笔",
        sysTok: Math.round(sysChars / 1.6),
        histTok: Math.round(histChars / 1.6),
        outTok: 0,
        at: Date.now()
      };
      entry.inTok = entry.sysTok + entry.histTok;
      st.last = entry;
      st.byTag = st.byTag || {};
      const agg = st.byTag[entry.tag] || (st.byTag[entry.tag] = { inTok: 0, outTok: 0, requests: 0 });
      agg.inTok += entry.inTok;
      agg.requests += 1;
      st.total.inTok += entry.inTok;
      st.total.requests += 1;
      return entry;
    } catch (e) {
    }
    return null;
  },
  /** 回复侧记账（输出 token；同一 tag 的末次请求累加） */
  recordOutput(text, tag) {
    try {
      if (!text) return;
      const st = this._state();
      const outTok = this.estimate(text);
      const t = tag || st.last && st.last.tag || "主笔";
      if (st.last && st.last.tag === t) st.last.outTok += outTok;
      const agg = st.byTag && st.byTag[t];
      if (agg) agg.outTok += outTok;
      st.total.outTok += outTok;
    } catch (e) {
    }
  },
  /** 面板读取入口 */
  get() {
    return this._state();
  },
  /** 清零（新开书 / 清档时由框架调用） */
  reset() {
    const fresh = { last: null, byTag: {}, total: { inTok: 0, outTok: 0, requests: 0 } };
    const s = window.storyFramework && window.storyFramework.storyState;
    if (s) s.tokenUsage = JSON.parse(JSON.stringify(fresh));
    this._mem = JSON.parse(JSON.stringify(fresh));
  },
  /** 记账数据源：优先挂 storyState（随存档持久化），无框架时退化为内存对象 */
  _state() {
    const s = window.storyFramework && window.storyFramework.storyState;
    if (s) {
      if (!s.tokenUsage || !s.tokenUsage.total) {
        s.tokenUsage = { last: null, byTag: {}, total: { inTok: 0, outTok: 0, requests: 0 } };
      }
      return s.tokenUsage;
    }
    if (!this._mem || !this._mem.total) {
      this._mem = { last: null, byTag: {}, total: { inTok: 0, outTok: 0, requests: 0 } };
    }
    return this._mem;
  },
  /** 数值格式化：1.2k / 34k，供面板与控制台共用 */
  fmt(n) {
    const x = Number(n) || 0;
    return x >= 1e4 ? (x / 1e4).toFixed(1) + "w" : x >= 1e3 ? (x / 1e3).toFixed(1) + "k" : String(x);
  }
};
const STREAM_FIRST_MS = 6e4;
/* v4.16.0：推理模型的「首字节超时」必须放宽。
   推理模型的思考发生在**首字节之前**——实测 z-ai/glm-5.3-flash 在这条上游单次
   要 231~520 秒才吐第一个字节；而旧逻辑一律 min(60s, 用户超时)，
   于是这类模型在流式模式下必然被应用自己掐断（玩家只看到反复超时、永不成功）。
   非推理模型仍保留 60 秒下限（它们本就该秒回，卡住说明链路有问题）。 */
const STREAM_FIRST_MS_REASON = 3e5;   // 推理模型首字节给到 300 秒

/* 首字节超时的统一取值：推理模型 300s，其余 60s；且永不超过用户设定的总超时。
   注意仍保留「不超过 fullMs」——玩家把总超时调小是明确意图，要尊重。 */
function firstByteMs(cfg, fullMs) {
  var reason = false;
  try { reason = !!(window.isReasoningModel && cfg && window.isReasoningModel(cfg.model)); } catch (e) { }
  var base = reason ? STREAM_FIRST_MS_REASON : STREAM_FIRST_MS;
  return Math.min(base, fullMs);
}
function fetchWithTimeout(url, opts = {}, timeoutMs = 3e5, guardOpts = {}) {
  const ms = timeoutMs && timeoutMs > 0 ? timeoutMs : 3e5;
  /** 单次尝试：独立 AbortController，避免重试共用已 abort 的 signal */
  const once = () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    /* v4.08.0 外部取消：此前这里无条件覆盖 opts.signal，调用方无法中断请求，
       玩家面对 150s+ 的慢响应只能干等。现在把外部 signal（用户点「停止生成」）接到
       同一个 controller 上，任一触发都终止这次 fetch。 */
    let extAbort = null;
    const ext = guardOpts.signal || (opts && opts.signal);
    if (ext) {
      if (ext.aborted) {
        try { controller.abort(); } catch (e) {}
      } else if (typeof ext.addEventListener === "function") {
        extAbort = () => { try { controller.abort(); } catch (e) {} };
        ext.addEventListener("abort", extAbort, { once: true });
      }
    }
    return fetch(url, { ...opts, signal: controller.signal }).finally(() => {
      clearTimeout(timer);
      if (extAbort && ext && typeof ext.removeEventListener === "function") {
        try { ext.removeEventListener("abort", extAbort); } catch (e) {}
      }
    });
  };
  // v3.47.14 防 429/5xx：统一走 MoNetGuard 指数退避重试（Retry-After 优先）
  // 流式请求只对"建连阶段"生效——读到首个响应头即返回，不阻塞后续 SSE 读取
  // v3.47.16 前置节流：不同接口用不同 throttleKey 分队列，互不拖累；
  //   默认 key = label，未指定时按"主笔"处理（callStoryAI 是最热的路径）
  if (window.MoNetGuard && window.MoNetGuard.fetchWithRetry) {
    return window.MoNetGuard.fetchWithRetry(once, {
      label: guardOpts.label || "AI 接口",
      silent: guardOpts.silent !== undefined ? guardOpts.silent : false,
      throttleKey: guardOpts.throttleKey || guardOpts.label || "主笔",
    });
  }
  return once();
}
function secsToMs(secs, fallbackSecs) {
  const s = typeof secs === "number" && secs > 0 ? secs : fallbackSecs;
  return s * 1e3;
}
function withTimeoutMs(promise, ms) {
  const t = ms && ms > 0 ? ms : 3e5;
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const e = new Error("body read timeout");
      e.name = "AbortError";
      reject(e);
    }, t);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
function readErrBody(response, ms = 15e3) {
  return withTimeoutMs(response.text(), ms).catch(() => "");
}
// v3.70.0 性能：同段文本去 AI 味只算一次（一轮内多处复用同一回复时省去重复正则）
var _thinkCacheKeys = [];
var _thinkCacheMap = Object.create(null);
window.stripAIThink = function(text) {
  let s = String(text == null ? "" : text);
  if (!s) return s;
  if (_thinkCacheMap[s] !== undefined) return _thinkCacheMap[s];
  var out = s.replace(/<think(?:\s[^>]*)?>[\s\S]*?<\/think\s*>/gi, "");
  out = out.replace(/<think(?:\s[^>]*)?>[\s\S]*$/i, "");
  out = out.replace(/<\/think\s*>/gi, "");
  if (_thinkCacheKeys.length > 8) { var _old = _thinkCacheKeys.shift(); delete _thinkCacheMap[_old]; }
  _thinkCacheKeys.push(s); _thinkCacheMap[s] = out;
  return out;
};

/* ==================== v4.16.0 · 推理模型（reasoning）防护 ====================
   发现来源：第三方全量审查 + 真实玩家实测（z-ai/glm-5.3-flash / Nemotron / o 系等）。

   问题：推理模型把思考写在 **provider 级字段 reasoning_content**，而不是正文里的
   `<thinking>` 标签——所以 stripAIThink() 的正则完全管不到它。而思考与正文**共享
   max_tokens**，预算被思考吃掉时 content 就是空的。实测 glm-5.3-flash：
     max_tokens=400  → content 0 字 / reasoning_tokens=400 / finish=length
   旧代码在 content 为空时用 reasoningBuf / reasoning_content 兜底，后果是：
     ① 英文思维链被当成**正文**渲染（实测出现「Reconciliation A/B/C」整段推演）；
     ② 思维链里的编号行被解析成**情节走向选项**（①陆青崖 is 太玄门外门记名弟子 NOW）；
     ③ 同一兜底散落在 8 处以上（variable-ai / dynamic-world / prompt-engineer /
        image-gen / phone-panel），思维链还会被当成**变量与世界事件写进存档**。
   这与「模型无关自适应」的产品承诺直接冲突，故按 P0 处理。

   策略：content 为空时**一律不拿思维链顶替**；改由调用方①给推理模型抬高出力下限、
   ②在空正文时翻倍预算重试一次、③仍为空则明确报错，让玩家知道发生了什么。
   仅在「中转站只回 reasoning_content 且内容读起来不像推演」时才允许兜底（默认关）。 */

/* 判断文本是否「像未加标签的原始思维链」。
 *
 * v4.17.0 修（本会话实测发现的真实缺陷）：
 *   旧版最后一条是 `cjk === 0 && latin > 200 → 判为思维链`，注释写着「本应用全中文」。
 *   但云境对玩家**零语言限制**——用英文写小说的玩家，正文必然是纯拉丁字母，
 *   于是会被这条规则整篇判成思维链：反复重写、永远出不了文。
 *   这与「写英文的玩家不该被中文规则误杀」是同一个必须修的问题
 *   （语种守卫在 v4.16.0 已按玩家输入推断语种，这里当时漏改了）。
 *   现在把「纯英文长文本」这条也改为**按玩家自己用什么语言写**来判断：
 *   玩家用中文而模型回英文 → 可疑（保留拦）；玩家用英文 → 正常（放行）。
 * @param {string} text   待判定文本
 * @param {string} [sample] 玩家最近的输入，用于推断期望语种
 */
window.looksLikeRawReasoning = function (text, sample) {
  var s = String(text == null ? "" : text).trim();
  if (!s) return false;
  if (s.length > 4000) return true;                        /* 超长推演几乎必是思维链 */
  var head = s.slice(0, 900);
  /* 英文推演开场 —— 这些词无论玩家用什么语言都不像小说正文开场，照拦 */
  if (/^(?:we need|we must|let me|let's|i need|i should|i'll|first,? i|okay|hmm|so how|the user wants|reconciliation|analysis:|reasoning:|step \d)/i.test(head)) return true;
  if (/\b(?:the user wants|we need to|let me (?:write|think|reconsider|check)|reconciliation [abc]|must avoid|clich[eé]|max_tokens|system prompt|输出要求)\b/i.test(head)) return true;

  var cjk = (s.match(/[\u4e00-\u9fff]/g) || []).length;
  var latin = (s.match(/[A-Za-z]/g) || []).length;

  /* 玩家期望语种：有样本就按样本推断，没有样本时保守按中文（产品默认） */
  var expectLatin = false;
  try {
    var smp = String(sample == null ? "" : sample);
    if (smp) {
      var sc = (smp.match(/[\u4e00-\u9fff]/g) || []).length;
      var sl = (smp.match(/[A-Za-z]/g) || []).length;
      expectLatin = sl > sc;
    }
  } catch (e) { }

  /* 中英混排：中文语境里成段英文推演（玩家用英文时不适用） */
  if (!expectLatin && cjk > 0 && latin > cjk * 1.5 && latin > 120) return true;
  /* 纯英文长文本：**仅当玩家自己写的是中文**时才可疑 */
  if (!expectLatin && cjk === 0 && latin > 200) return true;
  return false;
};

/* 已知推理模型家族：content 可能为空，且需要更大的输出预算。
   仅用于「抬高出力下限 / 空正文时重试」，不影响任何路由决策。 */
window.isReasoningModel = function (name) {
  var n = String(name || "").toLowerCase().trim();
  if (!n) return false;
  return /(?:^|[\/\-_.])(?:o1|o3|o4|o5)(?:$|[\-_.])|reason|thinking|(?:^|[\/\-_.])r1(?:$|[\-_.])|qwq|glm-?[5-9]|kimi-k2|nemotron|deepseek-(?:r\d|v[4-9])|gpt-5|magistral|seed-oss|step-?5|minimax-m[2-9]|grok-[4-9]|ernie-?[5-9]/.test(n);
};

/* 统一正文提取：content 优先；**绝不用未加标签的思维链顶替正文**。
   opts.allowReasoningFallback=true 时才在「内容不像推演」的前提下兜底（默认关）。 */
window.extractAssistantText = function (msg, opts) {
  if (!msg || typeof msg !== "object") return "";
  var c = msg.content;
  if (Array.isArray(c)) {
    c = c.map(function (p) { return typeof p === "string" ? p : (p && (p.text || p.content)) || ""; }).join("");
  }
  if (typeof c === "string" && c.trim()) return window.stripAIThink(c);
  var r = typeof msg.reasoning_content === "string" ? msg.reasoning_content : "";
  if (!r.trim()) return "";
  if (opts && opts.allowReasoningFallback && !window.looksLikeRawReasoning(r)) {
    return window.stripAIThink(r);
  }
  return "";
};
async function readSSEStream(response, opts = {}) {
  const { onDelta, extract, idleMs = 3e5, firstIdleMs } = opts;
  /* v3.55.14 防跑飞：辅助AI（变量/舞台/记忆）在部分模型上会无视 max_tokens 无限复读，
     实测出现过 197KB/254KB 的失控流。传入 maxChars 即硬截断，超限立即停止累积。
     主笔正文不传此项（默认 0=不限），不受影响。 */
  const maxChars = Number(opts.maxChars) || 0;
  let capped = false;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let timer = null;
  /* v4.08.0 修复：idlePromise 原本是**单例**——只 reject 一次，且首字节超时与
     流中空闲超时抛出的错误完全相同（name=AbortError / message="stream idle"），
     上层无法区分「服务器根本没开始输出」与「输出中途卡住」，提示与重试策略也就没法分开。
     现在每次 armIdle 都新建一个 promise，并给错误打上 phase 标记（'first' / 'idle'）。
     顺带修掉：旧实现里若定时器在两次 read 之间触发，会产生一个无人接管的 rejection。 */
  let idlePromise = null;
  let idleReject = null;
  const makeIdlePromise = () => {
    idlePromise = new Promise((_, reject) => { idleReject = reject; });
    return idlePromise;
  };
  let gotAnyByte = false;
  const armIdle = () => {
    clearTimeout(timer);
    const base = gotAnyByte ? idleMs : firstIdleMs || idleMs;
    const phase = gotAnyByte ? "idle" : "first";
    const p = makeIdlePromise();
    timer = setTimeout(() => {
      const e = new Error(gotAnyByte ? "stream idle" : "stream first-byte timeout");
      e.name = "AbortError";
      e.streamPhase = phase;
      e.isTimeout = true;
      if (idleReject) idleReject(e);
      try {
        reader.cancel();
      } catch (err) {
      }
    }, base && base > 0 ? base : 3e5);
    return p;
  };
  let buffer = "";
  let full = "";
  let raceIdle = armIdle();
  try {
    while (true) {
      const chunk = await Promise.race([reader.read(), raceIdle]);
      if (chunk.done) break;
      if (!gotAnyByte) {
        gotAnyByte = true;
      }
      raceIdle = armIdle();
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        processLine(line);
        if (capped) break;
      }
      if (capped) break;
    }
    buffer += decoder.decode();
    if (buffer) processLine(buffer);
  } finally {
    clearTimeout(timer);
    try {
      reader.cancel();
    } catch (e) {
    }
  }
  if (typeof opts.finish === "function") {
    try {
      return opts.finish(full) || full;
    } catch (e) {
      return full;
    }
  }
  return full;
  function processLine(line) {
    const t = line.trim();
    if (!t.startsWith("data:")) return;
    const payload = t.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    let delta = "";
    try {
      delta = extract(JSON.parse(payload)) || "";
    } catch (e) {
      return;
    }
    if (delta) {
      full += delta;
      if (maxChars > 0 && full.length >= maxChars) {
        full = full.slice(0, maxChars);
        capped = true;
      }
      if (onDelta) onDelta(delta, full);
    }
  }
}
function isEventStream(response) {
  const ct = response.headers && (response.headers.get ? response.headers.get("content-type") : "") || "";
  return /text\/event-stream/i.test(String(ct));
}
function getFullEndpoint(baseEndpoint, apiType) {
  let endpoint = baseEndpoint.trim();
  endpoint = endpoint.replace(/\/+$/, "");
  if (apiType === "openai" || apiType === "custom") {
    if (!endpoint.includes("/chat/completions")) {
      endpoint = endpoint + "/chat/completions";
    }
  }
  return endpoint;
}
function getModelsEndpoint(baseEndpoint, apiType) {
  let endpoint = baseEndpoint.trim();
  endpoint = endpoint.replace(/\/+$/, "");
  if (apiType === "gemini") {
    return endpoint + "/models?key=";
  }
  if (endpoint.endsWith("/chat/completions")) {
    endpoint = endpoint.replace("/chat/completions", "");
  }
  return endpoint + "/models";
}
async function fetchOpenAIModels(baseEndpoint, apiKey) {
  const modelsEndpoint = getModelsEndpoint(baseEndpoint, "openai");
  const response = await fetchWithTimeout(modelsEndpoint, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    }
  }, 2e4);
  if (!response.ok) {
    const error = await readErrBody(response);
    throw new Error(`获取模型失败: ${response.status} - ${String(error).substring(0, 100)}`);
  }
  const data = await withTimeoutMs(response.json(), 2e4);
  if (data.data && Array.isArray(data.data)) {
    return data.data.map((m) => m.id).sort();
  }
  return [];
}
async function fetchGeminiModels(baseEndpoint, apiKey) {
  const modelsEndpoint = getModelsEndpoint(baseEndpoint, "gemini") + apiKey;
  const response = await fetchWithTimeout(modelsEndpoint, {
    method: "GET",
    headers: { "Content-Type": "application/json" }
  }, 2e4);
  if (!response.ok) {
    const error = await readErrBody(response);
    throw new Error(`获取Gemini模型失败: ${response.status} - ${String(error).substring(0, 100)}`);
  }
  const data = await withTimeoutMs(response.json(), 2e4);
  if (data.models && Array.isArray(data.models)) {
    return data.models.map((m) => m.name.replace("models/", "")).sort();
  }
  return [];
}
async function callOpenAIOnce(messages, opts = {}, cfgOverride) {
  var _a, _b;
  const fw = window.storyFramework;
  const cfg = cfgOverride || fw.apiConfig;
  const fullEndpoint = getFullEndpoint(cfg.endpoint, "openai");
  const fullMs = secsToMs(cfg.timeout, 300);
  if (cfg.stream === false) {
    return await callOpenAINonStream(messages, cfg, fullEndpoint, fullMs, opts);
  }
  const firstMs = firstByteMs(cfg, fullMs);
  let sawDelta = false;
  try {
    const response = await fetchWithTimeout(fullEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${cfg.apiKey}`
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: Number.isFinite(cfg.temperature) ? cfg.temperature : 0.9, /* v3.68.0 falsy修复：用户明确设 0 不再被吞 */
        // v3.47.10 反狂奔：实测 0.4/0.3 会加剧中文同义词罗列与标点消失，降至 0.15/0.1（cfg 可覆盖，设为 0 即禁用）
        frequency_penalty: (_a = cfg.frequencyPenalty) != null ? _a : 0.15,
        presence_penalty: (_b = cfg.presencePenalty) != null ? _b : 0.1,
        /* v3.53.0：opts.maxTokens 允许单次调用压小上限（补协议块 / 轻量纠偏），
           不再被迫跟着全局 16384 跑满——中转站慢时这一点尤其重要 */
        max_tokens: (opts && opts.maxTokens) || cfg.maxTokens || 16384,
        stream: true
      })
    }, firstMs, { label: "主笔", throttleKey: "主笔", signal: opts && opts.signal });
    if (!response.ok) {
      const errText = await readErrBody(response);
      const e = new Error(`API请求失败: ${response.status} ${response.statusText} ${errText.slice(0, 200)}`);
      e.isHttpError = true;
      throw e;
    }
    if (isEventStream(response)) {
      let sawContent = false, reasoningBuf = "";
      const full = await readSSEStream(response, {
        onDelta: (d, f) => {
          sawDelta = true;
          if (opts.onDelta) opts.onDelta(d, f);
        },
        firstIdleMs: firstMs,
        idleMs: fullMs,
        extract: (json) => {
          const d = json.choices && json.choices[0] && json.choices[0].delta;
          if (!d) return "";
          if (typeof d.content === "string" && d.content) {
            sawContent = true;
            return d.content;
          }
          if (!sawContent && typeof d.reasoning_content === "string") reasoningBuf += d.reasoning_content;
          return "";
        },
        /* v4.16.0：旧实现 `finish: (f) => f && f.trim() ? f : reasoningBuf` 会在
           content 为空时把**原始思维链**当正文交出去（详见文件头「推理模型防护」）。
           现在只有「内容读起来不像推演」时才兜底，否则返回空，交由上层抬预算重试。 */
        finish: (f) => (f && f.trim()) ? f : (reasoningBuf && !window.looksLikeRawReasoning(reasoningBuf) ? reasoningBuf : "")
      });
      if (full && full.trim()) return window.stripAIThink(full);
      /* 空正文：可能是推理模型把预算耗在思考上，记下以便上层抬预算重试 */
      if (reasoningBuf) _emptyContentReasoningFlag = true;
    } else {
      return parseOpenAIJson(await withTimeoutMs(response.json(), fullMs));
    }
  } catch (e) {
    if (sawDelta || e.isHttpError) throw e;
    /* v4.08.0 修复：超时/中止不得落到 non-stream 回退。
       原逻辑只对 sawDelta / isHttpError 抛出，AbortError（首字节超时、流空闲超时、
       用户取消）会一路穿到函数末尾，再静默发一次**完整的非流式请求**——
       携带整份 system prompt 的第二次请求，正是「长正文更慢」和 180s 超时的放大器。
       现在：超时/中止类错误直接抛出；只有「流建立失败但原因不明」的才回退。 */
    var en = String((e && e.name) || '');
    var em = String((e && e.message) || '');
    if (en === 'AbortError' || en === 'TimeoutError' || /超时|timeout|abort|abor|stream idle|取消/i.test(en + ' ' + em)) {
      throw e;
    }
  }
  return await callOpenAINonStream(messages, cfg, fullEndpoint, fullMs, opts);
}

/* v4.16.0 · 主笔与通用调用的「推理模型包装层」（详见文件头「推理模型防护」）。
   ① 已知推理模型 → 抬高出力下限（思考与正文共享 max_tokens，给太小必然「只思考不落笔」）；
   ② 正文为空且本次确实收到过 reasoning_content → 翻倍预算重试一次；
   ③ 仍为空 → 抛出可读错误，**绝不把思维链当正文**交给下游。 */
var _emptyContentReasoningFlag = false;
async function callOpenAI(messages, opts = {}, cfgOverride) {
  const cfg = cfgOverride || (window.storyFramework && window.storyFramework.apiConfig) || {};
  const baseMax = Number((opts && opts.maxTokens) || cfg.maxTokens || 16384);
  const reasonModel = window.isReasoningModel(cfg.model);
  const effMax = reasonModel ? Math.max(baseMax, 8192) : baseMax;
  const run = async (mt) => {
    _emptyContentReasoningFlag = false;
    return await callOpenAIOnce(messages, Object.assign({}, opts, { maxTokens: mt }), cfgOverride);
  };
  /* v4.17.0：计入「每轮请求总预算」。四层重试（内部/自检/纠偏/续写）此前互不知情，
     一次点击最坏会向上游发 6+ 次请求；现在每次请求都记账，超预算就停手。 */
  const BUD = window.YJTurnBudget;
  if (BUD && BUD.spend) BUD.spend("主笔·首轮");
  let out = await run(effMax);
  if (typeof out === "string" && out.trim()) return out;
  const hadReasoning = _emptyContentReasoningFlag;
  let retryErr = null;
  /* 重试前先问预算：用完了就不再打，直接带着已有信息走下面的错误分支 */
  const canRetry = !BUD || !BUD.allow || BUD.allow();
  if (reasonModel && effMax < 32768 && canRetry) {
    try {
      if (BUD && BUD.spend) BUD.spend("主笔·空正文翻倍预算重试");
      out = await run(Math.min(effMax * 2, 32768));
      if (typeof out === "string" && out.trim()) return out;
    } catch (e) {
      retryErr = e;
    }
  }
  /* 重试遇到真正的接口/超时错误时，那个错误比「只思考没正文」更可操作，优先抛出 */
  if (retryErr) {
    const nm = String((retryErr && retryErr.name) || "");
    if (retryErr.isHttpError || nm === "AbortError" || nm === "TimeoutError") throw retryErr;
  }
  if (hadReasoning || reasonModel) {
    const e = new Error(
      "模型只输出了思考过程、没有正文（reasoning_content 占满了输出上限）。"
      + "推理模型的「思考」与「正文」共享 max_tokens：请在接口设置里把最大输出 token 调大"
      + "（建议 8192 以上），或换用非推理模型。系统不会把思考过程当成正文。");
    e.isReasoningOnly = true;
    throw e;
  }
  return out;
}
async function callOpenAINonStream(messages, cfg, fullEndpoint, timeoutMs, opts) {
  var _a, _b;
  const response = await fetchWithTimeout(fullEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      temperature: Number.isFinite(cfg.temperature) ? cfg.temperature : 0.9, /* v3.68.0 falsy修复：用户明确设 0 不再被吞 */
      // v1.11.1 反八股 L1：与流式路径保持一致
      frequency_penalty: (_a = cfg.frequencyPenalty) != null ? _a : 0.15,
      presence_penalty: (_b = cfg.presencePenalty) != null ? _b : 0.1,
      max_tokens: (opts && opts.maxTokens) || cfg.maxTokens || 16384
    })
  }, timeoutMs, { label: "主笔", throttleKey: "主笔", signal: opts && opts.signal });
  if (!response.ok) {
    const errText = await readErrBody(response);
    throw new Error(`API请求失败: ${response.status} ${response.statusText} ${errText.slice(0, 200)}`);
  }
  return parseOpenAIJson(await withTimeoutMs(response.json(), timeoutMs));
}
function parseOpenAIJson(data) {
  var _a, _b;
  const msg = (_b = (_a = data.choices) == null ? void 0 : _a[0]) == null ? void 0 : _b.message;
  /* v4.16.0：旧实现 `msg.content ?? msg.reasoning_content` 会把 reasoning_content
     当正文（content 为 null 时）。现在统一走 extractAssistantText —— 只有内容读起来
     不像推演时才兜底（详见文件头「推理模型防护」）。 */
  const out = window.extractAssistantText(msg, { allowReasoningFallback: true });
  if (!out && msg && typeof msg.reasoning_content === "string" && msg.reasoning_content.trim()) {
    _emptyContentReasoningFlag = true;
  }
  return out;
}
async function callGemini(messages, opts = {}, cfgOverride) {
  var _a, _b;
  const fw = window.storyFramework;
  const cfg = cfgOverride || fw.apiConfig;
  const base = cfg.endpoint.replace(/\/+$/, "");
  const fullMs = secsToMs(cfg.timeout, 300);
  const toContents = () => messages.filter((m) => m.role !== "system").map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));
  const systemInstruction = messages.filter((m) => m.role === "system" && m.content).map((m) => m.content).join("\n\n");
  const genConfig = {
    temperature: Number.isFinite(cfg.temperature) ? cfg.temperature : 0.9, /* v3.68.0 falsy修复：用户明确设 0 不再被吞 */
    maxOutputTokens: cfg.maxTokens || 16384
  };
  if (/gemini-(2|exp|flash-late)/i.test(cfg.model || "")) {
    genConfig.frequencyPenalty = (_a = cfg.frequencyPenalty) != null ? _a : 0.15;
    genConfig.presencePenalty = (_b = cfg.presencePenalty) != null ? _b : 0.1;
  }
  if (cfg.stream === false) {
    return await callGeminiNonStream(base, toContents(), systemInstruction, genConfig, cfg, fullMs);
  }
  const firstMs = firstByteMs(cfg, fullMs);
  let sawDelta = false;
  try {
    const streamEndpoint = `${base}/models/${cfg.model}:streamGenerateContent?alt=sse&key=${cfg.apiKey}`;
    const response = await fetchWithTimeout(streamEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: toContents(),
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : void 0,
        generationConfig: genConfig
      })
    }, firstMs, { label: "主笔", throttleKey: "主笔", signal: opts && opts.signal });
    if (!response.ok) {
      const errText = await readErrBody(response);
      if (response.status === 404 || response.status === 405) {
        return await callGeminiNonStream(base, toContents(), systemInstruction, genConfig, cfg, fullMs);
      }
      const e = new Error(`Gemini请求失败: ${response.status} ${response.statusText} ${errText.slice(0, 200)}`);
      e.isHttpError = true;
      throw e;
    }
    if (isEventStream(response)) {
      const full = await readSSEStream(response, {
        onDelta: (d, f) => {
          sawDelta = true;
          if (opts.onDelta) opts.onDelta(d, f);
        },
        firstIdleMs: firstMs,
        idleMs: fullMs,
        extract: (json) => {
          var _a2, _b2, _c;
          const parts = ((_c = (_b2 = (_a2 = json.candidates) == null ? void 0 : _a2[0]) == null ? void 0 : _b2.content) == null ? void 0 : _c.parts) || [];
          return parts.map((p) => p && p.text && !p.thought ? p.text : "").filter(Boolean).join("");
        }
      });
      if (full && full.trim()) return window.stripAIThink(full);
    } else {
      return parseGeminiJson(await withTimeoutMs(response.json(), fullMs));
    }
  } catch (e) {
    if (sawDelta || e.isHttpError) throw e;
    /* v4.08.0：同 OpenAI 路径，超时/中止不落到 non-stream 回退（避免第二次完整请求） */
    var gen = String((e && e.name) || '');
    var gem = String((e && e.message) || '');
    if (gen === 'AbortError' || gen === 'TimeoutError' || /超时|timeout|abort|abor|stream idle|取消/i.test(gen + ' ' + gem)) {
      throw e;
    }
  }
  return await callGeminiNonStream(base, toContents(), systemInstruction, genConfig, cfg, fullMs);
}
async function callGeminiNonStream(base, contents, systemInstruction, genConfig, cfg, timeoutMs, opts) {
  const endpoint = `${base}/models/${cfg.model}:generateContent?key=${cfg.apiKey}`;
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : void 0,
      generationConfig: genConfig
    })
  }, timeoutMs || secsToMs(cfg.timeout, 300), { label: "主笔", throttleKey: "主笔", signal: opts && opts.signal });
  if (!response.ok) {
    const errText = await readErrBody(response);
    throw new Error(`Gemini请求失败: ${response.status} ${response.statusText} ${errText.slice(0, 200)}`);
  }
  return parseGeminiJson(await withTimeoutMs(response.json(), timeoutMs || secsToMs(cfg.timeout, 300)));
}
function parseGeminiJson(data) {
  var _a;
  if (!data.candidates || data.candidates.length === 0) {
    return "请求被模型阻止，可能触发了安全设置。请尝试修改输入内容。";
  }
  const parts = ((_a = data.candidates[0].content) == null ? void 0 : _a.parts) || [];
  return parts.map((p) => p && p.text && !p.thought ? p.text : "").filter(Boolean).join("");
}
/* v4.08.0 主笔请求门闩（并发保护）
 * 问题：callStoryAI 此前没有任何并发保护。main 线在生成时，创作工坊（creator-forge）
 *   与草稿实验室（draft-lab）会各自再发一条完整请求，与主线争抢同一端点；
 *   慢端点下两条请求叠加，首字节超时概率显著上升。
 * 方案：同一时刻只允许一条**非辅助**主笔请求在飞。辅助类（lightContext 协议补丁）
 *   与显式 opts.parallel 的场景（草稿实验室多候选并行）不受门闩限制，
 *   因为它们本就是设计上要并发的。
 * 生命周期：门闩在 finally 中释放，异常路径（throw / AbortError）同样释放，
 *   不会出现「卡死后再也发不出请求」。
 */
const MAIN_LATCH = { busy: false, owner: "", since: 0, controller: null, userAborted: false };
window.__aiMainLatch = MAIN_LATCH;

/* v4.08.0 用户可中断：暴露一个全局句柄，让 UI（等待卡上的「停止生成」按钮）
 * 能真正取消进行中的主笔请求。此前慢响应只能干等 150s+。
 * 注意：net-guard 收到 AbortError 后不再重试（见 net-guard.js），所以这里中止后
 * 不会又偷偷发一次请求。 */
window.abortMainGeneration = function (reason) {
  const c = MAIN_LATCH.controller;
  if (!c) return false;
  /* 先置标记再 abort：fetch 被 abort 后错误会以 AbortError 冒泡上来，
     上层要靠这个标记区分「玩家主动停止」与「超时」。 */
  MAIN_LATCH.userAborted = true;
  try { c.abort(); } catch (e) { return false; }
  try {
    window.StoryResponseHandler && window.StoryResponseHandler.renderSystemMessage(
      `⏹ 已停止本次生成${reason ? "（" + String(reason).slice(0, 40) + "）" : ""}。`,
      "info"
    );
  } catch (e) {}
  return true;
};

async function callStoryAI(userMessage, isTest = false, opts = {}) {
  var _a, _b;
  const fw = window.storyFramework;
  if (!fw.apiConfig.endpoint || !fw.apiConfig.apiKey || !fw.apiConfig.model) {
    throw new Error("请先配置并保存 AI 接口（右上角「接口设置」）");
  }
  /* v3.95.0 省 token：补协议这类「只输出几十字格式片段」的辅助请求，
     不需要再背一份两三万字的完整 system（旧版第 4 次请求约占总 prompt 四分之一）。
     lightContext 走极简双消息，其余路径完全不变。 */
  const lightContext = !!opts.lightContext;
  if (lightContext) { const clean = { ...opts }; delete clean.lightContext; opts = clean; }
  /* v4.08.0 并发门闩：非辅助、非并发、非常规测试的请求走独占门闩 */
  const needsLatch = !isTest && !lightContext && !opts.parallel;
  if (needsLatch) {
    if (MAIN_LATCH.busy) {
      throw new Error("上一段还在生成中，请等它写完再发起新的请求（或先点「停止生成」）。");
    }
    MAIN_LATCH.busy = true;
    MAIN_LATCH.owner = String(userMessage || "").slice(0, 40);
    MAIN_LATCH.since = Date.now();
    MAIN_LATCH.userAborted = false;
    /* v4.08.0：为本次请求创建可外部中止的 controller */
    const ctrl = new AbortController();
    MAIN_LATCH.controller = ctrl;
    opts = { ...opts, signal: ctrl.signal };
  }
  let messages = [];
  try {
    if (!isTest) {
      if (lightContext) {
        messages = [
          { role: "system", content: "【格式补丁器】只输出用户指定的协议片段，禁止输出任何故事正文、解释或复述，输出尽量短。" },
          { role: "user", content: userMessage }
        ];
      } else {
        /* v4.08.0：buildStoryMessages 移入 try 块。此前它在 try 之外 await，
           一旦装配阶段抛错（知识库/变量引擎异常），finally 不会执行 →
           门闩永久卡在 busy=true，之后所有主笔请求都被拒绝。 */
        /* v4.17.0：走「提示词编译」唯一入口——它在委托 buildStoryMessages 之外，
           额外记录这次编译的组成快照（各层字符数 / 档位 / 模型 / 开关），
           使「这一轮到底发出去了什么」可复盘（此前拼完不留痕）。
           取不到 PromptCompiler 时退回直接调用，行为不变。 */
        messages = (window.PromptCompiler && window.PromptCompiler.compile)
          ? await window.PromptCompiler.compile(userMessage)
          : await buildStoryMessages(userMessage);
      }
      (_a = window.TokenUsage) == null ? void 0 : _a.recordRequest(messages, "主笔");
    } else {
      messages = [{ role: "user", content: '你好，请回复"连接成功"四个字。' }];
    }
    // v3.47.16 主笔独立节流队列：与动态世界/变量AI/生图/手机互不阻塞
    // 续写轮（isContinuation）关闭流式增量回调，避免把续段当作新回复重绘
    const bmm = window.BaseModelMode; // v3.55.11 模型自适应：提到 callOnce 外层，自检块共享
    const callOnce = (msgs, o = {}) => {
      const isCont = o && o.isContinuation;
      const passOpts = isCont ? { ...o, onDelta: undefined } : o;
      /* v3.55.10 基础小模型适配：cfgOverride 传参数锁副本（温度≤0.75/上限≤8000），
         不改用户保存的原值；强模型用户关闭开关时完全零改动 */
      const bmmCfg = (bmm && bmm.isLite && bmm.isLite()) ? bmm.clampParams(fw.apiConfig) : undefined;
      return fw.apiConfig.type === "gemini" ? callGemini(msgs, passOpts, bmmCfg) : callOpenAI(msgs, passOpts, bmmCfg);
    };
    let reply = await callOnce(messages, opts);
    /* v3.55.11 复读自检（全档安全基线）：任意档检测到「复读崩塌」自动降温重发一次；
       auto 档首轮若崩→降级 lite 并缓存，首轮稳→缓存初判，均用户无感 */
    /* v4.16.0：把「语种退化」（多语种 token 汤）与「复读崩塌」同等对待——
       两者都是模型没驾驭住的表现，都走同一套「降温重发一次 + auto 档降级」机制。
       这样弱模型在退化的瞬间就会被自动压到更省力、更易驾驭的档位，而不是持续吐乱码。 */
    /* 用「玩家自己最近的输入」推断期望语种：玩家写英文就不该拿中文占比去要求它 */
    let langSample = "";
    try {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i] && messages[i].role === "user") { langSample = String(messages[i].content || ""); break; }
      }
    } catch (e) { }
    const badOut = reply && bmm && (
      (bmm.detectCollapse && bmm.detectCollapse(reply)) ||
      (bmm.detectDegeneration && bmm.detectDegeneration(reply, langSample))
    );
    if (badOut) {
      const isDegen = bmm.detectDegeneration && bmm.detectDegeneration(reply, langSample) && !(bmm.detectCollapse && bmm.detectCollapse(reply));
      /* 崩塌 → 立即降档；退化 → 连续 2 轮才降档（单轮乱码可能只是瞬时抽风，不宜误伤强模型） */
      if (isDegen) { if (bmm.noteDegenerate) bmm.noteDegenerate(); }
      else if (bmm.noteCollapse) bmm.noteCollapse();
      console.warn('[模型自适应] 检测到' + (isDegen ? '语种退化（多语种乱码）' : '复读崩塌') + '，降温重发一次');
      /* v4.17.0：自检重发也要走每轮预算，不能与其它三层叠乘 */
      if (window.YJTurnBudget && window.YJTurnBudget.spend) window.YJTurnBudget.spend('自检重发');
      try {
        const retryCfg = (bmm.isLite && bmm.isLite()) ? bmm.clampParams(fw.apiConfig) : Object.assign({}, fw.apiConfig);
        retryCfg.temperature = Math.max(0.5, (retryCfg.temperature || 0.75) - 0.2);
        const r2 = fw.apiConfig.type === "gemini"
          ? await callGemini(messages, opts, retryCfg)
          : await callOpenAI(messages, opts, retryCfg);
        const stillBad = r2 && ((bmm.detectCollapse && bmm.detectCollapse(r2)) || (bmm.detectDegeneration && bmm.detectDegeneration(r2)));
        if (r2 && !stillBad) reply = r2;
        else console.warn('[模型自适应] 重发仍未达标，保留原回复');
      } catch (e) { console.warn('[模型自适应] 重发失败，保留原回复', e); }
    } else if (bmm && bmm.noteDegenerationRecovered) {
      /* 本轮输出正常 → 清零退化连续计数 */
      bmm.noteDegenerationRecovered();
      if (bmm.noteStable && bmm.isAuto && bmm.isAuto() && !isTest) bmm.noteStable(reply);
    } else if (bmm && bmm.noteStable && bmm.isAuto && bmm.isAuto() && !isTest) {
      /* v4.11.1 双向自适应：把本轮真实回复交给质量探针，连续 2 轮结构完整即自动升 full；
         连通测试(isTest)的短回复不参与判定，避免把「连接成功」误当稳定输出。 */
      bmm.noteStable(reply);
    }
    // v3.47.14 防截断：被 max_tokens 掐断时自动续写（最多 2 轮，可从接口设置关闭）
    if (!isTest && window.MoNetGuard && fw.apiConfig.autoContinue !== false) {
      reply = await window.MoNetGuard.continueIfTruncated(messages, reply, callOnce);
    }
    const clean = window.stripAIThink(reply);
    if (!isTest) (_b = window.TokenUsage) == null ? void 0 : _b.recordOutput(clean, "主笔");
    return clean;
  } catch (error) {
    console.error("AI调用错误:", error);
    if (error && error.name === "AbortError") {
      /* v4.08.0：区分「玩家主动停止」与「超时」。此前两者共用同一条
         「超时，调大超时秒数」的提示——玩家明明是自己点的停止，却被告示去改超时，
         属于明确的误导。现在按 streamPhase / 外部中止标记分流。 */
      if (error.userAborted || error.streamPhase === "user" || (window.__aiMainLatch && window.__aiMainLatch.userAborted)) {
        throw new Error("已停止本次生成。");
      }
      /* v4.16.0：旧文案一律报「${用户总超时} 秒内无数据返回」，但首字节阶段实际用的是
         firstByteMs（非推理 60s / 推理 300s）——玩家会看到 60 秒就失败却被告知等了 300 秒，
         诊断方向完全错。现按阶段报真实秒数，并针对推理模型给出准确建议。 */
      const phaseFirst = error.streamPhase === "first";
      const phase = phaseFirst ? "首字节" : "流中";
      const totalMs = secsToMs(fw.apiConfig.timeout, 300);
      const actualMs = phaseFirst ? firstByteMs(fw.apiConfig, totalMs) : totalMs;
      const isReason = !!(window.isReasoningModel && window.isReasoningModel(fw.apiConfig.model));
      const advice = phaseFirst
        ? `①这类模型${isReason ? "是推理模型，思考发生在首字节之前，本来就慢" : "在首字节前的等待上限为 " + Math.round(actualMs / 1e3) + " 秒"}——到接口设置把「超时（秒）」调大即可放宽（推理模型首字节上限随总超时放宽至 300 秒） ②更换更快的模型或中转站 ③保持流式开启（关闭流式是硬超时，反而更容易失败）`
        : "①接口设置里加大超时秒数 ②更换模型或中转站 ③关闭流式开关后重试";
      throw new Error(`AI 响应超时（${phase}阶段 ${Math.round(actualMs / 1e3)} 秒内无数据返回）：网络或中转站无响应。可尝试：${advice}。`);
    }
    /* v3.99.0 上下文超限自适应：小模型（或推断不出窗口的中转端点）最容易撞这个墙。
       捕获到就把预算压到 55%，重新装配消息后自动重试一次——玩家只会觉得「慢了一拍」，
       而不是对着一串英文报错不知道怎么办。 */
    const PB = window.PromptBudget;
    if (!isTest && !lightContext && PB && PB.isOverflowError && PB.isOverflowError(error)) {
      try {
        PB.noteOverflow();
        console.warn("[PromptBudget] 上下文超限，按压缩后的预算重建消息并重试一次");
        const shrunk = await buildStoryMessages(userMessage);
        (_a = window.TokenUsage) == null ? void 0 : _a.recordRequest(shrunk, "主笔");
        const bmm2 = window.BaseModelMode;
        const retryCfg2 = (bmm2 && bmm2.isLite && bmm2.isLite()) ? bmm2.clampParams(fw.apiConfig) : undefined;
        const reply2 = fw.apiConfig.type === "gemini"
          ? await callGemini(shrunk, opts, retryCfg2)
          : await callOpenAI(shrunk, opts, retryCfg2);
        const clean2 = window.stripAIThink(reply2);
        if (!isTest) (_b = window.TokenUsage) == null ? void 0 : _b.recordOutput(clean2, "主笔");
        return clean2;
      } catch (e2) {
        console.error("[PromptBudget] 降级重试仍失败:", e2);
        throw new Error(
          `模型上下文装不下本轮请求（已自动压缩并重试一次仍失败）。可尝试：①在接口设置里把「上下文窗口」填成模型的真实值 ②换一个上下文更大的模型 ③开启「基础模型模式」减负。原始错误：${String(error && error.message ? error.message : error).slice(0, 160)}`
        );
      }
    }
    throw error;
  } finally {
    /* v4.08.0：门闩必须在**所有**退出路径释放（含 throw / AbortError / 提前 return）。
       否则一次失败就会把「主笔通道」永久锁死，玩家再也发不出消息。 */
    if (needsLatch) {
      MAIN_LATCH.busy = false;
      MAIN_LATCH.owner = "";
      MAIN_LATCH.since = 0;
      MAIN_LATCH.controller = null;
    }
  }
}
async function callInspirationEngine() {
  var _a, _b;
  const fw = window.storyFramework;
  if (!fw.apiConfig.endpoint || !fw.apiConfig.apiKey || !fw.apiConfig.model) {
    throw new Error("请先配置并保存 AI 接口");
  }
  const inspirationPrompt = typeof fw.config.dynamicWorldPrompt === "function" ? fw.config.dynamicWorldPrompt() : fw.config.defaultDynamicWorldPrompt || "";
  const summary = buildStoryDigest();
  const messages = [
    { role: "system", content: inspirationPrompt },
    { role: "user", content: `【当前故事状态摘要】
${summary}

请生成 3 条支线灵感/远方事件，按编号列出，每条不超过60字。` }
  ];
  (_a = window.TokenUsage) == null ? void 0 : _a.recordRequest(messages, "灵感");
  try {
    const reply = fw.apiConfig.type === "gemini" ? await callGemini(messages) : await callOpenAI(messages);
    (_b = window.TokenUsage) == null ? void 0 : _b.recordOutput(reply, "灵感");
    return reply;
  } catch (error) {
    console.error("灵感引擎调用错误:", error);
    throw error;
  }
}
async function testApiConnection(endpoint, apiKey, model, type, maxTokens) {
  var _a, _b, _c, _d, _e, _f;
  if (type === "gemini") {
    const response2 = await fetchWithTimeout(`${endpoint.trim().replace(/\/+$/, "")}/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "你好" }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 16384 }
      })
    }, 3e4);
    if (!response2.ok) {
      const errorBody = await readErrBody(response2);
      throw new Error(`连接失败: ${response2.status} ${response2.statusText}${errorBody ? " - " + errorBody.slice(0, 150) : ""}`);
    }
    const data2 = await withTimeoutMs(response2.json(), 3e4);
    if (!data2.candidates || data2.candidates.length === 0) {
      throw new Error("连接成功但被模型安全设置拦截，建议降低温度或更换模型");
    }
    const parts = ((_a = data2.candidates[0].content) == null ? void 0 : _a.parts) || [];
    return parts.map((p) => p.text || "").filter(Boolean).join("");
  }
  const fullEndpoint = getFullEndpoint(endpoint, "openai");
  const response = await fetchWithTimeout(fullEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "你好" }],
      temperature: 0.8,
      max_tokens: maxTokens || 16384
    })
  }, 3e4);
  if (!response.ok) {
    const errText = await readErrBody(response);
    let reason = errText.slice(0, 150);
    try {
      reason = ((_b = JSON.parse(errText).error) == null ? void 0 : _b.message) || reason;
    } catch (e) {
    }
    throw new Error(`连接失败: ${response.status} ${response.statusText}${reason ? " - " + reason : ""}`);
  }
  const data = await withTimeoutMs(response.json(), 3e4);
  const msg = (_d = (_c = data.choices) == null ? void 0 : _c[0]) == null ? void 0 : _d.message;
  /* v4.16.0：连通测试。保留兜底（推理模型只回思考时也要能判定「接口通了」），
     但经安全提取器，内容像原始推演时不会冒充模型回复。 */
  return window.extractAssistantText(msg, { allowReasoningFallback: true });
}
