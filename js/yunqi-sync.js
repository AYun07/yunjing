/* ============================================================
 * 云起预设 · 云端同步 v1.0（v3.55.10）
 * ------------------------------------------------------------
 * 从 GitHub 仓库固定路径 releases/yunqi-latest.json 拉最新版，
 * 直接覆盖本机的云起预设与配套正则 —— 以后预设更新点一下就好，
 * 不用再导出文件、再手工导入一遍。
 *
 * 设计要点：
 *  · 多源回退：jsDelivr → raw.githubusercontent → ghproxy → gh-proxy，
 *    国内外网络谁通走谁，全程不开额外端口、不引第三方库。
 *  · 先拉 470B 的版本文件比对，已是最新就不下载 250KB 全量（低配友好）。
 *  · 拉到先校验再落盘，网络异常 / 格式不对一律不动本机数据。
 *  · 仓库地址可改（存 localStorage），换 fork 或自建镜像都能指过去。
 * ============================================================ */
(function () {
  'use strict';

  /* 默认仓库：云境官方仓库（可在面板里改成自己的 fork / 镜像）
   * 仓库名只能英文（GitHub 不吃中文名），中文项目名「云境」记在 README。
   * https://github.com/AYun07/yunjing */
  var DEFAULT_REPO = { owner: 'AYun07', repo: 'yunjing', branch: 'main' };
  var K_REPO = 'yq_sync_repo', K_VER = 'yq_sync_ver', K_AT = 'yq_sync_at';
  var FILE_VER = 'releases/yunqi-version.json';
  var FILE_FULL = 'releases/yunqi-latest.json';

  function store() {
    return (window.MoStore && typeof window.MoStore.getItem === 'function') ? window.MoStore : window.localStorage;
  }
  function toast(t, type) {
    try { if (window.showToast) window.showToast(t, type || 'info'); } catch (e) { }
  }

  function repo() {
    try {
      var c = JSON.parse(store().getItem(K_REPO) || 'null');
      if (c && c.owner && c.repo) {
        return { owner: c.owner, repo: c.repo, branch: c.branch || 'main', base: c.base || '' };
      }
    } catch (e) { }
    return DEFAULT_REPO;
  }
  function setRepo(o) {
    store().setItem(K_REPO, JSON.stringify({
      owner: String(o.owner || '').trim(),
      repo: String(o.repo || '').trim(),
      branch: String(o.branch || 'main').trim() || 'main',
      base: String(o.base || '').trim()
    }));
  }
  function hasRepo() {
    try {
      var c = JSON.parse(store().getItem(K_REPO) || 'null');
      return !!(c && c.owner && c.repo);
    } catch (e) { return false; }
  }

  function baseRaw(file) {
    var r = repo();
    return 'https://raw.githubusercontent.com/' + r.owner + '/' +
      encodeURIComponent(r.repo) + '/' + (r.branch || 'main') + '/' + file;
  }
  /** 多源候选（按顺序回退）；填了自定义镜像 base 就只走镜像 */
  function sources(file) {
    var r = repo();
    if (r.base) return [r.base.replace(/\/+$/, '') + '/' + file];
    var raw = baseRaw(file);
    return [
      'https://cdn.jsdelivr.net/gh/' + r.owner + '/' + encodeURIComponent(r.repo) +
        '@' + (r.branch || 'main') + '/' + file,
      raw,
      'https://ghproxy.net/' + raw,
      'https://gh-proxy.com/' + raw
    ];
  }

  function getText(url, ms) {
    return new Promise(function (resolve, reject) {
      var ctl = (typeof AbortController === 'function') ? new AbortController() : null;
      var timer = setTimeout(function () {
        try { if (ctl) ctl.abort(); } catch (e) { }
        reject(new Error('超时'));
      }, ms || 12000);
      fetch(url, { cache: 'no-store', signal: ctl ? ctl.signal : undefined }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      }).then(function (t) {
        clearTimeout(timer); resolve(t);
      }).catch(function (e) {
        clearTimeout(timer); reject(e);
      });
    });
  }

  /** 依次尝试各源，拿到第一个可用的 JSON */
  function fetchJSON(file, ms) {
    var list = sources(file);
    var i = 0, lastErr = null;
    function next() {
      if (i >= list.length) return Promise.reject(lastErr || new Error('全部源都取不到'));
      var url = list[i++];
      return getText(url, ms).then(function (t) {
        return JSON.parse(t);
      }).catch(function (e) {
        lastErr = e;
        return next();
      });
    }
    return next();
  }

  function localVer() { try { return store().getItem(K_VER) || ''; } catch (e) { return ''; } }
  function localAt() { try { return Number(store().getItem(K_AT) || 0); } catch (e) { return 0; } }

  /** 远端版本信息（470B，开销极小） */
  function remoteMeta(ms) { return fetchJSON(FILE_VER, ms || 10000); }

  /** 是否有新版 */
  function check() {
    return remoteMeta().then(function (meta) {
      var cur = localVer();
      return { has: !cur || meta.version !== cur, meta: meta, current: cur };
    });
  }

  /** 拉全量并覆盖本机预设 + 正则（preset-io 会自动顺带装载配套正则） */
  function pull() {
    return fetchJSON(FILE_FULL, 30000).then(function (obj) {
      if (!obj || !Array.isArray(obj.prompts) || !obj.prompts.length) {
        throw new Error('云端文件格式不对（没有 prompts），本机数据未改动');
      }
      var IO = window.YunjingPresetIO;
      if (!IO || !IO.importText) throw new Error('预设模块未加载');
      var meta = obj.yunqi_meta || {};
      var info = IO.importText(JSON.stringify(obj), '云起预设 v' + (meta.version || '?') + '（云端同步）');

      /* 保底：预设包没带正则时，单独再装一次 */
      var rxCount = 0;
      try {
        var RX = window.YunjingRegexIO;
        var rx = (obj.regex_scripts && obj.regex_scripts.length) ? obj.regex_scripts
          : ((obj.extensions && obj.extensions.regex_scripts) || null);
        if (RX && RX.importText && rx && rx.length) {
          RX.importText(JSON.stringify({ regex_scripts: rx }), '云起正则（云端同步）');
          rxCount = rx.length;
        }
      } catch (e) { }

      var ver = meta.version || '';
      try {
        store().setItem(K_VER, ver);
        store().setItem(K_AT, String(Date.now()));
      } catch (e) { }
      return { version: ver, blocks: info && info.blocks, regex: rxCount || (info && info.regexes) || 0, meta: meta };
    });
  }

  /**
   * 一键同步：先比版本，已是最新就不下载全量。
   * force=true 时跳过比对直接覆盖（用于"我要重装一遍"）。
   */
  function sync(force) {
    /* 默认仓库已内置，无需玩家先填地址；只有地址被清成空时才提示 */
    if (!hasRepo() && !DEFAULT_REPO.owner) return Promise.resolve({ needRepo: true });
    function doPull() {
      return pull().then(function (r) { r.synced = true; return r; });
    }
    if (force) return doPull();
    return check().then(function (c) {
      if (!c.has) return { upToDate: true, version: c.meta.version, meta: c.meta };
      return doPull();
    }).catch(function () {
      /* 版本比对失败（比如 CDN 缓存了旧的版本文件）→ 仍然尝试全量拉取 */
      return doPull();
    });
  }

  function status() {
    var r = repo();
    return {
      repo: r.owner + '/' + r.repo + (r.branch && r.branch !== 'main' ? '@' + r.branch : ''),
      configured: hasRepo(),
      version: localVer(),
      at: localAt(),
      url: baseRaw(FILE_FULL)
    };
  }

  /* ---------- 面板用：带提示的完整流程 ---------- */
  function uiCheck() {
    if (!hasRepo() && DEFAULT_REPO.owner === 'YQ_OWNER') { toast('还没填仓库地址，先点「⚙ 仓库」', 'error'); return Promise.resolve(null); }
    toast('正在检查云端版本…');
    return check().then(function (c) {
      if (c.has) {
        toast('☁ 云端有新版 v' + c.meta.version + '（本机 ' + (c.current || '未同步') + '），点「同步」即可更新', 'success');
      } else {
        toast('已是最新 v' + c.meta.version + '，不用更新');
      }
      return c;
    }).catch(function (e) {
      toast('检查失败：' + (e && e.message || e) + '（不影响使用）', 'error');
      return null;
    });
  }

  function uiSync(force) {
    if (!hasRepo() && DEFAULT_REPO.owner === 'YQ_OWNER') { toast('还没填仓库地址，先点「⚙ 仓库」', 'error'); return Promise.resolve(null); }
    toast('正在从云端同步云起预设…');
    return sync(force).then(function (r) {
      if (r.upToDate) { toast('已是最新 v' + r.version + '，不用更新'); }
      else if (r.synced) {
        toast('✓ 云起预设已更新到 v' + r.version + '（' + r.blocks + ' 块 + ' + r.regex + ' 条正则）', 'success');
        try { window.ConfigModal && window.ConfigModal.renderMMSection && window.ConfigModal.renderMMSection(); } catch (e) { }
      }
      return r;
    }).catch(function (e) {
      toast('同步失败：' + (e && e.message || e) + '（本机数据未改动）', 'error');
      return null;
    });
  }

  function uiRepo() {
    var s = status();
    var v = window.prompt('云起预设的 GitHub 仓库（格式：用户名/仓库名，分支默认 main）', s.repo || '');
    if (v === null) return false;
    var parts = String(v).split('/');
    var owner = (parts[0] || '').trim();
    var rest = (parts[1] || '').trim();
    var branch = 'main';
    if (rest.indexOf('@') >= 0) { branch = rest.split('@')[1].trim() || 'main'; rest = rest.split('@')[0].trim(); }
    if (!owner || !rest) { toast('格式不对，应为「用户名/仓库名」', 'error'); return false; }
    setRepo({ owner: owner, repo: rest, branch: branch });
    toast('✓ 已指向 ' + owner + '/' + rest + '@' + branch, 'success');
    return true;
  }

  window.YunqiSync = {
    FILE_VER: FILE_VER, FILE_FULL: FILE_FULL,
    repo: repo, setRepo: setRepo, hasRepo: hasRepo, sources: sources,
    status: status, check: check, pull: pull, sync: sync, remoteMeta: remoteMeta,
    uiCheck: uiCheck, uiSync: uiSync, uiRepo: uiRepo
  };
})();
