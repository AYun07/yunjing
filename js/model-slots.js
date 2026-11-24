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
      return (c && typeof c === "object") ? c : {};
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
    /** 即时切换：把档写回 storyApiConfig，刷新运行内存。 */
    activate: function (id) {
      var arr = this.list();
      var hit = null;
      for (var i = 0; i < arr.length; i++) if (arr[i].id === id) { hit = arr[i]; break; }
      if (!hit || !hit.cfg) return false;
      try {
        localStorage.setItem("storyApiConfig", JSON.stringify(hit.cfg));
        localStorage.setItem(K_ACTIVE, id);
      } catch (e) { return false; }
      var fw = window.storyFramework;
      if (fw && typeof fw.loadApiConfig === "function") {
        try { fw.loadApiConfig(); } catch (e) {}
      }
      return true;
    },
    remove: function (id) {
      write(K_SLOTS, this.list().filter(function (s) { return s.id !== id; }));
      try { if (this.activeId() === id) localStorage.removeItem(K_ACTIVE); } catch (e) {}
    },
    /** 档位摘要（给下拉展示） */
    label: function (s) {
      var c = s.cfg || {};
      var bits = [c.model || "?", (c.endpoint || "").replace(/^https?:\/\//, "").split("/")[0] || ""].filter(Boolean);
      return (s.name || "未命名") + " · " + bits.join(" @ ");
    }
  };

  window.ModelSlots = ModelSlots;
})();
