/* ============================================================
 * 云境 · 预设导入 / 替换 / 编辑层 preset-io.js（v3.51.0）
 * ------------------------------------------------------------
 * 目标（按玩家要求）：
 *   1) 以后有新的 SillyTavern 预设 → 直接导入，整份替换内置咩咩预设；
 *   2) 每一条预设提示词都能改（默认版永远留着，一键还原）；
 *   3) 导入失败要说清哪一步不对，绝不半途覆盖掉能用的旧预设。
 *
 * 兼容三种输入：
 *   A. SillyTavern 预设导出（{prompts, prompt_order} 或 {prompts, order}）
 *   B. 云境自有格式（{name, version, prompts, order}）
 *   C. 只有 prompts 数组的裸 JSON
 *
 * 存储：localStorage / MoStore
 *   yunjingPresetCustom  导入的整份预设（JSON 字符串）
 *   yunjingPresetSrc     来源信息 {name, version, blocks, chars, at, file}
 *   yunjingPresetEdits   {identifier: 改后的正文}（只存改过的条目）
 * ============================================================ */
(function () {
  'use strict';

  var K_CUSTOM = 'yunjingPresetCustom';
  var K_SRC = 'yunjingPresetSrc';
  var K_EDITS = 'yunjingPresetEdits';

  function LS() {
    return (window.MoStore && typeof window.MoStore.getItem === 'function') ? window.MoStore : window.localStorage;
  }
  function get(k) { try { return LS().getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { LS().setItem(k, v); return true; } catch (e) { return false; } }
  function del(k) { try { LS().removeItem(k); return true; } catch (e) { return false; } }

  var _cache = null;      // 归一化后的自定义预设
  var _cacheRaw = null;   // 原始字符串，用于判断是否要重新解析

  /* ---------------- 归一化 ---------------- */
  function str(v) { return v == null ? '' : String(v); }

  /**
   * v3.55.5 宽容 JSON：BOM / // 与 /* *\/ 注释 / 尾逗号都剥掉再 parse。
   * 手改过的预设文件这三样最常见，直接 JSON.parse 一炸就导入不了。
   */
  function lenientParse(text) {
    var s = String(text == null ? '' : text);
    if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);            // UTF-8 BOM
    try { return JSON.parse(s); } catch (e) { }
    // 剥注释（不在字符串里的）：粗暴但对预设 JSON 足够——字符串里的 '//' 极罕见
    var noComment = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    // 剥尾逗号：, 后面紧跟 } 或 ]
    noComment = noComment.replace(/,(\s*[}\]])/g, '$1');
    try { return JSON.parse(noComment); } catch (e) {
      throw new Error('JSON 解析失败：' + e.message);
    }
  }

  /** 解包装：部分工具把预设套在 data / preset / export / payload 里 */
  function unwrap(raw) {
    var cur = raw;
    for (var i = 0; i < 4; i++) {
      if (!cur || typeof cur !== 'object' || Array.isArray(cur)) break;
      /* v3.55.10：当前层本身就有 prompts → 它就是预设本体，别再往 data 里钻。
         酒馆「四入口通用」文件顶层同时带 prompts（预设）与 data（角色卡），
         钻进 data 会只剩 system_prompt 一块（实测 230 块变 1 块）。 */
      if (cur.prompts || cur.prompt_list || cur.prompts_list) break;
      var inner = cur.data || cur.preset || cur.export || cur.payload;
      if (inner && typeof inner === 'object' && !Array.isArray(inner) &&
        (inner.prompts || inner.prompt_list || inner.prompts_list || inner.order || inner.prompt_order || inner.system_prompt)) {
        cur = inner;
      } else break;
    }
    return cur;
  }

  /**
   * v3.55.5 纯文本/单块预设：有人只给一段 system prompt（txt 或 {"system_prompt": "..."}）
   * —— 包成单块预设，别让人家导不进来。
   */
  function fromPlainText(text) {
    var t = String(text == null ? '' : text).trim();
    if (t.length < 30) return null;
    return {
      name: '纯文本预设',
      prompts: [{
        identifier: 'main_prompt',
        name: '主提示词',
        content: t,
        role: 'system',
        enabled: true,
        marker: false,
        system_prompt: true,
        injection_position: 0,
        injection_depth: 4
      }],
      order: [{ identifier: 'main_prompt', enabled: true }],
      _yunjing: { importedAt: Date.now(), blocks: 1, chars: t.length }
    };
  }

  function pickOrder(raw) {
    if (Array.isArray(raw.order) && raw.order.length) return raw.order;
    if (Array.isArray(raw.prompt_order) && raw.prompt_order.length) {
      var po = raw.prompt_order;
      var hit = null;
      for (var i = 0; i < po.length; i++) {
        if (po[i] && Number(po[i].character_id) === 100000) { hit = po[i]; break; }
      }
      if (!hit) {
        // 兜底：取第一个带 order 数组的条目（有的导出 character_id 是 0 / 省略）
        for (var j = 0; j < po.length; j++) {
          if (po[j] && (Array.isArray(po[j].order) || Array.isArray(po[j].orders))) { hit = po[j]; break; }
        }
      }
      if (!hit) hit = po[0];
      if (hit) {
        if (Array.isArray(hit.order)) return hit.order;
        if (Array.isArray(hit.orders)) return hit.orders;
      }
    }
    /* v3.55.5：prompt_order 是对象（{100000: [...], 0: [...]}) 的导出 */
    if (raw.prompt_order && typeof raw.prompt_order === 'object') {
      var pk = raw.prompt_order[100000] || raw.prompt_order['100000'];
      if (Array.isArray(pk)) return pk;
      var keys = Object.keys(raw.prompt_order);
      for (var k = 0; k < keys.length; k++) {
        if (Array.isArray(raw.prompt_order[keys[k]])) return raw.prompt_order[keys[k]];
      }
    }
    return [];
  }

  function normRole(r, blk) {
    if (typeof r === 'number') return ['system', 'user', 'assistant'][r] || 'system';
    var s = str(r).toLowerCase();
    if (s === 'user' || s === 'assistant' || s === 'system') return s;
    if (s === '1') return 'user';
    if (s === '2') return 'assistant';
    return blk && blk.system_prompt ? 'system' : 'system';
  }

  function genId(i) { return 'imp_' + Date.now().toString(36) + '_' + i; }

  /** v3.55.5：content 可能是数组（块分行导出）或数字 —— 统一成字符串 */
  function normContent(c) {
    if (Array.isArray(c)) return c.map(function (x) { return str(x); }).join('\n');
    return (typeof c === 'string') ? c : str(c);
  }

  /**
   * 归一化成云境引擎认识的形状。
   * @throws {Error} 带可读原因
   */
  function normalize(raw) {
    if (typeof raw === 'string') {
      // 纯文本预设（整份 txt 直接丢进来）
      var pt = fromPlainText(raw);
      if (pt) return pt;
      throw new Error('既不是 JSON 也没有足够文本（30 字以上）可当提示词');
    }
    if (!raw || typeof raw !== 'object') throw new Error('不是有效的 JSON 对象');
    if (Array.isArray(raw)) raw = { prompts: raw };
    raw = unwrap(raw);

    /* v3.55.5：{"system_prompt": "..."} / {"content": "..."} 纯文本形态 */
    if (!Array.isArray(raw.prompts) && !Array.isArray(raw.prompt_list) && !Array.isArray(raw.prompts_list)) {
      var one = raw.system_prompt || raw.systemPrompt || (typeof raw.content === 'string' && raw.content);
      if (one) {
        var built = fromPlainText(one);
        if (built) {
          built.name = str(raw.name || raw.preset_name || built.name).slice(0, 80);
          return built;
        }
      }
    }

    var src = raw.prompts || raw.prompt_list || raw.prompts_list;
    if (!Array.isArray(src) || !src.length) {
      throw new Error('没找到 prompts 数组 —— 这不像预设文件（角色卡请用「导入角色卡」）');
    }
    var prompts = [];
    var seen = {};
    var chars = 0;
    for (var i = 0; i < src.length; i++) {
      var b = src[i] || {};
      var id = str(b.identifier || b.id || '').trim();
      if (!id || seen[id]) id = genId(i) + '_' + i;
      seen[id] = 1;
      var content = normContent(b.content);
      chars += content.length;
      prompts.push({
        identifier: id,
        name: str(b.name || b.title || ('未命名块 ' + (i + 1))),
        content: content,
        role: normRole(b.role, b),
        enabled: b.enabled !== false && b.disabled !== true,
        marker: !!b.marker,
        system_prompt: !!b.system_prompt,
        injection_position: b.injection_position == null ? 0 : b.injection_position,
        injection_depth: b.injection_depth == null ? 4 : b.injection_depth
      });
    }
    if (chars < 50) throw new Error('预设内容过少（总字数 ' + chars + '），请确认选的是预设文件而不是别的东西');

    var orderIn = pickOrder(raw);
    var byId = {};
    prompts.forEach(function (p) { byId[p.identifier] = 1; });
    var order = [];
    var used = {};
    orderIn.forEach(function (o) {
      /* v3.55.5：order 条目可能是裸字符串（identifier）或 {identifier, enabled} */
      if (typeof o === 'string') o = { identifier: o };
      if (!o) return;
      var id = str(o.identifier || o.id || '');
      if (!byId[id] || used[id]) return;
      used[id] = 1;
      order.push({ identifier: id, enabled: o.enabled !== false && o.disabled !== true });
    });
    prompts.forEach(function (p) {
      if (!used[p.identifier]) order.push({ identifier: p.identifier, enabled: p.enabled !== false });
    });

    return {
      name: str(raw.name || raw.preset_name || '导入的预设').slice(0, 80),
      version: str(raw.version || '').slice(0, 20),
      prompts: prompts,
      order: order,
      _yunjing: { importedAt: Date.now(), blocks: prompts.length, chars: chars }
    };
  }

  /* ---------------- 当前生效预设 ---------------- */
  function customRaw() { return get(K_CUSTOM); }

  function custom() {
    var raw = customRaw();
    if (!raw) { _cache = null; _cacheRaw = null; return null; }
    if (_cache && _cacheRaw === raw) return _cache;
    try {
      _cache = normalize(JSON.parse(raw));
      _cacheRaw = raw;
      return _cache;
    } catch (e) {
      console.warn('[PresetIO] 自定义预设解析失败，已回退内置：', e.message);
      return null;
    }
  }

  /** 引擎取用：自定义优先，否则内置（v3.55.5 起为云起预设） */
  function active() {
    var c = custom();
    if (c) return c;
    return window.YUNQI_PRESET || window.MIAOMIAO_PRESET || null;
  }

  function info() {
    var c = custom();
    if (c) {
      var m = {};
      try { m = JSON.parse(get(K_SRC) || '{}'); } catch (e) { }
      return { source: 'custom', name: c.name, version: c.version, blocks: c.prompts.length, chars: c._yunjing.chars, file: m.file || '', at: m.at || 0 };
    }
    var b = window.YUNQI_PRESET || window.MIAOMIAO_PRESET;
    var chars = 0;
    (b && b.prompts ? b.prompts : []).forEach(function (p) { chars += str(p.content).length; });
    return { source: 'builtin', name: (b && b.name) || '内置预设', version: (b && b.version) || '', blocks: (b && b.prompts ? b.prompts.length : 0), chars: chars, file: '', at: 0 };
  }

  /* ---------------- 导入 / 还原 ---------------- */
  function importText(text, fileName) {
    var rawStr = String(text == null ? '' : text);
    /* v3.55.5：JSON 先宽容解析；整份失败再试"纯文本预设"兜底 */
    var obj;
    try {
      obj = lenientParse(rawStr);
    } catch (e) {
      var pt = fromPlainText(rawStr);
      if (!pt) throw e;
      obj = pt;
    }
    var p = normalize(obj);                       // 先校验，通过了才落盘（不半途覆盖）
    /* v3.55.5：ST 预设导出多无顶层 name —— 用文件名顶上，别显示成「导入的预设」 */
    if ((!p.name || p.name === '导入的预设') && fileName) {
      p.name = String(fileName).replace(/\.(json|txt)$/i, '').slice(0, 80) || p.name;
    }
    var payload = JSON.stringify(p);
    if (payload.length > 3.5 * 1024 * 1024) throw new Error('预设过大（' + Math.round(payload.length / 1024) + ' KB），浏览器存不下');
    if (!set(K_CUSTOM, payload)) throw new Error('写入本地存储失败（可能空间已满）');
    set(K_SRC, JSON.stringify({ name: p.name, version: p.version, blocks: p.prompts.length, chars: p._yunjing.chars, file: fileName || '', at: Date.now() }));
    del(K_EDITS);                                  // 换预设 → 旧的逐块修改作废（identifier 已变）
    try { window.MoMiaomiao && window.MoMiaomiao.clearOverrides && window.MoMiaomiao.clearOverrides(); } catch (e) { }
    _cache = null; _cacheRaw = null;
    /* v3.55.5 配套正则自动适配：ST 预设导出常把正则嵌在 extensions.regex_scripts
       （双人成行/夏瑾/Reborn/Kemini 四套实测皆是）——导入预设时顺手装载，免手工拆包 */
    var rxCount = 0;
    try {
      var ext = obj && obj.extensions;
      var rxList = ext && (ext.regex_scripts || ext.regex);
      if (Array.isArray(rxList) && rxList.length && window.YunjingRegexIO && window.YunjingRegexIO.importText) {
        window.YunjingRegexIO.importText(JSON.stringify({ regex_scripts: rxList }), (fileName || '') + '（配套正则）');
        rxCount = rxList.length;
      }
    } catch (e) { console.warn('[PresetIO] 配套正则装载失败（预设本体不受影响）:', e.message); }
    var out = info();
    out.regexes = rxCount;
    return out;
  }

  function importFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file) return reject(new Error('没有选择文件'));
      if (file.size > 8 * 1024 * 1024) return reject(new Error('文件过大（' + Math.round(file.size / 1024 / 1024) + ' MB）'));
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
    del(K_CUSTOM); del(K_SRC); del(K_EDITS);
    try { window.MoMiaomiao && window.MoMiaomiao.clearOverrides && window.MoMiaomiao.clearOverrides(); } catch (e) { }
    _cache = null; _cacheRaw = null;
    return info();
  }

  function exportCurrent() {
    var p = active();
    if (!p) return null;
    return JSON.stringify(p, null, 1);
  }

  /* ---------------- 逐块编辑 ---------------- */
  function edits() {
    try { return JSON.parse(get(K_EDITS) || '{}'); } catch (e) { return {}; }
  }
  function editOf(id) {
    var e = edits();
    return (e && Object.prototype.hasOwnProperty.call(e, id)) ? e[id] : null;
  }
  function setEdit(id, text) {
    var e = edits();
    if (text == null) delete e[id];
    else e[id] = String(text);
    try { set(K_EDITS, JSON.stringify(e)); return true; } catch (err) { return false; }
  }
  function clearEdit(id) { setEdit(id, null); }
  function clearEdits() { del(K_EDITS); }
  function editedCount() { return Object.keys(edits()).length; }

  window.YunjingPresetIO = {
    normalize: normalize,
    active: active,
    info: info,
    importText: importText,
    importFile: importFile,
    useBuiltin: useBuiltin,
    exportCurrent: exportCurrent,
    editOf: editOf,
    setEdit: setEdit,
    clearEdit: clearEdit,
    clearEdits: clearEdits,
    edits: edits,
    editedCount: editedCount
  };
})();
