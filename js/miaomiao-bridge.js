/* ============================================================
 * 云境工坊 · 咩咩预设接入层
 * ------------------------------------------------------------
 * 职责：把内嵌预设（preset-miaomiao.js + miaomiao-engine.js）
 *      接到云境的开局设定（config.genreKey / setup.style）上。
 *
 * 只做「对齐」，不改预设任何 prompt 文本：
 *   1) 按当前世界 genreKey → 世界中文名，选中该世界的文风块
 *   2) 按 setup.style 的档位名 → 匹配 📕文风·{世界}｜{档位}
 *   3) 关掉预设出厂默认开着的「📕文风:泛ACG日轻动漫」——
 *      否则任何世界都会被日轻文风污染（这是多选设计里"只留一个开"的要求）
 * ============================================================ */
(function () {
  'use strict';

  var PREFIX = '📕文风·';

  /**
   * 出厂默认开着、但与云境语境冲突 → 渲染时关掉（预设原文一字不动，只翻开关）。
   * 玩家在设置面板里手动打开后，本表对该块失效。
   */
  var DEFAULT_OFF = [
    // 文风：出厂默认日轻，会把任何世界都写成日轻腔；世界文风档生效前必须先关掉
    '📕文风:泛ACG日轻动漫(多选一)',
    // 语言：出厂默认中日双语，会让正文变成"日文原文 + 中文翻译"对照
    '💬语言-中日双语(多选一)',
    // 推理块：要求模型在正文里输出自定义 XML 推理段，云境只剥 <think>，留着变噪音
    '🎭acg角色心理模型(需搭配世界书)',   // 输出 <acg_think>，原文亦标注"需搭配世界书"
    '🧠思维模式-故事(多选一)',            // 输出 <story_driver> 长推理块
    // SillyTavern「预填充」专属 hack：靠伪造 </story_driver></thinking></think> 让模型跳过思考。
    // 云境没有预填充通道，这些串当 system 文本注入只会污染正文。
    '🧷卡原生思维链-预填充-1',
    '🧷卡原生思维链-预填充-2',
    '🧷卡原生思维链-非预填充-系统'
  ];

  /** genreKey → 预设里用的世界中文名 */
  var GENRE_NAME = {
    chaoshenxueyuan: '超神学院',
    cthulhu: '克苏鲁恐怖',
    daoguiyixian: '道诡异仙',
    dibao: '帝霸',
    ditandali: '开局地摊卖大力',
    douluodalu: '斗罗大陆',
    doupocangqiong: '斗破苍穹',
    earth: '地球开放世界',
    fanrenxiuxian: '凡人修仙传',
    free: '自由创作',
    freeworld: '自由世界',
    guimi: '诡秘之主',
    guzhenren: '蛊真人',
    jianlai: '剑来',
    limingzhijian: '黎明之剑',
    longzu: '龙族',
    lunhuileyuan: '轮回乐园',
    mystery: '悬疑推理',
    quanqiubingfeng: '全球冰封',
    quanzhifashi: '全职法师',
    quanzhigaoshou: '全职高手',
    scifi: '科幻未来',
    shengxu: '圣墟',
    shenmifusu: '神秘复苏',
    shrouding: '遮天',
    swallowedstar: '吞噬星空',
    wanmeishijie: '完美世界',
    wulianfengdian: '武炼巅峰',
    wuxia: '武侠仙侠',
    xianni: '仙逆',
    xuanjianxianzu: '玄鉴仙族',
    zhanhen: '斩神',
    zhongshengdushi: '重生之都市修仙',
  };

  /** 预设文风块清单（世界名 → 档位名数组），首次用时构建 */
  var _index = null;
  var _indexSrc = null;
  function currentPreset() {
    try {
      if (window.MoMiaomiao && typeof window.MoMiaomiao.preset === 'function') {
        var p = window.MoMiaomiao.preset();
        if (p) return p;
      }
    } catch (e) { }
    /* v3.55.5：内置默认改「云起预设」 */
    return window.YUNQI_PRESET || window.MIAOMIAO_PRESET || null;
  }
  function index() {
    /* v3.55.5：跟「当前生效预设」走——玩家导入的预设若也带 📕文风· 块，照样对齐；
       预设换了索引跟着重建（缓存绑定预设对象本身） */
    var p = currentPreset();
    if (_index && _indexSrc === p) return _index;
    _index = {};
    _indexSrc = p;
    if (!p || !p.prompts) return _index;
    p.prompts.forEach(function (b) {
      var name = b.name || '';
      if (name.indexOf(PREFIX) !== 0) return;
      var rest = name.slice(PREFIX.length);
      var i = rest.indexOf('｜');
      if (i < 0) return;
      var world = rest.slice(0, i);
      var pick = rest.slice(i + 1);
      (_index[world] = _index[world] || []).push(pick);
    });
    return _index;
  }

  /** 当前世界中文名 */
  function worldName() {
    var cfg = window.storyFramework && window.storyFramework.config;
    if (!cfg) return '';
    var key = cfg.genreKey || '';
    if (GENRE_NAME[key]) return GENRE_NAME[key];
    // 兜底：用 genreName 直接比
    var gn = cfg.genreName || '';
    var idx = index();
    return idx[gn] ? gn : '';
  }

  /**
   * 解析当前应启用的文风块名。
   * 优先级：玩家显式选的 setup.style → 该世界第一档（推荐档）
   */
  function resolveStyleBlock() {
    var world = worldName();
    if (!world) return '';
    var picks = index()[world] || [];
    if (!picks.length) return '';

    var setup = window.storyFramework && window.storyFramework.storyState && window.storyFramework.storyState.setup;
    var want = (setup && setup.style) || '';

    // 1) 完全同名
    if (want && picks.indexOf(want) >= 0) return PREFIX + world + '｜' + want;

    // 2) setup.style 是「名字（描述）」形式，剥离括号后再比
    var bare = want.replace(/[（(].*?[)）]\s*$/, '').trim();
    if (bare && picks.indexOf(bare) >= 0) return PREFIX + world + '｜' + bare;

    // 3) 包含匹配（玩家选「原著文风」→ 命中「原著文风·xxx（推荐）」）
    if (bare) {
      for (var i = 0; i < picks.length; i++) {
        if (picks[i].indexOf(bare) === 0 || bare.indexOf(picks[i]) === 0) {
          return PREFIX + world + '｜' + picks[i];
        }
      }
      // 4) 关键词命中（如 style 含「恐怖」）
      for (var j = 0; j < picks.length; j++) {
        if (picks[j].indexOf(bare) >= 0) return PREFIX + world + '｜' + picks[j];
      }
    }

    // 5) 兜底：该世界第一档（约定第一档是「推荐」）
    return PREFIX + world + '｜' + picks[0];
  }

  /**
   * 生成渲染选项：把"该世界这一档文风"作为 overrides 临时打开，
   * 并把预设出厂的日轻默认档关掉。不动 localStorage，纯运行时。
   */
  function buildRenderOpts() {
    var extraOn = [];
    var extraOff = DEFAULT_OFF.slice();

    var pick = resolveStyleBlock();
    if (pick) extraOn.push(pick);

    // 玩家若在设置面板里手动开了别的文风档，尊重玩家：不再强制关日轻
    var ov = window.MoMiaomiao && window.MoMiaomiao.getOverrides ? window.MoMiaomiao.getOverrides() : {};
    Object.keys(ov).forEach(function (k) {
      if (ov[k] && k.indexOf(PREFIX) === 0) extraOn.push(k);
      // 玩家显式开过的块，取消强制关闭
      if (ov[k]) extraOff = extraOff.filter(function (x) { return x !== k; });
    });

    return { on: extraOn, off: extraOff, pick: pick, world: worldName() };
  }

  /**
   * 渲染预设正文。返回 '' 表示未启用或无内容。
   * @param {object} opt { char, user }
   */
  function render(opt) {
    var M = window.MoMiaomiao;
    if (!M || typeof M.renderWithOverrides !== 'function') return '';
    if (typeof M.enabled === 'function' && !M.enabled()) return '';

    var o = opt || {};
    var plan = buildRenderOpts();

    // 临时注入：用 renderWithOverrides 的机制，但覆盖表来自"玩家设置 + 本世界默认"
    var saved = M.getOverrides ? M.getOverrides() : {};
    var merged = {};
    Object.keys(saved).forEach(function (k) { merged[k] = saved[k]; });
    plan.off.forEach(function (n) { merged[n] = false; });
    plan.on.forEach(function (n) { if (merged[n] === undefined) merged[n] = true; });

    var r;
    try {
      // 直接给引擎一份合并后的覆盖表：复用它的匹配逻辑
      r = renderWith(M, merged, o);
    } catch (e) {
      return '';
    }
    var txt = (r && r.system) || '';
    return txt ? tidy(txt) : '';
  }

  /**
   * 渲染后清理：预设「格式流水线」是一串 `→ {{getvar::xxx}}`。
   * 当某一步对应的功能块被关闭时，变量为空 —— 会留下孤立的 `→ ` 空行。
   * 这里只删这类空行（以及连续空行），不动任何有内容的行。
   */
  function tidy(text) {
    var out = text
      .replace(/^[ \t]*→[ \t]*$/gm, '')       // 孤立箭头行
      .replace(/\n{3,}/g, '\n\n');            // 连续空行压成一个
    // 思维模式关闭后，铁律里"必须出现在 </story_driver> 之后"这句指向已不存在的标签。
    // 只在该标签确实不存在时改写措辞，原文其他部分一字不动。
    if (out.indexOf('<story_driver>') < 0) {
      out = out.replace(
        /<story_scene>必须且只能出现在<\/story_driver>之后、<memory_log>之前。/g,
        '<story_scene>必须出现在正文最前、<memory_log>之前。'
      );
    }
    return out;
  }

  /** 用给定覆盖表调引擎（不改 localStorage） */
  function renderWith(M, ov, opt) {
    var p = M.preset ? M.preset() : (window.YUNQI_PRESET || window.MIAOMIAO_PRESET || null);
    if (!p) return { system: '', vars: {}, included: [] };
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

    var vars = {};
    var ctx = { char: (opt && opt.char) || '角色', user: (opt && opt.user) || '你' };
    var parts = [], included = [];
    ordered.forEach(function (it) {
      if (!it.on) return;
      var r = M.expand(M.contentOf ? M.contentOf(it.blk) : it.blk.content, vars, ctx);
      /* v3.55.5：marker 块展开后为空才跳（自定义预设 marker 里有实文时保留） */
      if (it.blk.marker && (!r.text || !r.text.trim())) return;
      if (!r.text || !r.text.trim()) return;
      parts.push(r.text.trim());
      included.push(it.blk.name || it.blk.identifier);
    });
    return { system: parts.join('\n\n'), vars: vars, included: included };
  }

  /** 当前世界的档位列表（供 UI 下拉） */
  function listStyles(world) {
    var w = world || worldName();
    return (index()[w] || []).slice();
  }

  /** 列出所有世界的名字（调试/UI 用） */
  function listWorlds() {
    return Object.keys(index());
  }

  window.MoMiaomiaoBridge = {
    worldName: worldName,
    resolveStyleBlock: resolveStyleBlock,
    buildRenderOpts: buildRenderOpts,
    render: render,
    listStyles: listStyles,
    listWorlds: listWorlds,
    DEFAULT_OFF: DEFAULT_OFF,
    GENRE_NAME: GENRE_NAME
  };
})();
