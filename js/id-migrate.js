/* ============================================================
 * 云境 · 机读标识迁移层 id-migrate.js（v3.51.0）
 * ------------------------------------------------------------
 * 背景：v3.50.0 之前，机读标识里带旧品牌名 "moshu"（localStorage 键、
 *       IndexedDB 库名、存档 app 字段、CSS 类名…）。本文件负责把它们
 *       统一改成 "yunjing"，且**不让任何旧数据丢失**：
 *
 *   1) localStorage：启动瞬间同步搬家（旧键 → 新键，值原样复制后删旧键）
 *   2) IndexedDB：库名 moshu* → yunjing*。搬迁是异步的，为保证"首启不读空"，
 *      dbName() 在搬迁完成前返回旧库名，完成后（下次启动）返回新库名。
 *   3) 存档 app 字段：save-slots 写入 "yunjing"，读取同时接受 "moshu"（旧档照读）
 *   4) CSS 类：新代码只写 yunjing-*，样式表同时匹配 moshu-*（旧 DOM 不破相）
 *
 * 设计原则：只搬不改义；任何一步失败都保留旧数据，绝不 delete 兜底。
 * ============================================================ */
(function () {
  'use strict';

  var V = 'v3.51.0';
  var MARK_LS = 'yunjingIdMigrated';       // localStorage 迁移标记
  var MARK_DB = 'yunjingIdMigratedDB';     // IndexedDB 迁移进度（JSON 数组）

  /* ---------------- 1. localStorage 键 ---------------- */
  var EXACT = {
    'moshuLobbyWsGroups': 'yunjingLobbyWsGroups',
    'moshuFileBannerOff': 'yunjingFileBannerOff'
  };
  var PREFIX = {
    'moshuEmojiRecent_': 'yunjingEmojiRecent_'
  };

  var movedKeys = [];
  function migrateLocal() {
    var moved = [];
    try {
      if (localStorage.getItem(MARK_LS) === V) return moved;
      Object.keys(EXACT).forEach(function (k) {
        var v;
        try { v = localStorage.getItem(k); } catch (e) { return; }
        if (v == null) return;
        try {
          if (localStorage.getItem(EXACT[k]) == null) localStorage.setItem(EXACT[k], v);
          localStorage.removeItem(k);
          moved.push(k);
        } catch (e) { }
      });
      var all = [];
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k) all.push(k);
        }
      } catch (e) { }
      all.forEach(function (k) {
        Object.keys(PREFIX).forEach(function (p) {
          if (k.indexOf(p) !== 0) return;
          var nk = PREFIX[p] + k.slice(p.length);
          try {
            var v = localStorage.getItem(k);
            if (v != null && localStorage.getItem(nk) == null) localStorage.setItem(nk, v);
            localStorage.removeItem(k);
            moved.push(k);
          } catch (e) { }
        });
      });
      try { localStorage.setItem(MARK_LS, V); } catch (e) { }
    } catch (e) { }
    return moved;
  }

  /* ---------------- 2. IndexedDB 库名 ---------------- */
  var DBS = {
    'moshu': 'yunjing',
    'moshu_safe': 'yunjing_safe',
    'moshu_mirror': 'yunjing_mirror'
  };

  function dbDone() {
    try { return JSON.parse(localStorage.getItem(MARK_DB) || '[]'); } catch (e) { return []; }
  }
  function dbMark(oldName) {
    var d = dbDone();
    if (d.indexOf(oldName) < 0) d.push(oldName);
    try { localStorage.setItem(MARK_DB, JSON.stringify(d)); } catch (e) { }
  }
  /**
   * 该用哪个库名：已迁完 → 新名；没迁完（含首次启动）→ 旧名。
   * 这样保证在异步搬迁完成之前，模块读到的仍是原来的数据，不会读空。
   */
  function dbName(oldName) {
    var n = DBS[oldName];
    if (!n) return oldName;
    return dbDone().indexOf(oldName) >= 0 ? n : oldName;
  }

  /** 把旧库整库复制到新库（out-of-line key 的 object store），成功后删旧库 */
  function copyDB(oldName, newName, cb) {
    var done = function (ok) { try { cb && cb(ok); } catch (e) { } };
    if (!window.indexedDB) return done(false);
    var req;
    try { req = indexedDB.open(oldName); } catch (e) { return done(false); }
    req.onerror = function () { done(false); };
    req.onupgradeneeded = function () {
      /* 旧库不存在 → 会被创建成空库，直接放弃并删掉这个空壳 */
      try { req.transaction.abort(); } catch (e) { }
    };
    req.onsuccess = function () {
      var db = req.result;
      var stores = Array.prototype.slice.call(db.objectStoreNames || []);
      if (!stores.length) { try { db.close(); } catch (e) { } return done(false); }
      var r2;
      try { r2 = indexedDB.open(newName); } catch (e) { try { db.close(); } catch (e2) { } return done(false); }
      r2.onupgradeneeded = function (ev) {
        var ndb = ev.target.result;
        stores.forEach(function (s) {
          if (!ndb.objectStoreNames.contains(s)) {
            try { ndb.createObjectStore(s); } catch (e) { }
          }
        });
      };
      r2.onerror = function () { try { db.close(); } catch (e) { } done(false); };
      r2.onsuccess = function () {
        var ndb = r2.result;
        var pending = stores.length;
        var finish = function () {
          try { db.close(); } catch (e) { }
          try { ndb.close(); } catch (e) { }
          done(true);
        };
        if (!pending) return finish();
        stores.forEach(function (s) {
          var tick = function () { pending -= 1; if (pending === 0) finish(); };
          var tx;
          try { tx = db.transaction(s, 'readonly'); } catch (e) { return tick(); }
          var cur;
          try { cur = tx.objectStore(s).openCursor(); } catch (e) { return tick(); }
          cur.onerror = tick;
          cur.onsuccess = function (e) {
            var c = e.target.result;
            if (!c) return tick();
            try {
              var w = ndb.transaction(s, 'readwrite');
              w.objectStore(s).put(c.value, c.key);
            } catch (err) { }
            try { c.continue(); } catch (err) { tick(); }
          };
        });
      };
    };
  }

  /** 后台搬迁所有已知旧库（首启不阻塞，成功一个记一个）
   *  v3.55.24 修复（升级会话丢写 bug）：
   *  旧逻辑「复制完 → 立即标记完成 → deleteDatabase」存在数据丢失窗口：
   *  标记写入后本会话的 localforage 仍握着旧库连接并继续写入（deleteDatabase
   *  因连接占用被阻塞挂起，本会话后续写入全部落在旧库），刷新后 dbName()
   *  切读的新库只是「复制发起时刻」的快照——实测全量对话 transcript 从 104 楼
   *  退回迁移时刻的 1 楼快照，玩家升级后第一次刷新即丢档尾。
   *  新逻辑：复制完 → 标记 → **保留旧库不删** → 派发事件，由 storage-boost
   *  把旧库（含本会话最新写入）补写进新库后自行切换，任何时刻无丢失。 */
  function migrateDBs() {
    Object.keys(DBS).forEach(function (oldName) {
      if (dbDone().indexOf(oldName) >= 0) return;
      copyDB(oldName, DBS[oldName], function (ok) {
        if (!ok) return;
        dbMark(oldName);
        /* 不再 deleteDatabase：本会话连接仍握着旧库，删了会丢/挂起；
           旧库留作数据兜底，消费方切换完毕后自然不再读写它 */
        try {
          window.dispatchEvent(new CustomEvent('yunjing-db-migrated', { detail: { from: oldName, to: DBS[oldName] } }));
        } catch (e) { }
      });
    });
  }

  /* ---------------- 3. 启动 ---------------- */
  movedKeys = migrateLocal();

  window.YunjingID = {
    version: V,
    dbName: dbName,
    migratedKeys: function () { return movedKeys.slice(); },
    /** 存档 app 字段：写入用新名，读取两代都认 */
    APP: 'yunjing',
    LEGACY_APP: 'moshu',
    acceptApp: function (v) { return v === 'yunjing' || v === 'moshu'; },
    migrateDBs: migrateDBs
  };

  /* IndexedDB 搬迁放到空闲时做，绝不与首屏抢资源 */
  if (document.readyState === 'complete') setTimeout(migrateDBs, 1200);
  else window.addEventListener('load', function () { setTimeout(migrateDBs, 1200); });
})();
