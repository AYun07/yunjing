/* =============================================================================
 * 云境 v6.3.14 · 全量楼层状态快照 FloorState
 * -----------------------------------------------------------------------------
 * 目标：让「回档到任意楼层」时，所有随剧情演化的数据都同步到那一层。
 * 病因对照：某同类产品 1.7GB = 每存一次把整份存档 gzip 塞进 backups[] 无限追加。
 * 本模块反其道而行：
 *   ① 固定一个 IDB 键 floorState/<saveKey>，覆盖写，绝不无限追加；
 *   ② 对话正文不进快照（走 transcript 通道，靠 histLen 截断）——只存长度数字；
 *   ③ 差量 + 每 20 层锚点：每层只存"变了哪些字段"，回档从最近锚点重放。
 * 于是体积 ≈ 真实状态变化量（放大 ≤3），且任意层可精确还原。
 *
 * 零侵入：独立模块。删掉本文件 + 去掉 story-framework.js 的调用即回退旧行为。
 * ============================================================================= */
(function (global) {
  'use strict';

  var ANCHOR_EVERY = 20;

  /* storyState 里随楼层演化的顶层字段。对话历史特殊处理（只存长度）。 */
  var SS_FIELDS = [
    'variables', 'digest', 'driftNotes', 'inspirations', 'dynamicWorld',
    'illustrations', 'phone', 'recap', 'npcPortraits', 'bookmarks',
    'weeklyLog', 'memoryLayers', 'sceneState',
    'styleLog', 'styleBaseline', 'styleDeepNote', 'bibleSnap', 'bibleAlerts',
    'pacingLog', 'pacingNotes', 'reviewNotes', 'reviewLog', 'tokenUsage'
  ];

  function storage() {
    return (global.StorageBoost && global.StorageBoost.ready()) ? global.StorageBoost : null;
  }
  function key(fw) { return 'floorState/' + fw.getSaveKey(); }
  function clone(v) { try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; } }
  function jsonEq(a, b) {
    try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return a === b; }
  }

  /* v6.4.0：跨书/跨周目持久项——默认不随回档退，玩家可勾选。
     worldLegacyBank（全局传承银行）、worldLegacyGranted~slot（本世是否已发放）、
     storyAtlas_<genre>（行旅足迹：走过哪些地点/势力态） */
  var PERSIST_RE = /^(worldLegacyBank|worldLegacyGranted|storyAtlas_)/;

  /** 当前槽位的旁路键集合（只取"随楼层演化"的，排除持久项） */
  function sideKeys(fw) {
    var out = [];
    try {
      if (!global.SlotRegistry || !global.SlotRegistry.keysOf) return out;
      var all = global.SlotRegistry.keysOf(fw.slotId || 'main', fw.genre);
      all.forEach(function (k) { if (!PERSIST_RE.test(k)) out.push(k); });
    } catch (e) {}
    return out;
  }

  /** 持久项键：SlotRegistry 枚举 + localStorage 前缀扫描（storyAtlas 带 genre 后缀） */
  function persistKeys(fw) {
    var set = {};
    try {
      if (global.SlotRegistry && global.SlotRegistry.keysOf) {
        global.SlotRegistry.keysOf(fw.slotId || 'main', fw.genre).forEach(function (k) {
          if (PERSIST_RE.test(k)) set[k] = 1;
        });
      }
    } catch (e) {}
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && PERSIST_RE.test(k)) set[k] = 1;
      }
    } catch (e) {}
    return Object.keys(set);
  }

  /** 采集"当前这一层"的全量快照（不含对话正文） */
  function capture(fw) {
    var s = fw.storyState || {};
    // user = 当前历史末条 user 消息，供"从此轮重写"复用原指令
    var lastUser = '';
    var ch = s.conversationHistory || [];
    for (var i = ch.length - 1; i >= 0; i--) { if (ch[i] && ch[i].role === 'user') { lastUser = ch[i].content || ''; break; } }
    var snap = { ss: {}, sk: {}, persist: {}, histLen: ch.length, user: lastUser };
    SS_FIELDS.forEach(function (f) {
      if (s[f] !== undefined) snap.ss[f] = clone(s[f]);
    });
    sideKeys(fw).forEach(function (k) {
      try { var v = localStorage.getItem(k); if (v != null) snap.sk[k] = v; } catch (e) {}
    });
    persistKeys(fw).forEach(function (k) {
      try { var v = localStorage.getItem(k); if (v != null) snap.persist[k] = v; } catch (e) {}
    });
    return snap;
  }

  /** 求 diff：full 相对 prev 变化的顶层字段；histLen 恒带上 */
  function diff(full, prev) {
    var d = { histLen: full.histLen, user: full.user, ss: {}, sk: {}, persist: {} };
    Object.keys(full.ss).forEach(function (f) {
      if (!prev || !jsonEq(full.ss[f], prev.ss && prev.ss[f])) d.ss[f] = full.ss[f];
    });
    if (prev && prev.ss) Object.keys(prev.ss).forEach(function (f) {
      if (!(f in full.ss)) d.ss[f] = undefined; // 字段被删除
    });
    Object.keys(full.sk).forEach(function (k) {
      if (!prev || full.sk[k] !== (prev.sk && prev.sk[k])) d.sk[k] = full.sk[k];
    });
    if (prev && prev.sk) Object.keys(prev.sk).forEach(function (k) {
      if (!(k in full.sk)) d.sk[k] = null; // 键被删除
    });
    Object.keys(full.persist || {}).forEach(function (k) {
      if (!prev || full.persist[k] !== (prev.persist && prev.persist[k])) d.persist[k] = full.persist[k];
    });
    if (prev && prev.persist) Object.keys(prev.persist).forEach(function (k) {
      if (!(k in (full.persist || {}))) d.persist[k] = null;
    });
    return d;
  }

  /** 应用 diff 到 full（就地），返回新的全量 */
  function apply(full, d) {
    if (!full) full = { ss: {}, sk: {}, persist: {}, histLen: 0 };
    if (!full.persist) full.persist = {};
    if (!d) return full;
    if (typeof d.histLen === 'number') full.histLen = d.histLen;
    if ('user' in d) full.user = d.user;
    Object.keys(d.ss || {}).forEach(function (f) {
      if (d.ss[f] === undefined) delete full.ss[f]; else full.ss[f] = clone(d.ss[f]);
    });
    Object.keys(d.sk || {}).forEach(function (k) {
      if (d.sk[k] === null) delete full.sk[k]; else full.sk[k] = d.sk[k];
    });
    Object.keys(d.persist || {}).forEach(function (k) {
      if (d.persist[k] === null) delete full.persist[k]; else full.persist[k] = d.persist[k];
    });
    return full;
  }

  function emptyDoc() { return { v: 1, base: null, deltas: {}, anchors: {}, tip: -1 }; }

  function read(fw) {
    var st = storage();
    if (!st) return Promise.resolve(emptyDoc());
    return st.get(key(fw)).then(function (raw) {
      if (!raw) return emptyDoc();
      try { var d = typeof raw === 'string' ? JSON.parse(raw) : raw; if (d && d.v === 1) return d; } catch (e) {}
      return emptyDoc();
    }).catch(function () { return emptyDoc(); });
  }

  function write(fw, doc) {
    var st = storage();
    if (!st) return Promise.resolve(false);
    return st.put(key(fw), JSON.stringify(doc)).then(function () { return true; }).catch(function () { return false; });
  }

  /** 记录第 index 层的全量快照（每轮结束后调用，串行化防丢失） */
  function record(fw, index) {
    var st = storage();
    if (!st) return Promise.resolve(false);
    var full = capture(fw);
    var job = read(fw).then(function (doc) {
      if (!doc.base) { doc.base = clone(full); }
      else if (index <= doc.tip) {
        // 重写已存在的层：重放得到该层旧状态，替换其 diff，并清掉其后所有层
        var old = rebuild(doc, index);
        doc.deltas[index] = diff(full, old);
        Object.keys(doc.deltas).forEach(function (k) { if (Number(k) > index) delete doc.deltas[k]; });
        Object.keys(doc.anchors).forEach(function (k) { if (Number(k) > index) delete doc.anchors[k]; });
      } else {
        var prev = rebuild(doc, index - 1);
        doc.deltas[index] = diff(full, prev);
      }
      doc.tip = index;
      if (index % ANCHOR_EVERY === 0) doc.anchors[index] = clone(full);
      return write(fw, doc);
    }).catch(function () { return false; });
    fw._fsQueue = (fw._fsQueue || Promise.resolve()).then(function () { return job; }, function () { return job; });
    return fw._fsQueue;
  }

  /** 重建第 index 层的全量状态：从 ≤index 的最大锚点出发重放差量 */
  function rebuild(doc, index) {
    if (!doc || !doc.base) return null;
    if (index < 0) return clone(doc.base);
    var anchorIdx = -1;
    Object.keys(doc.anchors).forEach(function (k) { var n = Number(k); if (n <= index && n > anchorIdx) anchorIdx = n; });
    var full = anchorIdx >= 0 ? clone(doc.anchors[anchorIdx]) : clone(doc.base);
    var start = anchorIdx >= 0 ? anchorIdx + 1 : 0;
    for (var i = start; i <= index; i++) {
      if (doc.deltas[i]) full = apply(full, doc.deltas[i]);
    }
    return full;
  }

  /** 读取第 index 层全量状态（Promise） */
  function load(fw, index) {
    return read(fw).then(function (doc) { return rebuild(doc, index); });
  }

  /** 回档：删除 >=fromIndex 的所有差量/锚点，tip 回退。保留 0..fromIndex-1。 */
  function truncate(fw, fromIndex) {
    var st = storage();
    if (!st) return Promise.resolve(false);
    var job = read(fw).then(function (doc) {
      Object.keys(doc.deltas).forEach(function (k) { if (Number(k) >= fromIndex) delete doc.deltas[k]; });
      Object.keys(doc.anchors).forEach(function (k) { if (Number(k) >= fromIndex) delete doc.anchors[k]; });
      doc.tip = fromIndex - 1;
      return write(fw, doc);
    }).catch(function () { return false; });
    fw._fsQueue = (fw._fsQueue || Promise.resolve()).then(function () { return job; }, function () { return job; });
    return fw._fsQueue;
  }

  /** 把一个全量状态应用到运行时（storyState + 旁路键），不动对话正文（由调用方按 histLen 截断）
   *  includePersistent=false（默认）：足迹/传承等跨书持久项保持当前值，不退。
   *  includePersistent=true ：连持久项一起还原到该层。 */
  function restore(fw, full, includePersistent) {
    if (!full) return false;
    var s = fw.storyState;
    SS_FIELDS.forEach(function (f) {
      if (f in full.ss) s[f] = clone(full.ss[f]);
      else delete s[f];
    });
    var keys = sideKeys(fw);
    keys.forEach(function (k) {
      try {
        if (k in full.sk) { if (full.sk[k] != null) localStorage.setItem(k, full.sk[k]); }
        else localStorage.removeItem(k);
      } catch (e) {}
    });
    if (includePersistent) {
      persistKeys(fw).forEach(function (k) {
        try {
          if (k in (full.persist || {})) { if (full.persist[k] != null) localStorage.setItem(k, full.persist[k]); }
        } catch (e) {}
      });
    }
    return full.histLen;
  }

  /* ---- 恢复点（可撤销）：固定 5 个，覆盖式 ---- */
  function undoKey(fw) { return 'floorUndo/' + fw.getSaveKey(); }

  function pushUndo(fw, full) {
    var st = storage();
    if (!st || !full) return Promise.resolve(false);
    var job = st.get(undoKey(fw)).then(function (raw) {
      var arr = [];
      try { if (raw) { var p = JSON.parse(raw); if (Array.isArray(p)) arr = p; } } catch (e) {}
      arr.push({ at: Date.now(), full: clone(full) });
      if (arr.length > 5) arr = arr.slice(-5);
      return st.put(undoKey(fw), JSON.stringify(arr));
    }).catch(function () { return false; });
    fw._fsQueue = (fw._fsQueue || Promise.resolve()).then(function () { return job; }, function () { return job; });
    return fw._fsQueue;
  }

  function popUndo(fw) {
    var st = storage();
    if (!st) return Promise.resolve(null);
    var job = st.get(undoKey(fw)).then(function (raw) {
      var arr = [];
      try { if (raw) { var p = JSON.parse(raw); if (Array.isArray(p)) arr = p; } } catch (e) {}
      var last = arr.pop();
      return st.put(undoKey(fw), JSON.stringify(arr)).then(function () { return last ? last.full : null; });
    }).catch(function () { return null; });
    fw._fsQueue = (fw._fsQueue || Promise.resolve()).then(function () { return job; }, function () { return job; });
    return fw._fsQueue;
  }

  function clear(fw) {
    var st = storage();
    if (!st) return Promise.resolve();
    return Promise.all([
      st.remove(key(fw)).catch(function () {}),
      st.remove(undoKey(fw)).catch(function () {})
    ]);
  }

  var API = {
    record: record, load: load, rebuild: rebuild, truncate: truncate,
    restore: restore, capture: capture, clear: clear,
    pushUndo: pushUndo, popUndo: popUndo,
    diff: diff, apply: apply,
    ANCHOR_EVERY: ANCHOR_EVERY, SS_FIELDS: SS_FIELDS,
    _key: key, _sideKeys: sideKeys, _persistKeys: persistKeys
  };
  global.FloorState = API;
})(typeof window !== 'undefined' ? window : globalThis);
