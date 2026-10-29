const StoryInput = {
  /** 发送主流程 */
  async send(text) {
    const fw = window.storyFramework;
    const input = document.getElementById("userInput");
    const message = (text !== void 0 ? text : input ? input.value : "").trim();
    if (!message) return;
    /* v3.55.3：生成中点击不再静默吞掉——给出可见反馈，避免"按钮没反应"的错觉 */
    if (fw.isProcessing) {
      window.showToast && window.showToast("✍ 正在创作中，等这段写完再发哦～", "info");
      return;
    }
    // v3.55.3 正文文生图指令：/生图 描述 → 就地插入插图，不走 AI 对话
    if (this._handleImageCommand(message, input)) return;
    if (!fw.isApiConfigured()) {
      fw.guideToConfig();
      return;
    }
    if (input) input.value = "";
    fw.pushTurnSnapshot(message);
    window.StoryResponseHandler.renderUserMessage(message);
    fw.storyState.conversationHistory.push({ role: "user", content: message });
    await this.requestAI(message);
  },
  /**
   * v3.55.3 正文文生图指令：/生图 描述（别名 /画图 /插图 /image /img）
   * 命中则在正文末尾插入插图并排队生成，返回 true（不进 AI 对话、不占轮次）
   */
  _handleImageCommand(message, input) {
    const m = String(message || "").match(/^\/(?:生图|画图|插图|image|img)\s+([\s\S]+)$/i);
    if (!m) return false;
    const prompt = m[1].trim();
    if (!prompt) return false;
    if (input) input.value = "";
    const IG = window.StoryImageGen;
    if (!IG) {
      window.showToast && window.showToast("插图引擎未加载", "error");
      return true;
    }
    if (!IG.isConfigured()) {
      window.showToast && window.showToast("请先到 ⚙ 接口设置 → 🖼 插图引擎 配好生图接口（地址 / Key / 模型）", "error");
      return true;
    }
    IG.insertIllustrationAfter(null, prompt);
    window.showToast && window.showToast(`🎨 正在为「${prompt.slice(0, 24)}${prompt.length > 24 ? "…" : ""}」生成插图`, "info");
    return true;
  },
  /** 点击情节选项 / 行动选项 */
  chooseOption(btn) {
    const fw = window.storyFramework;
    const text = btn.getAttribute("data-text");
    if (!text) return;
    this.send(fw.config.mode === "roleplay" ? `（选择行动）${text}` : `（选择情节走向）${text}`);
  },
  /**
   * ↻ 重新生成末轮正文：还原现场后用同一条用户指令重发
   * （变量 / 历史 / 卡片先回滚到该轮开始前，再走完整发送流程）
   */
  async regenerate() {
    var _a, _b, _c;
    const fw = window.storyFramework;
    if (fw.isProcessing) {
      window.showToast && window.showToast("✍ 正在创作中，等这段写完再操作哦～", "info");
      return;
    }
    if (!fw.storyState.turns || !fw.storyState.turns.length) {
      (_a = window.showToast) == null ? void 0 : _a.call(window, "没有可重新生成的正文", "error");
      return;
    }
    if ((_b = window.VariableAI) == null ? void 0 : _b.pending) {
      await window.VariableAI.pending.catch(() => {
      });
    }
    const t = fw.restoreTurn();
    if (!t) return;
    fw.pushTurnSnapshot(t.user);
    fw.saveStory();
    (_c = window.showToast) == null ? void 0 : _c.call(window, "↻ 已回滚现场，正在用上一条指令重新生成……", "info");
    window.StoryResponseHandler.renderUserMessage(t.user);
    fw.storyState.conversationHistory.push({ role: "user", content: t.user });
    await this.requestAI(t.user);
  },
  /**
   * ↩ 回退本轮：删掉末轮正文与全部附属内容，变量/轮数一并回滚（不重发）
   */
  async rollback() {
    var _a, _b;
    const fw = window.storyFramework;
    if (fw.isProcessing) {
      window.showToast && window.showToast("✍ 正在创作中，等这段写完再操作哦～", "info");
      return;
    }
    if (!fw.storyState.turns || !fw.storyState.turns.length) {
      (_a = window.showToast) == null ? void 0 : _a.call(window, "已在最早一轮，没有可回退的正文", "error");
      return;
    }
    const ok = await window.UIDialog.confirm({
      title: "回退本轮",
      message: "将删除最后一轮正文（含其变量登记、选项与世界动态通知），故事回到该轮开始前的状态。\n此操作不可撤销，确定回退？",
      danger: true,
      confirmText: "回退本轮",
      cancelText: "再想想"
    });
    if (!ok) return;
    if ((_b = window.VariableAI) == null ? void 0 : _b.pending) {
      await window.VariableAI.pending.catch(() => {
      });
    }
    const t = fw.restoreTurn();
    if (!t) return;
    fw.saveStory();
    window.StoryResponseHandler.renderSystemMessage(
      `↩ 已回退本轮（指令「${String(t.user).slice(0, 30)}${String(t.user).length > 30 ? "…" : ""}」），故事状态已还原。可直接重新发令或改写指令。`,
      "info"
    );
  },
  /** 实际调用 AI */
  async requestAI(message) {
    const fw = window.storyFramework;
    fw.isProcessing = true;
    this.setLoading(true);
    this.lockOptions(true);
    try {
      const vaActive = window.VariableAI && (window.VariableAI.isEnabled() || window.VariableAI.isFallbackActive());
      if (vaActive && window.VariableAI.pending) {
        await window.VariableAI.pending.catch(() => {
        });
      }
      let lastPaint = 0;
      const paintDelta = (_delta, full) => {
        const now = Date.now();
        if (now - lastPaint < 150) return;
        lastPaint = now;
        this.paintDraft(full);
      };
      /* v3.53.0 按篇幅档位推导输出上限（性能）：中文正文约 1 字 ≈ 1.9 token，
         再留 900 token 给变量块与选项。实测未设上限时模型会写到 4000+ 字（60 秒+），
         设上限后同样的档位落在 1200~1800 字（20~30 秒），且协议块仍能完整输出。
         用户若在接口设置里填了更小的 maxTokens，取更小值。 */
      const bodyMaxTokens = (() => {
        try {
          const SK = window.StoryKnowledge;
          const w = SK && SK._wlenCurrent ? SK._wlenCurrent() : null;
          const m = w && /(\d+)\s*[~\-]\s*(\d+)/.exec(String(w.range || ''));
          if (!m) return null;
          const hi = Number(m[2]);
          if (!hi || hi < 100) return null;
          const need = Math.round(hi * 1.9) + 900;
          const cfgCap = Number((fw.apiConfig && fw.apiConfig.maxTokens) || 0);
          const cap = cfgCap > 0 ? Math.min(need, cfgCap) : need;
          return Math.max(1200, Math.min(cap, 16000));
        } catch (e) { return null; }
      })();
      const callOnce = (msg) => window.DraftLab && DraftLab.multiArmed()
        ? DraftLab.runMulti(msg)
        : callStoryAI(msg, false, bodyMaxTokens ? { onDelta: paintDelta, maxTokens: bodyMaxTokens } : { onDelta: paintDelta });
      let reply = await callOnce(message);
      /* v3.46.2 空正文自动重写：解析层多级剥离 + 打捞兜底后正文仍 <15 字
         （模型只吐变量块 / 正文整体被塞进代码围栏等）→ 自动补一轮强提示重写一次，
         免去玩家手动点「↻ 重新生成」（玩家反馈"正文缺失，刷新后还是这样"）。
         仅重写一次；重写结果不更优则沿用原回复；重写异常不阻断主流程。 */
      const RH = window.StoryResponseHandler;
      const bodyLenOf = (r) => String(RH.extractBody(r, RH.extractOptions(r)) || "").replace(/\s/g, "").length;
      /* v3.47.8 文本失控检测（词表狂奔/标点消失/复读循环——弱模型在长中文创作上的解码退化）：
         ① 连续 160+ 非空白字符无任何标点/换行；② 4~12 字 n-gram 去重后剩余率 <70%（复读/同义词循环）。
         命中即视为失控正文，走与空正文相同的自动重写通道。 */
      const isRunawayText = (r) => {
        const body = String(RH.extractBody(r, RH.extractOptions(r)) || "");
        if (body.replace(/\s/g, "").length < 200) return false;
        const flat = body.replace(/\s/g, "");
        let maxRun = 0, run = 0;
        for (const ch of flat) {
          if (/[，。！？；：、“”‘’…—,.!?;:\n]/.test(ch)) { run = 0; } else { run += 1; if (run > maxRun) maxRun = run; }
        }
        if (maxRun > 160) return true;
        const grams = new Map(), N = 6;
        for (let i = 0; i + N <= flat.length; i++) {
          const g = flat.slice(i, i + N);
          grams.set(g, (grams.get(g) || 0) + 1);
        }
        if (grams.size < 60) return false;
        const dupRatio = 1 - grams.size / Math.max(1, flat.length - N + 1);
        if (dupRatio > 0.35) return true;
        /* v3.53.0 标点退化：实测弱模型会整段用「；」和「——」把句子串起来
           （"路快；心也跟着快——他到底是在骂你…；还是在告诉你…"），
           读起来喘不上气。判据：分号数量接近或多于句末标点，且总量不小。 */
        const semis = (flat.match(/[；;]/g) || []).length;
        const stops = (flat.match(/[。！？!?]/g) || []).length;
        if (flat.length > 320 && semis >= 8 && semis > Math.max(3, stops * 0.8)) return true;
        return false;
      };
      const needsRewrite = () => bodyLenOf(reply) < 15 || isRunawayText(reply);
      if (needsRewrite()) {
        const why = bodyLenOf(reply) < 15 ? "未输出可识别的正文（可能只回了变量块、或正文被格式标记吞掉）" : "正文疑似解码失控（词表狂奔/标点消失/复读循环）";
        window.StoryResponseHandler.notice(`模型${why}，正在自动重写一次…`, "warn", 9000);
        try {
          const rewriteMsg = message + "\n\n（系统纠偏：你上一轮回复的正文不合格——或为空，或出现词表狂奔/复读循环/整段无标点的失控文本。本轮必须用规范的中文标点与完整句子重新完整输出小说正文——纯叙事散文、不要放进代码块，之后再在结尾按协议输出 (variable_update) 变量更新块与【行动选项】。禁止同义词罗列式推进，禁止省略标点。）";
          const body0 = bodyLenOf(reply);
          const reply2 = await callOnce(rewriteMsg);
          if (bodyLenOf(reply2) > body0 && (body0 < 15 ? true : !isRunawayText(reply2))) reply = reply2;
          else if (body0 < 15 && bodyLenOf(reply2) > body0) reply = reply2;
        } catch (e2) {
          console.warn("[云境] 空正文自动重写失败，沿用原回复：", e2);
        }
      }
      /* v3.53.0 格式守卫重构：正文在，但缺 (variable_update) 变量块或【行动选项】段。
         旧版做法是把整篇正文回贴给模型"补全"，等于让它把一两千字重写一遍——
         在 10 字/秒的中转站上这是 3 分钟起步，且常见越补越短、直接超时丢稿。
         现改为「只补协议片段的轻量请求」（输出压到 600 token 内），
         取回的块拼接到原回复尾部；补块失败也绝不丢正文。 */
      const hasVarBlock = /\(?\/?variable_update/i.test(reply);
      const hasOptBlock = RH.extractOptions(reply).length > 0 || (RH.OPT_HEADER_RE && RH.OPT_HEADER_RE.test(reply));
      if (!hasVarBlock || !hasOptBlock) {
        const missing = [];
        if (!hasVarBlock) missing.push("(variable_update) 变量更新块");
        if (!hasOptBlock) missing.push("【行动选项】段（3-4 个选项）");
        RH.notice(`本轮缺${missing.join("与")}，正在补齐（只补协议，不重写正文）…`, "info", 8000);
        try {
          const tail = String(reply).replace(/\s+$/, "").slice(-1200);
          const patchMsg = message
            + "\n\n（系统补协议请求·极重要）上面那轮正文已经写完、内容保留不动。你这一轮**只输出下面缺失的协议片段**，"
            + "禁止重复、改写、续写任何正文，禁止输出任何故事内容，只输出这两块：\n"
            + "① 缺失时输出一个完整的变量块：(variable_update) 开头、(/variable_update) 结尾，"
            + "内部逐行键值（chapter: 本轮章节号、wordCount: 本轮字数、characters/items/foreshadowings 按需）；\n"
            + "② 缺失时输出【行动选项】，3-4 行，每行以 1. 2. 3. 编号。\n"
            + "【正文末段（仅供对齐上下文，不要复述）】\n" + tail;
          const patch = await callStoryAI(patchMsg, false, { maxTokens: 600 });
          const merged = RH.mergeProtocolPatch(reply, patch);
          const gained = (RH.extractOptions(merged).length > RH.extractOptions(reply).length)
            || (!hasVarBlock && /\(?\/?variable_update/i.test(merged));
          if (gained) {
            reply = merged;
            RH.notice("协议已补齐", "ok", 2200);
          }
        } catch (e3) {
          console.warn("[云境] 协议补齐失败，沿用原回复：", e3);
          RH.notice("协议补齐失败，正文已保留（可手动重发或继续）", "warn", 5000);
        }
      }
      fw.storyState.conversationHistory.push({ role: "assistant", content: reply });
      window.StoryResponseHandler.handle(reply);
      const turnIdx = fw.currentTurnIndex();
      if (vaActive && fw.storyState.isStoryStarted) {
        window.VariableAI.onTurnComplete(reply, turnIdx).catch((e) => console.warn("[变量AI] 触发失败:", e));
      }
      if (fw.storyState.turnCount > 0 && fw.storyState.turnCount % 3 === 0 && window.StoryInspiration && window.StoryInspiration.isEnabled()) {
        window.StoryInspiration.run(false, turnIdx).catch(() => {
        });
      }
      if (window.DynamicWorld && fw.storyState.isStoryStarted) {
        window.DynamicWorld.onTurnComplete(turnIdx).catch((e) => console.warn("[动态世界] 触发失败:", e));
      }
      if (window.PhonePanel && fw.storyState.isStoryStarted) {
        window.PhonePanel.onTurnComplete().catch((e) => console.warn("[手机分身] 触发失败:", e));
      }
      if (window.QualitySuite) {
        const vp = vaActive ? window.VariableAI.pending : null;
        if (vp) vp.then(() => window.QualitySuite.onVarsMerged()).catch(() => {
        });
        else window.QualitySuite.onVarsMerged();
      }
      if (window.DraftLab && fw.storyState.isStoryStarted) {
        window.DraftLab.onTurnComplete(reply, turnIdx).catch((e) => console.warn("[责编自审] 触发失败:", e));
      }
    } catch (err) {
      console.error(err);
      if (fw.storyState.turns && fw.storyState.turns.length) {
        fw.restoreTurn();
      }
      const input = document.getElementById("userInput");
      if (input && !input.value.trim()) input.value = message;
      /* v3.53.0 失败分诊：把 "HTTP 401 / model not found / 超时 / 断网" 翻成人话，
         并给出下一步动作，而不是甩一段原始报错 */
      const raw = String((err && err.message) || err || "");
      let hint = "本轮现场已还原，指令已放回输入框，可直接重发。";
      if (/40[13]/.test(raw) || /unauthor|invalid.*key|api key/i.test(raw)) hint = "接口拒绝了这把 Key（401/403）。到「接口设置」核对 API Key 与地址是否属于同一家服务商。";
      else if (/404|model.*not.*(exist|found)|does not exist/i.test(raw)) hint = "模型名不存在（404）。到「接口设置」点「拉取模型列表」，从列表里选一个可用模型。";
      else if (/429|rate.?limit|quota/i.test(raw)) hint = "触发限流或余额不足（429）。等一分钟再试，或换一把 Key。";
      else if (/超时|timeout|AbortError|无任何数据返回/i.test(raw)) hint = "接口长时间没有回任何内容。检查网络/中转站，或到「接口设置」把超时秒数调大（长章建议 600）。";
      else if (/Failed to fetch|NetworkError|network/i.test(raw)) hint = "请求发不出去（网络中断 / 跨域 / 地址写错）。确认地址以 /v1 结尾且能在外网访问。";
      else if (/5\d\d/.test(raw)) hint = "服务端 5xx，是对方接口的问题。稍后重试，或换一个模型/中转。";
      window.StoryResponseHandler.renderSystemMessage(`⚠ AI 调用失败：${raw}\n${hint}`, "error");
    } finally {
      fw.isProcessing = false;
      this.setLoading(false);
      this.lockOptions(false);
      fw.saveStory();
    }
  },
  /** 流式草稿：把已收到的正文写进 loading 卡（完成后由正式卡片接管） */
  paintDraft(full) {
    const indicator = document.getElementById("typingIndicator");
    if (!indicator) return;
    let draft = indicator.querySelector(".typing-draft");
    if (!draft) {
      draft = document.createElement("div");
      draft.className = "typing-draft";
      indicator.appendChild(draft);
    }
    const text = String(full || "");
    const noThink = window.stripAIThink ? window.stripAIThink(text) : text;
    const clean = window.StoryImageGen && window.StoryImageGen.stripMarkers ? window.StoryImageGen.stripMarkers(noThink) : noThink;
    draft.textContent = clean.length > 600 ? "……" + clean.slice(-600) : clean;
    const container = document.getElementById("chatMessages");
    if (container) container.scrollTop = container.scrollHeight;
  },
  setLoading(on) {
    const fw = window.storyFramework;
    const isRP = fw.config.mode === "roleplay";
    let indicator = document.getElementById("typingIndicator");
    const container = document.getElementById("chatMessages");
    if (on) {
      if (!indicator && container) {
        indicator = document.createElement("div");
        indicator.id = "typingIndicator";
        indicator.className = "message-card ai-card typing-card";
        indicator.innerHTML = `<div class="typing"><span></span><span></span><span></span></div><span class="typing-text">${isRP ? "世界正在回应……" : "主笔 AI 正在落笔……"}</span>`;
        container.appendChild(indicator);
        container.scrollTop = container.scrollHeight;
      }
      /* v3.53.0 等待计时：中转站 10 字/秒时一章要一两分钟，
         不给读秒玩家会以为卡死（旧版只有一个不会变的省略号） */
      if (indicator) {
        clearInterval(this._waitTimer);
        const t0 = Date.now();
        const txt = indicator.querySelector(".typing-text");
        this._waitTimer = setInterval(() => {
          const s = Math.round((Date.now() - t0) / 1000);
          if (txt) txt.textContent = `${isRP ? "世界正在回应" : "主笔 AI 正在落笔"}…${s}s${s > 45 ? "（长章正常，可继续等待）" : ""}`;
        }, 1000);
      }
    } else if (indicator) {
      clearInterval(this._waitTimer);
      indicator.remove();
    }
    const btn = document.getElementById("sendBtn");
    if (btn) {
      btn.disabled = on;
      btn.textContent = on ? isRP ? "主持中…" : "创作中…" : "发送 ⏎";
    }
  },
  lockOptions(lock) {
    document.querySelectorAll(".option-btn").forEach((b) => {
      b.disabled = lock;
    });
  },
  /** 快捷指令条（创作模式） · v1.9.0 扩容 8→12 */
  quickCommands: [
    { label: "▶ 继续写", text: "继续写下一章，保持既有文风与节奏。" },
    { label: "⚡ 加快节奏", text: "接下来节奏加快，冲突升级，直接推进到下一个情节点。" },
    { label: "🌊 舒缓过渡", text: "这一段放慢节奏，写一段抒情或日常的过渡，为后文蓄力。" },
    { label: "🎭 深挖角色", text: "接下来重点深挖当前场景中的核心角色：通过对话与细节揭示其隐藏动机。" },
    { label: "🪝 回收伏笔", text: "请检查未回收伏笔清单，选择最合适的一条在本章回收，制造惊喜但不突兀。" },
    { label: "🌀 插入反转", text: "在本章结尾安排一个符合前文逻辑、但读者难以预料的反转。" },
    { label: "✒ 润色重写", text: "重写上一章：保持情节不变，提升文笔质感，强化感官细节与隐喻。" },
    { label: "🏁 冲向结局", text: "进入收束阶段：回收所有关键伏笔，推进至高潮与结局，完成这篇短篇小说。" },
    { label: "🏙 环境描写", text: "下一章开头用一段沉浸式的环境描写建立场景氛围：调动视觉、听觉、嗅觉等感官细节。" },
    { label: "⚔ 高潮冲突", text: "把当前矛盾推向正面交锋的高潮场面：动作、对话与心理交替，张力拉满。" },
    { label: "⏭ 时间跳跃", text: "安排一次合理的时间跳跃（数日或数月），用简练的笔法交代期间变化，开启新阶段。" },
    { label: "💭 内心独白", text: "下一章加入主角的内心独白：在关键抉择前呈现其挣扎、权衡与成长。" }
  ],
  /** 快捷指令条（扮演模式：世界主持向） · v1.9.0 扩容 8→12 */
  roleplayQuickCommands: [
    { label: "⏩ 时间快进", text: "（世界主持指令）让时间自然快进数日：按原著逻辑推进我所在地与更大范围世界的动向，给我一段新的处境与选择。" },
    { label: "🗺 探索周边", text: "（世界主持指令）我主动探索当前所在地的周边环境，寻找机遇或情报；请按原著设定给出所见所遇。" },
    { label: "💬 打听消息", text: "（世界主持指令）我向身边人打听近期的传闻与大事，请给出符合原著时代节点的数条消息。" },
    { label: "💪 闭关修炼", text: "（世界主持指令）接下来一段时间我专注修炼/历练，请按原著逻辑给出我的进境、消耗与际遇。" },
    { label: "🎲 意外变故", text: "（世界主持指令）请按原著世界的危机权重引入一次合理变故（危险或机缘皆可），并与我当前的处境、行踪相扣。" },
    { label: "👤 深挖人物", text: "（世界主持指令）接下来重点深挖当前与我互动最深的人物：通过言行与细节呈现其真实立场与心思（原著人物须符合原著性格）。" },
    { label: "📜 查看处境", text: "（世界主持指令）请以一段简短的沉浸式叙述总结我当前的处境、资源与当务之急，并给出新的行动选项。" },
    { label: "🌅 旅程终章", text: "（世界主持指令）请为我的这段旅程收束终章：交代未解之事的后续，给我的角色命运一个符合原著逻辑的落幕。" },
    { label: "🧭 检视自身", text: "（世界主持指令）请沉浸式呈现一次我的自我检视：当前修为/能力、装备、资源、伤势与近期变化，并指出短板。" },
    { label: "🤝 结识盟友", text: "（世界主持指令）安排我与一位符合原著逻辑的新人物结识：交代相遇契机、对方立场与可发展的关系，并给出互动选项。" },
    { label: "🛒 采购补给", text: "（世界主持指令）我前往集市/坊市采购补给与装备：按原著设定列出可购物品与价格，结合我的资源给出建议。" },
    { label: "🗡 主动出击", text: "（世界主持指令）我决定主动出击，向当前最紧要的目标（敌人/任务/机缘）发起行动：请按原著逻辑推演过程与结果。" }
  ],
  /** 快捷指令条（地球开放世界专用：过日子向） · v3.31.1
   *  砍掉修仙味的「闭关修炼/检视修为/坊市采购」，换成真实地球的柴米油盐 */
  earthQuickCommands: [
    { label: "⏩ 时间快进", text: "（世界主持指令）让时间自然快进数日：日常照常运转（作息、营生、天气、旁人的日子），给我快进后的新处境与当务之急。" },
    { label: "🗺 附近转转", text: "（世界主持指令）我在当前所在地的周边走走看看：街面、铺子、行人——按这个年代这个地界该有的样子呈现所见所闻。" },
    { label: "💬 打听消息", text: "（世界主持指令）我向身边的人打听近期的传闻与大事：按这个年代的真实世界给出数条消息（本地见闻、行情物价、时局余波）。" },
    { label: "💼 找活谋生", text: "（世界主持指令）我去找活路：打听哪里要人、什么行情、什么门槛——按我的本事与身份给出现实的可能与波折。" },
    { label: "🛠 学门手艺", text: "（世界主持指令）我想学点安身立命的本事：向合适的人请教或拜师——给出学艺的门道、代价（钱/时间/人情）与现实进度。" },
    { label: "💰 盘算家底", text: "（世界主持指令）请以一段沉浸式叙述替我盘一盘家底：钱还剩多少、进项从哪来、大项开销在哪，接下来最要紧的一步是什么。" },
    { label: "🧭 检视自身", text: "（世界主持指令）请沉浸式呈现一次我的自我检视：身体、手艺、家底、人情与近期变化，并点出眼下最实际的短板。" },
    { label: "🤝 走亲访友", text: "（世界主持指令）我去走动身边的关系：亲戚、老熟人、或自然认识个新面孔——相遇要合乎人情（谁都有自己的日子要过），给出互动选项。" },
    { label: "🛒 采买置办", text: "（世界主持指令）我出门采购：按这个年代这个地界的实价列一遍要置办的东西（吃穿用度），结合我的钱袋给出取舍建议。" },
    { label: "🎲 生活变故", text: "（世界主持指令）请按现实概率引入一次生活变故（病痛、失窃、行情涨跌、家中来信之类皆可）：与我当前的处境相扣，不夸张但真实有分量。" },
    { label: "📜 查看处境", text: "（世界主持指令）请以一段简短的沉浸式叙述总结我当前的处境、家底与当务之急，并给出新的行动选项。" },
    { label: "🌅 人生终章", text: "（世界主持指令）请为我的这段人生收束终章：交代未了之事的后续，给我的角色一个符合其一生轨迹的落幕。" }
  ],
  /** 快捷指令条（全球冰封专用：末世生存向） · v3.31.2
      四大玩法器官（倒计时囤货 / 安全屋 / 空间异能 / 黑化复仇）各配指令，按原著节奏 */
  quanqiubingfengQuickCommands: [
    { label: "⏩ 时间快进", text: "（世界主持指令）让时间自然快进数日：气温、物价、舆论、供电供水与更大范围的世道按原著节奏推进，给我快进后的新处境与当务之急。" },
    { label: "📦 大宗囤货", text: "（世界主持指令）我动用资金大规模采购囤积物资（粮油/燃料/药品/武器/保暖/工具）：按当前阶段的行情与渠道给出价格、动作过程与结果，并提醒囤货行为可能引来的注意。" },
    { label: "🛒 掩饰采买", text: "（世界主持指令）我以日常采买做掩护小批量进货，避免大宗采购引来窥探：给出这次采买的明细、花销与是否被人注意。" },
    /* v3.32.1 「加固安全屋」改道：旧按钮发文字指令（操作全靠 AI 脑补，玩家无感）——
       本界已有实体玩法操作台（资源账本/工程队列/住户名册真实结算），点击直开中控 */
    { label: "🏠 安全屋中控", open: "ext", text: "（世界主持指令）我推进安全屋的改造升级（门窗加固/供暖/发电/净水/粮仓/防御/暗道……）：给出工期、耗材花销、当前安全屋等级的变化与完工后的设施清单。" },
    { label: "🌀 空间修炼", text: "（世界主持指令）接下来我专注修炼空间异能（意念收放/容量拓展）：按原著逻辑给出进境、消耗与际遇，容量成长当轮更新。" },
    { label: "📡 寒潮监测", text: "（世界主持指令）我查看当前的环境态势：气温与天气、供电供水、新闻舆论、抢购与秩序的动向，以及远方世界按原著推进的大事。" },
    { label: "👤 邻里动向", text: "（世界主持指令）我观察邻里与旧识的动向：谁起了疑心、谁在囤货、谁不安分、谁值得结交——按各自处境与人心理由。" },
    { label: "🎲 末世变故", text: "（世界主持指令）请按末世逻辑引入一次合理变故（叩门/窥探/暴徒/帮派/原著事件波及/异能者相遇皆可）：与我当前的处境、行踪相扣。" },
    { label: "🗡 清算时刻", text: "（世界主持指令）我决定向当前的仇人或威胁出手：按我的准备、异能与实力推演过程与结果——上一世的账，这一世连本带利地收。" },
    { label: "🧭 检视自身", text: "（世界主持指令）请沉浸式呈现一次我的自我检视：异能等阶、身家（现金/物资/安全屋等级/空间容量）、伤势与近期变化，并指出眼下最致命的短板。" },
    { label: "📜 查看处境", text: "（世界主持指令）请以一段简短的沉浸式叙述总结我当前的处境、资源与当务之急，并给出新的行动选项。" },
    { label: "🌅 纪元终章", text: "（世界主持指令）请为我的这段末世旅程收束终章：交代幸存者与未解之事的后续，给我的角色一个符合原著逻辑的落幕——从寒潮到新蓝星。" }
  ],
  /** 快捷指令条（超神学院专用：诸神时代军事向） · v3.37.0
      四大玩法器官（基因觉醒 / 军功晋升 / 守护天使契约 / 阵营抉择）各配指令，按原著节奏 */
  chaoshenxueyuanQuickCommands: [
    { label: "⏩ 战线推移", text: "（世界主持指令）让时间自然快进数日：饕餮攻势、各国战线、诸神动向与更大范围的世道按原著节奏推进，给我快进后的新处境与当务之急。" },
    { label: "🧬 基因检测", text: "（世界主持指令）我接受超级基因检测与训练：按原著逻辑给出我的基因适配度、当前等阶、能力倾向与潜力评估。" },
    { label: "🏋 特训推进", text: "（世界主持指令）我投入高强度军事特训（体能/射击/战术/异能开发）：给出训练过程、进境、伤耗与教官评价。" },
    { label: "⚔ 出勤作战", text: "（世界主持指令）我随队执行一次作战任务（巡逻/护卫/清剿/驰援皆可）：按我的编制与实力推演战斗过程、袍泽表现与战果。" },
    { label: "🎖 军功请功", text: "（世界主持指令）我以近期战功申请晋升与配给：按军队逻辑结算军衔变动、装备配发与上级评价。" },
    { label: "📡 战情侦察", text: "（世界主持指令）我查看当前的整体战局：饕餮舰队动向、天使与恶魔的博弈、各防线态势与远方的原著大事。" },
    { label: "👼 圣光接触", text: "（世界主持指令）我与天使一方产生一次接触（偶遇/受助/对话/缔结守护契约皆可）：按原著逻辑演绎——天使的善意有她的标准，不是人人都给。" },
    { label: "👿 暗面博弈", text: "（世界主持指令）我遭遇恶魔文明或卡尔暗世界的暗面接触（诱惑/交易/威胁/招募皆可）：推演其逻辑与我的应对，及此事对立场的影响。" },
    { label: "🤝 袍泽夜话", text: "（世界主持指令）我与身边的战友、长官或相识者来一场夜话：各自来历、心事与对这场战争的看法——关系与信任的变化写进剧情。" },
    { label: "🎲 战场变故", text: "（世界主持指令）请按战争逻辑引入一次合理变故（空袭/埋伏/情报有误/原著事件波及/神级存在现身皆可）：与我当前的处境、行踪相扣。" },
    { label: "🧭 检视自身", text: "（世界主持指令）请沉浸式呈现一次我的自我检视：基因等阶、军衔战功、编制装备、伤势与近期变化，并指出眼下最致命的短板。" },
    { label: "📜 查看处境", text: "（世界主持指令）请以一段简短的沉浸式叙述总结我当前的处境、战局位置与当务之急，并给出新的行动选项。" },
    { label: "🌅 诸神终章", text: "（世界主持指令）请为我的这段诸神时代旅程收束终章：交代战友与未解战事的后续，给我的角色一个符合原著逻辑的落幕——从凡人之躯到诸神注视。" }
  ],
  /** 快捷指令条（斩神专用：守夜人向） · v3.38.0
      四大玩法器官（精神力觉醒 / 禁墟解锁 / 病院羁绊 / 守夜任务）各配指令，按原著节奏 */
  zhanhenQuickCommands: [
    { label: "⏩ 夜尽天明", text: "（世界主持指令）让时间自然快进数日：迷雾动向、守夜人战报、诸神棋局与更大范围的世道按原著节奏推进，给我快进后的新处境与当务之急。" },
    { label: "🌀 精神检测", text: "（世界主持指令）我接受精神力检测与评估：按原著逻辑给出我的精神力境界、感知范围、成长潜力与当前短板。" },
    { label: "🧘 冥想修行", text: "（世界主持指令）我投入精神力修行（冥想/吐纳/禁墟开发/实战淬炼）：给出修行过程、进境、反噬与阶段性成果。" },
    { label: "⚔ 值夜出勤", text: "（世界主持指令）我随队执行一次值夜任务（巡逻/镇守/清剿/驰援皆可）：按我的编制与实力推演遭遇、队友表现与战果。" },
    { label: "🌫 入雾探索", text: "（世界主持指令）我主动踏入迷雾禁区探查：推演雾中的征兆、神秘遭遇与我的应对——按原著逻辑，风险与收获并存。" },
    { label: "🏥 病院巡房", text: '（世界主持指令）我去阳光精神病院走一趟（探望/帮忙/受托/偶遇皆可）：推演与护工或"病人"们的互动——按原著逻辑，病院的日常是温情的。' },
    { label: "🤝 袍泽夜话", text: "（世界主持指令）我与身边的队友、前辈或相识者来一场夜话：各自来历、心事与对这迷雾时代的看法——关系与信任的变化写进剧情。" },
    { label: "🎲 雾夜变故", text: "（世界主持指令）请按迷雾时代逻辑引入一次合理变故（神秘袭击/雾区异动/神明降临/原著事件波及皆可）：与我当前的处境、行踪相扣。" },
    { label: "🧭 检视自身", text: "（世界主持指令）请沉浸式呈现一次我的自我检视：精神力境界、禁墟档案、编制装备、伤势与近期变化，并指出眼下最致命的短板。" },
    { label: "📜 查看处境", text: "（世界主持指令）请以一段简短的沉浸式叙述总结我当前的处境、资源与当务之急，并给出新的行动选项。" },
    { label: "🌅 守夜终章", text: "（世界主持指令）请为我的这段守夜旅程收束终章：交代袍泽与未了之事的后续，给我的角色一个符合原著逻辑的落幕——从凡人之躯到提刀斩神。" }
  ],
  /** 快捷指令条（剑来专用：山水规矩向） · v3.47.4
   *  浩然天下讲规矩：递帖问拳、读书明理、因果记账 */
  jianlaiQuickCommands: [
    { label: "⏩ 春秋流转", text: "（世界主持指令）让时间自然快进数日/数月：山水动静、洲府大事、身边人的日子按原著节奏推进，给我快进后的新处境与当务之急。" },
    { label: "🗡 修行打卡", text: "（世界主持指令）我投入修行（练气开脉/剑气淬体/走桩打拳/读书养气皆可）：按浩然天下的规矩给出修行过程、进境与瓶颈。" },
    { label: "🤝 递帖拜访", text: "（世界主持指令）我备礼递帖，正式拜访一位人物（师长/道友/前辈皆可）：按山水规矩推演门房通传、相见礼数与言谈深浅。" },
    { label: "🗺 游历山水", text: "（世界主持指令）我动身游历（渡船/官道/山径皆可）：按原著地理给出沿途风物、见闻与际遇——山水迢迢，路上自有故事。" },
    { label: "💬 茶肆听书", text: "（世界主持指令）我去茶肆酒楼坐坐，听南来北往的传闻：给出数条符合当下时节的消息（山上动静、庙堂风向、市井趣谈）。" },
    { label: "👊 问拳切磋", text: "（世界主持指令）我与一位人物问拳/论剑切磋：按双方境界与路数推演过招过程、胜负与君子之约。" },
    { label: "📖 求学明理", text: "（世界主持指令）我向先生求学或静心读书：给出所学道理、心中豁然与可用的进益——浩然天下，读书也是修行。" },
    { label: "🎲 山水变故", text: "（世界主持指令）请按浩然天下的因果引入一次合理变故（恩怨上门/山水异动/仙家过路/原著大事波及皆可）：与我此前的言行相扣。" },
    { label: "🧭 检视自身", text: "（世界主持指令）请沉浸式呈现一次我的自我检视：境界修为、佩剑行囊、师承人情、心境变化，并指出眼下最要紧的短板。" },
    { label: "📜 查看处境", text: "（世界主持指令）请以一段简短的沉浸式叙述总结我当前的处境、家底与当务之急，并给出新的行动选项。" },
    { label: "🌅 江湖终章", text: "（世界主持指令）请为我的这段山水旅程收束终章：交代师友与未了因果的后续，给我的角色一个符合浩然天下逻辑的落幕。" }
  ],
  /** 快捷指令条（诡秘专用：神秘学向） · v3.47.4
   *  扮扮演、占占卜、防失控——非凡者的日常 */
  guimiQuickCommands: [
    { label: "⏩ 时日流转", text: "（世界主持指令）让时间自然快进数日：雾都的雾与雨照常、报纸头条更替、教会与隐秘组织的动向按原著节奏推进，给我快进后的新处境。" },
    { label: "⚗ 消化魔药", text: "（世界主持指令）我按序列的「扮演法则」行动以消化魔药：给出扮演的领悟、消化进度与失控风险的微妙变化。" },
    { label: "🔮 占卜一次", text: "（世界主持指令）我进行一次正式占卜（灵摆/塔罗/星象皆可）：给出仪式过程、结果的启示与警告——以及代价。" },
    { label: "💼 出勤办事", text: "（世界主持指令）我处理组织指派的差事或自己的营生：按我的身份与实力推演过程、收获与危险。" },
    { label: "🕯 灵界窥探", text: "（世界主持指令）我尝试借助灵视或仪式窥探灵界/历史残响：给出所见所感与相应代价——有些知识本身即是危险。" },
    { label: "🎩 社交场合", text: "（世界主持指令）我出席一场符合身份的社交场合（舞会/沙龙/俱乐部/下午茶皆可）：推演人物往来、情报流动与暗流下的试探。" },
    { label: "💬 打听消息", text: "（世界主持指令）我通过报纸、口耳或线人打听消息：给出数条符合当下时间线的传闻（教会公告、案件风声、黑市行情）。" },
    { label: "🎲 雾夜变故", text: "（世界主持指令）请按这个神秘世界的逻辑引入一次合理变故（非凡事件/组织冲突/失控者出没/原著大事波及皆可）：与我当前的行踪相扣。" },
    { label: "🧭 检视自身", text: "（世界主持指令）请沉浸式呈现一次我的自我检视：序列进度、非凡能力、财物人脉、精神状态与近期变化，并指出最危险的短板。" },
    { label: "📜 查看处境", text: "（世界主持指令）请以一段简短的沉浸式叙述总结我当前的处境、资源与当务之急，并给出新的行动选项。" },
    { label: "🌅 序列终章", text: "（世界主持指令）请为我的非凡之路收束终章：交代同伴与未了之事的后续，给我的角色一个符合神秘世界逻辑的落幕。" }
  ],
  /** 快捷指令条（蛊真人专用：残酷求道向） · v3.47.4
   *  炼蛊喂蛊、抢资源、防仇家——蛊界从不同情弱者 */
  guzhenrenQuickCommands: [
    { label: "⏩ 春秋流转", text: "（世界主持指令）让时间自然快进数日：蛊界的丛林法则照常运转（部族纷争、资源涨落、强者动向），给我快进后的新处境与当务之急。" },
    { label: "🐛 炼制新蛊", text: "（世界主持指令）我以蛊方炼制一只新蛊：给出材料筹备、炼蛊过程的凶险与成败——炼蛊一道，十炉九炸是常事。" },
    { label: "🍖 喂养蛊虫", text: "（世界主持指令）我以食物/元石喂养蛊虫、温养蛊窍：给出蛊虫的成长、真元的变化与喂养的门道。" },
    { label: "⛏ 采集蛊材", text: "（世界主持指令）我外出采集蛊材/狩猎妖兽/寻找天然蛊：按地形与危机推演收获、凶险与偶遇。" },
    { label: "⚔ 猎杀夺宝", text: "（世界主持指令）我盯上一处「肥羊」（散修/对头/妖兽巢穴皆可）：推演谋划、动手与战利——蛊界从不同情弱者，但也不缺反杀。" },
    { label: "💬 打听消息", text: "（世界主持指令）我在坊市/部族打听消息：给出数条蛊界传闻（蛊方流出、大能动向、秘境开启、仇家悬赏）。" },
    { label: "🧪 参悟蛊方", text: "（世界主持指令）我静心参悟一册蛊方或前人手记：给出领悟、可尝试的方向与所需材料。" },
    { label: "🎲 蛊界变故", text: "（世界主持指令）请按蛊界的残酷逻辑引入一次合理变故（仇家寻踪/蛊兽暴动/部族战争/原著大势波及皆可）：与我此前的作为相扣。" },
    { label: "🧭 检视自身", text: "（世界主持指令）请沉浸式呈现一次我的自我检视：蛊窍真元、蛊虫配置、身家性命与近期变化，并指出最致命的短板。" },
    { label: "📜 查看处境", text: "（世界主持指令）请以一段简短的沉浸式叙述总结我当前的处境、资源与当务之急，并给出新的行动选项。" },
    { label: "🌅 大道终章", text: "（世界主持指令）请为我的求道之路收束终章：交代仇怨与未了之愿的后续，给我的角色一个符合蛊界逻辑的落幕——哪怕是死，也要死得像个人物。" }
  ],
  /** 快捷指令条（家族修仙专用：种田经营向） · v3.47.4
   *  灵田坊市、族学人情——家族修仙一半道行在田里 */
  xuanjianxianzuQuickCommands: [
    { label: "⏩ 春秋流转", text: "（世界主持指令）让时间自然快进一季/数月：灵田收成、族中大事、修仙界的风向按节奏推进，给我快进后的新处境与当务之急。" },
    { label: "🌾 照看灵田", text: "（世界主持指令）我打理自家的灵田/灵植：给出农事、灵植长势与收成预期——修仙家族，一半道行在田里。" },
    { label: "🧘 打坐修炼", text: "（世界主持指令）我闭关打坐、温养灵力：按功法与灵根给出修炼进度、瓶颈与突破的契机。" },
    { label: "🏯 族中事务", text: "（世界主持指令）我参与族中事务（祭祖/族议/帮衬族人/族学授课皆可）：推演家族内外的脉络与人情。" },
    { label: "🛒 坊市采买", text: "（世界主持指令）我前往坊市采买（种子/丹药/法器/符箓皆可）：列出货品与灵石价格，结合我的家底给出建议。" },
    { label: "💬 打听消息", text: "（世界主持指令）我向族老、散修或坊市掌柜打听消息：给出数条符合当下时节的传闻（坊市行情、仙门动向、秘境风声）。" },
    { label: "🤝 交好邻里", text: "（世界主持指令）我主动走动结交（邻家修士/坊市掌柜/仙门外役皆可）：推演相识的契机与可发展的情谊——多个朋友多条路。" },
    { label: "🎲 家门变故", text: "（世界主持指令）请按修仙家族的逻辑引入一次合理变故（灵田遭灾/仇家寻衅/族中竞争/宗门大选波及皆可）：与我当前的处境相扣。" },
    { label: "🧭 检视自身", text: "（世界主持指令）请沉浸式呈现一次我的自我检视：修为境界、法器家底、族中位置与近期变化，并指出眼下最要紧的短板。" },
    { label: "📜 查看处境", text: "（世界主持指令）请以一段简短的沉浸式叙述总结我当前的处境、家底与当务之急，并给出新的行动选项。" },
    { label: "🌅 家族终章", text: "（世界主持指令）请为我的家族修行之路收束终章：交代族人与未了之事的后续，给我的角色一个符合家族修仙逻辑的落幕。" }
  ],
  /* ==================== v1.9.0 新增：朗读 / 字号 / 进度快照 ==================== */
  /** 朗读最近一章正文（浏览器原生 TTS，再点一次停止） */
  readAloud() {
    var _a, _b, _c, _d, _e;
    const synth = window.speechSynthesis;
    if (!synth) {
      (_a = window.showToast) == null ? void 0 : _a.call(window, "当前浏览器不支持语音朗读", "error");
      return;
    }
    if (synth.speaking) {
      synth.cancel();
      this._setReadBtn(false);
      (_b = window.showToast) == null ? void 0 : _b.call(window, "已停止朗读");
      return;
    }
    const fw = window.storyFramework;
    const last = [...((_c = fw == null ? void 0 : fw.storyState) == null ? void 0 : _c.conversationHistory) || []].reverse().find((m) => m.role === "assistant");
    let text = last ? window.StoryResponseHandler.extractBody(last.content).replace(/\s+/g, " ").trim() : "";
    if (text && window.StoryImageGen && window.StoryImageGen.stripMarkers) {
      text = window.StoryImageGen.stripMarkers(text).replace(/\s+/g, " ").trim();
    }
    if (!text) {
      (_d = window.showToast) == null ? void 0 : _d.call(window, "尚无正文可朗读，先开始创作吧", "error");
      return;
    }
    const u = new SpeechSynthesisUtterance(text.slice(0, 3500));
    const zh = synth.getVoices().find((v) => {
      var _a2;
      return (_a2 = v.lang) == null ? void 0 : _a2.startsWith("zh");
    });
    if (zh) u.voice = zh;
    u.lang = (zh == null ? void 0 : zh.lang) || "zh-CN";
    u.rate = 1;
    u.onend = () => this._setReadBtn(false);
    u.onerror = () => this._setReadBtn(false);
    synth.cancel();
    synth.speak(u);
    this._setReadBtn(true);
    (_e = window.showToast) == null ? void 0 : _e.call(window, "🔊 开始朗读最近一章（再次点击可停止）");
  },
  _setReadBtn(on) {
    const b = document.getElementById("ttsBtn");
    if (b) {
      b.classList.toggle("on", on);
      b.title = on ? "停止朗读" : "朗读最近一章";
    }
  },
  /* ---- 阅读字号：0.85~1.40 档位，持久化 ---- */
  FS_KEY: "storyFontScale",
  applyFontScale() {
    const s = parseFloat(localStorage.getItem(this.FS_KEY)) || 1;
    document.documentElement.style.setProperty("--font-scale", s);
  },
  setFontScale(delta) {
    var _a;
    const cur = parseFloat(localStorage.getItem(this.FS_KEY)) || 1;
    const next = Math.min(1.4, Math.max(0.85, +(cur + delta).toFixed(2)));
    localStorage.setItem(this.FS_KEY, next);
    this.applyFontScale();
    (_a = window.showToast) == null ? void 0 : _a.call(window, `字号 ${Math.round(next * 100)}%`);
  },
  /* ---- 进度快照：3 个槽位，一键存 / 读（比导出 JSON 更轻量的读档） ---- */
  SNAP_KEY: "storySnapSlots",
  snapList() {
    try {
      return JSON.parse(localStorage.getItem(this.SNAP_KEY)) || [null, null, null];
    } catch (e) {
      return [null, null, null];
    }
  },
  saveSnapshot(slot) {
    var _a, _b, _c, _d, _e, _f;
    const fw = window.storyFramework;
    if (!((_b = (_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.conversationHistory) == null ? void 0 : _b.length)) {
      (_c = window.showToast) == null ? void 0 : _c.call(window, "尚无正文可存快照，先开始创作吧", "error");
      return;
    }
    const v = fw.storyState.variables || {};
    const list = this.snapList();
    list[slot] = {
      ts: Date.now(),
      title: v.title || ((_d = fw.storyState.setup) == null ? void 0 : _d.title) || "未命名",
      chapter: v.chapter || 0,
      wordCount: v.wordCount || 0,
      state: fw.storyState
    };
    try {
      localStorage.setItem(this.SNAP_KEY, JSON.stringify(list));
      (_e = window.showToast) == null ? void 0 : _e.call(window, `✓ 已存入快照槽 ${slot + 1}（第 ${v.chapter || "?"} 章）`, "success");
    } catch (e) {
      window.UIDialog.alert({ title: "快照失败", message: "浏览器存储空间不足，请改用「导出存档」备份到文件。", danger: true });
    }
    (_f = window.Snapshots) == null ? void 0 : _f.render();
  },
  async loadSnapshot(slot) {
    var _a, _b;
    const snap = this.snapList()[slot];
    if (!snap) {
      (_a = window.showToast) == null ? void 0 : _a.call(window, "该槽位是空的", "error");
      return;
    }
    if (!snap.state || typeof snap.state !== "object") {
      (_b = window.showToast) == null ? void 0 : _b.call(window, "该槽位快照数据已损坏，无法读取", "error");
      return;
    }
    const ok = await window.UIDialog.confirm({
      title: `读取快照槽 ${slot + 1}`,
      message: `将回到：第 ${snap.chapter || "?"} 章 · 约 ${snap.wordCount || 0} 字
（${new Date(snap.ts).toLocaleString("zh-CN")}）

当前进度会被覆盖，确定读取吗？`,
      confirmText: "读取并回到该进度",
      cancelText: "再想想"
    });
    if (!ok) return;
    const fw = window.storyFramework;
    fw.storyState = { ...fw.storyState, ...snap.state };
    fw.saveStory();
    location.reload();
  },
  clearSnapshot(slot) {
    var _a;
    const list = this.snapList();
    if (!list[slot]) return;
    list[slot] = null;
    localStorage.setItem(this.SNAP_KEY, JSON.stringify(list));
    (_a = window.Snapshots) == null ? void 0 : _a.render();
  },
  /** 导出小说全文（TXT / Markdown） */
  exportStory(format) {
    var _a, _b, _c;
    const fw = window.storyFramework;
    const state = fw.storyState;
    if (!state.conversationHistory.length) {
      (_a = window.showToast) == null ? void 0 : _a.call(window, "尚无正文可导出，先开始创作吧", "error");
      return;
    }
    const v = state.variables;
    const title = v.title || ((_b = state.setup) == null ? void 0 : _b.title) || "未命名作品";
    let body = "";
    const IG = window.StoryImageGen;
    for (const msg of state.conversationHistory) {
      if (msg.role === "assistant") {
        const seg = window.StoryResponseHandler.extractBody(msg.content);
        body += IG && IG.formatForExport ? IG.formatForExport(seg, format) : seg;
        body += "\n\n";
      }
    }
    let content;
    if (format === "md") {
      const meta = [
        `> 类型：${fw.config.genreName}`,
        v.wordCount ? `> 字数：约 ${v.wordCount} 字` : "",
        `> 生成于：${(/* @__PURE__ */ new Date()).toLocaleString("zh-CN")}`
      ].filter(Boolean).join("\n>\n");
      content = `# ${title}

${meta}

---

${body.trim()}
`;
    } else {
      content = `${title}
${"=".repeat(title.length * 2)}
类型：${fw.config.genreName}


${body.trim()}
`;
    }
    this.download(content, `${title}.${format === "md" ? "md" : "txt"}`);
    (_c = window.showToast) == null ? void 0 : _c.call(window, `✓ 已导出《${title}》（${format.toUpperCase()}，约 ${v.wordCount || 0} 字）`, "success");
  },
  /** 导出完整存档 JSON */
  exportSave() {
    var _a;
    const fw = window.storyFramework;
    const data = {
      app: "云境 AI短篇小说生成器 v1.6.4",
      genre: fw.genre,
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      storyState: fw.storyState
    };
    this.download(JSON.stringify(data, null, 2), `云境存档_${fw.config.genreName}_${Date.now()}.json`);
    (_a = window.showToast) == null ? void 0 : _a.call(window, "✓ 存档已导出（JSON），可在任意设备导入恢复", "success");
  },
  /** 导入存档 JSON */
  importSave(file) {
    var _a;
    if (!file) {
      (_a = window.showToast) == null ? void 0 : _a.call(window, "未选择存档文件", "error");
      return;
    }
    const fw = window.storyFramework;
    const reader = new FileReader();
    reader.onerror = () => {
      window.UIDialog.alert({ title: "导入失败", message: "文件读取失败，请重试。", danger: true });
    };
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.storyState) throw new Error("存档格式不正确");
        fw.storyState = { ...fw.storyState, ...data.storyState };
        fw.saveStory();
        window.UIDialog.alert({ title: "导入存档", message: "导入成功，点击确定后刷新页面加载存档。" }).then(() => location.reload());
      } catch (err) {
        window.UIDialog.alert({ title: "导入失败", message: err.message, danger: true });
      }
    };
    reader.readAsText(file);
  },
  download(content, filename) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  },
  /** 重新开篇 / 重新捏身份（应用内确认框：QQ 浏览器文件服务等内嵌环境会静默拦截原生 confirm，导致点击无反应） */
  async restart() {
    const fw = window.storyFramework;
    const isRP = fw.config.mode === "roleplay";
    const ok = await window.UIDialog.confirm({
      title: isRP ? "重新入场" : "重新开篇",
      message: isRP ? "确定要结束当前旅程、重新创建身份吗？\n当前进度将被清空（建议先「导出存档」备份）。" : "确定要放弃当前故事、重新进行设定吗？\n当前进度将被清空（建议先「导出存档」备份）。",
      danger: true,
      confirmText: isRP ? "放弃并重新入场" : "放弃并重新开篇",
      cancelText: "再想想"
    });
    if (!ok) return;
    fw.clearSave();
    /* v3.47.1 修复「重开无效/旧档复活」（用户反馈：点了重新开篇，刷新后手机与剧情还是旧的）：
       ① StorageBoost 清 IDB 幽灵档是异步事务，clearSave 后立即 reload 会中断删除，
         事务回滚 → 整档残留 IDB，下次启动有恢复通道时被捞回；
       ② 清档瞬间若有 pending 的存档回调（手机主动来信收尾/流式落盘）会把数据回写主档。
       现：先等 IDB 删除事务落定，再兜底清一次档，最后刷新。 */
    const waitIdb = (window.StorageBoost && window.StorageBoost.ready())
      ? Promise.resolve(window.StorageBoost.remove("主档/" + fw.getSaveKey())).catch(() => { })
      : Promise.resolve();
    waitIdb.then(() => {
      try { fw.clearSave(); } catch (e) { }
      location.reload();
    });
  },
  bindEvents() {
    var _a, _b;
    const fw = window.storyFramework;
    this.applyFontScale();
    const btn = document.getElementById("sendBtn");
    const input = document.getElementById("userInput");
    if (btn) btn.addEventListener("click", () => this.send());
    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
          e.preventDefault();
          this.send();
        }
      });
    }
    const bar = document.getElementById("quickBar");
    if (bar) {
      let cmds;
      if (fw.config.mode === "roleplay") {
        cmds = fw.config.genreKey === "earth" ? this.earthQuickCommands : fw.config.genreKey === "quanqiubingfeng" ? this.quanqiubingfengQuickCommands : fw.config.genreKey === "chaoshenxueyuan" ? this.chaoshenxueyuanQuickCommands : fw.config.genreKey === "zhanhen" ? this.zhanhenQuickCommands : fw.config.genreKey === "jianlai" ? this.jianlaiQuickCommands : fw.config.genreKey === "guimi" ? this.guimiQuickCommands : fw.config.genreKey === "guzhenren" ? this.guzhenrenQuickCommands : fw.config.genreKey === "xuanjianxianzu" ? this.xuanjianxianzuQuickCommands : this.roleplayQuickCommands;
      } else {
        cmds = this.quickCommands;
      }
      cmds.forEach((cmd) => {
        const b = document.createElement("button");
        b.className = "quick-btn";
        b.textContent = cmd.label;
        b.title = cmd.text;
        b.addEventListener("click", () => {
          var _a2, _b2;
          if (cmd.open) {
            (_b2 = (_a2 = window.ImmersiveSuite) == null ? void 0 : _a2.openTab) == null ? void 0 : _b2.call(_a2, cmd.open);
            return;
          }
          this.send(cmd.text);
        });
        bar.appendChild(b);
      });
      (_b = (_a = window.WorldExt) == null ? void 0 : _a.mountStrip) == null ? void 0 : _b.call(_a);
    }
  }
};
window.StoryInput = StoryInput;
