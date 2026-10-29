/* 云境 · 咩咩预设渲染引擎 v1.0.0（v3.47.17）
   职责：把内嵌的 MIAOMIAO_PRESET 按 order 顺序渲染成一段 system 文本。
   原样照搬其渲染语义：
     · prompts 是"块"，order 是"顺序表"；order 里 enabled:false 的块跳过；
     · 块内容先宏展开，再拼接；
     · 宏：
         {{setvar::名字::内容}}  覆盖赋值（同名后写覆盖前写）
         {{addvar::名字::内容}}  追加（同名累加，用换行连接）
         {{getvar::名字}}        取值（未定义 → 空串）
         {{random_string_20}} / {{random_number_20}} / {{random_string_10}} / {{random_number_10}}
         {{char}} / {{user}}
         {{MINIMUM_WORD_COUNT 200}}  用于"至少这么多字"的写法，原样保留为数字提示
     · marker 块（Lorebook Before/After、Chat History 等）本身内容为空，是占位符：
       渲染时保留为空，由调用方决定是否在原位置插入真实内容（云境里我们直接忽略）。
   生产原则：块内容一字不改；只在末尾追加"本世界文风适配"块（启用时）。
*/
(function () {
  'use strict';

  var P = null;

  function preset() {
    /* v3.51.0：玩家导入的预设优先（js/preset-io.js），否则用内置预设
       v3.55.5：内置改为「云起预设」（云境原创），咩咩数据不再随包分发 */
    if (window.YunjingPresetIO && typeof window.YunjingPresetIO.active === 'function') {
      var a = null;
      try { a = window.YunjingPresetIO.active(); } catch (e) { a = null; }
      if (a) return a;
    }
    if (!P) P = (typeof window !== 'undefined' && (window.YUNQI_PRESET || window.MIAOMIAO_PRESET)) || null;
    return P;
  }

  /** 块正文：有玩家改写就用改写版，否则用原版（默认版永远留着） */
  function contentOf(blk) {
    if (!blk) return '';
    if (window.YunjingPresetIO && typeof window.YunjingPresetIO.editOf === 'function') {
      var e = null;
      try { e = window.YunjingPresetIO.editOf(blk.identifier); } catch (err) { e = null; }
      if (e != null) return e;
    }
    return blk.content;
  }

  /* ---------------- 随机串/数字（对应 ST 的同名宏） ---------------- */
  var CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  function randStr(n) {
    var s = '';
    for (var i = 0; i < n; i++) s += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
    return s;
  }
  function randNum(n) {
    var s = '';
    for (var i = 0; i < n; i++) s += String(Math.floor(Math.random() * 10));
    return s;
  }

  /* ---------------- 宏展开 ---------------- */
  /**
   * v3.55.5 通用宏适配：别人的预设什么宏都可能用（ST 全家桶 + 手写变体），
   * 一个不认识就漏一个 {{xxx}} 进提示词——模型抄进正文就是掉格式。
   * 原则：认识的展开、占位的清空、注释的剥掉、最后未知的整扫，零泄漏。
   */

  /** {{// 注释}}（可跨行）：ST 注释宏，展开前先剥 */
  function stripComments(t) {
    return t.replace(/\{\{\/\/[\s\S]*?\}\}/g, '');
  }

  /** {{random:a|b|c}} / {{pick:...}} / {{choose:...}}：竖线择一 */
  function expandChoice(t) {
    return t.replace(/\{\{(?:random|pick|choose|select):([^}]*)\}\}/g, function (_, body) {
      var opts = String(body).split('|').map(function (x) { return x.trim(); }).filter(function (x) { return x !== ''; });
      if (!opts.length) return '';
      return opts[Math.floor(Math.random() * opts.length)];
    });
  }

  /** {{roll:1d20}} / {{roll:d20}} / {{dice:2d6+3}}：掷骰 */
  function expandRoll(t) {
    return t.replace(/\{\{(?:roll|dice):([^}]*)\}\}/g, function (_, body) {
      var m = /^(\d*)d(\d+)\s*([+-]\s*\d+)?$/i.exec(String(body).trim());
      if (!m) return '';
      var n = Math.min(parseInt(m[1] || '1', 10) || 1, 20);
      var sides = Math.min(parseInt(m[2], 10) || 6, 1000);
      var bonus = m[3] ? parseInt(m[3].replace(/\s+/g, ''), 10) : 0;
      var sum = bonus;
      for (var i = 0; i < n; i++) sum += 1 + Math.floor(Math.random() * sides);
      return String(sum);
    });
  }

  /** {{time}} / {{date}} / {{datetime}} */
  function expandTime(t) {
    var now = new Date();
    var pad = function (x) { return x < 10 ? '0' + x : String(x); };
    var date = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
    var time = pad(now.getHours()) + ':' + pad(now.getMinutes());
    return t
      .replace(/\{\{datetime\}\}/g, date + ' ' + time)
      .replace(/\{\{date\}\}/g, date)
      .replace(/\{\{time\}\}/g, time);
  }

  /** ST 占位宏（世界书/示例/聊天历史等由云境自己注入）→ 清空，绝不留字面量 */
  var PLACEHOLDER_MACROS = /\{\{\s*(?:worldInfo|world_info|wiBefore|wiAfter|wi_before|wi_after|lorebook|lore|book|mesExamples|mes_examples|example|examples|groupChatHistory|group_chat_history|chatHistory|chat_history|history|lastMessage|last_message|lastUserMessage|last_user_message|lastCharMessage|firstMes|first_mes|firstMessage|description|char_description|personality|char_personality|scenario|char_scenario|persona|user_persona|char_persona|charName|userPersona|noop|trim|blank|empty|length|words|word_count|MINIMUM_WORD_COUNT)\s*(?:\d+)?\s*\}\}/gi;

  /** 通用随机宏：{{random_string_N}} / {{random_number_N}} 任意长度（封顶 64） */
  function expandRandom(t) {
    return t
      .replace(/\{\{\s*random_string_(\d+)\s*\}\}/g, function (_, n) { return randStr(Math.min(parseInt(n, 10) || 10, 64)); })
      .replace(/\{\{\s*random_number_(\d+)\s*\}\}/g, function (_, n) { return randNum(Math.min(parseInt(n, 10) || 10, 64)); });
  }

  /** setvar / addvar：双冒号（ST 标准）与单冒号（手写变体）都认 */
  function expandVars(t, vars, ctx, written) {
    t = t.replace(/\{\{setvar::([^:}]+)::([\s\S]*?)\}\}/g, function (_, name, val) {
      var k = String(name).trim();
      vars[k] = renderInner(val, vars, ctx);
      written.push(k);
      return '';
    });
    t = t.replace(/\{\{setvar:([^:}]+):([\s\S]*?)\}\}/g, function (_, name, val) {
      var k = String(name).trim();
      vars[k] = renderInner(val, vars, ctx);
      written.push(k);
      return '';
    });
    t = t.replace(/\{\{addvar::([^:}]+)::([\s\S]*?)\}\}/g, function (_, name, val) {
      var k = String(name).trim();
      var add = renderInner(val, vars, ctx);
      vars[k] = vars[k] ? (vars[k] + '\n' + add) : add;
      written.push(k);
      return '';
    });
    t = t.replace(/\{\{addvar:([^:}]+):([\s\S]*?)\}\}/g, function (_, name, val) {
      var k = String(name).trim();
      var add = renderInner(val, vars, ctx);
      vars[k] = vars[k] ? (vars[k] + '\n' + add) : add;
      written.push(k);
      return '';
    });
    return t;
  }

  /** getvar：双冒号与单冒号 */
  function expandGet(t, vars) {
    t = t.replace(/\{\{getvar::([^}]+)\}\}/g, function (_, name) {
      var v = vars[String(name).trim()];
      return v == null ? '' : v;
    });
    t = t.replace(/\{\{getvar:([^}:]+)\}\}/g, function (_, name) {
      var v = vars[String(name).trim()];
      return v == null ? '' : v;
    });
    return t;
  }

  /** 角色名 */
  function expandNames(t, ctx) {
    return t
      .replace(/\{\{char\}\}/g, ctx.char || '角色')
      .replace(/\{\{user\}\}/g, ctx.user || '你');
  }

  /** 字数宏 → 保留为数字说明 */
  function expandWordCount(t) {
    return t.replace(/\{\{\s*MINIMUM_WORD_COUNT\s+(\d+)\s*\}\}/g, '$1');
  }

  /** 末尾兜底：未知 {{...}} 一律清掉（≤120 字符、不跨行的宏形态），零泄漏 */
  function sweepUnknown(t) {
    return t.replace(/\{\{[^{}\n]{1,120}\}\}/g, '');
  }

  /**
   * 展开一段内容的宏。
   * @param {String} text 原始内容
   * @param {Object} vars 变量表（会被 setvar/addvar 就地修改）
   * @param {Object} ctx  {char, user}
   * @returns {{text:String, textOut:String, written:Array}} written 记录本块写入了哪些变量（用于旁路注释）
   */
  function expand(text, vars, ctx) {
    var t = String(text == null ? '' : text);
    var written = [];

    t = stripComments(t);
    t = expandVars(t, vars, ctx, written);
    t = expandGet(t, vars);
    t = expandRandom(t);
    t = expandChoice(t);
    t = expandRoll(t);
    t = expandTime(t);
    t = expandNames(t, ctx);
    t = expandWordCount(t);
    t = t.replace(PLACEHOLDER_MACROS, '');
    t = sweepUnknown(t);

    return { text: t, written: written };
  }

  /** 只展开 getvar / 随机 / 角色名（setvar 的内容体内部用，避免嵌套 setvar 互相干扰） */
  function renderInner(val, vars, ctx) {
    var t = String(val == null ? '' : val);
    t = stripComments(t);
    t = expandGet(t, vars);
    t = expandRandom(t);
    t = expandNames(t, ctx);
    return t;
  }

  /* ---------------- 渲染整份预设 ---------------- */
  /**
   * @param {Object} opt
   *   { char, user, styleBlock, extraToggles }
   *   styleBlock: 追加到末尾的"本世界文风适配"文本（由 preset-miaomiao-styles 生成）
   * @returns {{system:String, vars:Object, included:Array, chars:Number}}
   */
  function render(opt) {
    opt = opt || {};
    var p = preset();
    if (!p) return { system: '', vars: {}, included: [], chars: 0 };

    var ctx = { char: opt.char || '角色', user: opt.user || '你' };
    var vars = {};
    // 按 identifier 建索引
    var byId = {};
    for (var i = 0; i < p.prompts.length; i++) {
      byId[p.prompts[i].identifier] = p.prompts[i];
    }
    // order 可能缺项（ST 里新增块不在 order 中时默认追加到末尾）——先按 order 走
    var ordered = [];
    var seen = {};
    (p.order || []).forEach(function (o) {
      var blk = byId[o.identifier];
      if (!blk) return;
      seen[o.identifier] = true;
      // 块自身 enabled 与 order.enabled 都要为真
      var on = o.enabled === false ? false : (blk.enabled === false ? false : true);
      ordered.push({ blk: blk, on: on });
    });
    // 未出现在 order 里的块，按原顺序补在后（ST 行为）
    p.prompts.forEach(function (blk) {
      if (!seen[blk.identifier]) {
        ordered.push({ blk: blk, on: blk.enabled !== false });
      }
    });

    var parts = [];
    var included = [];
    ordered.forEach(function (it) {
      if (!it.on) return;
      var r = expand(contentOf(it.blk), vars, ctx);
      var txt = r.text;
      /* v3.55.5：marker 块（Lorebook/Chat History 占位符）展开后为空才跳过；
         自定义预设的 marker 块里若有实文，一字不丢照常拼接 */
      if (it.blk.marker && (!txt || !txt.trim())) return;
      if (!txt || !txt.trim()) {
        // 空块：若它写了变量（如清空块），也要执行——已在 expand 中执行，这里只是不拼接
        return;
      }
      parts.push(txt.trim());
      included.push(it.blk.name || it.blk.identifier);
    });

    var system = parts.join('\n\n');

    if (opt.styleBlock && String(opt.styleBlock).trim()) {
      system += '\n\n' + String(opt.styleBlock).trim();
      included.push('［本世界文风适配］');
    }

    return { system: system, vars: vars, included: included, chars: system.length };
  }

  /* ---------------- 开关：整份预设启停 ---------------- */
  var KEY = 'storyUseMiaomiao';
  function enabled() {
    /* v3.55.5：云起预设是出厂默认 —— 未做过显式选择时默认开启（'0' 才是玩家关的） */
    try {
      var v = localStorage.getItem(KEY);
      if (v === '0') return false;
      if (v === '1') return true;
    } catch (e) { return true; }
    return true;
  }
  function setEnabled(on) {
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
    return !!on;
  }

  /* ---------------- 与云境世界对齐的可选项 ---------------- */
  // 预设里"破甲"三档 / 文风档 / 视角等，都靠"只留一个开"来生效。
  // 云境这边提供名字级开关（覆盖 order.enabled），不改进原内容。
  var OVERRIDE_KEY = 'storyMiaomiaoOverrides';
  function getOverrides() {
    try { return JSON.parse(localStorage.getItem(OVERRIDE_KEY) || '{}'); } catch (e) { return {}; }
  }
  function setOverride(nameOrId, on) {
    var o = getOverrides();
    o[nameOrId] = !!on;
    try { localStorage.setItem(OVERRIDE_KEY, JSON.stringify(o)); } catch (e) {}
  }
  function clearOverrides() {
    try { localStorage.removeItem(OVERRIDE_KEY); } catch (e) {}
  }

  /** 在 render 之上叠加用户覆盖（按块名或 identifier 匹配） */
  function renderWithOverrides(opt) {
    var p = preset();
    if (!p) return { system: '', vars: {}, included: [], chars: 0 };
    var ov = getOverrides();
    if (!Object.keys(ov).length) return render(opt);

    // 临时改 order.enabled 太脏，改走"渲染时判断"
    var ctx = { char: opt.char || '角色', user: opt.user || '你' };
    var vars = {};
    var byId = {};
    p.prompts.forEach(function (x) { byId[x.identifier] = x; });

    var ordered = [], seen = {};
    (p.order || []).forEach(function (o) {
      var blk = byId[o.identifier];
      if (!blk) return;
      seen[o.identifier] = true;
      var on = o.enabled === false ? false : (blk.enabled === false ? false : true);
      if (ov[blk.name] !== undefined) on = !!ov[blk.name];
      if (ov[blk.identifier] !== undefined) on = !!ov[blk.identifier];
      ordered.push({ blk: blk, on: on });
    });
    p.prompts.forEach(function (blk) {
      if (seen[blk.identifier]) return;
      var on = blk.enabled !== false;
      if (ov[blk.name] !== undefined) on = !!ov[blk.name];
      ordered.push({ blk: blk, on: on });
    });

    var parts = [], included = [];
    ordered.forEach(function (it) {
      if (!it.on) return;
      var r = expand(contentOf(it.blk), vars, ctx);
      if (it.blk.marker && (!r.text || !r.text.trim())) return;
      if (!r.text || !r.text.trim()) return;
      parts.push(r.text.trim());
      included.push(it.blk.name || it.blk.identifier);
    });
    var system = parts.join('\n\n');
    if (opt && opt.styleBlock && String(opt.styleBlock).trim()) {
      system += '\n\n' + String(opt.styleBlock).trim();
      included.push('［本世界文风适配］');
    }
    return { system: system, vars: vars, included: included, chars: system.length };
  }

  /** 列出所有块（供 UI 做开关面板） */
  function listBlocks() {
    var p = preset();
    if (!p) return [];
    var byId = {};
    p.prompts.forEach(function (x) { byId[x.identifier] = x; });
    var out = [], seen = {};
    (p.order || []).forEach(function (o) {
      var b = byId[o.identifier];
      if (!b) return;
      seen[b.identifier] = true;
      var c0 = contentOf(b);
      out.push({
        id: b.identifier, name: b.name || '', len: String(c0 || '').length,
        on: !(o.enabled === false || b.enabled === false),
        marker: !!b.marker, role: b.role || 'system',
        edited: c0 !== b.content
      });
    });
    p.prompts.forEach(function (b) {
      if (seen[b.identifier]) return;
      var c1 = contentOf(b);
      out.push({ id: b.identifier, name: b.name || '', len: String(c1 || '').length, on: b.enabled !== false, marker: !!b.marker, role: b.role || 'system', edited: c1 !== b.content });
    });
    return out;
  }

  window.MoMiaomiao = {
    preset: preset,
    render: render,
    renderWithOverrides: renderWithOverrides,
    expand: expand,
    contentOf: contentOf,
    listBlocks: listBlocks,
    enabled: enabled,
    setEnabled: setEnabled,
    getOverrides: getOverrides,
    setOverride: setOverride,
    clearOverrides: clearOverrides
  };
})();
