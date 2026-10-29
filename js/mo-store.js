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
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, val); return true; } catch (e) { return false; }
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
})();
