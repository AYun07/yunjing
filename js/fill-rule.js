/* 云境 · 填表规则 FillRule v1.0.0（v4.28.0）
 * ---------------------------------------------------------------------------
 * 用户诉求：填表要遵循正文内容与填表规则，并设计成两套：
 *   ① 严格演算（strict）：修为进度等须按当前资质 + 各项因素综合、经严格数值
 *      计算得出，每次填入都要有数值推导依据，不许口胡；一切按实际情况依规则。
 *   ② 玩家自由（free）：玩家可以口胡，一切以玩家为主——玩家说有什么就加什么，
 *      玩家说什么就是什么。
 *
 * 本模块是两套规则的「单一事实源」：配置读写 + 契约分叉 + 校验决策 + 面板标记。
 * 各消费方（status-schema / attribute-engine / variable-parser）只查询本模块，
 * 不各自散落判断，保证规则同源。
 */
(function () {
  'use strict';

  var KEY = 'yunjingFillMode';          // 'strict' | 'free'
  var DEFAULT = 'strict';               // 默认严格演算

  /* ---------- 配置读写 ---------- */
  function mode() {
    try { var v = localStorage.getItem(KEY); return (v === 'strict' || v === 'free') ? v : DEFAULT; }
    catch (e) { return DEFAULT; }
  }
  function setMode(v) {
    v = (v === 'free') ? 'free' : 'strict';
    try { localStorage.setItem(KEY, v); } catch(e){console.warn("[swallowed] fill-rule",e)}
    try { window.dispatchEvent(new CustomEvent('yj:fillmode-changed', { detail: { mode: v } })); } catch(e){console.warn("[swallowed] fill-rule",e)}
    return v;
  }
  function isStrict() { return mode() === 'strict'; }
  function isFree() { return mode() === 'free'; }

  /* ---------- 两套规则的元数据（供面板 / 标记 / 契约共用） ---------- */
  var RULES = {
    strict: {
      id: 'strict',
      name: '严格演算',
      icon: '🧮',
      short: '严格',
      desc: '数值按资质、当前值与各项因素综合推导，每次填入都有计算依据，禁止凭空跳变',
      badge: '🧮 严格演算 · 数值须有推导'
    },
    free: {
      id: 'free',
      name: '玩家自由',
      icon: '🪶',
      short: '自由',
      desc: '玩家说什么就是什么——玩家说有什么就加什么，一切以玩家为主，不做钳制不质疑',
      badge: '🪶 玩家自由 · 玩家说了算'
    }
  };
  function meta() { return RULES[mode()]; }

  /* ---------- 契约分叉：给 AI 的填表指令 ----------
     由 buildReportDirective() 追加到状态栏上报契约末尾，两种模式给出截然不同的行为准则。 */
  function directive() {
    var base = isStrict() ? strictDirective() : freeDirective();
    /* v6.3.7：严格演算下追加「本世界境界数值比对」契约（原著阶梯钉死 + 跨境界越级规则）。
       free 模式玩家说了算，不注入境界钳制。CompareEngine/RealmRules 缺失或异常时静默跳过，不影响原逻辑。 */
    if (isStrict()) {
      try {
        var genre = (window.storyFramework && window.storyFramework.config && window.storyFramework.config.genreKey)
          || (typeof location !== 'undefined' && new URLSearchParams(location.search).get('genre')) || '';
        if (genre && window.CompareEngine && window.CompareEngine.contractLine) {
          var line = window.CompareEngine.contractLine(genre);
          if (line) base += '\n' + line;
        }
      } catch (e) { /* 境界契约异常不影响填表规则 */ }
    }
    return base;
  }

  function strictDirective() {
    return '\n【填表规则·严格演算（引擎强制校验）】本模式一切数值必须有推导依据，禁止口胡、禁止凭空跳变：\n' +
      '1) 修为/境界进度、属性、资源等数值，必须综合「当前值 + 资质档位 + 近期数值变动 + 时间跨度 + 期间活动」按下列公式推导后填写，不得随剧情need随意给点数。\n' +
      '2) 每填一个数值，先在心里算清：本轮跨度几天、该轴涨点额度多少、资质系数几档、是否逼近瓶颈——再写结果；正文必须交代得出该数值的缘由（闭关、丹药、激战、疗伤等）。\n' +
      '3) 引擎会强制钳制：单项单轮增减 ≤6、全部合计 ≤10（有时间跨度则按各轴额度放宽）、值域 0-100；无正文依据或与推导不符的跳变会被真实截掉/按公式改写。\n' +
      '4) 发生时间跨越务必写「时间.跨度: N」与期间活动，引擎会据此按公式结算成长；你上报不足的部分引擎会自动补齐，但补齐只看跨度——若期间另有奇遇/跌落，须自行写明。\n' +
      '5) 事实类字段（所在/处境/关系/物品）须与正文已发生的事一致，不得凭空新增正文里没出现的东西；确实没有填「无」。\n' +
      '6) 填表必须填全：协议要求的每个字段都要出现在变量块里，一个都不能漏。本轮没有变化的字段照抄上一轮的值，确实没有的填「无」或保留原值——绝不只填一部分、绝不省略整行字段。';
  }

  function freeDirective() {
    return '\n【填表规则·玩家自由（玩家优先）】本模式一切以玩家为主，玩家说什么就是什么：\n' +
      '1) 玩家在发言/设定里明确给出的数值、物品、身份、关系、境界、进度等，一律照单全收、直接采信——玩家说有什么就填什么，不做钳制、不质疑、不要求解释缘由。\n' +
      '2) 玩家说「我直接突破到筑基」「我得到一把神器」「我有九个魂环」，即使与前文数值/资质不符，也以玩家最新发言为准覆盖旧值；正文按玩家所说顺势成立，不得反驳或打折。\n' +
      '3) 玩家没说的字段才由你按剧情合理补全；玩家一旦明示，玩家优先于任何既有数值、资质档位与推演公式。\n' +
      '4) 引擎在本模式关闭数值钳制与自动补涨——填多少就是多少，不截不补；数值跳动不需要严格推导，玩家意志即最高规则。\n' +
      '5) 填表必须填全：协议要求的每个字段都要出现在变量块里，一个都不能漏；本轮没变化的照抄上一轮值，没有的填「无」或保留原值，不得只填一部分。';
  }

  /* ---------- 校验决策：variable-parser 调用 ----------
     strict: 保留引擎钳制 + 时间补涨；free: 两者都跳过。 */
  function shouldEnforceEngine() { return isStrict(); }   // applyStatDelta 钳制
  function shouldSettleGrowth() { return isStrict(); }    // settleTimeGrowth 自动补涨

  /* ---------- v6.3.6 玩家每轮明确要求识别 ----------
     默认 strict 卡死，但玩家在某轮发言里用「强指令句式」明确要数值/境界/物品/身份时，
     该轮数值写入按 free 放行，无需手动切模式。只认明确祈使，不把普通剧情叙述当要求，
     控制误报。返回 true=本轮玩家明确要求放行。 */
  var PLAYER_WANT_PATTERNS = [
    /我\s*(?:直接|立刻|马上)?\s*(?:突破|晋级|升到|到达|达到|变成|拥有|获得|得到|有)\s*(?:到)?\s*(?:筑基|金丹|元婴|化神|炼虚|合体|大乘|渡劫|仙人|神|魂圣|魂帝|魂王|斗罗|[一二三四五六七八九十百千万\d]+\s*(?:阶|级|层|环|重|段))/i,
    /(?:给我|赏我|赐我|我要|我想要|我要一?件?|请给我|直接给我|我要成为|我要拥有)\s*(?:一?[件把颗枚座个数只头名]?)?\s*(?:神器|仙器|法宝|神兵|至宝|丹药|功法|灵药|魂环|魂骨|武器|装备|身份|血脉|天赋|灵根)/i,
    /(?:我\s*有|我\s*得到|我\s*获得|我\s*拿到)\s*[一二三四五六七八九十百千万\d]+\s*(?:个|枚|件|条|道|只|头|阶|级|层|环|重)/i,
    /(?:直接|立即|马上)\s*(?:把|将)?\s*(?:我的)?\s*(?:修为|境界|等级|属性|数值|灵力|魂力|力量|体质)\s*(?:提到|拉到|涨到|升到|设为|变成|加到)\s*[一二三四五六七八九十百千万\d]+/i,
    /(?:无视规则|打破规则|不受限制|我要开挂|开挂|作弊|口胡吧|随便写|我要\d+\s*点|给我\d+\s*点)/i
  ];
  function playerWantsException(text) {
    if (!isStrict()) return false;   // free 模式本来就放行，无需识别
    var s = String(text || '');
    if (!s) return false;
    for (var i = 0; i < PLAYER_WANT_PATTERNS.length; i++) {
      if (PLAYER_WANT_PATTERNS[i].test(s)) return true;
    }
    return false;
  }

  /* ---------- 面板开关 HTML（嵌入 status-schema 设置面板） ---------- */
  function settingsHTML() {
    var m = mode();
    return '<div class="yj-set-sec">填表规则（数值/状态如何写入）</div>' +
      '<div class="yj-fill-mode">' +
        '<button type="button" class="yj-fill-opt' + (m === 'strict' ? ' on' : '') + '" onclick="FillRule.setFromUI(\'strict\')">' +
          '<b>🧮 严格演算</b><i>按资质+各项因素严格计算，不许口胡</i></button>' +
        '<button type="button" class="yj-fill-opt' + (m === 'free' ? ' on' : '') + '" onclick="FillRule.setFromUI(\'free\')">' +
          '<b>🪶 玩家自由</b><i>玩家说有什么就有什么，玩家说了算</i></button>' +
      '</div>' +
      '<div class="yj-set-note">' + meta().desc + '。切换立即生效，随存档保留。</div>' +
      /* v6.3.7 境界数值比对入口：查看本世界原著阶梯、跨境界越级比对、自创体系对标 */
      '<div class="yj-set-sec">境界数值比对（v6.3.7）</div>' +
      '<div class="yj-set-note">原著境界阶梯已钉死；顶级天骄可跨境界对敌、极境按原著明示、玩家自创体系按能级对标——均给出数值比对报告。</div>' +
      '<button type="button" class="btn-ghost btn-mini" onclick="window.ComparePanel && ComparePanel.open()" title="查看本世界境界阶梯 / 跨境界比对 / 自创体系对标">⚔ 打开境界比对面板</button>';
  }

  function setFromUI(v) {
    setMode(v);
    // 重开设置面板以刷新选中态；状态栏标记随下次 render 更新
    try { if (window.StatusSchema && window.StatusSchema.openSettings) window.StatusSchema.openSettings(); } catch(e){console.warn("[swallowed] fill-rule",e)}
    try { if (window.storyFramework && window.storyFramework.updateStatusPanel) window.storyFramework.updateStatusPanel(); } catch(e){console.warn("[swallowed] fill-rule",e)}
    try { if (window.StatusSchema && window.StatusSchema.render) window.StatusSchema.render(); } catch(e){console.warn("[swallowed] fill-rule",e)}
  }

  /* ---------- 面板标记（供状态栏标题区显示当前规则） ---------- */
  function flagHTML() {
    var m = meta();
    return '<span class="yj-st-flag fill-' + m.id + '" title="' + m.desc + '">' + m.badge + '</span>';
  }

  window.FillRule = {
    KEY: KEY, DEFAULT: DEFAULT, RULES: RULES,
    mode: mode, setMode: setMode, setFromUI: setFromUI,
    isStrict: isStrict, isFree: isFree, meta: meta,
    directive: directive,
    shouldEnforceEngine: shouldEnforceEngine, shouldSettleGrowth: shouldSettleGrowth,
    playerWantsException: playerWantsException,
    settingsHTML: settingsHTML, flagHTML: flagHTML
  };
})();
