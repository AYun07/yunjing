(function() {
  "use strict";
  const LOG_MAX = 12;
  const WeeklyReport = {
    esc(s) {
      return String(s != null ? s : "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    },
    /** 周标识：ISO 周一所在日期（周一为一周之始，跨时区稳定） */
    weekKey(ts) {
      const d = new Date(Number(ts) || Date.now());
      const day = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - day);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    },
    /** 周标识 → 展示文案 */
    weekLabel(key) {
      const [y, m, d] = String(key).split("-").map(Number);
      if (!y) return String(key);
      const wd = new Date(y, m - 1, d);
      return `${m}月${d}日起`;
    },
    /* ==================== 记账（saveStory patch 内调用） ==================== */
    log() {
      var _a, _b;
      const l = (_b = (_a = window.storyFramework) == null ? void 0 : _a.storyState) == null ? void 0 : _b.weeklyLog;
      return Array.isArray(l) ? l : [];
    },
    /** 当前快照（chapter/wordCount/gallery/seals/伏笔） */
    snap() {
      var _a, _b, _c, _d;
      const fw = window.storyFramework;
      const v = ((_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.variables) || {};
      const imm = window.ImmersiveSuite && ImmersiveSuite._state || {};
      const npcNames = Object.values(imm.gallery || {}).filter((g) => g && g.name).map((g) => String(g.name)).slice(0, 60);
      const sealNames = window.GameLayer && GameLayer.sealLabels ? GameLayer.sealLabels().map((s) => s.name) : [];
      const fore = Array.isArray(v.foreshadowings) ? v.foreshadowings.filter((p) => !(typeof p === "object" && /resolved|回收/.test(String((p == null ? void 0 : p.status) || "")))).length : null;
      return {
        chapter: Number(v.chapter) || 0,
        wordCount: Number(v.wordCount) || 0,
        npcNames,
        sealNames,
        foreOpen: fore,
        turnCount: Number((_b = fw == null ? void 0 : fw.storyState) == null ? void 0 : _b.turnCount) || 0,
        title: v.title || ((_d = (_c = fw == null ? void 0 : fw.storyState) == null ? void 0 : _c.setup) == null ? void 0 : _d.title) || ""
      };
    },
    /** upsert 本周条目（幂等；上限裁剪） */
    upsert() {
      const fw = window.storyFramework;
      if (!fw || !fw.storyState || !fw.storyState.isStoryStarted) return;
      const s = this.snap();
      if (!s.wordCount && !s.chapter) return;
      const key = this.weekKey(Date.now());
      const list = this.log().slice();
      const cur = list[list.length - 1];
      if (cur && cur.week === key) {
        Object.assign(cur, {
          chapter: s.chapter,
          wordCount: s.wordCount,
          npcNames: s.npcNames,
          sealNames: s.sealNames,
          foreOpen: s.foreOpen,
          ts: Date.now()
        });
      } else {
        list.push({
          week: key,
          chapter: s.chapter,
          wordCount: s.wordCount,
          npcNames: s.npcNames,
          sealNames: s.sealNames,
          foreOpen: s.foreOpen,
          baseTurn: s.turnCount,
          ts: Date.now()
        });
      }
      if (list.length > LOG_MAX) list.splice(0, list.length - LOG_MAX);
      fw.storyState.weeklyLog = list;
    },
    /* ==================== 周报渲染 ==================== */
    open() {
      var _a;
      const list = this.log();
      const s = this.snap();
      (_a = document.getElementById("wrPanel")) == null ? void 0 : _a.remove();
      if (!list.length) {
        const html2 = this.shell(`<div class="wrp-empty">尚无周报数据——开篇写起来，落第一轮档后本周流水开始记账，下周此时这里就有第一份周报。</div>`);
        document.body.appendChild(html2);
        return;
      }
      const cur = list[list.length - 1];
      const prev = list.length >= 2 ? list[list.length - 2] : null;
      const label = this.weekLabel(cur.week);
      if (!prev) {
        const turns2 = Math.max(0, s.turnCount - (Number(cur.baseTurn) || 0));
        const html2 = this.shell(`
                    <div class="wrp-head-line">📖 首周创作总览 <i>${label} 起 · 至今</i></div>
                    <div class="wrp-grid">
                        ${this.stat("✒", "累计字数", s.wordCount.toLocaleString(), "")}
                        ${this.stat("📖", "推进章节", `${s.chapter} 章`, "")}
                        ${this.stat("🎭", "相识人物", `${cur.npcNames.length} 人`, "")}
                        ${this.stat("🏆", "成就解锁", `${cur.sealNames.length} 枚`, "")}
                        ${this.stat("✏", "落笔轮次", `${turns2} 轮`, "")}
                        ${cur.foreOpen != null ? this.stat("🧵", "未回收伏笔", `${cur.foreOpen} 处`, "") : ""}
                    </div>
                    <div class="wrp-note">下周此时，这里会变成「本周 vs 上周」的增量对比——继续写，让数字长大。</div>`);
        document.body.appendChild(html2);
        return;
      }
      const dWords = Math.max(0, (Number(cur.wordCount) || 0) - (Number(prev.wordCount) || 0));
      const dChapters = Math.max(0, (Number(cur.chapter) || 0) - (Number(prev.chapter) || 0));
      const turns = Math.max(0, s.turnCount - (Number(cur.baseTurn) || 0));
      const prevNames = new Set(prev.npcNames || []);
      const newNpcs = (cur.npcNames || []).filter((n) => !prevNames.has(n));
      const prevSeals = new Set(prev.sealNames || []);
      const newSeals = (cur.sealNames || []).filter((n) => !prevSeals.has(n));
      const dFore = prev.foreOpen != null && cur.foreOpen != null ? Math.max(0, (Number(prev.foreOpen) || 0) - (Number(cur.foreOpen) || 0)) : null;
      const pace = turns >= 30 ? { txt: "笔耕不辍", cls: "hot" } : turns >= 10 ? { txt: "稳步推进", cls: "good" } : turns >= 1 ? { txt: "细水长流", cls: "" } : { txt: "本周未动笔", cls: "" };
      const npcLine = newNpcs.length ? `<div class="wrp-line">🎭 新登场：<b>${newNpcs.slice(0, 10).map((n) => this.esc(n)).join("、")}</b>${newNpcs.length > 10 ? " 等" : ""}</div>` : "";
      const sealLine = newSeals.length ? `<div class="wrp-line">🏆 新成就：<b>${newSeals.slice(0, 8).map((n) => this.esc(n)).join("、")}</b>${newSeals.length > 8 ? " 等" : ""}</div>` : "";
      const foreLine = dFore != null && dFore > 0 ? `<div class="wrp-line">🧵 伏笔回收：<b>${dFore} 处</b></div>` : "";
      const html = this.shell(`
                <div class="wrp-head-line">📅 本周创作周报 <i>${label} · ${this.weekLabel(prev.week)}以来的第 ${list.length} 笔</i></div>
                <div class="wrp-grid">
                    ${this.stat("✒", "本周字数", `+${dWords.toLocaleString()}`, dWords >= 3e3 ? "hot" : dWords >= 800 ? "good" : "")}
                    ${this.stat("📖", "章节推进", `+${dChapters} 章`, dChapters >= 3 ? "good" : "")}
                    ${this.stat("✏", "落笔轮次", `${turns} 轮`, "")}
                    ${this.stat("👥", "新面孔", `${newNpcs.length} 人`, newNpcs.length ? "good" : "")}
                    ${this.stat("🏆", "新成就", `${newSeals.length} 枚`, newSeals.length ? "good" : "")}
                    ${this.stat("📊", "创作节奏", pace.txt, pace.cls)}
                </div>
                ${npcLine}${sealLine}${foreLine}
                ${!newNpcs.length && !newSeals.length && dWords < 800 ? '<div class="wrp-note">本周产出不多——不必焦虑，长卷本就是马拉松；下周从「📑 章节目录」翻开书签接着写。</div>' : ""}
                <div class="wrp-hist">累计 ${Number(cur.wordCount || 0).toLocaleString()} 字 · ${cur.chapter} 章 · 相识 ${(cur.npcNames || []).length} 人（${list.length} 周流水在册）</div>`);
      document.body.appendChild(html);
    },
    stat(icon, name, val, cls) {
      return `<div class="wrp-stat ${cls || ""}"><span class="ws-ico">${icon}</span>
                <span class="ws-val">${this.esc(val)}</span><span class="ws-name">${this.esc(name)}</span></div>`;
    },
    shell(bodyHTML) {
      const w = document.createElement("div");
      w.id = "wrPanel";
      w.innerHTML = `
            <div class="wrp-overlay" onclick="if(event.target===this)WeeklyReport.close()">
                <div class="wrp-modal">
                    <div class="wrp-head"><b>📅 创作周报</b><span class="wrp-sub">本地流水 · 零 AI 调用</span>
                        <button class="wrp-x" onclick="WeeklyReport.close()">✕</button></div>
                    <div class="wrp-body">${bodyHTML}</div>
                </div>
            </div>`;
      return w;
    },
    close() {
      var _a;
      (_a = document.getElementById("wrPanel")) == null ? void 0 : _a.remove();
    },
    /* ==================== 安装（patch saveStory 顺手记账） ==================== */
    install() {
      if (this._installed) return;
      const patch = () => {
        const fw = window.storyFramework;
        if (!fw || !fw.saveStory || fw.__weeklyPatched) return false;
        const orig = fw.saveStory.bind(fw);
        fw.saveStory = function() {
          var _a, _b;
          try {
            (_b = (_a = window.WeeklyReport) == null ? void 0 : _a.upsert) == null ? void 0 : _b.call(_a);
          } catch (e) {
          }
          return orig();
        };
        fw.__weeklyPatched = true;
        return true;
      };
      if (patch()) {
        this._installed = true;
        return;
      }
      let tries = 0;
      const t = setInterval(() => {
        if (patch() || ++tries > 40) {
          this._installed = true;
          clearInterval(t);
        }
      }, 500);
    }
  };
  if (!document.getElementById("weeklyReportStyle")) {
    const st = document.createElement("style");
    st.id = "weeklyReportStyle";
    st.textContent = `
.wrp-overlay{position:fixed;inset:0;background:rgba(0,0,0,.62);backdrop-filter:blur(3px);z-index:9992;display:flex;align-items:center;justify-content:center;padding:18px}
.wrp-modal{width:min(600px,94vw);max-height:86vh;display:flex;flex-direction:column;background:linear-gradient(160deg,#211d17,#17140f);border:1px solid #c9a86a45;border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.6);overflow:hidden;animation:wrpIn .3s ease both}
@keyframes wrpIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.wrp-head{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid #c9a86a25}
.wrp-head b{color:#e8dcc0;font-size:15px;letter-spacing:1px}
.wrp-sub{font-size:11px;color:#9a8c6e;margin-right:auto}
.wrp-x{background:none;border:none;color:#9a8c6e;font-size:16px;cursor:pointer;padding:4px 8px}
.wrp-x:hover{color:#e8dcc0}
.wrp-body{padding:16px 18px 18px;overflow-y:auto;flex:1}
.wrp-head-line{font-size:13.5px;color:#e8dcc0;letter-spacing:1px;margin-bottom:13px}
.wrp-head-line i{font-style:normal;font-size:11px;color:#9a8c6e;margin-left:8px}
.wrp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
.wrp-stat{display:flex;flex-direction:column;align-items:center;gap:4px;background:rgba(255,255,255,.035);border:1px solid #c9a86a2a;border-radius:12px;padding:13px 8px;transition:border-color .2s}
.wrp-stat.good{border-color:#7aa87855;background:#7aa87810}
.wrp-stat.hot{border-color:#e0a84c66;background:#e0a84c12}
.ws-ico{font-size:17px}
.ws-val{font-size:16px;color:#e8dcc0;font-weight:600;letter-spacing:.5px}
.wrp-stat.good .ws-val{color:#a8d0a8}
.wrp-stat.hot .ws-val{color:#e8c87a}
.ws-name{font-size:10.5px;color:#9a8c6e;letter-spacing:1px}
.wrp-line{font-size:12px;color:#bdb08e;line-height:1.9;margin-top:9px;padding:8px 12px;background:rgba(0,0,0,.22);border-radius:9px;border-left:2px solid #c9a86a55}
.wrp-line b{color:#d8cba8;font-weight:600}
.wrp-note{font-size:11px;color:#8a7d63;line-height:1.9;margin-top:11px}
.wrp-hist{font-size:11px;color:#8a7d63;margin-top:13px;padding-top:11px;border-top:1px dashed #c9a86a30;letter-spacing:.5px}
.wrp-empty{font-size:12.5px;color:#9a8c6e;background:rgba(0,0,0,.2);border:1px dashed #c9a86a38;border-radius:10px;padding:22px 16px;text-align:center;line-height:2}
@media (max-width:760px){.wrp-grid{grid-template-columns:repeat(2,1fr)}}`;
    document.head.appendChild(st);
  }
  window.WeeklyReport = WeeklyReport;
})();
