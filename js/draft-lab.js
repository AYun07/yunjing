(function() {
  "use strict";
  const DraftLab = {
    KEY: "storyDraftLab",
    defaults: { reviewOn: false, reviewEvery: 3, multiN: 3 },
    get() {
      try {
        return { ...this.defaults, ...JSON.parse(localStorage.getItem(this.KEY) || "{}") };
      } catch (e) {
        return { ...this.defaults };
      }
    },
    save(cfg) {
      try {
        localStorage.setItem(this.KEY, JSON.stringify({ ...this.get(), ...cfg }));
      } catch (e) {
      }
    },
    esc(s) {
      return String(s != null ? s : "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    },
    extractBody(raw) {
      const h = window.StoryResponseHandler;
      if (h && h.extractBody) return String(h.extractBody(raw) || "");
      return String(raw || "").replace(/\(variable_update\)[\s\S]*?\(\/variable_update\)/gi, "").trim();
    },
    /* ================================================================ */
    /* ① 自审修订管线                                                   */
    /* ================================================================ */
    _busy: false,
    /** 每轮钩子（requestAI 接线）：按频率自动触发 */
    async onTurnComplete(reply, turnIdx) {
      var _a;
      const fw = window.storyFramework;
      const cfg = this.get();
      if (!cfg.reviewOn || !((_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.isStoryStarted)) return;
      const tc = fw.storyState.turnCount || 0;
      const every = Math.max(1, Number(cfg.reviewEvery) || 3);
      if (!tc || tc % every !== 0) return;
      await this._review(reply);
    },
    /** 手动自审（面板按钮）：审最近一章正文 */
    async reviewOnce() {
      var _a, _b, _c, _d;
      const fw = window.storyFramework;
      const hist = ((_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.conversationHistory) || [];
      let last = null;
      for (let i = hist.length - 1; i >= 0; i--) {
        if (((_b = hist[i]) == null ? void 0 : _b.role) === "assistant") {
          last = hist[i].content;
          break;
        }
      }
      if (!last) {
        (_c = window.showToast) == null ? void 0 : _c.call(window, "还没有正文可审——先写一章", "info");
        return;
      }
      await this._review(last);
      try {
        (_d = window.QualitySuite) == null ? void 0 : _d.open("review");
      } catch (e) {
      }
    },
    /** 责编质检主流程：责编官通道（责编官 → 登记官 → 主笔）评审 → 卡片 + 手记回流 */
    async _review(reply) {
      var _a, _b;
      const fw = window.storyFramework;
      if (!fw) return;
      const va = window.VariableAI;
      const hubReady = window.ChannelHub && window.ChannelHub.canCall("critic");
      if (!hubReady && !(va == null ? void 0 : va.recapReady())) {
        (_a = window.showToast) == null ? void 0 : _a.call(window, "自审需要 AI 接口：请先配置主笔接口或变量AI第三接口", "error");
        return;
      }
      if (this._busy) return;
      const body = this.extractBody(reply);
      if (body.replace(/\s/g, "").length < 200) return;
      this._busy = true;
      try {
        const v = fw.storyState.variables || {};
        const ch = v.chapter || "?";
        const msgs = [
          { role: "system", content: `你是严苛的小说责编，只质检不改写。对给出的章节正文做质检，用中文严格按以下格式输出（不要多余内容）：
评分: 0到100的整数（逻辑自洽30/人物一致30/节奏张力25/文笔质感15）
问题:
1. （每条一行，指出逻辑漏洞/人物崩坏/节奏拖沓/文笔套话，最多4条；无问题只写"无"）
建议: （一句话，下一章如何规避，30字内）` },
          { role: "user", content: `【书名《${v.title || "未命名"}》· 第 ${ch} 章 · 伏笔未回收 ${(v.foreshadowings || []).filter((f) => f.status !== "resolved").length} 条】
${body.slice(0, 6e3)}` }
        ];
        const out = hubReady ? await window.ChannelHub.call("critic", msgs) : await va.recapCall(msgs);
        const r = this.parseReview(out);
        this.renderCard(r, v.chapter);
      } catch (e) {
        console.warn("[DraftLab·自审] 失败:", e.message);
        (_b = window.StoryResponseHandler) == null ? void 0 : _b.renderSystemMessage(`🔍 责编自审失败：${e.message}（下一周期自动重试）`, "info");
      } finally {
        this._busy = false;
      }
    },
    /** 宽松解析责编输出（模型偶尔不守格式也不至于全丢） */
    parseReview(out) {
      const t = String(out || "").trim();
      const scoreM = t.match(/评分[:：]?\s*(\d{1,3})/);
      const issueBlock = (t.split(/问题[:：]/)[1] || "").split(/建议[:：]/)[0];
      const issues = [];
      issueBlock.split(/\n+/).forEach((l) => {
        const s = l.replace(/^\s*(?:\d+[.、）)]\s*)?/, "").replace(/^[-·*]\s*/, "").trim();
        if (s && s !== "无" && s.length > 3) issues.push(s);
      });
      const advice = (t.split(/建议[:：]/)[1] || "").split(/\n/)[0].trim();
      return {
        score: scoreM ? Math.min(100, Number(scoreM[1])) : null,
        issues: issues.slice(0, 4),
        advice: advice.slice(0, 60)
      };
    },
    /** 责编卡 + 手记回流（reviewNotes 取后即清，同 driftNotes 语义） */
    renderCard(r, chapter) {
      var _a;
      const fw = window.storyFramework;
      const scoreTxt = r.score != null ? `${r.score} 分${r.score >= 85 ? " 🏆" : r.score >= 75 ? " ✓" : r.score < 60 ? " ⚠" : ""}` : "—";
      const body = [
        `🔍 责编自审 · 第 ${chapter != null ? chapter : "?"} 章：${scoreTxt}`,
        r.issues.length ? r.issues.map((x, i) => `${i + 1}. ${x}`).join("\n") : "未发现明显问题",
        r.advice ? `下章规避：${r.advice}` : ""
      ].filter(Boolean).join("\n");
      (_a = window.StoryResponseHandler) == null ? void 0 : _a.renderSystemMessage(body, "info");
      if (r.issues.length || r.advice) {
        fw.storyState.reviewNotes = [...r.issues.map((i) => i.slice(0, 80)), r.advice].filter(Boolean).slice(0, 3);
      }
      const rl = fw.storyState.reviewLog || [];
      rl.push({ ch: chapter != null ? chapter : 0, score: r.score, n: r.issues.length, at: Date.now() });
      fw.storyState.reviewLog = rl.slice(-10);
      fw.saveStory();
    },
    /* ================================================================ */
    /* ② 多候选择优                                                     */
    /* ================================================================ */
    _armed: false,
    /** 创作倾向变体：差异化比温度采样噪声更有意义（callOpenAI 不支持按次覆盖温度） */
    VARIANTS: [
      { name: "基准版", tag: "", dir: "" },
      { name: "凌厉版", tag: "节奏凌厉", dir: "\n\n【本版创作倾向】节奏更凌厉：冲突前置、句式短促、砍掉铺垫直入现场。" },
      { name: "丰沛版", tag: "细节丰沛", dir: "\n\n【本版创作倾向】细节更丰沛：环境与感官细节更密、人物心理更细腻，剧情推进与其他版一致。" }
    ],
    multiArmed() {
      return this._armed;
    },
    armMulti(on) {
      var _a, _b;
      this._armed = on === void 0 ? !this._armed : !!on;
      (_a = window.showToast) == null ? void 0 : _a.call(window, this._armed ? `🎯 多候选已武装：下一轮指令将并行生成 ${Math.min(3, Math.max(2, this.get().multiN || 3))} 版供择优` : "已解除多候选武装", "info");
      try {
        (_b = window.QualitySuite) == null ? void 0 : _b.open("multi");
      } catch (e) {
      }
    },
    /** 本地速评（启发式：字数区间/对话占比/句密度——仅排序参考，不是真理） */
    quickScore(t) {
      const body = this.extractBody(t);
      const len = body.replace(/\s/g, "").length;
      const dlgs = body.match(/[「『“"][^」』”"]{2,}[」』”"]/g) || [];
      const dlg = len ? Math.round(dlgs.reduce((s2, d) => s2 + d.length, 0) / len * 100) : 0;
      const sents = body.split(/[。！？…!?]+/).filter((s2) => s2.trim()).length;
      let s = 50;
      if (len >= 800 && len <= 3e3) s += 25;
      else if (len > 3e3) s += 15;
      else if (len >= 400) s += 10;
      if (dlg >= 15 && dlg <= 55) s += 15;
      else if (dlg > 0) s += 5;
      if (sents >= 10) s += 10;
      return { score: Math.min(99, s), len, dlg };
    },
    /**
     * 并行多候选（requestAI 接线：武装时替代单发 callStoryAI）。
     * 变体只附加在"本轮指令"段——历史里已是干净版指令，存档零污染。
     * @returns {Promise<string>} 玩家选定的版本
     */
    async runMulti(message) {
      var _a, _b;
      const n = Math.min(3, Math.max(2, Number(this.get().multiN) || 3));
      const vs = this.VARIANTS.slice(0, n);
      this._armed = false;
      (_a = window.StoryResponseHandler) == null ? void 0 : _a.renderSystemMessage(`🎯 多候选择优：并行生成 ${n} 版（${vs.map((v) => v.name).join(" / ")}），完成后请在弹窗中择优…`, "info");
      /* v3.38.1 兼容：Promise.allSettled 需 Chrome 76+，旧内核无此方法——
         用 then 双回调手工模拟 allSettled（任何一版失败不拖垮其余并行候选） */
      const settled = await Promise.all(vs.map((v) => callStoryAI(message + v.dir, false, {}).then(
        (value) => ({ status: "fulfilled", value }),
        (reason) => ({ status: "rejected", reason })
      )));
      const drafts = [];
      settled.forEach((s, i) => {
        var _a2;
        if (s.status === "fulfilled" && String(s.value || "").trim()) {
          drafts.push({ name: vs[i].name, tag: vs[i].tag, text: String(s.value).trim() });
        } else if (s.status === "rejected") {
          console.warn(`[DraftLab·多候选] ${vs[i].name} 生成失败:`, (_a2 = s.reason) == null ? void 0 : _a2.message);
        }
      });
      if (!drafts.length) throw new Error("全部候选版生成失败（接口异常）");
      if (drafts.length === 1) {
        (_b = window.showToast) == null ? void 0 : _b.call(window, `仅 1 版成功（其余失败），直接采用`, "info");
        return drafts[0].text;
      }
      return await this._choose(drafts);
    },
    /** 择优弹窗：速评参考 + 全文预览 + 采用/放弃 */
    _choose(drafts) {
      return new Promise((resolve, reject) => {
        const cards = drafts.map((d, i) => {
          const q = this.quickScore(d.text);
          const body = this.extractBody(d.text);
          return `<div class="dl-card">
                        <div class="dl-card-head">
                            <b>${this.esc(d.name)}</b>
                            <span class="dl-q">${q.score} 速评 · ${q.len} 字 · 对话 ${q.dlg}%</span>
                        </div>
                        <div class="dl-prev" id="dlPrev${i}">${this.esc(body.slice(0, 380))}${body.length > 380 ? `……<span class="dl-more" onclick="document.getElementById('dlFull` + i + "').style.display='block';document.getElementById('dlPrev" + i + `').style.display='none'">展开全文</span>` : ""}</div>
                        <pre class="dl-full" id="dlFull${i}" style="display:none">${this.esc(body)}</pre>
                        <button class="dl-pick" onclick="DraftLab._pick(${i})">✓ 采用此版</button>
                    </div>`;
        }).join("");
        const html = `
                <div class="dl-overlay">
                    <div class="dl-modal">
                        <div class="dl-head">
                            <b>🎯 多候选择优 · ${drafts.length} 版已就绪</b>
                            <button class="dl-x" onclick="DraftLab._abandon()">✕</button>
                        </div>
                        <div class="dl-body">
                            <p class="dl-tip">速评是本地启发式（字数区间/对话占比/句密度），仅作排序参考——<b>以你的阅读直觉为准</b>。择优后正常登记变量、触发灵感与世界动态。</p>
                            ${cards}
                        </div>
                        <div class="dl-foot">
                            <button class="dl-abandon" onclick="DraftLab._abandon()">✕ 放弃全部（还原本轮）</button>
                        </div>
                    </div>
                </div>`;
        const old = document.getElementById("dlModal");
        if (old) old.remove();
        const wrap = document.createElement("div");
        wrap.id = "dlModal";
        wrap.innerHTML = html;
        document.body.appendChild(wrap);
        this._pending = { drafts, resolve, reject };
      });
    },
    _pick(i) {
      var _a, _b;
      const p = this._pending;
      if (!p || !p.drafts[i]) return;
      (_a = document.getElementById("dlModal")) == null ? void 0 : _a.remove();
      this._pending = null;
      (_b = window.showToast) == null ? void 0 : _b.call(window, `✅ 已采用「${p.drafts[i].name}」（其余 ${p.drafts.length - 1} 版已弃）`, "success");
      p.resolve(p.drafts[i].text);
    },
    _abandon() {
      var _a;
      const p = this._pending;
      (_a = document.getElementById("dlModal")) == null ? void 0 : _a.remove();
      this._pending = null;
      if (p) p.reject(new Error("已放弃全部候选版，本轮还原"));
    },
    /* ==================== 质检面板页签（注册进 QualitySuite） ==================== */
    _reviewTabHTML() {
      var _a, _b;
      const fw = window.storyFramework;
      const cfg = this.get();
      const va = window.VariableAI;
      const hub = window.ChannelHub;
      const channel = (hub == null ? void 0 : hub.canCall("critic")) ? `责编官链（${hub.chainText("critic")}，当前走：${((_a = hub.resolveUsed("critic")) == null ? void 0 : _a.name) || "自动"}）` : (va == null ? void 0 : va.isEnabled()) ? "第三接口（变量AI）" : (va == null ? void 0 : va.recapReady()) ? "主笔接口兜底" : "未配置";
      const rl = (((_b = fw == null ? void 0 : fw.storyState) == null ? void 0 : _b.reviewLog) || []).slice().reverse();
      const rows = rl.map((r) => `<tr><td>第 ${r.ch} 章</td><td>${r.score != null ? r.score : "—"}</td><td>${r.n} 条</td></tr>`).join("");
      const opts = [2, 3, 5].map((n) => `<option value="${n}" ${cfg.reviewEvery == n ? "selected" : ""}>每 ${n} 轮</option>`).join("");
      return `
            <label class="qs-switch"><input type="checkbox" ${cfg.reviewOn ? "checked" : ""} onchange="DraftLab.setCfg('reviewOn',this.checked)"><i></i><span>责编自审（每 N 轮自动质检，消耗接口调用）</span></label>
            <p class="qs-tip">刚完成的章节交给独立通道当"责编"评审：评分 + 问题清单 + 规避建议。问题自动存为
            <b>责编手记</b>，下一轮回流提示词（取后即清）。通道：${channel}。<b>默认关闭——每 N 轮多一次接口调用。</b></p>
            <div class="dl-row">
                <label class="dl-lab">自审频率</label>
                <select class="dl-sel" onchange="DraftLab.setCfg('reviewEvery',Number(this.value))">${opts}</select>
                <button class="dl-btn" onclick="DraftLab.reviewOnce()">🔍 立即自审最近一章</button>
            </div>
            ${rows ? `<table class="qs-table"><thead><tr><th>章节</th><th>评分</th><th>问题</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="qs-empty">开启后每 N 轮自动评审，历史成绩在此留痕</div>'}`;
    },
    _multiTabHTML() {
      const cfg = this.get();
      const armed = this._armed;
      const opts = [2, 3].map((n2) => `<option value="${n2}" ${cfg.multiN == n2 ? "selected" : ""}>${n2} 版</option>`).join("");
      const n = Math.min(3, Math.max(2, cfg.multiN || 3));
      return `
            <div class="dl-row" style="margin-bottom:10px;">
                <button class="dl-btn ${armed ? "armed" : ""}" onclick="DraftLab.armMulti()">${armed ? "✓ 已武装——下一轮生效（点此解除）" : "🎯 下一轮启用多候选"}</button>
                <label class="dl-lab">候选数</label>
                <select class="dl-sel" onchange="DraftLab.setCfg('multiN',Number(this.value))">${opts}</select>
            </div>
            <p class="qs-tip">关键章节（高潮/转折/开篇）值得多花接口费：并行生成 ${n} 版——<b>基准版 / 节奏凌厉版 / 细节丰沛版</b>（n=2 时取前两版），
            弹窗速评预览择优，弃版即弃。变体只附加本轮指令，<b>存档历史零污染</b>；按次武装，用完自动解除。
            <b>每轮成本 ×${n}，慎用于日常推进。</b></p>
            <div class="qs-empty">点击上方按钮武装 → 正常发送指令 → 弹窗择优</div>`;
    },
    setCfg(k, v) {
      var _a, _b;
      this.save({ [k]: v });
      (_a = window.showToast) == null ? void 0 : _a.call(window, "已保存", "info");
      try {
        (_b = window.QualitySuite) == null ? void 0 : _b.open(k === "multiN" ? "multi" : "review");
      } catch (e) {
      }
    },
    /* ==================== 启动：挂页签 + 样式 ==================== */
    init() {
      const qs = window.QualitySuite;
      if (qs && qs.registerTab) {
        qs.registerTab("review", "🔍", "责编自审", () => this._reviewTabHTML());
        qs.registerTab("multi", "🎯", "多候选择优", () => this._multiTabHTML());
      }
      if (!document.getElementById("dlStyle")) {
        const st = document.createElement("style");
        st.id = "dlStyle";
        st.textContent = `
.dl-overlay{position:fixed;inset:0;background:rgba(0,0,0,.66);backdrop-filter:blur(3px);z-index:9992;display:flex;align-items:center;justify-content:center;padding:18px}
.dl-modal{width:min(760px,94vw);max-height:86vh;display:flex;flex-direction:column;background:linear-gradient(160deg,#1d1a15,#141210);border:1px solid #c9a86a45;border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.6);overflow:hidden}
.dl-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #c9a86a25}
.dl-head b{color:#e8dcc0;font-size:15px;letter-spacing:1px}
.dl-x{background:none;border:none;color:#9a8c6e;font-size:16px;cursor:pointer;padding:4px 8px}
.dl-x:hover{color:#e8dcc0}
.dl-body{padding:14px 18px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:12px}
.dl-tip{font-size:12px;line-height:1.8;color:#9a8c6e;margin:0}
.dl-tip b{color:#d8cba8}
.dl-card{background:#c9a86a0d;border:1px solid #c9a86a28;border-radius:12px;padding:12px 14px}
.dl-card-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.dl-card-head b{color:#e8dcc0;font-size:13.5px}
.dl-q{font-size:11.5px;color:#c9a86a;background:#c9a86a15;border-radius:12px;padding:3px 10px}
.dl-prev{font-size:12.5px;line-height:2;color:#d8cba8;max-height:180px;overflow:hidden;position:relative}
.dl-more{display:block;color:#c9a86a;cursor:pointer;font-size:11.5px;margin-top:6px}
.dl-more:hover{text-decoration:underline}
.dl-full{font-family:inherit;font-size:12.5px;line-height:2;color:#d8cba8;white-space:pre-wrap;max-height:320px;overflow-y:auto;background:rgba(0,0,0,.3);border-radius:8px;padding:10px;margin:0}
.dl-pick{margin-top:10px;width:100%;background:#c9a86a20;border:1px solid #c9a86a66;color:#e8dcc0;border-radius:9px;padding:9px 0;font-size:13px;cursor:pointer;letter-spacing:2px}
.dl-pick:hover{background:#c9a86a38}
.dl-foot{display:flex;justify-content:center;padding:12px 18px;border-top:1px solid #c9a86a25}
.dl-abandon{background:none;border:1px solid #6e6a5e55;color:#9a8c6e;border-radius:9px;padding:8px 18px;font-size:12px;cursor:pointer}
.dl-abandon:hover{color:#e07070;border-color:#e0707066}
.dl-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.dl-lab{font-size:12px;color:#9a8c6e}
.dl-sel{background:#1d1a15;border:1px solid #c9a86a45;color:#d8cba8;border-radius:8px;padding:6px 10px;font-size:12px;outline:none}
.dl-btn{background:#c9a86a18;border:1px solid #c9a86a55;color:#c9a86a;border-radius:9px;padding:8px 16px;font-size:12.5px;cursor:pointer;letter-spacing:1px}
.dl-btn:hover{background:#c9a86a2a}
.dl-btn.armed{background:#c9a86a38;border-color:#c9a86aaa;color:#e8dcc0}`;
        document.head.appendChild(st);
      }
    }
  };
  DraftLab.init();
  window.DraftLab = DraftLab;
})();
