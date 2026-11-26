/* 云境 · 主笔模型档位（ModelSlots v1.0 · v6.6.1）
 * 需求：接入主笔大模型时只能存一种；要能提前存好多个模型、随时一键切换。
 * 说明：副 AI 的多连接由 connection-profiles.js 管（varAI/summary）；
 *       本模块只管「主笔模型」——它的生效配置就是 localStorage['storyApiConfig']（单份）。
 * 做法：另存一份档位数组，切换时把选中档整份写回 storyApiConfig，
 *       再调用 storyFramework.loadApiConfig() 让运行内存立即生效，无需刷新页面。
 * 纯前端、零后端、密钥照旧留在本机 localStorage，不上传。 */
(function () {
  "use strict";
  var K_SLOTS = "yunjing.modelSlots";       // [{id,name,ts,cfg:{...}}]
  var K_ACTIVE = "yunjing.modelSlotsActive"; // 当前激活档 id

  function read(k, d) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }
    catch (e) { return d; }
  }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function uid() { return "ms_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function currentCfg() {
    try {
      var raw = localStorage.getItem("storyApiConfig");
      var c = raw ? JSON.parse(raw) : {};
      if (!c || typeof c !== "object") c = {};
      // v7.3.0：上下文窗口存在独立键里，档位切换要能带走它，故存档时折叠进 cfg
      var ctx = Number(localStorage.getItem("storyContextWindow") || 0);
      if (ctx > 0 && !c.contextWindow) c.contextWindow = ctx;
      return c;
    } catch (e) { return {}; }
  }

  var ModelSlots = {
    KEYS: { slots: K_SLOTS, active: K_ACTIVE },
    list: function () {
      var a = read(K_SLOTS, []);
      return Array.isArray(a) ? a : [];
    },
    activeId: function () {
      try { return localStorage.getItem(K_ACTIVE) || ""; } catch (e) { return ""; }
    },
    /** 把当前生效的 storyApiConfig 存成一个档位；同名则覆盖。返回保存后的档。 */
    saveCurrent: function (name) {
      var cfg = currentCfg();
      if (!cfg.endpoint && !cfg.apiKey && !cfg.model) return null; // 空配置不存
      var nm = String(name || "").trim();
      if (!nm) nm = (cfg.model || cfg.endpoint || "未命名模型").split("/").pop().slice(0, 24);
      var arr = this.list();
      var ts = Date.now();
      var hit = null;
      for (var i = 0; i < arr.length; i++) if (arr[i].name === nm) { hit = arr[i]; break; }
      if (hit) {
        hit.cfg = cfg; hit.ts = ts;
      } else {
        hit = { id: uid(), name: nm, ts: ts, cfg: cfg };
        arr.push(hit);
      }
      write(K_SLOTS, arr);
      try { localStorage.setItem(K_ACTIVE, hit.id); } catch (e) {}
      return hit;
    },
    /** 覆盖某档为当前配置（用于"存到当前档"）。 */
    updateCurrent: function (id) {
      var cfg = currentCfg();
      var arr = this.list();
      for (var i = 0; i < arr.length; i++) if (arr[i].id === id) {
        arr[i].cfg = cfg; arr[i].ts = Date.now();
        write(K_SLOTS, arr);
        return arr[i];
      }
      return null;
    },
    /** v7.3.0 即时切换：把档整份写回 storyApiConfig，并同步上下文窗口、运行内存与预算器。
     *  用户诉求「自由切换其中一个 API 或模型」——切换后所有派生状态必须一起变，否则出现
     *  "下拉变了但正文还在用旧模型"的假切换。 */
    activate: function (id) {
      var arr = this.list();
      var hit = null;
      for (var i = 0; i < arr.length; i++) if (arr[i].id === id) { hit = arr[i]; break; }
      if (!hit || !hit.cfg) return false;
      var cfg = JSON.parse(JSON.stringify(hit.cfg));
      try {
        localStorage.setItem("storyApiConfig", JSON.stringify(cfg));
        localStorage.setItem(K_ACTIVE, id);
        // 上下文窗口随档走：档里有就写独立键，没有则清掉让预算器按模型名推断
        var ctx = Number(cfg.contextWindow || cfg.ctxWindow || 0);
        if (ctx > 0) localStorage.setItem("storyContextWindow", String(ctx));
        else localStorage.removeItem("storyContextWindow");
      } catch (e) { return false; }
      var fw = window.storyFramework;
      if (fw) {
        try { fw.apiConfig = cfg; } catch (e) {}
        if (typeof fw.loadApiConfig === "function") { try { fw.loadApiConfig(); } catch (e) {} }
      }
      // 让 prompt-budget 重新计算上下文预算（清掉上一次的超限降级，避免旧档的降级影响新档）
      try {
        if (window.PromptBudget) {
          localStorage.removeItem("storyPromptOverflow");
          if (PromptBudget.resetOverflow) PromptBudget.resetOverflow();
        }
      } catch (e) {}
      return true;
    },
    remove: function (id) {
      write(K_SLOTS, this.list().filter(function (s) { return s.id !== id; }));
      try { if (this.activeId() === id) localStorage.removeItem(K_ACTIVE); } catch (e) {}
    },
    /** 档位摘要（给下拉展示）：一眼看清「模型名 @ 端点域名」，两个不同端点/模型不混淆。
     *  v7.3.0：用户反馈"输入两个端点API，存档里两个API模型在一起、无法自由切换"——
     *  旧 label 在默认名=模型名时会把端点吞掉或重复拼，难分辨。现在固定「序号·模型 @ 域名」。 */
    label: function (s) {
      var c = (s && s.cfg) || {};
      var nm = String((s && s.name) || "未命名").trim();
      var model = String(c.model || "").trim();
      var host = String(c.endpoint || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "").split("?")[0] || "";
      var main = model || nm;
      // 名字若已含模型名就用名字，否则固定显示「模型名」；端点始终附在 @ 后便于区分同模型不同端点
      var head = (nm && nm.toLowerCase().indexOf(main.toLowerCase()) >= 0) ? nm
               : (model ? (nm + " · " + model) : nm);
      return host ? (head + " @ " + host) : head;
    },
    /** v7.3.0：给某档改名（用户要能自由识别/管理每个独立 API+模型 档） */
    rename: function (id, name) {
      var nm = String(name || "").trim();
      if (!nm) return false;
      var arr = this.list();
      for (var i = 0; i < arr.length; i++) if (arr[i].id === id) {
        arr[i].name = nm; arr[i].ts = Date.now();
        write(K_SLOTS, arr);
        return true;
      }
      return false;
    },
    /** v7.3.0：档位明细（供设置页表格展示端点/模型/密钥是否已填） */
    detail: function (s) {
      var c = (s && s.cfg) || {};
      return {
        name: String((s && s.name) || ""),
        model: String(c.model || ""),
        endpoint: String(c.endpoint || ""),
        hasKey: !!String(c.apiKey || "").trim(),
        id: String((s && s.id) || "")
      };
    }
  };

  window.ModelSlots = ModelSlots;
})();
