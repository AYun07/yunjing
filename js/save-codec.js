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

  function log() { try { if (window.YJ_DEBUG) console.debug('[SaveCodec]', ...arguments); } catch(e){console.warn("[swallowed] save-codec",e)} }

  /* ==================== gzip 压缩 / 解压 ==================== */
  function hasGzip() { return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined'; }

  /* v4.42.0 纯 JS gzip 解压兜底：老浏览器（无 DecompressionStream）也能导入 .json.gz 存档。
     实现完整 DEFLATE（stored/fixed/dynamic 三种块），无外部依赖；仅在原生不可用时走此路径。
     正确性由 test/gzip-fallback.mjs 用 Node zlib 生成的样本对比验证。 */
  function inflateGzip(u8) {
    var p = 0;
    if (u8.length < 18 || u8[p] !== 0x1f || u8[p + 1] !== 0x8b) throw new Error('not gzip');
    var flg = u8[p + 3]; p = 10;
    if (flg & 4) { var xlen = u8[p] | (u8[p + 1] << 8); p += 2 + xlen; }       /* FEXTRA */
    if (flg & 8) { while (p < u8.length && u8[p]) p++; p++; }                  /* FNAME */
    if (flg & 16) { while (p < u8.length && u8[p]) p++; p++; }                 /* FCOMMENT */
    if (flg & 2) { p += 2; }                                                   /* FHCRC */
    var bitpos = p * 8;
    function read(n) {
      var v = 0;
      for (var i = 0; i < n; i++) { v |= ((u8[bitpos >> 3] >> (bitpos & 7)) & 1) << i; bitpos++; }
      return v;
    }
    function align() { bitpos = (bitpos + 7) & ~7; }
    function buildHuff(lens) {
      var maxb = 0, i;
      for (i = 0; i < lens.length; i++) if (lens[i] > maxb) maxb = lens[i];
      if (!maxb) return { map: null, max: 0 };
      var counts = new Array(maxb + 1).fill(0);
      for (i = 0; i < lens.length; i++) if (lens[i]) counts[lens[i]]++;
      var first = new Array(maxb + 1).fill(0), code = 0;
      for (var len = 1; len <= maxb; len++) { code = (code + counts[len - 1]) << 1; first[len] = code; }
      var map = Object.create(null);
      for (var sym = 0; sym < lens.length; sym++) {
        var l = lens[sym]; if (!l) continue;
        var c = first[l]++;
        var rev = 0;
        for (var j = 0; j < l; j++) { rev = (rev << 1) | (c & 1); c >>>= 1; }
        map[(l << 16) | rev] = sym;
      }
      return { map: map, max: maxb };
    }
    function decode(h) {
      var acc = 0;
      for (var len = 1; len <= h.max; len++) {
        acc |= read(1) << (len - 1);
        var s = h.map[(len << 16) | acc];
        if (s !== undefined) return s;
      }
      throw new Error('invalid huffman code');
    }
    var LBASE = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
    var LEXT  = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
    var DBASE = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
    var DEXT  = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
    var CLORD = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
    var out = [];
    while (true) {
      var fin = read(1), type = read(2);
      if (type === 0) {
        align();
        var bp = bitpos >> 3;
        var len = u8[bp] | (u8[bp + 1] << 8);
        bp += 4;
        for (var i = 0; i < len; i++) out.push(u8[bp + i]);
        bitpos = (bp + len) * 8;
      } else if (type === 1 || type === 2) {
        var lit, dist;
        if (type === 1) {
          var ll = new Array(288).fill(0), i;
          for (i = 0; i <= 143; i++) ll[i] = 8;
          for (i = 144; i <= 255; i++) ll[i] = 9;
          for (i = 256; i <= 279; i++) ll[i] = 7;
          for (i = 280; i <= 287; i++) ll[i] = 8;
          lit = buildHuff(ll); dist = buildHuff(new Array(30).fill(5));
        } else {
          var hlit = read(5) + 257, hdist = read(5) + 1, hclen = read(4) + 4;
          var cl = new Array(19).fill(0);
          for (var i = 0; i < hclen; i++) cl[CLORD[i]] = read(3);
          var clh = buildHuff(cl), lens = [];
          while (lens.length < hlit + hdist) {
            var s = decode(clh), r, prev;
            if (s <= 15) lens.push(s);
            else if (s === 16) { r = read(2) + 3; prev = lens[lens.length - 1]; while (r--) lens.push(prev); }
            else if (s === 17) { r = read(3) + 3; while (r--) lens.push(0); }
            else if (s === 18) { r = read(7) + 11; while (r--) lens.push(0); }
          }
          lit = buildHuff(lens.slice(0, hlit)); dist = buildHuff(lens.slice(hlit, hlit + hdist));
        }
        while (true) {
          var sym = decode(lit);
          if (sym === 256) break;
          if (sym < 256) out.push(sym);
          else {
            var li = sym - 257;
            var length = LBASE[li] + read(LEXT[li]);
            var ds = decode(dist);
            var distance = DBASE[ds] + read(DEXT[ds]);
            for (var k = 0; k < length; k++) out.push(out[out.length - distance]);
          }
        }
      } else throw new Error('reserved deflate block');
      if (fin) break;
    }
    return new Uint8Array(out);
  }

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
      if (!hasGzip()) {
        /* v4.42.0：原生不可用走纯 JS 兜底，老浏览器也能导入 gzip 存档 */
        try { return new TextDecoder().decode(inflateGzip(u8)); }
        catch (e) { log('JS gzip 解压失败', e); throw new Error('gzip 存档解压失败，文件可能已损坏'); }
      }
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
    try { raw = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}') || {}; } catch(e){console.warn("[swallowed] save-codec",e)}
    try {
      var fwCfg = (window.storyFramework && window.storyFramework.apiConfig) || {};
      raw = Object.assign({}, raw, fwCfg);
    } catch(e){console.warn("[swallowed] save-codec",e)}
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
    try { cur = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}') || {}; } catch(e){console.warn("[swallowed] save-codec",e)}
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
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(next)); } catch(e){console.warn("[swallowed] save-codec",e)}
    /* 同步内存态：让当前会话立即生效，无需刷新 */
    try {
      var fw = window.storyFramework;
      if (fw) { fw.apiConfig = Object.assign({}, fw.apiConfig, next); if (typeof fw.loadApiConfig === 'function') fw.loadApiConfig(); }
    } catch(e){console.warn("[swallowed] save-codec",e)}
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
