(function() {
  "use strict";
  const SET_KEY = "storyNpcPortrait";
  const MAX_STORE = 12;
  const MAX_STORE_IDB = 30;
  const MAX_URL = 5e5;
  const NpcPortrait = {
    esc(s) {
      return String(s != null ? s : "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    },
    /** 当前生效的人数上限（storage-boost 就绪则放宽） */
    _maxStore() {
      return window.StorageBoost && window.StorageBoost.ready() ? MAX_STORE_IDB : MAX_STORE;
    },
    /* ==================== 设置 ==================== */
    getSettings() {
      try {
        const o = JSON.parse(localStorage.getItem(SET_KEY) || "{}");
        return { on: o.on !== false };
      } catch (e) {
        return { on: true };
      }
    },
    saveSettings(s) {
      try {
        localStorage.setItem(SET_KEY, JSON.stringify({ on: s.on !== false }));
      } catch (e) {
      }
    },
    toggle() {
      var _a;
      const s = this.getSettings();
      s.on = !s.on;
      this.saveSettings(s);
      (_a = window.showToast) == null ? void 0 : _a.call(window, s.on ? "🎭 NPC 立绘已开启：新角色登场时自动画像" : "🎭 NPC 立绘已关闭", "info");
      return s.on;
    },
    isEnabled() {
      return this.getSettings().on;
    },
    /* ==================== 存档读写 ==================== */
    /** 立绘表 { name: {url, prompt, ts, failed?} } */
    all() {
      var _a, _b;
      const p = (_b = (_a = window.storyFramework) == null ? void 0 : _a.storyState) == null ? void 0 : _b.npcPortraits;
      return p && typeof p === "object" ? p : {};
    },
    get(name) {
      return this.all()[name] || null;
    },
    /** 写入一条（体积分流 + 条数上限 + 随档保存） */
    put(name, entry) {
      var _a, _b, _c;
      const fw = window.storyFramework;
      if (!fw) return;
      const p = { ...this.all() };
      const url = String(entry.url || "");
      let storeUrl = url;
      if (url.startsWith("data:") && url.length > MAX_URL) {
        if ((_a = window.StorageBoost) == null ? void 0 : _a.ready()) {
          const key = "立绘/" + name;
          storeUrl = window.StorageBoost.marker(key);
          (this._mem = this._mem || {})[name] = { url, ts: Date.now() };
          window.StorageBoost.put(key, url).then((ok) => {
            if (ok) {
              try {
                fw.saveStory();
              } catch (e) {
              }
            } else {
              delete this._mem[name];
            }
          });
        } else {
          storeUrl = "";
          (this._mem = this._mem || {})[name] = { url, ts: Date.now() };
        }
      }
      p[name] = {
        url: storeUrl,
        prompt: String(entry.prompt || "").slice(0, 400),
        ts: Date.now(),
        failed: !!entry.failed
      };
      const max = this._maxStore();
      const names = Object.keys(p);
      if (names.length > max) {
        names.sort((a, b) => (p[a].ts || 0) - (p[b].ts || 0));
        for (const k of names.slice(0, names.length - max)) {
          if ((_c = (_b = window.StorageBoost) == null ? void 0 : _b.isMarker) == null ? void 0 : _c.call(_b, p[k].url)) {
            window.StorageBoost.remove("立绘/" + k);
          }
          delete p[k];
          if (this._mem) delete this._mem[k];
        }
      }
      fw.storyState.npcPortraits = p;
      try {
        fw.saveStory();
      } catch (e) {
      }
    },
    remove(name) {
      var _a, _b, _c;
      const fw = window.storyFramework;
      if (!fw) return;
      const p = { ...this.all() };
      if ((_c = (_a = window.StorageBoost) == null ? void 0 : _a.isMarker) == null ? void 0 : _c.call(_a, (_b = p[name]) == null ? void 0 : _b.url)) {
        window.StorageBoost.remove("立绘/" + name);
      }
      delete p[name];
      fw.storyState.npcPortraits = p;
      if (this._mem) delete this._mem[name];
      try {
        fw.saveStory();
      } catch (e) {
      }
      this.open();
    },
    /** idb:// 标记 → 会话内存表中的真实 dataURL（未预热返回 ''） */
    _urlOf(name, entry) {
      var _a, _b;
      if (!entry || !entry.url) return "";
      if ((_b = (_a = window.StorageBoost) == null ? void 0 : _a.isMarker) == null ? void 0 : _b.call(_a, entry.url)) {
        return this._mem && this._mem[name] && this._mem[name].url || "";
      }
      return entry.url;
    },
    /** 启动预热：把 IDB 里的立绘灌回会话内存表（同步读路径零改造） */
    async _warm() {
      var _a;
      if (!((_a = window.StorageBoost) == null ? void 0 : _a.ready())) return;
      const entries = this.all();
      for (const [name, entry] of Object.entries(entries)) {
        if (!window.StorageBoost.isMarker(entry == null ? void 0 : entry.url)) continue;
        const url = await window.StorageBoost.get("立绘/" + name);
        if (url) (this._mem = this._mem || {})[name] = { url, ts: entry.ts || Date.now() };
      }
      this.decorateGallery();
    },
    /* ==================== 每轮检定（response-handler 钩子） ==================== */
    /**
     * @param vars    本轮合并后的剧情变量
     * @param anchor  本轮最后一张卡片元素（登场卡插它后面，保证顺序不乱）
     */
    onTurnRendered(vars, anchor) {
      try {
        if (!this.isEnabled()) return;
        if (!(window.StoryImageGen && StoryImageGen.isConfigured && StoryImageGen.isConfigured())) return;
        const fw = window.storyFramework;
        if (!fw || !fw.storyState.isStoryStarted) return;
        const gallery = window.ImmersiveSuite && ImmersiveSuite._state && ImmersiveSuite._state.gallery || {};
        const chapter = Number(vars == null ? void 0 : vars.chapter) || 0;
        const existing = this.all();
        const debut = Object.values(gallery).filter((g) => g && g.name && chapter && Number(g.firstRound) === chapter && !existing[g.name] && !existing[g.name.replace(/["'“”]/g, "")]).sort((a, b) => (Number(b.favor) || 0) - (Number(a.favor) || 0));
        if (!debut.length) return;
        this.generateFor(debut[0].name, anchor);
      } catch (e) {
        console.warn("[NpcPortrait] 检定故障:", e.message);
      }
    },
    /* ==================== 生成 ==================== */
    buildPrompt(g) {
      var _a, _b;
      const fw = window.storyFramework;
      const genre = ((_a = fw == null ? void 0 : fw.config) == null ? void 0 : _a.genreKey) || "";
      const style = ((_b = fw == null ? void 0 : fw.config) == null ? void 0 : _b.imageStyle) || window.StoryImageGen && StoryImageGen.GENRE_STYLES && StoryImageGen.GENRE_STYLES[genre] || window.StoryImageGen && StoryImageGen.GENRE_STYLES && StoryImageGen.GENRE_STYLES._default || "高质量文学插画，电影感构图，氛围写实";
      const bits = [
        `小说角色立绘：${g.name}`,
        g.role ? `（${g.role}）` : "",
        g.desc || g.description || "",
        g.status ? `当前状态：${g.status}` : "",
        g.line ? `台词基调：${g.line}` : ""
      ].filter(Boolean);
      return `${bits.join("。")}。单人半身像，正面或微侧视角，聚焦面部神情与服饰细节，简洁氛围背景，画面不出现任何文字。画风：${style}`;
    },
    async generateFor(name, anchor) {
      var _a, _b, _c, _d;
      const fw = window.storyFramework;
      const IG = window.StoryImageGen;
      const gallery = window.ImmersiveSuite && ImmersiveSuite._state && ImmersiveSuite._state.gallery || {};
      const g = gallery[name];
      if (!fw || !IG || !g) return;
      const key = name.replace(/["'“”]/g, "");
      const card = this.renderDebutCard(g, null);
      const container = document.getElementById("chatMessages");
      if (card && container) {
        if (window.StoryResponseHandler && StoryResponseHandler.tagTurnCard) {
          StoryResponseHandler.tagTurnCard(card);
        }
        anchor && anchor.parentNode === container ? anchor.insertAdjacentElement("afterend", card) : container.appendChild(card);
        (_b = (_a = window.StoryResponseHandler) == null ? void 0 : _a.scrollToBottom) == null ? void 0 : _b.call(_a);
      }
      try {
        const prompt = this.buildPrompt(g);
        const entry = await IG.generate(prompt, { turn: (_c = fw.currentTurnIndex()) != null ? _c : null });
        this.put(key, { url: entry.url, prompt });
        this.fillDebutCard(card, key, entry.url);
        this.decorateGallery();
        try {
          (_d = window.showToast) == null ? void 0 : _d.call(window, `🎭 已为「${key}」绘成立绘`, "success");
        } catch (e) {
        }
      } catch (e) {
        this.put(key, { url: "", prompt: "", failed: true });
        const fig = card ? card.querySelector(".np-fig") : null;
        if (fig) fig.innerHTML = `<div class="np-fig-fail">立绘未能生成（${this.esc(String(e.message || "生图失败").slice(0, 60))}）——可在「工具箱 → 立绘本」重试</div>`;
      }
    },
    /* ==================== 登场卡 ==================== */
    /** 立绘 <img> 片段（点击放大；加载失败降级提示）
     *  v3.18.1 修复（审计低危⑦）：旧 onerror 替换的是父节点 innerHTML——父容器
     *  将来加任何兄弟元素（角标/按钮）都会被连带清除；改 replaceWith 只替换自身 */
    imgHtml(key, url) {
      return `<img src="${this.esc(url)}" alt="${this.esc(key)}" onclick="NpcPortrait.zoom('${this.esc(key)}')"
                onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'np-fig-fail',textContent:'立绘已失效，可在立绘本重绘'}))">`;
    },
    renderDebutCard(g, url) {
      const key = String(g.name || "").replace(/["'“”]/g, "");
      if (!key) return null;
      const card = document.createElement("div");
      card.className = "message-card np-debut";
      card.dataset.name = key;
      const head = document.createElement("div");
      head.className = "np-head";
      head.innerHTML = `<b>🎭 角色登场</b><i>第 ${Number(g.firstRound) || "?"} 章</i>`;
      const fig = document.createElement("div");
      fig.className = "np-fig";
      fig.innerHTML = url ? this.imgHtml(key, url) : `<div class="np-fig-loading"><span></span>画像绘制中…</div>`;
      const info = document.createElement("div");
      info.className = "np-info";
      info.innerHTML = `
                <b class="np-name">${this.esc(key)}</b>
                ${g.role ? `<span class="np-role">${this.esc(g.role)}</span>` : ""}
                ${g.desc ? `<p class="np-desc">${this.esc(String(g.desc).slice(0, 120))}</p>` : ""}
                ${g.line ? `<p class="np-line">「${this.esc(String(g.line).slice(0, 60))}」</p>` : ""}`;
      const wrap = document.createElement("div");
      wrap.className = "np-wrap";
      wrap.appendChild(fig);
      wrap.appendChild(info);
      card.appendChild(head);
      card.appendChild(wrap);
      return card;
    },
    /** 生成完成后回填登场卡图槽（直接持卡片引用，无需重查 DOM） */
    fillDebutCard(card, key, url) {
      if (!card) return;
      const fig = card.querySelector(".np-fig");
      if (fig) fig.innerHTML = this.imgHtml(key, url);
    },
    /** 点击放大（含 IDB 分流图与会话内存表回退） */
    zoom(name) {
      const entry = this.get(name);
      const url = this._urlOf(name, entry) || this._mem && this._mem[name] && this._mem[name].url;
      if (!url) return;
      const old = document.getElementById("npZoom");
      if (old) {
        old.remove();
        return;
      }
      const w = document.createElement("div");
      w.id = "npZoom";
      w.className = "np-zoom";
      w.onclick = () => w.remove();
      w.innerHTML = `<div class="np-zoom-box"><img src="${this.esc(url)}" alt="${this.esc(name)}"><b>${this.esc(name)}</b></div>`;
      document.body.appendChild(w);
    },
    /* ==================== 众生相头像装饰 ==================== */
    /** 群像页签里，已有立绘的角色把程序绘 sigil 换成真实画像 */
    decorateGallery() {
      const body = document.getElementById("immBody");
      if (!body) return;
      const p = this.all();
      body.querySelectorAll(".gl-card").forEach((cardEl) => {
        const nameEl = cardEl.querySelector(".gl-name");
        const sigil = cardEl.querySelector(".gl-sigil");
        if (!nameEl || !sigil) return;
        const first = nameEl.childNodes && nameEl.childNodes[0] && nameEl.childNodes[0].textContent || nameEl.textContent || "";
        const name = String(first).trim().replace(/["'“”]/g, "");
        const url = this._urlOf(name, p[name]);
        if (!url) return;
        if (sigil.querySelector("img")) return;
        const svg = sigil.querySelector("svg");
        const size = Math.round(parseFloat(svg && svg.getAttribute("width")) || 54);
        sigil.innerHTML = `<img class="gl-portrait" width="${size}" height="${size}" style="width:${size}px;height:${size}px"
                    src="${this.esc(url)}" alt="${this.esc(name)}" loading="lazy"
                    onerror="this.remove()">`;
      });
    },
    /** 挂观察器：页签重绘后自动装饰（初始化时调一次） */
    init() {
      if (this._observer) return;
      if (typeof MutationObserver === "undefined") {
        this.decorateGallery();
        return;
      }
      const mount = () => {
        const body = document.getElementById("immBody");
        if (!body || this._observer) return;
        this._observer = new MutationObserver(() => this.decorateGallery());
        this._observer.observe(body, { childList: true, subtree: false });
        this.decorateGallery();
      };
      this._warm().catch(() => {
      });
      let tries = 0;
      const timer = setInterval(() => {
        mount();
        if (this._observer || ++tries > 20) clearInterval(timer);
      }, 500);
    },
    /* ==================== 立绘本面板 ==================== */
    open() {
      var _a;
      const gallery = window.ImmersiveSuite && ImmersiveSuite._state && ImmersiveSuite._state.gallery || {};
      const p = this.all();
      const names = [.../* @__PURE__ */ new Set([...Object.keys(gallery), ...Object.keys(p)])];
      const on = this.isEnabled();
      const configured = !!(window.StoryImageGen && StoryImageGen.isConfigured && StoryImageGen.isConfigured());
      const cells = names.map((name) => {
        const key = name.replace(/["'“”]/g, "");
        const g = gallery[name] || {};
        const entry = p[key];
        const url = this._urlOf(key, entry);
        const img = url ? `<img src="${this.esc(url)}" alt="${this.esc(key)}" onclick="NpcPortrait.zoom('${this.esc(key)}')" loading="lazy">` : entry && entry.failed ? `<div class="np-cell-fail">生成失败<br>可重试</div>` : `<div class="np-cell-empty">${this.esc(g.role ? String(g.role).slice(0, 8) : "未画像")}</div>`;
        return `<div class="np-cell">
                    <div class="np-cell-fig">${img}</div>
                    <b class="np-cell-name">${this.esc(key)}</b>
                    <i class="np-cell-role">${this.esc(g.role || "身份不明")}</i>
                    <div class="np-cell-acts">
                        <button class="np-mini" onclick="NpcPortrait.redraw('${this.esc(key)}')">↻ 重绘</button>
                        ${entry && entry.url ? `<button class="np-mini danger" onclick="NpcPortrait.remove('${this.esc(key)}')">🗑</button>` : ""}
                    </div>
                </div>`;
      }).join("");
      const html = `
            <div class="np-overlay" onclick="if(event.target===this)NpcPortrait.close()">
                <div class="np-modal">
                    <div class="np-modal-head">
                        <b>🎭 立绘本</b>
                        <span class="np-modal-sub">${names.length} 位角色 · 登场自动画像</span>
                        <button class="np-toggle ${on ? "on" : ""}" onclick="NpcPortrait.toggle();NpcPortrait.open()">${on ? "自动画像：开" : "自动画像：关"}</button>
                        <button class="np-x" onclick="NpcPortrait.close()">✕</button>
                    </div>
                    <div class="np-modal-body">
                        ${!configured ? `<div class="np-warn">尚未配置生图接口：可在「⚙ 接口设置 → 🖼 插图引擎」配置（含零成本的「文墨画师」模式）。</div>` : ""}
                        ${names.length ? `<div class="np-grid">${cells}</div>` : '<div class="np-warn">尚无角色入册——开篇后 AI 上报的角色会自动出现在这里。</div>'}
                    </div>
                    <div class="np-modal-foot">新角色首次登场时自动绘制一张立绘（每轮至多一位）；此处可随时重绘或删除。</div>
                </div>
            </div>`;
      (_a = document.getElementById("npAlbum")) == null ? void 0 : _a.remove();
      const wrap = document.createElement("div");
      wrap.id = "npAlbum";
      wrap.innerHTML = html;
      document.body.appendChild(wrap);
    },
    /** 立绘本内重绘（登场卡锚点取聊天流末位卡片） */
    async redraw(name) {
      var _a, _b, _c;
      const IG = window.StoryImageGen;
      if (!IG || !IG.isConfigured || !IG.isConfigured()) {
        (_a = window.showToast) == null ? void 0 : _a.call(window, "请先配置生图接口（接口设置 → 插图引擎）", "error");
        return;
      }
      const gallery = window.ImmersiveSuite && ImmersiveSuite._state && ImmersiveSuite._state.gallery || {};
      if (!gallery[name]) {
        (_b = window.showToast) == null ? void 0 : _b.call(window, "该角色尚未入册（不在众生相里）", "error");
        return;
      }
      const container = document.getElementById("chatMessages");
      const anchor = container ? container.lastElementChild : null;
      this.put(name, { url: "", prompt: "", failed: false });
      (_c = window.showToast) == null ? void 0 : _c.call(window, `🖌 正在为「${name}」重绘立绘…`, "info");
      await this.generateFor(name, null);
      this.open();
    },
    close() {
      var _a;
      (_a = document.getElementById("npAlbum")) == null ? void 0 : _a.remove();
    }
  };
  if (!document.getElementById("npcPortraitStyle")) {
    const st = document.createElement("style");
    st.id = "npcPortraitStyle";
    st.textContent = `
.np-debut{margin:10px 0;background:linear-gradient(165deg,rgba(33,29,23,.94),rgba(23,20,15,.94));border:1px solid #c9a86a50;border-radius:13px;padding:12px 14px;box-shadow:0 8px 26px rgba(0,0,0,.35);animation:npIn .45s ease both}
@keyframes npIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.np-head{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.np-head b{color:#e8dcc0;font-size:13px;letter-spacing:1.5px}
.np-head i{font-style:normal;font-size:10.5px;color:#9a8c6e;margin-left:auto}
.np-wrap{display:flex;gap:13px;align-items:flex-start}
.np-fig{flex:0 0 118px;min-height:118px;max-width:118px;border-radius:10px;overflow:hidden;background:rgba(0,0,0,.3);border:1px solid #c9a86a38;display:flex;align-items:center;justify-content:center}
.np-fig img{width:100%;height:100%;object-fit:cover;display:block;cursor:zoom-in}
.np-fig-loading{display:flex;flex-direction:column;align-items:center;gap:8px;font-size:10.5px;color:#9a8c6e;padding:10px}
.np-fig-loading span{width:26px;height:26px;border-radius:50%;border:2px solid #c9a86a33;border-top-color:#c9a86a;animation:npSpin 1s linear infinite}
@keyframes npSpin{to{transform:rotate(360deg)}}
.np-fig-fail{font-size:10.5px;color:#b09a6e;line-height:1.7;padding:10px;text-align:center}
.np-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
.np-name{color:#e8dcc0;font-size:15px;letter-spacing:1px}
.np-role{font-size:10.5px;color:#c9a86a;border:1px solid #c9a86a55;border-radius:999px;padding:1px 9px;align-self:flex-start}
.np-desc{font-size:12px;color:#bdb08e;line-height:1.8;margin:2px 0 0}
.np-line{font-size:12px;color:#d8cba8;line-height:1.8;margin:0;font-style:italic;border-left:2px solid #c9a86a55;padding-left:9px}
.gl-portrait{width:54px;height:54px;object-fit:cover;border-radius:50%;display:block;flex-shrink:0}
.np-zoom{position:fixed;top: 0; right: 0; bottom: 0; left: 0; inset: 0;background:rgba(0,0,0,.82);backdrop-filter:blur(4px);z-index:9995;display:flex;align-items:center;justify-content:center;padding:24px;cursor:zoom-out}
.np-zoom-box{display:flex;flex-direction:column;align-items:center;gap:12px;max-width:min(560px,92vw)}
.np-zoom-box img{max-width:100%;max-height:76vh;border-radius:14px;border:1px solid #c9a86a66;box-shadow:0 24px 80px rgba(0,0,0,.7)}
.np-zoom-box b{color:#e8dcc0;font-size:14px;letter-spacing:2px}
.np-overlay{position:fixed;top: 0; right: 0; bottom: 0; left: 0; inset: 0;background:rgba(0,0,0,.62);backdrop-filter:blur(3px);z-index:9992;display:flex;align-items:center;justify-content:center;padding:18px}
.np-modal{width:min(860px,94vw);max-height:86vh;display:flex;flex-direction:column;background:linear-gradient(160deg,#211d17,#17140f);border:1px solid #c9a86a45;border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.6);overflow:hidden}
.np-modal-head{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid #c9a86a25}
.np-modal-head b{color:#e8dcc0;font-size:15px;letter-spacing:1px}
.np-modal-sub{font-size:11px;color:#9a8c6e;margin-right:auto}
.np-toggle{background:#c9a86a14;border:1px solid #c9a86a48;color:#9a8c6e;border-radius:999px;padding:4px 12px;font-size:11px;cursor:pointer}
.np-toggle.on{color:#c9a86a;border-color:#c9a86a88;background:#c9a86a1e}
.np-x{background:none;border:none;color:#9a8c6e;font-size:16px;cursor:pointer;padding:4px 8px}
.np-x:hover{color:#e8dcc0}
.np-modal-body{padding:16px 18px;overflow-y:auto;flex:1}
.np-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.np-cell{background:rgba(255,255,255,.035);border:1px solid #c9a86a2a;border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:6px;transition:border-color .2s}
.np-cell:hover{border-color:#c9a86a66}
.np-cell-fig{aspect-ratio:1;border-radius:9px;overflow:hidden;background:rgba(0,0,0,.3);border:1px solid #c9a86a26;display:flex;align-items:center;justify-content:center}
.np-cell-fig img{width:100%;height:100%;object-fit:cover;cursor:zoom-in;display:block}
.np-cell-empty{font-size:11px;color:#8a7d63;text-align:center;padding:20px 8px}
.np-cell-fail{font-size:11px;color:#c88;padding:20px 8px;text-align:center;line-height:1.8}
.np-cell-name{color:#e8dcc0;font-size:12.5px}
.np-cell-role{font-style:normal;font-size:10.5px;color:#9a8c6e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.np-cell-acts{display:flex;gap:6px;margin-top:2px}
.np-mini{background:#c9a86a14;border:1px solid #c9a86a44;color:#c9a86a;border-radius:7px;padding:3px 10px;font-size:10.5px;cursor:pointer}
.np-mini:hover{background:#c9a86a26}
.np-mini.danger{border-color:#e0707055;background:#e0707014;color:#e8a0a0}
.np-warn{font-size:12px;color:#c8b088;background:#c9a86a10;border:1px dashed #c9a86a40;border-radius:10px;padding:12px 14px;line-height:1.8}
.np-modal-foot{padding:11px 18px;border-top:1px solid #c9a86a25;font-size:11px;color:#8a7d63}
@media (max-width:760px){.np-fig{flex-basis:96px;min-height:96px;max-width:96px}.np-name{font-size:14px}.np-grid{grid-template-columns:repeat(auto-fill,minmax(124px,1fr))}}`;
    document.head.appendChild(st);
  }
  window.NpcPortrait = NpcPortrait;
})();
