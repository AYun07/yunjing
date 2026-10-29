(function() {
  "use strict";
  const RecapEngine = {
    esc(s) {
      return String(s != null ? s : "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    },
    /** digest 快照（无则空壳） */
    snap() {
      var _a, _b;
      const fw = window.storyFramework;
      const d = ((_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.digest) || {};
      const hist = ((_b = fw == null ? void 0 : fw.storyState) == null ? void 0 : _b.conversationHistory) || [];
      return {
        summary: d.summary || "",
        upTo: Number(d.upToIndex) || 0,
        total: hist.length
      };
    },
    /** 手动重压：把窗口外积压立即并入（不等 BATCH 阈值；至少积压 2 条才值得调用） */
    async regenerate() {
      var _a, _b, _c, _d, _e;
      const va = window.VariableAI;
      const fw = window.storyFramework;
      if (!va || !fw) return;
      if (!va.recapReady()) {
        (_a = window.showToast) == null ? void 0 : _a.call(window, "请先配置 AI 接口（接口设置）", "error");
        return;
      }
      const btn = document.getElementById("recapRegenBtn");
      if (btn) {
        btn.disabled = true;
        btn.textContent = "⏳ 压缩中…";
      }
      try {
        const hist = fw.storyState.conversationHistory || [];
        const digest = fw.storyState.digest || {};
        const KEEP = 16, BATCH = 2;
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
        if (end - covered < BATCH) {
          (_c = window.showToast) == null ? void 0 : _c.call(window, "暂无积压：最近 8 轮之外的旧剧情都已压缩过了", "info");
          return;
        }
        const older = hist.slice(covered, end);
        const text = older.map(
          (m) => (m.role === "user" ? "【指令】" : "【正文】") + va._trimForSummary(String(m.content || ""))
        ).join("\n");
        const prev = digest.summary ? `【已有摘要（把新内容并入其中，重写为一段）】
${digest.summary}

` : "";
        const out = await va.recapCall([
          { role: "system", content: `你是小说工坊的"前情提要官"。请把已有摘要与新内容合并，输出一段不超过 400 字的连贯前情提要（第三人称、按时间顺序）。必须保留：主线关键进展、人物登场与关系变化、未回收的伏笔与悬念、关键道具得失、当前所处危机。删除：重复信息与次要场景细节。只输出提要正文，不要标题、不要解释。` },
          { role: "user", content: `${prev}【新内容（待并入摘要）】
${text}` }
        ]);
        const summary = String(out || "").trim().slice(0, 600);
        if (!summary) throw new Error("压缩返回为空");
        const anchorMsg = hist[end];
        fw.storyState.digest = {
          summary,
          upToIndex: end,
          anchor: anchorMsg ? String(anchorMsg.content || "").slice(0, 80) : void 0
        };
        fw.saveStory();
        (_d = window.showToast) == null ? void 0 : _d.call(window, `✅ 已压缩 ${older.length} 条旧剧情入前情提要`, "success");
        this.open();
      } catch (e) {
        (_e = window.showToast) == null ? void 0 : _e.call(window, `压缩失败：${e.message}`, "error");
        if (btn) {
          btn.disabled = false;
          btn.textContent = "⚡ 立即压缩积压";
        }
      }
    },
    /** 保存亲笔修订的摘要文本 */
    saveEdit() {
      var _a, _b;
      const fw = window.storyFramework;
      const ta = document.getElementById("recapEditor");
      if (!fw || !ta) return;
      const text = ta.value.trim();
      if (!text) {
        (_a = window.showToast) == null ? void 0 : _a.call(window, "摘要不能为空", "error");
        return;
      }
      fw.storyState.digest = { ...fw.storyState.digest || {}, summary: text.slice(0, 2e3) };
      fw.saveStory();
      (_b = window.showToast) == null ? void 0 : _b.call(window, "✅ 前情提要已更新（AI 每轮都会看到这段）", "success");
      this.open();
    },
    open() {
      var _a, _b;
      const s = this.snap();
      const covered = s.total ? Math.min(s.upTo, s.total) : 0;
      const pct = s.total ? Math.round(covered / s.total * 100) : 0;
      const va = window.VariableAI;
      const channel = (va == null ? void 0 : va.isEnabled()) ? "第三接口（变量AI）" : (va == null ? void 0 : va.recapReady()) ? "主笔接口兜底" : "未配置";
      const hist = ((_b = (_a = window.storyFramework) == null ? void 0 : _a.storyState) == null ? void 0 : _b.conversationHistory) || [];
      const KEEP = 16;
      const backlog = Math.max(0, hist.length - KEEP - covered);
      const html = `
            <div class="rp-overlay" onclick="if(event.target===this)RecapEngine.close()">
                <div class="rp-modal">
                    <div class="rp-head">
                        <b>📖 前情提要 · AI 的长篇记忆</b>
                        <button class="rp-x" onclick="RecapEngine.close()">✕</button>
                    </div>
                    <div class="rp-body">
                        <div class="rp-meta">
                            <span>已压缩 <b>${covered}</b> / ${s.total} 条历史</span>
                            <span>· 覆盖率 <b>${pct}%</b></span>
                            <span>· 待压缩积压 <b>${backlog}</b> 条</span>
                            <span>· 通道：${channel}</span>
                        </div>
                        <div class="rp-bar"><i style="width:${pct}%;"></i></div>
                        <p class="rp-tip">滑动窗口（最近 8 轮）之外的旧剧情，AI 只能通过下面这段摘要记得。
                        压缩会自动进行（积压约 4 轮触发一次）；也可以立即压缩或亲笔修订——
                        <b>怕压丢的关键伏笔，直接写进去，每一轮正文都会带着它写。</b></p>
                        <textarea id="recapEditor" class="rp-editor" placeholder="${s.summary ? "" : "尚无摘要——开写几轮后自动生成，或点下方「立即压缩积压」"}">${this.esc(s.summary)}</textarea>
                    </div>
                    <div class="rp-foot">
                        <button class="rp-btn" id="recapRegenBtn" onclick="RecapEngine.regenerate()">⚡ 立即压缩积压</button>
                        <button class="rp-btn primary" onclick="RecapEngine.saveEdit()">💾 保存修订</button>
                    </div>
                </div>
            </div>`;
      const old = document.getElementById("recapModal");
      if (old) old.remove();
      const wrap = document.createElement("div");
      wrap.id = "recapModal";
      wrap.innerHTML = html;
      document.body.appendChild(wrap);
    },
    close() {
      var _a;
      (_a = document.getElementById("recapModal")) == null ? void 0 : _a.remove();
    }
  };
  if (!document.getElementById("recapStyle")) {
    const st = document.createElement("style");
    st.id = "recapStyle";
    st.textContent = `
.rp-overlay{position:fixed;inset:0;background:rgba(0,0,0,.62);backdrop-filter:blur(3px);z-index:9990;display:flex;align-items:center;justify-content:center;padding:18px}
.rp-modal{width:min(680px,94vw);max-height:86vh;display:flex;flex-direction:column;background:linear-gradient(160deg,#211d17,#17140f);border:1px solid #c9a86a45;border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.6);overflow:hidden}
.rp-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #c9a86a25}
.rp-head b{color:#e8dcc0;font-size:15px;letter-spacing:1px}
.rp-x{background:none;border:none;color:#9a8c6e;font-size:16px;cursor:pointer;padding:4px 8px}
.rp-x:hover{color:#e8dcc0}
.rp-body{padding:16px 18px;overflow-y:auto;flex:1}
.rp-meta{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12px;color:#9a8c6e;margin-bottom:8px}
.rp-meta b{color:#c9a86a}
.rp-bar{height:5px;border-radius:3px;background:#c9a86a1e;overflow:hidden;margin-bottom:12px}
.rp-bar i{display:block;height:100%;background:linear-gradient(90deg,#8a744a,#c9a86a);transition:width .5s}
.rp-tip{font-size:12px;line-height:1.8;color:#9a8c6e;margin:0 0 10px}
.rp-tip b{color:#d8cba8}
.rp-editor{width:100%;box-sizing:border-box;min-height:240px;background:rgba(0,0,0,.35);border:1px solid #c9a86a38;border-radius:10px;color:#e8dcc0;font-size:13px;line-height:1.9;padding:12px 14px;resize:vertical;outline:none;font-family:inherit}
.rp-editor:focus{border-color:#c9a86a88}
.rp-foot{display:flex;gap:10px;justify-content:flex-end;padding:12px 18px;border-top:1px solid #c9a86a25}
.rp-btn{background:#c9a86a18;border:1px solid #c9a86a55;color:#c9a86a;border-radius:9px;padding:8px 16px;font-size:12.5px;cursor:pointer;letter-spacing:1px}
.rp-btn:hover{background:#c9a86a2a}
.rp-btn.primary{background:#c9a86a2a;border-color:#c9a86a99}
.rp-btn:disabled{opacity:.5;cursor:wait}`;
    document.head.appendChild(st);
  }
  window.RecapEngine = RecapEngine;
})();
