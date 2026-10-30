/* ============================================================
 * 云境工坊 · 咩咩专用正则引擎（ver 7.2 → 云境适配）
 * ------------------------------------------------------------
 * 原版 45 条是给 SillyTavern 用的，直接搬会有三处水土不服：
 *   1) 美化模板是几千字节的内联 <style> + 赛博朋克动画，和云境的
 *      水墨/世界皮肤互相打架，还会在每轮正文里重复注入全局样式；
 *   2) 有 2 条是 SillyTavern 专属版（选项美化、特殊状态栏美化），
 *      云境该用同文件里配套的「非SillyTavern」版；
 *   3) 云境的正文渲染是 escapeHtml 的，正则生成的 HTML 会被转义成纯文本。
 *
 * 适配原则（与预设一致：识别规则照搬，渲染换成云境自己）：
 *   - 「清理类」正则（去 AI 味的词/八股）是纯文本替换 —— 原样照搬，直接生效；
 *   - 「协议块」的识别照搬原版 findRegex 的语义，但渲染成云境自己的
 *     折叠卡片（跟随世界皮肤，零内联样式）；
 *   - 逐条开关，玩家可自由启停（含原版出厂关闭的 18 条）。
 * ============================================================ */
(function () {
  'use strict';

  var KEY = 'storyUseMiaomiaoRegex';
  var OV_KEY = 'storyMiaomiaoRegexOverrides';

  function rules() {
    /* v3.51.0：玩家导入的正则整份替换内置（js/regex-io.js）
       v3.55.5：内置默认改「云起正则」（云境原创） */
    if (typeof window !== 'undefined' && window.YunjingRegexIO && typeof window.YunjingRegexIO.active === 'function') {
      var a = null;
      try { a = window.YunjingRegexIO.active(); } catch (e) { a = null; }
      if (a && a.length) return a;
    }
    return (typeof window !== 'undefined' && (window.YUNQI_REGEX || window.MIAOMIAO_REGEX)) || [];
  }

  /** 规则类别：内置按名字查表；导入的一律当"自定义文本替换" */
  function kindOf(r) {
    return KIND_MAP[r.scriptName] || (r._custom ? 'custom' : 'misc');
  }

  /* ---------------- 开关 ---------------- */
  /** v3.51.0：玩家从没动过这个开关时，跟随「整份预设」的总开关。
   *  预设开着却不收口协议块，<status>/<wlog> 就会以裸 XML 落进正文——
   *  这正是"正式游玩掉格式"最常见的成因。玩家显式关过（'0'）则不覆盖其选择。 */
  function enabled() {
    try {
      var v = localStorage.getItem(KEY);
      if (v === '1') return true;
      if (v === '0') return false;
    } catch (e) { return false; }
    try {
      var M = window.MoMiaomiao;
      if (M && typeof M.enabled === 'function') return !!M.enabled();
    } catch (e) { }
    return false;
  }
  function setEnabled(on) {
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
    return !!on;
  }
  function getOverrides() {
    try { return JSON.parse(localStorage.getItem(OV_KEY) || '{}'); } catch (e) { return {}; }
  }
  function setOverride(id, on) {
    var o = getOverrides();
    o[id] = !!on;
    try { localStorage.setItem(OV_KEY, JSON.stringify(o)); } catch (e) {}
  }
  function clearOverrides() {
    try { localStorage.removeItem(OV_KEY); } catch (e) {}
  }

  /* ---------------- ST 正则字符串 → JS RegExp ---------------- */
  /** 支持两种写法：/pattern/flags 与 裸 pattern（ST 无斜杠时按全局处理） */
  function toRegex(src) {
    var s = String(src || '');
    var m = /^\/(.+)\/([gimsuy]*)$/.exec(s);
    if (m) {
      try { return new RegExp(m[1], m[2]); } catch (e) { return null; }
    }
    try { return new RegExp(s, 'g'); } catch (e) { return null; }
  }

  /* ---------------- 分类：给 45 条打上云境语义 ---------------- */
  // kind: card=协议块转卡片 / purge=去AI味清理 / ctx=上下文裁剪 / misc=其它
  // 名字取自原版 scriptName，保证一一对应
  var KIND_MAP = {
    /* v3.55.5 云起正则（内置原创集）：purge=显示侧清洗 / ctx=发送侧裁剪 */
    '云起·思维链折叠': 'purge',
    '云起·思维链剥除(发送)': 'ctx',
    '云起·思维链对AI隐藏': 'ctx',
    '云起·历史瘦身(发送)': 'ctx',
    '云起·内部标签清洗': 'purge',
    '云起·AI腔尾巴': 'purge',
    '云起·八股词抹除': 'purge',
    '云起·空洞强调词': 'purge',
    '云起·套话抹除': 'purge',
    '云起·省略号压缩': 'purge',
    '云起·markdown标题剥除': 'purge',
    '云起·代码围栏剥除': 'purge',
    '云起·重复句压缩': 'purge',
    '云起·行首缩进剥除': 'purge',
    '云起·空行归一': 'purge',
    '云起·双语对照美化': 'purge',
    /* v3.55.6 云起专属美化：card=卡片正文美化（渲染期作用于协议块正文） /
       purge=正文美化（思维链键名高亮 / 行动选项序号规整） */
    '云起·思维链美化': 'purge',
    '云起·行动选项美化': 'purge',
    '云起·开场白美化': 'card',
    '云起·玩家状态栏美化': 'card',
    '云起·角色好感度美化': 'card',
    '云起·NPC内心话美化': 'card',
    '云起·世界运行报告美化': 'card',
    '云起·剧情记忆归档美化': 'card',
    '云起·特殊状态栏美化': 'card',
    '云起·平行线美化': 'card',
    '云起·同人搜索美化': 'card',
    '云起·战斗引擎美化': 'card',
    '云起·故事引擎美化': 'card',
    '云起·角色心理美化': 'card',
    '开场白美化': 'card',
    '同人搜索': 'card',
    '战斗引擎': 'card',
    '故事引擎': 'card',
    'acg角色心理模型': 'card',
    '特殊状态栏美化-SillyTavern': 'card',
    '特殊状态栏美化-非SillyTavern': 'card',
    '剧情记忆归档美化': 'card',
    '世界运行报告美化': 'card',
    '玩家状态栏美化': 'card',
    '角色好感度美化': 'card',
    'NPC内心话美化': 'card',
    '平行线美化': 'card',
    '选项美化-SillyTavern': 'card',
    '选项美化-非SillyTavern': 'card',
    '双语美化-默认': 'misc',
    '双语美化-折叠': 'misc',
    '***符号转分行': 'purge',
    '清理开场白': 'ctx',
    '清空玩家输入历史记录': 'ctx',
    '清理防截断内容': 'ctx',
    '不发送选项': 'ctx',
    '不发送平行线': 'ctx',
    '不发送内心话': 'ctx',
    '不发送当前故事思维链': 'ctx',
    '不发送当前NPC思维链': 'ctx',
    '不发送当前战斗思维链': 'ctx',
    '清理常见八股(自填方式:在斜线包裹框内使用\'|\'分割开需要清理的关键词)': 'purge',
    '清理茧子': 'purge',
    '清理指头泛白': 'purge',
    '清理比哭还难看': 'purge',
    '清理废话修饰词': 'purge',
    '清理动物比喻': 'purge',
    'display清空AI历史记录仅保留总结': 'ctx',
    'send清空AI历史记录仅保留总结': 'ctx'
  };

  /** 协议块 → 云境卡片的定义（图标/标题/提取用的容错正则）
   *  rule：咩咩规则名（导入咩咩预设时，关闭该规则 → 隐藏卡片，兼容原版行为）
   *  yqRule：云起专属美化规则名（关闭 → 卡片回退朴素样式，内容照常显示） */
  var CARD_DEFS = [
    { key: 'opening', rule: '开场白美化', yqRule: '云起·开场白美化',    icon: '🎬', title: '开场白',     re: /<opening>\s*([\s\S]*?)\s*<\/opening>/gi },
    { key: 'lore', rule: '同人搜索', yqRule: '云起·同人搜索美化',       icon: '🔎', title: '同人考据',   re: /<lore_search>\s*([\s\S]*?)\s*<\/lore_search>/gi },
    { key: 'combat', rule: '战斗引擎', yqRule: '云起·战斗引擎美化',     icon: '⚔️', title: '战斗推演',   re: /<combat_driver>\s*([\s\S]*?)\s*<\/combat_driver>/gi },
    { key: 'story', rule: '故事引擎', yqRule: '云起·故事引擎美化',      icon: '🧠', title: '故事推演',   re: /<story_driver>\s*([\s\S]*?)\s*<\/story_driver>/gi },
    { key: 'acg', rule: 'acg角色心理模型', yqRule: '云起·角色心理美化',        icon: '🎭', title: '角色心理',   re: /<acg_think>\s*([\s\S]*?)\s*<\/acg_think>/gi },
    { key: 'special', rule: '特殊状态栏美化-非SillyTavern', yqRule: '云起·特殊状态栏美化',    icon: '🩺', title: '特殊状态',   re: /<special_status>\s*([\s\S]*?)\s*<\/special_status>/gi },
    { key: 'memory', rule: '剧情记忆归档美化', yqRule: '云起·剧情记忆归档美化',     icon: '📑', title: '剧情记忆归档', re: /<memory_log>\s*([\s\S]*?)\s*<\/memory_log>/gi },
    { key: 'wlog', rule: '世界运行报告美化', yqRule: '云起·世界运行报告美化',       icon: '🌍', title: '世界运行报告', re: /<wlog(?:\s+time="([^"]*)")?\s*>\s*([\s\S]*?)\s*<\/wlog>/gi },
    { key: 'status', rule: '玩家状态栏美化', yqRule: '云起·玩家状态栏美化',     icon: '📜', title: '玩家状态栏', re: /<status>\s*([\s\S]*?)\s*<\/status>/gi },
    { key: 'affinity', rule: '角色好感度美化', yqRule: '云起·角色好感度美化',   icon: '💞', title: '角色好感度', re: /<affinity>\s*([\s\S]*?)\s*<\/affinity>/gi },
    { key: 'npc', rule: 'NPC内心话美化', yqRule: '云起·NPC内心话美化',        icon: '👁️', title: 'NPC内心话', re: /<npc_log>\s*([\s\S]*?)\s*<\/npc_log>/gi },
    { key: 'parallel', rule: '平行线美化', yqRule: '云起·平行线美化',   icon: '〰️', title: '平行线',     re: /<parallel_line_drive>\s*([\s\S]*?)\s*<\/parallel_line_drive>/gi },
    { key: 'parallel2', rule: '平行线美化', yqRule: '云起·平行线美化',  icon: '〰️', title: '平行线',     re: /<parallel_line>\s*([\s\S]*?)\s*<\/parallel_line>/gi },
    { key: 'selection', rule: '选项美化-非SillyTavern', yqRule: '云起·行动选项美化',  icon: '🎯', title: '行动选项',   re: /<selection>\s*([\s\S]*?)\s*<\/selection>/gi }
  ];

  /** 每条规则当前是否生效（玩家覆盖 > 原版 disabled） */
  function isOn(r) {
    var ov = getOverrides();
    if (ov[r.id] !== undefined) return !!ov[r.id];
    if (ov[r.scriptName] !== undefined) return !!ov[r.scriptName];
    return !r.disabled;
  }

  /**
   * 云境侧的默认调整：原版出厂开着的两条是 SillyTavern 专属版，
   * 云境改用配套的「非SillyTavern」版（原版里这两条是关着的）。
   * 玩家手动改过就不干预。
   */
  function resolveDefaults() {
    var ov = getOverrides();
    var flip = {
      // 原版出厂开着的是 SillyTavern 专属版，云境改用配套的「非SillyTavern」版
      '选项美化-SillyTavern': false,
      '选项美化-非SillyTavern': true,
      '特殊状态栏美化-SillyTavern': false,
      '特殊状态栏美化-非SillyTavern': true
      /* 注：「清理废话修饰词」「清理动物比喻」保持原版出厂的关闭状态。
         它们确实是去 AI 味的利器，但也会误伤正常文学表达
         （"似乎""某种""抿了抿唇"都是合法写法），交由玩家在面板里自选开启。 */
    };
    var out = {};
    rules().forEach(function (r) {
      if (flip[r.scriptName] !== undefined && ov[r.id] === undefined && ov[r.scriptName] === undefined) {
        out[r.id] = flip[r.scriptName];
      }
    });
    return out;
  }

  function onMap() {
    var m = {};
    var dft = resolveDefaults();
    var ov = getOverrides();
    rules().forEach(function (r) {
      var v;
      if (ov[r.id] !== undefined) v = !!ov[r.id];
      else if (ov[r.scriptName] !== undefined) v = !!ov[r.scriptName];
      else if (dft[r.id] !== undefined) v = dft[r.id];
      else v = !r.disabled;
      m[r.id] = v;
    });
    return m;
  }

  /* ---------------- 去 AI 味（purge）：原样照搬，作用于显示正文 ---------------- */

  /**
   * 原版「清理动物比喻」正则的收尾组只认 "X般的 / X一样 / X似地"，
   * 遇到 "像一只受惊的小鹿般退开" 会只删掉比喻主体、留下孤零零的"般"，
   * 变成"她般退开"这种病句。这里补上单字收尾，让整段比喻被完整吃掉。
   */
  var ANIMAL_TAIL_FIX = {
    source: '(?:[般似]的|一样|似的|[般似])?',
    target: '(?:[般似]的|[一]样|[似]地)?'
  };

  function adaptSource(r) {
    var src = r.findRegex;
    // 只对「清理动物比喻」这一条做收尾组修补，其余一字不动
    if (r.scriptName !== '清理动物比喻') return src;
    return String(src).replace(ANIMAL_TAIL_FIX.target, ANIMAL_TAIL_FIX.source);
  }

  /** 清理后的病句修补：合并空出来的重复标点、行首残留标点 */
  function polish(text) {
    return String(text)
      .replace(/([。！？…])\s*(?:[。！？…]\s*)+/g, '$1')   // "。。" → "。"
      .replace(/^[ \t]*[，、；：,;][ \t]*/gm, '')          // 行首残留逗号/顿号
      .replace(/([，、])\s*(?:[，、]\s*)+/g, '$1')         // "，，" → "，"
      .replace(/[，、]\s*([。！？…])/g, '$1')              // v3.55.5 清词残留的"她，。" → "她。"
      .replace(/[ \t]{2,}/g, ' ');
  }

  function applyPurge(text) {
    if (!enabled() || !text) return String(text == null ? '' : text);
    var on = onMap();
    var out = String(text);
    var touched = false;
    rules().forEach(function (r) {
      if (!on[r.id]) return;
      var kd = kindOf(r);
      if (kd !== 'purge' && kd !== 'custom') return;
      /* v3.55.18 导入第三方（酒馆）正则的两道防护：
         ① promptOnly 的正则在酒馆里只作用于「发给模型的 prompt」，靠 placement 限定在
            历史楼层；云境这里处理的是「显示给玩家的正文」，照单执行会把正文清空。
         ② 整段通配（点星、[\s\S] 星号之类）+ 空替换的规则，在酒馆里是"隐藏不发送"
            的省 token 手段，落到正文就是全清——一律跳过。                      */
      if (r.promptOnly && !r.markdownOnly) return;
      var re = toRegex(adaptSource(r));
      if (!re) return;
      if (isWipeRule(re, r.replaceString)) {
        try { console.warn('[正则] 已跳过会清空全文的规则：' + (r.scriptName || r.id)); } catch (e) {}
        return;
      }
      var flags = re.flags.indexOf('g') >= 0 ? re.flags : re.flags + 'g';
      try { re = new RegExp(re.source, flags); } catch (e) {}
      try {
        var next = out.replace(re, r.replaceString || '');
        if (next !== out) touched = true;
        out = next;
      } catch (e) {}
    });
    return touched ? polish(out) : out;
  }

  /**
   * v3.55.18：这条规则会不会把整段文字清空？
   * 判定：替换串为空（或纯空白）+ 正则体是通配（.*  / [\s\S]*  / ^[\s\S]*$  / 空）。
   * 酒馆里这类规则是"隐藏不发送"的省 token 手段，落到正文渲染就是灾难。
   */
  function isWipeRule(re, replaceString) {
    if (replaceString && String(replaceString).trim()) return false;
    var src = String((re && re.source) || '').replace(/^\^+/, '').replace(/\$+$/, '');
    if (src === '') return true;
    if (/^\[\\?s\\?S\][*+]$/.test(src)) return true;   // [\s\S]* / [\s\S]+
    if (/^\.[*+]$/.test(src)) return true;             // .* / .+
    if (/^\\?\[\^?\][*+]$/.test(src)) return true;
    return false;
  }

  /* ---------------- 上下文裁剪（ctx）：作用于发给模型的历史 ---------------- */
  function applyCtx(text) {
    if (!enabled() || !text) return String(text == null ? '' : text);
    var on = onMap();
    var out = String(text);
    rules().forEach(function (r) {
      if (!on[r.id]) return;
      if (kindOf(r) !== 'ctx') return;
      // 「清空玩家输入历史记录」的 findRegex 是 ^[\s\S]*$ —— 会把整段清空，云境不能照搬
      if (r.scriptName === '清空玩家输入历史记录') return;
      if (/清空AI历史记录仅保留总结/.test(r.scriptName)) return;
      var re = toRegex(r.findRegex);
      if (!re) return;
      var flags = re.flags.indexOf('g') >= 0 ? re.flags : re.flags + 'g';
      try { re = new RegExp(re.source, flags); } catch (e) {}
      try { out = out.replace(re, r.replaceString || ''); } catch (e) {}
    });
    return out;
  }

  /* ---------------- 协议块：抽出 → 云境卡片 ---------------- */
  /**
   * 从正文里抽出预设协议块。
   * @returns { prose, cards }  cards: [{key,icon,title,time,body}]
   */
  function extractCards(text) {
    var src = String(text == null ? '' : text);
    // 先在原文上定位全部命中（含位置），再从后往前删 —— 保证卡片顺序 = 正文出现顺序
    var hits = [];
    CARD_DEFS.forEach(function (def) {
      // selection 不在这里抽 —— 它要转成【行动选项】交给云境既有按钮机制
      if (def.key === 'selection') return;
      var re = new RegExp(def.re.source, def.re.flags.indexOf('g') >= 0 ? def.re.flags : def.re.flags + 'g');
      var m;
      while ((m = re.exec(src)) !== null) {
        var time = '', body;
        if (def.key === 'wlog') { time = m[1] || ''; body = m[2] || ''; }
        else { body = m[1] || ''; }
        body = String(body).trim();
        if (body) hits.push({ start: m.index, end: m.index + m[0].length, def: def, body: body, time: time });
        if (m[0].length === 0) re.lastIndex++;
      }
    });
    hits.sort(function (a, b) { return a.start - b.start; });

    var prose = src;
    for (var i = hits.length - 1; i >= 0; i--) {
      prose = prose.slice(0, hits[i].start) + '\n' + prose.slice(hits[i].end);
    }
    var cards = hits.map(function (h) {
      return { key: h.def.key, icon: h.def.icon, title: h.def.title, time: h.time, body: h.body, rule: h.def.rule, yqRule: h.def.yqRule };
    });
    return { prose: prose, cards: cards };
  }

  /**
   * <selection> 转成云境能识别的【行动选项】段落
   * （云境的 extractOptions 认【行动选项】+ A/B/C/D，接上后玩家直接点按钮）
   */
  function selectionToOptions(text) {
    var src = String(text == null ? '' : text);
    var out = src;
    var blocks = [];
    out = out.replace(/<selection>\s*([\s\S]*?)\s*<\/selection>/gi, function (m, a) {
      blocks.push(String(a || '').trim());
      return '\n';
    });
    if (!blocks.length) return out;
    var lines = [];
    blocks.forEach(function (b) {
      b.split('\n').forEach(function (l) {
        var t = l.trim();
        if (t) lines.push(t);
      });
    });
    if (!lines.length) return out;
    return out.replace(/\s*$/, '') + '\n\n【行动选项】\n' + lines.join('\n') + '\n';
  }

  /**
   * 正文容器标签：剥掉标签、保留内容。
   * 原版没有对应规则 —— 因为 SillyTavern 走浏览器渲染，未知标签会被吞掉；
   * 云境正文是 escapeHtml 的，不剥就会以字面量 "<story_scene>" 出现在正文里。
   */
  var WRAPPER_TAGS = ['story_scene', 'locator', 'opening', 'parallel_line_drive', 'parallel_line'];

  function stripWrappers(text) {
    var out = String(text == null ? '' : text);
    WRAPPER_TAGS.forEach(function (t) {
      out = out.replace(new RegExp('<\\/?' + t + '(?:"[^"]*")?\\s*>', 'gi'), '\n');
    });
    return out.replace(/\n{3,}/g, '\n\n');
  }

  /** HTML 转义 */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** 卡片正文轻排版：转义后再补 **加粗** / *斜体* / `代码` / 换行（先转义，安全） */
  function richText(s) {
    return esc(s)
      .replace(/\*\*([^*\n]{1,80})\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*\n])\*([^*\n]{1,80})\*(?!\*)/g, '$1<i>$2</i>')
      .replace(/`([^`\n]{1,80})`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  /** 按名查一条规则当前是否开着（供渲染/选项区判定「云起·XX美化」开关） */
  function ruleOn(name) {
    var on = onMap();
    var hit = null;
    rules().forEach(function (r) { if (r.scriptName === name) hit = r; });
    return !!(hit && on[hit.id]);
  }

  /** 卡片正文美化：按 yqRule 名跑对应美化规则（渲染期，只作用于该卡正文） */
  function applyYqPolish(body, yqRule) {
    if (!yqRule) return String(body == null ? '' : body);
    if (!ruleOn(yqRule)) return String(body == null ? '' : body);
    var target = null;
    rules().forEach(function (r) { if (r.scriptName === yqRule) target = r; });
    if (!target) return String(body == null ? '' : body);
    var re = toRegex(target.findRegex);
    if (!re) return String(body == null ? '' : body);
    var flags = re.flags.indexOf('g') >= 0 ? re.flags : re.flags + 'g';
    try { re = new RegExp(re.source, flags); } catch (e) { return String(body == null ? '' : body); }
    try { return String(body).replace(re, target.replaceString || ''); } catch (e) { return String(body == null ? '' : body); }
  }

  /** 云起结构化排版：正文按行包 .yq-row，键值行距均匀（美化开启时用） */
  function yqRows(s) {
    return String(s == null ? '' : s).split('\n').map(function (line) {
      if (!line.trim()) return '';
      return '<div class="yq-row">' + richText(line) + '</div>';
    }).join('');
  }

  /**
   * 渲染成云境风格折叠卡片（跟随世界皮肤，零内联样式）。
   * 走 css/base-style.css 里的 .mm-card* 类。
   * v3.55.6 云起专属美化：yqRule 开着 → 挂 yq-skin 专属皮肤（每卡型配色）
   *   + 键名高亮/数值徽章/心声斜体/时徽章 + 结构化行排版；
   *   关闭 → 回退朴素卡片（内容照常显示，只撤美化）。
   */
  function renderCards(cards, openFirst) {
    if (!cards || !cards.length) return '';
    var on = onMap();
    var byName = {};
    rules().forEach(function (r) { byName[r.scriptName] = on[r.id]; });

    return cards.filter(function (c) {
      // 咩咩规则名被显式关闭 → 不渲染（导入咩咩预设时保持原版行为）；
      // 云起美化规则关闭不隐藏卡片，只回退朴素样式。
      if (c.rule && byName[c.rule] === false) return false;
      // 空内容的块不占位（如无战斗时模型会输出 <combat_driver>无</combat_driver>）
      return !/^\s*无\s*$/.test(c.body);
    }).map(function (c, i) {
      var open = (i === 0 && openFirst) ? ' open' : '';
      /* 云起专属美化开关：规则存在且开着才上皮肤；
         导入咩咩预设（无云起美化规则）时 byName[yqRule] === undefined → 朴素渲染 */
      var yqOn = !!(c.yqRule && byName[c.yqRule] === true);
      var body = yqOn ? applyYqPolish(c.body, c.yqRule) : String(c.body == null ? '' : c.body);
      var bodyHtml = yqOn ? yqRows(body) : richText(body);
      var timeHtml = c.time
        ? (yqOn ? ' <span class="yq-time">' + esc(c.time) + '</span>' : ' · ' + esc(c.time))
        : '';
      var cls = 'mm-card mm-card-' + esc(c.key) + (yqOn ? ' yq-skin yq-' + esc(c.key) : '');
      return '<details class="' + cls + '"' + open + '>' +
        '<summary class="mm-card-head"><span class="mm-card-icon">' + c.icon + '</span>' +
        '<span class="mm-card-title">' + esc(c.title) + '</span>' + timeHtml + '</summary>' +
        '<div class="mm-card-body">' + bodyHtml + '</div>' +
        '</details>';
    }).join('');
  }

  /**
   * 解析前预处理：只做「selection → 【行动选项】」与去 AI 味，不抽卡片。
   * 在 extractOptions / extractBody 之前调用，让云境既有的选项按钮与变量解析
   * 都能吃到清理后的文本。卡片抽取留到渲染时（process）。
   */
  function preParse(text) {
    var src = String(text == null ? '' : text);
    /* v3.51.0：<selection> → 【行动选项】这一步始终执行。
       否则玩家关掉正则总开关、或走读档回放路径时，选项按钮会消失、
       <selection> 标签以裸 XML 落进正文。开启正则时再叠一层去 AI 味清理。 */
    var sel = selectionToOptions(src);
    if (!enabled()) return sel;
    return applyPurge(sel);
  }

  /** 供外部（变量解析/导出）复用：只剥协议块与容器标签，不渲染卡片 */
  function stripAll(text) {
    var src = String(text == null ? '' : text);
    if (!enabled()) return src;
    return stripWrappers(extractCards(selectionToOptions(src)).prose);
  }

  /**
   * 一站式处理模型输出：抽出卡片 + selection 转选项 + 去 AI 味。
   * @param {String} text
   * @param {Object} [opt] { always:true } —— 总开关关闭时仍收口协议块（只跳过"去 AI 味"），
   *        保证任何情况下 <status>/<wlog> 都不会以裸 XML 出现在正文里。
   * @returns { prose, cardsHtml, cards }
   */
  function process(text, opt) {
    var src = String(text == null ? '' : text);
    var always = !!(opt && opt.always);
    if (!enabled() && !always) return { prose: src, cardsHtml: '', cards: [] };
    var step1 = extractCards(src);
    var step2 = selectionToOptions(step1.prose);
    var mid = enabled() ? applyPurge(step2) : step2;
    var prose = stripWrappers(mid);
    // 协议块被抽走后会留下空档，压掉连续空行（只压空行，不动任何有内容的行）
    prose = prose.replace(/^\s*\n\s*$/gm, '\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').replace(/\s+$/, '\n');
    /* v3.51.0：首张卡默认展开 —— 玩家状态栏是每轮要看的核心信息，
       全折叠会让人以为「状态栏没了」。其余卡仍折叠，点开即看。 */
    return { prose: prose, cardsHtml: renderCards(step1.cards, true), cards: step1.cards };
  }

  /* ---------------- 目录（供 UI 逐条开关） ---------------- */
  function catalog() {
    var on = onMap();
    return rules().map(function (r) {
      return {
        id: r.id,
        name: r.scriptName,
        kind: kindOf(r),
        on: on[r.id],
        origin: !r.disabled,
        find: r.findRegex || '',
        repl: r.replaceString || '',
        promptOnly: !!r.promptOnly,
        markdownOnly: !!r.markdownOnly
      };
    });
  }

  window.MoMiaomiaoRegex = {
    enabled: enabled,
    setEnabled: setEnabled,
    getOverrides: getOverrides,
    setOverride: setOverride,
    clearOverrides: clearOverrides,
    isOn: isOn,
    ruleOn: ruleOn,
    toRegex: toRegex,
    applyPurge: applyPurge,
    applyCtx: applyCtx,
    extractCards: extractCards,
    stripWrappers: stripWrappers,
    selectionToOptions: selectionToOptions,
    preParse: preParse,
    stripAll: stripAll,
    renderCards: renderCards,
    process: process,
    catalog: catalog,
    CARD_DEFS: CARD_DEFS,
    KIND_MAP: KIND_MAP
  };
})();
