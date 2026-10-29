(function() {
  "use strict";
  const ChannelHub = {
    PREFIX: "storyChannel.",
    /* 面板内存态（不落盘）：已拉取的模型列表 + 同源缓存（endpoint+Key 相同的通道间共享） */
    _fetched: {},
    _modelCache: {},
    defaults: {
      type: "openai",
      endpoint: "",
      apiKey: "",
      model: "",
      maxTokens: 4096,
      temperature: 0.7,
      timeout: 90
    },
    /* ==================== 通道定义 ==================== */
    DEFS: {
      scribe: {
        id: "scribe",
        icon: "📝",
        name: "摘要官",
        desc: "滚动摘要 · 前情提要压缩",
        chain: ["scribe", "registrar", "lead"],
        suggest: "便宜长上下文（128K+ / flash 级）——量大但要求不高"
      },
      critic: {
        id: "critic",
        icon: "🔍",
        name: "责编官",
        desc: "责编自审 · 章节质检评分",
        chain: ["critic", "registrar", "lead"],
        suggest: "强推理（R1 / o 系级）——毒辣眼光，低频高值"
      },
      troupe: {
        id: "troupe",
        icon: "🎭",
        name: "群演道",
        desc: "角色密谈 · 读者来信 · 小云管家",
        chain: ["troupe", "oracle", "lead"],
        suggest: "便宜快出（flash 级）——群演台词不值得烧主笔"
      },
      stylist: {
        id: "stylist",
        icon: "🎨",
        name: "文风道",
        desc: "文风画像深度诊断（可选）",
        chain: ["stylist", "troupe", "lead"],
        suggest: "任意（留空 = 纯本地统计，不调用）"
      }
    },
    /* 伪通道：不在本面板配置，只显示状态与去向 */
    PSEUDO: {
      lead: { icon: "🖋", name: "主笔", where: "顶部 · AI 设置", cfg: () => {
        var _a;
        return (_a = window.storyFramework) == null ? void 0 : _a.apiConfig;
      }, ready: () => {
        var _a, _b;
        return !!((_b = (_a = window.storyFramework) == null ? void 0 : _a.isApiConfigured) == null ? void 0 : _b.call(_a));
      } },
      registrar: { icon: "🧾", name: "登记官", where: "变量AI 第三接口", cfg: () => {
        var _a, _b;
        return (_b = (_a = window.VariableAI) == null ? void 0 : _a.get) == null ? void 0 : _b.call(_a);
      }, ready: () => {
        var _a, _b;
        return !!((_b = (_a = window.VariableAI) == null ? void 0 : _a.isEnabled) == null ? void 0 : _b.call(_a));
      } },
      oracle: { icon: "🌍", name: "推演官", where: "世界动态 额外API", cfg: () => {
        var _a, _b;
        return (_b = (_a = window.DynamicWorld) == null ? void 0 : _a.getExtraApi) == null ? void 0 : _b.call(_a);
      }, ready: () => {
        var _a, _b;
        return !!((_b = (_a = window.DynamicWorld) == null ? void 0 : _a.isExtraReady) == null ? void 0 : _b.call(_a));
      } }
    },
    /* ==================== 配置存取 ==================== */
    get(id) {
      try {
        return { ...this.defaults, ...JSON.parse(localStorage.getItem(this.PREFIX + id) || "{}") };
      } catch (e) {
        return { ...this.defaults };
      }
    },
    save(id, cfg) {
      try {
        localStorage.setItem(this.PREFIX + id, JSON.stringify(cfg));
      } catch (e) {
      }
    },
    clear(id) {
      try {
        localStorage.removeItem(this.PREFIX + id);
      } catch (e) {
      }
    },
    /** 通道就绪 = 地址 / Key / 模型 三项填全 */
    ready(id) {
      const c = this.get(id);
      return !!(c.endpoint && c.apiKey && c.model);
    },
    /* ==================== 链解析 ==================== */
    /** 节点配置解析：伪通道读各自模块，通道读注册表 */
    nodeCfg(node) {
      if (node === "lead") {
        const fw = window.storyFramework;
        return fw && fw.isApiConfigured && fw.isApiConfigured() ? fw.apiConfig : null;
      }
      if (this.PSEUDO[node]) {
        const p = this.PSEUDO[node];
        return p.ready && p.ready() ? p.cfg ? p.cfg() : null : null;
      }
      return this.ready(node) ? this.get(node) : null;
    },
    /** 该角色当前实际会走哪个节点（首个就绪者）：{node, name} 或 null */
    resolveUsed(role) {
      const def = this.DFS[role];
      if (!def) return null;
      for (const n of def.chain) {
        if (this.nodeCfg(n)) return { node: n, name: this._nn(n) };
      }
      return null;
    },
    /** 该角色是否可调用（链上任意节点就绪） */
    canCall(role) {
      return !!this.resolveUsed(role);
    },
    /** 兜底链描述（面板展示）："群演道 → 推演官 → 主笔" */
    chainText(role) {
      const def = this.DFS[role];
      return def ? def.chain.map((n) => this._nn(n)).join(" → ") : "";
    },
    _nn(node) {
      if (this.PSEUDO[node]) return this.PSEUDO[node].name;
      return this.DFS[node] ? this.DFS[node].name : node;
    },
    /* ==================== 统一分发 ==================== */
    /**
     * 按角色调用：沿兜底链取首个就绪节点，失败自动降级到下一节点。
     * 全节点统一走 callOpenAI / callGemini（cfgOverride），流式回调保留。
     * @param {string} role scribe | critic | troupe | stylist
     * @param {Array} messages 消息数组
     * @param {object} opts { onDelta } 打字机回调（仅流式通道有意义）
     * @returns {Promise<string>} 回复文本；全链不可用抛错
     */
    async call(role, messages, opts = {}) {
      var _a, _b;
      const def = this.DFS[role];
      if (!def) throw new Error(`未知通道角色：${role}`);
      const tried = [];
      let lastErr = null;
      for (const node of def.chain) {
        const cfg = this.nodeCfg(node);
        if (!cfg) continue;
        const name = this._nn(node);
        tried.push(name);
        try {
          (_a = window.TokenUsage) == null ? void 0 : _a.recordRequest(messages, name);
          const out = cfg.type === "gemini" ? await callGemini(messages, opts, cfg) : await callOpenAI(messages, opts, cfg);
          (_b = window.TokenUsage) == null ? void 0 : _b.recordOutput(out, name);
          if (!String(out || "").trim()) throw new Error("空回复");
          return out;
        } catch (e) {
          lastErr = e;
          console.warn(`[ChannelHub] ${def.name}·${name} 失败，降级下一节点：${e.message}`);
        }
      }
      throw new Error(tried.length ? `「${def.name}」全链失败（${tried.join(" → ")}）：${(lastErr == null ? void 0 : lastErr.message) || "未知错误"}` : `「${def.name}」无可用通道（本道与兜底链均未配置）`);
    },
    /** 连通测试（表单未保存也可测）：ping 一句应答 */
    async test(id, formCfg) {
      const cfg = formCfg ? { ...this.defaults, ...formCfg } : this.get(id);
      if (!(cfg.endpoint && cfg.apiKey && cfg.model)) throw new Error("地址 / Key / 模型 未填全");
      const out = cfg.type === "gemini" ? await callGemini([{ role: "user", content: '你好，请回复"连接成功"四个字。' }], {}, cfg) : await callOpenAI([{ role: "user", content: '你好，请回复"连接成功"四个字。' }], {}, cfg);
      return String(out || "").trim();
    },
    /* ==================== 管理面板 ==================== */
    open() {
      const hubs = Object.values(this.DFS).map((d) => this._hubCard(d)).join("");
      const pseudos = Object.values(this.PSEUDO).map((p) => `
                <div class="ch-fixed">
                    <span class="ch-fix-ico">${p.icon}</span>
                    <div class="ch-fix-mid">
                        <b>${p.name}</b><i>${p.where}</i>
                    </div>
                    <span class="ch-badge ${p.ready() ? "ok" : "off"}">${p.ready() ? "✓ 就绪" : "未配置"}</span>
                </div>`).join("");
      const html = `
            <div class="ch-overlay" onclick="if(event.target===this)ChannelHub.close()">
                <div class="ch-modal">
                    <div class="ch-head">
                        <b>🔌 AI 通道枢纽</b>
                        <button class="ch-x" onclick="ChannelHub.close()">✕</button>
                    </div>
                    <div class="ch-body">
                        <p class="ch-tip">后台任务各走各的道，杂活不再烧主笔的钱。
                        <b>每条通道留空即自动走兜底链</b>（右侧箭头顺序降级）——不配置照样能用，只是不分道。
                        聚合商（OpenRouter / 硅基流动等）一个 Key 挂多模型时分道收益最大。</p>
                        ${hubs}
                        <div class="ch-sec">既有通道（在各自设置页配置）</div>
                        ${pseudos}
                    </div>
                </div>
            </div>`;
      const old = document.getElementById("chModal");
      if (old) old.remove();
      const wrap = document.createElement("div");
      wrap.id = "chModal";
      wrap.innerHTML = html;
      document.body.appendChild(wrap);
    },
    _hubCard(d) {
      const c = this.get(d.id);
      const used = this.resolveUsed(d.id);
      const isSelf = used && used.node === d.id;
      const fetched = this._fetched[d.id];
      const selHTML = fetched && fetched.models.length ? `
                    <select class="ch-sel ch-model-sel" id="chModelSel_${d.id}" onchange="ChannelHub.pickModelUI('${d.id}',this.value)">
                        ${fetched.models.map((m) => `<option value="${ChannelHub.esc(m)}" ${m === c.model ? "selected" : ""}>${ChannelHub.esc(m)}</option>`).join("")}
                    </select>` : "";
      return `
            <div class="ch-card" id="chCard_${d.id}">
                <div class="ch-card-head">
                    <span class="ch-ico">${d.icon}</span>
                    <div class="ch-mid">
                        <b>${d.name}<i>${d.desc}</i></b>
                    </div>
                    <span class="ch-badge ${this.ready(d.id) ? "ok" : "off"}">${this.ready(d.id) ? "✓ 已配置" : "空 · 走兜底"}</span>
                </div>
                <div class="ch-row">
                    <select class="ch-sel" id="chType_${d.id}" onchange="ChannelHub.field('${d.id}','type',this.value)">
                        <option value="openai" ${c.type !== "gemini" ? "selected" : ""}>OpenAI 格式</option>
                        <option value="gemini" ${c.type === "gemini" ? "selected" : ""}>Gemini 格式</option>
                    </select>
                    <input class="ch-inp" id="chEndpoint_${d.id}" placeholder="接口地址 endpoint" value="${ChannelHub.esc(c.endpoint)}" onchange="ChannelHub.field('${d.id}','endpoint',this.value)">
                </div>
                <div class="ch-row">
                    <input class="ch-inp" type="password" id="chKey_${d.id}" placeholder="API Key" value="${ChannelHub.esc(c.apiKey)}" onchange="ChannelHub.field('${d.id}','apiKey',this.value)">
                    <input class="ch-inp" id="chModel_${d.id}" placeholder="模型名 model" value="${ChannelHub.esc(c.model)}" onchange="ChannelHub.field('${d.id}','model',this.value)">
                </div>
                <div class="ch-row">
                    <button class="ch-btn ch-fetch" id="chFetch_${d.id}" onclick="ChannelHub.fetchModelsUI('${d.id}')">📋 获取模型列表（按地址 + Key 自动拉取）</button>
                </div>
                ${selHTML}
                <div class="ch-hint" id="chHint_${d.id}" style="display:none"></div>
                <div class="ch-foot-row">
                    <span class="ch-chain">${this.chainText(d.id)}${used ? `<i class="${isSelf ? "self" : ""}">当前实际走：${used.name}</i>` : '<i class="none">全链未配置</i>'}</span>
                    <span class="ch-btns">
                        <button class="ch-btn" onclick="ChannelHub.testUI('${d.id}')">⚡ 测试</button>
                        ${this.ready(d.id) ? `<button class="ch-btn warn" onclick="ChannelHub.clearUI('${d.id}')">清除</button>` : ""}
                    </span>
                </div>
                <div class="ch-suggest">💡 ${d.suggest}</div>
            </div>`;
    },
    field(id, k, v) {
      var _a;
      const c = this.get(id);
      c[k] = String(v || "").trim();
      this.save(id, c);
      if (k === "type" || k === "endpoint" || k === "apiKey") delete this._fetched[id];
      (_a = window.showToast) == null ? void 0 : _a.call(window, "已保存", "info");
      this.open();
    },
    /* ==================== 模型列表自动获取（v3.7.1） ==================== */
    /** 读表单当前值（未保存也可测/拉）；面板未开时返回 null */
    _formCfg(id) {
      const g = (k) => {
        var _a;
        return (((_a = document.getElementById(`ch${k}_${id}`)) == null ? void 0 : _a.value) || "").trim();
      };
      const type = g("Type"), endpoint = g("Endpoint"), apiKey = g("Key"), model = g("Model");
      if (!endpoint && !apiKey && !model && !type) return null;
      return { ...this.get(id), type: type || "openai", endpoint, apiKey, model };
    },
    /**
     * 拉取模型列表：读表单值（不必先保存）→ fetchOpenAI/GeminiModels →
     * 下拉渲染（open() 从 _fetched 恢复）。同源缓存：type|endpoint|key 相同
     * 直接复用——聚合商一个 Key 挂四条通道时只拉一次。
     */
    async fetchModelsUI(id) {
      const g = (k) => {
        var _a;
        return (((_a = document.getElementById(`ch${k}_${id}`)) == null ? void 0 : _a.value) || "").trim();
      };
      const type = g("Type") || "openai";
      const endpoint = g("Endpoint"), apiKey = g("Key");
      const hint = document.getElementById("chHint_" + id);
      const btn = document.getElementById("chFetch_" + id);
      if (!endpoint || !apiKey) {
        if (hint) {
          hint.style.display = "block";
          hint.style.color = "#e07070";
          hint.textContent = "✕ 请先填写接口地址与 API Key，再获取模型列表";
        }
        return;
      }
      if (btn) {
        btn.disabled = true;
        btn.textContent = "⏳ 获取中…";
      }
      try {
        const ck = type + "|" + endpoint + "|" + apiKey;
        let models = this._modelCache[ck];
        const fromCache = !!models;
        if (!models) {
          models = type === "gemini" ? await fetchGeminiModels(endpoint, apiKey) : await fetchOpenAIModels(endpoint, apiKey);
          this._modelCache[ck] = models;
        }
        if (!models || !models.length) throw new Error("接口未返回任何模型（可能不支持列表查询，请手填模型名）");
        this._fetched[id] = { models, at: Date.now(), fromCache };
        const c = this.get(id);
        if (!c.model) {
          c.model = models[0];
          this.save(id, c);
        }
        this.open();
        const h2 = document.getElementById("chHint_" + id);
        if (h2) {
          h2.style.display = "block";
          h2.style.color = "#a8d8a0";
          h2.textContent = `✓ 已获取 ${models.length} 个模型${fromCache ? "（同源缓存命中）" : ""}——下拉选择或继续手填`;
        }
      } catch (e) {
        if (btn) {
          btn.disabled = false;
          btn.textContent = "📋 获取模型列表（按地址 + Key 自动拉取）";
        }
        if (hint) {
          hint.style.display = "block";
          hint.style.color = "#e07070";
          hint.textContent = `✕ ${e.message}（可检查地址是否需含 /v1，或直接手填模型名）`;
        }
      }
    },
    /** 下拉选中 → 写入模型名并保存（重渲染后下拉从 _fetched 恢复并保持选中） */
    pickModelUI(id, val) {
      const inp = document.getElementById("chModel_" + id);
      if (inp) inp.value = val;
      this.field(id, "model", val);
    },
    async testUI(id) {
      var _a, _b, _c;
      const form = this._formCfg(id) || this.get(id);
      (_a = window.showToast) == null ? void 0 : _a.call(window, "正在测试连通…", "info");
      try {
        const out = await this.test(id, form);
        (_b = window.showToast) == null ? void 0 : _b.call(window, `✅ ${this.DFS[id].name} 连接成功：${out.slice(0, 24)}`, "success");
      } catch (e) {
        (_c = window.showToast) == null ? void 0 : _c.call(window, `❌ 测试失败：${e.message.slice(0, 90)}`, "error");
      }
    },
    clearUI(id) {
      var _a;
      this.clear(id);
      delete this._fetched[id];
      (_a = window.showToast) == null ? void 0 : _a.call(window, `已清除「${this.DFS[id].name}」配置——回归兜底链`, "info");
      this.open();
    },
    esc(s) {
      return String(s != null ? s : "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    },
    close() {
      var _a;
      (_a = document.getElementById("chModal")) == null ? void 0 : _a.remove();
    },
    /* 内部别名（DEFS 即通道表，DFS 为防拼写误引的统一入口） */
    get DFS() {
      return this.DEFS;
    }
  };
  if (!document.getElementById("chStyle")) {
    const st = document.createElement("style");
    st.id = "chStyle";
    st.textContent = `
.ch-overlay{position:fixed;inset:0;background:rgba(0,0,0,.62);backdrop-filter:blur(3px);z-index:9994;display:flex;align-items:center;justify-content:center;padding:18px}
.ch-modal{width:min(680px,94vw);max-height:86vh;display:flex;flex-direction:column;background:linear-gradient(160deg,#1d1a15,#141210);border:1px solid #c9a86a45;border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.6);overflow:hidden}
.ch-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #c9a86a25}
.ch-head b{color:#e8dcc0;font-size:15px;letter-spacing:1px}
.ch-x{background:none;border:none;color:#9a8c6e;font-size:16px;cursor:pointer;padding:4px 8px}
.ch-x:hover{color:#e8dcc0}
.ch-body{padding:14px 18px;overflow-y:auto;flex:1}
.ch-tip{font-size:12px;line-height:1.8;color:#9a8c6e;margin:0 0 14px}
.ch-tip b{color:#d8cba8}
.ch-card{background:#c9a86a0d;border:1px solid #c9a86a28;border-radius:12px;padding:12px 14px;margin-bottom:12px}
.ch-card-head{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.ch-ico{font-size:20px}
.ch-mid{flex:1}
.ch-mid b{color:#e8dcc0;font-size:14px;display:flex;align-items:baseline;gap:8px}
.ch-mid b i{font-style:normal;font-size:11px;color:#9a8c6e;font-weight:400}
.ch-badge{font-size:11px;border-radius:12px;padding:3px 10px;white-space:nowrap}
.ch-badge.ok{color:#a8d8a0;background:#a8d8a015;border:1px solid #a8d8a040}
.ch-badge.off{color:#9a8c6e;background:#9a8c6e10;border:1px solid #9a8c6e30}
.ch-row{display:flex;gap:8px;margin-bottom:8px}
.ch-inp,.ch-sel{flex:1;min-width:0;background:#141210;border:1px solid #c9a86a35;color:#d8cba8;border-radius:8px;padding:7px 10px;font-size:12px;outline:none}
.ch-inp:focus,.ch-sel:focus{border-color:#c9a86a88}
.ch-foot-row{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.ch-chain{font-size:11px;color:#9a8c6e}
.ch-chain i{font-style:normal;margin-left:8px;color:#6e6a5e}
.ch-chain i.self{color:#a8d8a0}
.ch-chain i.none{color:#e07070}
.ch-btns{display:flex;gap:6px}
.ch-btn{background:#c9a86a18;border:1px solid #c9a86a55;color:#c9a86a;border-radius:8px;padding:5px 12px;font-size:11.5px;cursor:pointer}
.ch-btn:hover{background:#c9a86a2a}
.ch-btn.warn{color:#e07070;border-color:#e0707055}
.ch-btn:disabled{opacity:.55;cursor:wait}
.ch-fetch{width:100%;padding:7px 0;letter-spacing:.5px}
.ch-model-sel{width:100%;margin:2px 0 6px;max-width:100%}
.ch-hint{font-size:11.5px;line-height:1.7;margin:4px 0 6px}
.ch-suggest{font-size:11px;color:#6e6a5e;margin-top:8px;line-height:1.6}
.ch-sec{font-size:12px;color:#9a8c6e;margin:16px 0 8px;letter-spacing:1px;border-bottom:1px dashed #c9a86a20;padding-bottom:6px}
.ch-fixed{display:flex;align-items:center;gap:10px;background:#c9a86a08;border:1px solid #c9a86a18;border-radius:10px;padding:8px 12px;margin-bottom:6px}
.ch-fix-ico{font-size:16px}
.ch-fix-mid{flex:1;display:flex;align-items:baseline;gap:8px}
.ch-fix-mid b{color:#d8cba8;font-size:12.5px}
.ch-fix-mid i{font-style:normal;font-size:11px;color:#6e6a5e}
/* v3.27.4 安卓适配：触屏聚焦输入不触发自动放大，与主样式 16px 策略对齐 */
@media (max-width: 900px){
    .ch-inp,.ch-sel{font-size:16px;padding:9px 12px}
    .ch-btn{padding:8px 14px}
    .ch-overlay{padding:10px}
}`;
    document.head.appendChild(st);
  }
  window.ChannelHub = ChannelHub;
})();
