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
function fetchWithTimeout(url, opts = {}, timeoutMs = 3e5, guardOpts = {}) {
  const ms = timeoutMs && timeoutMs > 0 ? timeoutMs : 3e5;
  /** 单次尝试：独立 AbortController，避免重试共用已 abort 的 signal */
  const once = () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer));
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
window.stripAIThink = function(text) {
  let s = String(text == null ? "" : text);
  if (!s) return s;
  s = s.replace(/<think(?:\s[^>]*)?>[\s\S]*?<\/think\s*>/gi, "");
  s = s.replace(/<think(?:\s[^>]*)?>[\s\S]*$/i, "");
  s = s.replace(/<\/think\s*>/gi, "");
  return s;
};
async function readSSEStream(response, opts = {}) {
  const { onDelta, extract, idleMs = 3e5, firstIdleMs } = opts;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let timer = null;
  let idleReject = null;
  const idlePromise = new Promise((_, reject) => {
    idleReject = reject;
  });
  let gotAnyByte = false;
  const armIdle = () => {
    clearTimeout(timer);
    const base = gotAnyByte ? idleMs : firstIdleMs || idleMs;
    timer = setTimeout(() => {
      const e = new Error("stream idle");
      e.name = "AbortError";
      idleReject(e);
      try {
        reader.cancel();
      } catch (err) {
      }
    }, base && base > 0 ? base : 3e5);
  };
  let buffer = "";
  let full = "";
  armIdle();
  try {
    while (true) {
      const chunk = await Promise.race([reader.read(), idlePromise]);
      if (chunk.done) break;
      if (!gotAnyByte) {
        gotAnyByte = true;
      }
      armIdle();
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        processLine(line);
      }
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
async function callOpenAI(messages, opts = {}, cfgOverride) {
  var _a, _b;
  const fw = window.storyFramework;
  const cfg = cfgOverride || fw.apiConfig;
  const fullEndpoint = getFullEndpoint(cfg.endpoint, "openai");
  const fullMs = secsToMs(cfg.timeout, 300);
  if (cfg.stream === false) {
    return await callOpenAINonStream(messages, cfg, fullEndpoint, fullMs, opts);
  }
  const firstMs = Math.min(STREAM_FIRST_MS, fullMs);
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
        temperature: cfg.temperature || 0.9,
        // v3.47.10 反狂奔：实测 0.4/0.3 会加剧中文同义词罗列与标点消失，降至 0.15/0.1（cfg 可覆盖，设为 0 即禁用）
        frequency_penalty: (_a = cfg.frequencyPenalty) != null ? _a : 0.15,
        presence_penalty: (_b = cfg.presencePenalty) != null ? _b : 0.1,
        /* v3.53.0：opts.maxTokens 允许单次调用压小上限（补协议块 / 轻量纠偏），
           不再被迫跟着全局 16384 跑满——中转站慢时这一点尤其重要 */
        max_tokens: (opts && opts.maxTokens) || cfg.maxTokens || 16384,
        stream: true
      })
    }, firstMs, { label: "主笔", throttleKey: "主笔" });
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
        finish: (f) => f && f.trim() ? f : reasoningBuf
      });
      if (full && full.trim()) return window.stripAIThink(full);
    } else {
      return parseOpenAIJson(await withTimeoutMs(response.json(), fullMs));
    }
  } catch (e) {
    if (sawDelta || e.isHttpError) throw e;
  }
  return await callOpenAINonStream(messages, cfg, fullEndpoint, fullMs, opts);
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
      temperature: cfg.temperature || 0.9,
      // v1.11.1 反八股 L1：与流式路径保持一致
      frequency_penalty: (_a = cfg.frequencyPenalty) != null ? _a : 0.15,
      presence_penalty: (_b = cfg.presencePenalty) != null ? _b : 0.1,
      max_tokens: (opts && opts.maxTokens) || cfg.maxTokens || 16384
    })
  }, timeoutMs);
  if (!response.ok) {
    const errText = await readErrBody(response);
    throw new Error(`API请求失败: ${response.status} ${response.statusText} ${errText.slice(0, 200)}`);
  }
  return parseOpenAIJson(await withTimeoutMs(response.json(), timeoutMs));
}
function parseOpenAIJson(data) {
  var _a, _b, _c, _d;
  const msg = (_b = (_a = data.choices) == null ? void 0 : _a[0]) == null ? void 0 : _b.message;
  return window.stripAIThink((_d = (_c = msg == null ? void 0 : msg.content) != null ? _c : msg == null ? void 0 : msg.reasoning_content) != null ? _d : "");
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
    temperature: cfg.temperature || 0.9,
    maxOutputTokens: cfg.maxTokens || 16384
  };
  if (/gemini-(2|exp|flash-late)/i.test(cfg.model || "")) {
    genConfig.frequencyPenalty = (_a = cfg.frequencyPenalty) != null ? _a : 0.15;
    genConfig.presencePenalty = (_b = cfg.presencePenalty) != null ? _b : 0.1;
  }
  if (cfg.stream === false) {
    return await callGeminiNonStream(base, toContents(), systemInstruction, genConfig, cfg, fullMs);
  }
  const firstMs = Math.min(STREAM_FIRST_MS, fullMs);
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
    }, firstMs);
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
  }
  return await callGeminiNonStream(base, toContents(), systemInstruction, genConfig, cfg, fullMs);
}
async function callGeminiNonStream(base, contents, systemInstruction, genConfig, cfg, timeoutMs) {
  const endpoint = `${base}/models/${cfg.model}:generateContent?key=${cfg.apiKey}`;
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : void 0,
      generationConfig: genConfig
    })
  }, timeoutMs || secsToMs(cfg.timeout, 300));
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
async function callStoryAI(userMessage, isTest = false, opts = {}) {
  var _a, _b;
  const fw = window.storyFramework;
  if (!fw.apiConfig.endpoint || !fw.apiConfig.apiKey || !fw.apiConfig.model) {
    throw new Error("请先配置并保存 AI 接口（右上角「接口设置」）");
  }
  let messages = [];
  if (!isTest) {
    messages = await buildStoryMessages(userMessage);
    (_a = window.TokenUsage) == null ? void 0 : _a.recordRequest(messages, "主笔");
  } else {
    messages = [{ role: "user", content: '你好，请回复"连接成功"四个字。' }];
  }
  try {
    // v3.47.16 主笔独立节流队列：与动态世界/变量AI/生图/手机互不阻塞
    // 续写轮（isContinuation）关闭流式增量回调，避免把续段当作新回复重绘
    const callOnce = (msgs, o = {}) => {
      const isCont = o && o.isContinuation;
      const passOpts = isCont ? { ...o, onDelta: undefined } : o;
      return fw.apiConfig.type === "gemini" ? callGemini(msgs, passOpts) : callOpenAI(msgs, passOpts);
    };
    let reply = await callOnce(messages, opts);
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
      throw new Error(`AI 响应超时（${Math.round(secsToMs(fw.apiConfig.timeout, 300) / 1e3)} 秒内无任何数据返回）：网络或中转站无响应。可尝试：①接口设置里加大超时秒数 ②更换模型或中转站 ③关闭流式开关后重试。`);
    }
    throw error;
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
  return (_f = (_e = msg == null ? void 0 : msg.content) != null ? _e : msg == null ? void 0 : msg.reasoning_content) != null ? _f : "";
}
