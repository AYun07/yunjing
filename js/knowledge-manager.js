const KB_GENRE = new URLSearchParams(location.search).get("genre") || "free";
/* v3.53.0：按「原创设计」需要补齐分类——势力与组织分开（势力有地盘与立场，组织偏职能），
   道具与技能/功法分开（一个拿在手上，一个会长在人身上），另补血脉、种族、关系、伏笔。
   旧条目的老分类全部保留，不受影响。 */
const KB_CATEGORIES = [
  "人物", "势力", "组织", "地点", "血脉", "种族",
  "道具", "技能", "功法", "世界观", "设定", "规则",
  "事件", "关系", "伏笔", "文风", "通用"
];
const KB_PRIORITY_DESC = {
  "": "按需检索：不常驻注入，每轮创作时按与当前情节的相关度自动检索（每次最多 3 条）。适合细节性背景资料。",
  key: "关键词触发：填写的触发词出现在近期正文或本轮指令中时才注入（每轮最多 5 条）。适合「提及时才需要」的设定——角色卡世界书导入后即为此模式。",
  top: "核心常驻：每轮请求都注入，位于前景层最顶端（最贴近本轮指令，权重最高）。适合世界观铁律、不可违背的设定。",
  high: "重点常驻：每轮请求都注入，位于前景层（对话历史之后、本轮指令之前）。适合重要人物与核心组织设定。",
  medium: "次重点常驻：每轮请求都注入，位于背景层（对话历史之前）。适合一般性背景补充。",
  low: "一般常驻：每轮请求都注入，位于背景层。适合低频引用的辅助资料。"
};
const KB_PRIORITY_LABEL = {
  top: "👑 核心",
  high: "⭐ 重点",
  medium: "📌 次重点",
  low: "📋 常驻",
  "": "🔎 检索",
  key: "🗝 触发"
};
const KB_KEY_DEPTH_KEY = "storyKBKeyDepth";
const KB_WLEN_TITLE = "正文篇幅·字数调节（玩家亲设）";
const KB_WLEN_LEVELS = [
  { id: "mini", label: "精简", range: [250, 400], note: "快节奏·对白主导" },
  { id: "std", label: "标准", range: [500, 800], note: "均衡篇幅·默认" },
  { id: "long", label: "加长", range: [900, 1200], note: "沉浸党之选" },
  { id: "xlong", label: "超长", range: [1400, 1800], note: "慢节奏大章" },
  { id: "epic", label: "史诗", range: [2e3, 3e3], note: "名场面级长卷" }
];
const StoryKnowledge = {
  genre: KB_GENRE,
  storageKey: `storyKnowledge_${KB_GENRE}`,
  enabledKey: `storyKBEnabled_${KB_GENRE}`,
  globalKey: "storyKBGlobal",
  knowledgeBase: [],
  _globalKB: [],
  _vecCache: {},
  _bm25Cache: {},
  // 预留（旧向量缓存）
  _bm25Cache: {},
  // BM25 索引内存缓存（不落盘，节省 localStorage 容量）
  /* ==================== 初始化与持久化 ==================== */
  init() {
    this.load();
    this._loadGlobal();
    /* v3.53.0 世界书按界懒加载：旧版靠 studio.html 两段 document.write 抢在解析期装载，
       实测（Chrome）第二个内联脚本总会早于前一段写入的脚本执行 → __KB_SPLIT_OK__ 恒 false
       → 每次进任何世界都白拉 9.4MB 整包。现在改由消费方按需装：分界文件 290KB 起步，
       缺文件直接报错（不再回退整包），首屏与换界都快一个数量级。 */
    const self = this;
    this._ensureKB().then(function () {
      self._injectPreset();
      console.log(`[StoryKnowledge] 知识库已加载（${self.genre}）：本界 ${self._localCount()} 条 + 全局 ${self._globalKB.length} 条`);
      try { document.dispatchEvent(new CustomEvent("story:kb-ready", { detail: { genre: self.genre } })); } catch (e) { }
    });
  },
  /** 确保本界世界书已就位（已存在则立即兑现；否则动态装载，失败回退整包） */
  _ensureKB() {
    const g = this.genre;
    if (window.KB_PRESETS && Array.isArray(window.KB_PRESETS[g]) && window.KB_PRESETS[g].length) {
      window.__KB_SPLIT_OK__ = true;
      return Promise.resolve(true);
    }
    if (window.__kbLoading) return window.__kbLoading;
    const v = (window.YJ_VER || "3.55.19");
    const loadOne = (src) => new Promise((resolve) => {
      const el = document.createElement("script");
      el.src = src;
      el.async = true;
      el.onload = () => resolve(true);
      el.onerror = () => resolve(false);
      (document.head || document.documentElement).appendChild(el);
    });
    /* v3.55.28：世界书二次拆分——进界先挂 core（常驻/高优先，最大约 45KB，原整包最大 411KB），
       其余条目由 ext 在空闲时补齐并自动补注入，玩家感知不到先后，进界不再背整包下载 */
    window.__kbLoading = loadOne(`js/kb/${g}.core.js?v=${v}`).then(async (ok) => {
      if (ok && window.KB_PRESETS && Array.isArray(window.KB_PRESETS[g]) && window.KB_PRESETS[g].length) {
        window.__KB_SPLIT_OK__ = true;
        this._loadExt(g, v, loadOne);
        return true;
      }
      /* core 加载失败 → 直接报错，不再回退 preset-knowledge.js (已删除) */
      console.warn(`[StoryKnowledge] 世界书 core 加载失败（${g}）：本界将只有玩家自建条目`);
      window.__KB_SPLIT_OK__ = false;
      return Promise.resolve(false);
    });
    return window.__kbLoading;
  },
  /** 空闲补齐世界书扩展包（core 之外的条目），补齐后自动并入知识库并落盘 */
  _loadExt(g, v, loadOne) {
    if (window.__kbExtLoaded === g) return;
    window.__kbExtLoaded = g;
    const self = this;
    const go = function () {
      loadOne(`js/kb/${g}.ext.js?v=${v}`).then(function (ok) {
        if (!ok) return;
        const presets = (window.KB_PRESETS && window.KB_PRESETS[g]) || [];
        const added = self._mergePresets(presets);
        if (added) self.save({ silent: true });
        try { document.dispatchEvent(new CustomEvent("story:kb-ext-ready", { detail: { genre: g, added } })); } catch (e) { }
        if (added) console.log(`[StoryKnowledge] 世界书扩展包已补齐 ${added} 条（${g}）`);
      });
    };
    if (window.requestIdleCallback) window.requestIdleCallback(go, { timeout: 3000 });
    else setTimeout(go, 800);
  },
  _loadGlobal() {
    try {
      const saved = localStorage.getItem(this.globalKey);
      if (saved) {
        const data = JSON.parse(saved);
        const entries = Array.isArray(data == null ? void 0 : data.knowledge) ? data.knowledge : [];
        this._globalKB = entries.map(function(e) { e.isGlobal = true; return e; });
      }
    } catch (e) { this._globalKB = []; }
    // 合并全局条目到内存 KB（标记 isGlobal）
    for (const g of this._globalKB) {
      if (!this.knowledgeBase.some(function(i) { return i.id === g.id; })) {
        this.knowledgeBase.push(g);
      }
    }
  },
  _saveGlobal() {
    const globals = this.knowledgeBase.filter(function(i) { return i.isGlobal === true; });
    const data = { version: "1.0", app: "云境", savedAt: new Date().toISOString(), knowledge: globals };
    try { localStorage.setItem(this.globalKey, JSON.stringify(data)); } catch (e) { console.error("[StoryKnowledge] 全局知识保存失败:", e); }
  },
  _localCount() { return this.knowledgeBase.filter(function(i) { return i.isGlobal !== true; }).length; },
  toggleGlobal(id) {
    const entry = this.getById(id);
    if (!entry) return;
    entry.isGlobal = entry.isGlobal !== true;
    this._saveGlobal();
    this.save();
    window.showToast && window.showToast(entry.isGlobal ? "🌐 已设为全局（所有世界通用）" : "📂 已设为仅本界", "success");
  },
  load() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const data = JSON.parse(saved);
        this.knowledgeBase = Array.isArray(data == null ? void 0 : data.knowledge) ? data.knowledge : [];
      }
    } catch (e) {
      console.error("[StoryKnowledge] 读取知识库失败:", e);
      this.knowledgeBase = [];
    }
    this._vecCache = {};
    this._bm25Cache = {};
  },
  /* ==================== 预置知识（四工坊专属，按 genre 完全独立） ==================== */
  /** 预置注入标记（版本化：KB 内容扩容后老存档自动补入新增条目） */
  _presetFlagKey: `storyKBPreset_${KB_GENRE}`,
  _presetVersion: "v16",
  // v16: 移除 9.4MB preset-knowledge.js 整包兜底回退；js/kb/ 已完整拆分 33 个 genre core/ext（共 1410 条），core 加载失败直接报错不再下载整包；
  // v15: 全量世界书扩容——33 个工坊全部补至 ≥300 条（共 13193 条）。按原著穷举地点/人物/关系/物品/技能/天赋/体质/血脉/道具/世界观/地图/剧情时间线；每个世界独立存储、进入即自动挂载对应世界书（storyKBPreset_${genre} 版本化，老存档自动补入新增条目）；
  // v14: 新增斩神界知识库（19 条：迷雾降临世界观/精神力六境/禁墟序列/守夜人组织/阳光精神病院诸神/林七夜与赵空城详录/大事时间线/沧南地理/原著文风圣经/神秘遭遇主持法/日常波澜配比/防剧透纪律/原创配角建档/主角替代协议/战斗描写手册，v3.38.0 新世界）；
  // v13: 全员新增「正文篇幅·字数调节」共享条目（v3.37.0 玩家反馈专项：面板顶部 📏 档位条即点即改，条目本身即存储；老档自动补入，误删可一键重建）；
  // v12: 新增凡人修仙传/仙逆两界知识库（各 24+ 条：炼气十三层到筑基结丹元婴化神炼虚合体大乘的境界全阶/韩立详录/掌天瓶/黄枫谷与越国七派/魔道乱越/慕兰之战/乱星海星宫/大晋佛道/灵界天渊城/苟道算计/忘语文风圣经；四步之路境界全阶/王林详录/天逆珠与司徒南残魂/李慕婉与逆天复活/王家灭门血仇/恒岳派与赵国/天南凶名/罗天星域/古神涂司/心魔劫与执念/耳根文风圣经），两界共世与主角替代协议（默认共世，可亲笔替代）；
  // v11: 新增帝霸/龙族两界知识库（各 21 条：万古棋局/命宫真命/帝兵帝陵/禁区/李七夜详录；表里双世/血统言灵/卡塞尔学院/龙王死侍/路明非·楚子航·恺撒·诺诺·绘梨衣·昂热详录），两界文风圣经与主角替代协议（默认共世，可亲笔替代）；
  // v10: 道诡异仙/重生之都市修仙知识库扩充至35/37条，新增药引同伴/华家等群像；
  // v9：全员防八股（套话禁词总库 + 套路替换手册，11 工坊全注入，含 free）；
  // v8：六界新增群像语音库（配角台词模板）；v7：人物语音库
  /**
   * 进入本工坊时自动写入该工坊的专属预置知识（js/kb/*.core.js + *.ext.js）。
   * 同名条目跳过（保护用户已录入内容）；注入按版本标记执行——
   * 预置库扩容（版本号变化）时，老存档也会自动补入新增条目；
   * 删除预置条目后不会自动复活，需要找回时用面板的「↺ 预置」按钮（restorePresets）。
   */
  _injectPreset() {
    var _a;
    const presets = (_a = window.KB_PRESETS) == null ? void 0 : _a[this.genre];
    if (!Array.isArray(presets) || !presets.length) return;
    try {
      const flag = localStorage.getItem(this._presetFlagKey);
      if (flag === this._presetVersion) return;
      const added = this._mergePresets(presets);
      /* v3.53.0 修复：落盘失败（存储配额满）时不再写「已注入」标记。
         旧实现无论成败都写标记 → 下次启动读到标记即跳过注入 → 世界书条目集体消失，
         而玩家看不见任何提示（只有一条 console.error）。现在失败即不写标记，
         下次进界重新补齐（内存里始终完整，功能不受影响）。 */
      const ok = added ? this.save({ silent: true }) : true;
      if (ok) localStorage.setItem(this._presetFlagKey, this._presetVersion);
      if (added) console.log(`[StoryKnowledge] 预置知识已注入 ${added} 条（${this.genre}，版本 ${this._presetVersion}）`);
    } catch (e) { console.error("[StoryKnowledge] 预置注入异常:", e); }
  },
  _mergePresets(presets) {
    let added = 0;
    for (const p of presets) {
      const exists = this.knowledgeBase.some(function(i) { return i.title === p.title; });
      if (exists) continue;
      this.knowledgeBase.push({
        id: "kb_" + Date.now() + "_" + Math.random().toString(36).slice(2),
        title: p.title,
        content: p.content,
        category: p.category || "通用",
        tags: p.tags || [],
        alwaysInclude: p.alwaysInclude || false,
        priority: p.alwaysInclude ? (p.priority || "low") : "",
        keys: p.keys || "",
        isGlobal: false,
        source: "preset",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      added++;
    }
    return added;
  },
  restorePresets() {
    var _a;
    const presets = (_a = window.KB_PRESETS) == null ? void 0 : _a[this.genre];
    if (!Array.isArray(presets) || !presets.length) {
      window.showToast && window.showToast("当前工坊无预置知识库", "info");
      return;
    }
    const added = this._mergePresets(presets);
    this.save();
    window.showToast && window.showToast(`✓ 已补回 ${added} 条预置知识（跳过同名已有条目）`, "success");
    this.open();
  },
  /* ==================== 核心 CRUD ==================== */
  getById(id) { return this.knowledgeBase.find(function(i) { return i.id === id; }); },
  addItem(item) {
    const now = new Date().toISOString();
    const entry = {
      id: item.id || "kb_" + Date.now() + "_" + Math.random().toString(36).slice(2),
      title: item.title,
      content: item.content,
      category: item.category || "通用",
      tags: item.tags || [],
      alwaysInclude: item.alwaysInclude || false,
      priority: item.alwaysInclude ? (item.priority || "low") : "",
      keys: item.keys || "",
      isGlobal: item.isGlobal || false,
      source: item.source || "manual",
      createdAt: now,
      updatedAt: now
    };
    this.knowledgeBase.push(entry);
    this.save();
    return entry;
  },
  setPriority(id, priority) {
    const entry = this.getById(id);
    if (!entry) return null;
    entry.priority = priority;
    entry.alwaysInclude = ["top", "high", "medium", "low"].includes(priority);
    entry.updatedAt = new Date().toISOString();
    this.save();
    return entry;
  },
  deleteItem(id) {
    const idx = this.knowledgeBase.findIndex(function(i) { return i.id === id; });
    if (idx >= 0) { this.knowledgeBase.splice(idx, 1); this.save(); }
  },
  clearAll() { this.knowledgeBase = []; this.save(); },
  save(opts) {
    try {
      const data = { version: "1.0", app: "云境", savedAt: new Date().toISOString(), knowledge: this.knowledgeBase };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      if (opts && opts.silent !== true) window.showToast && window.showToast("✓ 知识库已保存", "success");
      return true;
    } catch (e) {
      console.error("[StoryKnowledge] 保存失败:", e);
      window.showToast && window.showToast("保存失败：" + e.message, "error");
      return false;
    }
  },
  /* ==================== 检索与注入 ==================== */
  retrieve(query, limit = 3) {
    if (!query || !query.trim()) return [];
    const q = query.toLowerCase();
    const candidates = this.knowledgeBase.filter(function(i) { return !i.alwaysInclude; });
    const scored = candidates.map(function(i) {
      let score = 0;
      const text = (i.title + " " + i.content + " " + (i.tags || []).join(" ")).toLowerCase();
      const words = q.split(/[\s，,、。.]+/).filter(Boolean);
      for (const w of words) {
        if (text.includes(w)) score += w.length;
      }
      return { item: i, score };
    }).filter(function(x) { return x.score > 0; }).sort(function(a, b) { return b.score - a.score; });
    return scored.slice(0, limit).map(function(x) { return x.item; });
  },
  buildInjection(turnText) {
    const core = this.knowledgeBase.filter(function(i) { return i.alwaysInclude; });
    const retrieved = this.retrieve(turnText, 3);
    const parts = [];
    if (core.length) {
      const byLayer = { top: [], high: [], medium: [], low: [] };
      for (const i of core) byLayer[i.priority || "low"].push(i);
      for (const layer of ["top", "high", "medium", "low"]) {
        for (const i of byLayer[layer]) parts.push(this._formatEntry(i));
      }
    }
    if (retrieved.length) {
      parts.push("
【按需检索·相关背景】");
      for (const i of retrieved) parts.push(this._formatEntry(i));
    }
    return parts.join("
");
  },
  _formatEntry(i) {
    const tag = i.alwaysInclude ? KB_PRIORITY_LABEL[i.priority || "low"] : "🔎 检索";
    return `
[${tag}] ${i.title}
${i.content}`;
  },
  /* ==================== UI：面板 ==================== */
  _genreName() {
    const map = { mystery: "悬疑推理", scifi: "科幻未来", wuxia: "武侠仙侠", cthulhu: "克苏鲁恐怖", free: "自由创作", freeworld: "自由创世", swallowedstar: "吞噬星空", shrouding: "遮天", quanzhigaoshou: "全职高手", doupocangqiong: "斗破苍穹", wanmeishijie: "完美世界", douluodalu: "斗罗大陆", daoguiyixian: "道诡异仙", zhongshengdushi: "重生之都市修仙", dibao: "帝霸", longzu: "龙族", quanzhifashi: "全职法师", limingzhijian: "黎明之剑", lunhuileyuan: "轮回乐园", wulianfengdian: "武炼巅峰", shengxu: "圣墟", shenmifusu: "神秘复苏", ditandali: "地坛大里", fanrenxiuxian: "凡人修仙传", xianni: "仙逆", earth: "地球开放世界", quanqiubingfeng: "全球冰封", chaoshenxueyuan: "超神学院", zhanhen: "战痕", guzhenren: "蛊真人", xuanjianxianzu: "玄鉴仙族", jianlai: "剑来", guimi: "闺蜜" };
    return map[this.genre] || this.genre;
  },
  open() {
    let modal = document.getElementById("kbModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "kbModal";
      modal.className = "modal-overlay";
      modal.addEventListener("click", (e) => { if (e.target === modal) this.close(); });
      document.body.appendChild(modal);
    }
    const itemsHtml = this.knowledgeBase.length ? this.knowledgeBase.map((item) => {
      const badge = item.alwaysInclude ? `<span class="kb-badge b-${item.priority || "low"}">${KB_PRIORITY_LABEL[item.alwaysInclude ? item.priority || "low" : ""] || "🔎 检索"}</span>` : `<span class="kb-badge b-retrieval">🔎 检索</span>`;
      const globalBadge = item.isGlobal ? '<span class="kb-badge b-global">🌐 全局</span>' : '';
      const sourceBadge = item.source === "dlc" ? '<span class="kb-badge b-dlc">📦 DLC</span>' : item.source === "import" ? '<span class="kb-badge b-import">📥 导入</span>' : item.source === "preset" ? '<span class="kb-badge b-preset">📚 预置</span>' : '';
      const tagsHtml = (item.tags || []).length ? item.tags.map((t) => `<span class="kb-tag">${kbEsc(t)}</span>`).join("") : '<span class="kb-item-date">无标签</span>';
      return `<div class="kb-item" data-id="${kbEsc(item.id)}">
                <div class="kb-item-header">
                  <span class="kb-item-title">${kbEsc(item.title)}</span>
                  <div class="kb-item-badges">${badge}${globalBadge}${sourceBadge}</div>
                </div>
                <div class="kb-item-meta">
                  <span>${kbEsc(item.category)}</span>
                  <span>${tagsHtml}</span>
                  <span class="kb-item-date">${kbTime(item.updatedAt)}</span>
                </div>
              </div>`;
    }).join("") : '<div class="kb-empty">暂无知识条目，点击「+ 新建」或从预置库恢复</div>';
    modal.innerHTML = `
        <div class="modal-box wide">
            <div class="modal-header">
                <span>📚 知识库 · ${this._genreName()}</span>
                <button class="modal-close" onclick="StoryKnowledge.close()">✕</button>
            </div>
            <div class="modal-body">
                <div class="kb-toolbar">
                    <button class="btn-solid" onclick="StoryKnowledge.openEditor()">+ 新建</button>
                    <button class="btn-ghost" onclick="StoryKnowledge.restorePresets()">↺ 预置</button>
                    <button class="btn-ghost" onclick="StoryKnowledge.importFromFile()">📥 导入</button>
                    <button class="btn-ghost" onclick="StoryKnowledge.exportToFile()">📤 导出</button>
                    <button class="btn-ghost" onclick="StoryKnowledge.downloadTemplate()">📄 模板</button>
                    <button class="btn-ghost danger" onclick="StoryKnowledge.confirmClear()">🗑 清空</button>
                </div>
                <div class="kb-list">${itemsHtml}</div>
            </div>
            <div class="modal-footer">
                <button class="btn-solid" onclick="StoryKnowledge.close()">关闭</button>
            </div>
        </div>`;
    modal.style.display = "flex";
    this._bindItemClicks();
  },
  close() {
    const modal = document.getElementById("kbModal");
    if (modal) modal.style.display = "none";
  },
  _bindItemClicks() {
    const list = document.querySelector(".kb-list");
    if (!list) return;
    list.onclick = (e) => {
      const itemEl = e.target.closest(".kb-item");
      if (itemEl) this.openDetail(itemEl.dataset.id);
    };
  },
  /* ==================== UI：编辑器 ==================== */
  _editingId: null,
  openEditor(id) {
    var _a;
    const item = id ? this.getById(id) : null;
    let modal = document.getElementById("kbEditorModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "kbEditorModal";
      modal.className = "modal-overlay";
      modal.addEventListener("click", (e) => { if (e.target === modal) this.closeEditor(); });
      document.body.appendChild(modal);
    }
    const priority = item ? (item.alwaysInclude ? item.priority : "") : "";
    const tags = item ? (item.tags || []).join("、") : "";
    const keys = item ? (item.keys || "") : "";
    modal.innerHTML = `
        <div class="modal-box wide">
            <div class="modal-header">
                <span>${id ? "✏️ 编辑" : "➕ 新建"}知识条目 · ${this._genreName()}</span>
                <button class="modal-close" onclick="StoryKnowledge.closeEditor()">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-row">
                    <label>标题 <span class="required">*</span></label>
                    <input id="kbEdTitle" type="text" placeholder="如：主角·林七夜·性格特质" value="${kbEsc(item ? item.title : "")}" maxlength="100">
                </div>
                <div class="form-row">
                    <label>内容 <span class="required">*</span></label>
                    <textarea id="kbEdContent" rows="8" placeholder="详细设定资料、人物小传、世界观铁律、技能描述等…建议 ≥50 字">${kbEsc(item ? item.content : "")}</textarea>
                    <div class="form-tip" id="kbEdCharCount">当前 0 字</div>
                </div>
                <div class="form-row">
                    <label>分类</label>
                    <select id="kbEdCategory">${KB_CATEGORIES.map((c) => `<option value="${c}" ${item && item.category === c ? "selected" : ""}>${c}</option>`).join("")}</select>
                </div>
                <div class="form-row">
                    <label>标签（用顿号、逗号或空格分隔）</label>
                    <input id="kbEdTags" type="text" placeholder="如：主角、性格、禁墟、守夜人" value="${kbEsc(tags)}">
                </div>
                <div class="form-row">
                    <label>注入方式</label>
                    <select id="kbEdPriority" onchange="StoryKnowledge.updatePriorityDesc(this.value)">
                        <option value="" ${priority === "" ? "selected" : ""}>🔎 按需检索（与情节相关时自动注入）</option>
                        <option value="top" ${priority === "top" ? "selected" : ""}>👑 核心常驻（最高优先级）</option>
                        <option value="high" ${priority === "high" ? "selected" : ""}>⭐ 重点常驻</option>
                        <option value="medium" ${priority === "medium" ? "selected" : ""}>📌 次重点常驻</option>
                        <option value="low" ${priority === "low" ? "selected" : ""}>📋 一般常驻</option>
                    </select>
                    <div class="form-tip" id="kbEdPriorityDesc"></div>
                </div>
                <div class="form-row" id="kbEdKeysRow" style="${priority === "key" ? "" : "display:none"}">
                    <label>触发词（每行一个，出现在正文/指令中即注入）</label>
                    <textarea id="kbEdKeys" rows="3" placeholder="如：林七夜
守夜人
禁墟">${kbEsc(keys)}</textarea>
                </div>
                <div class="form-row">
                    <label class="kb-global-check"><input type="checkbox" id="kbEdGlobal" ${item && item.isGlobal ? "checked" : ""}> 🌐 全局知识（勾选后所有世界通用，切换世界也生效）</label>
                    <div class="form-tip">不勾选则仅当前世界（${this._genreName()}）可見。适合放通用文风偏好、写作纪律等跨世界设定。</div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-ghost" onclick="StoryKnowledge.closeEditor()">取消</button>
                <button class="btn-solid" onclick="StoryKnowledge.saveEditor()">保存条目</button>
            </div>
        </div>`;
    this.updatePriorityDesc(priority);
    this.updateCharCount();
    modal.style.display = "flex";
  },
  closeEditor() {
    const modal = document.getElementById("kbEditorModal");
    if (modal) modal.style.display = "none";
    this._editingId = null;
  },
  updatePriorityDesc(priority, targetId = "kbEdPriorityDesc") {
    const el = document.getElementById(targetId);
    if (el) el.textContent = KB_PRIORITY_DESC[priority] || "";
    const keysRow = document.getElementById("kbEdKeysRow");
    if (keysRow) keysRow.style.display = priority === "key" ? "" : "none";
  },
  updateCharCount() {
    const el = document.getElementById("kbEdCharCount");
    const input = document.getElementById("kbEdContent");
    if (el && input) el.textContent = `当前 ${input.value.length} 字`;
  },
  saveEditor() {
    var _a, _b, _c, _d, _e;
    const title = document.getElementById("kbEdTitle").value.trim();
    const content = document.getElementById("kbEdContent").value.trim();
    if (!title) {
      (_a = window.showToast) == null ? void 0 : _a.call(window, "请填写条目标题", "error");
      return;
    }
    if (content.length < 20) {
      (_b = window.showToast) == null ? void 0 : _b.call(window, "内容至少 20 字，请补充完整设定资料", "error");
      return;
    }
    const priority = document.getElementById("kbEdPriority").value;
    const keysInput = document.getElementById("kbEdKeys");
    const raw = {
      id: this._editingId || void 0,
      title,
      content,
      category: document.getElementById("kbEdCategory").value,
      tags: document.getElementById("kbEdTags").value,
      keys: priority === "key" && keysInput ? keysInput.value : "",
      alwaysInclude: ["top", "high", "medium", "low"].includes(priority),
      priority: priority === "key" ? "" : priority,
      isGlobal: document.getElementById("kbEdGlobal") ? document.getElementById("kbEdGlobal").checked : false,
      source: this._editingId ? ((_c = this.getById(this._editingId)) == null ? void 0 : _c.source) || "manual" : "manual"
    };
    if (priority === "key" && keysInput && !String(keysInput.value).trim()) {
      (_d = window.showToast) == null ? void 0 : _d.call(window, "关键词触发模式需要至少填一个触发词，否则永远不会被注入", "error");
      return;
    }
    const entry = this.addItem(raw);
    this.closeEditor();
    this.open();
    (_e = window.showToast) == null ? void 0 : _e.call(window, `✓ 知识条目「${entry.title}」已保存`, "success");
  },
  /* ==================== UI：条目详情 ==================== */
  openDetail(id) {
    var _a;
    const item = this.getById(id);
    if (!item) {
      (_a = window.showToast) == null ? void 0 : _a.call(window, "条目不存在或已被删除", "error");
      return;
    }
    let modal = document.getElementById("kbDetailModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "kbDetailModal";
      modal.className = "modal-overlay";
      modal.addEventListener("click", (e) => { if (e.target === modal) this.closeDetail(); });
      document.body.appendChild(modal);
    }
    const isDLC = item.source === "dlc" || item.category === "dlc";
    const badges = [
      `<span class="kb-badge ${item.alwaysInclude ? "b-" + (item.priority || "low") : "b-retrieval"}">${KB_PRIORITY_LABEL[item.alwaysInclude ? item.priority || "low" : ""] || "🔎 检索"}</span>`,
      `<span class="kb-badge b-cat">${kbEsc(item.category)}</span>`
    ];
    if (isDLC) badges.push(`<span class="kb-badge b-dlc">📦 DLC（由知识包注入）</span>`);
    const tagsHtml = (item.tags || []).length ? item.tags.map((t) => `<span class="kb-tag">${kbEsc(t)}</span>`).join("") : '<span class="kb-item-date">无标签</span>';
    const retrievalTest = item.alwaysInclude ? "" : `
            <div class="kb-retrieval-test">
                <input id="kbTestQuery" type="text" placeholder="输入情节关键词，测试该条目会被检索命中的相关度…">
                <button class="btn-ghost btn-mini" onclick="StoryKnowledge.runItemRetrievalTest('${kbEsc(item.id)}')">检索自测</button>
            </div>
            <div class="form-tip" id="kbTestResult"></div>`;
    modal.innerHTML = `
        <div class="modal-box wide">
            <div class="modal-header">
                <span>📄 ${kbEsc(item.title)}</span>
                <button class="modal-close" onclick="StoryKnowledge.closeDetail()">✕</button>
            </div>
            <div class="modal-body">
                <div class="kb-badges">${badges.join("")}</div>
                <div class="kb-detail-meta">
                    <span>ID：${kbEsc(item.id)}</span>
                    <span>分类：${kbEsc(item.category)}</span>
                    <span>标签：${tagsHtml}</span>
                    <span>创建：${kbTime(item.createdAt)}</span>
                    <span>更新：${kbTime(item.updatedAt)}</span>
                    <span>来源：${item.source === "dlc" ? "DLC 知识包" : item.source === "import" ? "导入" : "手动创建"}</span>
                </div>
                <div class="form-tip">${KB_PRIORITY_DESC[item.alwaysInclude ? item.priority || "low" : ""]}</div>
                <div class="kb-detail-content">${kbEsc(this._contentText(item.content))}</div>
                ${retrievalTest}
            </div>
            <div class="modal-footer">
                <button class="btn-ghost" onclick="StoryKnowledge.openEditor('${kbEsc(item.id)}')">编辑</button>
                <button class="btn-ghost" onclick="StoryKnowledge.promptPriority('${kbEsc(item.id)}')">调整注入方式</button>
                <button class="btn-ghost danger" onclick="StoryKnowledge.confirmDelete('${kbEsc(item.id)}')">删除</button>
                <button class="btn-solid" onclick="StoryKnowledge.closeDetail()">关闭</button>
            </div>
        </div>`;
    modal.style.display = "flex";
  },
  closeDetail() {
    const modal = document.getElementById("kbDetailModal");
    if (modal) modal.style.display = "none";
  },
  runItemRetrievalTest(id) {
    var _a;
    const query = (_a = document.getElementById("kbTestQuery")) == null ? void 0 : _a.value.trim();
    const result = document.getElementById("kbTestResult");
    if (!query || !result) return.
    const rank = this.retrieve(query, 50).findIndex((r) => r.id === id);
    if (rank < 0) {
      result.textContent = "✕ 未命中：该情节关键词与本条目相关度过低。可补充关键词标签，或改为常驻注入模式。";
      result.style.color = "var(--danger)";
    } else {
      result.textContent = `✓ 命中：在本工坊全部检索条目中排第 ${rank + 1} 位（每轮自动注入前 3 条）${rank < 3 ? "——该情节下会被注入" : "——本轮有更相关的条目挤占名额，可能不被注入"}。`;
      result.style.color = rank < 3 ? "var(--ok)" : "var(--warning, #c9a13b)";
    }
  },
  /* ==================== UI：调整注入方式 ==================== */
  _priorityTargetId: null,
  promptPriority(id) {
    const item = this.getById(id);
    if (!item) return;
    this._priorityTargetId = id;
    let modal = document.getElementById("kbPriorityModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "kbPriorityModal";
      modal.className = "modal-overlay";
      modal.addEventListener("click", (e) => { if (e.target === modal) this.closePriority(); });
      document.body.appendChild(modal);
    }
    const current = item.alwaysInclude ? item.priority : "";
    modal.innerHTML = `
        <div class="modal-box">
            <div class="modal-header">
                <span>🎚 调整注入方式 · ${kbEsc(item.title)}</span>
                <button class="modal-close" onclick="StoryKnowledge.closePriority()">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-row">
                    <label>注入方式</label>
                    <select id="kbPrioritySelect" onchange="StoryKnowledge.updatePriorityDesc(this.value, 'kbPriorityDesc')">
                        <option value="" ${current === "" ? "selected" : ""}>🔎 按需检索（与情节相关时自动注入）</option>
                        <option value="top" ${current === "top" ? "selected" : ""}>👑 核心常驻（最高优先级）</option>
                        <option value="high" ${current === "high" ? "selected" : ""}>⭐ 重点常驻</option>
                        <option value="medium" ${current === "medium" ? "selected" : ""}>📌 次重点常驻</option>
                        <option value="low" ${current === "low" ? "selected" : ""}>📋 一般常驻</option>
                    </select>
                    <div class="form-tip" id="kbPriorityDesc"></div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-ghost" onclick="StoryKnowledge.closePriority()">取消</button>
                <button class="btn-solid" onclick="StoryKnowledge.applyPriority()">确定</button>
            </div>
        </div>`;
    this.updatePriorityDesc(current, "kbPriorityDesc");
    modal.style.display = "flex";
  },
  closePriority() {
    const modal = document.getElementById("kbPriorityModal");
    if (modal) modal.style.display = "none";
    this._priorityTargetId = null;
  },
  applyPriority() {
    var _a, _b, _c;
    const id = this._priorityTargetId;
    const priority = (_b = (_a = document.getElementById("kbPrioritySelect")) == null ? void 0 : _a.value) != null ? _b : "";
    if (!id) return;
    const updated = this.setPriority(id, priority);
    this.closePriority();
    if (updated) {
      this.closeDetail();
      this.open();
      (_c = window.showToast) == null ? void 0 : _c.call(window, `✓ 「${updated.title}」已切换为${updated.alwaysInclude ? "常驻注入（" + KB_PRIORITY_LABEL[updated.priority] + "）" : "按需检索"}模式`, "success");
    }
  },
  /* ==================== UI：删除 / 清空 / 导入 / 导出 / 模板 ==================== */
  async confirmDelete(id) {
    var _a;
    const item = this.getById(id);
    if (!item) return.
    const ok = await window.UIDialog.confirm({
      title: "删除知识条目",
      message: `确定删除「${item.title}」吗？此操作不可恢复。${item.source === "dlc" ? "
（该条目来自 DLC 知识包，删除后重新激活对应 DLC 可恢复）" : ""}`,
      danger: true,
      confirmText: "删除"
    });
    if (!ok) return.
    this.deleteItem(id);
    this.closeDetail().
    this.open().
    (_a = window.showToast) == null ? void 0 : _a.call(window, `✓ 已删除「${item.title}」`, "success");
  },
  async confirmClear() {
    var _a, _b.
    if (!this.knowledgeBase.length) {
      (_a = window.showToast) == null ? void 0 : _a.call(window, "知识库已经是空的", "info");
      return.
    }
    const ok = await window.UIDialog.confirm({
      title: "清空知识库",
      message: `确定清空全部 ${this.knowledgeBase.length} 条知识（含 DLC 注入条目）吗？
此操作不可恢复，建议先导出备份。清空后可随时从「预置知识库」恢复本工坊的专属设定。`,
      danger: true,
      confirmText: "全部清空"
    });
    if (!ok) return.
    this.clearAll().
    this.open().
    (_b = window.showToast) == null ? void 0 : _b.call(window, "✓ 知识库已清空", "success");
  },
  importFromFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = () => {
      var _a.
      const file = (_a = input.files) == null ? void 0 : _a[0].
      if (!file) return.
      const reader = new FileReader().
      reader.onload = (e) => {
        var _a2, _b.
        try {
          const data = JSON.parse(e.target.result).
          const result = this.importData(data).
          this.open().
          (_a2 = window.showToast) == null ? void 0 : _a2.call(window, `✓ 导入完成：新增 ${result.added} 条，更新 ${result.updated} 条${result.skipped ? `，跳过 ${result.skipped} 条无效数据` : ""}`, "success").
        } catch (err) {
          (_b = window.showToast) == null ? void 0 : _b.call(window, `导入失败：${err.message}`, "error").
        }
      }.
      reader.readAsText(file).
    }.
    input.click().
  },
  exportToFile() {
    var _a, _b.
    if (!this.knowledgeBase.length) {
      (_a = window.showToast) == null ? void 0 : _a.call(window, "知识库为空，无可导出内容", "error").
      return.
    }
    this._download(JSON.stringify(this.exportData(), null, 2), `云境知识库_${this.genre}_${Date.now()}.json`).
    (_b = window.showToast) == null ? void 0 : _b.call(window, `✓ 已导出 ${this.knowledgeBase.length} 条知识（JSON）`, "success").
  },
  downloadTemplate() {
    var _a.
    this._download(JSON.stringify(this.buildTemplate(), null, 2), `云境知识库模板.json`).
    (_a = window.showToast) == null ? void 0 : _a.call(window, "✓ 模板已下载：替换示例内容后可导入", "success").
  }
};
function kbEsc(s) {
  return String(s != null ? s : "").replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, """).replace(/'/g, "'");
}
function kbEscAttr(s) {
  return kbEsc(s);
}
function kbTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return String(iso);
  }
}
StoryKnowledge.init();
window.StoryKnowledge = StoryKnowledge;