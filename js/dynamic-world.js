const DynamicWorld = {
  EXTRA_KEY: "storyExtraApi",
  SET_KEY: "storyDynamicWorld",
  extraDefaults: {
    enabled: false,
    type: "openai",
    endpoint: "",
    apiKey: "",
    model: "",
    maxTokens: 8192,
    temperature: 0.95,
    timeout: 90
  },
  setDefaults: {
    enabled: false,
    interval: 5,
    historyDepth: 5,
    minWords: 200,
    showReasoning: true,
    useKnowledge: true,
    prompt: ""
  },
  /* ==================== 配置存取（全局共享） ==================== */
  getExtraApi() {
    try {
      return { ...this.extraDefaults, ...JSON.parse(localStorage.getItem(this.EXTRA_KEY) || "{}") };
    } catch (e) {
      return { ...this.extraDefaults };
    }
  },
  saveExtraApi(cfg) {
    localStorage.setItem(this.EXTRA_KEY, JSON.stringify(cfg));
  },
  getSettings() {
    try {
      return { ...this.setDefaults, ...JSON.parse(localStorage.getItem(this.SET_KEY) || "{}") };
    } catch (e) {
      return { ...this.setDefaults };
    }
  },
  saveSettings(cfg) {
    localStorage.setItem(this.SET_KEY, JSON.stringify(cfg));
  },
  /** 额外API是否已完整配置（地址/Key/模型齐备） */
  isExtraReady() {
    const e = this.getExtraApi();
    return !!(e.endpoint && e.apiKey && e.model);
  },
  /** 动态世界整体是否可用（启用 + 额外API就绪） */
  isEnabled() {
    const s = this.getSettings();
    return !!(s.enabled && this.isExtraReady() && this.getExtraApi().enabled !== false);
  },
  /* ==================== 运行状态（storyState.dynamicWorld，随存档持久化） ==================== */
  state() {
    const fw = window.storyFramework;
    if (!fw.storyState.dynamicWorld) {
      fw.storyState.dynamicWorld = { history: [], floor: 0, messageCounter: 0, isProcessing: false, unread: 0 };
    }
    if (fw.storyState.dynamicWorld.unread == null) fw.storyState.dynamicWorld.unread = 0;
    return fw.storyState.dynamicWorld;
  },
  /* ==================== 第二API调用（OpenAI / Gemini 双格式） ==================== */
  /**
   * 带超时的 fetch：网络挂起时防止 st.isProcessing 永久为 true
   * （后续所有自动推演被 isProcessing 守卫拦截，动态世界静默失效直到刷新页面）
   */
  fetchWithTimeout(url, opts = {}, timeoutMs) {
    const ms = timeoutMs && timeoutMs > 0 ? timeoutMs : 9e4;
    const once = () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ms);
      return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer));
    };
    // v3.47.16 接入统一防护层：防429退避 + 前置节流（独立队列，不与主笔抢带宽）
    if (window.MoNetGuard && window.MoNetGuard.fetchWithRetry) {
      return window.MoNetGuard.fetchWithRetry(once, { label: "动态世界", throttleKey: "动态世界", silent: true });
    }
    return once();
  },
  /** 配置秒 → 毫秒（v1.6.7 修复：v1.6.1 起秒数被当毫秒，90 秒实际 0.09 秒即掐断请求） */
  _toMs(secs, fallbackSecs) {
    const s = typeof secs === "number" && secs > 0 ? secs : fallbackSecs;
    return s * 1e3;
  },
  /** 响应体读取统一带超时（v1.6.7：防服务器回响应头后正文挂起，接口假死） */
  _readBody(promise, ms) {
    if (window.withTimeoutMs) return window.withTimeoutMs(promise, ms);
    let timer = null;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        const e = new Error("body read timeout");
        e.name = "AbortError";
        reject(e);
      }, ms > 0 ? ms : 9e4);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  },
  /**
   * 调用额外API（可传 cfgOverride 以测试未保存的表单配置）
   * cfg 结构：{ type, endpoint, apiKey, model, maxTokens, temperature }
   * v1.6.7：超时秒数正确换算毫秒；流式零数据失败自动换非流式重试一次
   */
  async callExtraAPI(messages, cfgOverride) {
    var _a, _b;
    const cfg = cfgOverride ? { ...this.extraDefaults, ...cfgOverride } : this.getExtraApi();
    if (!(cfg.endpoint && cfg.apiKey && cfg.model)) throw new Error("额外API未配置完整（地址 / Key / 模型）");
    if (cfg.type === "gemini") {
      const endpoint = `${cfg.endpoint.trim().replace(/\/+$/, "")}/models/${cfg.model}:generateContent?key=${cfg.apiKey}`;
      const contents = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
      const sys = ((_a = messages.find((m) => m.role === "system")) == null ? void 0 : _a.content) || "";
      const fullMs2 = this._toMs(cfg.timeout, 90);
      const response2 = await this.fetchWithTimeout(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction: sys ? { parts: [{ text: sys }] } : void 0,
          generationConfig: { temperature: cfg.temperature || 0.95, maxOutputTokens: cfg.maxTokens || 8192 }
        })
      }, fullMs2);
      if (!response2.ok) {
        const t = await this._readBody(response2.text(), 15e3).catch(() => "");
        throw new Error(`额外API请求失败: ${response2.status} ${response2.statusText} ${t.slice(0, 180)}`);
      }
      const data = await this._readBody(response2.json(), fullMs2);
      if (!data.candidates || !data.candidates.length) return "（额外API未返回内容，可能被安全设置拦截）";
      const parts = ((_b = data.candidates[0].content) == null ? void 0 : _b.parts) || [];
      return parts.map((p) => p.text || "").filter(Boolean).join("").trim();
    }
    const base = cfg.endpoint.trim().replace(/\/+$/, "");
    const full = /\/(chat\/completions|completions)$/.test(base) ? base : `${base}/chat/completions`;
    const fullMs = this._toMs(cfg.timeout, 90);
    const firstMs = Math.min(6e4, fullMs);
    const doFetch = (stream) => this.fetchWithTimeout(full, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${cfg.apiKey}`
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: cfg.temperature || 0.95,
        max_tokens: cfg.maxTokens || 8192,
        ...stream ? { stream: true } : {}
      })
    }, stream ? firstMs : fullMs);
    const parseJson = async (response2) => {
      var _a2, _b2, _c, _d;
      const data = await this._readBody(response2.json(), fullMs);
      const msg = (_b2 = (_a2 = data.choices) == null ? void 0 : _a2[0]) == null ? void 0 : _b2.message;
      return ((_d = (_c = msg == null ? void 0 : msg.content) != null ? _c : msg == null ? void 0 : msg.reasoning_content) != null ? _d : "").trim();
    };
    try {
      const response2 = await doFetch(true);
      if (!response2.ok) {
        const t = await this._readBody(response2.text(), 15e3).catch(() => "");
        const e = new Error(`额外API请求失败: ${response2.status} ${response2.statusText} ${t.slice(0, 180)}`);
        e.isHttpError = true;
        throw e;
      }
      const ct = response2.headers && response2.headers.get && response2.headers.get("content-type") || "";
      if (/text\/event-stream/i.test(String(ct)) && response2.body && response2.body.getReader && window.readSSEStream) {
        const text = await window.readSSEStream(response2, {
          firstIdleMs: firstMs,
          idleMs: fullMs,
          extract: (json) => {
            var _a2;
            const d = json.choices && json.choices[0] && json.choices[0].delta;
            return d && ((_a2 = d.content) != null ? _a2 : d.reasoning_content) || "";
          }
        });
        if (text && text.trim()) return text.trim();
      } else {
        return await parseJson(response2);
      }
    } catch (e) {
      if (e && e.isHttpError) throw e;
    }
    const response = await doFetch(false);
    if (!response.ok) {
      const t = await this._readBody(response.text(), 15e3).catch(() => "");
      throw new Error(`额外API请求失败: ${response.status} ${response.statusText} ${t.slice(0, 180)}`);
    }
    return await parseJson(response);
  },
  /** 测试额外API连通性（供设置弹窗；cfgOverride 支持测试未保存的表单值） */
  async testExtraApi(cfgOverride) {
    const reply = await this.callExtraAPI([
      { role: "user", content: '你好，请回复"连接成功"四个字。' }
    ], cfgOverride);
    return reply;
  },
  /** 获取额外API模型列表（供设置弹窗「获取」按钮） */
  async fetchModels(cfgOverride) {
    const cfg = cfgOverride ? { ...this.extraDefaults, ...cfgOverride } : this.getExtraApi();
    if (!(cfg.endpoint && cfg.apiKey)) throw new Error("请先填写额外 API 地址与 Key");
    return cfg.type === "gemini" ? await window.fetchGeminiModels(cfg.endpoint, cfg.apiKey) : await window.fetchOpenAIModels(cfg.endpoint, cfg.apiKey);
  },
  /* ==================== 触发：每轮正文后计数 ==================== */
  /** 主流程每轮 AI 回复后调用（异步不阻塞）：计数达到间隔才真正生成 */
  async onTurnComplete(turnIdx = null) {
    const fw = window.storyFramework;
    const s = this.getSettings();
    if (fw && fw.storyState.isStoryStarted) this.updateDock();
    if (!s.enabled) return;
    if (!fw.storyState.isStoryStarted) return;
    if (!this.isExtraReady()) return;
    const st = this.state();
    if (st.isProcessing) return;
    st.messageCounter = (st.messageCounter || 0) + 1;
    const interval = Math.max(1, parseInt(s.interval) || 5);
    if (st.messageCounter < interval) {
      fw.saveStory();
      return;
    }
    st.messageCounter = 0;
    await this.generate(false, turnIdx);
  },
  /* ==================== 生成主链路 ==================== */
  /** manual：手动推演按钮触发；turnIdx：触发时刻捕获的轮号（v1.6.9 T2-⑫，
   *  生成历时数秒，完成时用户可能已进入下一轮——卡片必须归属触发时的轮次） */
  async generate(manual = false, turnIdx = null) {
    var _a, _b, _c, _d, _e, _f, _g;
    const fw = window.storyFramework;
    const s = this.getSettings();
    if (!s.enabled && !manual) return;
    if (!fw.storyState.isStoryStarted) {
      if (manual) (_a = window.StoryResponseHandler) == null ? void 0 : _a.renderSystemMessage("🌍 动态世界：尚未开篇，先完成开场后再试。", "info");
      return;
    }
    if (!this.isExtraReady()) {
      if (manual) {
        (_b = window.StoryResponseHandler) == null ? void 0 : _b.renderSystemMessage("🌍 动态世界：尚未配置额外 API（第二接口）。请到 ⚙ 接口设置 →「🌍 动态世界」区填写并保存。", "error");
        (_c = window.ConfigModal) == null ? void 0 : _c.open();
      }
      return;
    }
    const st = this.state();
    if (st.isProcessing) return;
    st.isProcessing = true;
    this._turnIdx = turnIdx;
    this.renderLoading();
    try {
      const messages = this.buildMessages(s);
      const tl = this.storyTimeline();
      (_d = window.TokenUsage) == null ? void 0 : _d.recordRequest(messages, "世界");
      const raw = await this.callExtraAPI(messages);
      if (!raw || !raw.trim()) throw new Error("额外API返回了空内容");
      (_e = window.TokenUsage) == null ? void 0 : _e.recordOutput(raw, "世界");
      const parsed = this.parseReply(raw);
      const entry = {
        floor: st.floor + 1,
        timestamp: Date.now(),
        era: tl.era || "",
        // v3.19.7：登记本层时代，抽屉楼层卡可见
        date: tl.date || "",
        story: parsed.story,
        reasoning: parsed.reasoning,
        updateBlock: parsed.updateBlock || null
      };
      st.history.push(entry);
      st.floor += 1;
      if (st.history.length > 60) st.history = st.history.slice(-60);
      if (parsed.updateBlock) {
        const parser = window.VariableInstructionParser;
        const prevChars = fw.storyState.variables && fw.storyState.variables.characters || {};
        fw.storyState.variables = fw.storyState.variables === parsed.baseRef ? parsed.newVariables : parser.parse(raw, fw.storyState.variables).newVariables;
        const chars = fw.storyState.variables && fw.storyState.variables.characters || {};
        Object.keys(chars).forEach((n) => {
          if (!prevChars[n] && chars[n] && typeof chars[n] === "object" && !Array.isArray(chars[n])) {
            chars[n].isFaraway = true;
          }
        });
        fw.updateStatusPanel();
      }
      this.removeLoading();
      this.notifyNewEntry(entry);
      fw.saveStory();
      console.log(`[动态世界] 第 ${entry.floor} 层生成成功`);
    } catch (err) {
      console.error("[动态世界] 生成失败:", err);
      this.removeLoading();
      const message = err && err.name === "AbortError" ? "额外API响应超时（默认 90 秒），本轮推演已放弃。可稍后点「手动推演」重试。" : `动态世界生成失败：${err.message}`;
      if (manual) {
        (_f = window.StoryResponseHandler) == null ? void 0 : _f.renderSystemMessage(`🌍 ${message}`, "error");
      } else if (err && err.name === "AbortError") {
        (_g = window.StoryResponseHandler) == null ? void 0 : _g.renderSystemMessage(`🌍 ${message}`, "error");
      }
    } finally {
      st.isProcessing = false;
    }
  },
  /**
   * 时代快照：从变量表与开局设定提取当前时代/日期（v3.19.7 修复时代漂移）
   * 取种链先近后远：AI 上报的时代变量 → 玩家亲笔自定义时代 → 预设时代描述 → 预设时代名
   * （与手机分身 PhonePanel.detectTier 同源同链，保证两个引擎看到同一个时代）
   */
  storyTimeline() {
    const fw = window.storyFramework;
    const v = fw && fw.storyState && fw.storyState.variables || {};
    const setup = fw && fw.storyState && fw.storyState.setup || {};
    const era = [v.era, v.时代, setup.customTimeline, setup.timelineDesc, setup.timeline, setup.timelineText].map((x) => String(x || "").trim()).find((x) => x && x !== "未上报") || "";
    const date = [v.date, v.日期, v.year].map((x) => String(x || "").trim()).find((x) => x && x !== "未上报") || "";
    return { era, date };
  },
  /** 构建发给额外API的消息序列（模仿觅长生 buildOptimizedMessages 的分层策略） */
  buildMessages(s) {
    const fw = window.storyFramework;
    const v = fw.storyState.variables;
    const setup = fw.storyState.setup || {};
    const st = this.state();
    let sys = (s.prompt || "").trim();
    if (!sys) {
      sys = typeof fw.config.dynamicWorldPrompt === "function" ? fw.config.dynamicWorldPrompt() : fw.config.defaultDynamicWorldPrompt || "";
    }
    if (!sys) {
      sys = '你是小说世界的动态世界生成器。根据当前故事状态，生成"主角视线之外正在发生的事"——社会一角、配角动向、势力暗流、环境变化。贴合题材气质，可被主线采纳也可忽略，严禁剧透主线真相。';
    }
    sys += `

【动态世界输出协议】
1. 先输出【推演】……【/推演】：50字内的世界逻辑推演（为什么此时此地发生这些事）。
2. 随后是远方事件正文：2-4 个独立事件，每个一段，共至少${s.minWords || 200}字；使用"据说 / 传闻 / 有人目睹 / 街头巷尾"等远观视角。
3. 最后附(variable_update)与(/variable_update)块，块内逐行纯文本指令，语法示例：
   陆押镖.role: 镖头          ← 登记远方NPC档案（角色名.字段: 值，字段可用 role/faction/location/status/personality 等）
   +南境商队失踪（埋设）      ← 登记伏笔（以+开头）
   >>大事记: 江氏三支商队失踪 ← 登记世界大事（>>大事记: 一句话事件，注意冒号）
4. 铁律：禁止改动主角既有数值（章节/字数/仪表盘/主角状态一律不碰）；只登记远方新增元素；严禁输出JSON对象。`;
    if (s.useKnowledge !== false && window.StoryKnowledge && window.StoryKnowledge.isEnabled() && window.StoryKnowledge.getCount() > 0) {
      try {
        const fg = window.StoryKnowledge.buildForegroundKnowledge("动态世界 远方事件 势力动态 世界变化 传闻", []) || [];
        const bg = window.StoryKnowledge.buildBackgroundKnowledge() || [];
        const kb = [...bg, ...fg].map((m) => m.content).join("\n\n");
        if (kb) sys += `

【🌍 动态世界知识库参考（世界事件须贴合以上设定）】
${kb}`;
      } catch (e) {
        console.warn("[动态世界] 知识库注入失败:", e);
      }
    }
    const messages = [{ role: "system", content: sys }];
    const isRP = fw.config.mode === "roleplay";
    const chapter = v.chapter || 1;
    const charNames = Object.keys(v.characters || {}).slice(0, 10);
    const hero = isRP ? setup.playerName ? `主角${setup.playerName}` : "玩家角色" : "主角";
    const gauges = (fw.config.gauges || []).map((g) => {
      var _a, _b;
      return `${g.label}${(_b = (_a = v[g.key]) != null ? _a : g.default) != null ? _b : 50}`;
    }).join(" / ");
    const nearChars = charNames.length ? charNames.join("、") : "无";
    const tl = this.storyTimeline();
    const tlLines = [
      tl.era ? `- 故事时代/时间线：${tl.era}` : "",
      tl.date ? `- 当前游戏内日期：${tl.date}` : ""
    ].filter(Boolean).join("\n");
    const context = `【当前故事状态（仅供参考，禁止修改）】
- 当前章节：第 ${chapter} 章（${isRP ? "第 " + chapter + " 回合" : ""}）
${tlLines ? tlLines + "\n" : ""}- ${hero}身边的登场人物：${nearChars}
- 状态仪表：${gauges || "无"}

【严格要求】
- 禁止推进主线时间！只描述"此时此刻"其他地方正在发生的事${tl.date ? `（即 ${tl.date} 前后的世界）` : ""}
${tl.era ? `- 时代铁律：所有远方事件必须严格处于上述时代（${tl.era}）之内——科技、器物、称谓、物价、事件类型与时代氛围一律与该时代相符；出现不属于该时代的事物即为重大违规
` : ""}- 禁止描写${hero}正在做什么，禁止涉及${hero}当前场景与在场人物
- 只写远方：不同地点的传闻、势力动态、环境变化
- ${isRP ? "严格遵循《" + fw.config.genreName + "》原著设定（原著人物与势力按原著行动，不改变原著大势，不剧透未发生的关键转折）" : "贴合故事题材与既有伏笔，不剧透主线真相"}
- 字数要求：正文至少${s.minWords || 200}字`;
    messages.push({ role: "user", content: context });
    const depth = Math.max(0, parseInt(s.historyDepth) || 5);
    if (depth > 0 && st.history.length > 0) {
      for (const entry of st.history.slice(-depth)) {
        messages.push({ role: "assistant", content: `【第${entry.floor}层世界动态】
${entry.story}` });
      }
    }
    messages.push({
      role: "user",
      content: "请生成新一层动态世界内容（远方事件 / 势力动态 / 伏笔暗流），按输出协议完整输出，不要中途截断。"
    });
    return messages;
  },
  /** 解析额外API回复：拆出推演 / 正文 / 变量块，并预合并变量 */
  parseReply(raw) {
    const fw = window.storyFramework;
    let reasoning = "";
    let text = String(raw);
    const rm = text.match(/【推演】\s*([\s\S]*?)(?:【\/推演】|(?=\n\s*\n))/) || text.match(/【推演】\s*([^\n]*)/);
    if (rm) {
      reasoning = rm[1].trim();
      text = text.replace(/【推演】[\s\S]*?(?:【\/推演】|(?=\n\s*\n))/, "").replace(/【推演】[^\n]*/, "");
    }
    const story = window.StoryResponseHandler.extractBody(text) || text.trim();
    const parser = window.VariableInstructionParser;
    const baseRef = fw.storyState.variables;
    const { newVariables, updateBlock } = parser.parse(raw, baseRef);
    return { story, reasoning, newVariables, updateBlock, baseRef };
  },
  /* ==================== 渲染（v1.6.2 世界动态模块：聊天流只留紧凑通知，完整内容进抽屉） ==================== */
  esc(str) {
    return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  },
  /** 模块 DOM 自举：浮动入口（v1.8.1 全端,桌面不再走顶栏专属）+ 抽屉面板 + 遮罩（未注入时动态创建，兼容旧缓存页面） */
  ensureModule() {
    var _a;
    if (document.getElementById("dwDrawer")) return;
    const fw = window.storyFramework;
    const dock = document.createElement("button");
    dock.id = "dwDock";
    dock.style.display = "none";
    dock.title = "世界动态（额外 AI 推演的远方事件）";
    dock.onclick = () => this.openPanel();
    dock.innerHTML = `
            <span class="dwd-ico">🌍</span>
            <span class="dwd-badge" id="dwDockBadge"></span>`;
    const overlay = document.createElement("div");
    overlay.className = "dw-overlay";
    overlay.id = "dwOverlay";
    overlay.onclick = () => this.closePanel();
    const drawer = document.createElement("aside");
    drawer.className = "dw-drawer";
    drawer.id = "dwDrawer";
    drawer.innerHTML = `
            <div class="dwd-head">
                <div class="dwd-title">
                    <span class="dwd-globe">🌍</span>
                    <span class="dwd-name">世界动态</span>
                    <span class="dwd-status" id="dwdStatus"></span>
                </div>
                <button class="dwd-close" onclick="DynamicWorld.closePanel()" title="收起模块">✕</button>
            </div>
            <div class="dwd-tip">主笔写正文，第二 AI 在幕后推演「${this.esc(((_a = fw == null ? void 0 : fw.config) == null ? void 0 : _a.genreName) || "本工坊")}」中主角视线之外正在发生的事；远方 NPC 与伏笔自动并入状态面板。</div>
            <div class="dwd-actions">
                <button class="dwd-act solid" onclick="DynamicWorld.generate(true)">⚡ 立即生成一层</button>
                <button class="dwd-act" onclick="DynamicWorld.openConfig()">⚙ 配置</button>
            </div>
            <div class="dwd-list" id="dwdList"></div>`;
    document.body.appendChild(dock);
    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
  },
  /** 更新浮动球入口的可见性与未读徽标（v1.8.1：全端显示 + 自由拖拽） */
  updateDock() {
    this.ensureModule();
    const st = this.state();
    const fw = window.storyFramework;
    const dock = document.getElementById("dwDock");
    const show = !!(fw && fw.storyState.isStoryStarted);
    /* v3.55.18 悬浮球收敛：界面只留小云一个悬浮球，世界动态改由小云菜单进入。
       徽标/未读逻辑保留（小云菜单会读 #dwDockBadge 显示未读数）。 */
    if (dock) dock.style.display = "none";
    if (dock && show && !dock._moDraggable && window.MoChibi) {
      window.MoChibi.makeDraggable(dock, { storageKey: "storyDwDockPos" });
    }
    this.renderBadge(st.unread);
  },
  /** 未读徽标：移动端浮动球 + 桌面顶栏「世界动态」按钮 */
  renderBadge(count) {
    const n = Math.max(0, parseInt(count) || 0);
    const set = (el) => {
      if (!el) return;
      let badge = el.querySelector(".top-badge, .dwd-badge");
      if (n > 0) {
        if (!badge) {
          badge = document.createElement(el.id === "dwDock" ? "span" : "span");
          badge.className = el.id === "dwDock" ? "dwd-badge" : "top-badge";
          el.appendChild(badge);
        }
        badge.textContent = n > 99 ? "99+" : String(n);
        badge.style.display = "inline-flex";
      } else if (badge) {
        badge.style.display = "none";
      }
    };
    set(document.getElementById("dwDock"));
    set(document.getElementById("dwBtn"));
  },
  /** 聊天流紧凑通知（v1.6.2：世界动态不再以大卡片插入正文下方） */
  notifyNewEntry(entry) {
    var _a, _b, _c;
    const st = this.state();
    st.unread = (st.unread || 0) + 1;
    const container = document.getElementById("chatMessages");
    if (container) {
      const div = document.createElement("div");
      div.className = "message-card dw-note";
      div.setAttribute("data-floor", entry.floor);
      const evCount = String(entry.story || "").split(/\n+/).filter((p) => p.trim().length > 10).length || "数";
      div.innerHTML = `
                <button class="dw-note-btn" onclick="DynamicWorld.openPanel()">
                    <span class="dwn-ico">🌍</span>
                    <span class="dwn-main">
                        <b>世界动态 · 第 ${entry.floor} 层已更新</b>
                        <i>${evCount} 条远方事件 · ${new Date(entry.timestamp).toLocaleString("zh-CN")}</i>
                    </span>
                    <span class="dwn-go">查看 ›</span>
                </button>`;
      (_c = (_a = window.StoryResponseHandler) == null ? void 0 : _a.tagTurnCard) == null ? void 0 : _c.call(_a, div, (_b = this._turnIdx) != null ? _b : void 0);
      container.appendChild(div);
      this.scrollToBottom();
    }
    this.refreshDrawer();
    this.updateDock();
  },
  renderLoading() {
    var _a, _b, _c;
    const drawer = document.getElementById("dwDrawer");
    const listEl = document.getElementById("dwdList");
    if (drawer && drawer.classList.contains("open") && listEl && !document.getElementById("dwdLoading")) {
      const d = document.createElement("div");
      d.id = "dwdLoading";
      d.className = "dwd-loading";
      d.innerHTML = '<span class="dw-dots"><i></i><i></i><i></i></span> 第二 AI 正在推演新的一层…';
      listEl.prepend(d);
    }
    const container = document.getElementById("chatMessages");
    if (!container || document.getElementById("dw-loading")) return;
    const div = document.createElement("div");
    div.className = "message-card dw-note dw-loading";
    div.id = "dw-loading";
    div.innerHTML = '<div class="dwn-busy"><span class="dw-dots"><i></i><i></i><i></i></span> 第二 AI 正在推演世界别处发生的事…</div>';
    (_c = (_a = window.StoryResponseHandler) == null ? void 0 : _a.tagTurnCard) == null ? void 0 : _c.call(_a, div, (_b = this._turnIdx) != null ? _b : void 0);
    container.appendChild(div);
    this.scrollToBottom();
  },
  removeLoading() {
    var _a, _b;
    (_a = document.getElementById("dw-loading")) == null ? void 0 : _a.remove();
    (_b = document.getElementById("dwdLoading")) == null ? void 0 : _b.remove();
  },
  scrollToBottom() {
    const container = document.getElementById("chatMessages");
    if (container) container.scrollTop = container.scrollHeight;
  },
  /** 存档恢复：世界动态不再回放进聊天流，改为模块呈现 + 一行恢复提示 */
  renderHistory() {
    var _a;
    this.ensureModule();
    const st = this.state();
    st.unread = 0;
    this.refreshDrawer();
    this.updateDock();
    if (Array.isArray(st.history) && st.history.length) {
      (_a = window.StoryResponseHandler) == null ? void 0 : _a.renderSystemMessage(
        `🌍 已恢复 ${st.history.length} 层世界动态${document.body.classList.contains("mobile") ? "（点右下角 🌍 查看）" : "（顶栏「世界动态」或快捷键查看）"}，将随正文继续推演。`,
        "info"
      );
    }
  },
  /** 工坊默认动态世界提示词（用户未自定义时的兜底，供设置弹窗展示与恢复） */
  getPromptDefault() {
    const fw = window.storyFramework;
    let sys = typeof fw.config.dynamicWorldPrompt === "function" ? fw.config.dynamicWorldPrompt() : fw.config.defaultDynamicWorldPrompt || "";
    if (!sys) sys = this.setDefaults.prompt;
    return sys || '你是小说世界的动态世界生成器。根据当前故事状态，生成"主角视线之外正在发生的事"——社会一角、配角动向、势力暗流、环境变化。贴合题材气质，可被主线采纳也可忽略，严禁剧透主线真相。';
  },
  /* ==================== 模块面板（v1.6.2 抽屉式） ==================== */
  /** 重试指定层：截断该层及之后的历史，重新生成该层 */
  async regenerate(floor) {
    var _a;
    const st = this.state();
    const idx = st.history.findIndex((e) => e.floor === floor);
    if (idx < 0) return;
    if (st.isProcessing) return;
    const ok = await ((_a = window.UIDialog) == null ? void 0 : _a.confirm({
      title: "重试世界动态",
      message: `将重新生成第 ${floor} 层（该层及之后的世界动态会被替换，主正文不受影响）。`
    }));
    if (!ok) return;
    st.history = st.history.slice(0, idx);
    st.floor = idx > 0 ? st.history[idx - 1].floor || 0 : 0;
    this.removeLoading();
    await this.generate(true);
    this.refreshDrawer();
  },
  /** 打开「世界动态」抽屉模块（移动端底部滑出 / 桌面右侧滑入） */
  openPanel() {
    var _a;
    this.ensureModule();
    const drawer = document.getElementById("dwDrawer");
    const overlay = document.getElementById("dwOverlay");
    this.refreshDrawer();
    if (drawer) drawer.classList.add("open");
    if (overlay) overlay.classList.add("show");
    const st = this.state();
    if (st.unread) {
      st.unread = 0;
      (_a = window.storyFramework) == null ? void 0 : _a.saveStory();
    }
    this.renderBadge(0);
  },
  closePanel() {
    var _a, _b;
    (_a = document.getElementById("dwDrawer")) == null ? void 0 : _a.classList.remove("open");
    (_b = document.getElementById("dwOverlay")) == null ? void 0 : _b.classList.remove("show");
  },
  openConfig() {
    var _a;
    this.closePanel();
    (_a = window.ConfigModal) == null ? void 0 : _a.open();
  },
  /** 刷新抽屉内容：状态条 + 事件列表（新层在前） */
  refreshDrawer() {
    this.ensureModule();
    const listEl = document.getElementById("dwdList");
    const statusEl = document.getElementById("dwdStatus");
    if (!listEl) return;
    const s = this.getSettings();
    const st = this.state();
    if (statusEl) {
      const state = !s.enabled ? "未启用" : !this.isExtraReady() ? "额外API未配置" : `每 ${s.interval} 轮自动推演`;
      statusEl.textContent = state;
      statusEl.className = "dwd-status " + (s.enabled && this.isExtraReady() ? "on" : "off");
    }
    if (!Array.isArray(st.history) || !st.history.length) {
      listEl.innerHTML = `
                <div class="dwd-empty">
                    <div class="dwd-empty-ico">🌍</div>
                    <p class="dwd-empty-title">世界尚在沉睡</p>
                    <p class="dwd-empty-sub">${s.enabled ? "开篇后随正文推进，第二 AI 将自动推演远方事件" : "到 ⚙ 接口设置 →「🌍 动态世界」启用并配置额外 API 后点亮"}</p>
                </div>`;
      return;
    }
    listEl.innerHTML = [...st.history].reverse().map((e) => this.buildEventHTML(e)).join("");
  },
  /** 单层世界动态事件卡（楼层徽标 + 所属时代 + 时间 + 正文 + 可折叠推演/登记 + 重试） */
  buildEventHTML(entry) {
    var _a;
    const s = this.getSettings();
    const prose = ((_a = window.StoryResponseHandler) == null ? void 0 : _a.formatProse) ? window.StoryResponseHandler.formatProse(entry.story) : this.esc(entry.story);
    const worldWhen = [entry.era, entry.date].filter(Boolean).join(" · ");
    return `
        <article class="dw-event" data-floor="${entry.floor}">
            <div class="dwe-head">
                <span class="dwe-floor">第 ${entry.floor} 层</span>
                ${worldWhen ? `<span class="dwe-era" title="本层所属时代（v3.19.7 起随层登记）">${this.esc(worldWhen)}</span>` : ""}
                <span class="dwe-time" ${worldWhen ? `title="生成时间：${new Date(entry.timestamp).toLocaleString("zh-CN")}"` : ""}>${worldWhen ? "🕐 " + new Date(entry.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : new Date(entry.timestamp).toLocaleString("zh-CN")}</span>
                <button class="dwe-retry" onclick="DynamicWorld.regenerate(${entry.floor})" title="重新生成本层（该层及之后会被替换）">↻ 重试本层</button>
            </div>
            ${entry.reasoning && s.showReasoning ? `
            <details class="dwe-reasoning">
                <summary>🧠 世界推演</summary>
                <div class="dwe-reasoning-body">${this.esc(entry.reasoning)}</div>
            </details>` : ""}
            <div class="dwe-body">${prose}</div>
            ${entry.updateBlock ? `
            <details class="dwe-changes">
                <summary>📈 世界变量登记（已并入状态面板）</summary>
                <pre class="dwe-changes-body">${this.esc(entry.updateBlock)}</pre>
            </details>` : ""}
        </article>`;
  }
};
window.DynamicWorld = DynamicWorld;
