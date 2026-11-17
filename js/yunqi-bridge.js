/* ============================================================
 * 云境工坊 · 云起预设接入层
 * ------------------------------------------------------------
 * 职责：把内嵌预设（preset-yunqi.js + yunqi-engine.js）
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
    dazhuzai: '大主宰',
    wangyou: '寰宇纪元',
    wanxiangzhiwang: '万相之王',
    wudongqiankun: '武动乾坤',
    yuanzun: '元尊'
  };

  /* v4.11.0 内置文风兜底（本世界文风适配）：预设 YunqiPreset 出厂只带通用 🎨文风· 块，
     未为各世界做「📕文风·{世界}｜档位」分档，导致 resolveStyleBlock 对 38 界恒为空。
     此处给出云境内置的「本世界文风适配」文本——皆基于各界公认风格的客观短述，
     不臆造具体人名/情节；当预设无该界文风块时自动回退，保证 38/38 非空、可验证。
     键必须同步 GENRE_NAME 的「世界中文名」。 */
  var BUILTIN_STYLE = {
    "超神学院": "硬核科幻军武混搭神话史诗，台词凌厉、场面宏大，英雄主义与黑色幽默并存。",
    "克苏鲁恐怖": "不可名状的恐惧，细碎感官描写堆出荒诞压抑，真相永远残缺，理性在恐惧中崩解。",
    "道诡异仙": "亦真亦幻的双线呓语，现代精神病院与修仙大乾交错，偏执、错乱、梦魇式笔调。",
    "帝霸": "洪荒史诗腔，万古长恨、帝路争渡，气势磅礴的文言白话交融，独白式宏大叙事。",
    "开局地摊卖大力": "接地气的市井爽文，贱兮兮的摆摊叫卖与逆袭打脸，口语化、节奏快。",
    "斗罗大陆": "热血少年漫式成长，武魂觉醒、伙伴羁绊，明快燃向、章回清晰。",
    "斗破苍穹": "退婚流爽文鼻祖，莫欺少年穷的怒张与三十年河东的回敬，升级明快、情绪拉满。",
    "地球开放世界": "现代都市写实底，事件驱动、因果当先，笔触克制不炫技。",
    "凡人修仙传": "凡人流冷峻写实，算计与机缘交织，时间跨度大、细节扎实，主角寡言利己。",
    "自由创作": "无固定调性，依玩家设定与当前题材临场贴合，文风随题材流动。",
    "自由世界": "原创沙盒，笔调随玩家笔触走，重在地界风物与人物百态的如实铺陈。",
    "诡秘之主": "维多利亚蒸汽与克苏鲁交织，优雅冷峻的悬疑笔调，序列晋升与塔罗密语，考据味浓。",
    "蛊真人": "智斗流冷硬写实，人心比蛊毒更险，算无遗策的布局与反杀，阴暗克制不煽情。",
    "剑来": "儒家山水闲笔，长短句交错、留白极多，市井烟火与大道至简，温润而有锋芒。",
    "黎明之剑": "蒸汽魔法工业文明，理性考据与宏大叙事并行，硬核设定配轻快群像。",
    "龙族": "青春热血混搭北欧神话，华丽喧嚣的都市奇幻，荷尔蒙与中二并存，结尾常带悲怆。",
    "轮回乐园": "无限流冷酷效率，任务简报式硬核，杀伐果断、数据驱动，契约者视角零温情。",
    "悬疑推理": "抽丝剥茧的冷叙事，细节伏笔密布，对话克制、节奏紧，真相在最后一线浮出。",
    "全球冰封": "灾难生存纪实感，低温下的秩序崩坏与人性微光，白描冷峻、留有余寒。",
    "全职法师": "魔法都市爽文，元素炫技与学府争锋，升级明快、场面炽烈。",
    "全职高手": "电竞热血群像，操作术语密集、团队羁绊浓，轻松中见执着与荣耀。",
    "科幻未来": "硬科幻或太空歌剧，概念先行、逻辑自洽，冷峻想象与人文观照并行。",
    "圣墟": "后文明复苏的诡谲史诗，花粉路与场域层叠，苍凉中藏热血，意象瑰奇。",
    "神秘复苏": "规则怪谈式灵异，深夜敲门声的细碎惊悚，禁忌分明、写实冷感、余味发凉。",
    "遮天": "古典神话史诗，九龙拉棺的苍凉开篇，大帝长歌、悲壮恢弘，文言底蕴厚重。",
    "吞噬星空": "宇宙级升级流，从地球到起源大陆的磅礴视野，硬核科幻混修真，节奏恢弘。",
    "完美世界": "荒天帝独断万古的洪荒童话，纯净热血、意象磅礴，少年气与史诗感并重。",
    "武炼巅峰": "玄幻武道爽文，以武证道的硬桥硬马，升级打脸明快、胜负利落。",
    "武侠仙侠": "古典侠气与仙风并济，刀光剑影里见人情，白描江湖、留白山水。",
    "仙逆": "顺为凡逆则仙的逆修执念，杀伐决断、因果森然，冷峻孤绝的修真长卷。",
    "玄鉴仙族": "修仙世家种田流，族谱脉络与灵脉经营，平淡中见兴衰，工笔细绘。",
    "斩神": "都市神明禁行，热血战斗与黑色幽默交织，快节奏、画面感强、台词利落。",
    "重生之都市修仙": "重生逆袭爽文，前世记忆加持下的从容布局，都市与仙途双线明快。",
    "大主宰": "大千世界主宰流，灵力与至尊的恢弘征途，热血燃向、群雄并起。",
    "寰宇纪元": "原创网游电竞写实，赛季攻防与团队博弈，术语精准、节奏紧凑、临场感强。",
    "万相之王": "相术神州的热血成长，十柱金台、品阶分明，少年逆袭明快、场面华丽。",
    "武动乾坤": "天玄大陆武道征途，祖石与符师交织，硬桥硬马、家族恩怨、升级利落。",
    "元尊": "诸天源气修行，圣源争夺与王朝博弈，清俊温润中藏锋芒，成长线清晰。",
    /* generic 兜底（世界名以 generic 形态出现时） */
    "武侠": "古典侠气与仙风并济，刀光剑影里见人情，白描江湖、留白山水。",
    "克苏鲁": "不可名状的恐惧，细碎感官描写堆出荒诞压抑，理性在恐惧中崩解。",
    "悬疑": "抽丝剥茧的冷叙事，细节伏笔密布，真相在最后一线浮出。",
    "科幻": "硬科幻或太空歌剧，概念先行、逻辑自洽，冷峻想象与人文观照并行。"
  };

  /** 预设文风块清单（世界名 → 档位名数组），首次用时构建 */
  var _index = null;
  var _indexSrc = null;
  function currentPreset() {
    try {
      if (window.YunqiPreset && typeof window.YunqiPreset.preset === 'function') {
        var p = window.YunqiPreset.preset();
        if (p) return p;
      }
    } catch (e) { }
    /* v3.55.5：内置默认改「云起预设」 */
    return window.YUNQI_PRESET || null;
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
    if (!picks.length) {
      /* v4.11.0 内置兜底：预设未为各世界分档文风时，用云境内置「本世界文风适配」，
         保证 38 界全部有文风档（此前 38/38 空属预设数据源特性，非代码缺陷）。 */
      if (BUILTIN_STYLE[world]) return 'BUILTIN:' + world;
      return '';
    }

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
    if (pick) {
      if (pick.indexOf('BUILTIN:') === 0) {
        /* 内置文风不走预设块开关，交给 render() 直接注入 */
        return { on: [], off: DEFAULT_OFF.slice(), pick: pick, world: worldName(), builtin: pick.slice('BUILTIN:'.length) };
      }
      extraOn.push(pick);
    }

    // 玩家若在设置面板里手动开了别的文风档，尊重玩家：不再强制关日轻
    var ov = window.YunqiPreset && window.YunqiPreset.getOverrides ? window.YunqiPreset.getOverrides() : {};
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
  // v3.70.0 性能：预设渲染结果按「覆盖表+角色+用户+世界+预设指纹」缓存，
  // 同一局内预设基本不变，避免每轮请求重建上万字 system 片段。
  var _renderCache = null;
  function presetFingerprint() {
    var p = window.YunqiPreset && (window.YunqiPreset.preset ? window.YunqiPreset.preset() : (window.YUNQI_PRESET || null));
    if (!p || !p.prompts || !p.prompts.length) return 'none';
    return p.prompts.length + ':' + (p.prompts[0].identifier || '');
  }
  function render(opt) {
    var M = window.YunqiPreset;
    if (!M || typeof M.renderWithOverrides !== 'function') return '';
    if (typeof M.enabled === 'function' && !M.enabled()) return '';

    var o = opt || {};
    var plan = buildRenderOpts();
    /* v4.11.0 内置文风兜底：直接返回云境内置文本，不走预设引擎 */
    if (plan.builtin) {
      var _bt = BUILTIN_STYLE[plan.builtin];
      return _bt ? tidy('【本世界文风适配】\n' + _bt) : '';
    }

    // 临时注入：用 renderWithOverrides 的机制，但覆盖表来自"玩家设置 + 本世界默认"
    var saved = M.getOverrides ? M.getOverrides() : {};
    var merged = {};
    Object.keys(saved).forEach(function (k) { merged[k] = saved[k]; });
    plan.off.forEach(function (n) { merged[n] = false; });
    plan.on.forEach(function (n) { if (merged[n] === undefined) merged[n] = true; });

    var key = JSON.stringify(merged) + '|' + (o.char || '') + '|' + (o.user || '') + '|' + worldName() + '|' + presetFingerprint();
    if (_renderCache && _renderCache.key === key) return _renderCache.val;

    var r;
    try {
      // 直接给引擎一份合并后的覆盖表：复用它的匹配逻辑
      r = renderWith(M, merged, o);
    } catch (e) {
      return '';
    }
    var txt = (r && r.system) || '';
    txt = txt ? tidy(txt) : '';
    _renderCache = { key: key, val: txt };
    return txt;
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
    var p = M.preset ? M.preset() : (window.YUNQI_PRESET || null);
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

  window.YunqiPresetBridge = {
    worldName: worldName,
    resolveStyleBlock: resolveStyleBlock,
    buildRenderOpts: buildRenderOpts,
    render: render,
    invalidate: function () { _renderCache = null; },
    listStyles: listStyles,
    listWorlds: listWorlds,
    DEFAULT_OFF: DEFAULT_OFF,
    GENRE_NAME: GENRE_NAME,
    BUILTIN_STYLE: BUILTIN_STYLE
  };
})();
