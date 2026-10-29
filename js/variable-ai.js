const VariableAI = {
  KEY: "storyVarApi",
  defaults: {
    enabled: false,
    type: "openai",
    endpoint: "",
    apiKey: "",
    model: "",
    maxTokens: 4096,
    temperature: 0.2,
    timeout: 90,
    showCard: false,
    fallbackMain: true
    // v3.27.6：第三接口未配置时用主笔接口兜底登记（正文NPC不再漏登记）
  },
  /* ==================== 配置存取 ==================== */
  get() {
    try {
      return { ...this.defaults, ...JSON.parse(localStorage.getItem(this.KEY) || "{}") };
    } catch (e) {
      return { ...this.defaults };
    }
  },
  save(cfg) {
    localStorage.setItem(this.KEY, JSON.stringify(cfg));
  },
  /** 第三接口是否填全（地址/Key/模型） */
  isReady() {
    const c = this.get();
    return !!(c.endpoint && c.apiKey && c.model);
  },
  /** 变量AI整体是否生效（启用 + 接口就绪） */
  isEnabled() {
    const c = this.get();
    return !!(c.enabled && c.endpoint && c.apiKey && c.model);
  },
  /** v3.27.6 主笔兜底是否生效：第三接口未启用 + 兜底开关开 + 主笔已配置。
   *  背景：登记官架构下主笔提示词不带变量协议（v1.6.0 分流），弱模型不会自觉
   *  登记正文 NPC——第三接口没配的用户状态面板里永远只有动态世界的远方 NPC，
   *  正文人物一个不建档（微信分身通讯录同样吃不到）。兜底复用主笔接口跑同一套
   *  登记官提示词（低温强指令），与前情提要 v3.5.0 解耦同款哲学：
   *  状态面板是刚需，不该被第三接口绑死。 */
  isFallbackActive() {
    if (this.isEnabled()) return false;
    const c = this.get();
    if (c.fallbackMain === false) return false;
    const fw = window.storyFramework;
    return !!(fw && fw.isApiConfigured && fw.isApiConfigured());
  },
  /** 主笔兜底用的接口配置（从主笔 apiConfig 派生：低温 + 限额） */
  fallbackCfg() {
    const a = window.storyFramework.apiConfig || {};
    return {
      type: a.type,
      endpoint: a.endpoint,
      apiKey: a.apiKey,
      model: a.model,
      maxTokens: 2048,
      temperature: 0.2,
      timeout: 120
    };
  },
  /* ==================== 第三API调用（OpenAI / Gemini 双格式） ==================== */
  /**
   * 带超时的 fetch：防止第三接口网络挂起导致提取串行队列死锁
   * （队列 pending 永不落定 → 下一轮发送前 await pending 卡死整个应用）
   * 默认 90 秒；超时抛 AbortError → 出失败卡可重试，队列自动解锁
   */
  fetchWithTimeout(url, opts = {}, timeoutMs) {
    const ms = timeoutMs && timeoutMs > 0 ? timeoutMs : 9e4;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer));
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
   * v1.6.7：超时秒数正确换算毫秒；流式零数据失败自动换非流式重试一次
   * v1.6.9 T2-⑩：外层包装 token 记账（提取 / 滚动摘要共用此通道，均记「变量AI」）
   */
  async callAPI(messages, cfgOverride) {
    var _a, _b;
    (_a = window.TokenUsage) == null ? void 0 : _a.recordRequest(messages, "变量AI");
    const out = await this._callAPIInner(messages, cfgOverride);
    (_b = window.TokenUsage) == null ? void 0 : _b.recordOutput(out, "变量AI");
    return out;
  },
  async _callAPIInner(messages, cfgOverride) {
    var _a, _b, _c;
    const cfg = cfgOverride ? { ...this.defaults, ...cfgOverride } : this.get();
    if (!(cfg.endpoint && cfg.apiKey && cfg.model)) throw new Error("变量AI未配置完整（地址 / Key / 模型）");
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
          generationConfig: { temperature: (_b = cfg.temperature) != null ? _b : 0.2, maxOutputTokens: cfg.maxTokens || 4096 }
        })
      }, fullMs2);
      if (!response2.ok) {
        const t = await this._readBody(response2.text(), 15e3).catch(() => "");
        throw new Error(`变量AI请求失败: ${response2.status} ${response2.statusText} ${t.slice(0, 180)}`);
      }
      const data = await this._readBody(response2.json(), fullMs2);
      if (!data.candidates || !data.candidates.length) return "";
      const parts = ((_c = data.candidates[0].content) == null ? void 0 : _c.parts) || [];
      return parts.map((p) => p.text || "").filter(Boolean).join("").trim();
    }
    const base = cfg.endpoint.trim().replace(/\/+$/, "");
    const full = /\/(chat\/completions|completions)$/.test(base) ? base : `${base}/chat/completions`;
    const fullMs = this._toMs(cfg.timeout, 90);
    const firstMs = Math.min(6e4, fullMs);
    const doFetch = (stream) => {
      var _a2;
      return this.fetchWithTimeout(full, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${cfg.apiKey}`
        },
        body: JSON.stringify({
          model: cfg.model,
          messages,
          temperature: (_a2 = cfg.temperature) != null ? _a2 : 0.2,
          max_tokens: cfg.maxTokens || 4096,
          ...stream ? { stream: true } : {}
        })
      }, stream ? firstMs : fullMs);
    };
    const parseJson = async (response2) => {
      var _a2, _b2, _c2, _d;
      const data = await this._readBody(response2.json(), fullMs);
      const msg = (_b2 = (_a2 = data.choices) == null ? void 0 : _a2[0]) == null ? void 0 : _b2.message;
      const content = (_d = (_c2 = msg == null ? void 0 : msg.content) != null ? _c2 : msg == null ? void 0 : msg.reasoning_content) != null ? _d : "";
      return (content || "").trim();
    };
    try {
      const response2 = await doFetch(true);
      if (!response2.ok) {
        const t = await this._readBody(response2.text(), 15e3).catch(() => "");
        const e = new Error(`变量AI请求失败: ${response2.status} ${response2.statusText} ${t.slice(0, 180)}`);
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
      throw new Error(`变量AI请求失败: ${response.status} ${response.statusText} ${t.slice(0, 180)}`);
    }
    return await parseJson(response);
  },
  /** 测试第三接口连通性（cfgOverride 支持未保存的表单值） */
  async testVarApi(cfgOverride) {
    return await this.callAPI([{ role: "user", content: '你好，请回复"连接成功"四个字。' }], cfgOverride);
  },
  /** 拉取模型列表（供设置弹窗「获取」） */
  async fetchModels(cfgOverride) {
    const cfg = cfgOverride ? { ...this.defaults, ...cfgOverride } : this.get();
    if (!(cfg.endpoint && cfg.apiKey)) throw new Error("请先填写变量AI地址与 Key");
    return cfg.type === "gemini" ? await window.fetchGeminiModels(cfg.endpoint, cfg.apiKey) : await window.fetchOpenAIModels(cfg.endpoint, cfg.apiKey);
  },
  /* ==================== 提示词消毒（启用时剥离工坊配置中的变量登记指令） ==================== */
  /**
   * 判断是否为变量系统段落标题（整段剔除：吃到下一个【标题】行或文末）
   * 覆盖各工坊配置的：字段检查清单 / 角色档案卡 / 档案示例 / 完整检查清单 / 变量登记 等段落
   * 两种形态：
   *   ①【】标题部分本身含变量系统字样（如【角色档案卡 - 持续完善】）
   *   ② 短标题行，【】后接简短说明且含变量标记（如「【完整检查清单】每次 variable_update 后逐项自查：」）
   * 长内容行（开篇指令整行正文，如「【开始创作】书名…结尾附(variable_update)…与选项」）
   * 不算段落标题——交给行级混合清理，否则会把整条开篇指令误删
   */
  isVarSectionHeader(line) {
    const t = String(line);
    const m = t.match(/^[ \t]*【[^】\n]*】/);
    if (m) {
      if (/variable_?update|变量|档案|字段清单|字段列表/i.test(m[0])) return true;
      return t.length <= 60 && /variable_?update|变量|档案|字段清单|字段列表/i.test(t);
    }
    return /^[ \t]*(字段清单|字段列表)\s*[:：]?\s*$/.test(t);
  },
  /** 判断是否为变量语法示例/指令行（段落外残留的安全网） */
  isVarSyntaxLine(line) {
    const t = String(line).trim();
    if (!t || t.length > 120) return false;
    if (/^[✅☑√□■✓❑][ \t]*/.test(t)) {
      return /chapter|wordCount|变量|伏笔|档案|建档|登记|大事记|仪表盘|道具|物品|history|trust|suspicion|境界|修为|status/i.test(t);
    }
    return /^>{1,2}\s*\S{1,12}\s*[:：]/.test(t) || /^[+-]\s*\S.{0,23}(\s*x\s*\d+)?（(埋设|回收|获得|失去|埋下|揭晓)）?$/.test(t) || /^(chapter|wordCount|totalChapters|title|bookTitle|tension|sanity|revelation|crisis|danger|logic|suspense)\s*[:：]/i.test(t) || /^\S{1,10}\.(role|age|personality|motivation|secret|appearance|speechPattern|mannerism|realm|faction|location|goal|impression|relationship|trust|suspicion|status|firstAppearance|arc|isCulprit|isPlayer|isCanon|history)\s*[:：]/i.test(t) || /^\d+[.、]\s*(角色名|角色|玩家|NPC)\.\w+\s*[:：]/.test(t) || /→\s*[+-]?\S{0,20}\s*[:：]/.test(t);
  },
  /**
   * 提示词消毒：变量AI启用时，把工坊系统提示词 / 开篇指令中的
   * 变量登记要求整段剥离（主笔只看到创作规范，看不到任何变量语法）
   * 未启用时原样返回（零副作用）
   */
  sanitizePrompt(text) {
    if (!text) return text;
    if (!this.isEnabled() && !this.isFallbackActive()) return String(text);
    const lines = String(text).split(/\r?\n/);
    const stage1 = [];
    let skipping = false;
    for (const line of lines) {
      const header = line.match(/^[ \t]*【[^】\n]*】/);
      if (this.isVarSectionHeader(line)) {
        skipping = true;
        continue;
      }
      if (skipping) {
        if (header) {
          skipping = false;
          stage1.push(line);
        }
        continue;
      }
      stage1.push(line);
    }
    const stage2 = [];
    for (const line of stage1) {
      if (!/variable_update|variableUpdate/i.test(line)) {
        stage2.push(line);
        continue;
      }
      if (/行动选项|情节走向|剧情选项|下一步/.test(line)) {
        const cleaned = line.replace(/\(variable_update\)\s*变量(更新)?块?(（[^（）]*）)?/gi, "").replace(/【?variableUpdate[^，。；】)]*】?/gi, "").replace(/变量(更新)?块/g, "").replace(/[（(]\s*[\)）]/g, "").replace(/附\s*与/, "附").replace(/\s{2,}/g, " ");
        if (cleaned.trim()) stage2.push(cleaned.trim());
      }
    }
    const stage3 = stage2.filter((line) => !this.isVarSyntaxLine(line));
    const out = [];
    const hasContentLine = stage3.some((l) => l.trim() && !/^[ \t]*【[^】\n]+】[ \t]*$/.test(l));
    if (hasContentLine) {
      for (let i = 0; i < stage3.length; i++) {
        if (/^[ \t]*【[^】\n]+】[ \t]*$/.test(stage3[i])) {
          let j = i + 1;
          while (j < stage3.length && !stage3[j].trim()) j++;
          if (j >= stage3.length || /^[ \t]*【[^】\n]+】/.test(stage3[j])) continue;
        }
        out.push(stage3[i]);
      }
    } else {
      out.push(...stage3);
    }
    const renum = [];
    let run = [];
    const flushRun = () => {
      if (run.length >= 2) {
        const nums = run.map((r) => r.num);
        const hasGap = nums.some((n, i) => i > 0 && n !== nums[i - 1] + 1);
        const asc = nums.every((n, i) => i === 0 || n > nums[i - 1]);
        if (hasGap && asc) {
          let cur = run[0].num;
          for (const r of run) {
            renum.push(r.text.replace(/^(\s*)(\d+)([.、)．])/, (mm, sp, d, suf) => `${sp}${cur}${suf}`));
            cur++;
          }
          run = [];
          return;
        }
      }
      for (const r of run) renum.push(r.text);
      run = [];
    };
    for (const line of out) {
      const m = line.match(/^(\s*)(\d+)([.、)．])\s/);
      if (m) run.push({ num: parseInt(m[2], 10), text: line });
      else {
        flushRun();
        renum.push(line);
      }
    }
    flushRun();
    return renum.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  },
  /* ==================== 每轮触发（主流程接线） ==================== */
  /** 主流程每轮 AI 回复渲染后调用；串行排队，连发指令不丢轮
   *  turnIdx：触发时刻捕获的轮号（v1.6.9 T2-⑫），卡片按它打标签防错轮 */
  onTurnComplete(reply, turnIdx) {
    var _a;
    const fw = window.storyFramework;
    if (!fw.storyState.isStoryStarted) return Promise.resolve();
    this.maybeSummarize().catch((e) => console.warn("[前情提要] 触发失败:", e));
    const parser = window.VariableInstructionParser;
    const block = parser ? parser.extractUpdateBlock(reply) : null;
    if (block) {
      const CHAR_FIELD_RE = /(?:^|\n)[^\n]{0,14}[.．]\s*(?:role|age|appearance|personality|speechPattern|mannerism|motivation|goal|secret|status|location|occupation|income|assets|realm|impression|relationship|trust|favor|firstAppearance|arc|note|isCanon|isCulprit|isPlayer|history|身份|年龄|外貌|性格|言谈|口癖|动机|目标|秘密|状态|位置|所在|信任|好感|关系|印象|轨迹|境遇|行当|收入|家当|首次出场|初登场)\s*[:：]/i;
      const hasCharLine = CHAR_FIELD_RE.test(block) || /["']?characters["']?\s*[:：]\s*[{[]/i.test(block);
      if (hasCharLine) {
        window.YJ_DEBUG && console.log("[变量AI] 主笔本轮自带变量块，跳过提取");
        return Promise.resolve();
      }
      const body = ((_a = window.StoryResponseHandler) == null ? void 0 : _a.extractBody) ? window.StoryResponseHandler.extractBody(reply) : reply;
      const hasDialogue = /[「“][^」”]{1,120}[」”]/.test(String(body));
      if (!hasDialogue) {
        window.YJ_DEBUG && console.log("[变量AI] 主笔本轮自带变量块，跳过提取");
        return Promise.resolve();
      }
      window.YJ_DEBUG && console.log("[变量AI] 主笔变量块无角色登记（正文有对白），登记官补位");
    }
    const run = () => this.extract(reply, false, turnIdx);
    this._pending = (this._pending || Promise.resolve()).then(run, run);
    return this._pending;
  },
  /* ==================== 前情提要（滚动摘要，T2-⑦） ==================== */
  /**
   * 滚动摘要：上下文组装只带最近 16 条历史，更早的轮次会从 AI 视野中消失
   * （长篇创作中后期剧情连贯性崩坏的根源）。本方法把窗口之外的旧轮次
   * 压缩成一段滚动"前情提要"，由 buildStoryMessages 注入——旧剧情以 400 字
   * 摘要形态持续在场，而非彻底丢失。
   * 触发：滑动窗口外积压 ≥ 8 条未摘要消息（约 4 轮）时并入一次；
   * 锚点校准：存档截断（localStorage 只留 80 条）或回退后数组移位，
   * upToIndex 以锚点文本重新定位，失配时保守收缩覆盖范围（宁可少摘要、绝不重复摘要）
   */
  /**
   * 摘要通道（v3.7.0 通道化）：摘要官 → 登记官 → 主笔 三级兜底。
   * ChannelHub 就绪时全权代理；缺省回退 v3.5.0 双链（登记官 / 主笔）。
   */
  async recapCall(messages) {
    var _a, _b;
    if (window.ChannelHub && window.ChannelHub.canCall("scribe")) {
      return await window.ChannelHub.call("scribe", messages);
    }
    if (this.isEnabled()) return await this.callAPI(messages);
    const fw = window.storyFramework;
    if (!fw || !fw.isApiConfigured || !fw.isApiConfigured()) throw new Error("主笔接口未配置");
    const a = fw.apiConfig;
    const cfg = {
      type: a.type,
      endpoint: a.endpoint,
      apiKey: a.apiKey,
      model: a.model,
      maxTokens: 1200,
      temperature: 0.3,
      timeout: 90
    };
    (_a = window.TokenUsage) == null ? void 0 : _a.recordRequest(messages, "前情提要");
    const out = await this._callAPIInner(messages, cfg);
    (_b = window.TokenUsage) == null ? void 0 : _b.recordOutput(out, "前情提要");
    return out;
  },
  /** 摘要能力是否可用（摘要官链就绪 / 第三接口就绪 / 主笔已配置 任一即可） */
  recapReady() {
    if (window.ChannelHub && window.ChannelHub.canCall("scribe")) return true;
    if (this.isEnabled()) return true;
    const fw = window.storyFramework;
    return !!(fw && fw.isApiConfigured && fw.isApiConfigured());
  },
  async maybeSummarize() {
    var _a, _b;
    const fw = window.storyFramework;
    if (!this.recapReady() || !((_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.isStoryStarted)) return;
    if (this._sumBusy) return;
    const hist = fw.storyState.conversationHistory || [];
    const digest = fw.storyState.digest || {};
    const KEEP = 16;
    const BATCH = 8;
    let covered = Math.max(0, Number(digest.upToIndex) || 0);
    if (covered > 0 && digest.anchor) {
      const at = String(((_b = hist[covered]) == null ? void 0 : _b.content) || "");
      if (!at.startsWith(digest.anchor)) {
        const idx = hist.findIndex((m) => String(m.content || "").startsWith(digest.anchor));
        covered = idx >= 0 ? idx : Math.max(0, hist.length - KEEP);
      }
    }
    if (covered > hist.length) covered = Math.max(0, hist.length - KEEP);
    const end = hist.length - KEEP;
    if (end - covered < BATCH) return;
    this._sumBusy = true;
    const epochAtStart = Number(fw.storyState._rollbackEpoch) || 0;
    try {
      const older = hist.slice(covered, end);
      if (!older.length) return;
      const text = older.map(
        (m) => (m.role === "user" ? "【指令】" : "【正文】") + this._trimForSummary(String(m.content || ""))
      ).join("\n");
      const prev = digest.summary ? `【已有摘要（把新内容并入其中，重写为一段）】
${digest.summary}

` : "";
      const out = await this.recapCall([
        { role: "system", content: `你是小说工坊的"前情提要官"。请把已有摘要与新内容合并，输出一段不超过 400 字的连贯前情提要（第三人称、按时间顺序）。必须保留：主线关键进展、人物登场与关系变化、未回收的伏笔与悬念、关键道具得失、当前所处危机。删除：重复信息与次要场景细节。只输出提要正文，不要标题、不要解释。` },
        { role: "user", content: `${prev}【新内容（待并入摘要）】
${text}` }
      ]);
      const summary = String(out || "").trim().slice(0, 600);
      if (!summary) return;
      if ((Number(fw.storyState._rollbackEpoch) || 0) !== epochAtStart) {
        window.YJ_DEBUG && console.log("[前情提要] 检测到回退/重生成，本轮摘要丢弃（防旧事复活）");
        return;
      }
      const anchorMsg = hist[end];
      fw.storyState.digest = {
        summary,
        upToIndex: end,
        anchor: anchorMsg ? String(anchorMsg.content || "").slice(0, 80) : void 0
      };
      fw.saveStory();
      window.YJ_DEBUG && console.log(`[前情提要] 已并入 ${older.length} 条旧消息（摘要覆盖 ${end}/${hist.length} 条）`);
    } catch (e) {
      console.warn("[前情提要] 摘要失败（下轮自动重试）:", e.message);
    } finally {
      this._sumBusy = false;
    }
  },
  /** 摘要输入裁剪：剔除变量块、正文超长截断 */
  _trimForSummary(s) {
    let t = String(s || "").replace(/\(variable_update\)[\s\S]*?\(\/variable_update\)/gi, "（变量块略）").replace(/[(【<]\/?variable_update[)】>]?[\s\S]*$/i, "");
    return t.length > 700 ? t.slice(0, 700) + "……" : t;
  },
  /** v3.5.0 防漂移：登记矛盾注记（下一轮由场域注记回流纠偏指引，取后即清） */
  recordDrift(lines) {
    try {
      const fw = window.storyFramework;
      const notes = fw.storyState.driftNotes || [];
      lines.slice(0, 3).forEach((t) => {
        if (!notes.some((n) => n.text === t)) notes.push({ text: t, at: Date.now() });
      });
      fw.storyState.driftNotes = notes.slice(-4);
      fw.saveStory();
      console.warn("[变量AI·审计] 检出数值漂移：", fw.storyState.driftNotes.map((n) => n.text));
    } catch (e) {
    }
  },
  /** 上一轮待落库的提取任务（发送下一轮前等待，保证上下文状态最新） */
  get pending() {
    return this._pending || null;
  },
  /* ==================== 提取主链路 ==================== */
  async extract(reply, manual = false, turnIdx = null) {
    var _a, _b, _c, _d;
    const fw = window.storyFramework;
    const viaFallback = this.isFallbackActive();
    if (!this.isEnabled() && !viaFallback) return;
    if (this._busy) return;
    const raw = String(reply || "");
    if (!raw.trim()) return;
    this._busy = true;
    this._lastReply = raw;
    try {
      const body = ((_a = window.StoryResponseHandler) == null ? void 0 : _a.extractBody) ? window.StoryResponseHandler.extractBody(raw) : raw.replace(/\(variable_update\)[\s\S]*?\(\/variable_update\)/gi, "").trim();
      this._lastBody = body;
      const messages = this.buildMessages(body);
      const out = viaFallback ? ((_b = window.TokenUsage) == null ? void 0 : _b.recordRequest(messages, "登记·主笔兜底"), await this._callAPIInner(messages, this.fallbackCfg()).then((t) => {
        var _a2;
        return (_a2 = window.TokenUsage) == null ? void 0 : _a2.recordOutput(t, "登记·主笔兜底"), t;
      })) : await this.callAPI(messages);
      if (!out || !out.trim()) throw new Error("变量AI返回了空内容");
      const driftLines = [];
      const cleaned = String(out).split(/\r?\n/).filter((l) => {
        const m = l.trim().match(/^!!drift[:：]\s*(.+)$/i);
        if (m) {
          driftLines.push(m[1].trim());
          return false;
        }
        return true;
      }).join("\n");
      const leak = body.match(/(?:张力|理智值?|清醒度|SAN值?|暴露风险|忆力|心动指数|紧张感?|危险度|悬疑感?)[^\d\n]{0,4}\d{1,3}(?:\s*\/\s*100)?/);
      if (leak) driftLines.push(`正文泄露面板|正文出现「${leak[0].slice(0, 24)}」|正文严禁出现任何数值面板，状态只在面板呈现`);
      if (driftLines.length) this.recordDrift(driftLines);
      const parser = window.VariableInstructionParser;
      const base = fw.storyState.variables;
      const { newVariables, updateBlock } = parser.parse(cleaned, base, { storyRegistration: true });
      let merged = newVariables;
      if (updateBlock) {
        if (fw.storyState.variables !== base) {
          merged = parser.parse(out, fw.storyState.variables, { storyRegistration: true }).newVariables;
        }
        fw.storyState.variables = merged;
        fw.updateStatusPanel();
        (_c = document.querySelectorAll) == null ? void 0 : _c.call(document, ".va-card.va-error").forEach((el) => el.remove());
      }
      const cfg = this.get();
      if ((cfg.showCard || manual) && updateBlock) {
        this.renderCard({ updateBlock, chapter: merged.chapter, turnIdx });
      }
      fw.saveStory();
      window.YJ_DEBUG && console.log(`[变量AI] 第 ${(_d = merged.chapter) != null ? _d : "?"} 章状态登记完成（${updateBlock ? updateBlock.split("\n").filter(Boolean).length : 0} 条指令）`);
    } catch (err) {
      console.error("[变量AI] 登记失败:", err);
      const via = this.isFallbackActive();
      const friendly = err && err.name === "AbortError" ? new Error(via ? "主笔接口响应超时（登记兜底）。稍后点「重试登记」即可；频繁超时可到接口设置里换更快的模型。" : "第三接口响应超时（默认 90 秒）。请确认变量AI接口地址 / Key 可用后点「重试登记」。") : err;
      this.renderFailCard(friendly, turnIdx);
    } finally {
      this._busy = false;
    }
  },
  /** 重试最近一轮登记（失败卡按钮）
   *  v1.6.8 修复：改走串行队列——旧代码直接调 extract，队列正忙时被 _busy 静默吞掉，
   *  用户点「重试登记」毫无反应；入队后必然执行 */
  async retry() {
    if (!this._lastReply) return;
    const run = () => this.extract(this._lastReply, true);
    this._pending = (this._pending || Promise.resolve()).then(run, run);
    await this._pending;
  },
  /** 构建发给变量AI的消息（登记官提示词 + 当前状态快照 + 本轮正文） */
  buildMessages(storyText) {
    var _a;
    const fw = window.storyFramework;
    const v = fw.storyState.variables;
    let sys = `你是小说工坊的"状态登记官"（变量AI，第三模型）。主笔AI刚写完一轮正文，你的唯一任务：通读正文，把其中明确发生的状态变化登记为变量指令。只登记正文中确凿发生的事，严禁编造、严禁登记未发生的变化。

【输出协议】
只输出一个 (variable_update) 与 (/variable_update) 块，块外不得有任何文字（不要解释、不要复述正文、不要输出选项）。
块内为逐行"键: 值"纯文本指令，一行一条，可用指令：
  chapter: 2                ← 章节从正文标题推断；无标题则 chapter: +1
  wordCount: +800           ← 本轮正文新增字数（只填增量，勿填全书累计值）
  title: 书名               ← 仅在尚无书名时登记
  time: 19:40·晚自习        ← 【每轮必报】当前时刻与天象（正文未明写也按剧情推断，24时制「HH:MM·氛围」或「子时/卯时」）；时辰变了才写
  weather: 夜雨             ← 一词天象（晴/阴/雨/雪/雾/雷暴/风沙…）；变了才写
  tension: 45              ← 【每轮必报】本轮剧情张力绝对值 0-100（日常闲叙≤20，暗流涌动30-50，正面冲突60-80，生死关头90+；供张力曲线绘图）
  +伏笔名称（埋设）         ← 埋设新伏笔
  -已回收伏笔名称           ← 回收伏笔
  +道具名称 x1              ← 道具增减
  角色名.字段: 值           ← 新登场或有变化的角色（字段：role/relation/age/appearance/personality/speechPattern/mannerism/realm/faction/location/motivation/goal/secret/impression/relationship/trust/status/firstAppearance/arc/occupation/income/assets/note）
  角色名.favor: 55          ← 好感 0-100（随剧情涨落才写）
  角色名.格子名: 新值       ← 更新快照里标注「玩家已交还AI管理」的自定义格子（未标注的格子是玩家亲笔，严禁改动）
  自定义.字段名: 新值       ← 更新快照「玩家自定义追踪」栏里的字段（玩家指定追踪的私货变量；正文里它对应的状态变化时必须如实更新，如「自定义.境界: 练气后期」「自定义.灵石: +50」）
  era: 1925年·喧嚣年代      ← 时代（开篇轮正文落地的时代照实登记；变了才写）
  date: 1925年4月12日       ← 当前日期（如实推进；变了才写）
  location: 中国·上海·外滩  ← 本轮正文结束时所在（「国家/地区·城市·场所」格式；以文末镜头落在哪为准，转场到达必报新位置——严禁报出发前的旧位置；未变可不写）
  cash: 银元 12 枚          ← 随身现金（正文有钱物得失时登记，带货币单位）
  savings: 存款/积蓄        ← 正文提及积蓄变动时登记
  chapterTitle: 章回标题    ← 本轮章回标题（有则登记）
  >>角色名.history: 轨迹记录
  >>大事记: 一句话事件
铁律：严禁输出 JSON 对象、花括号、方括号或代码块；已存在的伏笔/道具/人物不重复登记；数值键优先用增量（+/-）。

【人物登记铁律（最高优先级之一）】
本轮正文里凡是「开口说话 / 被指名道姓 / 与主角有互动」的人物，一律登记档案（快照中带{远方·未遇见}标记者同理——TA 是只闻其名的远方人物，正文真实相遇即正常登记，系统会自动把 TA 从"远方"转正）：
  - 新登场者必须完整建档，一次报足 角色名.role / .relation / .age / .appearance / .personality / .speechPattern / .motivation / .status 八项——正文明示的信息照实登记，未明示的按剧情与身份合理推断补全（推断也是登记官职责，不许留白）；
  - relation 是关系归类（家人/恋人/亲友/熟人 之一）：按剧情里 TA 与主角的关系判断（舅妈→家人、未婚妻→恋人、发小→亲友、邻居→熟人），首次建档时登记；只有关系质变（成婚/结拜/翻脸）才更新；
  - 快照里已有档案但本轮有变化者，报变化字段（位置/状态/信任/秘密揭晓等）；角色的 location 一律登记本轮正文结束时所在——转场到达即报新位置，严禁报出发前的旧位置（旧版正是因此导致行旅图鉴位置慢一拍）；
  - 只报一行 role 的残缺档案视为失职——档案是玩家状态面板与手机通讯录的数据源，缺一栏面板就空一格。
人物登记示例（新登场）：
  许静.role: 邻居
  许静.relation: 熟人
  许静.age: 31
  许静.appearance: 三十来岁，眼下有淡淡乌青，总穿洗旧的灰色开衫
  许静.personality: 谨慎，话少，观察力强，警惕心重
  许静.speechPattern: 短句，常用反问，几乎不用语气词
  许静.motivation: 弄清旧公寓夜里异响的来源，也想确认自己没有疯
  许静.status: 在楼道与主角初次搭话，对主角将信将疑

【玩家自定义追踪铁律（最高优先级之一）】
快照里的「玩家自定义追踪」栏（自定义.字段名）与角色档案里标注「玩家已交还AI管理」的格子（🧩），是玩家点名要你照看的状态——正文里这些状态确凿变化时（突破/受伤/得失/涨落），必须用对应指令登记新值：
  - 自定义字段用「自定义.字段名: 新值」（数值可带 +/- 增量）；
  - 交还AI的角色格子用「角色名.格子名: 新值」；
  - 示例：正文写主角从练气中期突破至练气后期 → 快照「玩家自定义追踪」有「境界=练气中期」→ 必须报「自定义.境界: 练气后期」；若它在某角色档案的解锁格子里 → 报「角色名.境界: 练气后期」。
  - 漏登这些字段 = 玩家面板永远停留在旧值，只能手动改——这是失职。
  - 严禁改动标注「玩家亲笔设定」的格子与未出现在快照里的自定义字段。

【防漂移审计（可选，放在块内最后一行）】
通读正文时若发现"正文实际表现"与下方「当前状态快照」中的数值明显矛盾（例：快照张力 15/100 但正文惊险万分；某角色信任 80 但正文写其猜忌提防；快照显示角色重伤但正文生龙活虎），在块内最后追加一行（最多两行）：
!!drift: 字段或人物名|面板当前值|正文实际表现
只报确凿矛盾，拿不准就不报；无矛盾则不输出该行。

【实体玩法账本铁律（v3.32.0 · 仅当快照含「安全屋住户」等实体字段时生效）】
本界部分状态由「实体引擎」在玩家端结算（资源账本/工程队列/住户名册）——你负责登记引擎之外、正文里真实发生的事：
  - 安全屋住户：正文里有人正式入住安全屋 → 逐条登记「安全屋住户.姓名: 身份」（如：安全屋住户.刘阿姨: 小区楼长）；住户离开/身故/叛逃 → 登记一行带去向（如：安全屋住户.陈锐: 离开·投奔军方）；住户健康/心情/忠诚因剧情显著变化 → 「安全屋住户.姓名.心情: 45」格式报 0-100 数值；
  - 资源异动：正文发生拾获/缴获/被窃/消耗大额物资 → 「资源异动.物资名: 数量或量级」（如：资源异动.药品: 拾获退烧药二十盒）；
  - 严禁改写玩家已操作的账目：凡玩家操作凭证列出过的资源扣减、工程进度、派工安排，一律不得在 (variable_update) 里报出相反数值——引擎账本是唯一事实源，你只补引擎之外的事。`;
    const digest = typeof window.buildStoryDigest === "function" ? window.buildStoryDigest() : "";
    if (digest) {
      sys += `

【当前状态快照（在此基础增量登记）】
${digest}`;
    }
    const messages = [{ role: "system", content: sys }];
    const hist = fw.storyState.conversationHistory || [];
    const lastUser = [...hist].reverse().find((m) => m.role === "user");
    const parts = [];
    if (lastUser) parts.push(`【本轮指令】
${String(lastUser.content).slice(0, 600)}`);
    parts.push(`【本轮正文（待登记）】
${storyText}`);
    if (!v.title && ((_a = fw.storyState.setup) == null ? void 0 : _a.title)) {
      parts.push(`【补充】本书书名为《${fw.storyState.setup.title}》，请在块内登记 title。`);
    }
    messages.push({ role: "user", content: parts.join("\n\n") });
    return messages;
  },
  /* ==================== 渲染 ==================== */
  esc(str) {
    return String(str != null ? str : "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  },
  /** 登记回执卡（默认关闭；开启后每轮一张，可折叠看标签与原始指令）
   *  turnIdx：触发时刻捕获的轮号（T2-⑫），卡片归属正确的轮次 */
  renderCard({ updateBlock, chapter, turnIdx }) {
    var _a, _b, _c, _d, _e;
    const container = document.getElementById("chatMessages");
    if (!container) return;
    const chips = ((_a = window.StoryResponseHandler) == null ? void 0 : _a.translateChanges(updateBlock)) || [];
    const card = document.createElement("div");
    card.className = "message-card va-card";
    card.innerHTML = `
            <div class="va-head">
                <span class="va-badge">🧾 状态登记</span>
                <span class="va-ch">第 ${this.esc(chapter != null ? chapter : "?")} 章</span>
                <span class="va-label">${this.isFallbackActive() ? "主笔兜底登记" : "变量AI · 第三模型"}</span>
            </div>
            <details class="va-changes" open>
                <summary>📊 本轮登记（${chips.length} 项）</summary>
                <div class="va-chip-area">${chips.map((c) => `<span class="va-chip">${c.icon || "·"} ${this.esc(c.text)}</span>`).join("")}
                </div>
                <details class="va-raw-details"><summary>查看原始指令（调试用）</summary>
                    <pre class="va-raw">${this.esc(updateBlock)}</pre>
                </details>
            </details>`;
    (_c = (_b = window.StoryResponseHandler) == null ? void 0 : _b.tagTurnCard) == null ? void 0 : _c.call(_b, card, turnIdx);
    container.appendChild(card);
    (_e = (_d = window.StoryResponseHandler) == null ? void 0 : _d.scrollToBottom) == null ? void 0 : _e.call(_d);
  },
  /** 登记失败卡（状态未落库，提供重试） */
  renderFailCard(err, turnIdx = null) {
    var _a, _b, _c, _d;
    const container = document.getElementById("chatMessages");
    if (!container) return;
    const card = document.createElement("div");
    card.className = "message-card va-card va-error";
    card.innerHTML = `
            <div class="va-head">
                <span class="va-badge">🧾 状态登记失败</span>
                <span class="va-label">本轮状态未落库</span>
            </div>
            <div class="va-err">${this.esc(err.message)}</div>
            <div class="va-actions">
                <button class="va-btn" onclick="VariableAI.retry()">↻ 重试登记</button>
            </div>`;
    (_b = (_a = window.StoryResponseHandler) == null ? void 0 : _a.tagTurnCard) == null ? void 0 : _b.call(_a, card, turnIdx);
    container.appendChild(card);
    (_d = (_c = window.StoryResponseHandler) == null ? void 0 : _c.scrollToBottom) == null ? void 0 : _d.call(_c);
  }
};
window.VariableAI = VariableAI;
