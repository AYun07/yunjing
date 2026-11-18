/* 云境 · 存档编解码 v1.0.0（v4.34.0 增量）
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

  function log() { try { if (window.YJDebug) console.debug('[SaveCodec]', ...arguments); } catch (e) {} }

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
    var result = { applied: [], keyRestored: false, keyNeeded: false };
    if (!cfg || typeof cfg !== 'object') return result;
    var cur = {};
    try { cur = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}') || {}; } catch (e) {}
    var next = Object.assign({}, cur);
    CFG_FIELDS.forEach(function (k) {
      if (cfg[k] !== undefined && cfg[k] !== null && cfg[k] !== '') { next[k] = cfg[k]; result.applied.push(k); }
    });
    if (cfg._keyIncluded && cfg.apiKey) { next.apiKey = cfg.apiKey; result.keyRestored = true; }
    else if (!cur.apiKey) { result.keyNeeded = true; }
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(next)); } catch (e) {}
    /* 同步内存态：让当前会话立即生效，无需刷新 */
    try {
      var fw = window.storyFramework;
      if (fw) { fw.apiConfig = Object.assign({}, fw.apiConfig, next); if (typeof fw.loadApiConfig === 'function') fw.loadApiConfig(); }
    } catch (e) {}
    return result;
  }

  window.SaveCodec = {
    version: '1.0.0',
    hasGzip: hasGzip,
    gzip: gzip,
    gunzip: gunzip,
    collectConfig: collectConfig,
    restoreConfig: restoreConfig,
    CONFIG_KEY: CONFIG_KEY
  };
})();
