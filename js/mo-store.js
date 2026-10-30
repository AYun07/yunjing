/**
 * mo-store.js —— 云境工坊·优化版 安全存储门面（v3.47.5-opt）
 * ---------------------------------------------------------------------------
 * 问题：原代码 40+ 文件直写 localStorage，大存档(图片/长文)超过 5MB 会同步抛出
 *       QuotaExceededError，且多数直写点无 try/catch，可致命崩溃。
 *       StorageBoost(IndexedDB) 逃生舱虽存在，却只有 4 个文件在用，形同虚设。
 *
 * 方案：window.MoStore 提供与 localStorage 完全一致的同步 API（getItem/setItem/
 *       removeItem/key/clear/length），但——
 *   ① 所有读写包 try/catch，绝不在调用方抛错；
 *   ② setItem 遇配额超限，自动把该键值暂存进 IndexedDB + 内存镜像，读取时回退命中，
 *      保证“永不丢失、永不崩溃”；空间恢复后下次成功写入会自动写回 localStorage。
 *
 * 接入方式：把目标文件里的 `localStorage.` 替换为 `MoStore.` 即可（签名一致）。
 */
(function () {
  'use strict';

  /* v3.51.0：库名去旧品牌。迁移未完成时仍用旧库名读取，绝不读空（见 js/id-migrate.js）。 */
  var DB_NAME = (window.YunjingID && window.YunjingID.dbName) ? window.YunjingID.dbName('moshu_safe') : 'moshu_safe';
  var STORE = 'kv';
  var _db = null;
  var _mem = {};        // IndexedDB 暂存值的内存镜像（供同步读回退）
  var _opening = null;
  /* v3.55.17：保存原始存储原语。全局兜底劫持 Storage.prototype 后，本模块内部
     必须走原生函数，否则会被自己的劫持层"假成功"吞掉（写进 _mem 又被 delete）。 */
  var _lsSet = null, _lsGet = null;
  try {
    _lsSet = window.Storage.prototype.setItem;
    _lsGet = window.Storage.prototype.getItem;
  } catch (e) { _lsSet = null; _lsGet = null; }

  function openDB(cb) {
    if (_db) { cb && cb(_db); return; }
    if (_opening) { _opening.then(function (d) { cb && cb(d); }); return; }
    if (!window.indexedDB) { cb && cb(null); return; }
    _opening = new Promise(function (resolve) {
      try {
        var req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = function () {
          if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
        };
        req.onsuccess = function () { _db = req.result; resolve(_db); };
        req.onerror = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
    _opening.then(function (d) { cb && cb(d); });
  }

  function idbPut(key, val) {
    openDB(function (db) {
      if (!db) return;
      try {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(val, key);
      } catch (e) { /* 静默 */ }
    });
  }
  function idbDel(key) {
    openDB(function (db) {
      if (!db) return;
      try {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(key);
      } catch (e) { /* 静默 */ }
    });
  }

  function lsGet(key) {
    try { return _lsGet ? _lsGet.call(window.localStorage, key) : localStorage.getItem(key); } catch (e) { return null; }
  }
  function lsSet(key, val) {
    try { (_lsSet ? _lsSet.call(window.localStorage, key, val) : localStorage.setItem(key, val)); return true; } catch (e) { return false; }
  }

  var MoStore = {
    getItem: function (key) {
      var s = lsGet(key);
      if (s !== null) return s;
      if (Object.prototype.hasOwnProperty.call(_mem, key)) return _mem[key];
      return null;
    },
    setItem: function (key, val) {
      if (lsSet(key, val)) {
        delete _mem[key]; // 写回成功，清掉可能的 IDB 暂存
        return true;
      }
      // 配额超限：暂存到 IndexedDB + 内存镜像，绝不抛错
      try { _mem[key] = String(val); } catch (e) { _mem[key] = val; }
      idbPut(key, _mem[key]);
      if (window.console && console.warn) {
        console.warn('[MoStore] 配额超限，已暂存至 IndexedDB：' + key);
      }
      return false;
    },
    removeItem: function (key) {
      try { localStorage.removeItem(key); } catch (e) {}
      delete _mem[key];
      idbDel(key);
    },
    key: function (i) {
      try { return localStorage.key(i); } catch (e) { return null; }
    },
    clear: function () {
      try { localStorage.clear(); } catch (e) {}
      _mem = {};
    },
    get length() {
      try { return localStorage.length; } catch (e) { return 0; }
    }
  };

  window.MoStore = MoStore;

  /* ==================== v3.55.17 全局存储兜底 ====================
     现状：全项目仍有 48 个文件直写 localStorage.setItem（存档 / 书架 / 立绘 /
     知识库缓存…）。配额一满（安卓 WebView 5MB、iOS 隐私模式、大存档）就抛
     QuotaExceededError：轻则本轮写档失败、刷新后章节蒸发，重则整轮流程崩掉。
     与其逐个改造 48 个调用方（易漏、易回归），不如在存储原语上兜一层：
     写失败即自动转存 IndexedDB + 内存镜像，读时回退命中，对上层完全透明。
     只接管 localStorage（不碰 sessionStorage），只接管配额错误（其它错误照抛）。 */
  if (_lsSet && _lsGet) {
    try {
      window.Storage.prototype.setItem = function (k, v) {
        try {
          var ok = _lsSet.call(this, k, v);
          var isLocal = false;
          try { isLocal = this === window.localStorage; } catch (e0) { isLocal = false; }
          if (isLocal && Object.prototype.hasOwnProperty.call(_mem, k)) {
            delete _mem[k];
            idbDel(k);
          }
          return ok;
        } catch (err) {
          var quota = err && (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED" || err.code === 22 || err.code === 1014);
          var isL = false;
          try { isL = this === window.localStorage; } catch (e1) { isL = false; }
          if (!quota || !isL) throw err;
          var s;
          try { s = String(v); } catch (e2) { s = v; }
          _mem[k] = s;
          idbPut(k, s);
          if (window.console && console.warn) {
            console.warn("[存储兜底] 配额超限，已转存 IndexedDB：" + k + "（约 " + Math.round(String(s).length / 1024) + "KB）");
          }
          return undefined;
        }
      };
      window.Storage.prototype.getItem = function (k) {
        var v = _lsGet.call(this, k);
        if (v !== null) return v;
        var isL = false;
        try { isL = this === window.localStorage; } catch (e1) { isL = false; }
        if (isL && Object.prototype.hasOwnProperty.call(_mem, k)) return _mem[k];
        return v;
      };
      var _lsRemove = window.Storage.prototype.removeItem;
      if (_lsRemove) {
        window.Storage.prototype.removeItem = function (k) {
          _lsRemove.call(this, k);
          var isL = false;
          try { isL = this === window.localStorage; } catch (e1) { isL = false; }
          if (isL && Object.prototype.hasOwnProperty.call(_mem, k)) {
            delete _mem[k];
            idbDel(k);
          }
        };
      }
    } catch (e) { /* 极端环境（原型只读）静默跳过，退回原行为 */ }
  }
  window.__yjStoreGuard = true;

  /* ---- v3.55.17 IDB 预热 ----
     兜底/降级值只存在 IndexedDB 里，而 MoStore 是同步 API、_mem 是内存镜像：
     一旦刷新页面，_mem 清空 → 明明 IDB 里有，却读不到（存档"凭空消失"）。
     本模块在 <head> 就该加载（studio.html 第 26 行，远早于 defer 的业务脚本），
     因此在这里立刻异步回灌，业务脚本执行时通常已经就位；回灌完成再广播事件，
     让已在等待的模块补读一次。 */
  (function warm() {
    openDB(function (db) {
      if (!db) return;
      try {
        var tx = db.transaction(STORE, "readonly");
        var req = tx.objectStore(STORE).openCursor();
        req.onsuccess = function () {
          var cur = req.result;
          if (!cur) {
            try { window.dispatchEvent(new CustomEvent("yj-store-ready", { detail: { keys: Object.keys(_mem).length } })); } catch (e) {}
            return;
          }
          if (!Object.prototype.hasOwnProperty.call(_mem, cur.key)) _mem[cur.key] = cur.value;
          cur.continue();
        };
      } catch (e) { /* 静默 */ }
    });
  })();
})();
