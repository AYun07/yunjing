/* 云境 · 推理强度（思考档位）v1.0.0（v4.17.2）
 *
 * 为什么有它
 *   目标玩家用的多是**会思考的模型**（deepseek-v4.1-flash / gemini-3.5+ / claude-3+ 这一档）。
 *   实测（4 个推理模型真实调用）思考长度是正文的 3～19 倍：
 *       nemotron-3-ultra-550b  正文 233 字 / 思考 3997 字
 *       minimax-m3.1-flash     正文 253 字 / 思考 3938 字
 *       glm-5.3-flash          正文 207 字 / 思考 1428 字
 *       step-5-preview         正文 235 字 / 思考 1178 字
 *   思考太长会：①吃掉输出额度导致正文空返回 ②变慢 ③按 token 计费时更贵。
 *   而思考太短又会在复杂剧情上变笨。这个取舍**必须交给玩家**，因为不同模型差别极大
 *   （同样"中思考"，glm 想 1400 字、nemotron 想 4000 字，差 3 倍）。
 *
 * 五个档位
 *   off 关闭思考 · low 弱思考 · medium 中思考 · high 高思考 · max 完全思考
 *
 * 各厂商参数名完全不同（这是本模块存在的主要理由）
 *   OpenAI o系/gpt-5 : reasoning_effort: minimal|low|medium|high
 *   DeepSeek         : thinking:{type:enabled|disabled}（新版另有 reasoning_effort）
 *   Anthropic Claude : thinking:{type:enabled, budget_tokens:N}（关闭＝不带该字段）
 *   Google Gemini    : generationConfig.thinkingConfig.thinkingBudget:N（0＝关）
 *   通义千问 dashscope: enable_thinking:bool + thinking_budget:N
 *   智谱 GLM         : thinking:{type:enabled|disabled}
 *   其它 OpenAI 兼容 : 退化为 reasoning_effort（被广泛容忍）
 *
 * 最重要的一条设计：**不认识该参数的接口会直接 400**
 *   所以本模块配了「自适应退回」——某端点一旦因推理参数报 400，就记住它、
 *   之后不再加这些字段（见 markUnsupported / isUnsupported）。宁可没有档位，
 *   也不能因为加了个参数让玩家直接发不出请求。
 */
