(function() {
  "use strict";
  const LIB = "libs/cytoscape.min.js?v=3.99.0";
  const RelationGraph = {
    esc(s) {
      return String(s != null ? s : "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    },
    ready() { return !!window.cytoscape; },
    async _ensureLib() { return window.loadLibOnce ? window.loadLibOnce(LIB, "cytoscape") : false; },
    _vars() {
      try { var fw = window.storyFramework; return (fw && fw.storyState && fw.storyState.variables) || null; } catch (e) { return null; }
    },
    /** 主角名（与 WorldBus / ImmersiveSuite 同源） */
    _player() {
      var v = this._vars();
      var pn = (v && v.setup && v.setup.playerName);
      if (pn) return pn;
      var chars = (v && v.characters) || {};
      for (const k of Object.keys(chars)) { const c = chars[k]; if (c && (c.isPlayer || k === "玩家" || k === "主角")) return k; }
      return "主角";
    },
    _clamp(v, lo, hi) { var n = Number(v); if (!isFinite(n)) n = 0; return Math.max(lo, Math.min(hi, n)); },
    /** 由强度推断情感色与名（关系真源已带 kind，优先用 kind） */
    _sentOf(kind, strength) {
      const s = this._clamp(strength, -100, 100);
      var n = kind || (s < -10 ? "敌对" : s > 10 ? "盟友" : "中立");
      var c = "#9a8c6e";
      if (/仇|敌|恨|杀|背叛|反目|对峙|怨/.test(n)) c = "#d9706a";
      else if (/爱|恋|情|婚|妻|夫|心属|倾心/.test(n)) c = "#e58fb1";
      else if (/友|盟|助|救|义|同门|同窗|并肩/.test(n)) c = "#8fb89a";
      else if (/父|母|兄|弟|姐|妹|子|女|亲|血/.test(n)) c = "#e0a84c";
      else if (/师|徒|尊|弟子|门下|授业/.test(n)) c = "#b28dff";
      else if (/主|仆|属|麾下|效忠/.test(n)) c = "#6fb0d8";
      else if (s <= -10) c = "#d9706a"; else if (s >= 10) c = "#8fb89a";
      return { c, n };
    },
    /** 历史轨迹：取最近一次「变化」与当前值的差，用于 ↑↓ 趋势 */
    _trend(r) {
      if (!r.hist || !r.hist.length) return { delta: 0, last: 0 };
      const last = r.hist[r.hist.length - 1];
      if (r.hist.length >= 2) { const prev = r.hist[r.hist.length - 2]; return { delta: Math.round((Number(r.strength) || 0) - (Number(prev.v) || 0)), last: last.t || 0 }; }
      return { delta: 0, last: last.t || 0 };
    },
    /** 全部节点（主角 + 众生相 gallery + 关系网涉及者） */
    _nodes() {
      var _a, _b;
      const me = this._player();
      const gal = ((_b = (_a = window.ImmersiveSuite) == null ? void 0 : _a._state) == null ? void 0 : _b.gallery) || {};
      const nodes = [{ name: me, role: "主角", favor: 100, player: true }];
      const known = new Set([me]);
      for (const g of Object.values(gal)) {
        if (!(g == null ? void 0 : g.name) || g.name === me || known.has(g.name)) continue;
        known.add(g.name);
        nodes.push({ name: g.name, role: g.role || "", favor: g.favor == null ? 50 : g.favor, player: false });
      }
      return { nodes, known };
    },
    /** 唯一真源：v.entities.relations（有向边，带强度与历史） */
    buildData() {
      const me = this._player();
      const v = this._vars();
      const rels = (v && v.entities && Array.isArray(v.entities.relations)) ? v.entities.relations : [];
      const { nodes, known } = this._nodes();
      const ensure = (n) => { if (n && !known.has(n)) { known.add(n); nodes.push({ name: n, role: "", favor: 30, player: n === me }); } };
      const edgeMap = new Map();
      for (const r of rels) {
        if (!r || !r.a || !r.b || r.a === r.b) continue;
        ensure(r.a); ensure(r.b);
        const strength = this._clamp(r.strength, -100, 100);
        const key = r.a + "→" + r.b;                 // 有向：a→b 与 b→a 各自独立
        const sent = this._sentOf(r.kind, strength);
        const tr = this._trend(r);
        edgeMap.set(key, { a: r.a, b: r.b, kind: sent.n, color: sent.c, weight: strength, at: r.at || 0, hist: r.hist || [], delta: tr.delta, label: sent.n + " " + strength + (tr.delta ? (tr.delta > 0 ? "↑" : "↓") : "") });
      }
      /* 众生相里对玩家的关系文案，补一条有向边（若 relations 尚未覆盖） */
      const gal = ((v0 => { var _a, _b; return ((_b = (_a = window.ImmersiveSuite) == null ? void 0 : _a._state) == null ? void 0 : _b.gallery) || {}; })());
      for (const g of Object.values(gal)) {
        if (!(g == null ? void 0 : g.name) || !g.relation || g.name === me) continue;
        const key = me + "→" + g.name;
        if (edgeMap.has(key)) continue;
        const sent = this._sentOf(g.relation, (g.favor == null ? 50 : g.favor) - 50);
        ensure(g.name);
        edgeMap.set(key, { a: me, b: g.name, kind: sent.n, color: sent.c, weight: this._clamp((g.favor == null ? 50 : g.favor) - 50, -100, 100), at: 0, hist: [], delta: 0, label: sent.n });
      }
      return { nodes, edges: [...edgeMap.values()] };
    },
    /* ==================== 渲染 ==================== */
    async open(layout = "cose") {
      var _a, _b;
      (_a = document.getElementById("graphPanel")) == null ? void 0 : _a.remove();
      const data = this.buildData();
      if (data.nodes.length < 2) {
        (_b = window.showToast) == null ? void 0 : _b.call(window, "🕸 还没有可成网的关系（先写几轮让众生相与势力登场）", "info");
        return;
      }
      const w = document.createElement("div");
      w.id = "graphPanel";
      w.innerHTML = `
            <div class="rg-overlay" onclick="if(event.target===this)RelationGraph.close()">
                <div class="rg-modal">
                    <div class="rg-top"><b>🕸 人物关系网</b><span class="rg-sub">${data.nodes.length} 人 · ${data.edges.length} 缘（有向 · 实时）</span>
                        <button class="rg-btn" id="rgLayoutBtn" onclick="RelationGraph.relayout()">布局切换</button>
                        <button class="rg-x" onclick="RelationGraph.close()">✕</button></div>
                    <div class="rg-canvas" id="rgCanvas"></div>
                    <div class="rg-legend">
                        <span><i style="background:#d9706a"></i>敌对</span>
                        <span><i style="background:#8fb89a"></i>盟友</span>
                        <span><i style="background:#e58fb1"></i>情缘</span>
                        <span><i style="background:#e0a84c"></i>亲族</span>
                        <span><i style="background:#b28dff"></i>师徒</span>
                        <span><i style="background:#6fb0d8"></i>从属</span>
                        <span><i style="background:#9a8c6e"></i>中立</span>
                        <span class="rg-legend-note">箭头指「对谁」；线宽=强度；↑↓=最近变化；点击节点看一度关系</span>
                    </div>
                </div>
            </div>`;
      document.body.appendChild(w);
      this._style();
      if (!await this._ensureLib()) {
        document.getElementById("rgCanvas").innerHTML = '<div class="rg-empty">关系图引擎加载失败（libs/cytoscape.min.js 缺失）</div>';
        return;
      }
      this._render(data, layout);
    },
    _render(data, layout) {
      const host = document.getElementById("rgCanvas");
      if (!host || !window.cytoscape) return;
      this._layout = layout;
      const cy = window.cytoscape({
        container: host,
        elements: [
          ...data.nodes.map((n) => ({ data: { id: n.name, label: n.name, favor: n.favor, player: !!n.player } })),
          ...data.edges.map((e) => ({
            data: {
              id: e.a + "→" + e.b,
              source: e.a,
              target: e.b,
              label: e.label || "",
              tip: (e.kind || "") + " 强度 " + e.weight + (e.delta ? "（近变 " + (e.delta > 0 ? "+" : "") + e.delta + "）" : "") + (e.hist && e.hist.length ? " · 变化 " + e.hist.length + " 次" : ""),
              color: e.color || "#9a8c6e",
              weight: e.weight
            }
          }))
        ],
        style: [
          { selector: "node", style: {
            "background-color": "#2a2419",
            "border-color": "#c9a86a", "border-width": 2, "border-opacity": 0.8,
            "label": "data(label)", "color": "#e8dcc0", "font-size": 11, "text-valign": "bottom", "text-margin-y": 7,
            "font-family": "inherit", "width": "mapData(favor, 0, 100, 26, 52)", "height": "mapData(favor, 0, 100, 26, 52)"
          } },
          { selector: "node[player = true]", style: {
            "background-color": "#3a2f1a", "border-color": "#e0a84c", "border-width": 3, "font-size": 12, "width": 56, "height": 56, "z-index": 10
          } },
          { selector: "edge", style: {
            "width": "mapData(weight, -100, 100, 2, 7)",
            "line-color": "data(color)", "line-opacity": 0.85,
            "curve-style": "bezier", "control-point-step-size": 40,
            "target-arrow-color": "data(color)", "target-arrow-shape": "triangle", "arrow-scale": 1.1
          } },
          { selector: 'edge[label != ""]', style: { "label": "data(label)", "font-size": 9, "color": "#9a8c6e", "text-rotation": "autorotate", "text-margin-y": -8, "text-opacity": 0.9, "text-background-color": "#14110c", "text-background-opacity": 0.7, "text-background-padding": 2 } },
          { selector: ":selected", style: { "border-color": "#e0a84c", "border-width": 3, "line-color": "#e0a84c", "line-opacity": 1, "target-arrow-color": "#e0a84c" } }
        ],
        layout: { name: layout, animate: true, animationDuration: 480, nodeRepulsion: () => 6800, idealEdgeLength: 110, padding: 34, fit: true }
      });
      cy.on("tap", "node", (evt) => {
        const node = evt.target;
        const nb = node.neighborhood().nodes();
        cy.elements().removeClass("dim");
        if (node.data("player")) return;
        cy.elements().difference(nb.union(node)).addClass("dim");
      });
      cy.on("tap", (evt) => { if (evt.target === cy) cy.elements().removeClass("dim"); });
      cy.style().selector(".dim").style({ "opacity": 0.18, "text-opacity": 0.1 }).update();
      this._cy = cy;
    },
    relayout() {
      var _a;
      this._layout = this._layout === "cose" ? "circle" : "cose";
      if (this._cy) { this._cy.layout({ name: this._layout, animate: true, animationDuration: 480, padding: 34, fit: true }).run();
        (_a = window.showToast) == null ? void 0 : _a.call(window, `🕸 已切换为${this._layout === "cose" ? "力导" : "环形"}布局`, "info"); }
      else { this.open(this._layout); }
    },
    close() {
      var _a, _b;
      try { (_a = this._cy) == null ? void 0 : _a.destroy(); } catch (e) {}
      this._cy = null;
      (_b = document.getElementById("graphPanel")) == null ? void 0 : _b.remove();
    },
    _style() {
      if (document.getElementById("relationGraphStyle")) return;
      const st = document.createElement("style");
      st.id = "relationGraphStyle";
      st.textContent = `
.rg-overlay{position:fixed;inset:0;background:rgba(0,0,0,.68);backdrop-filter:blur(3px);z-index:9993;display:flex;align-items:center;justify-content:center;padding:18px}
.rg-modal{width:min(860px,95vw);height:min(640px,88vh);display:flex;flex-direction:column;background:linear-gradient(160deg,#211d17,#17140f);border:1px solid #c9a86a45;border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.6);overflow:hidden;animation:rgIn .3s ease both}
@keyframes rgIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.rg-top{display:flex;align-items:center;gap:12px;padding:13px 18px;border-bottom:1px solid #c9a86a25}
.rg-top b{color:#e8dcc0;font-size:15px;letter-spacing:1px}
.rg-sub{font-size:11px;color:#9a8c6e;margin-right:auto}
.rg-btn{background:rgba(201,168,106,.14);border:1px solid #c9a86a44;color:#d8cba8;font-size:12px;padding:6px 12px;border-radius:8px;cursor:pointer;transition:all .2s}
.rg-btn:hover{background:rgba(201,168,106,.26)}
.rg-x{background:none;border:none;color:#9a8c6e;font-size:16px;cursor:pointer;padding:4px 8px}
.rg-x:hover{color:#e8dcc0}
.rg-canvas{flex:1;min-height:0;background:radial-gradient(ellipse at center,#1d1a13 0%,#14110c 100%)}
.rg-empty{display:flex;align-items:center;justify-content:center;height:100%;font-size:12px;color:#8a7d63}
.rg-legend{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:10px 18px;border-top:1px solid #c9a86a25;font-size:11px;color:#9a8c6e}
.rg-legend span{display:inline-flex;align-items:center;gap:5px}
.rg-legend i{width:10px;height:10px;border-radius:3px;display:inline-block}
.rg-legend-note{margin-left:auto;color:#8a7d63;font-size:10.5px}`;
      document.head.appendChild(st);
    }
  };
  window.RelationGraph = RelationGraph;
})();
