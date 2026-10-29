/* ============================================================
 * 云境 · 正则导入 / 替换层 regex-io.js（v3.51.0）
 * ------------------------------------------------------------
 * 玩家从 SillyTavern 导出的「正则扩展」可以直接整份导入，替换内置那 45 条；
 * 也随时能一键回到内置版。逐条开关仍走原有面板（catalog/overrides）。
 *
 * 兼容三种输入：
 *   A. ST 单条导出：{scriptName, findRegex, replaceString, ...}
 *   B. ST 批量导出：{regex_scripts:[...]} 或直接 [...]
 *   C. 云境自有格式（结构与 A 同，带 id）
 *
 * 生效语义（与内置一致，避免两套规则打架）：
 *   · 导入的正则一律按「正文文本替换」处理（相当于内置的 purge 类）；
 *   · 替换结果若含受控 HTML，正文会按白名单渲染（见 ai-response-handler 的 formatProse）；
 *   · <style> 段会被剥离 —— ST 那套内联赛博朋克样式不会带过来，视觉仍跟云境皮肤。
 * ============================================================ */
(function () {
  'use strict';

  var K_CUSTOM = 'yunjingRegexCustom';
  var K_SRC = 'yunjingRegexSrc';

  function LS() {
    return (window.MoStore && typeof window.MoStore.getItem === 'function') ? window.MoStore : window.localStorage;
  }
  function get(k) { try { return LS().getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { LS().setItem(k, v); return true; } catch (e) { return false; } }
  function del(k) { try { LS().removeItem(k); return true; } catch (e) { return false; } }

  function str(v) { return v == null ? '' : String(v); }

  function hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  function normalize(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('不是有效的 JSON');
    var list = null;
    if (Array.isArray(raw)) list = raw;
    else if (Array.isArray(raw.regex_scripts)) list = raw.regex_scripts;
    else if (Array.isArray(raw.scripts)) list = raw.scripts;
    /* v3.55.5 适配：ST「预设导出」把正则嵌在 extensions.regex_scripts 里
       （双人成行/夏瑾/Reborn/Kemini 四套实测皆此形态）——预设文件直接丢进
       「导入正则」也能吃下，不必先手工拆包 */
    else if (raw.extensions && Array.isArray(raw.extensions.regex_scripts)) list = raw.extensions.regex_scripts;
    else if (raw.extensions && Array.isArray(raw.extensions.regex)) list = raw.extensions.regex;
    else if (raw.findRegex || raw.find) list = [raw];
    if (!list || !list.length) throw new Error('没找到 regex_scripts 数组（SillyTavern「正则」导出应为该结构）');

    var out = [];
    var seen = {};
    list.forEach(function (r, i) {
      if (!r) return;
      var find = str(r.findRegex || r.find || '');
      if (!find) return;
      var name = str(r.scriptName || r.name || ('自定义正则 ' + (i + 1))).slice(0, 60);
      var id = 'rx_' + hash(find + '|' + name);
      if (seen[id]) id += '_' + i;
      seen[id] = 1;
      out.push({
        id: id,
        scriptName: name,
        findRegex: find,
        replaceString: str(r.replaceString == null ? '' : r.replaceString),
        placement: Array.isArray(r.placement) ? r.placement : null,
        disabled: r.disabled === true,
        markdownOnly: !!r.markdownOnly,
        promptOnly: !!r.promptOnly,
        trimStrings: Array.isArray(r.trimStrings) ? r.trimStrings : [],
        _custom: true
      });
    });
    if (!out.length) throw new Error('正则条目为空，或缺 findRegex');
    return out;
  }

  var _cache = null, _cacheRaw = null;

  function active() {
    var raw = get(K_CUSTOM);
    if (!raw) return null;
    if (_cache && _cacheRaw === raw) return _cache;
    try {
      _cache = normalize(JSON.parse(raw));
      _cacheRaw = raw;
      return _cache;
    } catch (e) {
      console.warn('[RegexIO] 自定义正则解析失败，已回退内置：', e.message);
      return null;
    }
  }

  function info() {
    var a = active();
    if (a) {
      var m = {};
      try { m = JSON.parse(get(K_SRC) || '{}'); } catch (e) { }
      return { source: 'custom', count: a.length, file: m.file || '', at: m.at || 0 };
    }
    var b = window.YUNQI_REGEX || window.MIAOMIAO_REGEX || [];
    return { source: 'builtin', count: b.length, file: '', at: 0 };
  }

  function importText(text, fileName) {
    var obj;
    try { obj = JSON.parse(text); } catch (e) { throw new Error('JSON 解析失败：' + e.message); }
    var list = normalize(obj);                    // 先校验
    var payload = JSON.stringify(list);
    if (!set(K_CUSTOM, payload)) throw new Error('写入本地存储失败（可能空间已满）');
    set(K_SRC, JSON.stringify({ count: list.length, file: fileName || '', at: Date.now() }));
    try { window.MoMiaomiaoRegex && window.MoMiaomiaoRegex.clearOverrides && window.MoMiaomiaoRegex.clearOverrides(); } catch (e) { }
    _cache = null; _cacheRaw = null;
    return info();
  }

  function importFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file) return reject(new Error('没有选择文件'));
      if (file.size > 4 * 1024 * 1024) return reject(new Error('文件过大'));
      var r = new FileReader();
      r.onerror = function () { reject(new Error('文件读取失败')); };
      r.onload = function () {
        try { resolve(importText(String(r.result || ''), file.name)); }
        catch (e) { reject(e); }
      };
      r.readAsText(file, 'utf-8');
    });
  }

  function useBuiltin() {
    del(K_CUSTOM); del(K_SRC);
    try { window.MoMiaomiaoRegex && window.MoMiaomiaoRegex.clearOverrides && window.MoMiaomiaoRegex.clearOverrides(); } catch (e) { }
    _cache = null; _cacheRaw = null;
    return info();
  }

  function exportCurrent() {
    var a = active() || window.YUNQI_REGEX || window.MIAOMIAO_REGEX || [];
    return JSON.stringify({ regex_scripts: a }, null, 1);
  }

  window.YunjingRegexIO = {
    normalize: normalize,
    active: active,
    info: info,
    importText: importText,
    importFile: importFile,
    useBuiltin: useBuiltin,
    exportCurrent: exportCurrent
  };
})();
