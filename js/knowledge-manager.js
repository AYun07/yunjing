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
       缺文件才回退整包，首屏与换界都快一个数量级。 */
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
       其余条目由 ext 在空闲时补齐并自动补注入，玩家感知不到先后，进界不再背整包下载；
       opt#1 起 core 加载失败不再回退 9.4MB 整包（preset-knowledge.js 已删除） */
    window.__kbLoading = loadOne(`js/kb/${g}.core.js?v=${v}`).then(async (ok) => {
      if (ok && window.KB_PRESETS && Array.isArray(window.KB_PRESETS[g]) && window.KB_PRESETS[g].length) {
        window.__KB_SPLIT_OK__ = true;
        this._loadExt(g, v, loadOne);
        return true;
      }
      /* opt#1：core 加载失败不再回退 preset-knowledge.js（9.4MB 整包已删除）。
       js/kb/ 已完整拆分 33 个 genre core/ext，core 404 直接报错，便于排查 */
      window.__KB_SPLIT_OK__ = false;
      console.warn(`[StoryKnowledge] 世界书 core 加载失败（${g}）：本界将只有玩家自建条目`);
      if (!ok2) console.warn("[StoryKnowledge] 世界书加载失败：本界将只有玩家自建条目");
      return ok2;
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
  // v15: 全量世界书扩容——33 个工坊全部补至 ≥300 条（共 13193 条）。按原著穷举地点/人物/关系/物品/技能/天赋/体质/血脉/道具/世界观/地图/剧情时间线；每个世界独立存储、进入即自动挂载对应世界书（storyKBPreset_${genre} 版本化，老存档自动补入新增条目）；
  // v14: 新增斩神界知识库（19 条：迷雾降临世界观/精神力六境/禁墟序列/守夜人组织/阳光精神病院诸神/林七夜与赵空城详录/大事时间线/沧南地理/原著文风圣经/神秘遭遇主持法/日常波澜配比/防剧透纪律/原创配角建档/主角替代协议/战斗描写手册，v3.38.0 新世界）；
  // v13: 全员新增「正文篇幅·字数调节」共享条目（v3.37.0 玩家反馈专项：面板顶部 📏 档位条即点即改，条目本身即存储；老档自动补入，误删可一键重建）；
  // v12: 新增凡人修仙传/仙逆两界知识库（各 24+ 条：炼气十三层到筑基结丹元婴化神炼虚合体大乘的境界全阶/韩立详录/掌天瓶/黄枫谷与越国七派/魔道乱越/慕兰之战/乱星海星宫/大晋佛道/灵界天渊城/苟道算计/忘语文风圣经；四步之路境界全阶/王林详录/天逆珠与司徒南残魂/李慕婉与逆天复活/王家灭门血仇/恒岳派与赵国/天南凶名/罗天星域/古神涂司/心魔劫与执念/耳根文风圣经），两界共世与主角替代协议（默认共世，可亲笔替代）；
  // v11: 新增帝霸/龙族两界知识库（各 21 条：万古棋局/命宫真命/帝兵帝陵/禁区/李七夜详录；表里双世/血统言灵/卡塞尔学院/龙王死侍/路明非·楚子航·恺撒·诺诺·绘梨衣·昂热详录），两界文风圣经与主角替代协议（默认共世，可亲笔替代）；
  // v10: 道诡异仙/重生之都市修仙知识库扩充至35/37条，新增药引同伴/华家等群像；
  // v9：全员防八股（套话禁词总库 + 套路替换手册，11 工坊全注入，含 free）；
  // v8：六界新增群像语音库（配角台词模板）；v7：人物语音库
  /**
   * 进入本工坊时自动写入该工坊的专属预置知识（js/preset-knowledge.js）。
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
      if (ok) {
        localStorage.setItem(this._presetFlagKey, this._presetVersion);
        if (added) console.log(`[StoryKnowledge] 已注入/补齐 ${this.genre} 预置知识 ${added} 条（${this._presetVersion}）`);
      } else {
        console.warn(`[StoryKnowledge] 预置知识未能落盘（存储空间不足），本次仍完整可用；下次进界会重新补齐。可在「工具箱 → 🛡 存档体检 → 世界书缓存」清理其它世界的缓存。`);
      }
    } catch (e) {
      console.error("[StoryKnowledge] 预置知识注入失败:", e);
    }
  },
  /** 把缺失的预置条目并入知识库（同名跳过，不覆盖已编辑内容），返回新增数 */
  _mergePresets(presets) {
    const existing = new Set(this.knowledgeBase.map((i) => String(i.title).trim()));
    let added = 0;
    for (const p of presets) {
      const title = String(p.title || "").trim();
      if (!title || existing.has(title)) continue;
      this.knowledgeBase.push(this._normalizeEntry({ ...p, source: "preset" }));
      added++;
    }
    return added;
  },
  /** 手动恢复/补齐本工坊预置知识（面板「↺ 预置」按钮；同名条目不会被覆盖） */
  async restorePresets() {
    var _a, _b, _c;
    const presets = (_a = window.KB_PRESETS) == null ? void 0 : _a[this.genre];
    if (!Array.isArray(presets) || !presets.length) {
      (_b = window.showToast) == null ? void 0 : _b.call(window, "本工坊暂无预置知识（自由创作工坊不预置）", "info");
      return;
    }
    const before = this.knowledgeBase.length;
    const added = this._mergePresets(presets);
    if (added) this.save();
    this.open();
    if (added) {
      (_c = window.showToast) == null ? void 0 : _c.call(window, `✓ 已补回 ${added} 条预置知识（同名条目已保留你的版本）`, "success");
    } else {
      window.UIDialog.alert({
        title: "预置知识",
        message: `本工坊共 ${presets.length} 条预置知识，当前均已就位（${before} 条知识中没有缺失）。
同名条目不会被覆盖——若想要回被你修改过的原版，请删除该条目后再点「↺ 预置」。`
      });
    }
  },
  save(opts) {
    var _a;
    const localEntries = this.knowledgeBase.filter(function(i) { return i.isGlobal !== true; });
    const data = {
      version: "1.0",
      app: "云境",
      genre: this.genre,
      savedAt: (new Date()).toISOString(),
      knowledge: localEntries
    };
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (e) {
      /* 配额满只在控制台说一次，避免每次保存刷屏；自动注入路径不再弹 toast 打扰开局 */
      if (!this._quotaWarned) {
        this._quotaWarned = true;
        console.warn("[StoryKnowledge] 保存失败（可能超出容量）:", e && e.name || e);
        if (!(opts && opts.silent)) {
          (_a = window.showToast) == null ? void 0 : _a.call(window, "知识库保存失败：浏览器本地存储已满。可在「工具箱 → 🛡 存档体检 → 世界书缓存」清理其它世界的缓存（本界条目不受影响）", "error");
        }
      }
      return false;
    }
    this._quotaWarned = false;
    this._saveGlobal();
    return true;
  },
  /** 是否参与 AI 写作注入（可在面板中一键开关） */
  isEnabled() {
    const v = localStorage.getItem(this.enabledKey);
    return v === null ? true : v === "true";
  },
  setEnabled(on) {
    localStorage.setItem(this.enabledKey, String(!!on));
  },
  getCount() {
    return this.knowledgeBase.length;
  },
  getStats() {
    const kb = this.knowledgeBase;
    return {
      total: kb.length,
      alwaysInclude: kb.filter((i) => i.alwaysInclude === true && i.enabled !== false).length,
      retrieval: kb.filter((i) => i.alwaysInclude !== true && i.enabled !== false).length,
      dlc: kb.filter((i) => i.source === "dlc" || i.category === "dlc").length,
      global: kb.filter((i) => i.isGlobal === true).length,
      top: kb.filter((i) => i.priority === "top").length,
      high: kb.filter((i) => i.priority === "high").length,
      medium: kb.filter((i) => i.priority === "medium").length,
      low: kb.filter((i) => i.priority === "low" || i.alwaysInclude && !i.priority).length
    };
  },
  getById(id) {
    return this.knowledgeBase.find((i) => i.id === id) || null;
  },
  /* ==================== 条目 CRUD ==================== */
  /** 生成条目 id */
  _genId() {
    return "kb_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
  },
  /** 规范化条目（导入/新建/编辑共用，剔除向量等运行时字段） */
  _normalizeEntry(raw) {
    var _a;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const always = raw.alwaysInclude === true;
    let priority = raw.priority;
    if (always && !["top", "high", "medium", "low"].includes(priority)) priority = "medium";
    if (!always) priority = "";
    const tags = Array.isArray(raw.tags) ? raw.tags.map((t) => String(t).trim()).filter(Boolean) : typeof raw.tags === "string" ? raw.tags.split(/[,，\s]+/).map((t) => t.trim()).filter(Boolean) : [];
    let keys = (Array.isArray(raw.keys) ? raw.keys : typeof raw.keys === "string" ? raw.keys.split(/[,，、\s]+/) : []).map((k) => String(k).trim()).filter((k) => k.length >= 1).slice(0, 30);
    /* v3.47.6 修复：预置知识条目（preset-knowledge.js）历史上只写了 tags、未写 keys，
       而 matchKeys() 的候选条件要求 keys 非空 —— 导致全部"按需（非驻留）"条目关键词触发命中恒为 0，
       只能靠 retrieve() 语义检索捞出 3 条，大量原著细节事实上无法进入上下文。
       此处以 tags 兜底作为触发词（tags 本就是为匹配而写的精准关键词），同时覆盖用户自建与 DLC 条目。 */
    if (!keys.length && !always && tags.length) keys = tags.slice(0, 30);
    let id = String(raw.id || "").replace(/[^a-zA-Z0-9_\-]/g, "");
    if (!id) id = this._genId();
    return {
      id,
      title: String(raw.title || "").trim(),
      content: String((_a = raw.content) != null ? _a : ""),
      category: raw.category || "通用",
      tags,
      keys,
      alwaysInclude: always,
      priority,
      source: raw.source || "manual",
      isGlobal: raw.isGlobal === true,
      ...raw.dlcId ? { dlcId: raw.dlcId } : {},
      createdAt: raw.createdAt || now,
      updatedAt: now
    };
  },
  addItem(raw) {
    const entry = this._normalizeEntry(raw);
    const idx = this.knowledgeBase.findIndex((e) => e.id === entry.id);
    if (idx !== -1) this.knowledgeBase[idx] = entry;
    else this.knowledgeBase.push(entry);
    delete this._vecCache[entry.id];
    delete this._bm25Cache[entry.id];
    this.save();
    return entry;
  },
  updateItem(id, patch) {
    const idx = this.knowledgeBase.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    const merged = { ...this.knowledgeBase[idx], ...patch, id, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    this.knowledgeBase[idx] = this._normalizeEntry(merged);
    delete this._vecCache[id];
    delete this._bm25Cache[id];
    this.save();
    return this.knowledgeBase[idx];
  },
  deleteItem(id) {
    const idx = this.knowledgeBase.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    this.knowledgeBase.splice(idx, 1);
    delete this._vecCache[id];
    delete this._bm25Cache[id];
    return this.save();
  },
  /** 调整注入方式：'' → 检索模式；top/high/medium/low → 常驻（模仿原框架 changeKBPriority） */
  setPriority(id, priority) {
    const item = this.getById(id);
    if (!item) return null;
    const always = ["top", "high", "medium", "low"].includes(priority);
    return this.updateItem(id, { alwaysInclude: always, priority: always ? priority : "" });
  },
  clearAll() {
    this.knowledgeBase = [];
    this._vecCache = {};
    this._bm25Cache = {};
    this.save();
  },
  /* ==================== 导入 / 导出 / 模板 ==================== */
  /**
   * 导入知识数据（兼容原框架格式）：
   *   [ ... ] 数组 / { knowledge: [...] } / { items: [...] }
   * id 重复时覆盖更新而非重复添加（与原框架一致）
   */
  importData(data, { replace = false } = {}) {
    let items = null;
    if (Array.isArray(data)) items = data;
    else if (Array.isArray(data == null ? void 0 : data.knowledge)) items = data.knowledge;
    else if (Array.isArray(data == null ? void 0 : data.items)) items = data.items;
    if (!items && typeof window !== "undefined" && window.STImport && window.STImport.parse) {      try {        const _stEs = window.STImport.parse(typeof data === "string" ? data : JSON.stringify(data));        if (Array.isArray(_stEs) && _stEs.length) items = _stEs;      } catch (_eST) {}    }    if (!items) throw new Error("未识别的知识库格式（支持条目数组或 { knowledge: [...] } 结构）");
    if (replace) {
      this.knowledgeBase = [];
      this._vecCache = {};
      this._bm25Cache = {};
    }
    let added = 0, updated = 0, skipped = 0;
    for (const raw of items) {
      if (!raw || !raw.title || !raw.content && raw.content !== 0) {
        skipped++;
        continue;
      }
      const entry = this._normalizeEntry(raw);
      const idx = this.knowledgeBase.findIndex((e) => e.id === entry.id);
      if (idx !== -1) {
        this.knowledgeBase[idx] = entry;
        updated++;
      } else {
        this.knowledgeBase.push(entry);
        added++;
      }
      delete this._vecCache[entry.id];
      delete this._bm25Cache[entry.id];
    }
    this.save();
    return { added, updated, skipped, total: this.knowledgeBase.length };
  },
  /** 导出（格式与原框架知识库导出对齐，可互相导入） */
  exportData() {
    return {
      version: "1.0",
      app: "云境",
      genre: this.genre,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      method: "keyword",
      knowledge: this.knowledgeBase
    };
  },
  /** 下载知识库模板（模仿原框架 createKnowledgeTemplate） */
  buildTemplate() {
    return {
      version: "1.0",
      app: "云境",
      instructions: "将 knowledge 数组中的示例替换为你的设定资料。字段说明：title 标题；content 内容；category 分类；tags 标签数组；alwaysInclude 设为 true 则每轮创作请求都注入（常驻）；priority 常驻条目的优先级（top/high/medium/low），留空且 alwaysInclude 为 false 时为按需检索模式。",
      knowledge: [
        { title: "世界观总纲", category: "世界观", tags: ["核心", "世界"], alwaysInclude: true, priority: "top", content: "示例：这个世界的基本法则、历史脉络与力量体系。核心常驻条目会以最高优先级注入每轮创作请求，适合存放不可违背的铁律设定。" },
        { title: "主角档案", category: "人物", tags: ["主角"], alwaysInclude: true, priority: "high", content: "示例：主角的姓名、身份、外貌特征、性格内核、说话习惯与行动逻辑。重点常驻条目每轮注入且贴近本轮指令。" },
        { title: "雾隐城", category: "地点", tags: ["城市", "地图"], alwaysInclude: true, priority: "medium", content: "示例：故事主要发生地的地理、街区、氛围与势力分布。次重点常驻条目每轮注入，位于背景层。" },
        { title: "守夜人会", category: "组织", tags: ["组织"], alwaysInclude: false, priority: "", content: "示例：某个组织的结构、成员、行事风格与禁忌。检索条目只在情节与之相关时被自动检索注入。" },
        { title: "青铜罗盘", category: "道具", tags: ["道具", "伏笔"], alwaysInclude: false, priority: "", content: "示例：关键道具的来历、能力与代价。" },
        { title: "叙事文风约束", category: "文风", tags: ["文风"], alwaysInclude: true, priority: "low", content: "示例：行文偏好补充（如意象、句式、留白习惯），一般常驻条目每轮注入于背景层。" }
      ]
    };
  },
  _download(content, filename) {
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  },
  /* ==================== BM25 检索引擎（v1.6.9 T2-⑥ 升级） ====================
   * 旧引擎（纯余弦 + 绝对阈值 0.12）的两个致命伤：
   *   ① 查询是"本轮指令 + 最近正文"拼接（数百字），向量维度远多于条目，
   *      余弦相似度被长度稀释——真实创作查询命中率趋近于零，检索形同虚设；
   *   ② 绝对阈值对查询/条目长度无自适应性，错杀长短不一的相关条目。
   * 新引擎：BM25（词频饱和 k1=1.5 + 长度归一 b=0.75 + IDF 加权），
   *   中文二元词组切词；标题词项 3 倍加权（标题命中是最强相关信号）；
   *   查询先清洗（剥变量块 / 段落标记 / 标点噪声）。
   * 选择策略（T1-②）：绝对下限 0.03 + 相对截断（不低于最高分 35%）取 top-k——
   *   只要本轮最相关条目过下限，同一量级的相关条目一并入选。 */
  /** 分词：中文连续段取二元词组，英文/数字按整词（小写化） */
  tokenize(text) {
    const out = [];
    if (!text) return out;
    const cleaned = String(text).toLowerCase();
    const cjkWords = cleaned.replace(/[^\u4e00-\u9fff]+/g, " ").split(/\s+/).filter(Boolean);
    for (const word of cjkWords) {
      for (let i = 0; i < word.length - 1; i++) out.push(word.slice(i, i + 2));
    }
    const latin = cleaned.match(/[a-z0-9]{2,}/g) || [];
    out.push(...latin);
    return out;
  },
  /** 查询清洗：剥变量块 / 段落标记 / 标点噪声，只留有效语料 */
  cleanQuery(query) {
    return String(query || "").replace(/\(variable_update\)[\s\S]*?\(\/variable_update\)/gi, " ").replace(/[(【<]\/?variable_update[)】>]/gi, " ").replace(/[【】\[\]{}（）()"'“”…—·、,，。！!？?：:；;\n\r\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
  },
  /** 条目 BM25 索引项 { tf: 词频表, len: 词项总数 }；标题词项 3 倍权重（内存缓存） */
  _bm25Doc(item) {
    if (!this._bm25Cache) this._bm25Cache = {};
    if (!this._bm25Cache[item.id]) {
      const title = `${item.title || ""} ${(item.tags || []).join(" ")}`;
      const terms = [].concat(this.tokenize(title), this.tokenize(title), this.tokenize(title)).concat(this.tokenize(this._contentText(item.content)));
      const tf = {};
      terms.forEach((t) => {
        tf[t] = (tf[t] || 0) + 1;
      });
      this._bm25Cache[item.id] = { tf, len: terms.length || 1 };
    }
    return this._bm25Cache[item.id];
  },
  /** BM25 打分（k1 词频饱和 / b 长度归一 / idf 逆文档频率） */
  _bm25Score(doc, queryTerms, df, docCount, avgLen) {
    const k1 = 1.5, b = 0.75;
    let score = 0;
    for (const term of queryTerms) {
      const tf = doc.tf[term] || 0;
      if (!tf) continue;
      const n = df[term] || 0;
      const idf = Math.log(1 + (docCount - n + 0.5) / (n + 0.5));
      score += idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (doc.len / avgLen)));
    }
    return score;
  },
  /**
   * 检索与查询最相关的知识条目（非常驻条目）
   * BM25 打分 + 标题整串命中强加分；绝对下限 0.03，相对截断（≥最高分 35%），默认取前 3 条
   * 返回条目的 similarity 为相对分（最高命中 = 1），用于注入文案的相关度展示
   */
  retrieve(query, maxCount = 3) {
    if (!query || !this.isEnabled()) return [];
    const candidates = this.knowledgeBase.filter((i) => i.alwaysInclude !== true && i.enabled !== false);
    if (!candidates.length) return [];
    const cleaned = this.cleanQuery(query);
    if (!cleaned) return [];
    const qTerms = [...new Set(this.tokenize(cleaned))];
    if (!qTerms.length) return [];
    const docs = candidates.map((i) => this._bm25Doc(i));
    const df = {};
    docs.forEach((d) => Object.keys(d.tf).forEach((t) => {
      df[t] = (df[t] || 0) + 1;
    }));
    const avgLen = docs.reduce((a, d) => a + d.len, 0) / (docs.length || 1);
    const docCount = docs.length;
    const scored = candidates.map((item, i) => {
      let score = this._bm25Score(docs[i], qTerms, df, docCount, avgLen);
      const title = (item.title || "").trim();
      if (title && cleaned.includes(title)) score += 5;
      return { item, score };
    }).filter((s) => s.score > 0.03);
    if (!scored.length) return [];
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0].score;
    const kept = scored.filter((s) => s.score >= best * 0.35).slice(0, maxCount);
    return kept.map((s) => ({ ...s.item, similarity: Math.min(1, s.score / (best || 1)) }));
  },
  /** 取 BM25 候选池（不做相对截断，供向量/重排精排） */
  _bm25Rank(query, limit = 20) {
    if (!query || !this.isEnabled()) return [];
    const candidates = this.knowledgeBase.filter((i) => i.alwaysInclude !== true && i.enabled !== false);
    if (!candidates.length) return [];
    const cleaned = this.cleanQuery(query);
    if (!cleaned) return [];
    const qTerms = [...new Set(this.tokenize(cleaned))];
    if (!qTerms.length) return [];
    const docs = candidates.map((i) => this._bm25Doc(i));
    const df = {};
    docs.forEach((d) => Object.keys(d.tf).forEach((t) => {
      df[t] = (df[t] || 0) + 1;
    }));
    const avgLen = docs.reduce((a, d) => a + d.len, 0) / (docs.length || 1);
    const docCount = docs.length;
    const scored = candidates.map((item, i) => {
      let score = this._bm25Score(docs[i], qTerms, df, docCount, avgLen);
      const title = (item.title || "").trim();
      if (title && cleaned.includes(title)) score += 5;
      return { item, score };
    }).filter((s) => s.score > 0.03);
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0] ? scored[0].score : 0;
    return scored.slice(0, limit).map((s) => ({ ...s.item, bm25: s.score, similarity: best ? Math.min(1, s.score / best) : 0 }));
  },
  /** 单条目检索自测：返回该条目在本查询下的相对相关度（0 = 未命中） */
  testItemRetrieval(id, query) {
    if (!id || !query) return 0;
    const hit = this.retrieve(query, 50).find((r) => r.id === id);
    return hit ? hit.similarity : 0;
  },
  /* ==================== AI 上下文注入（模仿原框架 buildOptimizedMessages 的分层策略） ==================== */
  _contentText(content) {
    return typeof content === "object" && content !== null ? JSON.stringify(content, null, 2) : String(content != null ? content : "");
  },
  /** 单条注入文本（超长截断，避免 token 失控） */
  _itemText(item) {
    let text = this._contentText(item.content);
    if (text.length > 1500) text = text.slice(0, 1500) + "……（内容过长已截断）";
    return `【${item.title}】（${item.category}）
${text}`;
  },
  _layerMessage(items, title) {
    if (!items.length) return null;
    return { role: "system", content: `${title}
${items.map((i) => this._itemText(i)).join("\n\n")}` };
  },
  /** 背景层常驻知识（一般/次重点），置于对话历史之前 */
  buildBackgroundKnowledge() {
    if (!this.isEnabled()) return [];
    const always = this.knowledgeBase.filter((i) => i.alwaysInclude === true && i.enabled !== false);
    const messages = [];
    const low = this._layerMessage(always.filter((i) => !i.priority || i.priority === "low"), "【一般常驻知识（背景参考）】");
    if (low) messages.push(low);
    const medium = this._layerMessage(always.filter((i) => i.priority === "medium"), "【次重点常驻知识（背景参考）】");
    if (medium) messages.push(medium);
    return messages;
  },
  /** 前景层知识（核心/重点常驻 + 关键词触发 + 相关检索），置于本轮指令之前以获得更高权重 */
  buildForegroundKnowledge(userMessage, history = [], precomputedRelevant = null) {
    if (!this.isEnabled()) return [];
    const messages = [];
    const always = this.knowledgeBase.filter((i) => i.alwaysInclude === true && i.enabled !== false);
    const high = this._layerMessage(always.filter((i) => i.priority === "high"), "【重点常驻知识（写作时须贯彻）】");
    if (high) messages.push(high);
    const top = this._layerMessage(always.filter((i) => i.priority === "top"), "【核心设定知识（最高优先级，必须严格遵守）】");
    if (top) messages.push(top);
    const triggered = this.matchKeys(userMessage, history);
    if (triggered.length) {
      let text = "【触发式设定（关键词命中，本段情节涉及，写作时须遵守）】：\n\n";
      triggered.forEach((item) => {
        text += `${this._itemText(item)}

`;
      });
      messages.push({ role: "system", content: text.trim() });
    }
    const query = this._buildQuery(userMessage, history);
    const relevant = (precomputedRelevant && precomputedRelevant.length) ? precomputedRelevant : this.retrieve(query, 3);
    if (relevant.length) {
      let text = "【相关知识库】以下是与当前情节相关的背景资料，写作时可自然引用（严禁在正文中罗列资料原文）：\n\n";
      relevant.forEach((item, i) => {
        text += `资料${i + 1}（${item.category} - ${item.title}，相关度 ${(item.similarity * 100).toFixed(0)}%）：
${this._contentText(item.content).slice(0, 1200)}

`;
      });
      messages.push({ role: "system", content: text.trim() });
    }
    console.log(`[StoryKnowledge] 本轮注入：常驻 ${always.length} 条（top:${always.filter((i) => i.priority === "top").length}/high:${always.filter((i) => i.priority === "high").length}/medium:${always.filter((i) => i.priority === "medium").length}/low:${always.filter((i) => !i.priority || i.priority === "low").length}），关键词触发 ${triggered.length} 条，检索命中 ${relevant.length} 条`);
    return messages;
  },
  /**
   * 异步前景知识（v3.49.0）：检索可走「BM25 候选池 → 向量/重排」，
   * 由 js/kb-vector.js 提供；未配置、超时或报错时自动回退纯 BM25，不阻断写作。
   */
  async buildForegroundKnowledgeAsync(userMessage, history = []) {
    if (!this.isEnabled()) return [];
    let rel = null;
    try {
      if (window.KBVector && typeof window.KBVector.retrieve === "function" && window.KBVector.isOn()) {
        const query = this._buildQuery(userMessage, history);
        rel = await window.KBVector.retrieve(this, query, 3);
      }
    } catch (e) {
      console.warn("[StoryKnowledge] 向量检索失败，已回退 BM25：", e && e.message ? e.message : e);
    }
    return this.buildForegroundKnowledge(userMessage, history, rel);
  },
  /**
   * v3.18.0 关键词触发：keys 命中「本轮指令 + 最近 scanDepth 轮正文」即注入
   * 命中口径：大小写不敏感、不做分词（世界书惯例是整词匹配，中文即子串）；
   * 常驻条目不参与（它们本来就每轮在场）；按 insertionOrder/优先级稳定排序，上限 5 条防膨胀
   */
  matchKeys(userMessage, history = [], maxCount = 5) {
    if (!this.isEnabled()) return [];
    const scanDepth = Math.max(1, Math.min(10, Number(localStorage.getItem(KB_KEY_DEPTH_KEY)) || 4));
    const parts = [String(userMessage || "")];
    let used = 0;
    for (let i = history.length - 1; i >= 0 && used < scanDepth; i--) {
      if (history[i].role !== "assistant") continue;
      let body = String(history[i].content || "");
      body = body.replace(/\(variable_update\)[\s\S]*?\(\/variable_update\)/gi, " ");
      parts.push(body);
      used++;
    }
    const scanWindow = parts.join("\n").toLowerCase();
    if (!scanWindow.trim()) return [];
    const cands = this.knowledgeBase.filter((i) => i.alwaysInclude !== true && Array.isArray(i.keys) && i.keys.length);
    const hits = [];
    for (const item of cands) {
      const hitKeys = item.keys.filter((k) => {
        const kw = String(k).trim().toLowerCase();
        return kw && scanWindow.includes(kw);
      });
      if (hitKeys.length) hits.push({ item, n: hitKeys.length, keys: hitKeys });
    }
    hits.sort((a, b) => b.n - a.n || String(a.item.title).localeCompare(String(b.item.title)));
    return hits.slice(0, maxCount).map((h) => ({ ...h.item, hitKeys: h.keys }));
  },
  /** 组合检索查询：本轮指令 + 最近一段正文（提升检索命中率） */
  _buildQuery(userMessage, history) {
    let query = String(userMessage || "");
    for (let i = history.length - 1; i >= 0 && query.length < 600; i--) {
      if (history[i].role !== "assistant") continue;
      let body = String(history[i].content || "");
      body = body.replace(/\(variable_update\)[\s\S]*?\(\/variable_update\)/gi, " ");
      query += " " + body.slice(0, 400);
      break;
    }
    return query;
  },
  /* ==================== UI：主面板 ==================== */
  open() {
    let modal = document.getElementById("knowledgeModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "knowledgeModal";
      modal.className = "modal-overlay";
      modal.addEventListener("click", (e) => {
        if (e.target === modal) this.close();
      });
      document.body.appendChild(modal);
    }
    modal.innerHTML = this._buildMainHTML();
    modal.style.display = "flex";
    this.filterList("");
  },
  close() {
    const modal = document.getElementById("knowledgeModal");
    if (modal) modal.style.display = "none";
  },
  _genreName() {
    var _a;
    return ((_a = window.GenreStoryConfig) == null ? void 0 : _a.genreName) || "当前工坊";
  },
  _buildMainHTML() {
    const s = this.getStats();
    const enabled = this.isEnabled();
    const catOptions = KB_CATEGORIES.map((c) => `<option>${c}</option>`).join("");
    return `
        <div class="modal-box wide">
            <div class="modal-header">
                <span>📚 知识库 · ${this._genreName()}</span>
                <button class="modal-close" onclick="StoryKnowledge.close()">✕</button>
            </div>
            <div class="modal-body">
                <div class="kb-stats">
                    <div class="kb-stat"><b>${s.total}</b><i>总条目</i></div>
                    <div class="kb-stat"><b>${s.alwaysInclude}</b><i>常驻注入</i></div>
                    <div class="kb-stat"><b>${s.retrieval}</b><i>按需检索</i></div>
                    <div class="kb-stat"><b>${s.global}</b><i>🌐 全局</i></div>
                </div>
                <div class="kb-switch ${enabled ? "on" : ""}" id="kbEnabledSwitch" onclick="StoryKnowledge.toggleEnabled()">
                    <span class="kb-switch-dot"></span>
                    <span class="kb-switch-text">${enabled ? "✓ 参与创作注入：已开启" : "参与创作注入：已关闭（条目仅存档，不进入 AI 上下文）"}</span>
                </div>
                ${window.KBVector ? window.KBVector.buildPanelHTML() : ""}
                ${this._buildWlenHTML()}
                <div class="form-tip">常驻条目每轮创作请求按优先级注入（核心/重点贴近指令，次重点/一般置于背景）；检索条目仅在与当前情节相关时自动注入（最多 3 条）。知识随工坊独立保存，可通过导入导出跨设备迁移。</div>
                <div class="kb-actions">
                    <button class="btn-solid btn-mini" onclick="StoryKnowledge.openEditor()">➕ 添加条目</button>
                    <button class="btn-ghost btn-mini forge-entry" onclick="CreatorForge.open()" title="按模板建自设势力 / 人物 / 道具 / 技能…">🧬 原创设计</button>
                    <button class="btn-ghost btn-mini" onclick="StoryKnowledge.filterGlobal()">🌐 全局</button>
                    <button class="btn-ghost btn-mini" onclick="StoryKnowledge.filterLocal()">📂 本界</button>
                    <button class="btn-ghost btn-mini" onclick="StoryKnowledge.importFromFile()">📥 导入</button>
                    <button class="btn-ghost btn-mini" onclick="StoryKnowledge.exportToFile()">📤 导出</button>
                    <button class="btn-ghost btn-mini" onclick="StoryKnowledge.downloadTemplate()">📝 模板</button>
                    <button class="btn-ghost btn-mini" onclick="StoryKnowledge.restorePresets()" title="补回本工坊缺失的专属预置知识（同名条目不覆盖）">↺ 预置</button>
                    <button class="btn-ghost btn-mini danger" onclick="StoryKnowledge.confirmClear()">🗑 清空</button>
                </div>
                <input id="kbSearchInput" class="kb-search" type="text" placeholder="🔍 搜索标题 / 内容 / 标签…" oninput="StoryKnowledge.filterList(this.value)">
                <div class="kb-list" id="kbListContainer"></div>
            </div>
            <div class="modal-footer">
                <button class="btn-ghost" onclick="StoryKnowledge.close()">关闭</button>
            </div>
        </div>`;
  },
  toggleEnabled() {
    var _a;
    this.setEnabled(!this.isEnabled());
    this.open();
    (_a = window.showToast) == null ? void 0 : _a.call(window, this.isEnabled() ? "✓ 知识库已开启创作注入" : "知识库注入已关闭", "success");
  },
  /* ==================== v3.37.0 正文篇幅·字数调节（玩家反馈专项） ==================== */
  /** 字数调节条目（条目本身即存储：改写内容 = 改档位） */
  _wlenEntry() {
    return this.knowledgeBase.find((i) => String(i.title).trim() === KB_WLEN_TITLE);
  },
  /** 解析当前档位：{ label, range } 或 null（条目缺失/被改坏时各按钮全灰，点任意档即重建） */
  _wlenCurrent() {
    const e = this._wlenEntry();
    if (!e) return null;
    const m = /当前档位：(.+?)——每轮场景正文目标\s*([^字\n]+?)\s*字/.exec(this._contentText(e.content));
    return m ? { label: m[1].trim(), range: m[2].trim() } : null;
  },
  /** 面板顶部「📏 正文字数调节」档位条 HTML */
  _buildWlenHTML() {
    const cur = this._wlenCurrent();
    const curLabel = cur ? cur.label : "";
    const curRange = cur ? cur.range : "";
    const activeLv = KB_WLEN_LEVELS.find((l) => curLabel === `${l.label}版`) || null;
    const btns = KB_WLEN_LEVELS.map((l) => `
            <button class="kb-wl-btn ${activeLv && activeLv.id === l.id ? "on" : ""}" onclick="StoryKnowledge.adjustWordLength('${l.id}')" title="${l.note}">
                <b>${l.label}</b><i>${l.range[0]}~${l.range[1]}字</i>
            </button>`).join("");
    return `
        <div class="kb-wlen">
            <div class="kb-wlen-head">
                <span class="kb-wlen-name">📏 正文字数调节</span>
                <span class="kb-wlen-cur">${cur ? `当前：<b>${curLabel}</b>（${curRange} 字）` : "未设置——点任意档位立即开启"}</span>
            </div>
            <div class="kb-wlen-btns">${btns}
                <span class="kb-wlen-custom">
                    <input id="kbWlenCustom" type="number" min="100" max="6000" step="50" placeholder="自定义字数">
                    <button class="btn-ghost btn-mini" onclick="StoryKnowledge.adjustWordLengthCustom()">应用</button>
                </span>
            </div>
            <div class="form-tip">每轮正文的目标篇幅，点选即时生效——写入下方「${KB_WLEN_TITLE}」常驻条目（👑 核心优先级，AI 每轮遵守，优先级高于世界默认篇幅）；重大转折与高潮戏自动上浮约三成，纯寒暄过场自动下浮。注意：上方「参与创作注入」关闭时字数条目同样不生效。</div>
        </div>`;
  },
  /** 档位内容模板（与 preset-knowledge.js 预置条目同构，保证解析稳定） */
  _wlenContent(label, range) {
    return `【正文篇幅·玩家亲设】当前档位：${label}——每轮场景正文目标 ${range} 字。
铁律：
1. 本条目是玩家亲手设定的篇幅指令，优先级高于世界默认篇幅要求与文风偏好；
2. 字数指场景正文（对白计入），变量块、行动选项、插图标记不计入；
3. 写满目标篇幅靠分层推进（场景/动作/对白/心理/感官细节），严禁复读原文与注水凑字；
4. 弹性区间：重大转折、战斗与情感高潮允许上浮约三成；单句寒暄、纯过场允许下浮至六成；其余回合务必落在区间内；
5. 玩家本轮临时要求加长或缩短时从其本轮指令，下一轮自动回落本档位。`;
  },
  /** 点档位按钮：改写（或重建）字数条目 */
  adjustWordLength(levelId) {
    var _a;
    const lv = KB_WLEN_LEVELS.find((l) => l.id === levelId);
    if (!lv) return;
    this._applyWlen(`${lv.label}版`, `${lv.range[0]}~${lv.range[1]}`);
    (_a = window.showToast) == null ? void 0 : _a.call(window, `✓ 正文篇幅已调为：${lv.label}版（每轮 ${lv.range[0]}~${lv.range[1]} 字）`, "success");
  },
  /** 自定义字数：±25% 弹性区间 */
  adjustWordLengthCustom() {
    var _a, _b;
    const input = document.getElementById("kbWlenCustom");
    const n = Math.round(Number(input && input.value) || 0);
    if (!Number.isFinite(n) || n < 100 || n > 6e3) {
      (_a = window.showToast) == null ? void 0 : _a.call(window, "自定义字数请填 100~6000（目标字数，允许上下浮动约四分之一）", "info");
      return;
    }
    const lo = Math.max(50, Math.round(n * 0.75 / 10) * 10);
    const hi = Math.round(n * 1.25 / 10) * 10;
    this._applyWlen(`自定义·${n}字`, `${lo}~${hi}`);
    (_b = window.showToast) == null ? void 0 : _b.call(window, `✓ 正文篇幅已调为：自定义（约 ${n} 字）`, "success");
  },
  /** 落库：有条目则改写，没有则重建（误删自救） */
  _applyWlen(label, range) {
    const content = this._wlenContent(label, range);
    const e = this._wlenEntry();
    if (e) {
      this.updateItem(e.id, { content, alwaysInclude: true, priority: "top" });
    } else {
      this.knowledgeBase.push(this._normalizeEntry({
        title: KB_WLEN_TITLE,
        content,
        category: "规则",
        tags: ["字数调节", "篇幅", "玩家亲设", "每轮必遵"],
        alwaysInclude: true,
        priority: "top",
        source: "preset"
      }));
      this.save();
    }
    this.open();
  },
  /** 渲染列表（带前端关键词过滤，模仿原框架 filterKBList） */
  filterList(keyword) {
    const container = document.getElementById("kbListContainer");
    if (!container) return;
    const kw = String(keyword || "").trim().toLowerCase();
    let items = this.knowledgeBase;
    if (this._filterMode === "global") items = items.filter((i) => i.isGlobal === true);
    else if (this._filterMode === "local") items = items.filter((i) => i.isGlobal !== true);
    if (kw) {
      items = items.filter((i) => (i.title || "").toLowerCase().includes(kw) || this._contentText(i.content).toLowerCase().includes(kw) || (i.tags || []).some((t) => String(t).toLowerCase().includes(kw)) || (i.category || "").toLowerCase().includes(kw));
    }
    if (!items.length) {
      container.innerHTML = `<div class="kb-empty">${this.knowledgeBase.length ? "🔍 没有匹配的知识条目" : "📦 知识库为空：点击「添加条目」录入设定，或「导入」知识库文件 / 「模板」生成示例结构"}</div>`;
      return;
    }
    container.innerHTML = items.map((item) => this._buildItemHTML(item)).join("");
  },
  filterGlobal() { this._filterMode = "global"; this.filterList(""); },
  filterLocal() { this._filterMode = "local"; this.filterList(""); },
  _buildItemHTML(item) {
    const isDLC = item.source === "dlc" || item.category === "dlc";
    const isPreset = item.source === "preset";
    const isGlobal = item.isGlobal === true;
    const badges = [
      `<span class="kb-badge ${item.alwaysInclude ? "b-" + (item.priority || "low") : "b-retrieval"}">${KB_PRIORITY_LABEL[item.alwaysInclude ? item.priority || "low" : ""] || "🔎 检索"}</span>`,
      `<span class="kb-badge b-cat">${kbEsc(item.category)}</span>`
    ];
    if (isGlobal) badges.push(`<span class="kb-badge b-global">🌐 全局</span>`);
    if (isDLC) badges.push(`<span class="kb-badge b-dlc">📦 DLC</span>`);
    if (isPreset) badges.push(`<span class="kb-badge b-preset">🏛 预置</span>`);
    const preview = this._contentText(item.content).slice(0, 120).replace(/\s+/g, " ");
    const tagsHtml = (item.tags || []).length ? item.tags.map((t) => `<span class="kb-tag">${kbEsc(t)}</span>`).join("") : "";
    const globalBtn = `<button class="btn-ghost btn-mini kb-global-toggle${isGlobal ? " on" : ""}" onclick="event.stopPropagation(); StoryKnowledge.toggleGlobal('${kbEsc(item.id)}'); StoryKnowledge.open();" title="${isGlobal ? "点击设为仅本界" : "点击设为全局（所有世界通用）"}">${isGlobal ? "🌐 全局" : "📂 本界"}</button>`;
    return `
        <div class="kb-item" + (item.enabled === false ? " kb-off" : "") + " onclick="StoryKnowledge.openDetail('${kbEsc(item.id)}')">
            <div class="kb-item-top">
                <div class="kb-badges">${badges.join("")}</div>
                <span class="kb-item-title">${kbEsc(item.title)}</span>
                ${globalBtn}
                <button class="btn-ghost btn-mini danger kb-item-del" onclick="event.stopPropagation(); StoryKnowledge.confirmDelete('${kbEsc(item.id)}')">删除</button>
            </div>
            <div class="kb-item-preview">${kbEsc(preview)}${this._contentText(item.content).length > 120 ? "…" : ""}</div>
            <div class="kb-item-meta">${tagsHtml}<span class="kb-item-date">${kbTime(item.updatedAt || item.createdAt)}</span></div>
        </div>`;
  },
  /* ==================== UI：条目编辑器（新增 / 编辑共用） ==================== */
  _editingId: null,
  openEditor(id) {
    const item = id ? this.getById(id) : null;
    this._editingId = id || null;
    let modal = document.getElementById("kbEditorModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "kbEditorModal";
      modal.className = "modal-overlay";
      modal.addEventListener("click", (e) => {
        if (e.target === modal) this.closeEditor();
      });
      document.body.appendChild(modal);
    }
    const catOptions = KB_CATEGORIES.map((c) => `<option value="${c}" ${item && item.category === c ? "selected" : ""}>${c}</option>`).join("");
    const isKeyMode = !!(item && !item.alwaysInclude && Array.isArray(item.keys) && item.keys.length);
    const priority = item ? item.alwaysInclude ? item.priority : isKeyMode ? "key" : "" : "";
    modal.innerHTML = `
        <div class="modal-box">
            <div class="modal-header">
                <span>${item ? "✏️ 编辑知识条目" : "➕ 新增知识条目"}</span>
                <button class="modal-close" onclick="StoryKnowledge.closeEditor()">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-row">
                    <label>标题 *</label>
                    <input id="kbEdTitle" type="text" placeholder="例如：主角档案 / 雾隐城 / 守夜人会" value="${kbEscAttr((item == null ? void 0 : item.title) || "")}">
                </div>
                <div class="form-row two-col">
                    <div>
                        <label>分类</label>
                        <select id="kbEdCategory">${catOptions}</select>
                    </div>
                    <div>
                        <label>标签（逗号分隔）</label>
                        <input id="kbEdTags" type="text" placeholder="例如：核心, 组织, 伏笔" value="${kbEscAttr(((item == null ? void 0 : item.tags) || []).join(", "))}">
                    </div>
                </div>
                <div class="form-row">
                    <label>注入方式</label>
                    <select id="kbEdPriority" onchange="StoryKnowledge.updatePriorityDesc(this.value)">
                        <option value="" ${priority === "" ? "selected" : ""}>🔎 按需检索（与情节相关时自动注入）</option>
                        <option value="key" ${priority === "key" ? "selected" : ""}>🗝 关键词触发（命中关键词才注入，世界书模式）</option>
                        <option value="top" ${priority === "top" ? "selected" : ""}>👑 核心常驻（最高优先级）</option>
                        <option value="high" ${priority === "high" ? "selected" : ""}>⭐ 重点常驻</option>
                        <option value="medium" ${priority === "medium" ? "selected" : ""}>📌 次重点常驻</option>
                        <option value="low" ${priority === "low" ? "selected" : ""}>📋 一般常驻</option>
                    </select>
                    <div class="form-tip" id="kbEdPriorityDesc"></div>
                </div>
                <div class="form-row" id="kbEdKeysRow" style="display:${priority === "key" ? "" : "none"}">
                    <label>触发关键词（逗号分隔，任一命中即注入）</label>
                    <input id="kbEdKeys" type="text" placeholder="例如：雾隐城, 守夜人, 旧约" value="${kbEscAttr(((item == null ? void 0 : item.keys) || []).join(", "))}">
                    <div class="form-tip">扫描最近几轮正文与本轮指令，任一关键词出现即注入该条目（最多命中 5 条 / 轮）。导入的角色卡世界书就是用这种方式工作。</div>
                </div>
                <div class="form-row">
                    <label>内容 *（至少 20 字）</label>
                    <textarea id="kbEdContent" rows="8" placeholder="设定资料的完整内容：人物写身份/性格/动机/秘密，地点写地理/氛围/势力，世界观写法则/历史/力量体系…" oninput="StoryKnowledge.updateCharCount()">${kbEsc(item ? this._contentText(item.content) : "")}</textarea>
                    <div class="form-tip" id="kbEdCharCount"></div>
                </div>
                <div class="form-row">
                    <label>作用范围</label>
                    <div class="kb-global-toggle-row">
                        <label class="kb-global-check"><input type="checkbox" id="kbEdGlobal" ${item && item.isGlobal ? "checked" : ""}> 🌐 全局知识（勾选后所有世界通用，切换世界也生效）</label>
                        <div class="form-tip">不勾选则仅当前世界（${this._genreName()}）可見。适合放通用文风偏好、写作纪律等跨世界设定。</div>
                    </div>
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
      modal.addEventListener("click", (e) => {
        if (e.target === modal) this.closeDetail();
      });
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
    if (!query || !result) return;
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
      modal.addEventListener("click", (e) => {
        if (e.target === modal) this.closePriority();
      });
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
    if (!item) return;
    const ok = await window.UIDialog.confirm({
      title: "删除知识条目",
      message: `确定删除「${item.title}」吗？此操作不可恢复。${item.source === "dlc" ? "\n（该条目来自 DLC 知识包，删除后重新激活对应 DLC 可恢复）" : ""}`,
      danger: true,
      confirmText: "删除"
    });
    if (!ok) return;
    this.deleteItem(id);
    this.closeDetail();
    this.open();
    (_a = window.showToast) == null ? void 0 : _a.call(window, `✓ 已删除「${item.title}」`, "success");
  },
  async confirmClear() {
    var _a, _b;
    if (!this.knowledgeBase.length) {
      (_a = window.showToast) == null ? void 0 : _a.call(window, "知识库已经是空的", "info");
      return;
    }
    const ok = await window.UIDialog.confirm({
      title: "清空知识库",
      message: `确定清空全部 ${this.knowledgeBase.length} 条知识（含 DLC 注入条目）吗？
此操作不可恢复，建议先导出备份。清空后可随时从「预置知识库」恢复本工坊的专属设定。`,
      danger: true,
      confirmText: "全部清空"
    });
    if (!ok) return;
    this.clearAll();
    this.open();
    (_b = window.showToast) == null ? void 0 : _b.call(window, "✓ 知识库已清空", "success");
  },
  importFromFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = () => {
      var _a;
      const file = (_a = input.files) == null ? void 0 : _a[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        var _a2, _b;
        try {
          const data = JSON.parse(e.target.result);
          const result = this.importData(data);
          this.open();
          (_a2 = window.showToast) == null ? void 0 : _a2.call(window, `✓ 导入完成：新增 ${result.added} 条，更新 ${result.updated} 条${result.skipped ? `，跳过 ${result.skipped} 条无效数据` : ""}`, "success");
        } catch (err) {
          (_b = window.showToast) == null ? void 0 : _b.call(window, `导入失败：${err.message}`, "error");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  },
  exportToFile() {
    var _a, _b;
    if (!this.knowledgeBase.length) {
      (_a = window.showToast) == null ? void 0 : _a.call(window, "知识库为空，无可导出内容", "error");
      return;
    }
    this._download(JSON.stringify(this.exportData(), null, 2), `云境知识库_${this.genre}_${Date.now()}.json`);
    (_b = window.showToast) == null ? void 0 : _b.call(window, `✓ 已导出 ${this.knowledgeBase.length} 条知识（JSON）`, "success");
  },
  downloadTemplate() {
    var _a;
    this._download(JSON.stringify(this.buildTemplate(), null, 2), `云境知识库模板.json`);
    (_a = window.showToast) == null ? void 0 : _a.call(window, "✓ 模板已下载：替换示例内容后可导入", "success");
  }
};
function kbEsc(s) {
  return String(s != null ? s : "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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
