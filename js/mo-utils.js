/**
 * mo-utils.js —— 云境工坊·优化版 公共工具层（v3.47.5-opt）
 * ---------------------------------------------------------------------------
 * 集中提供此前散落/缺失的通用能力，供各模块直接调用（挂载在 window.MoUtils）：
 *   1. debounce / throttle        —— 高频输入/拖拽存盘节流（原代码全库缺失）
 *   2. safeEval                   —— 调度场算法求值，替代 phone-apps 的 Function() 动态执行（去 eval、兼容 CSP）
 *   3. escapeHtml / renderMarkdown—— 统一内容消毒管线（AI 输出不再裸 innerHTML）
 *   4. pollUntil                  —— 受次数上限的轮询，替代 st-import/kb-enhance 的永久 setInterval
 *
 * 本文件为纯 ES5 友好写法，任何内核均可解析；不依赖任何外部库。
 */
(function () {
  'use strict';

  var MoUtils = {};

  /* ============ 1. 防抖 / 节流 ============ */
  MoUtils.debounce = function (fn, wait) {
    wait = wait || 200;
    var t = null;
    return function () {
      var ctx = this, args = arguments;
      if (t) clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  };

  MoUtils.throttle = function (fn, wait) {
    wait = wait || 200;
    var last = 0, timer = null;
    return function () {
      var ctx = this, args = arguments, now = Date.now();
      var remain = wait - (now - last);
      if (remain <= 0) {
        if (timer) { clearTimeout(timer); timer = null; }
        last = now;
        fn.apply(ctx, args);
      } else if (!timer) {
        timer = setTimeout(function () {
          last = Date.now();
          timer = null;
          fn.apply(ctx, args);
        }, remain);
      }
    };
  };

  /* ============ 2. 安全表达式求值（调度场算法，无 eval/Function） ============ */
  /**
   * 支持 + - * / % 与括号、小数。百分号按 50% → (50/100) 处理。
   * 输入先经严格白名单字符集校验；返回数字或 null（绝不抛错、绝不执行任意代码）。
   */
  MoUtils.safeEval = function (expr) {
    if (expr == null) return null;
    var s = String(expr)
      .replace(/[×✕]/g, '*').replace(/[÷]/g, '/')
      .replace(/[−–—]/g, '-').replace(/，/g, '')
      .replace(/\s+/g, '');
    if (!/^[0-9+\-*/.()%]+$/.test(s)) return null;

    // 百分号换算
    s = s.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');

    // 分词
    var tokens = [], i = 0, n = s.length;
    while (i < n) {
      var c = s[i];
      if ((c >= '0' && c <= '9') || c === '.') {
        var num = '';
        while (i < n && ((s[i] >= '0' && s[i] <= '9') || s[i] === '.')) { num += s[i++]; }
        tokens.push({ t: 'num', v: parseFloat(num) });
      } else if ('+-*/()'.indexOf(c) >= 0) {
        tokens.push({ t: 'op', v: c }); i++;
      } else {
        return null; // 防御：白名单之外字符
      }
    }

    // 调度场 → 逆波兰
    var prec = { '+': 1, '-': 1, '*': 2, '/': 2 };
    var out = [], ops = [];
    for (var k = 0; k < tokens.length; k++) {
      var tk = tokens[k];
      if (tk.t === 'num') {
        out.push(tk);
      } else if (tk.v === '(') {
        ops.push(tk);
      } else if (tk.v === ')') {
        while (ops.length && ops[ops.length - 1].v !== '(') out.push(ops.pop());
        if (!ops.length) return null; // 括号不匹配
        ops.pop();
      } else {
        while (ops.length && ops[ops.length - 1].v !== '(' &&
               prec[ops[ops.length - 1].v] >= prec[tk.v]) out.push(ops.pop());
        ops.push(tk);
      }
    }
    while (ops.length) {
      var op = ops.pop();
      if (op.v === '(') return null;
      out.push(op);
    }

    // 求值逆波兰
    var st = [];
    for (var m = 0; m < out.length; m++) {
      var x = out[m];
      if (x.t === 'num') {
        st.push(x.v);
      } else {
        var b = st.pop(), a = st.pop();
        if (a === undefined || b === undefined) return null;
        if (x.v === '+') st.push(a + b);
        else if (x.v === '-') st.push(a - b);
        else if (x.v === '*') st.push(a * b);
        else if (x.v === '/') { if (b === 0) return null; st.push(a / b); }
      }
    }
    if (st.length !== 1) return null;
    var r = st[0];
    return (typeof r === 'number' && isFinite(r)) ? r : null;
  };

  /* ============ 3. 内容消毒管线 ============ */
  MoUtils.escapeHtml = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /**
   * 轻量 Markdown → 安全 HTML：先整体转义，再做 **粗体** / *斜体* / `代码` / 换行。
   * 因输入已被转义，任何 HTML 注入都会被中和，可安全用于 innerHTML。
   */
  MoUtils.renderMarkdown = function (text) {
    if (text == null) return '';
    var s = MoUtils.escapeHtml(text);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>');
    return '<p>' + s + '</p>';
  };

  /* ============ 4. 受上限的轮询（替代永久 setInterval） ============ */
  /**
   * 反复调用 fn 直到其返回真值，或达到 max 次尝试后自动停止。
   * 不再产生永不清除的定时器（修复 st-import / kb-enhance 的永久轮询泄漏）。
   */
  MoUtils.pollUntil = function (fn, opts) {
    opts = opts || {};
    var interval = opts.interval || 2500;
    var max = (typeof opts.max === 'number') ? opts.max : 80; // 默认 ~200s 上限
    var n = 0;
    (function step() {
      var done = false;
      try { done = !!fn(); } catch (e) { /* 吞掉挂载期异常，不阻塞 */ }
      if (done || n >= max) return;
      n++;
      setTimeout(step, interval);
    })();
  };

  window.MoUtils = MoUtils;
})();
