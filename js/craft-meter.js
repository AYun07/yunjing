(function() {
  "use strict";
  const CraftMeter = {
    esc(s) {
      return String(s != null ? s : "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    },
    /* ==================== 对话密度 ==================== */
    /**
     * 对白占比：引号内字符数 / 总字符数（去空白后）
     * @returns {number|null} 0-1；正文太短（<40 字）返回 null 不误判
     */
    densityOf(text) {
      const t = String(text || "").replace(/\s+/g, "");
      if (t.length < 40) return null;
      let inQ = 0;
      const pairs = [["「", "」"], ["『", "』"], ["“", "”"], ['"', '"'], ['"', '"']];
      const stack = [];
      for (const c of t) {
        const open = pairs.find((p) => p[0] === c && !(p[0] === p[1] && stack[stack.length - 1] === c && stack._q === c));
        const close = pairs.find((p) => p[1] === c);
        if (open && (!close || open[0] !== open[1] || stack[stack.length - 1] !== c)) {
          stack.push(c);
          stack._q = c;
          inQ++;
        } else if (close && stack.length && stack[stack.length - 1] === close[0]) {
          stack.pop();
          inQ++;
        } else if (close) {
          inQ++;
        } else if (stack.length) {
          inQ++;
        }
      }
      const ratio = inQ / t.length;
      return ratio > 1 ? 1 : ratio;
    },
    /** 密度评语 */
    densityVerdict(d) {
      if (d == null) return { txt: "样本过短", cls: "" };
      const p = Math.round(d * 100);
      if (p < 15) return { txt: `${p}% · 叙述主导`, cls: "low" };
      if (p < 30) return { txt: `${p}% · 偏静`, cls: "midlow" };
      if (p <= 60) return { txt: `${p}% · 黄金区间`, cls: "good" };
      if (p <= 75) return { txt: `${p}% · 偏闹`, cls: "midhigh" };
      return { txt: `${p}% · 剧本化`, cls: "high" };
    },
    /* ==================== 三幕结构地图 ==================== */
    /**
     * 全书张力 → 三幕横幅 SVG
     * @param chapters {number} 当前总章数（分母）
     */
    actMapSVG(chapters) {
      var _a, _b, _c;
      const imm = window.ImmersiveSuite && ImmersiveSuite._state || {};
      const tens = (Array.isArray(imm.tensions) ? imm.tensions : []).filter((t) => Number(t.v) >= 0);
      const ch = Number(chapters) || Number((_c = (_b = (_a = window.storyFramework) == null ? void 0 : _a.storyState) == null ? void 0 : _b.variables) == null ? void 0 : _c.chapter) || 0;
      const W = 640, H = 120, PAD = 8, bw = W - PAD * 2;
      const acts = [
        { x: PAD, w: bw * 0.25, c: "#5a7a9a22", label: "开端", ly: "#8aa8c8" },
        { x: PAD + bw * 0.25, w: bw * 0.5, c: "#c9a86a1a", label: "发展", ly: "#c9a86a" },
        { x: PAD + bw * 0.75, w: bw * 0.25, c: "#b0604022", label: "高潮·收束", ly: "#d89878" }
      ];
      const actRects = acts.map((a) => `<rect x="${a.x.toFixed(1)}" y="6" width="${a.w.toFixed(1)}" height="${H - 34}" fill="${a.c}" rx="4"/><text x="${(a.x + a.w / 2).toFixed(1)}" y="${H - 12}" fill="${a.ly}" font-size="10" text-anchor="middle" letter-spacing="2">${a.label}</text>`).join("");
      let line = "";
      if (tens.length >= 2) {
        const maxY = Math.max(...tens.map((t) => Number(t.round) || 0), 1);
        const pts = tens.map((t, i) => {
          const x = PAD + i / (tens.length - 1) * bw;
          const y = H - 40 - Number(t.v) / 100 * (H - 52);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        });
        line = `<polyline points="${pts.join(" ")}" fill="none" stroke="#e8c87a" stroke-width="1.6" stroke-linejoin="round" opacity=".9"/><polyline points="${PAD},${H - 40} ${pts.join(" ")} ${W - PAD},${H - 40}" fill="#e8c87a14" stroke="none"/>`;
      } else {
        line = `<text x="${W / 2}" y="${H / 2}" fill="#8a7d63" font-size="10.5" text-anchor="middle">张力描点不足 2 轮——变量 AI 每轮上报 tension 后自动描线</text>`;
      }
      let cursor = "";
      const cur = ch || (tens.length ? Math.max(...tens.map((t) => Number(t.round) || 0)) : 0);
      const total = Math.max(ch, tens.length ? Math.max(...tens.map((t) => Number(t.round) || 0)) : 0, 1);
      if (cur > 0) {
        const cx = PAD + Math.min(1, cur / total) * bw;
        cursor = `<line x1="${cx.toFixed(1)}" y1="4" x2="${cx.toFixed(1)}" y2="${H - 28}" stroke="#f0d8a0" stroke-width="1.4" stroke-dasharray="3 3"/><circle cx="${cx.toFixed(1)}" cy="8" r="3.4" fill="#f0d8a0"/><text x="${cx.toFixed(1)}" y="${H - 12}" fill="#f0d8a0" font-size="9.5" text-anchor="middle">第${cur}章</text>`;
      }
      return `<svg class="cm-actmap" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${actRects}${line}${cursor}</svg>`;
    },
    /* ==================== 质量面板 ==================== */
    open() {
      var _a, _b, _c;
      (_a = document.getElementById("cmPanel")) == null ? void 0 : _a.remove();
      const fw = window.storyFramework;
      const chapters = Number((_c = (_b = fw == null ? void 0 : fw.storyState) == null ? void 0 : _b.variables) == null ? void 0 : _c.chapter) || 0;
      const acts = this.actMapSVG(chapters);
      const cards = window.ChapterNav && ChapterNav.scan ? ChapterNav.scan() : [];
      const groups = /* @__PURE__ */ new Map();
      cards.forEach((c) => {
        var _a2;
        const txt = String(((_a2 = c.el.querySelector(".story-body")) == null ? void 0 : _a2.textContent) || "");
        if (!groups.has(c.ch)) groups.set(c.ch, []);
        groups.get(c.ch).push(txt);
      });
      const bars = [...groups.entries()].slice(-30).map(([ch, texts]) => {
        const d = this.densityOf(texts.join(" "));
        const v = this.densityVerdict(d);
        const pct = d == null ? 0 : Math.round(d * 100);
        return `<div class="cm-bar-row">
                    <span class="cm-bar-ch">第${ch}章</span>
                    <div class="cm-bar-track">
                        <div class="cm-bar-zone"></div>
                        <div class="cm-bar-fill ${v.cls}" style="width:${pct}%"></div>
                    </div>
                    <span class="cm-bar-val ${v.cls}">${v.txt}</span>
                </div>`;
      }).join("");
      const avg = cards.length ? this.densityOf(cards.map((c) => {
        var _a2;
        return String(((_a2 = c.el.querySelector(".story-body")) == null ? void 0 : _a2.textContent) || "");
      }).join(" ")) : null;
      const avgV = this.densityVerdict(avg);
      const tens = (window.ImmersiveSuite && ImmersiveSuite._state || {}).tensions || [];
      const peak = tens.length ? Math.max(...tens.map((t) => Number(t.v) || 0)) : null;
      const html = `
            <div class="cm-overlay" onclick="if(event.target===this)CraftMeter.close()">
                <div class="cm-modal">
                    <div class="cm-head">
                        <b>📐 质量仪表</b>
                        <span class="cm-sub">对话密度 · 三幕结构 · 张力总览</span>
                        <button class="cm-x" onclick="CraftMeter.close()">✕</button>
                    </div>
                    <div class="cm-body">
                        <div class="cm-sec">🗺 三幕结构地图 <i>全书张力压缩视图</i></div>
                        <div class="cm-actmap-box">${acts}</div>
                        <div class="cm-note">游标 = 当前章所在位置；折线 = 全书张力描点。写到发展段中后程若曲线长期趴平（<30），就该酝酿一次高潮了。</div>

                        <div class="cm-sec">💬 对话密度 · 逐章 <i>黄金区间 30%-60%</i></div>
                        ${bars || '<div class="cm-empty">尚无正文——开篇后逐章密度自动出图。</div>'}

                        <div class="cm-sec">📊 全书总览</div>
                        <div class="cm-stats">
                            <span class="cm-chip ${avgV.cls}">💬 全书密度 ${avgV.txt}</span>
                            ${peak != null ? `<span class="cm-chip">⚡ 张力峰值 ${peak}</span>` : ""}
                            <span class="cm-chip">📖 ${groups.size} 章</span>
                            <span class="cm-chip">✒ ${cards.reduce((s, c) => s + c.words, 0).toLocaleString()} 字</span>
                        </div>
                        <div class="cm-note">密度过低（&lt;15%）像设定集，过高（&gt;75%）像剧本——指令里补一句「多写环境与心理」或「推进情节少寒暄」即可纠偏。</div>
                    </div>
                </div>
            </div>`;
      const wrap = document.createElement("div");
      wrap.id = "cmPanel";
      wrap.innerHTML = html;
      document.body.appendChild(wrap);
    },
    close() {
      var _a;
      (_a = document.getElementById("cmPanel")) == null ? void 0 : _a.remove();
    }
  };
  if (!document.getElementById("craftMeterStyle")) {
    const st = document.createElement("style");
    st.id = "craftMeterStyle";
    st.textContent = `
.cm-overlay{position:fixed;inset:0;background:rgba(0,0,0,.62);backdrop-filter:blur(3px);z-index:9992;display:flex;align-items:center;justify-content:center;padding:18px}
.cm-modal{width:min(720px,94vw);max-height:86vh;display:flex;flex-direction:column;background:linear-gradient(160deg,#211d17,#17140f);border:1px solid #c9a86a45;border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.6);overflow:hidden;animation:cmIn .3s ease both}
@keyframes cmIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.cm-head{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid #c9a86a25}
.cm-head b{color:#e8dcc0;font-size:15px;letter-spacing:1px}
.cm-sub{font-size:11px;color:#9a8c6e;margin-right:auto}
.cm-x{background:none;border:none;color:#9a8c6e;font-size:16px;cursor:pointer;padding:4px 8px}
.cm-x:hover{color:#e8dcc0}
.cm-body{padding:14px 18px 18px;overflow-y:auto;flex:1}
.cm-sec{font-size:12px;color:#c9a86a;letter-spacing:2px;margin:14px 2px 9px;display:flex;align-items:baseline;gap:8px}
.cm-sec i{font-style:normal;font-size:10px;color:#8a7d63;letter-spacing:1px}
.cm-sec::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,#c9a86a33,transparent)}
.cm-actmap-box{background:rgba(0,0,0,.28);border:1px solid #c9a86a30;border-radius:12px;padding:12px}
.cm-actmap{width:100%;height:auto;display:block}
.cm-note{font-size:11px;color:#8a7d63;line-height:1.9;margin:8px 2px 0}
.cm-bar-row{display:flex;align-items:center;gap:10px;margin-bottom:6px}
.cm-bar-ch{flex:0 0 52px;font-size:11px;color:#d8cba8;text-align:right}
.cm-bar-track{flex:1;height:14px;background:rgba(0,0,0,.35);border-radius:7px;position:relative;overflow:hidden;border:1px solid #c9a86a22}
.cm-bar-zone{position:absolute;left:30%;width:30%;top:0;bottom:0;background:#c9a86a18;border-left:1px dashed #c9a86a44;border-right:1px dashed #c9a86a44}
.cm-bar-fill{height:100%;border-radius:7px 0 0 7px;transition:width .4s ease}
.cm-bar-fill.good{background:linear-gradient(90deg,#7aa87888,#7aa878cc)}
.cm-bar-fill.low{background:linear-gradient(90deg,#6888a888,#6888a8cc)}
.cm-bar-fill.midlow{background:linear-gradient(90deg,#8898a866,#8898a8aa)}
.cm-bar-fill.midhigh{background:linear-gradient(90deg,#c8a05866,#c8a058cc)}
.cm-bar-fill.high{background:linear-gradient(90deg,#c0785888,#c07858cc)}
.cm-bar-val{flex:0 0 96px;font-size:10.5px;color:#9a8c6e}
.cm-bar-val.good{color:#98c098}
.cm-bar-val.low{color:#8aa8c8}
.cm-bar-val.high{color:#d89888}
.cm-stats{display:flex;flex-wrap:wrap;gap:7px}
.cm-chip{font-size:11px;color:#d8cba8;background:#c9a86a12;border:1px solid #c9a86a30;border-radius:999px;padding:3px 11px}
.cm-chip.good{border-color:#7aa87866;color:#a8c8a8;background:#7aa87812}
.cm-chip.low{border-color:#6888a866;color:#a0b8d0;background:#6888a812}
.cm-chip.high{border-color:#c0785866;color:#d8a898;background:#c0785812}
.cm-empty{font-size:12px;color:#9a8c6e;background:rgba(0,0,0,.2);border:1px dashed #c9a86a38;border-radius:10px;padding:16px;text-align:center;line-height:1.9}
@media (max-width:760px){.cm-bar-ch{flex-basis:44px;font-size:10.5px}.cm-bar-val{flex-basis:84px;font-size:10px}}`;
    document.head.appendChild(st);
  }
  window.CraftMeter = CraftMeter;
})();
