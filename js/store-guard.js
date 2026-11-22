/* 云境 · StoreGuard v1.0.0(#10 存储升级)
   localStorage 5MB 天花板的结构化数据防线:
   ① 镜像:所有大键(>40KB)+ 知识库/模块状态键,实时异步镜像进 IndexedDB
   ② 自愈:写入配额爆炸时自动瘦身重试;启动时发现键丢失自动从镜像恢复
   ③ 状态:window.StoreGuard.status() 随时体检 */
(function () {
  'use strict';
  if (!window.localforage) { console.warn('[StoreGuard] localforage 缺失,镜像未启用'); return; }
  /* v3.51.0：镜像库改名 moshu_mirror → yunjing_mirror；未迁完前继续读旧库名 */
  var MIRROR = localforage.createInstance({ name: (window.YunjingID && window.YunjingID.dbName) ? window.YunjingID.dbName('moshu_mirror') : 'moshu_mirror', storeName: 'kv_mirror' });
  var PRECIOUS = /^(storyKnowledge_|storyKBGlobal|storyKBEnabled_|worldExt_)/;
  var BIG = 40 * 1024;
  var timers = {};
  var recovering = false;

  function shouldMirror(k, v) { return PRECIOUS.test(k) || (v && v.length > BIG); }
  function schedule(k) {
    clearTimeout(timers[k]);
    timers[k] = setTimeout(function () {
      try {
        var v = localStorage.getItem(k);
        if (v == null) MIRROR.removeItem(k);
        else MIRROR.setItem(k, v);
      } catch (e) {}
    }, 400);
  }

  /* ---- 包裹 setItem/removeItem:镜像 + 配额自愈 ---- */
  var _setItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    try {
      _setItem.call(this, k, v);
    } catch (err) {
      var isQuota = err && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014);
      if (!isQuota) throw err;
      // 自愈:清掉所有镜像定时器持有的临时大值,驱逐最大的非宝贵键
      console.warn('[StoreGuard] 配额爆炸,开始自愈…');
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
      var victim = null, vs = -1;
      keys.forEach(function (key) {
        if (PRECIOUS.test(key)) return;
        var val = '';
        try { val = localStorage.getItem(key) || ''; } catch (e) {}
        if (val.length > vs) { vs = val.length; victim = key; }
      });
      if (victim) {
        MIRROR.setItem('evicted:' + victim, localStorage.getItem(victim)).catch(function () {});
        localStorage.removeItem(victim);
        console.warn('[StoreGuard] 已驱逐并镜像备份:' + victim);
      }
      _setItem.call(this, k, v); // 重试一次;仍失败则真爆
    }
    if (shouldMirror(String(k), String(v))) schedule(String(k));
  };
  var _removeItem = Storage.prototype.removeItem;
  Storage.prototype.removeItem = function (k) {
    _removeItem.call(this, k);
    if (PRECIOUS.test(String(k))) schedule(String(k));
  };

  /* ---- 启动恢复:宝贵键在 LS 里丢了 → 从镜像灌回 ---- */
  function rescue() {
    if (recovering) return;
    recovering = true;
    var fixed = [];
    MIRROR.iterate(function (v, k) {
      if (k.indexOf('evicted:') === 0) return;
      var cur = null;
      try { cur = localStorage.getItem(k); } catch (e) {}
      if (cur == null && v != null) {
        try { localStorage.setItem(k, v); fixed.push(k); } catch (e) {}
      }
    }).then(function () {
      recovering = false;
      if (fixed.length) {
        console.warn('[StoreGuard] 从镜像恢复丢失键:' + fixed.join(', '));
        try {
          var KM = window.StoryKnowledge || window.KnowledgeManager;
          if (KM && KM.load) { KM.load(); KM._loadGlobal && KM._loadGlobal(); }
        } catch (e) {}
      }
    }).catch(function () { recovering = false; });
  }

  window.StoreGuard = {
    /** 手动补一次镜像 */
    mirrorNow: function (k) { schedule(k); return true; },
    /** 体检:镜像条数 + 容量估算 */
    status: function () {
      var n = 0;
      return MIRROR.iterate(function () { n++; }).then(function () {
        var p = navigator.storage && navigator.storage.estimate ? navigator.storage.estimate() : Promise.resolve(null);
        return p.then(function (est) {
          return { mirrored: n, usage: est && est.usage, quota: est && est.quota };
        });
      });
    },
    rescue: rescue
  };
  rescue();
  console.log('[StoreGuard] 存储防线就绪(镜像+配额自愈)');
})();