(function () {
  'use strict';

  var LEVELS = ['off', 'low', 'medium', 'high', 'max'];
  var LABELS = {
    off: '关闭思考', low: '弱思考', medium: '中思考', high: '高思考', max: '完全思考'
  };
  /* 各档位的思考预算（token）。off 为 0；max 用 -1 表示交给厂商自己决定上限 */
  var BUDGET = { off: 0, low: 1024, medium: 4096, high: 16384, max: -1 };
  /* 各档位建议的输出额度下限：思考越多，正文越容易被挤掉，额度要相应抬高 */
  var TOKEN_FLOOR = { off: 4096, low: 8192, medium: 16384, high: 32768, max: 32768 };

  /* 端点因推理参数不兼容而被标记的集合（会话级；key 用 host） */
  var _unsupported = {};

  function hostOf(endpoint) {
    try { return new URL(String(endpoint || '')).host.toLowerCase(); } catch (e) { return ''; }
  }
  function markUnsupported(endpoint) {
    var h = hostOf(endpoint);
    if (h) _unsupported[h] = true;
  }
  function isUnsupported(endpoint) {
    var h = hostOf(endpoint);
    return !!(h && _unsupported[h]);
  }

  /** 按端点与模型名判断厂商。返回 'openai'|'deepseek'|'anthropic'|'gemini'|'qwen'|'glm'|'generic' */
  function vendorOf(endpoint, model) {
    var h = hostOf(endpoint);
    var m = String(model || '').toLowerCase();
    if (/generativelanguage\.googleapis\.com|gemini/.test(h + ' ' + m) || /^gemini/.test(m)) return 'gemini';
    if (/api\.anthropic\.com/.test(h) || /claude/.test(m)) return 'anthropic';
    if (/api\.deepseek\.com/.test(h) || /deepseek/.test(m)) return 'deepseek';
    if (/dashscope|aliyuncs/.test(h) || /^qwen/.test(m)) return 'qwen';
    if (/bigmodel\.cn|zhipu/.test(h) || /^glm/.test(m)) return 'glm';
    if (/api\.openai\.com/.test(h) || /^(o[1-9]|gpt-[5-9])/.test(m)) return 'openai';
    return 'generic';
  }

  /**
   * 把档位写进请求体（就地修改 body）。
   * @param {object} body     请求体（会被修改）
   * @param {string} level    off|low|medium|high|max
   * @param {object} ctx      { endpoint, model }
   * @returns {object}        { applied:boolean, vendor:string, fields:string[], reason?:string }
   */
  function apply(body, level, ctx) {
    ctx = ctx || {};
    var lv = LEVELS.indexOf(level) >= 0 ? level : 'medium';
    if (!body || typeof body !== 'object') return { applied: false, vendor: '-', fields: [], reason: '无请求体' };
    if (isUnsupported(ctx.endpoint)) {
      return { applied: false, vendor: vendorOf(ctx.endpoint, ctx.model), fields: [], reason: '该端点此前拒绝过推理参数，已自动跳过' };
    }

    var vendor = vendorOf(ctx.endpoint, ctx.model);
    var budget = BUDGET[lv];
    var fields = [];
    var on = lv !== 'off';

    try {
      if (vendor === 'gemini') {
        /* Gemini 走 generationConfig（本函数只处理 OpenAI 兼容体；Gemini 由 callGemini 另走，
           这里仍写入一个通用位置，便于同一份配置复用到兼容网关） */
        body.generationConfig = body.generationConfig || {};
        body.generationConfig.thinkingConfig = { thinkingBudget: on ? budget : 0 };
        fields.push('generationConfig.thinkingConfig.thinkingBudget');
      } else if (vendor === 'anthropic') {
        if (on) {
          /* 注意：max 档的 BUDGET 是 -1（表示"交给厂商决定上限"），不能直接拿来当
             budget_tokens——实测那样会算出 8192，**比 high 档的 16384 还小**，
             出现「完全思考 < 高思考」的倒挂。这里把 -1 显式落成 32768。 */
          var ab = budget > 0 ? budget : 32768;
          body.thinking = { type: 'enabled', budget_tokens: ab };
          fields.push('thinking');
          /* Anthropic 要求 max_tokens > budget_tokens */
          var need = ab + 2048;
          if (!body.max_tokens || body.max_tokens < need) { body.max_tokens = need; fields.push('max_tokens(抬高)'); }
        } else {
          /* Claude 的思考模型无法真正关闭，省略即用默认；显式传 disabled 会被拒 */
          fields.push('（Claude 不支持关闭思考，已省略该字段）');
        }
      } else if (vendor === 'deepseek' || vendor === 'glm') {
        body.thinking = { type: on ? 'enabled' : 'disabled' };
        fields.push('thinking.type');
        if (on && budget > 0) { body.thinking.budget_tokens = budget; fields.push('thinking.budget_tokens'); }
        /* 新版 DeepSeek 也认 reasoning_effort，一并带上提高兼容面 */
        body.reasoning_effort = mapOpenAIEffort(lv);
        fields.push('reasoning_effort');
      } else if (vendor === 'qwen') {
        body.enable_thinking = on;
        fields.push('enable_thinking');
        if (on && budget > 0) { body.thinking_budget = budget; fields.push('thinking_budget'); }
      } else {
        /* openai 与 generic：reasoning_effort 是被最广泛容忍的形式 */
        body.reasoning_effort = mapOpenAIEffort(lv);
        fields.push('reasoning_effort');
      }
    } catch (e) {
      return { applied: false, vendor: vendor, fields: [], reason: '写入失败: ' + e.message };
    }
    return { applied: true, vendor: vendor, fields: fields, level: lv };
  }

  /** 五档 → OpenAI 的 reasoning_effort（只有 minimal/low/medium/high 四个值） */
  function mapOpenAIEffort(lv) {
    if (lv === 'off') return 'minimal';
    if (lv === 'low') return 'low';
    if (lv === 'medium') return 'medium';
    return 'high';
  }

  /** 该档位建议的输出额度下限（与 api-calling-functions 的推理模型下限取较大值） */
  function tokenFloor(level) {
    var lv = LEVELS.indexOf(level) >= 0 ? level : 'medium';
    return TOKEN_FLOOR[lv] || 16384;
  }

  function label(level) { return LABELS[level] || LABELS.medium; }
  function isOn(level) { return LEVELS.indexOf(level) >= 0 && level !== 'off'; }

  /** 给设置界面用的选项清单 */
  function options() {
    return LEVELS.map(function (v) { return { value: v, label: LABELS[v] }; });
  }

  /** 一句话说明当前档位的代价（设置界面显示给玩家） */
  function hint(level) {
    switch (level) {
      case 'off': return '不思考，最快最省；复杂剧情上可能变笨或被识别成退化';
      case 'low': return '轻量思考，速度与质量兼顾；适合日常对话与推进';
      case 'medium': return '默认档，平衡最好；推荐大多数玩家（实测思考约为正文的 3～10 倍）';
      case 'high': return '深度思考，长剧情/多线推演更稳；更慢、更贵，需要更大输出额度';
      case 'max': return '不限思考，交给模型自己决定；最慢最贵，弱模型可能只思考不产出';
      default: return '';
    }
  }

  window.ReasoningEffort = {
    LEVELS: LEVELS,
    LABELS: LABELS,
    BUDGET: BUDGET,
    apply: apply,
    vendorOf: vendorOf,
    tokenFloor: tokenFloor,
    mapOpenAIEffort: mapOpenAIEffort,
    label: label,
    isOn: isOn,
    options: options,
    hint: hint,
    markUnsupported: markUnsupported,
    isUnsupported: isUnsupported
  };
})();
