/* ============================================================================
 * AI 增强中心面板 · ai-augment-ui.js（云境自有视觉）
 * ----------------------------------------------------------------------------
 * 展示并控制 AIAugment：总开关 + 五项分项开关 + 采样策略说明 + 真实调用/成本
 * 明细。默认全关；开启时明示「会产生真实大模型调用与费用」。
 * 仅调用自有模块公开接口，不改核心运行时。版权：本项目独立编写。
 * ========================================================================== */
(function () {
  "use strict";
  var G = (typeof window !== "undefined") ? window : (typeof globalThis !== "undefined" ? globalThis : {});

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function A() { return G.AIAugment || null; }

  function ensureOverlay() {
    var ov = document.getElementById('aiaug-overlay');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'aiaug-overlay';
    ov.className = 'aia-overlay';
    ov.innerHTML = '<div class="aia-panel" role="dialog" aria-label="AI 增强中心">'
      + '<div class="aia-head"><h3>✨ AI 增强中心</h3>'
      + '<button class="aia-close" aria-label="关闭">✕</button></div>'
      + '<div class="aia-body"></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('.aia-close').addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    return ov;
  }

  function close() {
    var ov = document.getElementById('aiaug-overlay');
    if (ov) ov.style.display = 'none';
  }

  function render() {
    var api = A();
    var ov = ensureOverlay();
    var body = ov.querySelector('.aia-body');
    if (!api) { body.innerHTML = '<p class="aia-muted">AI 增强模块未加载。</p>'; ov.style.display = 'flex'; return; }
    var st = api.status();
    var defs = st.taskDefs || {};

    var head = '<div class="aia-status">总开关：<b class="' + (st.enabled ? 'aia-on' : 'aia-off') + '">'
      + (st.enabled ? '开启' : '关闭（默认）') + '</b>'
      + ' <button class="aia-master">' + (st.enabled ? '关闭全部增强' : '开启 AI 增强') + '</button></div>'
      + '<p class="aia-notice">⚠ 开启后，对应环节会按采样策略调用你配置的大模型，产生真实 token 消耗与费用。'
      + '所有增强失败会自动降级到本地引擎，不影响游玩。本地引擎始终保底运行。</p>';

    /* 表格/推演本身已有大模型通道（VariableAI/Planner），增强层不重复调用，
       故这两项不显示误导性开关，改标「既有通道·自动记账」。 */
    var existingTags = { variable: true, planner: true };
    var rows = Object.keys(defs).map(function (tag) {
      var d = defs[tag];
      var on = !!(st.tasks[tag] && st.tasks[tag].enabled);
      var c = st.cost[tag] || { calls: 0, tokIn: 0, tokOut: 0 };
      var cnt = st.counters[tag] || 0;
      var ctl = existingTags[tag]
        ? '<span class="aia-existing">既有通道</span>'
        : '<button class="aia-task" data-tag="' + tag + '">' + (on ? '关闭' : '开启') + '</button>';
      var every = existingTags[tag]
        ? '<span class="aia-every">自带大模型通道</span>'
        : '<span class="aia-every">每 ' + d.every + ' 次节点调一次</span>';
      return '<div class="aia-row">'
        + '<div class="aia-row-main"><b>' + esc(d.label) + '</b>'
        + '<span class="aia-tag">' + tag + '</span>' + every + '</div>'
        + '<div class="aia-row-meta">已触发 ' + cnt + ' 节点 · 真实调用 ' + c.calls
        + ' 次 · 输入 ' + c.tokIn + ' tok / 输出 ' + c.tokOut + ' tok</div>'
        + ctl + '</div>';
    }).join('');

    var total = st.total || { calls: 0, tokIn: 0, tokOut: 0 };
    var foot = '<div class="aia-total">本会话累计：真实调用 <b>' + total.calls + '</b> 次'
      + ' · 输入 <b>' + total.tokIn + '</b> tok · 输出 <b>' + total.tokOut + '</b> tok'
      + ' · 降级 ' + st.fallbacks + ' 次 · 失败 ' + st.errors + ' 次'
      + ' <button class="aia-reset">清空统计</button></div>'
      + '<p class="aia-muted">说明：表格填写（变量AI 第三接口/主笔兜底）与推演规划（Planner）本身已有大模型通道，'
      + '本面板不重复调用它们、只做统一记账与开关说明，避免翻倍烧钱。闸门采用全局动态并发（均衡档），只排队不熔断。</p>';

    body.innerHTML = head + '<div class="aia-rows">' + rows + '</div>' + foot;

    body.querySelector('.aia-master').addEventListener('click', function () {
      api.setEnabled(!st.enabled); render();
      try { if (G.showToast) G.showToast(api.isEnabled() ? 'AI 增强已开启（会产生真实调用）' : 'AI 增强已关闭', 'info'); } catch(e){console.warn("[swallowed] ai-augment-ui",e)}
    });
    Array.prototype.forEach.call(body.querySelectorAll('.aia-task'), function (b) {
      b.addEventListener('click', function () {
        var tag = b.getAttribute('data-tag');
        api.setTask(tag, !st.tasks[tag].enabled); render();
      });
    });
    var reset = body.querySelector('.aia-reset');
    if (reset) reset.addEventListener('click', function () { api.resetStats(); render(); });
    ov.style.display = 'flex';
  }

  function open() { try { if (G.AIAugmentBridge) G.AIAugmentBridge.boot(); } catch(e){console.warn("[swallowed] ai-augment-ui",e)} render(); }
  G.AIAugmentUI = { open: open, close: close, render: render };
})();
