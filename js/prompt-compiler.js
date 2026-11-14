/* 云境 · 提示词编译入口 v1.0.0（v4.17.0）
 *
 * 为什么有它
 *   提示词的**片段拼装**其实已经集中在 js/ai-message-builder.js 里（这一点此前判断过重）。
 *   真正的缺口有两个：
 *     ① **没有统一入口**：buildStoryMessages 被 4 个文件直接调用
 *        （ai-response-handler / api-calling-functions ×3 / variable-ai），
 *        而 variable-ai 又自带一套 buildMessages —— 想知道「这一轮到底发出去什么」
 *        得同时看两处，且没有地方能拿到结果。
 *     ② **没有可观测性**：提示词是这个产品的核心资产（铁律、KB 注入、变量协议、
 *        文风、选项格式全在里面），但拼完之后**不留痕**：出问题时无法回答
 *        「这次注入了哪些 KB 条目？系统提示多少字？用了哪个档位？有没有被压缩？」
 *
 * 它做什么
 *   给提示词编译一个**唯一入口 + 留痕**：
 *     PromptCompiler.compile(userMessage)  → 走既有 buildStoryMessages，并记录快照
 *     PromptCompiler.last()                → 最近一次编译的完整快照
 *     PromptCompiler.diagnose()            → 人可读的组成报告
 *   本模块**不改变任何拼装逻辑**（纯委托），因此不引入行为风险；
 *   它只负责「统一入口」与「留痕」这两件此前缺失的事。
 */
(function () {
  'use strict';

  var _last = null;
  var _history = [];

  function bytes(s) { return String(s == null ? '' : s).length; }

  /** 从 messages 里切出各层的体量（system / 历史 / 本轮） */
  function profile(messages) {
    var msgs = Array.isArray(messages) ? messages : [];
    var sysChars = 0, histChars = 0, lastChars = 0, sysCount = 0;
    msgs.forEach(function (m, i) {
      var len = bytes(m && m.content);
      if (m && m.role === 'system') { sysChars += len; sysCount++; }
      else if (i === msgs.length - 1) lastChars += len;
      else histChars += len;
    });
    return {
      total: sysChars + histChars + lastChars,
      messages: msgs.length,
      systemChars: sysChars, systemBlocks: sysCount,
      historyChars: histChars, userChars: lastChars
    };
  }

  /** 收集编译时的环境信息（档位、预算、开关），用于复盘「为什么这轮是这样」 */
  function environment() {
    var env = {};
    try {
      var BMM = window.BaseModelMode;
      env.tier = BMM && BMM.resolveTier ? BMM.resolveTier() : '?';
      env.ctxTier = BMM && BMM.ctxTier ? BMM.ctxTier() : '?';
    } catch (e) { }
    try {
      var fw = window.storyFramework;
      var cfg = fw && fw.apiConfig || {};
      env.model = cfg.model || '';
      env.maxTokens = cfg.maxTokens;
      env.stream = cfg.stream;
      env.baseModelMode = cfg.baseModelMode;
    } catch (e) { }
    try { env.varAI = !!(window.VariableAI && window.VariableAI.isEnabled && window.VariableAI.isEnabled()); } catch (e) { }
    try { env.kbVector = !!(window.KBVector && window.KBVector.isEnabled && window.KBVector.isEnabled()); } catch (e) { }
    try { env.stance = window.StoryStance && window.StoryStance.get ? window.StoryStance.get() : ''; } catch (e) { }
    try { env.freedom = window.StoryFreedom && window.StoryFreedom.get ? window.StoryFreedom.get() : ''; } catch (e) { }
    try { env.genre = (fw && fw.genre) || (new URLSearchParams(location.search).get('genre')) || ''; } catch (e) { }
    return env;
  }

  /**
   * 唯一编译入口。**纯委托**：真正的拼装仍由 ai-message-builder 完成。
   * @param {string} userMessage 玩家本轮的输入
   * @returns {Promise<Array>} messages
   */
  async function compile(userMessage) {
    var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
    if (typeof window.buildStoryMessages !== 'function') {
      throw new Error('buildStoryMessages 未就绪（ai-message-builder.js 未加载？）');
    }
    var messages = await window.buildStoryMessages(userMessage);
    var t1 = (window.performance && performance.now) ? performance.now() : Date.now();
    record(messages, userMessage, Math.round(t1 - t0));
    return messages;
  }

  function record(messages, userMessage, ms) {
    var snap = {
      at: new Date().toISOString(),
      ms: ms,
      stats: profile(messages),
      env: environment(),
      userMessage: String(userMessage || '').slice(0, 200),
      /* 只留结构摘要，不存全文——避免把提示词常驻内存里（它可能很大） */
      preview: (Array.isArray(messages) && messages[0] && typeof messages[0].content === 'string')
        ? messages[0].content.slice(0, 300) : ''
    };
    _last = snap;
    _history.push(snap);
    if (_history.length > 20) _history.shift();
    if (window.YJ_DEBUG) console.log('[PromptCompiler] 编译完成', snap.stats, snap.env);
  }

  /** 人可读的组成报告（排查「为什么模型收到的是这样」时用） */
  function diagnose() {
    if (!_last) return '尚未编译过任何提示词。';
    var s = _last.stats, e = _last.env;
    return [
      '最近一次提示词编译（' + _last.at + '，耗时 ' + _last.ms + 'ms）',
      '  消息条数     : ' + s.messages,
      '  总字符数     : ' + s.total,
      '  ├ 系统层     : ' + s.systemChars + ' 字符 / ' + s.systemBlocks + ' 块',
      '  ├ 历史层     : ' + s.historyChars + ' 字符',
      '  └ 本轮输入   : ' + s.userChars + ' 字符',
      '  模型档位     : ' + e.tier + '（上下文档 ' + e.ctxTier + '）',
      '  模型         : ' + (e.model || '(未配置)') + '  maxTokens=' + (e.maxTokens == null ? '?' : e.maxTokens),
      '  世界 / 立场  : ' + (e.genre || '?') + ' / ' + (e.stance || '?'),
      '  变量AI / 向量: ' + (e.varAI ? '开' : '关') + ' / ' + (e.kbVector ? '开' : '关'),
      '  系统提示开头 : ' + _last.preview.replace(/\n/g, ' ').slice(0, 120) + '…'
    ].join('\n');
  }

  /** 估算 token（沿用产品既有口径：字符数 / 1.6） */
  function estimateTokens() {
    if (!_last) return 0;
    return Math.round(_last.stats.total / 1.6);
  }

  window.PromptCompiler = {
    compile: compile,
    last: function () { return _last; },
    history: function () { return _history.slice(); },
    diagnose: diagnose,
    estimateTokens: estimateTokens,
    profile: profile
  };
})();
