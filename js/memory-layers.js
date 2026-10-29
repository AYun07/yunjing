(function() {
  "use strict";
  const EXTRACT_EVERY = 5;
  const LAYER_MAX = 40;
  const LAYERS = ["facts", "relations", "secrets", "scenes", "arcs"];
  const LAYER_META = {
    facts: { icon: "👤", name: "角色事实", hint: "身份/能力/外貌等稳定属性" },
    relations: { icon: "🤝", name: "关系史", hint: "谁与谁发生了什么" },
    secrets: { icon: "🔒", name: "秘密与信息差", hint: "谁知道什么、谁被蒙在鼓里" },
    scenes: { icon: "🗺", name: "场景史", hint: "重要场景时间线" },
    arcs: { icon: "📖", name: "故事弧", hint: "主线/支线推进状态" }
  };
  const MemoryLayers = {
    esc(s) {
      return String(s != null ? s : "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    },
    /* ==================== 数据访问 ==================== */
    /** 五层记忆（读档兼容：脏档重置为空层） */
    layers() {
      var _a;
      const fw = window.storyFramework;
      const m = (_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.memoryLayers;
      if (m && typeof m === "object") {
        const out = {};
        for (const k of LAYERS) out[k] = Array.isArray(m[k]) ? m[k] : [];
        return out;
      }
      const empty = {};
      for (const k of LAYERS) empty[k] = [];
      return empty;
    },
    /** 上次提取到的轮次 */
    lastTurn() {
      var _a, _b, _c;
      return Number((_c = (_b = (_a = window.storyFramework) == null ? void 0 : _a.storyState) == null ? void 0 : _b.memoryLayers) == null ? void 0 : _c._upTo) || 0;
    },
    stats() {
      const l = this.layers();
      const total = LAYERS.reduce((a, k) => a + l[k].length, 0);
      /* v3.38.1 兼容：Object.fromEntries 需 Chrome 73+，旧内核无此方法——改用 forEach 构建 */
      const per = {};
      LAYERS.forEach((k) => { per[k] = l[k].length; });
      return { total, per };
    },
    /* ==================== 提取（变量AI 通道） ==================== */
    /** 是否到提取时机（故事已开篇 && 距上次满 5 轮 && 有新正文） */
    due() {
      var _a;
      const fw = window.storyFramework;
      if (!((_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.isStoryStarted)) return false;
      const turn = Number(fw.storyState.turnCount) || 0;
      return turn - this.lastTurn() >= EXTRACT_EVERY;
    },
    ready() {
      return !!(window.VariableAI && window.VariableAI.recapReady && window.VariableAI.recapReady());
    },
    /**
     * 提取：变量AI 通读「上次提取点 → 最新」的正文，输出五层结构化记忆
     * 输出格式（JSON）：{ facts:[...], relations:[...], secrets:[...], scenes:[...], arcs:[...] }
     */
    async extract(manual = false) {
      var _a, _b, _c, _d, _e, _f, _g;
      const fw = window.storyFramework;
      if (!((_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.isStoryStarted)) {
        if (manual) (_b = window.showToast) == null ? void 0 : _b.call(window, "故事尚未开篇，无记忆可提取", "info");
        return false;
      }
      if (!this.ready()) {
        if (manual) (_c = window.showToast) == null ? void 0 : _c.call(window, "记忆提取需要任一 AI 接口就绪（摘要官 / 变量AI / 主笔）", "error");
        return false;
      }
      if (this._busy) return false;
      const hist = fw.storyState.conversationHistory || [];
      const from = this.lastTurn();
      const recent = [];
      for (let i = hist.length - 1; i >= 0 && recent.length < 10; i--) {
        if (hist[i].role !== "assistant") continue;
        let body = String(hist[i].content || "").replace(/\(variable_update\)[\s\S]*?\(\/variable_update\)/gi, "").trim();
        if (body) recent.unshift(body);
      }
      if (!recent.length) {
        if (manual) (_d = window.showToast) == null ? void 0 : _d.call(window, "暂无正文可提取", "info");
        return false;
      }
      this._busy = true;
      try {
        const text = recent.join("\n\n────\n\n").slice(0, 12e3);
        const existing = this.layers();
        const existingBrief = LAYERS.map((k) => {
          const items = existing[k].slice(-5).map((x) => `- ${x.who || ""}${x.who ? "：" : ""}${x.what}`).join("\n");
          return items ? `【已有${LAYER_META[k].name}（最近，勿重复登记）】
${items}` : "";
        }).filter(Boolean).join("\n\n");
        const out = await window.VariableAI.recapCall([
          {
            role: "system",
            content: `你是小说工坊的"记忆登记官"。请从正文中提取长期记忆，严格输出一个 JSON 对象（不要 markdown 代码块、不要解释），五层结构：
{
  "facts": [ {"who":"角色名","what":"稳定事实（身份/能力/外貌，已确立的）"} ],
  "relations": [ {"who":"甲↔乙","what":"关系变化一句话"} ],
  "secrets": [ {"who":"知情者","what":"秘密内容（谁知道什么事）"} ],
  "scenes": [ {"who":"地点","what":"该处发生的关键事件一句话"} ],
  "arcs": [ {"who":"主线/支线名","what":"当前推进到哪一步"} ]
}
规则：
1. 只登记"新发生/新确立"的信息，与已有记忆重复的不要登记
2. 每条不超过 40 字，who 可空
3. 无可登记内容的层给空数组
4. 数量克制：每层至多 6 条（挑最重要的）`
          },
          {
            role: "user",
            content: `${existingBrief ? existingBrief + "\n\n" : ""}【近期正文】
${text}`
          }
        ]);
        const parsed = this._parseJSON(out);
        if (!parsed) throw new Error("提取输出不是合法 JSON");
        const merged = this._merge(existing, parsed);
        fw.storyState.memoryLayers = { ...merged, _upTo: Number(fw.storyState.turnCount) || 0, _ts: Date.now() };
        (_e = fw.saveStory) == null ? void 0 : _e.call(fw);
        const n = LAYERS.reduce((a, k) => a + (parsed[k] ? parsed[k].length : 0), 0);
        console.log(`[记忆分层] 提取完成：新增 ${n} 条，累计 ${this.stats().total} 条`);
        if (manual) (_f = window.showToast) == null ? void 0 : _f.call(window, `✓ 记忆提取完成：新增 ${n} 条，五层累计 ${this.stats().total} 条`, "success");
        return true;
      } catch (e) {
        console.error("[记忆分层] 提取失败:", e);
        if (manual) (_g = window.showToast) == null ? void 0 : _g.call(window, `记忆提取失败：${e.message}`, "error");
        return false;
      } finally {
        this._busy = false;
      }
    },
    /** 宽松解析 JSON（剥离 markdown 围栏 / 前后杂文） */
    _parseJSON(text) {
      let s = String(text || "").trim();
      s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
      const start = s.indexOf("{");
      const end = s.lastIndexOf("}");
      if (start < 0 || end <= start) return null;
      try {
        const o = JSON.parse(s.slice(start, end + 1));
        if (o && typeof o === "object") return o;
      } catch (e) {
        try {
          const fixed = s.slice(start, end + 1).replace(/'/g, '"').replace(/,\s*([}\]])/g, "$1");
          const o = JSON.parse(fixed);
          if (o && typeof o === "object") return o;
        } catch (e2) {
        }
      }
      return null;
    },
    /** 合并新层入旧层（去重：who+what 完全相同跳过），每层裁剪到上限 */
    _merge(existing, fresh) {
      const out = {};
      for (const k of LAYERS) {
        const old = Array.isArray(existing[k]) ? existing[k] : [];
        const add = Array.isArray(fresh == null ? void 0 : fresh[k]) ? fresh[k] : [];
        const seen = new Set(old.map((x) => `${String((x == null ? void 0 : x.who) || "").trim()}|${String((x == null ? void 0 : x.what) || "").trim()}`));
        const valid = [];
        for (const it of add) {
          if (!it || typeof it !== "object") continue;
          const what = String(it.what || "").trim();
          if (!what) continue;
          const key = `${String(it.who || "").trim()}|${what}`;
          if (seen.has(key)) continue;
          seen.add(key);
          valid.push({ who: String(it.who || "").trim().slice(0, 24), what: what.slice(0, 80), ts: Date.now() });
        }
        out[k] = [...old, ...valid].slice(-LAYER_MAX);
      }
      return out;
    },
    /* ==================== 注入（AI 上下文） ==================== */
    /**
     * 按本轮上下文挑相关记忆：正文/指令里提到的角色名命中 L1-L3，
     * L4/L5 全量取最近几条。产出一条 system 消息（null = 无可注入）。
     */
    buildInjection(userMessage, history = []) {
      var _a;
      const fw = window.storyFramework;
      if (!((_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.memoryLayers)) return null;
      const l = this.layers();
      if (!LAYERS.some((k) => l[k].length)) return null;
      const parts = [String(userMessage || "")];
      let used = 0;
      for (let i = history.length - 1; i >= 0 && used < 2; i--) {
        if (history[i].role !== "assistant") continue;
        parts.push(String(history[i].content || "").replace(/\(variable_update\)[\s\S]*?\(\/variable_update\)/gi, ""));
        used++;
      }
      const windowText = parts.join("\n");
      const person = (arr, max) => {
        const hits = arr.filter((x) => x.who && windowText.includes(x.who));
        return (hits.length ? hits : arr.slice(-max)).slice(-max);
      };
      const facts = person(l.facts, 8);
      const relations = person(l.relations, 6);
      const secrets = person(l.secrets, 4);
      const scenes = l.scenes.slice(-5);
      const arcs = l.arcs.slice(-3);
      const block = [];
      if (facts.length) block.push(`👤 角色事实：
${facts.map((x) => `· ${x.who ? x.who + "：" : ""}${x.what}`).join("\n")}`);
      if (relations.length) block.push(`🤝 关系史：
${relations.map((x) => `· ${x.who ? x.who + "：" : ""}${x.what}`).join("\n")}`);
      if (secrets.length) block.push(`🔒 秘密与信息差（角色视角须知，未揭穿前不得让不知情角色表现得知情）：
${secrets.map((x) => `· ${x.who ? x.who + "：" : ""}${x.what}`).join("\n")}`);
      if (scenes.length) block.push(`🗺 场景史：
${scenes.map((x) => `· ${x.who ? x.who + "：" : ""}${x.what}`).join("\n")}`);
      if (arcs.length) block.push(`📖 故事弧：
${arcs.map((x) => `· ${x.who ? x.who + "：" : ""}${x.what}`).join("\n")}`);
      if (!block.length) return null;
      return {
        role: "system",
        content: `【长期记忆（分层登记，写作时保持一致，严禁与下述既定事实矛盾）】

${block.join("\n\n")}`
      };
    },
    /* ==================== UI：面板 ==================== */
    open() {
      var _a;
      (_a = document.getElementById("memLayerPanel")) == null ? void 0 : _a.remove();
      const s = this.stats();
      const due = this.due();
      const body = `
                <div class="ml-head-line">
                    🧠 五层记忆 · 累计 ${s.total} 条
                    <i>上次提取至第 ${this.lastTurn()} 轮${due ? " · 已到提取时机" : ` · ${EXTRACT_EVERY} 轮一提`}</i>
                </div>
                ${LAYERS.map((k) => {
        const meta = LAYER_META[k];
        const items = this.layers()[k];
        return `
                <div class="ml-sec">
                    <div class="ml-sec-head">${meta.icon} ${meta.name} <i>${meta.hint} · ${items.length} 条</i></div>
                    ${items.length ? items.slice().reverse().map((x) => `
                        <div class="ml-item">
                            <span class="ml-who">${this.esc(x.who || "—")}</span>
                            <span class="ml-what">${this.esc(x.what)}</span>
                            <button class="ml-del" onclick="MemoryLayers.remove('${k}', ${items.indexOf(x)})" title="删除这条">✕</button>
                        </div>`).join("") : '<div class="ml-empty">（暂无记录——写起来，提取后这里会长出记忆）</div>'}
                </div>`;
      }).join("")}
                <div class="ml-actions">
                    <button class="ml-btn primary" onclick="MemoryLayers.extract(true)">✦ 立即提取一次</button>
                    <button class="ml-btn danger" onclick="MemoryLayers.clear()">🗑 清空全部记忆</button>
                </div>
                <div class="ml-note">提取链路复用变量AI第三接口（摘要官 > 变量AI > 主笔兜底），每 ${EXTRACT_EVERY} 轮自动执行一次；注入时按本轮提及角色智能挑选相关层。秘密层的「信息差」会明确告知 AI 谁不知情——防止配角未卜先知。</div>`;
      const w = document.createElement("div");
      w.id = "memLayerPanel";
      w.innerHTML = `
            <div class="ml-overlay" onclick="if(event.target===this)MemoryLayers.close()">
                <div class="ml-modal">
                    <div class="ml-top"><b>🧠 记忆分层</b><span class="ml-sub">Smart-Memory 式五层长期记忆</span>
                        <button class="ml-x" onclick="MemoryLayers.close()">✕</button></div>
                    <div class="ml-body">${body}</div>
                </div>
            </div>`;
      document.body.appendChild(w);
      if (!document.getElementById("memLayerStyle")) {
        const st = document.createElement("style");
        st.id = "memLayerStyle";
        st.textContent = `
.ml-overlay{position:fixed;inset:0;background:rgba(0,0,0,.62);backdrop-filter:blur(3px);z-index:9993;display:flex;align-items:center;justify-content:center;padding:18px}
.ml-modal{width:min(640px,94vw);max-height:86vh;display:flex;flex-direction:column;background:linear-gradient(160deg,#211d17,#17140f);border:1px solid #c9a86a45;border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.6);overflow:hidden;animation:mlIn .3s ease both}
@keyframes mlIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.ml-top{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid #c9a86a25}
.ml-top b{color:#e8dcc0;font-size:15px;letter-spacing:1px}
.ml-sub{font-size:11px;color:#9a8c6e;margin-right:auto}
.ml-x{background:none;border:none;color:#9a8c6e;font-size:16px;cursor:pointer;padding:4px 8px}
.ml-x:hover{color:#e8dcc0}
.ml-body{padding:16px 18px 18px;overflow-y:auto;flex:1}
.ml-head-line{font-size:13.5px;color:#e8dcc0;letter-spacing:1px;margin-bottom:13px}
.ml-head-line i{font-style:normal;font-size:11px;color:#9a8c6e;margin-left:8px}
.ml-sec{margin-bottom:14px}
.ml-sec-head{font-size:12px;color:#c9a86a;letter-spacing:1.5px;margin-bottom:7px;padding-bottom:5px;border-bottom:1px dashed #c9a86a30}
.ml-sec-head i{font-style:normal;color:#8a7d63;font-size:10.5px;margin-left:6px}
.ml-item{display:flex;align-items:flex-start;gap:8px;padding:6px 10px;background:rgba(255,255,255,.03);border-radius:8px;margin-bottom:4px;font-size:12px;line-height:1.7}
.ml-who{color:#d8cba8;font-weight:600;min-width:72px;flex-shrink:0}
.ml-what{color:#bdb08e;flex:1}
.ml-del{background:none;border:none;color:#6e6a5e;cursor:pointer;font-size:11px;padding:2px 4px;flex-shrink:0}
.ml-del:hover{color:#d87a7a}
.ml-empty{font-size:11.5px;color:#8a7d63;padding:6px 10px}
.ml-actions{display:flex;gap:9px;margin-top:16px;padding-top:13px;border-top:1px dashed #c9a86a30}
.ml-btn{background:rgba(201,168,106,.14);border:1px solid #c9a86a44;color:#d8cba8;font-size:12px;padding:8px 14px;border-radius:9px;cursor:pointer;transition:all .2s}
.ml-btn:hover{background:rgba(201,168,106,.26)}
.ml-btn.primary{background:rgba(201,168,106,.24);border-color:#c9a86a88}
.ml-btn.danger{border-color:#d87a7a55;color:#d8a8a8}
.ml-btn.danger:hover{background:rgba(216,122,122,.14)}
.ml-note{font-size:11px;color:#8a7d63;line-height:1.9;margin-top:11px}`;
        document.head.appendChild(st);
      }
    },
    close() {
      var _a;
      (_a = document.getElementById("memLayerPanel")) == null ? void 0 : _a.remove();
    },
    remove(layer, idx) {
      var _a;
      const fw = window.storyFramework;
      const l = this.layers();
      if (!Array.isArray(l[layer]) || idx < 0 || idx >= l[layer].length) return;
      l[layer].splice(idx, 1);
      fw.storyState.memoryLayers = { ...l, _upTo: this.lastTurn(), _ts: Date.now() };
      (_a = fw.saveStory) == null ? void 0 : _a.call(fw);
      this.open();
    },
    clear() {
      var _a;
      if (!((_a = window.UIDialog) == null ? void 0 : _a.confirm)) {
        if (!confirm("确定清空全部五层记忆？（不可恢复）")) return;
      } else {
        window.UIDialog.confirm({ title: "清空记忆", message: "确定清空全部五层长期记忆？此操作不可恢复。" }).then((ok) => {
          if (ok) this._doClear();
        });
        return;
      }
      this._doClear();
    },
    _doClear() {
      var _a, _b;
      const fw = window.storyFramework;
      const empty = {};
      for (const k of LAYERS) empty[k] = [];
      fw.storyState.memoryLayers = { ...empty, _upTo: Number(fw.storyState.turnCount) || 0, _ts: Date.now() };
      (_a = fw.saveStory) == null ? void 0 : _a.call(fw);
      this.open();
      (_b = window.showToast) == null ? void 0 : _b.call(window, "五层记忆已清空", "success");
    },
    /* ==================== 安装（挂自动提取钩子） ==================== */
    install() {
      if (this._installed) return;
      this._installed = true;
      const hook = () => {
        if (!this.due()) return;
        setTimeout(() => {
          this.extract().catch((e) => console.error("[记忆分层] 自动提取失败:", e));
        }, 8e3);
      };
      document.addEventListener("story:turn-saved", hook);
      this._timer = setInterval(() => {
        if (this.due()) this.extract().catch(() => {
        });
      }, 12e4);
      console.log("[记忆分层] 已安装（每 " + EXTRACT_EVERY + " 轮自动提取）");
    }
  };
  window.MemoryLayers = MemoryLayers;
})();
