(function() {
  "use strict";
  const Alive = {
    version: "v3.20.0",
    /* 打字指示器状态（内存态，不入档）：{ 聊天名: true } */
    typing: {},
    /* 标题栏原始内容缓存（打字指示恢复用） */
    _origTitle: null,
    /* ==================== 状态存取（storyState.phone.alive） ==================== */
    state() {
      const p = window.PhonePanel.state();
      if (!p.alive || typeof p.alive !== "object") p.alive = { rel: {}, lastReachTurn: -99 };
      if (!p.alive.rel) p.alive.rel = {};
      return p.alive;
    },
    /** 单个联系人的关系账本：{ w 温度, idle 闲置轮数, ign 未回消息数, lastReach 上次主动轮, reach 累计主动 } */
    rel(name) {
      var _a, _b, _c, _d;
      const a = this.state();
      if (!a.rel[name]) {
        let w = 50;
        try {
          const d = ((_c = (_b = (_a = window.storyFramework) == null ? void 0 : _a.storyState) == null ? void 0 : _b.variables) == null ? void 0 : _c.characters) || {};
          const f = Number((_d = d[name]) == null ? void 0 : _d.favor);
          if (f >= 0 && f <= 100) w = f;
        } catch (e) {
        }
        try {
          const c = window.PhonePanel.state().contacts.find((x) => x.name === name);
          if (c && c.custom && w < 65) w = 65;
        } catch (e) {
        }
        a.rel[name] = { w, idle: 0, ign: 0, lastReach: -99, reach: 0 };
      }
      const r = a.rel[name];
      try {
        const c = window.PhonePanel.state().contacts.find((x) => x.name === name);
        if (c && c.star && r.w < 60) r.w = 60;
      } catch (e) {
      }
      return r;
    },
    /* ==================== 事件钩子（phone-panel 调用） ==================== */
    /** 玩家发了消息：温度升温、闲置清零、委屈清零 */
    onPlayerSend(chatName, ch) {
      if (ch && ch.group) return;
      try {
        const r = this.rel(chatName);
        r.idle = 0;
        r.ign = 0;
        r.w = Math.min(100, (r.w || 50) + 2.5);
        const c = window.PhonePanel.state().contacts.find((x) => x.name === chatName);
        if (c && c.star) r.w = Math.min(100, r.w + 1);
      } catch (e) {
      }
    },
    /** NPC 消息落库后：清点「连续没被玩家回的消息数」（情绪记忆） */
    onNpcMessage(from, group) {
      if (group) return;
      try {
        const ch = window.PhonePanel.findChat(from);
        if (!ch || ch.group || !ch.msgs.length) return;
        let n = 0;
        for (let i = ch.msgs.length - 1; i >= 0 && !ch.msgs[i].me; i--) n++;
        this.rel(from).ign = n;
      } catch (e) {
      }
    },
    /** 每轮正文完成：闲置计数 → 温度演化 → 主动评估（本地零 token，命中才调用） */
    onTurn() {
      try {
        const fw = window.storyFramework;
        if (!fw || !fw.storyState || !fw.storyState.isStoryStarted) return;
        if (window.PhonePanel.getSettings().alive === false) return;
        if (window.PhonePanel.tier() === "none") return;
        const p = window.PhonePanel.state();
        const turn = fw.storyState.turnCount || 0;
        for (const c of p.contacts) {
          const r = this.rel(c.name);
          r.idle = (r.idle || 0) + 1;
          if (r.idle > 10 && r.w > 30) r.w = Math.max(30, r.w - 0.4);
          if ((r.ign || 0) >= 3 && r.w > 40) r.w = Math.max(40, r.w - 0.3);
        }
        const s = window.PhonePanel.getSettings();
        const interval = Math.max(1, parseInt(s.interval) || 3);
        if ((p.counter || 0) + 1 >= interval) return;
        const target = this.evaluate(turn);
        if (!target) return;
        this.reachOut(target.name);
      } catch (e) {
        console.warn("[PhoneAlive] onTurn 异常（不影响主流程）:", e);
      }
    },
    /* ==================== 主动评估（纯本地，零 token） ==================== */
    /**
     * 评选「此刻最想找玩家的人」。
     * 规则直觉：越亲、晾得越久、你欠的回复越多 → 越可能来找你；星标近乎翻倍。
     * 期望节奏：约每 5-8 轮正文出现一次主动来信（有随机扰动，不会机械规律）。
     */
    evaluate(turn) {
      var _a, _b;
      const p = window.PhonePanel.state();
      const a = this.state();
      if (turn - ((_a = a.lastReachTurn) != null ? _a : -99) < 2) return null;
      const night = this.isNight();
      let best = null, bestScore = 0;
      for (const c of p.contacts) {
        const r = this.rel(c.name);
        const ch = window.PhonePanel.findChat(c.name);
        if (!ch && !c.star && r.w < 60) continue;
        const cooldown = c.star ? 3 : 5;
        if (turn - ((_b = r.lastReach) != null ? _b : -99) < cooldown) continue;
        if ((r.idle || 0) < (c.star ? 2 : 3)) continue;
        let score = r.w / 100 * 0.45 + Math.min((r.idle || 0) / 14, 1) * 0.3;
        if ((r.ign || 0) >= 2) score += 0.28;
        if (c.star) score *= 1.9;
        if (night && !c.star) score *= 0.45;
        score *= 0.55 + Math.random() * 0.9;
        if (score > 0.52 && score > bestScore) {
          best = c;
          bestScore = score;
        }
      }
      return best;
    },
    /** 剧情时刻是否深夜（22:00-05:00 / 描述含深夜凌晨） */
    isNight() {
      var _a, _b;
      const v = ((_b = (_a = window.storyFramework) == null ? void 0 : _a.storyState) == null ? void 0 : _b.variables) || {};
      const t = String(v.time || v.时刻 || "");
      if (/深夜|凌晨|午夜/.test(t)) return true;
      const m = t.match(/(\d{1,2}):(\d{2})/);
      if (m) {
        const h = Number(m[1]);
        return h >= 22 || h < 5;
      }
      return false;
    },
    /* ==================== 主动来信（一次 API 调用） ==================== */
    async reachOut(name) {
      var _a, _b;
      const fw = window.storyFramework;
      const p = window.PhonePanel.state();
      if (!window.PhonePanel.isApiReady() || p.isProcessing) return;
      p.isProcessing = true;
      const r = this.rel(name);
      const a = this.state();
      const turn = fw.storyState.turnCount || 0;
      r.lastReach = turn;
      r.reach = (r.reach || 0) + 1;
      a.lastReachTurn = turn;
      this._setTyping(name, true);
      try {
        const messages = this.buildReachPrompt(name);
        (_a = window.TokenUsage) == null ? void 0 : _a.recordRequest(messages, "手机");
        const raw = await window.PhonePanel.callPhoneAPI(messages);
        (_b = window.TokenUsage) == null ? void 0 : _b.recordOutput(raw, "手机");
        const data = window.PhonePanel.parseJSON(raw);
        const list = (data && Array.isArray(data.replies) ? data.replies : []).filter((x) => x && x.text).slice(0, 3).map((x) => ({ from: name, text: String(x.text), recall: !!x.recall }));
        if (list.length) {
          await this.deliver(name, list, true);
          p.pending.push(`📱 ${name} 主动来找玩家聊天了（玩家已有 ${r.idle} 轮没理 TA）`);
          if (p.pending.length > 12) p.pending = p.pending.slice(-12);
          try {
            fw.saveStory();
          } catch (e) {
          }
          this.notifyArrival(name, (list.find((x) => !x.recall) || {}).text || "");
        }
      } catch (err) {
        console.warn("[PhoneAlive] 主动联系失败（下轮再试）:", err.message);
      } finally {
        this._setTyping(name, false);
        p.isProcessing = false;
      }
    },
    /** 主动联系提示词：她为什么来找你、以什么口吻、发几条 */
    buildReachPrompt(name) {
      const fw = window.storyFramework;
      const v = fw.storyState.variables || {};
      const chars = v.characters || {};
      const p = window.PhonePanel.state();
      const c = p.contacts.find((x) => x.name === name) || { role: "熟人" };
      const d = chars[name] || {};
      const r = this.rel(name);
      const ch = window.PhonePanel.findChat(name);
      const t = window.PhonePanel.tierInfo();
      const hist = ch ? ch.msgs.slice(-10).map((m) => `${m.me ? "玩家" : m.from}: ${m.text}`).join("\n") : "（两人还没聊过天）";
      const unanswered = [];
      if (ch) for (let i = ch.msgs.length - 1; i >= 0 && !ch.msgs[i].me && unanswered.length < 3; i--) {
        unanswered.push(`「${ch.msgs[i].text}」`);
      }
      const warmthDesc = r.w >= 80 ? "非常亲近（挚友/恋人/至亲级——无话不谈，可以黏人、撒娇、开玩笑、随手发语音）" : r.w >= 60 ? "关系不错（熟络随意，互开玩笑不用客套）" : r.w >= 40 ? "普通熟人（友好但讲分寸）" : "略有生疏（客气、有距离感，不太会主动打扰）";
      const idleNote = `玩家已经 ${r.idle} 轮剧情没有理过 TA 了`;
      const ignNote = r.ign >= 2 ? `
⚠ TA 之前发的 ${r.ign} 条消息（${unanswered.join("、")}）玩家一直没回——TA 有点在意：关系近才敢小小抱怨或调侃（"人呢？""消失了？"），但不阴阳怪气、不纠缠` : r.ign === 1 ? "\nTA 上一条消息玩家还没回——TA 心里有数（可自然带一句，也可不提）" : "";
      const nightNote = this.isNight() ? `
🌙 现在是深夜（${v.time || v.时刻 || "夜深"}）——深夜找人的消息有深夜的样子：失眠想聊聊、睡前一句晚安、犹豫要不要发` : "";
      const sys = `你是「现实地球」手机分身引擎的主动联系模块。此刻，${name} 在过自己日子的间隙想起了玩家，要主动发消息——不是系统派任务，是 TA 自己想找 TA 说说话。

【世界基线】${window.PhonePanel.eraBrief()}

【这位联系人】${name}（${c.role}${c.custom ? " · 玩家亲笔设定" : ""}）
- 年龄：${d.age || "按身份与性格自行推断"}
- 外貌：${d.appearance || "按身份与年龄自行推断"}
- 性格：${d.personality || "按身份与年龄自行推断"}
- 言谈：${d.speechPattern || "按性格自行推断"}
- 念头：${d.motivation || "过日子"}
- 近况：${d.status || "照常过日子"}${d.location ? `
- 现在在哪：${d.location}` : ""}${(() => {
        const cf = d.customFields && typeof d.customFields === "object" && !Array.isArray(d.customFields) ? d.customFields : {};
        const cfStr = Object.entries(cf).slice(0, 6).map(([k, val]) => `${k}=${String(val).slice(0, 30)}`).join("；");
        return cfStr ? `
- 玩家亲笔设定（发消息时必须严格遵守）：${cfStr}` : "";
      })()}
- 与玩家的关系温度：${Math.round(r.w)}/100 · ${warmthDesc}

【关系近况】${idleNote}${ignNote}${nightNote}

【最近聊天记录】
${hist}

【主动联系铁律】
1. 动机来自 TA 自己的生活与性格：想起你了 / 遇到件事想分享 / 看到个东西觉得你会喜欢 / 有点担心你 / 单纯想唠两句——一瞬间的念头，不是酝酿已久的大事
2. 像真人打字：开场随意（"在吗"/"跟你说个事"/直接甩个见闻/一个表情开场），绝不一上来就长篇大论
3. 连环短消息：1-3 条，每条不超过 25 字——真人发消息是一小段一小段发的，几秒一条
4. 语气严格贴合关系温度：${warmthDesc}
5. 时代感：${t ? t.label : ""}的人怎么发消息就怎么发——用语、表情、习惯全部按年代校准
6. 只是日常想念与唠嗑：不推进剧情、不制造巧合事件、不连环发问等玩家回答
7. 最后一条留个话头（等玩家回的那种），但别是审问${window.PhonePanel.tier() === "wechat" ? `
8. 富形态偶尔用：text 可写 "[语音] 8''"（她想说话的时候）或 "[表情：捂脸]"——按性格，别刷屏
9. 极偶尔（十次里难有一次）可以发一条又撤回（"recall":true）——欲言又止，也是真人` : ""}
${window.PhonePanel.knowledgeBrief(String(name) + " 主动联系 找玩家 聊天 想念 " + idleNote)}

【输出协议】只输出一个 JSON 对象，不要任何多余文字：
{"replies":[{"text":"第1条（开场，随意短促）"},{"text":"第2条（可选，接上一条补充）"},{"text":"第3条（可选，留话头）"}]}
——按发送顺序排列；1-3 条；每条 ≤25 字。`;
      return [
        { role: "system", content: sys },
        { role: "user", content: `此刻 ${name} 想找玩家说说话。请生成 TA 要发的消息（1-3 条短消息），严格按 JSON 协议输出。` }
      ];
    },
    /* ==================== 拟真投递（typing → 一条 → typing → 一条） ==================== */
    /**
     * 逐条投递消息：每条先「正在输入…」（时长按字数，像真人打字速度）再落库上屏。
     * asIncoming=true 走来信通道（计未读 + 回流主笔）；false 走回复通道（玩家正看着，不计未读）。
     * 回复通道打字时长收得更紧——玩家在等，别让节奏拖沓。
     */
    async deliver(chatName, items, asIncoming) {
      const fw = window.storyFramework;
      const list = (items || []).slice(0, 4);
      for (let i = 0; i < list.length; i++) {
        const it = list[i];
        if (!it.recall) await this.typingFor(chatName, String(it.text || "").length, asIncoming === false);
        if (asIncoming) {
          window.PhonePanel.pushIncoming(it.from || chatName, it.text, "", it.recall ? "recall" : void 0);
        } else {
          window.PhonePanel.pushNpcReply(chatName, it.from || chatName, it.text, it.recall ? "recall" : void 0);
        }
        window.PhonePanel.refresh();
        try {
          fw.saveStory();
        } catch (e) {
        }
        this.animateLastBubble();
        if (i < list.length - 1) await this.sleep(it.recall ? 700 : 350 + Math.random() * 800);
      }
    },
    /** 真人回复节奏：玩家发消息后对方「想一会儿」再开始打字（1.5-4 秒，不秒回） */
    async replyDelay(chatName, lastText) {
      const len = String(lastText || "").length;
      const dur = Math.min(4e3, 1400 + len * 45 + Math.random() * 1200);
      this._setTyping(chatName, true);
      await this.sleep(dur);
      this._setTyping(chatName, false);
    },
    /** 打字时长：字数 × 打字速度 + 基础犹豫（来信封顶 6.5 秒 / 回复封顶 2.8 秒） */
    async typingFor(chatName, charCount, isReply) {
      const cap = isReply ? 2800 : 6500;
      const dur = Math.min(cap, 1e3 + charCount * 120 + Math.random() * 700);
      this._setTyping(chatName, true);
      await this.sleep(dur);
      this._setTyping(chatName, false);
    },
    /* ==================== 打字指示器（UI） ==================== */
    _setTyping(name, on) {
      if (on) this.typing[name] = true;
      else delete this.typing[name];
      this.paintTyping();
    },
    /** 标题栏「对方正在输入…」（微信式）：直接改 DOM，render 后由 afterRender 重涂 */
    paintTyping() {
      try {
        if (typeof document === "undefined") return;
        const shell = document.getElementById("phShell");
        if (!shell || !shell.classList.contains("open")) return;
        const head = shell.querySelector(".ph-chat-head b");
        if (!head) return;
        const viewing = window.PhonePanel.view || {};
        const active = Object.keys(this.typing).find((n) => viewing.tab === "chat" && viewing.chat === n);
        if (active) {
          if (!this._origTitle) this._origTitle = head.innerHTML;
          head.innerHTML = '<span class="ph-typing-title">对方正在输入…</span>';
        } else if (this._origTitle) {
          head.innerHTML = this._origTitle;
          this._origTitle = null;
        }
        this.injectTypingBubble();
      } catch (e) {
      }
    },
    /** 聊天体底部的三点打字气泡（iMessage 式；render 重绘后自动补回） */
    injectTypingBubble() {
      try {
        if (typeof document === "undefined") return;
        const body = document.getElementById("phChatBody");
        if (!body) return;
        const existing = body.querySelector(".ph-typing-bub");
        const viewing = window.PhonePanel.view || {};
        const active = viewing.tab === "chat" && viewing.chat && this.typing[viewing.chat];
        if (!active) {
          if (existing) existing.remove();
          return;
        }
        if (!existing) {
          const div = document.createElement("div");
          div.className = "ph-typing-bub";
          div.innerHTML = "<span></span><span></span><span></span>";
          body.appendChild(div);
        }
        body.scrollTop = body.scrollHeight;
      } catch (e) {
      }
    },
    /** panel.render() 之后调用：恢复打字指示器（全量重绘会冲掉注入的 DOM） */
    afterRender() {
      this._origTitle = null;
      this.paintTyping();
    },
    /** 最新气泡入场动画（只给刚落地那条，避免整屏重播） */
    animateLastBubble() {
      try {
        if (typeof document === "undefined") return;
        const body = document.getElementById("phChatBody");
        if (!body) return;
        const bubs = body.querySelectorAll(".ph-bub");
        const last = bubs[bubs.length - 1];
        if (last) {
          last.classList.add("new");
          body.scrollTop = body.scrollHeight;
        }
      } catch (e) {
      }
    },
    /** 手机没开时她来找你：轻提醒 + 悬浮铃动（开了就不打扰） */
    notifyArrival(name, firstText) {
      var _a;
      try {
        if (typeof document === "undefined") return;
        const shell = document.getElementById("phShell");
        if (shell && shell.classList.contains("open")) return;
        const brief = String(firstText || "").replace(/^\[(语音|表情)[:：][^\]]*\]\s*/, (m) => m.includes("语音") ? "[语音]" : "[表情]").slice(0, 20);
        (_a = window.showToast) == null ? void 0 : _a.call(window, `📱 ${name}：${brief || "给你发消息了"}`, "info");
        const dock = document.getElementById("phDock");
        if (dock) {
          dock.classList.add("ringing");
          setTimeout(() => dock.classList.remove("ringing"), 2200);
        }
      } catch (e) {
      }
    },
    /* ==================== 设置 ==================== */
    toggle() {
      var _a;
      const s = window.PhonePanel.getSettings();
      const on = s.alive === false;
      window.PhonePanel.saveSettings({ ...s, alive: on });
      (_a = window.showToast) == null ? void 0 : _a.call(window, on ? "💗 主动联系已开启——闲置久了，会有人来找你" : "💗 主动联系已关闭——大家各忙各的，没人打扰", "success");
      try {
        window.PhonePanel.render();
      } catch (e) {
      }
    },
    /* ==================== 工具 ==================== */
    /* 时间倍速：默认 1（真实节奏）；测试注入 0.02 可把秒级投递压到毫秒级 */
    speed: 1,
    sleep(ms) {
      return new Promise((res) => setTimeout(res, Math.max(0, ms * (this.speed || 1))));
    }
  };
  window.PhoneAlive = Alive;
  console.log("[PhoneAlive] 💗 主动联系引擎就位——你不理 TA，TA 会来找你");
})();
