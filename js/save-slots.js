(function() {
  "use strict";
  const SaveSlots = {
    regKey(genre) {
      var _a;
      return `storySlots_${genre || ((_a = window.storyFramework) == null ? void 0 : _a.genre)}`;
    },
    activeKey(genre) {
      var _a;
      return `storyActiveSlot_${genre || ((_a = window.storyFramework) == null ? void 0 : _a.genre)}`;
    },
    genre() {
      var _a;
      return ((_a = window.storyFramework) == null ? void 0 : _a.genre) || "free";
    },
    /** 读注册表（恒含 main 槽——首次访问时惰性补建） */
    list() {
      const g = this.genre();
      let arr = [];
      try {
        arr = JSON.parse(localStorage.getItem(this.regKey(g)) || "[]");
      } catch (e) {
        arr = [];
      }
      if (!Array.isArray(arr)) arr = [];
      if (!arr.some((s) => s.id === "main")) {
        arr.unshift({ id: "main", name: "主档", createdAt: Date.now(), updatedAt: Date.now() });
        this._write(arr);
      }
      return arr;
    },
    _write(arr) {
      try {
        localStorage.setItem(this.regKey(this.genre()), JSON.stringify(arr));
      } catch (e) {
      }
    },
    activeId() {
      try {
        return localStorage.getItem(this.activeKey()) || "main";
      } catch (e) {
        return "main";
      }
    },
    /** 槽位是否有档（主档无注册表记录但存在旧存档时也能识别；
     *  v3.19.2：配额耗尽转存 IndexedDB 的档位以 .idb 旗标识别） */
    hasSave(slotId) {
      const fw = window.storyFramework;
      const suffix = slotId && slotId !== "main" ? `~${slotId}` : "";
      const key = `storySave_${fw.genre}${suffix}`;
      return !!(localStorage.getItem(key) || localStorage.getItem(key + ".bak") || localStorage.getItem(key + ".idb"));
    },
    /** 每次存档后同步元数据（由 fw.saveStory 调用） */
    syncMeta(fw) {
      var _a;
      const g = fw.genre;
      let rows = [];
      try {
        rows = JSON.parse(localStorage.getItem(this.regKey(g)) || "[]");
      } catch (e) {
      }
      if (!Array.isArray(rows)) rows = [];
      const v = fw.storyState.variables || {};
      const ex = rows.find((r) => r.id === fw.slotId);
      const meta = {
        id: fw.slotId,
        name: (ex == null ? void 0 : ex.name) || (fw.slotId === "main" ? "主档" : `书档 ${fw.slotId}`),
        title: v.title || ((_a = fw.storyState.setup) == null ? void 0 : _a.title) || "",
        chapter: v.chapter || 0,
        wordCount: v.wordCount || 0,
        started: fw.storyState.isStoryStarted,
        updatedAt: Date.now()
      };
      const i = rows.findIndex((r) => r.id === fw.slotId);
      if (i >= 0) rows[i] = { ...rows[i], ...meta };
      else rows.push(meta);
      if (!rows.some((r) => r.id === "main")) rows.unshift({ id: "main", name: "主档", updatedAt: Date.now() });
      try {
        localStorage.setItem(this.regKey(g), JSON.stringify(rows));
      } catch (e) {
        console.warn("[SaveSlots] 书架元数据写入失败（存储空间不足）:", e);
      }
    },
    /** 新建槽位（不切换），返回槽位 ID */
    create(name) {
      const id = "s" + Date.now().toString(36);
      const arr = this.list();
      arr.push({ id, name: name || `书档 ${arr.length}`, createdAt: Date.now(), updatedAt: Date.now() });
      this._write(arr);
      return id;
    },
    rename(slotId, name) {
      const arr = this.list();
      const r = arr.find((x) => x.id === slotId);
      if (r) {
        r.name = String(name || r.name).slice(0, 24);
        this._write(arr);
      }
    },
    /** 删除槽位（当前激活槽禁删——先切走再删；主档可删=清档） */
    remove(slotId) {
      var _a, _b;
      if (slotId === this.activeId()) {
        (_a = window.showToast) == null ? void 0 : _a.call(window, "不能删除当前所在的档位，请先切换到别的档", "error");
        return;
      }
      const fw = window.storyFramework;
      const genre = (fw && fw.genre) || (window.SlotRegistry && window.SlotRegistry.genre()) || "free";
      /* v4.08.0 修复（删档不彻底）：原实现用手写的 8 个孤儿键 + 统一 `k + suffix` 拼接，
         但全项目实际有 20+ 处模块各自拼键名，格式至少 5 种：
           yunjingWorldRuntime~{slot}~{genre}   ← 槽位在中间
           yunjingCanonLedger:{slot}:{genre}    ← 冒号分隔
           yunjing.clock.{slot}~{genre}         ← 点号分隔
           yunjingBeasts~{slot}                 ← 主档也带 ~main
         统一拼接对这 4 类全部拼错 → 删档后数据残留，新建同名槽继承旧数据。
         现在改由 SlotRegistry 统一枚举 + 扫描兜底，主档额外清裸键。 */
      if (window.SlotRegistry && window.SlotRegistry.purge) {
        try { window.SlotRegistry.purge(slotId, { genre: genre }); } catch (e) { console.warn("[SaveSlots] 槽位清理异常:", e); }
      } else {
        /* 注册表不可用时的兜底（老缓存路径） */
        const suffix = slotId !== "main" ? `~${slotId}` : "";
        const key = `storySave_${genre}${suffix}`;
        try {
          localStorage.removeItem(key);
          localStorage.removeItem(key + ".bak");
          localStorage.removeItem(key + ".idb");
          localStorage.removeItem(`imm_${genre}${suffix}`);
          localStorage.removeItem(`tl_${genre}${suffix}`);
          ['yunjingBeasts', 'yunjingSquad', 'yunjingStoryStance', 'yunjingSideChar', 'yunjingPlayerIdentity', 'yunjingHeroRelation',
           `worldExt_${genre}`, `yunjingWorldBook:${genre}`].forEach((k) => {
            localStorage.removeItem(k + suffix);
            if (!suffix) localStorage.removeItem(k);
          });
        } catch (e) {}
      }
      this._write(this.list().filter((x) => x.id !== slotId));
      (_b = window.showToast) == null ? void 0 : _b.call(window, "已删除", "success");
      this.open();
    },
    /** 切换档位：存当前 → 冲刷各模块内存态 → 记激活槽 → 重载（最干净的上下文切换） */
    switchTo(slotId) {
      var _a;
      const fw = window.storyFramework;
      if (fw.storyState.isStoryStarted) fw.saveStory();
      /* v4.08.0 修复（切档丢进度）：此前只调 fw.saveStory()，
         而界扩展模块（worldExt_*）的内存态只在 act()/onVars() 时才落盘，
         玩家在面板上改完没点任何按钮就切档 → 那部分进度直接消失。
         这里显式冲刷所有已知持久化入口。 */
      try { if (fw.flushSave) fw.flushSave(); } catch (e) {}
      try { if (window.WorldExt && window.WorldExt.persist) window.WorldExt.persist(); } catch (e) {}
      try { if (window.WorldRuntime && window.WorldRuntime.persist) window.WorldRuntime.persist(); } catch (e) {}
      try { if (window.WorldBus && window.WorldBus.persist) window.WorldBus.persist(); } catch (e) {}
      try { if (window.WorldAlive && window.WorldAlive.persist) window.WorldAlive.persist(); } catch (e) {}
      try { if (window.BeastSystem && window.BeastSystem.save) window.BeastSystem.save(); } catch (e) {}
      try { if (window.SquadSystem && window.SquadSystem.save) window.SquadSystem.save(); } catch (e) {}
      localStorage.setItem(this.activeKey(), slotId);
      (_a = window.showToast) == null ? void 0 : _a.call(window, "正在切换书档…", "info");
      setTimeout(() => location.reload(), 350);
    },
    /** 导出槽位为 JSON（含注册表元信息 + 散落键 + IDB 正文，跨设备搬运） */
    async exportSlot(slotId) {
      var _a, _b;
      try { const fw = window.storyFramework; if (fw && fw.flushSave) fw.flushSave(); } catch (e) {}
      const fw = window.storyFramework;
      const suffix = slotId !== "main" ? `~${slotId}` : "";
      const key = `storySave_${fw.genre}${suffix}`;
      const raw = localStorage.getItem(key) || localStorage.getItem(key + ".bak");
      if (!raw) {
        (_a = window.showToast) == null ? void 0 : _a.call(window, "该档位没有存档可导出", "error");
        return;
      }
      let save;
      try {
        save = JSON.parse(raw);
      } catch (e) {
        (_b = window.showToast) == null ? void 0 : _b.call(window, "该档位存档数据已损坏，无法导出（可尝试在其他功能中恢复或放弃该档）", "error");
        return;
      }
      const meta = this.list().find((x) => x.id === slotId) || {};
      /* v3.51.0：app 字段改用 yunjing。旧档（app:"moshu"）在导入端仍被接受并就地升级。 */
      const pkg = { app: (window.YunjingID && window.YunjingID.APP) || "yunjing", ver: "3.51.0", genre: fw.genre, slotId, meta, save };
      /* v3.68.0 存档迁移修复：灵宠/小队随存档导出（跨设备不再丢失） */
      try {
        pkg.extras = {
          beasts: localStorage.getItem(`yunjingBeasts${suffix}`) || "",
          squad: localStorage.getItem(`yunjingSquad${suffix}`) || ""
        };
      } catch (e) { }
      /* v4.28.0：单档导出也补齐该槽位的全部散落键（世界书/账本/时钟/关系…），
         不再只导 beasts/squad——否则导出的档换设备后世界演化进度全丢。 */
      pkg.scoped = this.collectLS('slot', slotId);
      /* v4.28.0：正文中 idb:// 占位标记指向的实体（图片/长文本）一并导出。 */
      try {
        const markers = [];
        const re = /idb:\/\/([A-Za-z0-9_\-:.]+)/g;
        let m;
        const scan = (s) => { while ((m = re.exec(s || ''))) markers.push(m[1]); };
        scan(raw);
        Object.keys(pkg.scoped || {}).forEach(k => scan(pkg.scoped[k]));
        pkg.media = {};
        if (markers.length && window.StorageBoost) {
          for (const key of Array.from(new Set(markers))) {
            const v = await window.StorageBoost.get(key);
            if (v) pkg.media[key] = v;
          }
        }
      } catch (e) { pkg.media = {}; }
      /* v4.35.0：接口配置随单档导出（端点/模型免重填，密钥按勾选项决定） */
      try {
        const includeKey = !!(window.__yjExportIncludeKey);
        if (window.SaveCodec) pkg.config = window.SaveCodec.collectConfig(includeKey);
      } catch (e) {}
      await this._downloadSmart(pkg, `云境存档_${fw.genre}_${(meta.title || meta.name || slotId).slice(0, 12)}_${slotId}`);
    },
    /** 导入槽位 JSON/gzip（收进新槽位，绝不覆盖现有档） */
    importSlot(file) {
      (async () => {
        try {
          const text = await this._readSmart(file);
          const pkg = JSON.parse(text);
          /* v4.35.0：解压后正文可能较大，放宽到 80MB；gzip 包本身通常仅几 MB */
          if (text.length > 80 * 1024 * 1024) throw new Error("存档解压后过大（>80MB），疑似损坏文件");
          /* v4.36.0 T07：导入端自动识别差分包 → 还原选中分支后走同一落库流程 */
          if (window.SaveCodec && window.SaveCodec.isDeltaPack(pkg)) {
            return await this._importDelta(pkg);
          }
          this._importPkg(pkg);
        } catch (e) {
          window.showToast && window.showToast(`导入失败：${e.message}`, "error");
        }
      })();
    },

    /** 把一份存档 pkg 落进新槽位（importSlot / 差分包共用，绝覆盖现有档） */
    async _importPkg(pkg) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
      {
          const okApp = window.YunjingID && window.YunjingID.acceptApp ? window.YunjingID.acceptApp(pkg.app) : (pkg.app === "yunjing" || pkg.app === "moshu");
          if (!okApp || !pkg.save) throw new Error("不是云境存档文件");
          const fw = window.storyFramework;
          if (pkg.genre && pkg.genre !== fw.genre) throw new Error(`该存档属于「${pkg.genre}」工坊，请去对应工坊导入`);
          const id = this.create((((_a = pkg.meta) == null ? void 0 : _a.name) || "导入档").slice(0, 24));
          const suffix = `~${id}`;
          localStorage.setItem(`storySave_${fw.genre}${suffix}`, JSON.stringify(pkg.save));
          /* v3.68.0 存档迁移修复：灵宠/小队随档恢复到新槽位 */
          try {
            if (pkg.extras) {
              if (pkg.extras.beasts) localStorage.setItem(`yunjingBeasts${suffix}`, String(pkg.extras.beasts));
              if (pkg.extras.squad) localStorage.setItem(`yunjingSquad${suffix}`, String(pkg.extras.squad));
            }
          } catch (e) { }
          /* v4.28.0：恢复该槽位的全部散落键。导入档的键是源槽位名，
             经 remapScopedKey 精确重映射到新槽位，覆盖全部键格式，杜绝污染主档。 */
          try {
            if (pkg.scoped) {
              const srcSid = pkg.slotId || 'main';
              const g = pkg.genre || fw.genre;
              /* 注册表键（storySlots_* / storyActiveSlot_*）不属于槽位数据，
                 绝不能恢复——否则会把当前整个书架注册表覆盖成源档的。 */
              const regKeys = [this.regKey(g), this.activeKey(g)];
              /* 故事本体键 storySave_* 已由上面用 pkg.save 单独写入，
                 scoped 里的副本跳过，避免被未解析的原文重复覆盖。 */
              const bodyPrefix = 'storySave_' + g;
              Object.keys(pkg.scoped).forEach(k => {
                if (regKeys.indexOf(k) >= 0) return;
                if (k.indexOf(bodyPrefix) === 0) return;
                const nk = this.remapScopedKey(k, srcSid, id, g);
                localStorage.setItem(nk, String(pkg.scoped[k]));
              });
            }
          } catch (e) { }
          /* v4.28.0：恢复 idb:// 占位指向的正文/图片实体。 */
          try {
            if (pkg.media && window.StorageBoost) {
              for (const key of Object.keys(pkg.media)) {
                await window.StorageBoost.put(key, pkg.media[key]);
              }
            }
          } catch (e) { }
          const arr = this.list();
          const r = arr.find((x) => x.id === id);
          if (r) {
            r.title = ((_b = pkg.meta) == null ? void 0 : _b.title) || ((_d = (_c = pkg.save) == null ? void 0 : _c.variables) == null ? void 0 : _d.title) || "";
            r.chapter = ((_f = (_e = pkg.save) == null ? void 0 : _e.variables) == null ? void 0 : _f.chapter) || 0;
            r.wordCount = ((_h = (_g = pkg.save) == null ? void 0 : _g.variables) == null ? void 0 : _h.wordCount) || 0;
            r.started = !!((_i = pkg.save) == null ? void 0 : _i.isStoryStarted);
            this._write(arr);
          }
          /* v4.35.0：恢复接口配置（端点/模型免重填，密钥按导出时的勾选） */
          let cfgMsg = '';
          try {
            if (pkg.config && window.SaveCodec) {
              const cr = window.SaveCodec.restoreConfig(pkg.config);
              if (cr.applied.length) cfgMsg = ' · 已恢复接口配置';
              if (cr.keyNeeded) cfgMsg += ' · 密钥需补填（导出时未含）';
            }
          } catch (e) {}
          (_j = window.showToast) == null ? void 0 : _j.call(window, `✅ 已收入书架（新档位）${cfgMsg}`, "success");
          this.open();
      }
    },

    /** v4.36.0 T07：差分包导入——列出分支供选择，还原后走 _importPkg
     *  浏览器 confirm 逐支确认，选「取消」跳过；至少导入一支。 */
    async _importDelta(pack) {
      var branches = [];
      for (var i = 0; i < pack.branches.length; i++) {
        var title = (pack.branches[i].meta && (pack.branches[i].meta.title || pack.branches[i].meta.name))
          || pack.branches[i].id || ('分支' + (i + 1));
        branches.push({ i: i, title: String(title) });
      }
      var picked = 0;
      for (var j = 0; j < branches.length; j++) {
        var b = branches[j];
        var yes = window.confirm ? window.confirm('差分包含多分支，是否导入这一支？\n\n【' + b.title + '】\n\n点「确定」导入，「取消」跳过。') : true;
        if (!yes) continue;
        var restored = window.SaveCodec.unpackBranch(pack, b.i);
        await this._importPkg(restored.obj);
        picked++;
      }
      if (!picked) window.showToast && window.showToast('未选择任何分支导入', 'info');
    },

    /** v4.36.0 T07：把当前世界全部槽位导出为差分包（共享基线，体积远小于逐档全量） */
    async exportDeltaPack() {
      try {
        var fw = window.storyFramework;
        if (fw && fw.flushSave) fw.flushSave();
        var rows = this.list();
        if (!rows.length) { this._toast('书架为空，没有可打包的存档', 'error'); return; }
        var branches = [];
        for (var i = 0; i < rows.length; i++) {
          var sid = rows[i].id;
          var suffix = sid !== 'main' ? '~' + sid : '';
          var raw = localStorage.getItem('storySave_' + fw.genre + suffix)
            || localStorage.getItem('storySave_' + fw.genre + suffix + '.bak');
          if (!raw) continue;
          var save;
          try { save = JSON.parse(raw); } catch (e) { continue; }
          var pkg = {
            app: (window.YunjingID && window.YunjingID.APP) || 'yunjing', ver: '4.36.0',
            genre: fw.genre, slotId: sid, meta: rows[i], save: save,
            scoped: this.collectLS('slot', sid)
          };
          try { pkg.config = window.SaveCodec.collectConfig(!!window.__yjExportIncludeKey); } catch (e) {}
          branches.push({ id: sid, meta: { title: rows[i].title || rows[i].name || sid }, obj: pkg });
        }
        if (!branches.length) { this._toast('没有可导出的存档正文', 'error'); return; }
        var pack = window.SaveCodec.makeBranchPack(branches);
        var stamp = Date.now();
        await this._downloadSmart(pack, '云境差分包_' + fw.genre + '_' + branches.length + '支_' + stamp);
        var ratio = (JSON.stringify(pack).length / JSON.stringify(branches).length * 100).toFixed(0);
        this._toast('✅ 已导出差分包（' + branches.length + ' 支，体积约为逐档全量的 ' + ratio + '%）', 'success');
      } catch (e) {
        this._toast('差分包导出失败：' + e.message, 'error');
      }
    },

    /* ==================== v4.28.0 存档防丢（P0：全量备份 / 恢复 / 容量体检） ====================
       云境数据分两层：
         ① localStorage —— 配置、状态、槽位注册表、API Key（storyApiConfig）
         ② IndexedDB    —— 长正文 / 图片实体（localStorage 里只留 idb:// 占位标记）
       只导 localStorage 会导致换设备后「图片和长正文全丢」——这是旧版 exportSlot 的
       致命缺口。本组方法两层一起导，配合「导入前自动快照」防误覆盖，才是真正可用的备份。 */

    /** v4.28.0 修复：把导出档的散落键从「源槽位」重映射到「新槽位」。
        覆盖 A(裸/~后缀) / B(~main) / C(~sid~genre) / D(:sid:) / E(.sid~) 全部键格式；
        主档裸键会正确补上新槽后缀，绝不覆盖当前主档。 */
    remapScopedKey(key, srcSid, dstSid, genre) {
      /* 首选：SlotRegistry 精确键表（keysOf 顺序固定，索引一一映射，最可靠） */
      try {
        if (window.SlotRegistry && window.SlotRegistry.keysOf) {
          const sk = window.SlotRegistry.keysOf(srcSid, genre) || [];
          const dk = window.SlotRegistry.keysOf(dstSid, genre) || [];
          const i = sk.indexOf(key);
          if (i >= 0 && dk[i]) return dk[i];
        }
      } catch (e) {}
      /* 兜底：令牌替换（覆盖 keysOf 未列、被 scanKeysOf 扫到的历史键） */
      const s = srcSid || 'main';
      const d = dstSid || 'main';
      if (key.indexOf('~' + s) >= 0) return key.split('~' + s).join('~' + d);
      if (key.indexOf(':' + s + ':') >= 0) return key.split(':' + s + ':').join(':' + d + ':');
      if (key.indexOf('.' + s + '~') >= 0) return key.split('.' + s + '~').join('.' + d + '~');
      /* 纯裸键（主档 A 类，如 storySave_free）→ 追加目标槽后缀 */
      return key + '~' + d;
    },

    /** 收集 localStorage。scope='all' 全量；'slot' 只收指定槽位相关键（含跨分隔符格式） */
    collectLS(scope, slotId) {
      const out = {};
      try {
        if (scope === 'all') {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k != null) out[k] = localStorage.getItem(k);
          }
        } else {
          const fw = window.storyFramework || {};
          const g = fw.genre || this.genre();
          const sid = slotId || this.activeId();
          const keys = new Set();
          if (window.SlotRegistry) {
            try { (window.SlotRegistry.keysOf(sid, g) || []).forEach(k => keys.add(k)); } catch (e) {}
            try { if (window.SlotRegistry.scanKeysOf) (window.SlotRegistry.scanKeysOf(sid, g) || []).forEach(k => keys.add(k)); } catch (e) {}
          }
          keys.add(this.regKey(g));
          keys.add(this.activeKey(g));
          keys.forEach(k => { const v = localStorage.getItem(k); if (v != null) out[k] = v; });
        }
      } catch (e) {}
      return out;
    },

    /** 原生读取一个 IndexedDB 库的全部 objectStore 内容 → {storeName:{key:value}} */
    _dumpDB(name) {
      return new Promise((resolve) => {
        const out = {};
        let req;
        try { req = indexedDB.open(name); } catch (e) { return resolve(out); }
        req.onupgradeneeded = function () { /* 库不存在时保持空，不新建 store */ };
        req.onerror = () => resolve(out);
        req.onblocked = () => resolve(out);
        req.onsuccess = () => {
          let db;
          try { db = req.result; } catch (e) { return resolve(out); }
          const stores = Array.prototype.slice.call(db.objectStoreNames || []);
          let pending = stores.length;
          if (!pending) { try { db.close(); } catch (e) {} return resolve(out); }
          const done = () => { if (--pending === 0) { try { db.close(); } catch (e) {} resolve(out); } };
          stores.forEach(sn => {
            try {
              const tx = db.transaction(sn, 'readonly');
              const os = tx.objectStore(sn);
              const rk = os.getAllKeys();
              const rv = os.getAll();
              let keys = [], vals = [];
              rk.onsuccess = () => { keys = rk.result || []; };
              rv.onsuccess = () => { vals = rv.result || []; };
              tx.oncomplete = () => {
                const m = {};
                keys.forEach((k, i) => { m[String(k)] = vals[i]; });
                if (Object.keys(m).length) out[sn] = m;
                done();
              };
              tx.onerror = done;
              tx.onabort = done;
            } catch (e) { done(); }
          });
        };
      });
    },

    /** 收集全部 IndexedDB 仓（正文 / 图片实体）。跳过本模块自建的备份库，防递归膨胀 */
    async collectIDB() {
      const out = {};
      const names = new Set();
      try {
        if (indexedDB.databases) {
          (await indexedDB.databases()).forEach(d => { if (d.name) names.add(d.name); });
        }
      } catch (e) {}
      try {
        const dn = (n) => (window.YunjingID && window.YunjingID.dbName) ? window.YunjingID.dbName(n) : n;
        ['moshu', 'yunjing', 'moshu_mirror', 'yunjing_mirror', 'moshu_safe', 'yunjing_safe'].forEach(n => names.add(dn(n)));
      } catch (e) {}
      for (const n of names) {
        if (!n || String(n).indexOf('yunjing_backup') >= 0) continue;
        try {
          const d = await this._dumpDB(n);
          if (Object.keys(d).length) out[n] = d;
        } catch (e) {}
      }
      return out;
    },

    _download(obj, filename) {
      const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} a.remove(); }, 1000);
    },

    _toast(msg, type) { try { if (window.showToast) window.showToast(msg, type || 'info'); } catch (e) {} },

    /** v4.35.0：导出是否包含 API 密钥（全局开关，导出时读取） */
    setIncludeKey(on) {
      window.__yjExportIncludeKey = !!on;
      try { localStorage.setItem('yunjingExportIncludeKey', on ? '1' : '0'); } catch (e) {}
    },
    _initIncludeKey() {
      try { window.__yjExportIncludeKey = localStorage.getItem('yunjingExportIncludeKey') === '1'; } catch (e) { window.__yjExportIncludeKey = false; }
    },

    /* ==================== v4.35.0 智能存档编解码（gzip 压缩 + 配置随档） ==================== */
    /** 压缩写出：优先 gzip（约 1/5~1/10 体积），不支持则回退明文 JSON。返回 {bytes,ext,compressed} */
    async _downloadSmart(obj, baseName) {
      const json = JSON.stringify(obj);
      let payload, ext, compressed = false;
      try {
        if (window.SaveCodec && window.SaveCodec.hasGzip()) {
          const gz = await window.SaveCodec.gzip(json);
          if (gz && gz.length < json.length) { payload = gz; ext = '.json.gz'; compressed = true; }
        }
      } catch (e) {}
      if (!payload) { payload = new TextEncoder().encode(json); ext = '.json'; }
      const blob = new Blob([payload], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = baseName + ext;
      document.body.appendChild(a); a.click();
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} a.remove(); }, 1200);
      try {
        const ratio = compressed ? ((payload.length / json.length) * 100).toFixed(0) + '%' : '未压缩';
        this._toast(`✅ 已导出${compressed ? '压缩存档' : '存档'}（${(payload.length / 1024).toFixed(0)} KB，体积 ${ratio}）`, 'success');
      } catch (e) {}
      return { bytes: payload.length, ext, compressed };
    },
    /** 读入并自动解压（gzip 魔数识别），兼容旧明文 .json。返回字符串 */
    async _readSmart(file) {
      const buf = await file.arrayBuffer();
      if (window.SaveCodec) return await window.SaveCodec.gunzip(buf);
      return new TextDecoder().decode(new Uint8Array(buf));
    },

    /** 全量备份：所有槽位 + 全部 localStorage + 全部 IndexedDB，一键跨设备搬家 */
    async exportAll() {
      try { const fw = window.storyFramework; if (fw && fw.flushSave) fw.flushSave(); } catch (e) {}
      try { const fw = window.storyFramework; if (fw && fw.storyState && fw.storyState.isStoryStarted && fw.saveStory) fw.saveStory(); } catch (e) {}
      this._toast('正在打包全部存档…', 'info');
      try {
        const pkg = {
          app: (window.YunjingID && window.YunjingID.APP) || 'yunjing',
          type: 'full',
          ver: window.YJ_VER || '4.28.0',
          createdAt: Date.now(),
          genre: this.genre(),
          ls: this.collectLS('all'),
          idb: await this.collectIDB()
        };
        const d = new Date();
        const stamp = '' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '_' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
        const res = await this._downloadSmart(pkg, '云境全量备份_' + stamp);
        const sz = res.bytes;
        this._toast('已导出全量备份（' + (sz / 1024 / 1024).toFixed(2) + 'MB' + (res.compressed ? '，已压缩' : '') + '）。文件含 API Key，请妥善保管！', 'success');
      } catch (e) {
        this._toast('导出失败：' + e.message, 'error');
      }
    },

    /** 导入前自动快照到独立库，供 undoLastImport 回滚 */
    async _snapshotBeforeImport() {
      try {
        if (!window.localforage) return null;
        const snap = { at: Date.now(), ls: this.collectLS('all'), idb: await this.collectIDB() };
        const inst = window.localforage.createInstance({ name: 'yunjing_backup', storeName: 'auto' });
        await inst.setItem('last_before_import', snap);
        return snap;
      } catch (e) { return null; }
    },

    /** 把一份快照写回两层存储 */
    async _applySnapshot(snap) {
      for (const k of Object.keys(snap.ls || {})) {
        try { localStorage.setItem(k, snap.ls[k]); } catch (e) {}
      }
      for (const db of Object.keys(snap.idb || {})) {
        if (db === 'yunjing_backup') continue;
        const stores = snap.idb[db] || {};
        for (const sn of Object.keys(stores)) {
          try {
            const inst = window.localforage.createInstance({ name: db, storeName: sn });
            const entries = stores[sn] || {};
            for (const k of Object.keys(entries)) {
              try { await inst.setItem(k, entries[k]); } catch (e) {}
            }
          } catch (e) {}
        }
      }
    },

    /** 撤销上一次全量导入，回到导入前状态 */
    async undoLastImport() {
      try {
        if (!window.localforage) throw new Error('存储不可用');
        const inst = window.localforage.createInstance({ name: 'yunjing_backup', storeName: 'auto' });
        const snap = await inst.getItem('last_before_import');
        if (!snap) throw new Error('没有可撤销的导入');
        await this._applySnapshot(snap);
        this._toast('已恢复到导入前的状态，即将刷新', 'success');
        setTimeout(() => location.reload(), 700);
      } catch (e) {
        this._toast('撤销失败：' + e.message, 'error');
      }
    },

    /** 全量恢复：强确认 → 自动快照 → 覆盖写回 → 刷新 */
    async importAll(file) {
      try {
        if (!file) return;
        const txt = await this._readSmart(file);
        if (txt.length > 500 * 1024 * 1024) throw new Error('备份解压后超过 500MB，疑似损坏');
        const pkg = JSON.parse(txt);
        const okApp = window.YunjingID && window.YunjingID.acceptApp
          ? window.YunjingID.acceptApp(pkg.app)
          : (pkg.app === 'yunjing' || pkg.app === 'moshu');
        if (!okApp || pkg.type !== 'full' || !pkg.ls) throw new Error('不是云境全量备份文件');
        const msg = '确定用这份备份覆盖当前全部数据吗？\n\n'
          + '· 备份时间：' + new Date(pkg.createdAt || Date.now()).toLocaleString('zh-CN') + '\n'
          + '· 含 ' + Object.keys(pkg.ls).length + ' 项本地数据、' + Object.keys(pkg.idb || {}).length + ' 个存储仓\n\n'
          + '当前数据会先自动存一份快照，导入后可用「撤销上次导入」找回。覆盖后页面将刷新。';
        let ok;
        if (window.UIDialog && window.UIDialog.confirm) {
          ok = await window.UIDialog.confirm({ title: '全量恢复', message: msg, danger: true, confirmText: '确认恢复' });
        } else {
          ok = confirm(msg);
        }
        if (!ok) return;
        this._toast('正在保存当前快照…', 'info');
        await this._snapshotBeforeImport();
        this._toast('正在恢复数据…', 'info');
        await this._applySnapshot(pkg);
        this._toast('恢复完成，即将刷新', 'success');
        setTimeout(() => location.reload(), 800);
      } catch (e) {
        this._toast('恢复失败：' + e.message, 'error');
      }
    },

    /** 容量体检（供书架页脚展示） */
    capacity() {
      if (window.StorageBoost && window.StorageBoost.capacity) return window.StorageBoost.capacity();
      return Promise.resolve({ ok: false });
    },

    async refreshCapacity() {
      const el = document.getElementById('ssCap');
      if (!el) return;
      try {
        const c = await this.capacity();
        el.textContent = c.ok ? ('存储占用 ' + (c.used / 1024 / 1024).toFixed(1) + 'MB / ' + (c.quota / 1024 / 1024 / 1024).toFixed(1) + 'GB') : '';
      } catch (e) { el.textContent = ''; }
    },
    /* ==================== 书架 UI ==================== */
    esc(s) {
      return String(s != null ? s : "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    },
    open() {
      var _a, _b, _c;
      const g = this.genre();
      const gname = ((_b = (_a = window.storyFramework) == null ? void 0 : _a.config) == null ? void 0 : _b.genreName) || g;
      const act = this.activeId();
      const rows = this.list().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      const cards = rows.map((r) => {
        const isActive = r.id === act;
        const has = this.hasSave(r.id);
        const when = r.updatedAt ? new Date(r.updatedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
        return `<div class="ss-card ${isActive ? "on" : ""} ${has ? "" : "empty"}">
                    <div class="ss-card-top">
                        <b class="ss-name">${this.esc(r.name)}</b>
                        ${isActive ? '<i class="ss-cur">当前</i>' : ""}
                    </div>
                    <div class="ss-title">${this.esc(r.title || (has ? "未命名书稿" : "空档 · 可开新书"))}</div>
                    <div class="ss-meta">${has ? `第 ${r.chapter || 0} 章 · ${(r.wordCount || 0).toLocaleString()} 字 · ${when}` : "尚无存档"}</div>
                    <div class="ss-acts">
                        <button class="ss-btn main" onclick="SaveSlots.switchTo('${r.id}')">${isActive ? "↻ 重载" : "📖 进入"}</button>
                        <button class="ss-btn" onclick="SaveSlots.renamePrompt('${r.id}')">✏ 改名</button>
                        <button class="ss-btn" onclick="SaveSlots.exportSlot('${r.id}')" ${has ? "" : "disabled"}>⬇ 导出</button>
                        ${r.id !== "main" ? `<button class="ss-btn danger" onclick="SaveSlots.removeConfirm('${r.id}')">🗑</button>` : ""}
                    </div>
                </div>`;
      }).join("");
      const html = `
            <div class="ss-overlay" onclick="if(event.target===this)SaveSlots.close()">
                <div class="ss-modal">
                    <div class="ss-head">
                        <b>📚 ${this.esc(gname)} · 书架</b>
                        <span class="ss-sub">一界多书 · 每格独立存档</span>
                        <button class="ss-x" onclick="SaveSlots.close()">✕</button>
                    </div>
                    <div class="ss-body">${cards}</div>
                    <div class="ss-foot">
                        <button class="ss-btn main" onclick="SaveSlots.newBook()">✚ 开新书（新档位）</button>
                        <label class="ss-btn" style="cursor:pointer;" title="导入单本书档或差分包（收进新档位，不覆盖现有档）">📥 导入单档<input type="file" accept=".json,.gz" style="display:none;" onchange="SaveSlots.importSlot(this.files[0]);this.value='';"></label>
                        <button class="ss-btn" onclick="SaveSlots.exportAll()" title="导出全部书档 + 配置 + 图片正文到单个文件，跨设备搬家">🗂 全量备份</button>
                        <label class="ss-btn" style="cursor:pointer;" title="从全量备份恢复（会覆盖当前全部数据，导入前自动存快照）">📦 全量恢复<input type="file" accept=".json,.gz" style="display:none;" onchange="SaveSlots.importAll(this.files[0]);this.value='';"></label>
                    </div>
                    <div class="ss-foot2">
                        <button class="ss-btn" onclick="SaveSlots.exportDeltaPack()" title="v4.36.0：把全部档位打包成差分包——共享基线，体积远小于逐档全量，适合多分支长期备份">🧬 导出差分包</button>
                        <span class="ss-cap" style="font-size:11px;color:#8fa6b5;line-height:1.5;align-self:center;">差分包含全部档位，导入时用「导入单档」即可逐支还原（差分包自动识别）</span>
                    </div>
                    <div class="ss-foot2">
                        <span id="ssCap" class="ss-cap"></span>
                        <label class="ss-cap" style="cursor:pointer;display:inline-flex;align-items:center;gap:5px;white-space:nowrap;" title="勾选后，导出的存档包会明文写入 API 密钥；不勾选则只带端点与模型，导入后需补填密钥">
                            <input type="checkbox" id="ssIncludeKey" onchange="SaveSlots.setIncludeKey(this.checked)"> 导出含密钥
                        </label>
                        <button class="ss-btn" onclick="SaveSlots.undoLastImport()" title="撤销上一次全量恢复，回到导入前状态">↩ 撤销上次恢复</button>
                    </div>
                    <div class="ss-hint">⚠ 存档包已启用 gzip 压缩（体积约 1/5）。默认只带端点与模型、不含密钥；如需换设备免重填，勾选「导出含密钥」后请只存私密位置、勿外传。</div>
                </div>
            </div>`;
      (_c = document.getElementById("slotModal")) == null ? void 0 : _c.remove();
      const wrap = document.createElement("div");
      wrap.id = "slotModal";
      wrap.innerHTML = html;
      document.body.appendChild(wrap);
      try { this._initIncludeKey(); const cb = wrap.querySelector('#ssIncludeKey'); if (cb) cb.checked = !!window.__yjExportIncludeKey; } catch (e) {}
      try { this.refreshCapacity(); } catch (e) {}
    },
    /* v3.27.4 安卓适配：原生 prompt/confirm → 应用内 UIDialog（触屏体验统一，
     *  原生弹窗在部分 WebView 内嵌环境会被静默拦截；UIDialog 缺失时回退原生） */
    async newBook() {
      var _a;
      let name;
      if ((_a = window.UIDialog) == null ? void 0 : _a.prompt) {
        name = await window.UIDialog.prompt({ title: "新书档", message: "新书档名（如：第二卷）", defaultValue: `书档 ${this.list().length + 1}`, placeholder: "输入新书档名" });
      } else {
        name = prompt("新书档名（如：第二卷）", `书档 ${this.list().length + 1}`);
      }
      if (name === null) return;
      const id = this.create(name.trim() || void 0);
      this.switchTo(id);
    },
    async renamePrompt(slotId) {
      var _a;
      const r = this.list().find((x) => x.id === slotId);
      let name;
      if ((_a = window.UIDialog) == null ? void 0 : _a.prompt) {
        name = await window.UIDialog.prompt({ title: "档位改名", message: "为这个书档取个新名字", defaultValue: (r == null ? void 0 : r.name) || "", placeholder: "输入新档名" });
      } else {
        name = prompt("档位改名", (r == null ? void 0 : r.name) || "");
      }
      if (name === null) return;
      this.rename(slotId, name.trim());
      this.open();
    },
    async removeConfirm(slotId) {
      var _a;
      const r = this.list().find((x) => x.id === slotId);
      const msg = `确定删除档位「${(r == null ? void 0 : r.name) || slotId}」？该档存档将一并删除，不可恢复。`;
      if ((_a = window.UIDialog) == null ? void 0 : _a.confirm) {
        const ok = await window.UIDialog.confirm({ title: "删除档位", message: msg, danger: true, confirmText: "删除" });
        if (ok) this.remove(slotId);
      } else {
        if (confirm(msg)) this.remove(slotId);
      }
    },
    close() {
      var _a;
      (_a = document.getElementById("slotModal")) == null ? void 0 : _a.remove();
    }
  };
  if (!document.getElementById("slotStyle")) {
    const st = document.createElement("style");
    st.id = "slotStyle";
    st.textContent = `
.ss-overlay{position:fixed;inset:0;background:rgba(0,0,0,.62);backdrop-filter:blur(3px);z-index:9989;display:flex;align-items:center;justify-content:center;padding:18px}
.ss-modal{width:min(760px,94vw);max-height:86vh;display:flex;flex-direction:column;background:linear-gradient(160deg,#211d17,#17140f);border:1px solid #c9a86a45;border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.6);overflow:hidden}
.ss-head{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid #c9a86a25}
.ss-head b{color:#e8dcc0;font-size:15px;letter-spacing:1px}
.ss-sub{font-size:11px;color:#9a8c6e;margin-right:auto}
.ss-x{background:none;border:none;color:#9a8c6e;font-size:16px;cursor:pointer;padding:4px 8px}
.ss-x:hover{color:#e8dcc0}
.ss-body{padding:16px 18px;overflow-y:auto;flex:1;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;align-content:start}
.ss-card{background:rgba(255,255,255,.035);border:1px solid #c9a86a2a;border-radius:12px;padding:13px 14px;display:flex;flex-direction:column;gap:6px;transition:border-color .2s}
.ss-card:hover{border-color:#c9a86a66}
.ss-card.on{border-color:#c9a86a;background:rgba(201,168,106,.07)}
.ss-card.empty{opacity:.75}
.ss-card-top{display:flex;align-items:center;gap:8px}
.ss-name{color:#e8dcc0;font-size:13.5px}
.ss-cur{font-style:normal;font-size:10px;color:#c9a86a;border:1px solid #c9a86a88;border-radius:8px;padding:1px 8px}
.ss-title{font-size:12px;color:#d8cba8;line-height:1.5;min-height:18px}
.ss-meta{font-size:11px;color:#9a8c6e;margin-bottom:4px}
.ss-acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:auto}
.ss-btn{background:#c9a86a14;border:1px solid #c9a86a44;color:#c9a86a;border-radius:8px;padding:5px 11px;font-size:11.5px;cursor:pointer;letter-spacing:.5px}
.ss-btn:hover{background:#c9a86a26}
.ss-btn.main{background:#c9a86a2a;border-color:#c9a86a88}
.ss-btn.danger{border-color:#e0707055;background:#e0707014;color:#e8a0a0}
.ss-btn:disabled{opacity:.35;cursor:not-allowed}
.ss-foot{display:flex;gap:10px;padding:13px 18px;border-top:1px solid #c9a86a25;flex-wrap:wrap}
.ss-foot2{display:flex;gap:10px;padding:8px 18px 0;align-items:center;flex-wrap:wrap}
.ss-cap{font-size:11px;color:#9a8c6e;margin-right:auto}
.ss-hint{font-size:11px;line-height:1.6;color:#c9a86a99;padding:8px 18px 13px}`;
    document.head.appendChild(st);
  }
  window.SaveSlots = SaveSlots;
})();
