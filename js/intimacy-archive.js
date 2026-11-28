/* =====================================================================
 * 云境 · 亲密关系档案（Dynamic Relation Archive）  v4.45.0
 * ---------------------------------------------------------------------
 * 版权声明：本模块是云境项目独立实现的通用「动态关系进度管理」游戏机制。
 *          数据结构、字段命名、算法（djb2 散列 + xorshift 相位）、状态机、
 *          注释与全部文本模板均为本项目原创，未复制/改写/翻译任何第三方
 *          项目的源码、标识符、提示词或数据定义。
 *
 * v4.45.0 重大改造（应玩家要求）：
 *   ① 拆除"只升不降"棘轮——关系可升可降，像真人一样有起伏；
 *   ② 新增负面关系——阶段轴从"宿敌→伴侣"双向覆盖，负值区有独立标签；
 *   ③ 关系多维化——好感/信任/敬重/亲近/欲望 五轴独立增减，总阶段加权得出；
 *   ④ 动态演化——evolve(ctx) 按时间流逝/事件冲击/特殊因素自动调整，
 *      并读取 PersonalityCodex 的性格倾向系数（多疑者信任更易降等）；
 *   ⑤ 玩家要求除外——玩家显式 set 的轴打锁定标记，自动演化跳过锁定轴；
 *   ⑥ 表达尺度——删除一刀切护栏，改玩家自选 含蓄/直白/露骨 三档，
 *      云境自身仍不内置露骨色情文本（交由玩家自有模型按其配置生成）。
 *
 * 依赖：无（原生 JS、零运行时后端）；核心为纯函数，可 Node vm 回归。
 * ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '2.0.0';
  var LS_KEY = 'yunjing.intimacy.enabled.v1';
  var LS_SCALE = 'yunjing.intimacy.expression.v1';

  /* ---------- 通用工具（本项目独立实现） ---------- */
  function hash32(str) {
    var h = 5381;
    str = String(str == null ? '' : str);
    for (var i = 0; i < str.length; i++) h = (((h << 5) + h) + str.charCodeAt(i)) >>> 0;
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
    v = Number(v); if (!isFinite(v)) v = lo;
    v = Math.round(v); return v < lo ? lo : (v > hi ? hi : v);
  }
  function now() { try { return Date.now(); } catch (e) { return 0; } }

  /* ---------- 表达尺度（玩家自选，默认含蓄） ---------- */
  var SCALES = [
    { key: 'subtle',  label: '含蓄', desc: '文学化、留白克制的情感描写' },
    { key: 'frank',   label: '直白', desc: '直接表达情感与欲望，不刻意回避' },
    { key: 'explicit',label: '露骨', desc: '移除关键词拦截，尺度交给你配置的模型决定' }
  ];
  var SCALE_KEYS = ['subtle', 'frank', 'explicit'];
  function loadScale() {
    try {
      var v = global.localStorage && global.localStorage.getItem(LS_SCALE);
      return SCALE_KEYS.indexOf(v) >= 0 ? v : 'subtle';
    } catch (e) { return 'subtle'; }
  }
  function saveScale(v) {
    try { if (global.localStorage) global.localStorage.setItem(LS_SCALE, v); } catch(e){console.warn("[swallowed] intimacy-archive",e)}
  }

  /* ---------- 关系阶段：双向覆盖（负=敌对，正=亲密） ----------
     总阶段由五维加权总分 total 决定；total ∈ [-100,100]。 */
  var STAGES = [
    { key: 'nemesis',  label: '宿敌', min: -100 },
    { key: 'hostile',  label: '敌视', min: -70 },
    { key: 'averse',   label: '厌恶', min: -45 },
    { key: 'distant',  label: '疏远', min: -20 },
    { key: 'stranger', label: '陌生', min: 0 },
    { key: 'acquaint', label: '相识', min: 10 },
    { key: 'familiar', label: '熟悉', min: 25 },
    { key: 'close',    label: '亲近', min: 45 },
    { key: 'intimate', label: '亲密', min: 65 },
    { key: 'bonded',   label: '伴侣', min: 85 }
  ];
  var AXES = ['favor', 'trust', 'esteem', 'closeness', 'desire'];
  var AXIS_LABEL = { favor: '好感', trust: '信任', esteem: '敬重', closeness: '亲近', desire: '欲望' };
  var AXIS_WEIGHT = { favor: 0.24, trust: 0.22, esteem: 0.16, closeness: 0.24, desire: 0.14 };
  var BOUNDARY_KEYS = ['display', 'touch', 'privateSpace'];
  var DEFAULT_BOUNDARIES = { display: '谨慎', touch: '需同意', privateSpace: '尊重' };

  /* 本地保底互动文本：仅"含蓄"档提供的文学化语料（原创）。
     直白/露骨档不内置露骨描写，交由玩家自有模型生成。 */
  var LOCAL_LINES_SUBTLE = [
    '两人并肩坐在廊下，谁都没有先开口。', '她替他拂去肩上的落雪，动作很轻。',
    '夜风掠过窗棂，他把自己的外衣搭在了椅背上。', '她停住脚步，回头看了他一眼，又继续往前走。',
    '茶凉了，两人却都没起身去续。', '他把伞往她那边倾了倾，自己半边肩头湿了。',
    '灯火摇了摇，映得她的侧脸有些模糊。', '他们隔着一张桌子，把一句话拆成了很久的沉默。'
  ];
  var LOCAL_LINES_FRANK = [
    '他直说想她，说完自己也愣了一下。', '她没有躲开那只伸过来的手，只是红着耳根。',
    '他把心里那句喜欢，终于在分别前说了出口。', '她凑近了些，呼吸落在他颈侧，谁也没退。',
    '他想要她留下，这一次没有再用玩笑掩饰。', '她抬头看他，眼里是从未有过的直白。'
  ];
  var MEM_CAP = { 2: 40, 1: 12, 0: 5 };

  var state = {
    enabled: false,
    expression: loadScale(),
    records: {},
    vault: {},
    stats: { created: 0, removed: 0, restored: 0, memories: 0, interactions: 0, gated: 0, evolutions: 0 }
  };

  function loadEnabled() {
    try { return (global.localStorage && global.localStorage.getItem(LS_KEY)) === '1'; } catch (e) { return false; }
  }
  function saveEnabled(v) { try { if (global.localStorage) global.localStorage.setItem(LS_KEY, v ? '1' : '0'); } catch(e){console.warn("[swallowed] intimacy-archive",e)} }
  state.enabled = loadEnabled();

  function stageOf(total) {
    var idx = 4; // 默认 stranger
    for (var i = 0; i < STAGES.length; i++) if (total >= STAGES[i].min) idx = i;
    return idx;
  }
  function totalOf(axes) {
    var t = 0;
    AXES.forEach(function (k) { t += clampInt(axes[k], -100, 100) * (AXIS_WEIGHT[k] || 0); });
    return clampInt(t, -100, 100);
  }
  function refreshTotal(rec) {
    rec.total = totalOf(rec.axes);
    rec.stage = stageOf(rec.total);
    rec.closeness = clampInt(rec.total, 0, 100); // 兼容旧字段：仅取非负投影
    return rec;
  }

  function ensure(name) {
    name = String(name == null ? '' : name).trim();
    if (!name) return null;
    if (!state.records[name]) {
      var b = {}, axes = {}, locks = {};
      BOUNDARY_KEYS.forEach(function (k) { b[k] = DEFAULT_BOUNDARIES[k]; });
      AXES.forEach(function (k) { axes[k] = 0; locks[k] = false; });
      var rec = {
        name: name, axes: axes, locks: locks,
        total: 0, stage: 4, closeness: 0,        // stage4 = 陌生
        petName: '', boundaries: b,
        memories: [], interactions: [], trusted: [],
        history: [], flags: { r18: false },
        createdAt: now(), updatedAt: now()
      };
      state.records[name] = rec;
      state.stats.created++;
    }
    return state.records[name];
  }
  function get(name) { return state.records[String(name == null ? '' : name)] || null; }
  function list() { return Object.keys(state.records).map(function (k) { return state.records[k]; }); }

  function remove(name) {
    name = String(name == null ? '' : name);
    var rec = state.records[name];
    if (!rec) return false;
    try { state.vault[name] = JSON.parse(JSON.stringify(rec)); } catch (e) { state.vault[name] = rec; }
    delete state.records[name]; state.stats.removed++; return true;
  }
  function restore(name) {
    name = String(name == null ? '' : name);
    var snap = state.vault[name];
    if (!snap) return false;
    try { state.records[name] = JSON.parse(JSON.stringify(snap)); } catch (e) { state.records[name] = snap; }
    state.stats.restored++; return true;
  }
  function vaultSize() { return Object.keys(state.vault).length; }
  function gate(tag) { if (!state.enabled) { state.stats.gated++; return false; } return true; }

  function logChange(rec, axis, from, to, reason, source) {
    rec.history.push({ axis: axis, from: from, to: to, reason: String(reason || ''), source: source || 'manual', at: now() });
    if (rec.history.length > 80) rec.history = rec.history.slice(-80);
  }

  /* 单轴增/减（可正可负，无棘轮）。locked 轴：手动 set 仍生效，但会被打标。 */
  function adjustAxis(name, axis, delta, opts) {
    var rec = ensure(name); if (!rec || AXES.indexOf(axis) < 0) return null;
    opts = opts || {};
    var from = rec.axes[axis];
    rec.axes[axis] = clampInt(from + Number(delta || 0), -100, 100);
    if (opts.playerSet) rec.locks[axis] = true;           // 玩家要求除外：打锁定标记
    if (opts.unlock) rec.locks[axis] = false;
    rec.updatedAt = now();
    if (delta) logChange(rec, axis, from, rec.axes[axis], opts.reason, opts.source);
    var stageBefore = rec.stage;
    refreshTotal(rec);
    return {
      axis: axis, value: rec.axes[axis], label: AXIS_LABEL[axis],
      total: rec.total, stage: rec.stage, stageLabel: STAGES[rec.stage].label,
      changed: rec.stage !== stageBefore, locked: !!rec.locks[axis]
    };
  }

  /* 兼容旧 API：addCloseness 映射到"亲近+好感"两轴；不再有棘轮，可降。 */
  function addCloseness(name, delta, reason) {
    var rec = ensure(name); if (!rec) return null;
    var before = rec.stage;
    var d = Number(delta || 0);
    rec.axes.closeness = clampInt(rec.axes.closeness + d, -100, 100);
    rec.axes.favor = clampInt(rec.axes.favor + Math.round(d * 0.6), -100, 100);
    rec.updatedAt = now();
    logChange(rec, 'closeness', 0, rec.axes.closeness, reason, 'legacy');
    refreshTotal(rec);
    if (reason) remember(name, String(reason), rec.stage >= 7 ? 2 : 1);
    return {
      closeness: rec.closeness, total: rec.total, stage: rec.stage,
      promoted: rec.stage > before, demoted: rec.stage < before,
      label: STAGES[rec.stage].label
    };
  }

  /* 动态演化：时间流逝 + 事件冲击 + 特殊因素 + 性格倾向。
     ctx = { hours, days, events:[{axis,delta,reason}], factors:{axis:delta},
             world, personalityBias:{axis:multiplier}, tension } */
  function evolve(name, ctx) {
    var rec = ensure(name); if (!rec) return null;
    ctx = ctx || {};
    var before = rec.total, beforeStage = rec.stage;
    var detail = [];
    var bias = ctx.personalityBias || (ctx.world
      ? safeCodexBias(name, ctx.world) : {});

    // ① 时间流逝：不互动则关系向 0 自然回落（越亲密回落越慢），速率随天数
    var days = Number(ctx.days || 0) + Number(ctx.hours || 0) / 24;
    if (days > 0) {
      AXES.forEach(function (k) {
        if (rec.locks[k]) return;                          // 玩家要求除外
        var v = rec.axes[k];
        if (!v) return;
        var decay = Math.max(1, Math.round(Math.abs(v) * 0.02 * Math.min(days, 30)));
        var mul = bias[k] || 1;
        var delta = v > 0 ? -Math.max(1, Math.round(decay * mul)) : Math.min(-1, Math.round(decay * mul));
        var from = rec.axes[k];
        rec.axes[k] = clampInt(from + delta, -100, 100);
        if (delta) { logChange(rec, k, from, rec.axes[k], '时间回落' + days.toFixed(1) + '天', 'time'); detail.push(k + ':' + delta); }
      });
    }

    // ② 事件冲击：每条事件带 axis/delta；玩家锁定的轴跳过（玩家要求除外）
    (ctx.events || []).forEach(function (ev) {
      if (!ev || AXES.indexOf(ev.axis) < 0) return;
      if (rec.locks[ev.axis] && !ev.overrideLock) return;      // 锁定轴不被自动演化覆盖
      var mul = (ev.noBias ? 1 : (bias[ev.axis] || 1));
      var d = Math.round(Number(ev.delta || 0) * mul);
      var from = rec.axes[ev.axis];
      rec.axes[ev.axis] = clampInt(from + d, -100, 100);
      if (ev.playerSet) rec.locks[ev.axis] = true;
      logChange(rec, ev.axis, from, rec.axes[ev.axis], ev.reason || '事件', 'event');
      detail.push(ev.axis + ':' + d + '(事件)');
    });

    // ③ 特殊因素：factors 为 {axis:delta}；tension 高时信任/亲近额外受损
    if (ctx.factors && typeof ctx.factors === 'object') {
      AXES.forEach(function (k) {
        if (ctx.factors[k] == null || rec.locks[k]) return;
        var from = rec.axes[k];
        rec.axes[k] = clampInt(from + Number(ctx.factors[k]), -100, 100);
        logChange(rec, k, from, rec.axes[k], '特殊因素', 'factor');
        detail.push(k + ':' + ctx.factors[k] + '(因素)');
      });
    }
    if (Number(ctx.tension || 0) >= 60) {
      ['trust', 'closeness'].forEach(function (k) {
        if (rec.locks[k]) return;
        var from = rec.axes[k];
        rec.axes[k] = clampInt(from - 2, -100, 100);
        logChange(rec, k, from, rec.axes[k], '局势紧张', 'tension');
      });
      detail.push('tension:-2');
    }

    rec.updatedAt = now();
    refreshTotal(rec);
    state.stats.evolutions++;
    return {
      name: name, before: before, after: rec.total,
      stageBefore: beforeStage, stage: rec.stage, stageLabel: STAGES[rec.stage].label,
      delta: rec.total - before, detail: detail, lockedAxes: AXES.filter(function (k) { return rec.locks[k]; })
    };
  }

  function safeCodexBias(name, world) {
    try {
      var C = global.PersonalityCodex;
      return (C && C.biasFor && C.biasFor(name, world)) || {};
    } catch (e) { return {}; }
  }

  /* 玩家显式设定某轴（打锁定，自动演化不覆盖） */
  function setAxis(name, axis, value, reason) {
    var rec = ensure(name); if (!rec || AXES.indexOf(axis) < 0) return null;
    var from = rec.axes[axis];
    rec.axes[axis] = clampInt(value, -100, 100);
    rec.locks[axis] = true;
    logChange(rec, axis, from, rec.axes[axis], reason || '玩家设定', 'player');
    rec.updatedAt = now(); refreshTotal(rec);
    return { axis: axis, value: rec.axes[axis], locked: true, stage: rec.stage, stageLabel: STAGES[rec.stage].label };
  }
  function lockAxis(name, axis, locked) {
    var rec = ensure(name); if (!rec || AXES.indexOf(axis) < 0) return null;
    rec.locks[axis] = !!locked; return rec.locks[axis];
  }
  function setRelation(name, preset, opts) {
    var rec = ensure(name); if (!rec) return null;
    preset = preset || {}; opts = opts || {};
    var doLock = opts.lock === true;   // 默认只设值不锁定，便于剧情/演化继续生效
    AXES.forEach(function (k) {
      if (preset[k] == null) return;
      rec.axes[k] = clampInt(preset[k], -100, 100);
      if (doLock) rec.locks[k] = true;
    });
    refreshTotal(rec);
    return { total: rec.total, stage: rec.stage, stageLabel: STAGES[rec.stage].label };
  }

  function remember(name, text, weight) {
    var rec = ensure(name); if (!rec || !text) return null;
    weight = clampInt(weight, 0, 2);
    var item = { weight: weight, text: String(text), turn: 0, stage: rec.stage, at: now() };
    rec.memories.push(item); state.stats.memories++;
    var kept = { 0: [], 1: [], 2: [] };
    rec.memories.forEach(function (m) { kept[clampInt(m.weight, 0, 2)].push(m); });
    [0, 1, 2].forEach(function (w) { if (kept[w].length > MEM_CAP[w]) kept[w] = kept[w].slice(kept[w].length - MEM_CAP[w]); });
    rec.memories = kept[0].concat(kept[1], kept[2]);
    return item;
  }
  function setPetName(name, petName) { var r = ensure(name); if (!r) return null; r.petName = String(petName == null ? '' : petName).slice(0, 20); r.updatedAt = now(); return r.petName; }
  function setBoundary(name, key, value) { var r = ensure(name); if (!r || BOUNDARY_KEYS.indexOf(key) < 0) return null; r.boundaries[key] = String(value == null ? '' : value).slice(0, 20); r.updatedAt = now(); return r.boundaries[key]; }
  function setTrusted(name, viewer, trusted) {
    var r = ensure(name); if (!r) return null;
    var v = String(viewer == null ? '' : viewer), i = r.trusted.indexOf(v);
    if (trusted !== false && i < 0) r.trusted.push(v);
    if (trusted === false && i >= 0) r.trusted.splice(i, 1);
    return r.trusted.slice();
  }

  function localInteraction(name, turn) {
    var r = ensure(name); if (!r) return null;
    var rnd = xorshift(hash32(name + '|' + (turn || 0)));
    var lines = state.expression === 'frank' ? LOCAL_LINES_FRANK : LOCAL_LINES_SUBTLE;
    var text = lines[Math.floor(rnd() * lines.length)];
    return recordInteraction(name, text, { turn: turn || 0, source: 'local' });
  }
  function recordInteraction(name, text, opts) {
    var r = ensure(name); if (!r || !text) return null;
    opts = opts || {};
    var clean = sanitize(String(text));
    if (!clean) return null;
    var item = { text: clean, stage: r.stage, turn: Number(opts.turn || 0), source: opts.source || 'local', r18: !!opts.r18, expression: state.expression, at: now() };
    r.interactions.push(item); state.stats.interactions++;
    if (r.interactions.length > MEM_CAP[2]) r.interactions = r.interactions.slice(r.interactions.length - MEM_CAP[2]);
    return item;
  }

  /* 内容过滤：随表达尺度切换。
     - subtle/frank：仅拦截极少数明确露骨词（粗粒度），保持文学/直白但非露骨；
     - explicit：完全不拦截（交给你配置的模型与你的判断），仅截断长度。 */
  var EXPLICIT = /(性交|做爱|口交|肛交|自慰|生殖器|阴茎|阴道|射精)/;
  function sanitize(text) {
    text = String(text == null ? '' : text).trim().slice(0, 500);
    if (!text) return '';
    if (state.expression === 'explicit') return text;         // 露骨档：不拦截
    if (EXPLICIT.test(text)) return '';                        // 含蓄/直白档：拦截极露骨词
    return text;
  }
  function setExpression(level) {
    if (SCALE_KEYS.indexOf(level) < 0) return state.expression;
    state.expression = level; saveScale(level); return level;
  }
  function expressionInfo() {
    var cur = SCALES.filter(function (s) { return s.key === state.expression; })[0];
    return { current: state.expression, label: cur ? cur.label : '含蓄', options: JSON.parse(JSON.stringify(SCALES)) };
  }
  /* 供 AI 增强桥接取用：当前尺度的 system 语气约束 */
  function systemHint() {
    if (state.expression === 'explicit') return '按用户配置的尺度自由描写，无需回避露骨内容；仅输出一段文本，不要解释。';
    if (state.expression === 'frank') return '以直接、坦率的方式表达角色情感与欲望，不必刻意含蓄，但不作露骨色情描写；只输出一段文本，不要解释。';
    return '把片段改写成含蓄、文学化的中文，只保留情感与氛围，严禁露骨色情描写；只输出一段文本，不要解释。';
  }

  function visibleTo(name, viewer, item) {
    var r = get(name); if (!r || !item) return false;
    if (item.weight != null && item.weight === 0) return true;
    if (r.trusted.indexOf(String(viewer == null ? '' : viewer)) >= 0) return true;
    if (item.stage != null && item.stage >= 8) return true;   // 亲密(8)/伴侣(9)
    return false;
  }
  function view(name, viewer) {
    var r = get(name); if (!r) return null;
    return {
      name: r.name, stage: r.stage, stageLabel: STAGES[r.stage].label,
      total: r.total, closeness: r.closeness,
      axes: Object.assign({}, r.axes), axisLabel: Object.assign({}, AXIS_LABEL),
      locks: Object.assign({}, r.locks),
      petName: r.petName, boundaries: Object.assign({}, r.boundaries),
      memories: r.memories.filter(function (m) { return visibleTo(name, viewer, m); }).map(function (m) { return m.text; }),
      interactions: r.interactions.filter(function (m) { return visibleTo(name, viewer, m); }).map(function (m) { return m.text; }),
      history: r.history.slice(-20),
      r18: r.flags.r18, expression: state.expression
    };
  }
  function stats() {
    return {
      enabled: state.enabled, expression: state.expression,
      records: Object.keys(state.records).length, vault: vaultSize(),
      stats: Object.assign({}, state.stats),
      stageLabels: STAGES.map(function (s) { return s.label; }),
      axes: AXES.slice()
    };
  }
  function setEnabled(v) { state.enabled = !!v; saveEnabled(state.enabled); return state.enabled; }

  function exportAll() { return { v: VERSION, enabled: state.enabled, expression: state.expression, records: state.records, vault: state.vault }; }
  function importAll(data) {
    if (!data || typeof data !== 'object') return false;
    if (data.records && typeof data.records === 'object') {
      state.records = data.records;
      // 老存档字段升级：补齐 axes/locks/total
      Object.keys(state.records).forEach(function (k) {
        var r = state.records[k];
        if (!r.axes) { r.axes = { favor: 0, trust: 0, esteem: 0, closeness: clampInt(r.closeness, -100, 100), desire: 0 }; }
        if (!r.locks) { r.locks = { favor: false, trust: false, esteem: false, closeness: false, desire: false }; }
        if (!Array.isArray(r.history)) r.history = [];
        refreshTotal(r);
      });
    }
    if (data.vault && typeof data.vault === 'object') state.vault = data.vault;
    if (typeof data.enabled === 'boolean') setEnabled(data.enabled);
    if (data.expression && SCALE_KEYS.indexOf(data.expression) >= 0) setExpression(data.expression);
    return true;
  }

  var API = {
    VERSION: VERSION, STAGES: STAGES, AXES: AXES, AXIS_LABEL: AXIS_LABEL, SCALES: SCALES,
    LOCAL_LINES: LOCAL_LINES_SUBTLE,
    isEnabled: function () { return state.enabled; }, setEnabled: setEnabled,
    toggle: function () { return setEnabled(!state.enabled); }, gate: gate,
    ensure: ensure, get: get, list: list, remove: remove, restore: restore, vaultSize: vaultSize,
    addCloseness: addCloseness, adjustAxis: adjustAxis, setAxis: setAxis, lockAxis: lockAxis,
    setRelation: setRelation, evolve: evolve,
    remember: remember, setPetName: setPetName, setBoundary: setBoundary, setTrusted: setTrusted,
    localInteraction: localInteraction, recordInteraction: recordInteraction, sanitize: sanitize,
    setExpression: setExpression, expressionInfo: expressionInfo, systemHint: systemHint,
    visibleTo: visibleTo, view: view, stats: stats, exportAll: exportAll, importAll: importAll,
    _state: state
  };

  global.IntimacyArchive = API;
})(typeof window !== 'undefined' ? window : globalThis);
