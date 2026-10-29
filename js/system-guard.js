(function() {
  "use strict";
  const NIGHT_KEY = "storyNightMode";
  const SystemGuard = {
    esc(s) {
      return String(s != null ? s : "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    },
    /* ==================== ① 上下文预算条 ==================== */
    /** 注入输入区上方的预算条 DOM（幂等） */
    mount() {
      if (document.getElementById("sgBudgetBar")) return;
      const area = document.querySelector(".input-area");
      if (!area) {
        setTimeout(() => this.mount(), 600);
        return;
      }
      const bar = document.createElement("div");
      bar.id = "sgBudgetBar";
      bar.className = "sg-budget";
      bar.title = "上下文预算占用（点击看明细）";
      bar.onclick = () => this.budgetDetail();
      area.insertBefore(bar, area.querySelector(".input-row"));
      this.refreshBudget();
      this.mountHook();
    },
    /** monkey-patch updateStatusPanel：每轮面板刷新后预算条同步（幂等） */
    mountHook() {
      if (this._hooked) return;
      const patch = () => {
        const fw = window.storyFramework;
        if (!fw || !fw.updateStatusPanel || fw.__sgPatched) return false;
        const orig = fw.updateStatusPanel.bind(fw);
        fw.updateStatusPanel = function() {
          var _a, _b;
          const r = orig();
          try {
            (_b = (_a = window.SystemGuard) == null ? void 0 : _a.refreshBudget) == null ? void 0 : _b.call(_a);
          } catch (e) {
          }
          return r;
        };
        fw.__sgPatched = true;
        return true;
      };
      if (patch()) {
        this._hooked = true;
        return;
      }
      let tries = 0;
      const t = setInterval(() => {
        if (patch() || ++tries > 40) {
          this._hooked = true;
          clearInterval(t);
        }
      }, 500);
    },
    /** 刷新预算条（消费 PromptBudget.lastReport） */
    refreshBudget() {
      var _a;
      const bar = document.getElementById("sgBudgetBar");
      if (!bar) return;
      const rep = window.PromptBudget && PromptBudget.lastReport || null;
      if (!rep || !rep.total || !rep.limit) {
        bar.innerHTML = '<span class="sg-budget-hint">上下文：待首笔后记账</span>';
        bar.classList.remove("warn", "danger");
        return;
      }
      const pct = Math.min(1, rep.total / rep.limit);
      const segs = (rep.segs || []).slice(0, 6);
      bar.innerHTML = segs.map((s) => {
        const w = s.chars / rep.limit * 100;
        return `<span class="sg-seg" style="width:${w.toFixed(2)}%" title="${this.esc(s.label)} ${s.chars.toLocaleString()} 字"></span>`;
      }).join("") + (pct >= 0.8 ? `<span class="sg-budget-num">${Math.round(pct * 100)}%</span>` : "");
      bar.classList.toggle("warn", pct >= 0.8 && pct < 0.93);
      bar.classList.toggle("danger", pct >= 0.93);
      if (pct >= 0.93 && !this._overflowShown) {
        this._overflowShown = true;
        (_a = window.showToast) == null ? void 0 : _a.call(window, `⚠️ 上下文已占 ${Math.round(pct * 100)}%——建议去「前情提要」压缩历史，或减小知识库注入`, "error");
      }
      if (pct < 0.93) this._overflowShown = false;
    },
    /** 预算明细浮层 */
    budgetDetail() {
      var _a, _b;
      const rep = window.PromptBudget && PromptBudget.lastReport || null;
      if (!rep || !rep.total) {
        (_a = window.showToast) == null ? void 0 : _a.call(window, "尚无记账——发送第一笔指令后出账", "info");
        return;
      }
      const pct = Math.round(Math.min(1, rep.total / rep.limit) * 100);
      const rows = (rep.segs || []).map((s) => {
        const p = Math.round(s.chars / rep.limit * 100);
        return `<div class="sg-row"><span class="sg-l">${this.esc(s.label)}</span>
                    <div class="sg-track"><span class="sg-fill" style="width:${p}%"></span></div>
                    <span class="sg-v">${s.chars.toLocaleString()} 字 · ${p}%</span></div>`;
      }).join("");
      const trimmed = (rep.trimmed || []).length ? `<div class="sg-warn">本次已自动瘦身 ${rep.trimmed.length} 段：${rep.trimmed.map((t) => this.esc(String(t).slice(0, 20))).join("、")}</div>` : "";
      (_b = document.getElementById("sgDetail")) == null ? void 0 : _b.remove();
      const w = document.createElement("div");
      w.id = "sgDetail";
      w.innerHTML = `
            <div class="sg-overlay" onclick="if(event.target===this)document.getElementById('sgDetail').remove()">
                <div class="sg-modal">
                    <div class="sg-mhead"><b>📦 上下文预算明细</b><span class="sg-msub">总计 ${rep.total.toLocaleString()} / ${rep.limit.toLocaleString()} 字 · ${pct}%</span>
                        <button class="sg-x" onclick="document.getElementById('sgDetail').remove()">✕</button></div>
                    <div class="sg-mbody">${rows}${trimmed}
                        <div class="sg-note">瘦身顺序：知识库背景 → 前景检索 → 反八股 → 旧历史 → 场域注记 → 前情摘要；系统提示词 / 设定卡 / 本轮指令永不裁。想主动瘦身：「☰ 工具箱 → 📖 前情提要」压缩历史，或减小知识库注入范围。</div>
                    </div>
                </div>
            </div>`;
      document.body.appendChild(w);
    },
    /* ==================== ② 存档体检 ==================== */
    /** localStorage 逐键占用（KB），降序 */
    lsUsage() {
      const out = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          const v = localStorage.getItem(k) || "";
          out.push({ key: k, bytes: v.length * 2 });
        }
      } catch (e) {
      }
      return out.sort((a, b) => b.bytes - a.bytes);
    },
    /** 世界书（知识库）缓存占用：每界一个 storyKnowledge_<genre> 键 */
    kbCache() {
      const list = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k || k.indexOf("storyKnowledge_") !== 0) continue;
          const v = localStorage.getItem(k) || "";
          list.push({ key: k, genre: k.slice("storyKnowledge_".length), bytes: v.length * 2 });
        }
      } catch (e) {
      }
      list.sort((a, b) => b.bytes - a.bytes);
      const cur = (window.StoryKnowledge && window.StoryKnowledge.genre) || "";
      return { list, cur, total: list.reduce((s, x) => s + x.bytes, 0) };
    },
    /** 清理「其它世界」的世界书缓存（当前所在世界一律保留）；预置条目下次进界会自动补回 */
    async cleanupKBCache() {
      const r = this.kbCache();
      const others = r.list.filter((x) => x.genre !== r.cur);
      if (!others.length) {
        window.showToast && window.showToast("没有可清理的其它世界缓存", "info");
        return;
      }
      const mb = (others.reduce((s, x) => s + x.bytes, 0) / 1048576).toFixed(2);
      const ok = await window.UIDialog.confirm({
        title: "清理世界书缓存",
        message: `将清空 ${others.length} 个「其它世界」的世界书缓存，释放约 ${mb} MB。\n\n当前所在世界（${r.cur}）不受影响；其它世界的预置条目下次进入该世界时会自动补回，但这些世界里的自建条目与改动会被清除。`,
        confirmText: "确认清理"
      });
      if (!ok) return;
      let n = 0;
      others.forEach((x) => {
        try { localStorage.removeItem(x.key); n++; } catch (e) { }
      });
      window.showToast && window.showToast(`✓ 已清理 ${n} 个世界的缓存，释放约 ${mb} MB`, "success");
      document.getElementById("sgCheckup") && document.getElementById("sgCheckup").remove();
      this.openCheckup();
    },
    /** 体检报告（estimate 可能不可用，逐项降级） */
    async checkup() {
      const ls = this.lsUsage();
      const lsTotal = ls.reduce((s, x) => s + x.bytes, 0);
      let quota = null, used = null;
      try {
        if (navigator.storage && navigator.storage.estimate) {
          const est = await navigator.storage.estimate();
          quota = est.quota || null;
          used = est.usage || null;
        }
      } catch (e) {
      }
      const fw = window.storyFramework;
      const saveKey = (fw == null ? void 0 : fw.SAVE_KEY) || (fw == null ? void 0 : fw.saveKey);
      let saveOK = null, saveBytes = 0;
      if (saveKey) {
        try {
          const raw = localStorage.getItem(saveKey);
          saveBytes = (raw || "").length * 2;
          const d = JSON.parse(raw || "null");
          saveOK = !!(d && d.conversationHistory && d.variables);
        } catch (e) {
          saveOK = false;
        }
      }
      return { ls, lsTotal, quota, used, saveOK, saveBytes };
    },
    async openCheckup() {
      var _a;
      const r = await this.checkup();
      const lsKB = (r.lsTotal / 1024).toFixed(1);
      const top = r.ls.slice(0, 8).map((x) => `
                <div class="sg-row"><span class="sg-l">${this.esc(String(x.key).slice(0, 26))}</span>
                    <span class="sg-v">${(x.bytes / 1024).toFixed(1)} KB</span></div>`).join("");
      const saveChip = r.saveOK === null ? "" : r.saveOK ? `<span class="sg-chip ok">💾 主存档完好（${(r.saveBytes / 1024).toFixed(1)} KB）</span>` : `<span class="sg-chip bad">💾 主存档异常：JSON 损坏或字段缺失——请立即「导出存档」抢救，再尝试导入修复</span>`;
      /* 配额条：Chrome 的 navigator.storage.estimate().quota 是整个源（含 IndexedDB）的
         磁盘配额，常见一两百 GB——直接拿来当分母会显示「0.2 / 157286 MB」，对玩家毫无意义。
         超过 200MB 说明是整源配额，改用 localStorage 自身的参考线（各内核 5–10MB）来画。 */
      const LS_REF = 10 * 1048576;
      const showQuota = r.quota && r.quota <= 200 * 1048576;
      const barPct = showQuota ? Math.min(1, (r.used || 0) / r.quota) : Math.min(1, r.lsTotal / LS_REF);
      const bar = `
                <div class="sg-quota-row">
                    <div class="sg-track big"><span class="sg-fill ${barPct > 0.85 ? "hot" : ""}" style="width:${(barPct * 100).toFixed(1)}%"></span></div>
                    <span class="sg-v">${showQuota ? `${((r.used || 0) / 1048576).toFixed(1)} / ${(r.quota / 1048576).toFixed(0)} MB` : `${(r.lsTotal / 1048576).toFixed(2)} / 10 MB`}</span>
                </div>` + (showQuota ? "" : '<div class="sg-note">浏览器 localStorage 上限约 5–10 MB（内核而异），此处以 10 MB 为参考线；本应用的大件立绘走 IndexedDB，不占这条线。</div>');
      const warn = barPct > 0.85 ? `<div class="sg-warn">⚠️ 存储占用偏高——建议「导出存档」留备份，清理旧书架槽位（书架内长按可删），并清理其它世界的世界书缓存。</div>` : "";
      const kbc = this.kbCache();
      const kbOthers = kbc.list.filter((x) => x.genre !== kbc.cur);
      const kbSec = kbc.list.length ? `
                        <div class="sg-sec">世界书缓存（${kbc.list.length} 个世界 · 合计 ${(kbc.total / 1048576).toFixed(2)} MB）</div>
                        <div class="sg-chips">
                            <span class="sg-chip">📖 当前世界 <b>${this.esc(kbc.cur || "-")}</b> ${((kbc.list.find((x) => x.genre === kbc.cur) || { bytes: 0 }).bytes / 1024).toFixed(0)} KB</span>
                            <span class="sg-chip">🗂 其它世界 ${kbOthers.length} 个 · ${(kbOthers.reduce((s, x) => s + x.bytes, 0) / 1048576).toFixed(2)} MB</span>
                        </div>
                        ${kbOthers.length ? `<button class="sg-btn" onclick="SystemGuard.cleanupKBCache()">🧹 清理其它世界的世界书缓存</button>
                        <div class="sg-note">只删「其它世界」的缓存，当前世界一律保留；预置条目下次进界自动补回，各世界的自建条目会一并清除。存储快满时这是最有效的腾挪手段。</div>` : '<div class="sg-note">只有当前世界的缓存，无需清理。</div>'}` : "";
      (_a = document.getElementById("sgCheckup")) == null ? void 0 : _a.remove();
      const w = document.createElement("div");
      w.id = "sgCheckup";
      w.innerHTML = `
            <div class="sg-overlay" onclick="if(event.target===this)document.getElementById('sgCheckup').remove()">
                <div class="sg-modal">
                    <div class="sg-mhead"><b>🛡 存档体检</b><span class="sg-msub">localStorage 合计 ${lsKB} KB · ${r.ls.length} 键</span>
                        <button class="sg-x" onclick="document.getElementById('sgCheckup').remove()">✕</button></div>
                    <div class="sg-mbody">
                        <div class="sg-sec">存储配额</div>
                        ${bar}${warn}
                        <div class="sg-chips">${saveChip}
                            <span class="sg-chip">📦 localStorage ${lsKB} KB / ${r.ls.length} 键</span>
                        </div>
                        <div class="sg-sec">占用排行（前 8）</div>
                        ${top || '<div class="sg-note">无本地数据。</div>'}
                        ${kbSec}
                        <div class="sg-note">体检只读不写；「导出存档」在状态面板底部随时可做全量备份。</div>
                    </div>
                </div>
            </div>`;
      document.body.appendChild(w);
    },
    /* ==================== ③ 深夜护眼 ==================== */
    nightOn() {
      try {
        const v = localStorage.getItem(NIGHT_KEY);
        if (v != null) return v === "1";
        return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
      } catch (e) {
        return false;
      }
    },
    applyNight() {
      document.body.classList.toggle("night", this.nightOn());
    },
    toggleNight() {
      var _a;
      const on = !this.nightOn();
      try {
        localStorage.setItem(NIGHT_KEY, on ? "1" : "0");
      } catch (e) {
      }
      this.applyNight();
      (_a = window.showToast) == null ? void 0 : _a.call(window, on ? "🌙 深夜护眼已开启（暖光 · 低动效）" : "☀️ 深夜护眼已关闭", "info");
      return on;
    }
  };
  if (!document.getElementById("systemGuardStyle")) {
    const st = document.createElement("style");
    st.id = "systemGuardStyle";
    st.textContent = `
/* ① 预算条：输入区上方 5px 分段细条 */
.sg-budget{display:flex;align-items:center;height:16px;margin:0 2px 5px;border-radius:4px;background:rgba(0,0,0,.3);border:1px solid #c9a86a22;overflow:hidden;cursor:pointer;position:relative;transition:border-color .2s}
.sg-budget:hover{border-color:#c9a86a55}
.sg-seg{height:4px;margin-top:0;flex:0 0 auto;opacity:.75}
.sg-seg:nth-child(5n+1){background:#c9a86a}
.sg-seg:nth-child(5n+2){background:#7a98b8}
.sg-seg:nth-child(5n+3){background:#a88ab8}
.sg-seg:nth-child(5n+4){background:#8ab898}
.sg-seg:nth-child(5n+5){background:#b8987a}
.sg-budget-hint{font-size:9.5px;color:#8a7d63;padding:0 8px;letter-spacing:1px}
.sg-budget-num{position:absolute;right:5px;top:0;font-size:9px;color:#e8c87a;line-height:16px;text-shadow:0 0 4px #000}
.sg-budget.warn{border-color:#e0a84c88}
.sg-budget.warn .sg-seg{opacity:.9}
.sg-budget.danger{border-color:#e07070aa;box-shadow:0 0 8px #e0707044}
.sg-budget.danger .sg-seg{filter:saturate(1.4) brightness(1.15)}
/* ② 体检 / 明细浮层 */
.sg-overlay{position:fixed;inset:0;background:rgba(0,0,0,.62);backdrop-filter:blur(3px);z-index:9993;display:flex;align-items:center;justify-content:center;padding:18px}
.sg-modal{width:min(560px,94vw);max-height:82vh;display:flex;flex-direction:column;background:linear-gradient(160deg,#211d17,#17140f);border:1px solid #c9a86a45;border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.6);overflow:hidden;animation:sgIn .3s ease both}
@keyframes sgIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.sg-mhead{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid #c9a86a25}
.sg-mhead b{color:#e8dcc0;font-size:15px;letter-spacing:1px}
.sg-msub{font-size:11px;color:#9a8c6e;margin-right:auto}
.sg-x{background:none;border:none;color:#9a8c6e;font-size:16px;cursor:pointer;padding:4px 8px}
.sg-x:hover{color:#e8dcc0}
.sg-mbody{padding:14px 18px 18px;overflow-y:auto;flex:1}
.sg-sec{font-size:11px;color:#c9a86a;letter-spacing:2px;margin:12px 2px 8px}
.sg-row{display:flex;align-items:center;gap:10px;margin-bottom:5px}
.sg-l{flex:0 0 auto;font-size:11px;color:#d8cba8;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sg-track{flex:1;height:10px;background:rgba(0,0,0,.35);border-radius:5px;overflow:hidden}
.sg-track.big{height:16px;border:1px solid #c9a86a30}
.sg-fill{display:block;height:100%;background:linear-gradient(90deg,#c9a86a99,#c9a86a);border-radius:5px;transition:width .4s ease}
.sg-fill.hot{background:linear-gradient(90deg,#e07070aa,#e07070)}
.sg-v{flex:0 0 auto;font-size:10.5px;color:#9a8c6e;min-width:90px;text-align:right}
.sg-chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:4px}
.sg-chip{font-size:11px;color:#d8cba8;background:#c9a86a12;border:1px solid #c9a86a30;border-radius:999px;padding:3px 11px}
.sg-chip.ok{border-color:#7aa87866;color:#a8c8a8;background:#7aa87812}
.sg-chip.bad{border-color:#e0707088;color:#e8a0a0;background:#e0707014}
.sg-warn{font-size:11.5px;color:#e6c078;background:#e0a84c12;border:1px solid #e0a84c55;border-radius:10px;padding:10px 13px;line-height:1.8;margin:8px 0}
.sg-note{font-size:11px;color:#8a7d63;line-height:1.9;margin:8px 2px 0}
.sg-btn{margin-top:9px;font-size:11.5px;color:#e8dcc0;background:linear-gradient(180deg,#c9a86a22,#c9a86a10);border:1px solid #c9a86a55;border-radius:9px;padding:7px 14px;cursor:pointer;letter-spacing:.5px;transition:.18s}
.sg-btn:hover{background:linear-gradient(180deg,#c9a86a33,#c9a86a18);border-color:#c9a86a99;transform:translateY(-1px)}
.sg-quota-row{display:flex;align-items:center;gap:10px;margin:6px 0 2px}
/* ③ 深夜护眼：暖褐滤镜 + 低动效（filter 挂 body，fixed 浮层为 body 子元素不受影响） */
body.night #chatArea,body.night #setupWrap,body.night #statusPanel,body.night .top-bar{filter:sepia(.28) brightness(.82) saturate(.85)}
body.night .ai-card,body.night .wr-card,body.night .np-debut{box-shadow:0 6px 18px rgba(0,0,0,.45)}
body.night *{animation-duration:.01s!important;transition-duration:.01s!important}
body.night .sg-budget{background:rgba(0,0,0,.4)}
@media (max-width:760px){.sg-budget{height:14px}.sg-l{max-width:130px}}`;
    document.head.appendChild(st);
  }
  window.SystemGuard = SystemGuard;
})();
