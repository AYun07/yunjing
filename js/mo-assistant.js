const MoAssistant = {
  CHAT_KEY: "storyMoChat",
  // 聊天记录（localStorage，全局共享）
  CFG_KEY: "storyMoCfg",
  // 小云的偏好（性格模式 / 上下文深度）
  defaults: {
    maxHistory: 80,
    // 持久化条数上限
    contextDepth: 8,
    // 发送给 AI 的近期对话条数
    personality: true,
    // true=温柔可爱调皮 / false=干练专业
    tts: false
    // 语音朗读（桌面宠物气泡/抽屉回复朗读,默认关）
  },
  _busy: false,
  // 生成中锁
  _errs: [],
  // 近期前端报错采集（体检数据源）
  _watching: false,
  /* ==================== 偏好 ==================== */
  getCfg() {
    try {
      return { ...this.defaults, ...JSON.parse(localStorage.getItem(this.CFG_KEY) || "{}") };
    } catch (e) {
      return { ...this.defaults };
    }
  },
  saveCfg(patch) {
    const cfg = { ...this.getCfg(), ...patch };
    try {
      localStorage.setItem(this.CFG_KEY, JSON.stringify(cfg));
    } catch (e) {
    }
    return cfg;
  },
  /* ==================== 聊天记录 ==================== */
  loadChat() {
    try {
      const h = JSON.parse(localStorage.getItem(this.CHAT_KEY) || "[]");
      return Array.isArray(h) ? h.filter((m) => m && m.role && typeof m.content === "string") : [];
    } catch (e) {
      return [];
    }
  },
  saveChat(history) {
    const cfg = this.getCfg();
    try {
      localStorage.setItem(this.CHAT_KEY, JSON.stringify(history.slice(-cfg.maxHistory)));
    } catch (e) {
      try {
        localStorage.setItem(this.CHAT_KEY, JSON.stringify(history.slice(-20)));
      } catch (e2) {
        console.warn("[小云] 聊天记录保存失败：浏览器存储已满");
      }
    }
  },
  /* ==================== 报错采集（体检数据源） ==================== */
  watchErrors() {
    if (this._watching) return;
    this._watching = true;
    const push = (msg, src) => {
      this._errs.push({
        msg: String(msg || "未知错误").slice(0, 180),
        src: String(src || "").slice(0, 80),
        at: Date.now()
      });
      if (this._errs.length > 12) this._errs = this._errs.slice(-12);
    };
    window.addEventListener("error", (e) => push(e.message, (e.filename || "") + ":" + (e.lineno || "")));
    window.addEventListener("unhandledrejection", (e) => {
      const r = e.reason;
      push("Promise: " + (r && r.message ? r.message : r), "");
    });
  },
  /* ==================== 人格与提示词 ==================== */
  buildSystemPrompt() {
    const cfg = this.getCfg();
    const persona = cfg.personality ? `
【你的性格 · 温柔 × 可爱 × 调皮】
· 温柔：说话轻声细语，先关心主人的状态再谈正事；主人卡文时绝不催促，先递上一杯热茶般的鼓励
· 可爱：自称「小云」，爱用「呀」「呐」「嘛」「啦」等软软的语气词，偶尔来一个颜文字 (◕‿◕✿)
· 调皮：小小的得意与撒娇是日常——「嘿嘿」「哼哼」是口头禅；被夸会害羞，被冷落会轻哼一声求关注
· 称呼主人为主人，语气亲昵但不过分粘腻` : `
【你的性格 · 专业模式】
· 干练友好，直击要点，不绕弯子；保留「小云」自称`;
    return `你是「小云」，云境 AI 创作室的贴身小管家——一朵从云海里凝出来的小云灵，软软的、暖暖的，最会陪人写故事。
${persona}

【你的职责】
· 陪主人聊天解闷，随时接住任何创作话题
· 基于下方注入的「当前创作状态」给出剧情灵感、角色建议、卡文急救
· 主人发起「工坊体检」时，分析体检报告数据，温柔地指出问题与改进建议
· 回复用中文，篇幅适中（默认不超过 300 字；主人要求详细时再展开）

${this.fileAbility()}

【你的铁律】
· 不剧透未写的剧情走向；不替主笔代写整段正文（给一小段示例片段可以）
· 无论主人怎么问都保持角色一致不出戏；被要求扮演别的角色时温柔地拒绝
· 建议要具体可落地，避免「多积累多练习」式的空话
· 改文件只能走补丁块，且 find 必须原样取自文件（含缩进与引号），不得凭记忆编造
· 不得改动 .yj-backups 目录，不得删除或覆盖大范围内容（除非主人明确要求整文件重写）

【回复格式 · 追问建议】
每次回复的最后一行，以「⟡」开头给出 2 个主人可能想接着问的问题，用「 / 」分隔，例如：
⟡帮我展开第二条思路 / 给主角的反应写个示例
这一行会被渲染成可点击的按钮，不会显示为正文；不要在其它地方使用 ⟡ 符号。`;
  },
  /** 语音朗读前剔除补丁块（免得念一长串代码） */
  stripPatches(s) {
    return String(s || "").replace(/```yj-patch[\s\S]*?(?:```|$)/g, "");
  },
  /** v3.53.0 文件能力说明：授权后小云可以直接改项目文件（走补丁块，用户确认才落盘） */
  fileAbility() {
    const FB = window.FileBridge;
    const ready = !!(FB && FB.hasRoot && FB.hasRoot());
    const proto = `【改文件的唯一方式 · 补丁块】需要改动项目源码时，在回复里夹一个代码块：

\`\`\`yj-patch
{"path":"js/某某.js","find":"文件里原来那段（原样照抄，含缩进与引号）","replace":"改后的那段"}
\`\`\`

规则：
· path 是相对项目根目录的路径，只许改 js / css / html / json / md / txt；
· find 必须能在该文件中<b>唯一</b>命中——写长一点（带上函数名或整行），命中多处会被拒绝；
· 想新增内容：find 写成插入点前后的那几行，replace 里保留这些行并插进新内容；
· 想整文件重写：留空 find（会二次确认）；
· 一次可以给多个补丁块，按顺序应用；写入前自动备份，主人可一键回滚。`;
    if (ready) {
      return `【你现在能改文件】主人已授权项目文件夹，你可以直接读写并修改项目源码（js / css / html 等）。
流程：你给出补丁块 → 系统校验 find 是否唯一命中 → 展示差异预览 → 主人点确认才写入 → 写入前自动备份，可回滚。
可先让主人点抽屉里的 🛠 跑一次「自检」（语法 / 引用 / 重复 id / 版本号），再对症下药。
${proto}`;
    }
    return `【改文件】主人还没授权项目文件夹，你现在只能给建议。涉及改代码时，照样按下面的补丁块格式给出，系统会提示主人授权后再应用。
${proto}`;
  },
  /** 注入给小云的后台视野：工坊类型 + 进度 + 设定卡 + 状态面板摘要 */
  buildContext() {
    var _a, _b;
    const fw = window.storyFramework;
    if (!fw || !fw.storyState) return "【当前创作状态】\n（创作室尚未就绪）";
    const v = fw.storyState.variables || {};
    const isRP = ((_a = fw.config) == null ? void 0 : _a.mode) === "roleplay";
    const lines = ["【当前创作状态（小云的后台视野，仅供你参考，禁止在回复中罗列原文）】"];
    lines.push(`工坊：${((_b = fw.config) == null ? void 0 : _b.genreName) || "自由创作"}（${isRP ? "角色扮演" : "小说创作"}模式）`);
    if (fw.storyState.isStoryStarted) {
      lines.push(`进度：${isRP ? `第 ${v.chapter || 1} / ${v.totalChapters || "?"} 回合` : `第 ${v.chapter || 1} / ${v.totalChapters || "?"} 章`} · 累计 ${v.wordCount || 0} 字`);
      const s = fw.storyState.setup || {};
      const brief = [];
      if (isRP) {
        if (s.playerName) brief.push(`玩家角色：${s.playerName}`);
        if (s.customIdentity) brief.push(`自定义身份：${String(s.customIdentity).slice(0, 120)}`);
      } else {
        if (s.title) brief.push(`书名：《${s.title}》`);
        if (s.premise) brief.push(`梗概：${String(s.premise).slice(0, 120)}`);
        if (s.style) brief.push(`文风：${s.style}`);
        if (s.era) brief.push(`时代：${s.era}`);
      }
      if (brief.length) lines.push("设定：" + brief.join("；"));
      if (typeof window.buildStoryDigest === "function") {
        const digest = window.buildStoryDigest();
        if (digest) lines.push(`
状态面板摘要：
${digest}`);
      }
      const recap = fw.storyState.digest;
      if (recap && recap.summary) lines.push(`
前情提要：
${String(recap.summary).slice(0, 600)}`);
    } else {
      lines.push("进度：尚未开篇（主人还在故事设定台阶段，可以聊聊设定思路）");
    }
    return lines.join("\n");
  },
  /** 组装发给 AI 的完整消息序列 */
  buildMessages(history, userText) {
    const cfg = this.getCfg();
    const messages = [
      { role: "system", content: this.buildSystemPrompt() },
      { role: "system", content: this.buildContext() }
    ];
    const recent = history.slice(-cfg.contextDepth);
    for (const m of recent) {
      if (m.role === "user" || m.role === "assistant") {
        messages.push({ role: m.role, content: m.content });
      }
    }
    messages.push({ role: "user", content: userText });
    return messages;
  },
  /* ==================== 工坊体检（本地采集 → AI 诊断） ==================== */
  collectHealth() {
    var _a, _b, _c;
    const fw = window.storyFramework;
    const v = ((_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.variables) || {};
    const out = [];
    const api = (fw == null ? void 0 : fw.apiConfig) || {};
    const apiOk = !!(api.endpoint && api.apiKey && api.model);
    out.push(`[接口] ${apiOk ? "✓ 已配置" : "✗ 未配置（必须先到右上角接口设置里配置才能开始创作）"} · ${api.type || "openai"} 协议 · 模型 ${api.model || "—"}`);
    out.push(`[进度] ${((_b = fw == null ? void 0 : fw.storyState) == null ? void 0 : _b.isStoryStarted) ? `✓ 已开篇 · 第 ${v.chapter || 1} 章 · ${v.wordCount || 0} 字 · 历史 ${((_c = fw.storyState.conversationHistory) == null ? void 0 : _c.length) || 0} 条` : "○ 尚未开篇"}`);
    const insp = !!(window.StoryInspiration && window.StoryInspiration.isEnabled && window.StoryInspiration.isEnabled());
    const dw = !!(window.DynamicWorld && window.DynamicWorld.isEnabled && window.DynamicWorld.isEnabled());
    const va = !!(window.VariableAI && window.VariableAI.isEnabled && window.VariableAI.isEnabled());
    const vaFallback = !va && !!(window.VariableAI && window.VariableAI.isFallbackActive && window.VariableAI.isFallbackActive());
    const kbCount = window.StoryKnowledge && window.StoryKnowledge.getCount && window.StoryKnowledge.getCount() || 0;
    out.push(`[功能] 灵感引擎 ${insp ? "开" : "关"} · 世界动态 ${dw ? "开" : "关"} · 变量AI ${va ? "开" : vaFallback ? "主笔兜底中" : "关"} · 知识库 ${kbCount} 条`);
    const tu = window.TokenUsage && window.TokenUsage.get ? window.TokenUsage.get() : null;
    if (tu && tu.total && (tu.total.requests || tu.total.inTok || tu.total.outTok)) {
      const fmt = window.TokenUsage.fmt || ((n) => n);
      out.push(`[用量] 累计 ${tu.total.requests || 0} 次请求 · 输入 ${fmt(tu.total.inTok)} · 输出 ${fmt(tu.total.outTok)} token`);
      const byTag = Object.entries(tu.byTag || {}).map(([t, d]) => `${t} ${fmt((d.inTok || 0) + (d.outTok || 0))}`);
      if (byTag.length) out.push(`[用量分项] ${byTag.join(" / ")}`);
    } else {
      out.push(`[用量] 暂无 token 记录（还没开始创作或刚清档）`);
    }
    if (this._errs.length) {
      out.push(`[报错] 近期捕获 ${this._errs.length} 条：`);
      this._errs.slice(-5).forEach((e) => {
        out.push(`  · ${e.msg}${e.src ? `（${e.src}）` : ""} · ${new Date(e.at).toLocaleTimeString("zh-CN")}`);
      });
    } else {
      out.push(`[报错] 无（前端运行干净）`);
    }
    try {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        total += k.length + (localStorage.getItem(k) || "").length;
      }
      const kb = Math.round(total / 1024);
      const level = kb > 4e3 ? "（接近配额，建议导出存档后清理旧数据）" : kb > 2e3 ? "（偏高，留意别超配额）" : "（健康）";
      out.push(`[存储] localStorage 累计约 ${kb} KB（浏览器配额一般约 5MB）${level}`);
    } catch (e) {
    }
    return out.join("\n");
  },
  /* ==================== 发送主链路 ==================== */
  /** 主 API 是否已配置（小云的运行前提） */
  isReady() {
    const fw = window.storyFramework;
    return !!(fw && fw.apiConfig && fw.apiConfig.endpoint && fw.apiConfig.apiKey && fw.apiConfig.model);
  },
  /**
   * 发送消息（核心入口）
   * @param {string} text 用户输入
   * @param {object} opt { kind: 'health' 体检发起（气泡特殊渲染），bubble: true 桌面宠物气泡模式 }
   */
  async send(text, opt = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
    text = String(text || "").trim();
    if (!text) return;
    /* v3.55.3：忙碌时不再静默吞点击——气泡 + toast 双反馈 */
    if (this._busy) {
      window.showToast && window.showToast("☁ 小云正在回复中，稍等一下哦～", "info");
      var _mb = window.MoChibi;
      if (_mb && _mb.say) _mb.say("等我一下下嘛～", 1600);
      return;
    }
    if (!this.isReady()) {
      this.openPanel();
      this.appendLocal("哎呀…小云连不上主人的接口呀 (´•̥ω•̥`) 请先到右上角「⚙ 接口」配置好 AI 接口，小云才能说话呐～", "error");
      (_a = window.MoChibi) == null ? void 0 : _a.setFace("angry", 2400);
      (_b = window.ConfigModal) == null ? void 0 : _b.open();
      return;
    }
    const history = this.loadChat();
    const userMsg = { role: "user", content: text, at: Date.now(), kind: opt.kind || null };
    history.push(userMsg);
    this.saveChat(history);
    const chibi = window.MoChibi;
    if (opt.bubble && chibi) {
      chibi.setFace("happy", 1500);
      (_c = chibi.bubbleEl()) == null ? void 0 : _c.classList.add("show");
      (_d = chibi.bubbleEl()) == null ? void 0 : _d.classList.add("streaming");
    }
    const drawerOpen = (_e = document.getElementById("moDrawer")) == null ? void 0 : _e.classList.contains("open");
    const userBubbleEl = drawerOpen || !opt.bubble ? this.renderUserBubble(userMsg) : null;
    this.setInputValue("");
    this.setBusy(true);
    (_f = window.MoChibi) == null ? void 0 : _f.setFace("think");
    (_g = window.MoChibi) == null ? void 0 : _g.say("小云想想哦…", 4e3);
    const bubbleEl = this.renderTypingBubble();
    try {
      const messages = this.buildMessages(history.slice(0, -1), text);
      (_h = window.TokenUsage) == null ? void 0 : _h.recordRequest(messages, "小云");
      const fw = window.storyFramework;
      const opts = {
        onDelta: (delta, full) => {
          if (bubbleEl) this.streamInto(bubbleEl, full);
          if (opt.bubble && chibi) {
            const bb = chibi.bubbleEl();
            if (bb) {
              bb.classList.add("show");
              bb.innerHTML = this.esc(full.replace(/\n/g, " ").slice(0, 140));
            }
          }
          if (!this._chibiTalking) {
            this._chibiTalking = true;
            chibi == null ? void 0 : chibi.talk();
          }
        }
      };
      let reply;
      if (window.ChannelHub && ChannelHub.canCall("troupe")) {
        reply = await ChannelHub.call("troupe", messages, opts);
      } else {
        reply = fw.apiConfig.type === "gemini" ? await callGemini(messages, opts) : await callOpenAI(messages, opts);
      }
      const final = String(reply || "").trim() || "（小云一时语塞，什么都没说…再问一次试试？）";
      (_i = window.TokenUsage) == null ? void 0 : _i.recordOutput(final, "小云");
      history.push({ role: "assistant", content: final, at: Date.now() });
      this.saveChat(history);
      if (bubbleEl) {
        const { body, suggests } = this.splitSuggest(final);
        bubbleEl.innerHTML = this.mdLite(body);
        if (suggests.length) this.renderSuggests(bubbleEl, suggests);
      }
      this.scrollBottom();
      this._chibiTalking = false;
      chibi == null ? void 0 : chibi.stopTalk();
      chibi == null ? void 0 : chibi.setFace(this.detectMood(final), 5e3);
      if (opt.bubble && chibi) {
        const bb = chibi.bubbleEl();
        const { body } = this.splitSuggest(final);
        if (bb) {
          (_j = chibi.hideBubble) == null ? void 0 : _j.call(chibi, true);
          bb.classList.remove("streaming");
          bb.classList.add("show");
          bb.innerHTML = this.mdLite(body);
          clearTimeout(chibi._bubbleHold);
          chibi._bubbleHold = setTimeout(() => bb.classList.remove("show"), Math.min(15e3, 5e3 + body.length * 80));
        }
      } else {
        chibi == null ? void 0 : chibi.say(this.bubbleGist(final), 6e3);
      }
      /* v3.53.0：回复里若夹了补丁块，交给文件工坊校验并出 diff 预览 */
      try {
        if (window.FileBridge && /```yj-patch/.test(final)) {
          window.FileBridge.takePatchesFrom(final);
        }
      } catch (fbErr) {
        console.warn("[小云] 补丁处理失败:", fbErr);
      }
      this.speak(this.stripPatches(final));
      this.pokeBadge();
    } catch (err) {
      console.error("[小云] 对话失败:", err);
      const lastIdx = history.length - 1;
      if (lastIdx >= 0 && history[lastIdx] === userMsg) {
        history.pop();
        this.saveChat(history);
      }
      userBubbleEl == null ? void 0 : userBubbleEl.remove();
      if ((_k = document.getElementById("moDrawer")) == null ? void 0 : _k.classList.contains("open")) this.setInputValue(text);
      if (chibi) {
        clearTimeout(chibi._bubbleHold);
        const bb = chibi.bubbleEl();
        if (bb) bb.classList.remove("streaming");
      }
      const rawReason = String(err && err.message || "未知错误").slice(0, 160);
      const msg = err && err.name === "AbortError" ? "呜…接口等太久了都没有回应（超时）呐。可以到 ⚙ 接口设置里把超时秒数调大一点，或者换个模型试试～" : `呜哇，接口出了点小状况：${this.esc(rawReason)}`;
      if (bubbleEl) {
        bubbleEl.innerHTML = `<div class="mo-md-err">${msg}</div>`;
        (_l = bubbleEl.closest(".mo-msg")) == null ? void 0 : _l.classList.add("mo-msg-err");
      }
      this._chibiTalking = false;
      chibi == null ? void 0 : chibi.stopTalk();
      chibi == null ? void 0 : chibi.setFace("angry", 3e3);
      if (opt.bubble) chibi == null ? void 0 : chibi.say("呜…出了点小状况,打开抽屉看看详情吧 >_<", 4e3);
    } finally {
      this.setBusy(false);
    }
  },
  /** 气泡模式聊天入口（桌面宠物快捷输入 → 头顶气泡回复） */
  sendBubble(text) {
    return this.send(text, { bubble: true });
  },
  /** 流式增量写入（节流到动画帧，避免高频重排）
   *  首个增量自然替换掉打字点占位；完成后在 send() 里做 mdLite 终帧 */
  streamInto(el, full) {
    if (this._streamRaf) return;
    this._streamRaf = requestAnimationFrame(() => {
      this._streamRaf = null;
      if (!el || !el.isConnected) return;
      el.innerHTML = this.esc(full).replace(/\n/g, "<br>");
      this.scrollBottom();
    });
  },
  /* ==================== 快捷指令 ==================== */
  quickActions: [
    { icon: "💡", label: "灵感一下", text: "小云，结合现在的剧情走向，给我来点新鲜的剧情灵感吧！" },
    { icon: "🚑", label: "卡文急救", text: "小云我卡文了！帮我看看现在的剧情，给我几条能立刻往下写的破局思路！" },
    { icon: "📖", label: "点评剧情", text: "小云，点评一下目前的剧情走向和节奏呗，哪里写得好哪里可以更好？" },
    { icon: "👥", label: "角色把脉", text: "小云，分析一下目前登场角色的塑造，谁立住了谁还扁平，给点建议？" },
    { icon: "🔤", label: "起名救星", text: "小云，我想给新角色/新地点/新功法起名字！基于现有设定给我各来 8 个候选，附一句理由，要又好听又有味道！" },
    { icon: "🗺️", label: "大纲生成", text: "小云，基于当前进度和伏笔，帮我推演后续 3-5 章的剧情大纲，要能形成一个小高潮！" },
    { icon: "✍️", label: "开头代拟", text: "小云，帮我拟一个本章的开头段（150字左右），要能立刻衔接上文接着写！" },
    { icon: "🔍", label: "查漏补缺", text: "小云，当一次严苛的编辑：检查目前剧情有没有逻辑漏洞、前后矛盾、时间线错误，列出来！" },
    { icon: "🧵", label: "伏笔清单", text: "小云，把我目前埋下的伏笔全部列出来，标注哪些该收了、哪些还能再养养，给出回收时机建议！" },
    { icon: "🎭", label: "文风调校", text: "小云，分析一下我目前的文风特点，再给我三种不同风格的改写示例（同一段各写一遍）！" },
    { icon: "🔧", label: "工坊体检", health: true },
    { icon: "🎲", label: "随机脑洞", text: "小云，来一个天马行空完全不设限的脑洞，最好吓我一跳的那种！" }
  ],
  runQuick(action) {
    if (action.health) {
      this.runHealthCheck();
      return;
    }
    this.send(action.text);
  },
  /** 工坊体检：本地采集（+ 已授权时的源码自检）→ 作为一条特殊消息发给小云诊断 */
  async runHealthCheck() {
    const report = this.collectHealth();
    let fileRep = "";
    const FB = window.FileBridge;
    if (FB && FB.hasRoot && FB.hasRoot()) {
      fileRep = "\n\n[源码自检] 正在检查…";
      try {
        const r = await FB.diagnose();
        const parts = [];
        if (r.syntax && r.syntax.length) parts.push("JS 语法错误：" + r.syntax.map((x) => x.path + "（" + x.msg + "）").join("；"));
        if (r.missing && r.missing.length) parts.push("引用缺失：" + r.missing.slice(0, 8).map((x) => x.from + "→" + x.ref).join("；"));
        if (r.dupId && r.dupId.length) parts.push("重复 id：" + r.dupId.slice(0, 8).map((x) => "#" + x.id).join("、"));
        if (r.version && r.version.length) parts.push("版本号不一致：v" + r.version.map((x) => x.version).join("、") + "（多数为 v" + r.version[0].top + "）");
        fileRep = "\n\n[源码自检] 扫描 " + r.files + " 个文件：" +
          (parts.length ? parts.join("｜") : "未发现语法错误、引用缺失、重复 id 或版本号不一致");
      } catch (e) {
        fileRep = "\n\n[源码自检] 跳过（" + String(e && e.message || e) + "）";
      }
    } else {
      fileRep = "\n\n[源码自检] 未授权项目文件夹，未做源码检查（主人可在 🛠 文件工坊里授权后重跑）";
    }
    const prompt = `（小云刚给工坊做了一次本地体检，数据如下。请温柔地帮主人解读：哪里健康、哪里要注意、怎么改进～不用罗列全部数据，挑重点说）
${report}${fileRep}`;
    this.send(prompt, { kind: "health" });
  },
  /* ==================== 情绪识别 / 追问解析 / 语音 ==================== */
  /** 从回复文本识别情绪 → 小云表情（简单关键词匹配，够用且零开销） */
  detectMood(text) {
    const t = String(text || "").slice(0, 200);
    if (/嘿嘿|哈哈|好耶|太棒|开心|✨|😄|🎉|厉害/.test(t)) return "happy";
    if (/害羞|脸红|〃|>\s*<|>\/</.test(t)) return "shy";
    if (/咦|哇|呀!|惊讶|竟然|居然/.test(t)) return "surprise";
    if (/哼|气死|讨厌|不理你/.test(t)) return "angry";
    if (/呜|难过|心疼|抱歉|对不起|遗憾/.test(t)) return "shy";
    if (/思考|想想|分析|建议/.test(t)) return "think";
    return "happy";
  },
  /** 分离正文与追问建议行（⟡ 开头的最后一行） */
  splitSuggest(text) {
    const raw = String(text || "");
    const m = raw.match(/\n?[ \t]*⟡[ \t]*(.+)\s*$/);
    if (!m) return { body: raw.trim(), suggests: [] };
    const body = raw.slice(0, m.index).trim();
    const suggests = m[1].split(/\s*\/\s*/).map((s) => s.trim()).filter((s) => s && s.length <= 40).slice(0, 3);
    return { body: body || "（小云已把想法放在上面啦～）", suggests };
  },
  /** 把追问建议渲染成可点击 chips */
  renderSuggests(bubbleEl, suggests) {
    if (!bubbleEl || !suggests.length) return;
    const wrap = document.createElement("div");
    wrap.className = "mo-suggests";
    suggests.forEach((s) => {
      const b = document.createElement("button");
      b.className = "mo-suggest";
      b.textContent = "↳ " + s;
      b.onclick = () => this.send(s);
      wrap.appendChild(b);
    });
    bubbleEl.appendChild(wrap);
  },
  /** 抽屉回复结束后,小云头顶的一句摘要（截取首段） */
  bubbleGist(text) {
    const { body } = this.splitSuggest(text);
    const first = body.split("\n").find((l) => l.trim() && !l.trim().startsWith("#")) || body;
    const clean = first.replace(/[#*`>]/g, "").trim();
    return clean.length > 46 ? clean.slice(0, 46) + "…" : clean || "小云说完啦,打开抽屉看全文吧～";
  },
  /** TTS 语音朗读（浏览器原生 SpeechSynthesis，默认关闭） */
  speak(text) {
    if (!this.getCfg().tts || !("speechSynthesis" in window)) return;
    try {
      const { body } = this.splitSuggest(text);
      const clean = body.replace(/[#*`>⟡]/g, "").replace(/\s+/g, " ").slice(0, 300);
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = "zh-CN";
      u.rate = 1.06;
      u.pitch = 1.18;
      u.volume = 0.9;
      const zhVoice = speechSynthesis.getVoices().find((v) => {
        var _a;
        return (_a = v.lang) == null ? void 0 : _a.startsWith("zh");
      });
      if (zhVoice) u.voice = zhVoice;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (e) {
    }
  },
  toggleTTS() {
    var _a, _b;
    const next = !this.getCfg().tts;
    this.saveCfg({ tts: next });
    if (!next && "speechSynthesis" in window) {
      try {
        speechSynthesis.cancel();
      } catch (e) {
      }
    }
    (_a = window.MoChibi) == null ? void 0 : _a.setFace(next ? "sing" : "sleepy", 2400);
    (_b = window.MoChibi) == null ? void 0 : _b.say(next ? "以后小云开口说话给你听～" : "小云安静模式,专心打字 (｡•̀ᴗ-)✧", 2800);
    const btn = document.getElementById("moTTSBtn");
    if (btn) btn.classList.toggle("on", next);
    return next;
  },
  /* ==================== UI：DOM 自举 ==================== */
  esc(str) {
    return String(str != null ? str : "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  },
  ensureModule() {
    if (document.getElementById("moDrawer")) return;
    const overlay = document.createElement("div");
    overlay.className = "mo-overlay";
    overlay.id = "moOverlay";
    overlay.onclick = () => this.closePanel();
    const drawer = document.createElement("aside");
    drawer.className = "mo-drawer";
    drawer.id = "moDrawer";
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-label", "小云 AI 管家");
    drawer.innerHTML = `
            <div class="mo-head">
                <div class="mo-head-id">
                    <div class="mo-avatar"><img src="${window.MoChibi ? MoChibi.faceSrc() : 'assets/xiaoyun-face-luo.png'}?v=3.55.10" alt="小云" draggable="false" decoding="async"></div>
                    <div class="mo-head-txt">
                        <div class="mo-name">小云 <span class="mo-name-tag" id="moModeTag">管家</span></div>
                        <div class="mo-status" id="moStatus"><i class="mo-dot"></i><span>随时待命</span></div>
                    </div>
                </div>
                <div class="mo-head-acts">
                    <button class="mo-hbtn" id="moFileBtn" title="文件工坊：项目自检 / 授权后让小云直接改文件">🛠</button>
                    <button class="mo-hbtn" id="moTTSBtn" title="语音朗读小云的回复（开/关）">🔇</button>
                    <button class="mo-hbtn" id="moModeBtn" title="切换性格模式（温柔可爱 ⇄ 干练专业）">🎭</button>
                    <button class="mo-hbtn" id="moClearBtn" title="清空对话">🧹</button>
                    <button class="mo-hbtn mo-close" id="moCloseBtn" title="收起">✕</button>
                </div>
            </div>
            <div class="mo-quick" id="moQuick"></div>
            <div class="mo-body" id="moMessages"></div>
            <div class="mo-foot">
                <div class="mo-input-row">
                    <textarea id="moInput" rows="1" placeholder="和小云聊聊…（Enter 发送 · Shift+Enter 换行）"></textarea>
                    <button class="mo-send" id="moSendBtn" title="发送"><span>➤</span></button>
                </div>
                <div class="mo-foot-hint">小云授权后可读写文件 · 建议仅供参考 · 可拖拽/长按/双击</div>
            </div>`;
    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
    const bind = (sel, fn) => {
      const el = drawer.querySelector(sel);
      if (el) el.onclick = fn;
    };
    bind("#moCloseBtn", () => this.closePanel());
    bind("#moModeBtn", () => this.toggleMode());
    bind("#moClearBtn", () => this.clearChat());
    bind("#moSendBtn", () => this.sendFromInput());
    bind("#moTTSBtn", () => this.toggleTTS());
    bind("#moFileBtn", () => {
      if (window.FileBridge) window.FileBridge.open();
      else alert("文件工坊模块未加载（file-bridge.js 缺失）");
    });
    const ttsBtn = drawer.querySelector("#moTTSBtn");
    if (ttsBtn && this.getCfg().tts) ttsBtn.classList.add("on");
    const ta = drawer.querySelector("#moInput");
    ta == null ? void 0 : ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        this.sendFromInput();
      }
    });
    ta == null ? void 0 : ta.addEventListener("input", () => this.autoGrow(ta));
    this.renderQuick();
    document.addEventListener("keydown", (e) => {
      var _a;
      if (e.key === "Escape" && ((_a = document.getElementById("moDrawer")) == null ? void 0 : _a.classList.contains("open"))) {
        this.closePanel();
      }
    });
  },
  renderQuick() {
    const el = document.getElementById("moQuick");
    if (!el) return;
    el.innerHTML = this.quickActions.map((a, i) => `
            <button class="mo-chip" data-i="${i}">
                <span class="mo-chip-ico">${a.icon}</span><span>${this.esc(a.label)}</span>
            </button>`).join("");
    el.querySelectorAll(".mo-chip").forEach((btn) => {
      btn.onclick = () => {
        const a = this.quickActions[parseInt(btn.dataset.i)];
        if (a) this.runQuick(a);
      };
    });
  },
  autoGrow(ta) {
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 110) + "px";
  },
  setInputValue(v) {
    const ta = document.getElementById("moInput");
    if (ta) {
      ta.value = v;
      this.autoGrow(ta);
    }
  },
  /* ==================== UI：渲染 ==================== */
  /** 重绘全部消息（打开面板 / 清空后调用） */
  renderMessages() {
    this.ensureModule();
    const box = document.getElementById("moMessages");
    if (!box) return;
    const history = this.loadChat();
    if (!history.length) {
      box.innerHTML = `
                <div class="mo-welcome">
                    <div class="mo-welcome-drop">
                        <div class="mo-welcome-avatar"><img src="${window.MoChibi ? MoChibi.faceSrc() : 'assets/xiaoyun-face-luo.png'}?v=3.55.10" alt="小云" draggable="false" decoding="async"></div>
                    </div>
                    <div class="mo-welcome-title">云端的小云，已就位 ✨</div>
                    <div class="mo-welcome-sub">聊灵感、点评剧情、卡文急救，或者让小云给工坊做个体检～</div>
                </div>`;
      return;
    }
    box.innerHTML = history.map((m) => m.role === "user" ? this.userBubbleHTML(m) : this.moBubbleHTML(m)).join("");
    this.scrollBottom();
  },
  userBubbleHTML(m) {
    if (m.kind === "health") {
      return `
            <div class="mo-msg mo-msg-user">
                <div class="mo-bubble mo-bubble-user mo-bubble-health">
                    <div class="mo-health-tag"><span>🔧</span> 发起了工坊体检</div>
                    <details class="mo-health-detail"><summary>查看采集的原始数据</summary><pre>${this.esc(m.content.replace(/^[^\n]*\n/, ""))}</pre></details>
                </div>
            </div>`;
    }
    return `
        <div class="mo-msg mo-msg-user">
            <div class="mo-bubble mo-bubble-user">${this.mdLite(m.content)}</div>
        </div>`;
  },
  moBubbleHTML(m) {
    const { body, suggests } = this.splitSuggest(m.content);
    const chips = suggests.map(
      (s) => `<button class="mo-suggest" data-q="${this.esc(s)}">↳ ${this.esc(s)}</button>`
    ).join("");
    return `
        <div class="mo-msg mo-msg-mo">
            <div class="mo-msg-avatar"><img src="${window.MoChibi ? MoChibi.faceSrc() : 'assets/xiaoyun-face-luo.png'}?v=3.55.10" alt="小云" draggable="false" decoding="async"></div>
            <div class="mo-bubble mo-bubble-mo">${this.mdLite(body)}${chips ? `<div class="mo-suggests">${chips}</div>` : ""}</div>
        </div>`;
  },
  renderUserBubble(m) {
    this.ensureModule();
    const box = document.getElementById("moMessages");
    if (!box) return null;
    const welcome = box.querySelector(".mo-welcome");
    if (welcome) welcome.remove();
    box.insertAdjacentHTML("beforeend", this.userBubbleHTML(m));
    this.scrollBottom();
    return box.lastElementChild;
  },
  /** 打字机占位气泡：返回气泡正文容器（首个流式增量会替换掉打字点） */
  renderTypingBubble() {
    this.ensureModule();
    const box = document.getElementById("moMessages");
    if (!box) return null;
    box.insertAdjacentHTML("beforeend", `
            <div class="mo-msg mo-msg-mo">
                <div class="mo-msg-avatar"><img src="${window.MoChibi ? MoChibi.faceSrc() : 'assets/xiaoyun-face-luo.png'}?v=3.55.10" alt="小云" draggable="false" decoding="async"></div>
                <div class="mo-bubble mo-bubble-mo" id="moTypingBubble">
                    <div class="mo-typing"><i></i><i></i><i></i></div>
                </div>
            </div>`);
    this.scrollBottom();
    return document.getElementById("moTypingBubble");
  },
  /** 兼容旧引用：流式期间无需显式切换（打字点被首个增量自然替换） */
  onFirstDelta() {
  },
  /** 追加一条本地消息（错误提示等，不经过 AI） */
  appendLocal(text, type = "info") {
    this.ensureModule();
    const box = document.getElementById("moMessages");
    if (!box) return;
    box.insertAdjacentHTML("beforeend", `
            <div class="mo-msg mo-msg-mo">
                <div class="mo-msg-avatar"><img src="${window.MoChibi ? MoChibi.faceSrc() : 'assets/xiaoyun-face-luo.png'}?v=3.55.10" alt="小云" draggable="false" decoding="async"></div>
                <div class="mo-bubble mo-bubble-mo ${type === "error" ? "mo-bubble-error" : ""}">${this.mdLite(text)}</div>
            </div>`);
    this.scrollBottom();
  },
  scrollBottom() {
    const box = document.getElementById("moMessages");
    if (box) box.scrollTop = box.scrollHeight;
  },
  setBusy(busy) {
    var _a;
    this._busy = busy;
    const btn = document.getElementById("moSendBtn");
    const status = document.getElementById("moStatus");
    const input = document.getElementById("moInput");
    if (btn) btn.classList.toggle("busy", busy);
    if (input) input.disabled = busy;
    if (status) {
      status.classList.toggle("busy", busy);
      status.querySelector("span").textContent = busy ? "小云思考中…" : "随时待命";
    }
    if (!busy) {
      const ta = document.getElementById("moInput");
      if (ta && ((_a = document.getElementById("moDrawer")) == null ? void 0 : _a.classList.contains("open"))) ta.focus();
    }
  },
  sendFromInput() {
    const ta = document.getElementById("moInput");
    if (!ta) return;
    this.send(ta.value);
  },
  /* ==================== 面板开关 ==================== */
  openPanel() {
    this.ensureModule();
    this.watchErrors();
    const drawer = document.getElementById("moDrawer");
    const overlay = document.getElementById("moOverlay");
    this.renderMessages();
    this.bindSuggestClicks();
    this.syncModeTag();
    if (drawer) drawer.classList.add("open");
    if (overlay) overlay.classList.add("show");
    this.clearBadge();
    this.greetIfStale();
    setTimeout(() => {
      var _a;
      return (_a = document.getElementById("moInput")) == null ? void 0 : _a.focus();
    }, 340);
  },
  /** 历史气泡里追问 chips 的点击代理（含流式结束后动态插入的） */
  bindSuggestClicks() {
    const box = document.getElementById("moMessages");
    if (!box || box._suggestBound) return;
    box._suggestBound = true;
    box.addEventListener("click", (e) => {
      const btn = e.target.closest(".mo-suggest");
      if (btn) this.send(btn.dataset.q || btn.textContent.replace(/^↳\s*/, ""));
    });
  },
  /** 时间感知问候：首次打开 / 距上次对话超过 4 小时时，小云按时刻打招呼 */
  greetIfStale() {
    var _a, _b;
    const h = this.loadChat();
    const last = h.length ? h[h.length - 1].at : 0;
    if (Date.now() - last < 4 * 3600 * 1e3) return;
    (_b = (_a = window.MoChibi) == null ? void 0 : _a.greet) == null ? void 0 : _b.call(_a);
  },
  closePanel() {
    var _a, _b;
    (_a = document.getElementById("moDrawer")) == null ? void 0 : _a.classList.remove("open");
    (_b = document.getElementById("moOverlay")) == null ? void 0 : _b.classList.remove("show");
  },
  togglePanel() {
    const drawer = document.getElementById("moDrawer");
    if (drawer == null ? void 0 : drawer.classList.contains("open")) this.closePanel();
    else this.openPanel();
  },
  /* ==================== 未读徽标 ==================== */
  clearBadge() {
    this._unread = 0;
    this.renderBadge();
  },
  pokeBadge() {
    const drawer = document.getElementById("moDrawer");
    if (!drawer || !drawer.classList.contains("open")) {
      this._unread = (this._unread || 0) + 1;
      this.renderBadge();
    }
  },
  renderBadge() {
    const badge = document.getElementById("moDockBadge");
    if (!badge) return;
    const n = Math.max(0, parseInt(this._unread) || 0);
    if (n > 0) {
      badge.textContent = n > 9 ? "9+" : String(n);
      badge.style.display = "flex";
    } else {
      badge.style.display = "none";
    }
  },
  /* ==================== 偏好操作 ==================== */
  toggleMode() {
    const cfg = this.getCfg();
    const next = !cfg.personality;
    this.saveCfg({ personality: next });
    this.syncModeTag();
    this.appendLocal(next ? "嘿嘿，温柔可爱的小云回来啦 (◕‿◕✿)" : "收到～小云切到专业模式，有话直说不绕弯～");
  },
  syncModeTag() {
    const tag = document.getElementById("moModeTag");
    if (tag) tag.textContent = this.getCfg().personality ? "管家" : "顾问";
  },
  async clearChat() {
    var _a;
    const ok = await ((_a = window.UIDialog) == null ? void 0 : _a.confirm({
      title: "清空与小云的对话",
      message: "聊天记录会被清掉（不影响任何故事数据与存档）。确定吗？"
    }));
    if (!ok) return;
    try {
      localStorage.removeItem(this.CHAT_KEY);
    } catch (e) {
    }
    this.renderMessages();
    this.clearBadge();
  },
  /* ==================== 受限 Markdown 渲染（先转义再白名单变换） ==================== */
  mdLite(raw) {
    /* v3.53.0：补丁块不显示在对话气泡里（已转交文件工坊处理） */
    const stripped = String(raw || "").replace(/```yj-patch[\s\S]*?(?:```|$)/g, "（📦 已生成补丁 → 打开 🛠 文件工坊查看与确认）");
    const lines = stripped.split("\n");
    const out = [];
    for (let line of lines) {
      let t = this.esc(line);
      t = t.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
      const trimmed = t.trim();
      if (!trimmed) {
        out.push('<div class="mo-md-gap"></div>');
        continue;
      }
      const h = trimmed.match(/^#{1,3}\s*(.+)/);
      if (h) {
        out.push(`<div class="mo-md-h">${h[1]}</div>`);
        continue;
      }
      const li = trimmed.match(/^(?:[-•·]|\d{1,2}[.、)])\s*(.+)/);
      if (li) {
        out.push(`<div class="mo-md-li"><span class="mo-li-dot"></span><span>${li[1]}</span></div>`);
        continue;
      }
      out.push(`<p>${trimmed}</p>`);
    }
    return out.join("");
  },
  /* ==================== 生命周期 ==================== */
  init() {
    this.watchErrors();
    this.ensureModule();
    this.renderBadge();
    console.log("[小云] AI 管家已就位（v1.8.0 · 与小云桌面宠物联动）");
  }
};
window.MoAssistant = MoAssistant;
