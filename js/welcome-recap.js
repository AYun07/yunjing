(function() {
  "use strict";
  const WelcomeRecap = {
    esc(s) {
      return String(s != null ? s : "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    },
    /* ==================== 数据快照 ==================== */
    snap() {
      var _a, _b, _c, _d, _e, _f, _g, _h;
      const fw = window.storyFramework;
      const v = ((_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.variables) || {};
      const imm = window.ImmersiveSuite && ImmersiveSuite._state || {};
      const gallery = Object.values(imm.gallery || {}).filter((g) => g && g.name).sort((a, b) => (Number(b.favor) || 0) - (Number(a.favor) || 0));
      const fore = (Array.isArray(v.foreshadowings) ? v.foreshadowings : []).filter((p) => !(typeof p === "object" && /resolved|回收/.test(String((p == null ? void 0 : p.status) || ""))));
      return {
        title: v.title || ((_c = (_b = fw == null ? void 0 : fw.storyState) == null ? void 0 : _b.setup) == null ? void 0 : _c.title) || "未命名书稿",
        chapter: Number(v.chapter) || 0,
        wordCount: Number(v.wordCount) || 0,
        realm: imm.realmRaw || v.realm || v.境界 || v.status || "",
        tension: Number((_e = v.tension) != null ? _e : (_d = v.dashboard) == null ? void 0 : _d.tension) || null,
        npcs: gallery.slice(0, 3),
        npcTotal: gallery.length,
        foreOpen: fore.length,
        tensions: imm.tensions || [],
        savedAt: ((_f = fw == null ? void 0 : fw.storyState) == null ? void 0 : _f.savedAt) || null,
        digest: ((_h = (_g = fw == null ? void 0 : fw.storyState) == null ? void 0 : _g.digest) == null ? void 0 : _h.summary) || ""
      };
    },
    /** 当前存档里的回顾缓存 {chapter, text, ts} */
    cached() {
      var _a, _b;
      return ((_b = (_a = window.storyFramework) == null ? void 0 : _a.storyState) == null ? void 0 : _b.recap) || null;
    },
    /** 章节推进过（或从未生成过）才值得重新说书 */
    stale() {
      var _a, _b, _c;
      const c = this.cached();
      const ch = Number((_c = (_b = (_a = window.storyFramework) == null ? void 0 : _a.storyState) == null ? void 0 : _b.variables) == null ? void 0 : _c.chapter) || 0;
      return !c || !c.text || Number(c.chapter) !== ch;
    },
    /* ==================== 主入口（读档后调用） ==================== */
    maybeShow() {
      const fw = window.storyFramework;
      if (!fw || !fw.storyState.isStoryStarted) return false;
      if (!(fw.storyState.conversationHistory || []).length) return false;
      this.renderCard();
      if (this.stale()) this.generate();
      return true;
    },
    /* ==================== 卡片渲染 ==================== */
    renderCard() {
      var _a;
      const s = this.snap();
      const c = this.cached();
      const when = s.savedAt ? new Date(s.savedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
      const curve = window.ImmersionPlus && ImmersionPlus.svgTension && s.tensions.length >= 2 ? ImmersionPlus.svgTension(s.tensions) : `<div class="wr-empty">张力曲线待积累（变量AI每轮上报 tension 后自动描点）</div>`;
      const npcs = s.npcs.length ? s.npcs.map((g) => `<span class="wr-chip">🎭 ${this.esc(g.name)}${g.favor != null ? ` · ${Math.round(g.favor)}` : ""}</span>`).join("") : '<span class="wr-chip">尚无相识之人</span>';
      const html = `
            <div class="wr-card" id="welcomeRecapCard">
                <div class="wr-head">
                    <b>📜 前情回顾</b>
                    <span class="wr-sub">欢迎回到这一卷</span>
                    <button class="wr-x" title="收起" onclick="this.closest('.wr-card').remove()">✕</button>
                </div>
                <div class="wr-body">
                    <div class="wr-title-line">
                        <b class="wr-book">《${this.esc(s.title)}》</b>
                        <span class="wr-meta">第 ${s.chapter} 章 · ${s.wordCount.toLocaleString()} 字 · 上次执笔 ${when}</span>
                    </div>
                    <div class="wr-say">
                        <div class="wr-say-label">📖 说书人回顾</div>
                        <div class="wr-say-text" id="wrSayText">${(c == null ? void 0 : c.text) ? this.esc(c.text) : '<i class="wr-loading">说书人正在翻动书页……</i>'}</div>
                        <button class="wr-btn" id="wrRegenBtn" onclick="WelcomeRecap.generate()">🔄 重新说一遍</button>
                    </div>
                    ${curve}
                    <div class="wr-stats">
                        ${s.realm ? `<span class="wr-chip realm">⛩ ${this.esc(String(s.realm).slice(0, 18))}</span>` : ""}
                        ${s.tension != null ? `<span class="wr-chip">⚡ 张力 ${s.tension}</span>` : ""}
                        ${s.foreOpen ? `<span class="wr-chip warn">🧵 未回收伏笔 ${s.foreOpen}</span>` : ""}
                        <span class="wr-chip">👥 相识 ${s.npcTotal} 人</span>
                    </div>
                    <div class="wr-npcs">${npcs}</div>
                </div>
            </div>`;
      (_a = document.getElementById("welcomeRecapCard")) == null ? void 0 : _a.remove();
      const container = document.getElementById("chatMessages");
      if (!container) return;
      const wrap = document.createElement("div");
      wrap.innerHTML = html;
      const node = wrap.firstElementChild || wrap;
      container.prepend ? container.prepend(node) : container.appendChild(node);
    },
    /* ==================== AI 说书 ==================== */
    /** 兜底文案：无 AI / 调用失败时给足信息量（摘要 → 末段原文 → 章节行） */
    fallbackText() {
      var _a;
      const fw = window.storyFramework;
      const s = this.snap();
      if (s.digest) return s.digest;
      const tail = [...((_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.conversationHistory) || []].reverse().find((m) => m.role === "assistant");
      if (tail) {
        const t = String(tail.content || "").replace(/\s+/g, " ").trim();
        if (t) return "上一章末尾：" + (t.length > 160 ? t.slice(0, 160) + "……" : t);
      }
      return `故事写到第 ${s.chapter} 章，累计 ${s.wordCount.toLocaleString()} 字。继续输入指令，接着往下写。`;
    },
    async generate() {
      var _a;
      const fw = window.storyFramework;
      const va = window.VariableAI;
      const btn = document.getElementById("wrRegenBtn");
      const el = document.getElementById("wrSayText");
      if (!fw) return;
      if (btn) {
        btn.disabled = true;
        btn.textContent = "⏳ 说书中…";
      }
      const s = this.snap();
      const hist = fw.storyState.conversationHistory || [];
      const recent = hist.slice(-4).map(
        (m) => (m.role === "user" ? "【指令】" : "【正文】") + (va && va._trimForSummary ? va._trimForSummary(String(m.content || "")) : String(m.content || "").slice(0, 500))
      ).join("\n");
      const facts = [
        `书名：《${s.title}》`,
        `当前章节：第 ${s.chapter} 章`,
        `累计字数：${s.wordCount}`,
        s.realm ? `主角境界/状态：${s.realm}` : "",
        s.tension != null ? `当前张力：${s.tension}/100` : "",
        s.npcs.length ? `主要角色：${s.npcs.map((g) => g.name).join("、")}` : "",
        s.foreOpen ? `未回收伏笔：${s.foreOpen} 处` : ""
      ].filter(Boolean).join("\n");
      let text = "";
      try {
        if (!va || !va.recapReady()) throw new Error("AI 接口未配置");
        const out = await va.recapCall([
          { role: "system", content: `你是小说工坊的"说书人"。读者隔了一段时间回到书中，请用不超过 180 字为他回顾前情。要求：第三人称、按时间顺序讲清主线进展与人物动向；点出当前最大的悬念或危机，用一句有余韵的话收尾（如"而此刻，……"）；不要罗列数字，不要出现"玩家""用户"字样，只输出回顾正文。` },
          { role: "user", content: `${s.digest ? `【已有前情摘要】
${s.digest}

` : ""}【最近剧情】
${recent || "（尚无正文）"}

【当前状态】
${facts}` }
        ]);
        text = String(out || "").trim().slice(0, 400);
        if (!text) throw new Error("说书人返回为空");
      } catch (e) {
        text = this.fallbackText();
        if (el) el.classList.add("wr-fallback");
      }
      fw.storyState.recap = {
        chapter: Number((_a = fw.storyState.variables) == null ? void 0 : _a.chapter) || 0,
        text,
        ts: Date.now()
      };
      try {
        fw.saveStory();
      } catch (e) {
      }
      const box = document.getElementById("wrSayText");
      if (box) {
        box.classList.remove("wr-fallback");
        box.textContent = text;
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = "🔄 重新说一遍";
      }
    }
  };
  if (!document.getElementById("welcomeRecapStyle")) {
    const st = document.createElement("style");
    st.id = "welcomeRecapStyle";
    st.textContent = `
.wr-card{margin:4px 0 14px;background:linear-gradient(165deg,rgba(33,29,23,.96),rgba(23,20,15,.96));border:1px solid #c9a86a55;border-radius:14px;box-shadow:0 10px 34px rgba(0,0,0,.4);overflow:hidden;animation:wrIn .5s ease both}
@keyframes wrIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
.wr-head{display:flex;align-items:center;gap:10px;padding:11px 16px;border-bottom:1px solid #c9a86a28;background:linear-gradient(90deg,rgba(201,168,106,.10),transparent)}
.wr-head b{color:#e8dcc0;font-size:14.5px;letter-spacing:1.5px}
.wr-sub{font-size:11px;color:#9a8c6e;letter-spacing:1px}
.wr-x{margin-left:auto;background:none;border:none;color:#9a8c6e;font-size:15px;cursor:pointer;padding:2px 8px}
.wr-x:hover{color:#e8dcc0}
.wr-body{padding:13px 16px;display:flex;flex-direction:column;gap:11px}
.wr-title-line{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.wr-book{color:#d8cba8;font-size:15px}
.wr-meta{font-size:11px;color:#9a8c6e}
.wr-say{background:rgba(0,0,0,.28);border:1px solid #c9a86a30;border-radius:10px;padding:11px 13px}
.wr-say-label{font-size:10.5px;color:#c9a86a;letter-spacing:2px;margin-bottom:7px}
.wr-say-text{font-size:13px;line-height:1.95;color:#e0d6bc;white-space:pre-wrap;word-break:break-word;min-height:40px}
.wr-say-text.wr-fallback{color:#bdb08e}
.wr-loading{color:#9a8c6e;font-style:normal;animation:wrPulse 1.4s ease-in-out infinite}
@keyframes wrPulse{0%,100%{opacity:.45}50%{opacity:1}}
.wr-btn{margin-top:9px;background:#c9a86a14;border:1px solid #c9a86a48;color:#c9a86a;border-radius:8px;padding:4px 12px;font-size:11px;cursor:pointer;letter-spacing:1px}
.wr-btn:hover{background:#c9a86a26}
.wr-btn:disabled{opacity:.5;cursor:wait}
.wr-empty{font-size:11.5px;color:#8a7d63;background:rgba(0,0,0,.2);border:1px dashed #c9a86a33;border-radius:9px;padding:10px 12px}
.wr-stats{display:flex;flex-wrap:wrap;gap:6px}
.wr-chip{font-size:11px;color:#d8cba8;background:#c9a86a12;border:1px solid #c9a86a30;border-radius:999px;padding:3px 10px}
.wr-chip.realm{border-color:#c9a86a66;background:#c9a86a1e}
.wr-chip.warn{border-color:#e0a84c66;color:#e6c078;background:#e0a84c12}
.wr-npcs{display:flex;flex-wrap:wrap;gap:6px}
.wr-card .ip-tension{background:rgba(0,0,0,.24);border:1px solid #c9a86a28;border-radius:10px;padding:10px 12px}
.wr-card .ip-ten-head span{color:#c9a86a;letter-spacing:1px}
.wr-card .ip-ten-head i{color:#9a8c6e}
.wr-card .ip-ten-axis{color:#8a7d63}
.wr-card .ip-ten-warn{color:#d8b25c}
@media (max-width:760px){.wr-body{padding:11px 12px}.wr-book{font-size:14px}.wr-say-text{font-size:12.5px}}`;
    document.head.appendChild(st);
  }
  window.WelcomeRecap = WelcomeRecap;
})();
