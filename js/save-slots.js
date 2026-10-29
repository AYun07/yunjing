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
      const suffix = slotId !== "main" ? `~${slotId}` : "";
      const key = `storySave_${fw.genre}${suffix}`;
      localStorage.removeItem(key);
      localStorage.removeItem(key + ".bak");
      try {
        localStorage.removeItem(key + ".idb");
        if (window.StorageBoost && StorageBoost.ready()) StorageBoost.remove("主档/" + key);
      } catch (e) {
      }
      try {
        localStorage.removeItem(`imm_${fw.genre}${suffix}`);
        localStorage.removeItem(`tl_${fw.genre}${suffix}`);
      } catch (e) {
      }
      this._write(this.list().filter((x) => x.id !== slotId));
      (_b = window.showToast) == null ? void 0 : _b.call(window, "已删除", "success");
      this.open();
    },
    /** 切换档位：存当前 → 记激活槽 → 重载（最干净的上下文切换） */
    switchTo(slotId) {
      var _a;
      const fw = window.storyFramework;
      if (fw.storyState.isStoryStarted) fw.saveStory();
      localStorage.setItem(this.activeKey(), slotId);
      (_a = window.showToast) == null ? void 0 : _a.call(window, "正在切换书档…", "info");
      setTimeout(() => location.reload(), 350);
    },
    /** 导出槽位为 JSON（含注册表元信息，跨设备搬运） */
    exportSlot(slotId) {
      var _a, _b;
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
      const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `云境存档_${fw.genre}_${(meta.title || meta.name || slotId).slice(0, 12)}_${slotId}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    },
    /** 导入槽位 JSON（收进新槽位，绝不覆盖现有档） */
    importSlot(file) {
      const reader = new FileReader();
      reader.onload = () => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
        try {
          const pkg = JSON.parse(reader.result);
          const okApp = window.YunjingID && window.YunjingID.acceptApp ? window.YunjingID.acceptApp(pkg.app) : (pkg.app === "yunjing" || pkg.app === "moshu");
          if (!okApp || !pkg.save) throw new Error("不是云境存档文件");
          const fw = window.storyFramework;
          if (pkg.genre && pkg.genre !== fw.genre) throw new Error(`该存档属于「${pkg.genre}」工坊，请去对应工坊导入`);
          const id = this.create((((_a = pkg.meta) == null ? void 0 : _a.name) || "导入档").slice(0, 24));
          const suffix = `~${id}`;
          localStorage.setItem(`storySave_${fw.genre}${suffix}`, JSON.stringify(pkg.save));
          const arr = this.list();
          const r = arr.find((x) => x.id === id);
          if (r) {
            r.title = ((_b = pkg.meta) == null ? void 0 : _b.title) || ((_d = (_c = pkg.save) == null ? void 0 : _c.variables) == null ? void 0 : _d.title) || "";
            r.chapter = ((_f = (_e = pkg.save) == null ? void 0 : _e.variables) == null ? void 0 : _f.chapter) || 0;
            r.wordCount = ((_h = (_g = pkg.save) == null ? void 0 : _g.variables) == null ? void 0 : _h.wordCount) || 0;
            r.started = !!((_i = pkg.save) == null ? void 0 : _i.isStoryStarted);
            this._write(arr);
          }
          (_j = window.showToast) == null ? void 0 : _j.call(window, `✅ 已收入书架（新档位）`, "success");
          this.open();
        } catch (e) {
          (_k = window.showToast) == null ? void 0 : _k.call(window, `导入失败：${e.message}`, "error");
        }
      };
      reader.readAsText(file);
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
                        <label class="ss-btn" style="cursor:pointer;">📥 导入存档<input type="file" accept=".json" style="display:none;" onchange="SaveSlots.importSlot(this.files[0]);this.value='';"></label>
                    </div>
                </div>
            </div>`;
      (_c = document.getElementById("slotModal")) == null ? void 0 : _c.remove();
      const wrap = document.createElement("div");
      wrap.id = "slotModal";
      wrap.innerHTML = html;
      document.body.appendChild(wrap);
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
.ss-foot{display:flex;gap:10px;padding:13px 18px;border-top:1px solid #c9a86a25}`;
    document.head.appendChild(st);
  }
  window.SaveSlots = SaveSlots;
})();
