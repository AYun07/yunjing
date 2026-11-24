/* ============================================================
 * 云境 · 内容采集适配器 v1.0（v6.5.0）
 * ------------------------------------------------------------
 * 把 12 类玩家可创作内容统一读成 ContentItem，写回时逐 key 落位。
 * 依赖：PatchEngine.item。localStorage 为主；IDB 大内容用 file-bridge 或自建 store；
 * 源码级（source）仅桌面 FileBridge 授权后可用，不可用则标 unscanned。
 * 纯逻辑 + 存储抽象，键规则可单测（mock store）。
 * 版权：云境独立实现，无第三方源码。
 * ============================================================ */
(function () {
  'use strict';
  var CA = {};
  var PE = globalThis.PatchEngine || (typeof require !== 'undefined' ? require('./patch-engine.js') : null);

  /* ---------- 12 类定义与 localStorage 前缀规则 ---------- */
  // kind -> { label, lsPatterns(RegExp[]), desc }
  var KINDS = {
    dlc:       { label: 'DLC',       ls: [/^storyDLC_/i, /^yunjing.*dlc/i, /^DLC/i, /^yj_.*dlc/i] },
    plugin:    { label: '插件',       ls: [/^yunjing.*plugin/i, /^yj_.*plugin/i, /^plugin/i] },
    tool:      { label: '小云工具',   ls: [/^yj_.*tool/i, /^yunjing.*tool/i, /^moTool/i] },
    save:      { label: '存档',       ls: [/^storySave_/i, /^yunjingSave/i, /^saveSlot/i], sensitive: true },
    preset:    { label: '预设',       ls: [/^yunjing.*[Pp]reset/i, /^yj_.*preset/i, /^yunqi.*preset/i, /^statusPreset/i] },
    worldbook: { label: '世界书',     ls: [/^storyKB/i, /^yunjing.*[Kk][Bb]/i, /^yj_.*(worldbook|kb)/i, /^worldExt/i] },
    world:     { label: '世界',       ls: [/^yj_.*world/i, /^yunjing.*world/i, /^customWorld/i] },
    content:   { label: '新内容',     ls: [/^yunjing.*(Custom|Ext|Forge|Creator)/i, /^Creator/i, /^forge/i] },
    pack:      { label: '资源包',     ls: [/^yj_.*pack/i, /^yunjing.*pack/i, /^assetPack/i], idb: true },
    image:     { label: '图片',       ls: [/^yj_.*img/i, /^yunjing.*image/i], idb: true },
    video:     { label: '视频',       ls: [/^yj_.*video/i], idb: true },
    file:      { label: '文件',       ls: [/^yj_.*file/i, /^fileBridge/i], idb: true },
    source:    { label: '源码(桌面)', ls: [], source: true }
  };
  CA.KINDS = KINDS;

  /** 拒绝清单：token / 密钥 / 运行时缓存 / 正文存档的临时态，绝不当二创内容采走 */
  var BLOCK = /(token|apikey|api_key|secret|password|authorization|_gh_|github.*token|yunjingExportIncludeKey|\.bak$|\.idb$)/i;

  function store() { return (typeof window !== 'undefined' && (window.MoStore || window.localStorage)) || null; }

  /** 判断一个 localStorage key 属于哪个 kind */
  function classify(key) {
    if (BLOCK.test(key)) return null;
    for (var kind in KINDS) {
      var pats = KINDS[kind].ls || [];
      for (var i = 0; i < pats.length; i++) if (pats[i].test(key)) return kind;
    }
    return null;
  }
  CA.classify = classify;

  /**
   * 扫描本机可采集内容 → ContentItem[]
   * opts: { storeObj, includeSaveKeys:boolean(默认false，存档默认剥离密钥), stripSave:boolean }
   * 返回 { items, unscanned, stats }
   */
  function collect(opts) {
    opts = opts || {};
    var ls = opts.storeObj || store();
    var items = [], unscanned = [], stats = { scanned: 0 };
    if (!ls) {
      KINDS.source && unscanned.push({ kind: 'source', reason: '无存储环境' });
      return { items: items, unscanned: unscanned, stats: stats };
    }
    var length = ls.length != null ? ls.length : 0;
    for (var i = 0; i < length; i++) {
      var key = ls.key(i);
      if (!key) continue;
      var kind = classify(key);
      if (!kind) continue;
      stats.scanned++;
      var val = '';
      try { val = ls.getItem(key) || ''; } catch (e) { unscanned.push({ kind: kind, key: key, reason: '读取失败' }); continue; }
      // 密钥兜底剥离：manifest 声明 stripKeys:true（全包剔除），故所有类型都在采集阶段剥离，
      // 而非只 save 类——否则 preset/DLC 里手写的 sk-/ghp_ 会漏到 scanSecrets 才被整包拦。
      // 仅当调用方显式 keepSaveKeys=true（私密 Gist 存档）时保留。
      if (opts.keepSaveKeys !== true && PE && PE.stripSecrets) {
        var stripped = PE.stripSecrets(val);
        if (stripped === null) { unscanned.push({ kind: kind, key: key, reason: '含密钥且剥离后为空' }); continue; }
        val = stripped;
      }
      items.push(PE.item(kind + '/' + key, kind, val));
      if (items.length >= 500) { unscanned.push({ kind: '(limit)', reason: '达到500项采集上限，其余未纳入' }); break; }
    }
    // IDB 类：本环境若无 file-bridge 枚举能力，明确标注未纳入，不假装支持
    var idbKinds = ['pack','image','video','file'];
    idbKinds.forEach(function (k) {
      var cap = opts['idb_' + k]; // 允许注入异步采集器；此处同步内核不阻塞
      if (typeof cap === 'function') {
        var got = cap();
        (got || []).forEach(function (x) { items.push(PE.item(k + '/' + x.name, k, x.data)); });
      } else {
        unscanned.push({ kind: k, reason: 'IndexedDB 大内容需异步采集器（浏览器端注入），本次未纳入' });
      }
    });
    // 源码级：默认未纳入（桌面授权后可经 opts.sourceReader 注入）
    if (typeof opts.sourceReader === 'function') {
      try {
        (opts.sourceReader() || []).forEach(function (f) { items.push(PE.item('source/' + f.path, 'source', f.data)); });
      } catch (e) { unscanned.push({ kind: 'source', reason: '源码读取失败：' + (e.message || e) }); }
    } else {
      unscanned.push({ kind: 'source', reason: '桌面授权后可用（FileBridge）；手机/未授权浏览器不支持' });
    }
    return { items: items, unscanned: unscanned, stats: stats };
  }
  CA.collect = collect;

  /** 逐 key 写回。adapter.write(key, data, kind) 由浏览器端提供；Node 测试用 mock */
  function apply(ops, writer) {
    var done = [], errors = [];
    (ops || []).forEach(function (op) {
      try {
        // key 形如 kind/localKey，拆出原始 localStorage 键
        var slash = op.key.indexOf('/');
        var kind = op.kind || (slash > 0 ? op.key.slice(0, slash) : 'content');
        var localKey = slash > 0 ? op.key.slice(slash + 1) : op.key;
        writer.write(localKey, op.data, kind, op.op);
        done.push(op.key);
      } catch (e) {
        errors.push({ key: op.key, error: (e && e.message) || String(e) });
      }
    });
    return { done: done, errors: errors };
  }
  CA.apply = apply;

  /** 默认 localStorage writer（浏览器） */
  function localWriter() {
    return {
      write: function (key, data, kind, op) {
        var ls = store();
        if (!ls) throw new Error('无存储环境');
        if (data === PE.TOMB) ls.removeItem(key);
        else ls.setItem(key, data);
      }
    };
  }
  CA.localWriter = localWriter;

  globalThis.ContentAdapters = CA;
  if (typeof module !== 'undefined' && module.exports) module.exports = CA;
})();
