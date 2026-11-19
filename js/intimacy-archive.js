/* =====================================================================
 * 云境 · 亲密关系档案（R18 Archive）
 * ---------------------------------------------------------------------
 * 版权声明：本模块是云境项目独立实现的通用「亲密关系进度管理」游戏机制。
 *          数据结构、字段命名、算法（djb2 散列 + xorshift 相位）、状态机、
 *          注释与全部文本模板均为本项目原创，未复制/改写/翻译任何第三方
 *          项目的源码、标识符、提示词或数据定义。
 *
 * 内容边界：本模块只管理「关系阶段 / 亲密度 / 私密记忆 / 专属称呼 / 边界
 *          偏好 / 含蓄互动记录」等关系状态。模块本身不生成、不存储露骨
 *          色情描写；所有互动文本均保持在文学化、含蓄的情感层面。
 *
 * 默认关闭：.enabled 默认 false，开启需在用量面板显式操作并明示成本。
 * 依赖：无（原生 JS、零运行时后端）；核心为纯函数，可 Node vm 回归。
 * ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '1.0.0';
  var LS_KEY = 'yunjing.intimacy.enabled.v1';

  /* ---------- 通用工具（本项目独立实现） ---------- */
  function hash32(str) {
    var h = 5381;
    str = String(str == null ? '' : str);
    for (var i = 0; i < str.length; i++) {
      h = (((h << 5) + h) + str.charCodeAt(i)) >>> 0; /* djb2 */
    }
    return h >>> 0;
  }
  function xorshift(seed) {
    var s = seed >>> 0;
    if (!s) s = 0x9e3779b9;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }
  function clampInt(v, lo, hi) {
    v = Number(v);
    if (!isFinite(v)) v = lo;
    v = Math.round(v);
    return v < lo ? lo : (v > hi ? hi : v);
  }
  function now() {
    try { return Date.now(); } catch (e) { return 0; }
  }

  /* 关系阶段：亲密度门槛驱动，只升不降（关系一旦建立不因单次波动倒退） */
  var STAGES = [
    { key: 'stranger', label: '陌生', min: 0 },
    { key: 'acquaint', label: '相识', min: 10 },
    { key: 'familiar', label: '熟悉', min: 25 },
    { key: 'close',    label: '亲近', min: 45 },
    { key: 'intimate', label: '亲密', min: 65 },
    { key: 'bonded',   label: '伴侣', min: 85 }
  ];
  var BOUNDARY_KEYS = ['display', 'touch', 'privateSpace'];
  var DEFAULT_BOUNDARIES = { display: '谨慎', touch: '需同意', privateSpace: '尊重' };

  /* 本地保底互动文本（原创、含蓄、文学化；AI 增强时会由大模型润色替换） */
  var LOCAL_LINES = [
    '两人并肩坐在廊下，谁都没有先开口。',
    '她替他拂去肩上的落雪，动作很轻。',
    '夜风掠过窗棂，他把自己的外衣搭在了椅背上。',
    '她停住脚步，回头看了他一眼，又继续往前走。',
    '茶凉了，两人却都没起身去续。',
    '他把伞往她那边倾了倾，自己半边肩头湿了。',
    '灯火摇了摇，映得她的侧脸有些模糊。',
    '他们隔着一张桌子，把一句话拆成了很久的沉默。'
  ];

  /* 分层留存：重要 40 / 普通 12 / 日常 5 */
  var MEM_CAP = { 2: 40, 1: 12, 0: 5 };

  var state = {
    enabled: false,
    records: {},   /* name -> archive */
    vault: {},     /* 只增不删：remove 后快照存此 */
    stats: { created: 0, removed: 0, restored: 0, memories: 0, interactions: 0, gated: 0 }
  };

  function loadEnabled() {
    try {
      var v = global.localStorage && global.localStorage.getItem(LS_KEY);
      return v === '1';
    } catch (e) { return false; }
  }
  function saveEnabled(v) {
    try { if (global.localStorage) global.localStorage.setItem(LS_KEY, v ? '1' : '0'); } catch (e) {}
  }
  state.enabled = loadEnabled();

  function stageOf(closeness) {
    var idx = 0;
    for (var i = 0; i < STAGES.length; i++) {
      if (closeness >= STAGES[i].min) idx = i;
    }
    return idx;
  }

  function ensure(name) {
    name = String(name == null ? '' : name).trim();
    if (!name) return null;
    if (!state.records[name]) {
      var b = {};
      BOUNDARY_KEYS.forEach(function (k) { b[k] = DEFAULT_BOUNDARIES[k]; });
      state.records[name] = {
        name: name,
        stage: 0,
        closeness: 0,
        petName: '',
        boundaries: b,
        memories: [],
        interactions: [],
        trusted: [],
        flags: { r18: false },
        createdAt: now(),
        updatedAt: now()
      };
      state.stats.created++;
    }
    return state.records[name];
  }

  function get(name) {
    return state.records[String(name == null ? '' : name)] || null;
  }

  function list() {
    return Object.keys(state.records).map(function (k) { return state.records[k]; });
  }

  /* 只增不删：remove 不销毁，先存全量快照进库房 */
  function remove(name) {
    name = String(name == null ? '' : name);
    var rec = state.records[name];
    if (!rec) return false;
    try { state.vault[name] = JSON.parse(JSON.stringify(rec)); } catch (e) { state.vault[name] = rec; }
    delete state.records[name];
    state.stats.removed++;
    return true;
  }

  function restore(name) {
    name = String(name == null ? '' : name);
    var snap = state.vault[name];
    if (!snap) return false;
    try { state.records[name] = JSON.parse(JSON.stringify(snap)); } catch (e) { state.records[name] = snap; }
    state.stats.restored++;
    return true;
  }

  function vaultSize() { return Object.keys(state.vault).length; }

  function gate(tag) {
    if (!state.enabled) { state.stats.gated++; return false; }
    return true;
  }

  function addCloseness(name, delta, reason) {
    var rec = ensure(name);
    if (!rec) return null;
    var before = rec.stage;
    rec.closeness = clampInt(rec.closeness + Number(delta || 0), 0, 100);
    /* 棘轮：关系阶段只升不降——亲密度.short 波动不应抹掉已建立的关系层级 */
    rec.stage = Math.max(rec.stage, stageOf(rec.closeness));
    rec.updatedAt = now();
    if (reason) {
      remember(name, String(reason), rec.stage >= 4 ? 2 : 1);
    }
    return { closeness: rec.closeness, stage: rec.stage, promoted: rec.stage > before, label: STAGES[rec.stage].label };
  }

  /* 记忆分层留存：按 weight 分桶，各桶超过 cap 时丢最旧的 */
  function remember(name, text, weight) {
    var rec = ensure(name);
    if (!rec || !text) return null;
    weight = clampInt(weight, 0, 2);
    var item = { weight: weight, text: String(text), turn: 0, stage: rec.stage, at: now() };
    rec.memories.push(item);
    state.stats.memories++;
    var kept = { 0: [], 1: [], 2: [] };
    rec.memories.forEach(function (m) {
      var w = clampInt(m.weight, 0, 2);
      kept[w].push(m);
    });
    [0, 1, 2].forEach(function (w) {
      var cap = MEM_CAP[w];
      if (kept[w].length > cap) kept[w] = kept[w].slice(kept[w].length - cap);
    });
    rec.memories = kept[0].concat(kept[1], kept[2]);
    return item;
  }

  function setPetName(name, petName) {
    var rec = ensure(name);
    if (!rec) return null;
    rec.petName = String(petName == null ? '' : petName).slice(0, 20);
    rec.updatedAt = now();
    return rec.petName;
  }

  function setBoundary(name, key, value) {
    var rec = ensure(name);
    if (!rec || BOUNDARY_KEYS.indexOf(key) < 0) return null;
    rec.boundaries[key] = String(value == null ? '' : value).slice(0, 20);
    rec.updatedAt = now();
    return rec.boundaries[key];
  }

  function setTrusted(name, viewer, trusted) {
    var rec = ensure(name);
    if (!rec) return null;
    var v = String(viewer == null ? '' : viewer);
    var i = rec.trusted.indexOf(v);
    if (trusted !== false && i < 0) rec.trusted.push(v);
    if (trusted === false && i >= 0) rec.trusted.splice(i, 1);
    return rec.trusted.slice();
  }

  /* 本地保底互动文本：种子确定，零 API。AI 增强层会覆盖 text 字段。 */
  function localInteraction(name, turn) {
    var rec = ensure(name);
    if (!rec) return null;
    var seed = hash32(name + '|' + (turn || 0));
    var rnd = xorshift(seed);
    var text = LOCAL_LINES[Math.floor(rnd() * LOCAL_LINES.length)];
    return recordInteraction(name, text, { turn: turn || 0, source: 'local' });
  }

  function recordInteraction(name, text, opts) {
    var rec = ensure(name);
    if (!rec || !text) return null;
    opts = opts || {};
    /* 内容边界：只允许文学化/含蓄文本；过滤显式露骨词（粗粒度护栏） */
    var clean = sanitize(String(text));
    if (!clean) return null;
    var item = {
      text: clean,
      stage: rec.stage,
      turn: Number(opts.turn || 0),
      source: opts.source || 'local',
      r18: !!opts.r18,
      at: now()
    };
    rec.interactions.push(item);
    state.stats.interactions++;
    var cap = MEM_CAP[2];
    if (rec.interactions.length > cap) rec.interactions = rec.interactions.slice(rec.interactions.length - cap);
    return item;
  }

  /* 粗粒度内容护栏：拦截常见露骨词，保持档案在情感/关系层面 */
  var EXPLICIT = /(性交|做爱|口交|肛交|自慰|淫|奸|裸体|赤裸|下体|生殖器|阴茎|阴道|胸部|射精|高潮)/;
  function sanitize(text) {
    if (EXPLICIT.test(text)) return '';
    return text.trim().slice(0, 300);
  }

  /* 认知边界：私密记忆/互动仅可信名单或高关系阶段可见 */
  function visibleTo(name, viewer, item) {
    var rec = get(name);
    if (!rec || !item) return false;
    if (item.weight != null && item.weight === 0) return true;      /* 日常公开 */
    if (rec.trusted.indexOf(String(viewer == null ? '' : viewer)) >= 0) return true;
    /* 内容产生时关系已达「亲密」或以上 → 对当事人可见（用条目自身阶段，非当前阶段） */
    if (item.stage != null && item.stage >= 4) return true;
    return false;
  }

  function view(name, viewer) {
    var rec = get(name);
    if (!rec) return null;
    return {
      name: rec.name,
      stage: rec.stage,
      stageLabel: STAGES[rec.stage].label,
      closeness: rec.closeness,
      petName: rec.petName,
      boundaries: Object.assign({}, rec.boundaries),
      memories: rec.memories.filter(function (m) { return visibleTo(name, viewer, m); }).map(function (m) { return m.text; }),
      interactions: rec.interactions.filter(function (m) { return visibleTo(name, viewer, m); }).map(function (m) { return m.text; }),
      r18: rec.flags.r18
    };
  }

  function stats() {
    return {
      enabled: state.enabled,
      records: Object.keys(state.records).length,
      vault: vaultSize(),
      stats: Object.assign({}, state.stats),
      stageLabels: STAGES.map(function (s) { return s.label; })
    };
  }

  function setEnabled(v) {
    state.enabled = !!v;
    saveEnabled(state.enabled);
    return state.enabled;
  }

  function exportAll() {
    return { v: VERSION, enabled: state.enabled, records: state.records, vault: state.vault };
  }
  function importAll(data) {
    if (!data || typeof data !== 'object') return false;
    if (data.records && typeof data.records === 'object') state.records = data.records;
    if (data.vault && typeof data.vault === 'object') state.vault = data.vault;
    if (typeof data.enabled === 'boolean') setEnabled(data.enabled);
    return true;
  }

  var API = {
    VERSION: VERSION,
    STAGES: STAGES,
    LOCAL_LINES: LOCAL_LINES,
    isEnabled: function () { return state.enabled; },
    setEnabled: setEnabled,
    toggle: function () { return setEnabled(!state.enabled); },
    gate: gate,
    ensure: ensure,
    get: get,
    list: list,
    remove: remove,
    restore: restore,
    vaultSize: vaultSize,
    addCloseness: addCloseness,
    remember: remember,
    setPetName: setPetName,
    setBoundary: setBoundary,
    setTrusted: setTrusted,
    localInteraction: localInteraction,
    recordInteraction: recordInteraction,
    sanitize: sanitize,
    visibleTo: visibleTo,
    view: view,
    stats: stats,
    exportAll: exportAll,
    importAll: importAll,
    _state: state
  };

  global.IntimacyArchive = API;
})(typeof window !== 'undefined' ? window : globalThis);
