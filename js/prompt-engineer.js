window.StoryPromptEngineer = {
  KEY: "storyPromptApi",
  // 第五接口配置（与各接口同级的独立存档）
  CACHE_KEY: "storyPromptRewrite",
  // 改写结果缓存（跨存档共享，按原始提示词为键）
  defaults: {
    enabled: false,
    provider: "custom-openai",
    type: "openai",
    // openai | gemini
    endpoint: "",
    apiKey: "",
    model: "",
    maxTokens: 2048,
    temperature: 0.7,
    timeout: 120
    // 批量改写一次要写整章多条，默认放宽到 120 秒
  },
  /* ==================== 配置读写 ==================== */
  get() {
    let cfg = { ...this.defaults };
    try {
      const saved = localStorage.getItem(this.KEY);
      if (saved) cfg = { ...cfg, ...JSON.parse(saved) };
    } catch (e) {
    }
    return cfg;
  },
  save(cfg) {
    var _a;
    try {
      localStorage.setItem(this.KEY, JSON.stringify({ ...this.get(), ...cfg }));
    } catch (e) {
      console.error("[提示词工程师] 配置保存失败（存储已满或被禁用）:", e);
      (_a = window.showToast) == null ? void 0 : _a.call(window, "提示词工程师配置保存失败：本地存储已满或被禁用", "error");
    }
  },
  /** 接口是否填全（地址 / Key / 模型） */
  isReady() {
    const c = this.get();
    return !!(c.endpoint && c.apiKey && c.model);
  },
  /** 是否真正生效：勾选启用 且 接口配全（少一样都按「不存在」处理，主链路零影响） */
  isEnabled() {
    const c = this.get();
    return !!(c.enabled && c.endpoint && c.apiKey && c.model);
  },
  /* ==================== 改写缓存 ==================== */
  _cacheGet() {
    try {
      const c = JSON.parse(localStorage.getItem(this.CACHE_KEY));
      return c && typeof c === "object" && !Array.isArray(c) ? c : {};
    } catch (e) {
      return {};
    }
  },
  /** 查缓存：命中返回润色稿，未命中返回 null */
  lookup(prompt) {
    if (!prompt) return null;
    const e = this._cacheGet()[prompt];
    return e && typeof e.text === "string" && e.text.trim() ? e.text : null;
  },
  /** 写缓存：上限 100 条，超限按时间淘汰最老（改写稿与原始稿一一对应，键即原始提示词） */
  _store(prompt, text) {
    if (!prompt || !text) return;
    const c = this._cacheGet();
    c[prompt] = { text, ts: Date.now() };
    const keys = Object.keys(c);
    if (keys.length > 100) {
      keys.sort((a, b) => (c[a].ts || 0) - (c[b].ts || 0));
      for (const k of keys.slice(0, keys.length - 100)) delete c[k];
    }
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(c));
    } catch (e) {
      console.warn("[提示词工程师] 缓存写入失败（存储已满），本轮改写仍生效", e);
    }
  },
  /** 清空改写缓存（换模型 / 换画风后手动触发） */
  clearCache() {
    try {
      localStorage.removeItem(this.CACHE_KEY);
    } catch (e) {
    }
  },
  /* ==================== 批量改写 ==================== */
  /**
   * 批量改写入口：返回与入参等长的润色稿数组（命中缓存的直接用，未命中的走一次 API）
   * 任何失败都静默降级——对应位置回退原始描述，绝不抛错阻断生图
   */
  async rewrite(prompts, ctx = {}) {
    const list = (Array.isArray(prompts) ? prompts : [prompts]).map((p) => String(p || "").trim());
    const need = [...new Set(list.filter((p) => p && !this.lookup(p)))];
    if (need.length) {
      try {
        const results = await this._callBatch(need, ctx);
        need.forEach((p, i) => {
          if (results[i]) this._store(p, results[i]);
        });
      } catch (e) {
        console.warn("[提示词工程师] 批量改写失败，本批回退原始描述:", e);
      }
    }
    return list.map((p) => this.lookup(p) || p);
  },
  /** 单条改写（手动重绘等零散场景；缓存命中则零调用） */
  async rewriteOne(prompt, ctx = {}) {
    return (await this.rewrite([prompt], ctx))[0];
  },
  async _callBatch(prompts, ctx) {
    const messages = [
      { role: "system", content: this._systemPrompt(ctx) },
      { role: "user", content: this._userPrompt(prompts) }
    ];
    const out = await this.callAPI(messages);
    return this._parse(out, prompts.length);
  },
  /** 系统提示词：角色 / 扩写维度 / 画风基调 / 语言 / 严格 JSON 输出 */
  _systemPrompt(ctx = {}) {
    const lang = ctx.lang === "en" ? "英文（English）" : "中文";
    const style = String(ctx.style || "").trim() || "高质量文学插画，电影感构图，氛围写实";
    return `你是一位资深 AI 绘画提示词工程师，负责为一部长篇小说的正文插图撰写生图提示词。
我会给你一份编号的画面描述清单（来自小说正文，是插图的原始构想）。请把每一条扩写成专业级生图提示词。

扩写要求：
- 输出语言：${lang}；每条 40-120 字（英文 30-80 词）
- 忠于原描述：不得改变主体、动作、场景与情节含义，只做细节丰富化，画面必须能还原原文情节
- 覆盖维度：主体外貌与服装姿态、环境场景与时代元素、光线类型与方向时段、色调与色彩关键词、构图景别与镜头视角、材质质感、氛围情绪、画风关键词
- 必须体现本作画风基调：${style}
- 严禁画面出现：文字、对白、字幕、水印、logo、签名、边框（生图模型不擅画字，出现必翻车）
- 严禁输出编号、标题、解释或任何前后缀，每条就是一个完整提示词字符串

输出格式（严格遵守）：仅输出一个 JSON 字符串数组，数组长度必须等于输入清单条数，例如：
["第一条完整提示词", "第二条完整提示词"]`;
  },
  _userPrompt(prompts) {
    return `画面描述清单（共 ${prompts.length} 条）：
` + prompts.map((p, i) => `${i + 1}. ${p}`).join("\n");
  },
  /* ==================== 输出解析（宽松容错） ==================== */
  /**
   * 解析模型输出 → 等长润色稿数组
   * 策略：① JSON 数组（首选，长度吻合直接用；条数不齐截断/补空）② 「1. xxx」编号行（同前）
   *       ③ 原文既无 JSON 也无编号结构（如纯道歉/废话）→ 返回 []，上层整批回退原始描述
   * 空串位视为该条改写失败，上层回退原始描述
   */
  _parse(raw, n) {
    const t = String(raw || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    if (!t || !n) return [];
    let jsonArr = null;
    const s = t.indexOf("["), e = t.lastIndexOf("]");
    if (s !== -1 && e > s) {
      try {
        const arr = JSON.parse(t.slice(s, e + 1));
        if (Array.isArray(arr) && arr.length) {
          jsonArr = arr.map((x) => String(x == null ? "" : x).trim());
        }
      } catch (err) {
      }
    }
    const hasNum = /(?:^|\n)\s*\d+\s*[.、:：)）]/.test(t);
    const lines = t.split(/\n+/).map((l) => l.replace(/^\s*(?:#{1,4}\s*)?(?:\d+\s*)?[.、:：)）]?\s*/, "").replace(/^\s*\d+\s*[.、:：)）]\s*/, "").trim()).filter(Boolean);
    if (jsonArr && jsonArr.length === n) return this._fit(jsonArr, n);
    if (hasNum && lines.length === n) return this._fit(lines, n);
    if (jsonArr && jsonArr.length) return this._fit(jsonArr, n);
    if (hasNum && lines.length) return this._fit(lines, n);
    return this._fit([], n);
  },
  /** 对齐长度：截断超发、补空串（空串 = 该条失败） */
  _fit(arr, n) {
    const out = arr.slice(0, n).map((x) => String(x || "").trim());
    while (out.length < n) out.push("");
    return out;
  },
  /* ==================== API 调用（非流式；OpenAI / Gemini 双协议） ==================== */
  /** 对话调用（含 Token 记账；cfgOverride 供「测试连通 / 拉模型」用表单值直连） */
  async callAPI(messages, cfgOverride) {
    var _a, _b;
    (_a = window.TokenUsage) == null ? void 0 : _a.recordRequest(messages, "提示词工程师");
    const out = await this._callAPIInner(messages, cfgOverride);
    (_b = window.TokenUsage) == null ? void 0 : _b.recordOutput(out, "提示词工程师");
    return out;
  },
  async _callAPIInner(messages, cfgOverride) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    const cfg = cfgOverride ? { ...this.defaults, ...cfgOverride } : this.get();
    if (!(cfg.endpoint && cfg.apiKey && cfg.model)) {
      throw new Error("提示词工程师尚未配置完整（地址 / Key / 模型）");
    }
    const ms = this._toMs(cfg.timeout, 120);
    if (cfg.type === "gemini") {
      const ep = `${cfg.endpoint.trim().replace(/\/+$/, "")}/models/${cfg.model}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
      const contents = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
      const sys = ((_a = messages.find((m) => m.role === "system")) == null ? void 0 : _a.content) || "";
      const res2 = await this._fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction: sys ? { parts: [{ text: sys }] } : void 0,
          generationConfig: { temperature: (_b = cfg.temperature) != null ? _b : 0.7, maxOutputTokens: cfg.maxTokens || 2048 }
        })
      }, ms);
      if (!res2.ok) throw new Error(await this._errText(res2));
      const data2 = await this._readBody(res2.json(), ms);
      const parts = ((_e = (_d = (_c = data2 == null ? void 0 : data2.candidates) == null ? void 0 : _c[0]) == null ? void 0 : _d.content) == null ? void 0 : _e.parts) || [];
      return parts.map((p) => p.text || "").filter(Boolean).join("").trim();
    }
    const full = typeof getFullEndpoint === "function" ? getFullEndpoint(cfg.endpoint, "openai") : cfg.endpoint.trim().replace(/\/+$/, "") + "/chat/completions";
    const res = await this._fetch(full, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${cfg.apiKey}`
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: (_f = cfg.temperature) != null ? _f : 0.7,
        max_tokens: cfg.maxTokens || 2048
      })
    }, ms);
    if (!res.ok) throw new Error(await this._errText(res));
    const data = await this._readBody(res.json(), ms);
    const msg = (_h = (_g = data == null ? void 0 : data.choices) == null ? void 0 : _g[0]) == null ? void 0 : _h.message;
    return String((_j = (_i = msg == null ? void 0 : msg.content) != null ? _i : msg == null ? void 0 : msg.reasoning_content) != null ? _j : "").trim();
  },
  /** 连通测试：一句话对话，返回模型回复文本 */
  async testApi(cfgOverride) {
    return await this.callAPI([{ role: "user", content: '你好，请回复"连接成功"四个字。' }], cfgOverride);
  },
  /** 拉取模型列表（复用全局 fetchOpenAIModels，与主接口同款交互） */
  async fetchModels(cfgOverride) {
    if (typeof fetchOpenAIModels !== "function") {
      throw new Error("当前环境不支持模型列表获取，请直接手填模型名");
    }
    const c = cfgOverride || this.get();
    return await fetchOpenAIModels(c.endpoint, c.apiKey);
  },
  /* ==================== 底层工具（优先复用全局，缺失时本地兜底） ==================== */
  _toMs(secs, dft) {
    if (typeof secsToMs === "function") return secsToMs(secs, dft);
    const s = typeof secs === "number" && secs > 0 ? secs : dft;
    return s * 1e3;
  },
  _fetch(url, opts, ms) {
    // v3.47.16 提示词工程师走独立节流队列（它常与主笔同轮触发）
    if (typeof fetchWithTimeout === "function") return fetchWithTimeout(url, opts, ms, { label: "提示词工程师", throttleKey: "提示词工程师", silent: true });
    const once = () => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), ms);
      return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
    };
    if (window.MoNetGuard && window.MoNetGuard.fetchWithRetry) {
      return window.MoNetGuard.fetchWithRetry(once, { label: "提示词工程师", throttleKey: "提示词工程师", silent: true });
    }
    return once();
  },
  async _readBody(p, ms) {
    if (typeof withTimeoutMs === "function") return await withTimeoutMs(p, ms);
    return await p;
  },
  async _errText(res) {
    var _a;
    let reason = "";
    try {
      reason = (await res.text()).slice(0, 180);
    } catch (e) {
    }
    try {
      reason = ((_a = JSON.parse(reason).error) == null ? void 0 : _a.message) || reason;
    } catch (e) {
    }
    return `提示词工程师请求失败: ${res.status} ${res.statusText}${reason ? " - " + reason : ""}`;
  }
};
