(function() {
  "use strict";
  const LIB = "libs/fantasy-names.min.js?v=0.1.18";
  const HISTORY_KEY = "storyDiceHistory";
  const HISTORY_MAX = 24;
  const CATS = [
    { key: "name", ico: "👤", label: "人名", fn: "getName", rar: false },
    { key: "dao", ico: "🧙", label: "道号", fn: "getDao", rar: true },
    { key: "skill", ico: "📜", label: "功法", fn: "getSkill", rar: true },
    { key: "book", ico: "📖", label: "秘籍", fn: "getBook", rar: true },
    { key: "creature", ico: "🐉", label: "生灵", fn: "getCreature", rar: true },
    { key: "material", ico: "💎", label: "材料", fn: "getMaterial", rar: true },
    { key: "talisman", ico: "🔮", label: "法宝", fn: "getTalisman", rar: true },
    { key: "alchemy", ico: "⚗️", label: "丹药", fn: "getAlchemy", rar: true },
    { key: "clan", ico: "🏯", label: "门派", fn: "getClan", rar: false },
    { key: "nation", ico: "🏛", label: "国度", fn: "getNation", rar: false },
    { key: "location", ico: "🗺", label: "地点", fn: "getLocation", rar: true },
    { key: "zone", ico: "🌏", label: "大陆", fn: "getZone", rar: true }
  ];
  const RARITY = {
    common: { n: "凡品", c: "#9aa0b4" },
    uncommon: { n: "良品", c: "#8fb89a" },
    rare: { n: "珍品", c: "#6fb0d8" },
    epic: { n: "史诗", c: "#c9a86a" },
    legendary: { n: "传说", c: "#e0a84c" },
    mythic: { n: "神话", c: "#ff6b81" },
    exotic: { n: "异品", c: "#b28dff" }
  };
  const InspirationDice = {
    esc(s) {
      return String(s != null ? s : "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    },
    ready() {
      return !!window.FantasyNames;
    },
    async _ensureLib() {
      return window.loadLibOnce ? window.loadLibOnce(LIB, "FantasyNames") : false;
    },
    /* ==================== 掷取 ==================== */
    /** 掷一类 n 个（返回 [{name, rarity?}]；库缺失返回 []） */
    async roll(catKey, n = 1) {
      if (!await this._ensureLib()) return [];
      const cat = CATS.find((c) => c.key === catKey);
      if (!cat || typeof window.FantasyNames[cat.fn] !== "function") return [];
      let out;
      try {
        out = window.FantasyNames[cat.fn](Math.max(1, Math.min(12, n)));
      } catch (e) {
        return [];
      }
      return (Array.isArray(out) ? out : [out]).map((x) => {
        if (typeof x === "string") return { name: x };
        return { name: String((x == null ? void 0 : x.name) || ""), rarity: String((x == null ? void 0 : x.rarity) || "") };
      }).filter((x) => x.name);
    },
    /** 机缘卡：法宝 + 功法 + 丹药 + 生灵 + 材料 一套奇遇素材 */
    async rollFortune() {
      const [tal, skill, alch, cre, mat] = await Promise.all([
        this.roll("talisman", 1),
        this.roll("skill", 1),
        this.roll("alchemy", 1),
        this.roll("creature", 1),
        this.roll("material", 1)
      ]);
      return [...tal, ...skill, ...alch, ...cre, ...mat];
    },
    /** 开宗立派：门派 + 地点 + 国度 的势力雏形 */
    async rollSect() {
      const [clan, loc, nation] = await Promise.all([
        this.roll("clan", 1),
        this.roll("location", 1),
        this.roll("nation", 1)
      ]);
      return [...clan, ...loc, ...nation];
    },
    /* ==================== 结果渲染 ==================== */
    _cardHtml(item) {
      const r = item.rarity ? RARITY[item.rarity] || { n: item.rarity, c: "#9a8c6e" } : null;
      return `<span class="id-chip" ${r ? `style="border-color:${r.c}55;color:${r.c}" title="稀有度：${r.n}"` : ""}>
                ${r ? `<i>${r.n}</i>` : ""}${this.esc(item.name)}</span>`;
    },
    _render(hostId, items, label) {
      const host = document.getElementById(hostId);
      if (!host) return;
      if (!items.length) {
        host.innerHTML = '<div class="id-empty">骰盅未就绪（libs/fantasy-names.min.js 缺失）</div>';
        return;
      }
      host.innerHTML = `
                <div class="id-label">${this.esc(label)}</div>
                <div class="id-chips">${items.map((x) => this._cardHtml(x)).join("")}</div>`;
      this._last = items;
      this._pushHistory(label, items);
    },
    async rollUI(catKey, n) {
      const cat = CATS.find((c) => c.key === catKey);
      if (!cat) return;
      const items = await this.roll(catKey, n);
      this._render("diceResult", items, `${cat.ico} ${cat.label} × ${items.length || n}`);
    },
    async comboUI(kind) {
      const items = kind === "sect" ? await this.rollSect() : await this.rollFortune();
      this._render("diceResult", items, kind === "sect" ? "🏯 开宗立派" : "🎁 机缘卡");
    },
    /* ==================== 历史与送出 ==================== */
    _history() {
      try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      } catch (e) {
        return [];
      }
    },
    _pushHistory(label, items) {
      const h = this._history();
      h.unshift({ label, items: items.map((x) => ({ name: x.name, rarity: x.rarity || "" })), ts: Date.now() });
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX)));
      } catch (e) {
      }
    },
    clearHistory() {
      var _a;
      try {
        localStorage.removeItem(HISTORY_KEY);
      } catch (e) {
      }
      this._renderHistory();
      (_a = window.showToast) == null ? void 0 : _a.call(window, "🎲 骰子历史已清空", "info");
    },
    _renderHistory() {
      const host = document.getElementById("diceHistory");
      if (!host) return;
      const h = this._history();
      host.innerHTML = h.length ? h.map((rec) => `<div class="id-hist-row">
                    <b>${this.esc(rec.label)}</b>
                    <span>${rec.items.map((x) => this.esc(x.name)).join(" · ")}</span>
                  </div>`).join("") : '<div class="id-empty">暂无掷取记录</div>';
    },
    /** 当前结果送到输入框（作为写作指令的素材引子） */
    sendToInput() {
      var _a, _b, _c;
      const names = (this._last || []).map((x) => x.name).filter(Boolean);
      if (!names.length) {
        (_a = window.showToast) == null ? void 0 : _a.call(window, "先掷点什么再送", "info");
        return;
      }
      const input = document.getElementById("userInput");
      if (!input) {
        (_b = window.showToast) == null ? void 0 : _b.call(window, "输入框不可用", "error");
        return;
      }
      const prefix = "（写作素材，请自然织入后续情节，不必全部使用：";
      const text = `${prefix}${names.join("、")}）`;
      input.value = input.value ? `${input.value}
${text}` : text;
      input.focus();
      (_c = window.showToast) == null ? void 0 : _c.call(window, "🎲 素材已送入输入框，可直接发送或修改", "success");
      this.close();
    },
    copyResult() {
      var _a, _b, _c;
      const names = (this._last || []).map((x) => x.name).filter(Boolean);
      if (!names.length) {
        (_a = window.showToast) == null ? void 0 : _a.call(window, "先掷点什么再复制", "info");
        return;
      }
      const text = names.join("\n");
      if ((_b = navigator.clipboard) == null ? void 0 : _b.writeText) {
        navigator.clipboard.writeText(text).then(
          () => {
            var _a2;
            return (_a2 = window.showToast) == null ? void 0 : _a2.call(window, "📋 已复制到剪贴板", "success");
          },
          () => {
            var _a2;
            return (_a2 = window.showToast) == null ? void 0 : _a2.call(window, "复制失败，请手动选择", "error");
          }
        );
      } else {
        (_c = window.showToast) == null ? void 0 : _c.call(window, "此环境不支持剪贴板，请手动选择", "info");
      }
    },
    /* ==================== 面板 ==================== */
    open() {
      var _a;
      (_a = document.getElementById("dicePanel")) == null ? void 0 : _a.remove();
      const w = document.createElement("div");
      w.id = "dicePanel";
      w.innerHTML = `
            <div class="id-overlay" onclick="if(event.target===this)InspirationDice.close()">
                <div class="id-modal">
                    <div class="id-top"><b>🎲 灵感骰子</b><span class="id-sub">仙侠名词骰盅 · 十二类 · 七档稀有度</span>
                        <button class="id-x" onclick="InspirationDice.close()">✕</button></div>
                    <div class="id-body">
                        <div class="id-cats">
                            ${CATS.map((c) => `<button class="id-cat" onclick="InspirationDice.rollUI('${c.key}',1)">
                                <span class="id-cat-ico">${c.ico}</span><span>${c.label}</span></button>`).join("")}
                        </div>
                        <div class="id-combos">
                            <button class="id-combo gift" onclick="InspirationDice.comboUI('fortune')">🎁 掷机缘卡</button>
                            <button class="id-combo sect" onclick="InspirationDice.comboUI('sect')">🏯 掷开宗立派</button>
                            <button class="id-combo multi" onclick="InspirationDice.rollUI('name',5)">👤 掷五人</button>
                        </div>
                        <div id="diceResult" class="id-result"><div class="id-empty">点击上方类别开始掷取</div></div>
                        <div class="id-acts">
                            <button class="id-btn" onclick="InspirationDice.sendToInput()">✍️ 送到输入框</button>
                            <button class="id-btn" onclick="InspirationDice.copyResult()">📋 复制</button>
                        </div>
                        <div class="id-sec">掷取历史（${HISTORY_MAX} 条内）<button class="id-mini" onclick="InspirationDice.clearHistory()">清空</button></div>
                        <div id="diceHistory"></div>
                        <div class="id-note">词库来自 random_chinese_fantasy_names（MIT，本地文件零外联）。
                            「送到输入框」以写作指令形式交给主笔 AI，由它决定如何织入剧情。</div>
                    </div>
                </div>
            </div>`;
      document.body.appendChild(w);
      this._style();
      this._renderHistory();
    },
    close() {
      var _a;
      (_a = document.getElementById("dicePanel")) == null ? void 0 : _a.remove();
    },
    _style() {
      if (document.getElementById("inspDiceStyle")) return;
      const st = document.createElement("style");
      st.id = "inspDiceStyle";
      st.textContent = `
.id-overlay{position:fixed;inset:0;background:rgba(0,0,0,.62);backdrop-filter:blur(3px);z-index:9993;display:flex;align-items:center;justify-content:center;padding:18px}
.id-modal{width:min(560px,94vw);max-height:86vh;display:flex;flex-direction:column;background:linear-gradient(160deg,#211d17,#17140f);border:1px solid #c9a86a45;border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.6);overflow:hidden;animation:idIn .3s ease both}
@keyframes idIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.id-top{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid #c9a86a25}
.id-top b{color:#e8dcc0;font-size:15px;letter-spacing:1px}
.id-sub{font-size:11px;color:#9a8c6e;margin-right:auto}
.id-x{background:none;border:none;color:#9a8c6e;font-size:16px;cursor:pointer;padding:4px 8px}
.id-x:hover{color:#e8dcc0}
.id-body{padding:16px 18px 18px;overflow-y:auto;flex:1}
.id-cats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.id-cat{display:flex;flex-direction:column;align-items:center;gap:4px;background:rgba(201,168,106,.07);border:1px solid #c9a86a2e;color:#d8cba8;font-size:12px;padding:9px 4px;border-radius:10px;cursor:pointer;transition:all .18s}
.id-cat:hover{background:rgba(201,168,106,.18);transform:translateY(-1px)}
.id-cat-ico{font-size:17px}
.id-combos{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
.id-combo{flex:1;min-width:120px;background:rgba(201,168,106,.12);border:1px solid #c9a86a44;color:#e8dcc0;font-size:13px;padding:9px;border-radius:10px;cursor:pointer;transition:all .18s;letter-spacing:1px}
.id-combo:hover{background:rgba(201,168,106,.24)}
.id-combo.gift{border-color:#e0a84c55}
.id-combo.sect{border-color:#6fb0d855}
.id-combo.multi{border-color:#8fb89a55}
.id-result{margin-top:12px;background:rgba(0,0,0,.22);border:1px solid #c9a86a30;border-radius:12px;padding:13px 15px;min-height:64px}
.id-label{font-size:11px;color:#c9a86a;letter-spacing:2px;margin-bottom:8px}
.id-chips{display:flex;flex-wrap:wrap;gap:8px}
.id-chip{display:inline-flex;align-items:center;gap:6px;background:rgba(201,168,106,.08);border:1px solid #c9a86a35;color:#e8dcc0;border-radius:8px;padding:5px 10px;font-size:13px;letter-spacing:1px;animation:chipIn .25s ease both}
@keyframes chipIn{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:none}}
.id-chip i{font-style:normal;font-size:10px;color:#9a8c6e;border:1px solid currentColor;border-radius:4px;padding:0 4px;opacity:.8}
.id-acts{display:flex;gap:8px;margin-top:10px}
.id-btn{flex:1;background:rgba(201,168,106,.16);border:1px solid #c9a86a4a;color:#e8dcc0;font-size:13px;padding:9px;border-radius:9px;cursor:pointer;transition:all .18s;letter-spacing:1px}
.id-btn:hover{background:rgba(201,168,106,.28)}
.id-sec{display:flex;align-items:center;justify-content:space-between;font-size:11px;color:#c9a86a;letter-spacing:2px;margin:16px 0 8px}
.id-mini{background:none;border:1px solid #c9a86a35;color:#9a8c6e;font-size:10px;padding:2px 8px;border-radius:5px;cursor:pointer}
.id-mini:hover{color:#e8dcc0}
.id-hist-row{display:flex;gap:10px;font-size:11.5px;padding:5px 10px;background:rgba(255,255,255,.025);border-radius:7px;margin-bottom:4px}
.id-hist-row b{color:#c9a86a;flex-shrink:0;font-weight:500}
.id-hist-row span{color:#9a8c6e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.id-empty{font-size:12px;color:#8a7d63;text-align:center;padding:12px}
.id-note{font-size:11px;color:#8a7d63;line-height:1.9;margin-top:14px}
@media(max-width:480px){.id-cats{grid-template-columns:repeat(3,1fr)}}`;
      document.head.appendChild(st);
    }
  };
  window.InspirationDice = InspirationDice;
})();
