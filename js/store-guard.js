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
  /* v7.6.5：旧界键不回灌。实测换 38 界后每个界的 storyKnowledge_<genre>/worldExt_<genre>
     都被 PRECIOUS 镜像，rescue 又把它们逐个灌回 localStorage，累积打满 5MB 配额。
     恢复只针对「当前界」的键 + 全局键；其它界的历史键不再回灌（其内容下次进界可重新生成）。 */
  function currentGenre() {
    try {
      if (window.StoryKnowledge && window.StoryKnowledge.genre) return window.StoryKnowledge.genre;
      if (window.WorldExt && window.WorldExt.genre) return window.WorldExt.genre;
      return new URLSearchParams(location.search).get('genre') || '';
    } catch (e) { return ''; }
  }
  function isStaleGenreKey(k) {
    var m = /^(storyKnowledge_|worldExt_|storyKBEnabled_)(.+)$/.exec(String(k));
    if (!m) return false;
    /* v7.6.6：启动早期 currentGenre() 可能取不到（StoryKnowledge/WorldExt 未就绪、URL 无
       genre 参数），此时若一律判 stale 会把「当前界」键漏掉不恢复 → 触发「从镜像恢复
       丢失键」偶现。 genre 为空时保守放行（不当旧界），待 rescue 延迟到就绪后再精确判定。 */
    var cur = currentGenre();
    if (!cur) return false;
    var keyGenre = m[2].split('~')[0];
    return keyGenre !== cur;
  }
  function rescue() {
    if (recovering) return;
    recovering = true;
    var fixed = [];
    MIRROR.iterate(function (v, k) {
      if (k.indexOf('evicted:') === 0) return;
      if (isStaleGenreKey(k)) return; // v7.6.5：旧界残留键不回灌，避免配额累积
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
  /* v7.6.6：原在模块加载瞬间就 rescue()，此时 genre 尚未就绪，判定不准。
     延后到 DOM 就绪 + 一个短延时，让 StoryKnowledge/WorldExt 挂载完，恢复更准。 */
  function runRescue() { setTimeout(function () { rescue(); }, 400); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runRescue, { once: true });
  } else {
    runRescue();
  }
  console.debug('[StoreGuard] 存储防线就绪(镜像+配额自愈)');
})();
