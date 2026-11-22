/* ============================================================
 * 云境 · 增量补丁内核 v1.0（v6.5.0）
 * ------------------------------------------------------------
 * 纯函数，无 DOM、无 IO、无第三方依赖。Node 与浏览器通用。
 * 职责：
 *   - hash / 内容项 / 基线清单
 *   - diff(base,target) 算改动（add/modify/delete）
 *   - plan(base,ours,theirs) 三方处置（sync/overwrite/keep/merge/conflict）
 *   - merge3 字段级合并
 *   - 备份快照 + 应用 + 回滚（固定上限防膨胀）
 *   - versionCheck 版本一致性检查
 *   - suggestVolumes 分卷建议
 * 版权：云境独立实现，无第三方源码。
 * ============================================================ */
(function () {
  'use strict';
  var PE = {};

  var TOMB = '__YJ_TOMBSTONE__';
  var MAX_BACKUPS = 10;

  /* ---------- FNV-1a 32 位哈希（快、纯前端、够用；非加密） ---------- */
  function hash(str) {
    str = str == null ? '' : String(str);
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
  PE.hash = hash;
  PE.TOMB = TOMB;

  /* ---------- 内容项构造 ---------- */
  function item(key, kind, data) {
    data = data == null ? '' : String(data);
    return { key: key, kind: kind || 'content', data: data, hash: hash(data), size: data.length };
  }
  PE.item = item;

  /** 基线清单：从内容项数组抽取 {key,kind,hash} */
  function baseline(ver, items) {
    return {
      app: 'yunjing', ver: ver || 'unknown',
      items: (items || []).map(function (it) { return { key: it.key, kind: it.kind, hash: it.hash }; })
    };
  }
  PE.baseline = baseline;

  /** 清单 → key->{hash,kind} 映射 */
  function toMap(list) {
    var m = {};
    (list || []).forEach(function (it) { m[it.key] = { hash: it.hash, kind: it.kind, data: it.data }; });
    return m;
  }
  PE.toMap = toMap;

  /* ---------- diff：base → target 的改动清单 ---------- */
  /** 返回 [{op:'add'|'modify'|'delete', key, kind, baseHash, newHash}] */
  function diff(baseList, targetList) {
    var b = toMap(baseList), t = toMap(targetList), out = [];
    var keys = {};
    Object.keys(b).forEach(function (k) { keys[k] = 1; });
    Object.keys(t).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).sort().forEach(function (k) {
      var bi = b[k], ti = t[k];
      if (!bi && ti) out.push({ op: 'add', key: k, kind: ti.kind, baseHash: '', newHash: ti.hash });
      else if (bi && !ti) out.push({ op: 'delete', key: k, kind: bi.kind, baseHash: bi.hash, newHash: '' });
      else if (bi && ti && bi.hash !== ti.hash) out.push({ op: 'modify', key: k, kind: ti.kind || bi.kind, baseHash: bi.hash, newHash: ti.hash });
    });
    return out;
  }
  PE.diff = diff;

  /* ---------- merge3：字段级三方合并 ---------- */
  /** 仅对可解析 JSON 对象逐键递归；数组/标量原子处理。返回 {ok,value,conflictKeys} */
  function merge3(baseStr, oursStr, theirsStr) {
    var b, o, t, parsed = true;
    try { b = baseStr === TOMB ? null : JSON.parse(baseStr); } catch (e) { parsed = false; }
    try { o = oursStr === TOMB ? null : JSON.parse(oursStr); } catch (e) { parsed = false; }
    try { t = theirsStr === TOMB ? null : JSON.parse(theirsStr); } catch (e) { parsed = false; }
    // 原子值：任一方是数组/非对象/无法解析 → 整体比较
    function isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }
    if (!parsed || !isObj(b) || !isObj(o) || !isObj(t)) {
      if (oursStr === theirsStr) return { ok: true, value: oursStr, conflictKeys: [] };
      return { ok: false, value: null, conflictKeys: ['(whole)'] };
    }
    var conflicts = [], result = {}, keys = {};
    [b, o, t].forEach(function (obj) { Object.keys(obj).forEach(function (k) { keys[k] = 1; }); });
    Object.keys(keys).forEach(function (k) {
      var bv = b[k], ov = o[k], tv = t[k];
      var bHas = Object.prototype.hasOwnProperty.call(b, k);
      var oHas = Object.prototype.hasOwnProperty.call(o, k);
      var tHas = Object.prototype.hasOwnProperty.call(t, k);
      var bs = bHas ? safeStr(bv) : TOMB, os = oHas ? safeStr(ov) : TOMB, ts = tHas ? safeStr(tv) : TOMB;
      if (os === ts) { if (oHas) result[k] = ov; return; }
      if (os === bs) { if (tHas) result[k] = tv; return; }
      if (ts === bs) { if (oHas) result[k] = ov; return; }
      // 双方都相对 base 改了，且互不相同：尝试递归合并嵌套对象
      if (isObj(bv) && isObj(ov) && isObj(tv)) {
        var sub = merge3(safeStr(bv), safeStr(ov), safeStr(tv));
        if (sub.ok) { result[k] = JSON.parse(sub.value); return; }
      }
      conflicts.push(k);
    });
    if (conflicts.length) return { ok: false, value: null, conflictKeys: conflicts };
    return { ok: true, value: JSON.stringify(result), conflictKeys: [] };
  }
  function safeStr(v) {
    if (v === undefined) return TOMB;
    return (typeof v === 'string') ? v : JSON.stringify(v);
  }
  PE.merge3 = merge3;

  /* ---------- plan：三方处置 ---------- */
  /**
   * base/ours/theirs 均为内容项数组（或 key→{hash,data} 映射）。
   * 返回 decisions[]：{ key, kind, action, ours, theirs, merged, conflictKeys }
   */
  function plan(baseList, oursList, theirsList) {
    var b = toMap(baseList), o = toMap(oursList), t = toMap(theirsList);
    var keys = {};
    [b, o, t].forEach(function (m) { Object.keys(m).forEach(function (k) { keys[k] = 1; }); });
    var out = [];
    Object.keys(keys).sort().forEach(function (k) {
      var bh = b[k] ? b[k].hash : TOMB;
      var oh = o[k] ? o[k].hash : TOMB;
      // 稀疏补丁语义：theirs 里没提到的 key = 作者未涉及 = 沿用基线（不是删除！）。
      // 真正的删除以显式 tombstone 项存在，其 hash=hash(TOMB)，会与 bh 不同。
      var tHas = Object.prototype.hasOwnProperty.call(t, k);
      var th = tHas ? t[k].hash : bh;
      var kind = (t[k] && t[k].kind) || (o[k] && o[k].kind) || (b[k] && b[k].kind) || 'content';
      var od = o[k] && o[k].data != null ? o[k].data : (oh === TOMB ? TOMB : '');
      var td = tHas && t[k].data != null ? t[k].data : (th === TOMB ? TOMB : (b[k] && b[k].data != null ? b[k].data : ''));
      var d = { key: k, kind: kind, action: '', ours: od, theirs: td, merged: null, conflictKeys: [] };

      if (oh === th) {
        d.action = 'sync';
      } else if (oh === bh && th !== bh) {
        d.action = 'overwrite';
      } else if (th === bh) {
        d.action = 'keep';
      } else if (oh !== bh && th !== bh && oh !== th) {
        var m = merge3(
          b[k] && b[k].data != null ? b[k].data : (bh === TOMB ? TOMB : ''),
          od, td
        );
        if (m.ok) { d.action = 'merge'; d.merged = m.value; }
        else { d.action = 'conflict'; d.conflictKeys = m.conflictKeys; }
      } else {
        d.action = 'conflict';
      }
      out.push(d);
    });
    return out;
  }
  PE.plan = plan;

  /** 仅统计各处置数量，便于预览 */
  function summarize(decisions) {
    var s = { sync: 0, overwrite: 0, keep: 0, merge: 0, conflict: 0, total: decisions.length };
    decisions.forEach(function (d) { if (s[d.action] != null) s[d.action]++; });
    return s;
  }
  PE.summarize = summarize;

  /* ---------- 备份 / 应用 / 回滚 ---------- */
  /** 生成备份快照，仅收录会被改写的 key（overwrite/merge/conflict 需人工，先不备份） */
  function makeBackup(decisions, tag) {
    var entries = [];
    decisions.forEach(function (d) {
      if (d.action === 'overwrite' || d.action === 'merge') {
        entries.push({ key: d.key, kind: d.kind, oldData: d.ours, newData: d.action === 'merge' ? d.merged : d.theirs });
      }
    });
    return { at: Date.now(), tag: tag || '', entries: entries };
  }
  PE.makeBackup = makeBackup;

  /** 待应用的操作序列（供 adapter 执行；sync/keep/conflict 不动） */
  function applyList(decisions, resolutions) {
    resolutions = resolutions || {}; // key -> 'ours' | 'theirs'（解决 conflict 用）
    var ops = [];
    decisions.forEach(function (d) {
      if (d.action === 'overwrite') ops.push({ key: d.key, kind: d.kind, op: 'write', data: d.theirs });
      else if (d.action === 'merge') ops.push({ key: d.key, kind: d.kind, op: 'write', data: d.merged });
      else if (d.action === 'sync') { /* 已一致，跳过 */ }
      else if (d.action === 'keep') { /* 保留本地 */ }
      else if (d.action === 'conflict') {
        var pick = resolutions[d.key];
        if (pick === 'theirs') ops.push({ key: d.key, kind: d.kind, op: 'write', data: d.theirs });
        else if (pick === 'ours') { /* 保留本地 */ }
        // 未裁决的冲突不落地
      }
    });
    return ops;
  }
  PE.applyList = applyList;

  /** 回滚操作序列：把备份里的 key 写回 oldData */
  function rollbackList(backup) {
    return (backup && backup.entries || []).map(function (e) {
      return { key: e.key, kind: e.kind, op: 'write', data: e.oldData };
    });
  }
  PE.rollbackList = rollbackList;

  /** 备份栈：push 后裁剪到 MAX_BACKUPS，返回新栈 */
  function pushBackup(stack, backup) {
    var s = (stack || []).concat([backup]);
    return s.length > MAX_BACKUPS ? s.slice(s.length - MAX_BACKUPS) : s;
  }
  PE.pushBackup = pushBackup;

  /* ---------- 版本一致性检查 ---------- */
  function versionCheck(baseVer, ourVer, targetVer) {
    var bv = verNum(baseVer), ov = verNum(ourVer), tv = verNum(targetVer);
    if (baseVer === ourVer || (bv && ov && bv === ov)) return { level: 'ok', msg: '基于同版本，可直接同步' };
    if (tv && ov && tv <= ov) return { level: 'warn', msg: '该补丁基于旧版云境（' + baseVer + '），你当前 ' + ourVer + '，建议核对差异' };
    if (tv && ov && tv - ov >= 10) return { level: 'warn', msg: '补丁目标版本（' + targetVer + '）高于你当前版本（' + ourVer + '）较多，建议先升级云境' };
    return { level: 'warn', msg: '补丁基于 ' + baseVer + '，你当前 ' + ourVer + '，安装前请查看差异' };
  }
  function verNum(v) {
    var m = String(v || '').match(/(\d+)\.(\d+)\.(\d+)/);
    return m ? (parseInt(m[1], 10) * 10000 + parseInt(m[2], 10) * 100 + parseInt(m[3], 10)) : 0;
  }
  PE.versionCheck = versionCheck;

  /* ---------- 分卷建议 ---------- */
  function suggestVolumes(totalBytes, limit) {
    limit = limit || 90 * 1024 * 1024; // 90MB，给 base64 膨胀留余量（100MB 硬顶）
    var count = Math.max(1, Math.ceil((totalBytes || 0) / limit));
    return { count: count, needSplit: count > 1, overCap: count > 32, limit: limit };
  }
  PE.suggestVolumes = suggestVolumes;

  /* ---------- 密钥扫描与剔除（存档默认剥离） ---------- */
  var KEY_PAT = /(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9]{16,}|api[_-]?key\s*[:=]\s*['"][^'"]{8,}|(Authorization\s*[:=]\s*['"]?Bearer))/i;
  function scanSecrets(items) {
    var bad = [];
    (items || []).forEach(function (it) {
      var s = (it && it.data != null) ? String(it.data) : '';
      if (s && KEY_PAT.test(s)) bad.push(it.key);
    });
    return bad;
  }
  PE.scanSecrets = scanSecrets;

  /** 剔除 JSON 文本里的密钥类字段（递归）；非 JSON 原文命中整项作废返回 null */
  function stripSecrets(data) {
    var obj;
    try { obj = JSON.parse(data); } catch (e) { return KEY_PAT.test(String(data)) ? null : data; }
    var KEYNAME = /(api[_-]?key|token|secret|password|authorization|Bearer)/i;
    function walk(x) {
      if (Array.isArray(x)) return x.map(walk);
      if (x && typeof x === 'object') {
        var o = {};
        Object.keys(x).forEach(function (k) { if (!KEYNAME.test(k)) o[k] = walk(x[k]); });
        return o;
      }
      if (typeof x === 'string' && KEY_PAT.test(x)) return '[REDACTED]';
      return x;
    }
    return JSON.stringify(walk(obj));
  }
  PE.stripSecrets = stripSecrets;

  /* ============================================================
   * v6.5.1 四段式正文（唯一区域 schema 3）
   * 四段固定顺序：简介 / 特点 / 二创内容 / 打包源码。
   * 纯字符串编解码，不依赖 DOM。老作品无 YJ_V2 标记 → parse 返回 null，
   * 由上层回退到单段 note。
   * ============================================================ */
  var TAG = {
    intro:   ['<!--YJ_INTRO-->',   '<!--/YJ_INTRO-->'],
    feature: ['<!--YJ_FEATURE-->', '<!--/YJ_FEATURE-->'],
    content: ['<!--YJ_CONTENT-->', '<!--/YJ_CONTENT-->'],
    pkg:     ['<!--YJ_PACKAGE-->', '<!--/YJ_PACKAGE-->']
  };
  function escBody(s) { return String(s == null ? '' : s).replace(/-->/g, '--&gt;'); }
  function unescBody(s) { return String(s == null ? '' : s).replace(/--&gt;/g, '-->'); }
  function wrap(tag, text) { return '## ' + LABEL_ZH[tag] + '\n' + TAG[tag][0] + escBody(text) + TAG[tag][1]; }
  var LABEL_ZH = { intro: '简介', feature: '特点', content: '二创内容', pkg: '打包源码' };

  /** 组装四段式正文。f = {title,intro,feature,content,pkg}；pkg 可为对象，自动 JSON 化 */
  function buildFourSectionBody(f) {
    f = f || {};
    var pkg = f.pkg;
    if (pkg && typeof pkg === 'object') pkg = JSON.stringify(pkg);
    return '<!--YJ_V2-->\n' +
      wrap('intro', f.intro || '') + '\n\n' +
      wrap('feature', f.feature || '') + '\n\n' +
      wrap('content', f.content || '') + '\n\n' +
      wrap('pkg', pkg || '') + '\n' +
      '<!--/YJ_V2-->';
  }
  PE.buildFourSectionBody = buildFourSectionBody;

  function seg(body, tag) {
    var m = String(body || '').match(new RegExp(TAG[tag][0] + '([\\s\\S]*?)' + TAG[tag][1]));
    return m ? unescBody(m[1].trim()) : null;
  }
  /** 解析四段式正文；无 YJ_V2 标记返回 null（触发上层回退） */
  function parseFourSectionBody(body) {
    body = String(body || '');
    if (body.indexOf('<!--YJ_V2-->') < 0) return null;
    var pkgRaw = seg(body, 'pkg');
    var pkg = pkgRaw;
    if (pkgRaw) { try { pkg = JSON.parse(pkgRaw); } catch (e) { /* 保留原文 */ } }
    return {
      intro:   seg(body, 'intro') || '',
      feature: seg(body, 'feature') || '',
      content: seg(body, 'content') || '',
      pkg:     pkg || null,
      pkgText: pkgRaw || ''
    };
  }
  PE.parseFourSectionBody = parseFourSectionBody;

  /** 四段完整性校验：四段都必须非空。返回 {ok, missing:[中文段名]} */
  function validateFourSection(f) {
    f = f || {};
    var missing = [];
    if (!String(f.intro || '').trim()) missing.push(LABEL_ZH.intro);
    if (!String(f.feature || '').trim()) missing.push(LABEL_ZH.feature);
    if (!String(f.content || '').trim()) missing.push(LABEL_ZH.content);
    var pkg = f.pkg;
    if (pkg && typeof pkg === 'object') {
      // 空对象视同未打包（没有任何实质字段）
      pkg = Object.keys(pkg).length ? JSON.stringify(pkg) : '';
    }
    if (!String(pkg || '').trim()) missing.push(LABEL_ZH.pkg);
    return { ok: missing.length === 0, missing: missing };
  }
  PE.validateFourSection = validateFourSection;
  PE.FOUR_LABELS = LABEL_ZH;

  globalThis.PatchEngine = PE;
  if (typeof module !== 'undefined' && module.exports) module.exports = PE;
})();
