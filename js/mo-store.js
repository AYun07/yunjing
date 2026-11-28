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
  var _quotaWarned = {};// v7.6.5：按 key 记录已告警过的配额超限，避免同一键每写必刷（38 界实测刷 79 次）
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
      /* v7.6.6：这条 warn 此前完全无去重，配额满时每写必刷（38 界实测刷 68 次）。
         纳入与 localStorage 通道相同的按 key 去重表。 */
      var _nowM = Date.now();
      if (!_quotaWarned[key] || _nowM - _quotaWarned[key] > 60000) {
        _quotaWarned[key] = _nowM;
        if (window.console && console.warn) {
          console.warn('[MoStore] 配额超限，已暂存至 IndexedDB：' + key + '（60 秒内不再重复告警）');
        }
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
    /* v7.6.6：清理「非当前界」的世界书/世界扩展缓存键，根治换界累积打满 localStorage。
       知识库预置条目下次进界会自动补回，只丢其它界的自建条目（与系统体检的
       cleanupKBCache 同口径）。返回清理条数。 */
    pruneStaleWorldKeys: function () {
      var cur = '';
      try {
        var q = new URLSearchParams(location.search).get('genre');
        var fw = window.storyFramework;
        cur = q || (fw && (fw.genre || (fw.config && fw.config.genreKey))) || '';
      } catch (e) {}
      var prefixRe = /^(storyKnowledge_|worldExt_|storyKBEnabled_)(.+)$/;
      var n = 0;
      try {
        var keys = [];
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (!k) continue;
          var m = prefixRe.exec(k);
          if (!m) continue;
          var g = m[2].split('~')[0];
          if (g && g !== cur) keys.push(k);
        }
        keys.forEach(function (k) {
          try { localStorage.removeItem(k); n++; } catch (e) {}
          delete _mem[k];
          idbDel(k);
        });
      } catch (e) {}
      return n;
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
          /* v7.6.6：不再因单次成功写回就清标记——配额满时 localStorage 写入会在
             「成功/失败」间抖动，清标记 = 每写必告警（38 界刷 68 次主因之一）。
             改由 time-quota 窗口自动控制（见下方告警处 60 秒节流），这里只保留兜底回退。 */
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
          // v7.6.6：同一 key 60 秒内只告警一次（时间窗口节流），兼顾「不刷屏」与
          // 「真正的新一轮超限仍可提示」。转存/内存兜底照常执行，不影响功能。
          var _now = Date.now();
          if (!_quotaWarned[k] || _now - _quotaWarned[k] > 60000) {
            _quotaWarned[k] = _now;
            if (window.console && console.warn) {
              console.warn("[存储兜底] 配额超限，已转存 IndexedDB：" + k + "（约 " + Math.round(String(s).length / 1024) + "KB，60 秒内不再重复告警）");
            }
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
            /* v7.6.6：换界重载创作态时，若 localStorage 世界书缓存已接近配额（>3MB），
               自动清理其它界残留键，避免每写必兜底、告警刷屏。仅在 studio 创作页触发，
               且不碰当前界数据。清理在回灌完成、当前界已由 URL/config 确定之后进行。 */
            try {
              if (/studio\.html/.test(location.pathname) && MoStore.pruneStaleWorldKeys) {
                var _used = 0;
                for (var _i = 0; _i < localStorage.length; _i++) {
                  var _k = localStorage.key(_i);
                  if (_k) _used += (localStorage.getItem(_k) || "").length * 2;
                }
                if (_used > 3 * 1024 * 1024) {
                  var _n = MoStore.pruneStaleWorldKeys();
                  if (_n > 0 && window.console && console.info) {
                    console.info("[MoStore] 已自动清理 " + _n + " 个其它界的世界书缓存，释放配额");
                  }
                }
              }
            } catch (e) { /* 清理失败不影响正常启动 */ }
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
