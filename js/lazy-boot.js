/* 云境 v3.55.28 · 分层加载器（lazy-boot）
   目标：首屏只加载「能进世界、能对话、能渲染状态」的最小集合，其余脚本分帧/按需加载。
   用法（HTML 侧）：
     <script type="text/yj-lazy" data-src="js/atlas-panel.js?v=3.55.28"
             data-yj-group="demand" data-yj-globals="StoryAtlas"></script>
   - data-yj-group="batch"  ：首屏完成后按帧依次加载（保持原顺序，行为与 defer 一致）
   - data-yj-group="demand" ：只在真正被用到（或首次交互后空闲）时加载
   - data-yj-globals        ：该脚本会挂到 window 上的全局名，未加载时返回「桩」，调用即触发加载并自动重放
   设计约束：零侵入——脚本本身一行不改，加载顺序与原 defer 顺序一致。 */
(function () {
  if (window.YJLazy) return;

  /* v3.55.28：YJ_DEBUG 此前只被读取、从未定义，调试日志永远打不开。
     现支持 ?yjdebug=1（或 localStorage yjDebug=1）开启；?yjlazy=0 可整体关掉分层加载（排障一键回退）。 */
  var QS = (location && location.search) || '';
  function flagOn(name, lsKey) {
    if (new RegExp('[?&]' + name + '=1').test(QS)) return true;
    try { return localStorage.getItem(lsKey) === '1'; } catch (e) { return false; }
  }
  window.YJ_DEBUG = flagOn('yjdebug', 'yjDebug');
  window.YJDebug = {
    on: function () { window.YJ_DEBUG = true; try { localStorage.setItem('yjDebug', '1'); } catch (e) { } },
    off: function () { window.YJ_DEBUG = false; try { localStorage.setItem('yjDebug', '0'); } catch (e) { } }
  };
  var NO_LAZY = new RegExp('[?&]yjlazy=0').test(QS) ||
    (function () { try { return localStorage.getItem('yjLazy') === '0'; } catch (e) { return false; } })();

  var recs = [];          // 全部待延后脚本记录
  var byName = {};        // name -> rec
  var byGlobal = {};      // global -> rec
  var loading = 0;
  var doneCount = 0;
  var started = false;

  function srcOf(el) { return el.getAttribute('data-src') || el.getAttribute('src') || ''; }
  function nameOf(el, src) { return el.getAttribute('data-yj-name') || (src.split('?')[0].replace(/^.*\//, '').replace(/\.js$/, '')); }

  function collect() {
    var els = document.querySelectorAll('script[type="text/yj-lazy"]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var src = srcOf(el);
      if (!src) continue;
      var name = nameOf(el, src);
      var rec = {
        name: name, src: src, el: el,
        group: el.getAttribute('data-yj-group') || 'batch',
        globals: (el.getAttribute('data-yj-globals') || '').split(',').filter(Boolean),
        order: i, status: 'idle', promise: null
      };
      recs.push(rec);
      byName[rec.name] = rec;
      rec.globals.forEach(function (g) { byGlobal[g] = rec; });
    }
  }

  var interacted = false;

  function loadRec(rec) {
    if (rec.status === 'done') return Promise.resolve(true);
    if (rec.promise) return rec.promise;
    rec.status = 'loading';
    loading++;
    rec.promise = new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = rec.src;
      s.async = false;                 // 动态插入也保持插入顺序执行
      s.dataset.yjLazy = rec.name;
      s.onload = function () { finish(rec); resolve(true); };
      s.onerror = function () { finish(rec); resolve(false); };
      document.head.appendChild(s);
      if (rec.el) rec.el.setAttribute('data-yj-status', 'loading');
    });
    return rec.promise;
  }
  function finish(rec) {
    rec.status = 'done';
    loading--; doneCount++;
    if (rec.el) rec.el.setAttribute('data-yj-status', 'done');
    (rec.waiters || []).forEach(function (w) { w(true); });
    rec.waiters = [];
  }

  /* 后台型调用（如 onVars 通知）不立刻下载：排队等空闲，用户一旦交互则立即加载 */
  function scheduleLoad(rec) {
    if (rec.status !== 'idle') return loadRec(rec);
    if (!rec.queued) {
      rec.queued = true;
      schedule(function () { loadRec(rec); });
    }
    return new Promise(function (res) { (rec.waiters = rec.waiters || []).push(res); });
  }

  /* 桩：全局符号未加载时返回一个「调用即加载、加载完自动重放」的影子 */
  function shadow(rec, rootName) {
    /* 重要：同步只返回 undefined，绝不返回 Promise。
       真实场景踩过坑——引擎里有大量 `const x = IG.stripMarkers(body)` 这类同步取值，
       返回 Promise 会让下游 .replace() 直接崩。影子只负责「触发加载 + 加载后重放」，
       取值一律留给真实对象（未就绪时调用方按自己的降级分支处理）。 */
    var invoke = function (prop, args) {
      var real = window[rootName];
      if (!real) return undefined;
      if (!prop) { if (typeof real === 'function') return real.apply(null, args); return real; }
      if (typeof real[prop] !== 'function') return real[prop];
      return real[prop].apply(real, args);
    };
    var call = function (prop, args) {
      rec.wanted = true;
      /* 用户已经动过手（说明是要真的用）→ 立刻加载；否则只排队，不跟首屏抢带宽 */
      (interacted ? loadRec(rec) : scheduleLoad(rec)).then(function () {
        try { invoke(prop, args); } catch (e) { }
      });
      return undefined;
    };
    var f = function () { call(null, [].slice.call(arguments)); };
    return new Proxy(f, {
      get: function (t, p) {
        if (typeof p === 'symbol') return undefined;
        if (p === 'then' || p === 'catch' || p === 'finally') return undefined;   // 不被误认成 Promise
        if (p === '__yjLazyShadow') return true;
        if (p === 'toJSON') return function () { return null; };
        return function () { return call(p, [].slice.call(arguments)); };
      },
      apply: function (t, self, args) { return call(null, args); },
      set: function () { return true; }
    });
  }

  function installStubs() {
    recs.forEach(function (rec) {
      if (rec.group !== 'demand' || !rec.globals.length) return;
      rec.globals.forEach(function (g) {
        if (Object.getOwnPropertyDescriptor(window, g)) return;  // 已存在则不覆盖
        var real;
        Object.defineProperty(window, g, {
          configurable: true,
          get: function () { return (real !== undefined) ? real : shadow(rec, g); },
          set: function (v) { real = v; }
        });
      });
    });
  }

  /* 分帧顺序加载：一次一批，让首屏交互不被卡住 */
  function loadInFrames(list, perFrame) {
    perFrame = perFrame || 2;
    var i = 0;
    function step() {
      if (i >= list.length) return;
      var n = 0;
      while (i < list.length && n < perFrame) {
        var rec = list[i++]; n++;
        if (rec.status === 'idle') loadRec(rec);
      }
      schedule(step);
    }
    step();
  }
  function schedule(fn) {
    if (window.requestIdleCallback) window.requestIdleCallback(fn, { timeout: 1200 });
    else setTimeout(fn, 60);
  }

  var api = {
    ready: false,
    /** 立即加载某个（或某组）模块，返回 Promise */
    ensure: function (name) {
      var rec = byName[name] || byGlobal[name];
      if (!rec) return Promise.resolve(true);
      return loadRec(rec);
    },
    ensureAll: function (names) {
      return Promise.all((names || []).map(function (n) { return api.ensure(n); }));
    },
    /** 首屏后：batch 组分帧加载 */
    startBatch: function () {
      var list = recs.filter(function (r) { return r.group === 'batch' && r.status === 'idle'; })
        .sort(function (a, b) { return a.order - b.order; });
      loadInFrames(list, 2);
    },
    /** 首次交互后：demand 组空闲预取（用户没交互就完全不下载，省流量） */
    prefetchDemand: function () {
      var list = recs.filter(function (r) { return r.group === 'demand' && r.status === 'idle'; })
        .sort(function (a, b) { return a.order - b.order; });
      loadInFrames(list, 1);
    },
    has: function (g) {
      var rec = byGlobal[g];
      if (!rec) return true;
      return rec.status === 'done';
    },
    stats: function () {
      var g = { batch: 0, demand: 0 };
      recs.forEach(function (r) { g[r.group] = (g[r.group] || 0) + 1; });
      return { total: recs.length, done: doneCount, loading: loading, groups: g };
    },
    _recs: function () { return recs; }
  };
  window.YJLazy = api;

  function boot() {
    if (started) return;
    started = true;
    collect();
    installStubs();
    api.ready = true;
    /* 排障开关：?yjlazy=0 —— 全部脚本按原顺序立即加载，行为与改造前完全一致 */
    if (NO_LAZY) {
      recs.slice().sort(function (a, b) { return a.order - b.order; }).forEach(loadRec);
      return;
    }
    /* batch 严格排在 window.load 之后：首屏（load 前）只下载核心脚本 */
    if (document.readyState === 'complete') schedule(api.startBatch);
    else window.addEventListener('load', function () { setTimeout(function () { schedule(api.startBatch); }, 60); });

    /* 用户一动手（点/输入/滚动）就后台预取按需模块：不阻塞首屏，交互时几乎无感 */
    var once = false;
    function kick() {
      if (once) return; once = true;
      interacted = true;
      /* 先补用户已经点过的模块，再空闲预取其余按需模块 */
      var wanted = recs.filter(function (r) { return r.wanted && r.status === 'idle'; });
      wanted.forEach(loadRec);
      schedule(api.prefetchDemand);
    }
    ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(function (ev) {
      window.addEventListener(ev, kick, { once: true, passive: true });
    });
    setTimeout(kick, 8000);   // 纯浏览 8 秒后也兜底补上，功能不缺席
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
