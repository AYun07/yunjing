/* 云境 · 存档编解码 v1.0.0（v4.36.0 增量）
 * 职责：① 存档包 gzip 压缩/解压（浏览器原生 CompressionStream，无外部库）；
 *       ② 接口配置随存档采集/恢复（端点/模型随档走，密钥可选，避免每次重填）。
 * 纯前端、无上传、无后端。压缩后是标准 gzip 流，文件扩展名 .json.gz。
 * 旧版明文 .json 存档照常可导入（自动按首字节判断，不强制改格式）。 */
(function () {
  'use strict';

  var CONFIG_KEY = 'storyApiConfig';
  /* 配置里这些字段随存档走；密钥单列，由导出选项决定是否写入。 */
  var CFG_FIELDS = ['endpoint', 'model', 'type', 'maxTokens', 'temperature', 'topP',
    'contextSize', 'reasoningEffort', 'timeout', 'autoContinue', 'provider', 'baseUrl'];
  /* 安全闸门（DR-006）：endpoint/baseUrl 决定「正文发往哪台服务器」，
     属网络去向字段，导入外部存档时绝不采信档内值，防止恶意档把接口劫持到第三方。
     仅当本机从未配置过该项时才允许用档内值做首次引导。 */
  var NETWORK_FIELDS = ['endpoint', 'baseUrl'];

  function log() { try { if (window.YJ_DEBUG) console.debug('[SaveCodec]', ...arguments); } catch (e) {} }

  /* ==================== gzip 压缩 / 解压 ==================== */
  function hasGzip() { return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined'; }

  /** 把字符串压成 gzip Uint8Array；不支持时返回 null（调用方回退明文） */
  async function gzip(str) {
    if (!hasGzip()) return null;
    try {
      var bytes = new TextEncoder().encode(str);
      var cs = new CompressionStream('gzip');
      var stream = new Blob([bytes]).stream().pipeThrough(cs);
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch (e) { log('gzip 失败', e); return null; }
  }

  /** 解压 ArrayBuffer → 字符串；兼容 gzip 与明文 UTF-8 */
  async function gunzip(buf) {
    var u8 = new Uint8Array(buf);
    /* gzip 魔数 1f 8b */
    if (u8.length > 2 && u8[0] === 0x1f && u8[1] === 0x8b) {
      if (!hasGzip()) throw new Error('当前浏览器不支持解压 gzip 存档，请换 Chrome/Edge 新版');
      var ds = new DecompressionStream('gzip');
      var stream = new Blob([u8]).stream().pipeThrough(ds);
      return await new Response(stream).text();
    }
    /* 明文回退 */
    return new TextDecoder().decode(u8);
  }

  /* ==================== 配置采集 / 恢复 ==================== */
  /** 采集当前接口配置；includeKey=true 时明文带上 apiKey，否则留空占位 */
  function collectConfig(includeKey) {
    var raw = {};
    try { raw = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}') || {}; } catch (e) {}
    try {
      var fwCfg = (window.storyFramework && window.storyFramework.apiConfig) || {};
      raw = Object.assign({}, raw, fwCfg);
    } catch (e) {}
    var out = {};
    CFG_FIELDS.forEach(function (k) { if (raw[k] !== undefined && raw[k] !== null && raw[k] !== '') out[k] = raw[k]; });
    /* 密钥：显式勾选才带；否则记一个标记，导入端据此提示"需补填密钥" */
    out._keyIncluded = !!includeKey;
    out.apiKey = includeKey ? (raw.apiKey || '') : '';
    return out;
  }

  /** 恢复配置；返回 {applied:[...], keyRestored:boolean, keyNeeded:boolean} */
  function restoreConfig(cfg) {
    var result = { applied: [], keyRestored: false, keyNeeded: false, networkKept: false };
    if (!cfg || typeof cfg !== 'object') return result;
    var cur = {};
    try { cur = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}') || {}; } catch (e) {}
    var next = Object.assign({}, cur);
    CFG_FIELDS.forEach(function (k) {
      if (cfg[k] === undefined || cfg[k] === null || cfg[k] === '') return;
      /* 网络去向字段：本机已有值则保留本机，不被存档覆盖；本机为空才允许引导。 */
      if (NETWORK_FIELDS.indexOf(k) >= 0 && cur[k]) { result.networkKept = true; return; }
      next[k] = cfg[k]; result.applied.push(k);
    });
    /* 密钥：本机已有密钥始终优先，档内密钥只在 _keyIncluded 且本机为空时采用。 */
    if (cfg._keyIncluded && cfg.apiKey && !cur.apiKey) { next.apiKey = cfg.apiKey; result.keyRestored = true; }
    else if (!cur.apiKey) { result.keyNeeded = true; }
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(next)); } catch (e) {}
    /* 同步内存态：让当前会话立即生效，无需刷新 */
    try {
      var fw = window.storyFramework;
      if (fw) { fw.apiConfig = Object.assign({}, fw.apiConfig, next); if (typeof fw.loadApiConfig === 'function') fw.loadApiConfig(); }
    } catch (e) {}
    return result;
  }

  /* ==================== T07 · 长文档差分存档（本地双模，DR-004） ====================
   * 多分支场景：N 个分支共享一份基线对象，每个分支只存相对基线的「结构化字段增量」。
   * 逐叶子比较：数值变化只记数值，长文本叶子用字符前后缀增量——避免靠前一字段变化
   * 污染后面全部正文（v1 曾整体字符串 diff，chapter 一变导致差分包反超全量，已废弃）。
   * 逐字段精确还原（patchObj(base, diff(base,t)) 深度等于 t），保证回档一致。
   * 差分包是独立 format，导入端据此分派；旧明文 .json / 旧 gzip 一律走原路径，零破坏。 */
  function makeDelta(baseText, targetText) {
    var a = String(baseText == null ? '' : baseText);
    var b = String(targetText == null ? '' : targetText);
    var min = Math.min(a.length, b.length), p = 0;
    while (p < min && a.charAt(p) === b.charAt(p)) p++;
    var s = 0;
    while (s < min - p && a.charAt(a.length - 1 - s) === b.charAt(b.length - 1 - s)) s++;
    return { p: p, s: s, m: b.slice(p, b.length - s), len: a.length };
  }
  function applyDelta(baseText, d) {
    var a = String(baseText == null ? '' : baseText);
    if (!d || typeof d !== 'object') throw new Error('差分增量格式非法');
    return a.slice(0, d.p) + String(d.m == null ? '' : d.m) + a.slice(a.length - d.s);
  }
  function isDeltaPack(pkg) {
    return !!(pkg && pkg.format === 'delta' && pkg.baseObj && Array.isArray(pkg.branches));
  }
  /* 递归结构化 diff —— 逐叶子字段比较，避免「靠前一字段变化污染后面全部正文」。
     长字符串叶子（>=120 字）用字符前后缀增量；其余叶子直接记新值；
     对象递归公共键 + 增删；数组记长度 + 逐项。
     delta 形如 { "save.variables.chapter": {t:'v',v:121},
                  "save.variables.transcript": {t:'s',p:…,s:…,m:…} } */
  /* DR-009：键名可能含 . [ ] 等路径元字符，拼接时转义，避免 diff 路径被误拆
     （如键 'a.b' 会被 parseSegments 拆成 a→b 两段而还原失败）。旧包无转义，照常解析。 */
  function escKey(k) { return String(k).replace(/([.\[\]\\])/g, '\\$1'); }
  function diffValue(a, b, path, out) {
    if (a === b) return;
    var oa = (a !== null && typeof a === 'object');
    var ob = (b !== null && typeof b === 'object');
    if (!oa || !ob || Array.isArray(a) !== Array.isArray(b)) {
      if (typeof a === 'string' && typeof b === 'string' && (a.length >= 120 || b.length >= 120)) {
        out[path] = Object.assign({ t: 's' }, makeDelta(a, b));
      } else {
        out[path] = { t: 'v', v: b === undefined ? null : b };
      }
      return;
    }
    if (Array.isArray(a)) {
      if (a.length !== b.length) out[path + '#len'] = b.length;
      /* 只比对目标仍存在的索引：超出新长度的尾部由 #len 截断处理，避免写出无效项 */
      var n = Math.max(a.length, b.length);
      for (var i = 0; i < n && i < b.length; i++) diffValue(a[i], b[i], path + '[' + i + ']', out);
      return;
    }
    var keys = {};
    Object.keys(a).forEach(function (k) { keys[k] = 1; });
    Object.keys(b).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).forEach(function (k) {
      var kp = path ? path + '.' + escKey(k) : escKey(k);
      /* 目标缺失的键标记为删除；目标新增的键直接记值 */
      if (!(k in b)) { out[kp] = { t: 'd' }; return; }
      if (!(k in a)) { out[kp] = { t: 'v', v: b[k] }; return; }
      diffValue(a[k], b[k], kp, out);
    });
  }
  function parseSegments(path) {
    var segs = [], cur = '', i = 0;
    while (i < path.length) {
      var ch = path.charAt(i);
      /* 反斜杠转义：下一个字符按字面量收入当前段，不作分隔符解释 */
      if (ch === '\\' && i + 1 < path.length) { cur += path.charAt(i + 1); i += 2; continue; }
      if (ch === '[') {
        if (cur) { segs.push(cur); cur = ''; }
        var j = path.indexOf(']', i);
        segs.push(parseInt(path.slice(i + 1, j), 10)); i = j + 1;
      } else if (ch === '.') { if (cur) { segs.push(cur); cur = ''; } i++; }
      else { cur += ch; i++; }
    }
    if (cur) segs.push(cur);
    return segs;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  /** 把 delta 应用回基线对象，逐字段还原 */
  function patchObj(baseObj, delta) {
    var root = clone(baseObj);
    var paths = Object.keys(delta);
    /* 普通字段先应用，数组长度截断（#len）最后统一处理，杜绝顺序依赖 */
    paths.forEach(function (path) {
      if (path.slice(-4) === '#len') return;
      var d = delta[path], segs = parseSegments(path), cur = root;
      for (var k = 0; k < segs.length - 1; k++) {
        if (cur == null) return;
        cur = cur[segs[k]];
      }
      if (cur == null) return;
      var last = segs[segs.length - 1];
      if (d.t === 'd') { delete cur[last]; return; }       // 删除键
      cur[last] = (d.t === 's') ? applyDelta(cur[last], d) : d.v;
    });
    paths.forEach(function (path) {
      if (path.slice(-4) !== '#len') return;
      var segs = parseSegments(path.slice(0, -4)), arr = root;
      for (var i = 0; i < segs.length; i++) {
        if (arr == null) return;
        arr = arr[segs[i]];
      }
      if (Array.isArray(arr)) arr.length = delta[path];
    });
    return root;
  }
  /** branches: [{id, meta, obj}] → 差分包对象（基线取第 0 支全文，其余支存结构化增量） */
  function makeBranchPack(branches) {
    branches = (Array.isArray(branches) ? branches : []).filter(Boolean);
    if (!branches.length) throw new Error('没有可打包的分支');
    var baseObj = branches[0].obj === undefined ? branches[0] : branches[0].obj;
    var out = {
      app: 'yunjing', format: 'delta', dv: '2.0', ver: '4.36.0',
      baseObj: baseObj,
      branches: branches.map(function (br, i) {
        var obj = br.obj === undefined ? br : br.obj;
        var item = { id: br.id != null ? br.id : ('branch' + i), meta: br.meta || {} };
        var delta = {};
        diffValue(baseObj, obj, '', delta);
        item.delta = Object.keys(delta).length ? delta : null;
        return item;
      })
    };
    return out;
  }
  /** 从差分包还原第 index 支的完整对象 → {id, meta, obj} */
  function unpackBranch(pack, index) {
    if (!isDeltaPack(pack)) throw new Error('不是差分存档包');
    if (!pack.baseObj) throw new Error('差分包缺少基线对象（旧版 v1 包不兼容，请用全量存档）');
    var br = pack.branches[index];
    if (!br) throw new Error('分支不存在');
    var obj = br.delta ? patchObj(pack.baseObj, br.delta) : clone(pack.baseObj);
    return { id: br.id, meta: br.meta || {}, obj: obj };
  }

  window.SaveCodec = {
    version: '1.1.0',
    hasGzip: hasGzip,
    gzip: gzip,
    gunzip: gunzip,
    collectConfig: collectConfig,
    restoreConfig: restoreConfig,
    makeDelta: makeDelta,
    applyDelta: applyDelta,
    isDeltaPack: isDeltaPack,
    makeBranchPack: makeBranchPack,
    unpackBranch: unpackBranch,
    CONFIG_KEY: CONFIG_KEY
  };
})();
