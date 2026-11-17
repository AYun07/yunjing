/* 云境 · 填表规则 FillRule v1.0.0（v4.27.0）
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
    try { localStorage.setItem(KEY, v); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('yj:fillmode-changed', { detail: { mode: v } })); } catch (e) {}
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
    return isStrict() ? strictDirective() : freeDirective();
  }

  function strictDirective() {
    return '\n【填表规则·严格演算（引擎强制校验）】本模式一切数值必须有推导依据，禁止口胡、禁止凭空跳变：\n' +
      '1) 修为/境界进度、属性、资源等数值，必须综合「当前值 + 资质档位 + 近期数值变动 + 时间跨度 + 期间活动」按下列公式推导后填写，不得随剧情need随意给点数。\n' +
      '2) 每填一个数值，先在心里算清：本轮跨度几天、该轴涨点额度多少、资质系数几档、是否逼近瓶颈——再写结果；正文必须交代得出该数值的缘由（闭关、丹药、激战、疗伤等）。\n' +
      '3) 引擎会强制钳制：单项单轮增减 ≤6、全部合计 ≤10（有时间跨度则按各轴额度放宽）、值域 0-100；无正文依据或与推导不符的跳变会被真实截掉/按公式改写。\n' +
      '4) 发生时间跨越务必写「时间.跨度: N」与期间活动，引擎会据此按公式结算成长；你上报不足的部分引擎会自动补齐，但补齐只看跨度——若期间另有奇遇/跌落，须自行写明。\n' +
      '5) 事实类字段（所在/处境/关系/物品）须与正文已发生的事一致，不得凭空新增正文里没出现的东西；确实没有填「无」。';
  }

  function freeDirective() {
    return '\n【填表规则·玩家自由（玩家优先）】本模式一切以玩家为主，玩家说什么就是什么：\n' +
      '1) 玩家在发言/设定里明确给出的数值、物品、身份、关系、境界、进度等，一律照单全收、直接采信——玩家说有什么就填什么，不做钳制、不质疑、不要求解释缘由。\n' +
      '2) 玩家说「我直接突破到筑基」「我得到一把神器」「我有九个魂环」，即使与前文数值/资质不符，也以玩家最新发言为准覆盖旧值；正文按玩家所说顺势成立，不得反驳或打折。\n' +
      '3) 玩家没说的字段才由你按剧情合理补全；玩家一旦明示，玩家优先于任何既有数值、资质档位与推演公式。\n' +
      '4) 引擎在本模式关闭数值钳制与自动补涨——填多少就是多少，不截不补；数值跳动不需要严格推导，玩家意志即最高规则。';
  }

  /* ---------- 校验决策：variable-parser 调用 ----------
     strict: 保留引擎钳制 + 时间补涨；free: 两者都跳过。 */
  function shouldEnforceEngine() { return isStrict(); }   // applyStatDelta 钳制
  function shouldSettleGrowth() { return isStrict(); }    // settleTimeGrowth 自动补涨

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
      '<div class="yj-set-note">' + meta().desc + '。切换立即生效，随存档保留。</div>';
  }

  function setFromUI(v) {
    setMode(v);
    // 重开设置面板以刷新选中态；状态栏标记随下次 render 更新
    try { if (window.StatusSchema && window.StatusSchema.openSettings) window.StatusSchema.openSettings(); } catch (e) {}
    try { if (window.storyFramework && window.storyFramework.updateStatusPanel) window.storyFramework.updateStatusPanel(); } catch (e) {}
    try { if (window.StatusSchema && window.StatusSchema.render) window.StatusSchema.render(); } catch (e) {}
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
    settingsHTML: settingsHTML, flagHTML: flagHTML
  };
})();
