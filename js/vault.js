/* 云境 · 保险箱 v1.0.0（v3.53.0）
   ────────────────────────────────────────────────────────────────
   三件套：存档搬家、配置搬家、整机搬家。
   · 存档包：所有世界的所有书档（storySave_* / storySlots_* / storyActiveSlot_）
   · 配置包：接口、主题、内容尺度、玩法开关、预设/正则覆盖（Key 可选是否带出）
   · 整机包：上面两样 + 玩家改过的世界书/图鉴
   导入前自动把当前数据整体备份到 yunjingVaultBackup，一步可回滚 —— 不让"导入"变成单向门。
   ──────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var APP = 'yunjing-vault';
  var VER = 1;
  var BACKUP_KEY = 'yunjingVaultBackup';

  var SAVE_PREFIX = ['storySave_', 'storySlots_', 'storyActiveSlot_'];
  var DATA_PREFIX = ['storyKnowledge_', 'storyAtlas_', 'storyKBTrash_'];
  /* 配置类键：白名单优先，另加通配（新增模块不用回来改表） */
  var CFG_KEYS = [
    'storyApiConfig', 'yunjingTheme', 'storyContentScale', 'storyAdultConfirmed',
    'antibaguGuard', 'storyKBGlobal', 'storyPhoneShellLayout', 'storyFontScale',
    /* 预设 / 正则（v3.51.0 起的真实键名，命名以 preset-io.js / regex-io.js 为准） */
    'yunjingPresetCustom', 'yunjingPresetSrc', 'yunjingPresetEdits',
    'yunjingRegexCustom', 'yunjingRegexSrc',
    'storyMiaomiaoOverrides', 'storyMiaomiaoRegexOverrides',
    'storyUseMiaomiao', 'storyUseMiaomiaoRegex',
    'storyKBVectorCfg', 'yunjingOnboardDone', 'storyKBKeyDepth',
    /* v3.53.0：状态栏字段组 / 自定义字段 / 成人向 / 破限 / 原创工坊模板 */
    'yunjingStatusGroupOff', 'yunjingStatusCustom', 'yunjingAdultFields',
    'yunjingStatusShowEmpty', 'storyBreakLimit', 'yunjingForgeTemplates'
  ];
  var CFG_PREFIX = ['story', 'yunjing', 'mo', 'kb', 'yj'];

  function ls() { try { return window.localStorage; } catch (e) { return null; } }
  function startsWithAny(k, arr) {
    for (var i = 0; i < arr.length; i++) if (k.indexOf(arr[i]) === 0) return true;
    return false;
  }
  function isSaveKey(k) { return startsWithAny(k, SAVE_PREFIX) && !/\.bak$/.test(k); }
  function isDataKey(k) { return startsWithAny(k, DATA_PREFIX); }
  function isCfgKey(k) {
    if (isSaveKey(k) || isDataKey(k)) return false;
    if (CFG_KEYS.indexOf(k) >= 0) return true;
    return startsWithAny(k, CFG_PREFIX);
  }

  function snapshot(filter) {
    var out = {}, n = 0, bytes = 0;
    var L = ls();
    if (!L) return { data: out, count: 0, bytes: 0 };
    for (var i = 0; i < L.length; i++) {
      var k = L.key(i);
      if (!k || !filter(k)) continue;
      var v = L.getItem(k);
      if (v == null) continue;
      out[k] = v;
      n++;
      bytes += k.length + v.length;
    }
    return { data: out, count: n, bytes: bytes };
  }

  function fmtBytes(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(2) + ' MB';
  }

  /* ---------------- 打包 ---------------- */
  function pack(kind) {
    var saves = { data: {}, count: 0, bytes: 0 }, cfg = { data: {}, count: 0, bytes: 0 }, data = { data: {}, count: 0, bytes: 0 };
    if (kind === 'saves' || kind === 'all') saves = snapshot(isSaveKey);
    if (kind === 'config' || kind === 'all') cfg = snapshot(isCfgKey);
    if (kind === 'all') data = snapshot(isDataKey);
    var pkg = {
      app: APP, ver: VER,
      kind: kind,
      exportedAt: new Date().toISOString(),
      origin: location.origin + location.pathname,
      saves: saves.data, config: cfg.data, data: data.data,
      stats: { saves: saves.count, config: cfg.count, data: data.count, bytes: saves.bytes + cfg.bytes + data.bytes }
    };
    return pkg;
  }

  function download(kind) {
    var pkg = pack(kind);
    if (!pkg.stats.saves && !pkg.stats.config && !pkg.stats.data) {
      window.showToast && window.showToast('这里还没有可导出的内容', 'warn');
      return null;
    }
    var name = kind === 'saves' ? '存档' : kind === 'config' ? '配置' : '整机';
    var blob = new Blob([JSON.stringify(pkg)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '云境' + name + '包_' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    window.showToast && window.showToast('已导出' + name + '包（' + fmtBytes(pkg.stats.bytes) + '）：' + (pkg.stats.saves + pkg.stats.config + pkg.stats.data) + ' 项', 'success');
    return pkg;
  }

  /* ---------------- 导入 ---------------- */
  function backupNow() {
    var all = snapshot(function () { return true; });
    var bk = { at: Date.now(), total: all.count, data: all.data };
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify(bk));
      return true;
    } catch (e) {
      /* 备份都写不进去：只备份存档类（最要紧的），配置大不了重填 */
      try {
        var s = snapshot(isSaveKey);
        localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: Date.now(), total: s.count, data: s.data, partial: true }));
        return true;
      } catch (e2) { return false; }
    }
  }

  function normalize(raw) {
    var pkg = raw;
    if (typeof pkg === 'string') { try { pkg = JSON.parse(pkg); } catch (e) { throw new Error('不是有效的 JSON 文件'); } }
    if (!pkg || typeof pkg !== 'object') throw new Error('不是有效的 JSON 对象');
    if (pkg.app && pkg.app !== APP && pkg.app !== 'yunjing' && pkg.app !== 'moshu') {
      throw new Error('这不是云境的数据包（app=' + pkg.app + '）');
    }
    /* 单档存档（SaveSlots.exportSlot 产物）也允许从这个入口进 */
    if (pkg.save && pkg.genre) return { single: pkg };
    if (!pkg.saves && !pkg.config && !pkg.data) throw new Error('包是空的：既没有存档，也没有配置');
    return pkg;
  }

  function importPkg(pkg, opts) {
    opts = opts || {};
    var L = ls();
    if (!L) throw new Error('浏览器存储不可用（隐私模式？）');
    var n = 0, skip = 0;

    if (pkg.single) {
      /* 单档：交给 SaveSlots（它会自己收进新槽位，永远不覆盖） */
      var fw = window.storyFramework;
      if (!fw) throw new Error('当前不在创作室内，无法导入单档存档');
      if (pkg.genre && pkg.genre !== fw.genre) throw new Error('这份存档属于「' + pkg.genre + '」工坊，请打开对应工坊再导入');
      if (!window.SaveSlots) throw new Error('存档模块未就绪');
      var blob = new Blob([JSON.stringify(pkg)], { type: 'application/json' });
      var file = new File([blob], 'import.json', { type: 'application/json' });
      window.SaveSlots.importSlot(file);
      return { single: true, count: 1 };
    }

    var backupOk = opts.noBackup ? true : backupNow();

    var groups = ['saves', 'config', 'data'];
    groups.forEach(function (g) {
      if (opts.only && opts.only.indexOf(g) < 0) return;
      var obj = pkg[g];
      if (!obj || typeof obj !== 'object') return;
      Object.keys(obj).forEach(function (k) {
        if (!/^[A-Za-z0-9_\-~.:]+$/.test(k)) { skip++; return; }
        var v = obj[k];
        if (typeof v !== 'string') { skip++; return; }
        try { L.setItem(k, v); n++; } catch (e) { skip++; }
      });
    });

    return { count: n, skip: skip, backup: backupOk };
  }

  function importFile(file, opts) {
    return new Promise(function (resolve, reject) {
      if (!file) return reject(new Error('没有选择文件'));
      if (file.size > 64 * 1024 * 1024) return reject(new Error('文件超过 64MB，超出浏览器可处理范围'));
      var r = new FileReader();
      r.onerror = function () { reject(new Error('文件读取失败')); };
      r.onload = function () {
        try {
          var pkg = normalize(r.result);
          resolve(importPkg(pkg, opts));
        } catch (e) { reject(e); }
      };
      r.readAsText(file);
    });
  }

  /* ---------------- 回滚 ---------------- */
  function hasBackup() {
    try { return !!localStorage.getItem(BACKUP_KEY); } catch (e) { return false; }
  }
  function backupInfo() {
    try {
      var b = JSON.parse(localStorage.getItem(BACKUP_KEY) || 'null');
      if (!b) return null;
      return { at: b.at, total: b.total, partial: !!b.partial, keys: Object.keys(b.data || {}).length };
    } catch (e) { return null; }
  }
  function undo() {
    var b = null;
    try { b = JSON.parse(localStorage.getItem(BACKUP_KEY) || 'null'); } catch (e) { }
    if (!b || !b.data) throw new Error('没有可回滚的备份');
    var n = 0;
    Object.keys(b.data).forEach(function (k) {
      try { localStorage.setItem(k, b.data[k]); n++; } catch (e) { }
    });
    try { localStorage.removeItem(BACKUP_KEY); } catch (e) { }
    return n;
  }

  /* ---------------- 面板 ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function stats() {
    var s = snapshot(isSaveKey), c = snapshot(isCfgKey), d = snapshot(isDataKey);
    return { saves: s.count, savesBytes: s.bytes, cfg: c.count, cfgBytes: c.bytes, data: d.count, dataBytes: d.bytes };
  }

  function panelHTML() {
    var s = stats();
    var bk = backupInfo();
    return ''
      + '<div class="yj-vault">'
      + '<div class="yj-vault-row">'
      + '<div class="yj-vault-card"><b>📚 存档包</b><span>' + s.saves + ' 项 · ' + fmtBytes(s.savesBytes) + '</span>'
      + '<p>所有世界的全部书档与槽位表。换手机、换浏览器、给朋友试玩，导入即接着写。</p>'
      + '<div class="yj-vault-acts"><button class="btn-ghost" onclick="YunjingVault.exportKind(\'saves\')">⤓ 导出</button>'
      + '<button class="btn-ghost" onclick="YunjingVault.pick(\'saves\')">📥 导入</button></div></div>'
      + '<div class="yj-vault-card"><b>⚙ 配置包</b><span>' + s.cfg + ' 项 · ' + fmtBytes(s.cfgBytes) + '</span>'
      + '<p>接口地址 / Key / 模型、主题、内容尺度、玩法开关、预设与正则覆盖。换电脑不用重填一遍。</p>'
      + '<div class="yj-vault-acts"><button class="btn-ghost" onclick="YunjingVault.exportKind(\'config\')">⤓ 导出</button>'
      + '<button class="btn-ghost" onclick="YunjingVault.pick(\'config\')">📥 导入</button></div></div>'
      + '<div class="yj-vault-card"><b>🗄 整机包</b><span>' + (s.saves + s.cfg + s.data) + ' 项 · ' + fmtBytes(s.savesBytes + s.cfgBytes + s.dataBytes) + '</span>'
      + '<p>存档 + 配置 + 你改过的世界书与图鉴，一个文件搬走整个云境。</p>'
      + '<div class="yj-vault-acts"><button class="btn-ghost" onclick="YunjingVault.exportKind(\'all\')">⤓ 导出</button>'
      + '<button class="btn-ghost" onclick="YunjingVault.pick(\'all\')">📥 导入</button></div></div>'
      + '</div>'
      + '<div class="yj-vault-undo">' + (bk
        ? '<span>导入前备份：' + new Date(bk.at).toLocaleString('zh-CN') + ' · ' + bk.keys + ' 项' + (bk.partial ? '（仅存档）' : '') + '</span><button class="btn-ghost danger" onclick="YunjingVault.undo()">↺ 回滚到导入前</button>'
        : '<span class="dim">导入时会自动备份当前数据，可一键回滚。</span>') + '</div>'
      + '<p class="yj-vault-note">导入是「并入」：同名的键会被包里的版本覆盖，其余保持不动。单档存档（书架里 ⬇ 导出的那种）也可以直接拖进来，会自动收成新槽位，绝不覆盖已有存档。</p>'
      + '</div>';
  }

  var _modal = null;
  function open() {
    if (!_modal) {
      _modal = document.createElement('div');
      _modal.id = 'yjVaultModal';
      _modal.className = 'yj-th-modal';
      _modal.innerHTML = '<div class="yj-th-box"><button class="modal-close" onclick="YunjingVault.close()">✕</button>'
        + '<div class="yj-th-head"><div><h3>🗄 保险箱 · 存档与配置</h3><p>搬家、备份、回滚。所有数据都只在你自己的浏览器里，不经过任何服务器。</p></div></div>'
        + '<div id="yjVaultBody"></div></div>';
      _modal.addEventListener('click', function (e) { if (e.target === _modal) YunjingVault.close(); });
      document.body.appendChild(_modal);
    }
    document.getElementById('yjVaultBody').innerHTML = panelHTML();
    _modal.classList.add('show');
  }
  function close() { if (_modal) _modal.classList.remove('show'); }

  function pick(kind) {
    var inp = document.getElementById('yjVaultFile');
    if (!inp) {
      inp = document.createElement('input');
      inp.type = 'file'; inp.id = 'yjVaultFile'; inp.accept = '.json,application/json';
      inp.style.display = 'none';
      inp.addEventListener('change', function () {
        var f = inp.files && inp.files[0];
        inp.value = '';
        if (!f) return;
        /* kind 存在 dataset 上：一个 input 复用，避免每点一次造一个新节点 */
        var k = inp.dataset.kind || 'all';
        var only = k === 'saves' ? ['saves'] : k === 'config' ? ['config'] : null;
        importFile(f, { only: only }).then(function (r) {
          if (r.single) return;
          window.showToast && window.showToast('已导入 ' + r.count + ' 项' + (r.skip ? '（跳过 ' + r.skip + ' 项）' : '') + '，即将刷新应用…', 'success');
          setTimeout(function () { location.reload(); }, 1200);
        }).catch(function (e) {
          window.showToast && window.showToast('导入失败：' + e.message, 'error');
        });
      });
      document.body.appendChild(inp);
    }
    inp.dataset.kind = kind;
    inp.click();
  }

  function exportKind(kind) { download(kind); }

  window.YunjingVault = {
    pack: pack, exportKind: exportKind, download: download,
    importFile: importFile, importPkg: importPkg,
    open: open, close: close, pick: pick,
    stats: stats, undo: undo, hasBackup: hasBackup, backupInfo: backupInfo,
    panelHTML: panelHTML, fmtBytes: fmtBytes
  };
})();
