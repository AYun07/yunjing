(function() {
  "use strict";
  const LIB = "libs/cytoscape.min.js?v=3.30.2";
  const SENTIMENT = [
    { re: /仇|敌|恨|杀|背叛|反目|对峙|怨/, c: "#d9706a", n: "敌对" },
    { re: /爱|恋|情|婚|妻|夫|心属|倾心/, c: "#e58fb1", n: "情缘" },
    { re: /友|盟|助|救|义|同门|同窗|并肩/, c: "#8fb89a", n: "盟友" },
    { re: /父|母|兄|弟|姐|妹|子|女|亲|血/, c: "#e0a84c", n: "亲缘" },
    { re: /师|徒|尊|弟子|门下|授业/, c: "#b28dff", n: "师徒" },
    { re: /主|仆|属|麾下|效忠/, c: "#6fb0d8", n: "从属" }
  ];
  const RelationGraph = {
    esc(s) {
      return String(s != null ? s : "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    },
    ready() {
      return !!window.cytoscape;
    },
    async _ensureLib() {
      return window.loadLibOnce ? window.loadLibOnce(LIB, "cytoscape") : false;
    },
    /* ==================== 数据构建 ==================== */
    /** 主角名（与 immersive-suite.playerName 同源逻辑的轻量版） */
    _player() {
      var _a, _b;
      const st = (_a = window.storyFramework) == null ? void 0 : _a.storyState;
      const pn = (_b = st == null ? void 0 : st.setup) == null ? void 0 : _b.playerName;
      if (pn) return pn;
      const vars = (st == null ? void 0 : st.storyVariables) || {};
      for (const k of Object.keys(vars.characters || {})) {
        const v = vars.characters[k];
        if (v && (v.isPlayer || k === "玩家" || k === "主角")) return k;
      }
      return "主角";
    },
    /** 全部节点（众生相 gallery + 主角） */
    _nodes() {
      var _a, _b;
      const gal = ((_b = (_a = window.ImmersiveSuite) == null ? void 0 : _a._state) == null ? void 0 : _b.gallery) || {};
      const player = this._player();
      const nodes = [{ name: player, role: "主角", favor: 100, player: true }];
      for (const g of Object.values(gal)) {
        if (!(g == null ? void 0 : g.name) || g.name === player) continue;
        nodes.push({ name: g.name, role: g.role || "", favor: g.favor == null ? 50 : g.favor, player: false });
      }
      return nodes;
    },
    /** 拆「甲↔乙 / 甲与乙 / 甲和乙」为 [甲, 乙]（拆不动返回 null） */
    _splitPair(who) {
      const s = String(who || "").trim();
      if (!s) return null;
      const m = s.match(/^(.{1,10}?)(?:↔|⇄|×|✕|与|和|、)(.{1,10})$/);
      if (!m) return null;
      const a = m[1].trim(), b = m[2].trim();
      if (!a || !b || a === b) return null;
      return [a, b];
    },
    _sentimentOf(text) {
      const s = String(text || "");
      for (const { re, c, n } of SENTIMENT) {
        if (re.test(s)) return { c, n };
      }
      return { c: "#9a8c6e", n: "" };
    },
    /** 三路数据源合并成节点+边（edges 以「a⇄b」归并去重） */
    buildData() {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
      const nodes = this._nodes();
      const known = new Set(nodes.map((n) => n.name));
      const edgeMap = /* @__PURE__ */ new Map();
      const addEdge = (a, b, label, color, weight) => {
        if (!a || !b || a === b) return;
        const key = [a, b].sort().join("⇄");
        const old = edgeMap.get(key);
        if (old) {
          if (label && !old.labels.includes(label)) old.labels.push(label);
          if (color && !old.colors.includes(color)) old.colors.push(color);
          old.weight += weight;
        } else {
          for (const n of [a, b]) {
            if (!known.has(n)) {
              known.add(n);
              nodes.push({ name: n, role: "", favor: 30, player: false });
            }
          }
          edgeMap.set(key, { a, b, labels: label ? [label] : [], colors: color ? [color] : [], weight });
        }
      };
      const rel = ((_c = (_b = (_a = window.MemoryLayers) == null ? void 0 : _a.layers) == null ? void 0 : _b.call(_a)) == null ? void 0 : _c.relations) || [];
      for (const r of rel) {
        const pair = this._splitPair(r == null ? void 0 : r.who);
        if (!pair) continue;
        const sent = this._sentimentOf(r.what);
        addEdge(pair[0], pair[1], String(r.what || "").slice(0, 40), sent.c, 3);
      }
      const gal = ((_e = (_d = window.ImmersiveSuite) == null ? void 0 : _d._state) == null ? void 0 : _e.gallery) || {};
      const player = this._player();
      for (const g of Object.values(gal)) {
        if (!(g == null ? void 0 : g.name) || !g.relation || g.name === player) continue;
        const sent = this._sentimentOf(g.relation);
        addEdge(player, g.name, String(g.relation).slice(0, 40), sent.c, 2);
      }
      const scenes = [...((_g = (_f = window.SceneState) == null ? void 0 : _f.history) == null ? void 0 : _g.call(_f)) || []];
      const cur = (_i = (_h = window.SceneState) == null ? void 0 : _h.snap) == null ? void 0 : _i.call(_h);
      if ((_j = cur == null ? void 0 : cur.cast) == null ? void 0 : _j.length) scenes.push(cur);
      for (const sc of scenes) {
        const names = (sc.cast || []).map((c) => c == null ? void 0 : c.name).filter(Boolean);
        for (let i = 0; i < names.length; i++) {
          for (let j = i + 1; j < names.length; j++) {
            addEdge(names[i], names[j], "", "", 1);
          }
        }
      }
      return { nodes, edges: [...edgeMap.values()] };
    },
    /* ==================== 渲染 ==================== */
    async open(layout = "cose") {
      var _a, _b;
      (_a = document.getElementById("graphPanel")) == null ? void 0 : _a.remove();
      const data = this.buildData();
      if (data.nodes.length < 2) {
        (_b = window.showToast) == null ? void 0 : _b.call(window, "🕸 还没有可成网的人物（先写几轮让众生相登场）", "info");
        return;
      }
      const w = document.createElement("div");
      w.id = "graphPanel";
      w.innerHTML = `
            <div class="rg-overlay" onclick="if(event.target===this)RelationGraph.close()">
                <div class="rg-modal">
                    <div class="rg-top"><b>🕸 人物关系网</b><span class="rg-sub">${data.nodes.length} 人 · ${data.edges.length} 缘</span>
                        <button class="rg-btn" id="rgLayoutBtn" onclick="RelationGraph.relayout()">布局切换</button>
                        <button class="rg-x" onclick="RelationGraph.close()">✕</button></div>
                    <div class="rg-canvas" id="rgCanvas"></div>
                    <div class="rg-legend">
                        ${SENTIMENT.map((s) => `<span><i style="background:${s.c}"></i>${s.n}</span>`).join("")}
                        <span class="rg-legend-note">节点大小=好感 · 点击节点看一度关系 · 拖拽自由摆放</span>
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
              id: e.a + "⇄" + e.b,
              source: e.a,
              target: e.b,
              label: e.labels[0] || "",
              tip: e.labels.join("；"),
              color: e.colors[0] || "#9a8c6e",
              weight: e.weight
            }
          }))
        ],
        style: [
          { selector: "node", style: {
            "background-color": "#2a2419",
            "border-color": "#c9a86a",
            "border-width": 2,
            "border-opacity": 0.8,
            "label": "data(label)",
            "color": "#e8dcc0",
            "font-size": 11,
            "text-valign": "bottom",
            "text-margin-y": 7,
            "font-family": "inherit",
            "width": "mapData(favor, 0, 100, 26, 52)",
            "height": "mapData(favor, 0, 100, 26, 52)"
          } },
          { selector: "node[player = true]", style: {
            "background-color": "#3a2f1a",
            "border-color": "#e0a84c",
            "border-width": 3,
            "font-size": 12,
            "width": 56,
            "height": 56,
            "z-index": 10
          } },
          { selector: "edge", style: {
            "width": "mapData(weight, 1, 6, 1.5, 4)",
            "line-color": "data(color)",
            "line-opacity": 0.55,
            "curve-style": "haystack",
            "haystack-radius": 0.4
          } },
          { selector: 'edge[label != ""]', style: { "label": "data(label)", "font-size": 9, "color": "#9a8c6e", "text-rotation": "autorotate", "text-margin-y": -8, "text-opacity": 0.85 } },
          { selector: ":selected", style: { "border-color": "#e0a84c", "border-width": 3, "line-color": "#e0a84c", "line-opacity": 1 } }
        ],
        layout: {
          name: layout,
          animate: true,
          animationDuration: 480,
          nodeRepulsion: () => 6800,
          idealEdgeLength: 96,
          padding: 34,
          fit: true
        }
      });
      cy.on("tap", "node", (evt) => {
        const node = evt.target;
        const nb = node.neighborhood().nodes();
        cy.elements().removeClass("dim");
        if (node.data("player")) return;
        cy.elements().difference(nb.union(node)).addClass("dim");
      });
      cy.on("tap", (evt) => {
        if (evt.target === cy) cy.elements().removeClass("dim");
      });
      cy.style().selector(".dim").style({ "opacity": 0.18, "text-opacity": 0.1 }).update();
      this._cy = cy;
    },
    /** 力导 ↔ 环形切换 */
    relayout() {
      var _a;
      this._layout = this._layout === "cose" ? "circle" : "cose";
      if (this._cy) {
        this._cy.layout({ name: this._layout, animate: true, animationDuration: 480, padding: 34, fit: true }).run();
        (_a = window.showToast) == null ? void 0 : _a.call(window, `🕸 已切换为${this._layout === "cose" ? "力导" : "环形"}布局`, "info");
      } else {
        this.open(this._layout);
      }
    },
    close() {
      var _a, _b;
      try {
        (_a = this._cy) == null ? void 0 : _a.destroy();
      } catch (e) {
      }
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
