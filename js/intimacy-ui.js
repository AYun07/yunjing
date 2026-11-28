/* ============================================================================
 * 动态亲密关系档案面板 · intimacy-ui.js（云境自有视觉）v4.45.0
 * ----------------------------------------------------------------------------
 * 读取 IntimacyArchive 真实数据：五维关系（可升可降/可锁定）、双向阶段
 * （宿敌→伴侣）、演化历史、表达尺度（含蓄/直白/露骨）、私密记忆、库房。
 * 仅调用自有模块公开接口，不改核心运行时。版权：本项目独立编写。
 * ========================================================================== */
(function () {
  'use strict';
  var G = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function IA() { return G.IntimacyArchive || null; }

  function ensureOverlay() {
    var ov = document.getElementById('intimacy-overlay');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'intimacy-overlay';
    ov.className = 'ia-overlay';
    ov.innerHTML = '<div class="ia-panel" role="dialog" aria-label="动态亲密关系档案">'
      + '<div class="ia-head"><h3>💞 动态关系档案 <span class="ia-r18">R18</span></h3>'
      + '<button class="ia-close" aria-label="关闭">✕</button></div>'
      + '<div class="ia-body"></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('.ia-close').addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    return ov;
  }
  function close() { var ov = document.getElementById('intimacy-overlay'); if (ov) ov.style.display = 'none'; }

  function axisBar(label, v, locked, key) {
    var pct = Math.max(-100, Math.min(100, Number(v) || 0));
    var w = Math.abs(pct) / 2;
    var color = pct >= 0 ? '#c9a86a' : '#c05a55';
    var side = pct >= 0 ? 'left:50%' : 'right:50%';
    return '<div class="ia-ax"><span>' + esc(label) + (locked ? ' 🔒' : '') + '</span>'
      + '<div class="ia-ax-track"><i class="ia-mid"></i>'
      + '<i style="' + side + ';width:' + w + '%;background:' + color + '"></i></div>'
      + '<b>' + pct + '</b>'
      + '<button class="ia-lock" data-axis="' + key + '" title="锁定后自动演化不覆盖">' + (locked ? '解锁' : '锁定') + '</button></div>';
  }

  function render() {
    var A = IA();
    var ov = ensureOverlay(), body = ov.querySelector('.codex-body') || ov.querySelector('.ia-body');
    if (!A) { body.innerHTML = '<p class="ia-muted">关系档案模块未加载。</p>'; ov.style.display = 'flex'; return; }
    var s = A.stats();
    var expr = A.expressionInfo();
    var exprBtns = expr.options.map(function (o) {
      return '<button class="ia-expr' + (o.key === expr.current ? ' on' : '') + '" data-expr="' + o.key + '">' + esc(o.label) + '</button>';
    }).join('');
    var head = '<div class="ia-status">状态：<b class="' + (s.enabled ? 'ia-on' : 'ia-off') + '">' + (s.enabled ? '已开启' : '已关闭（默认）') + '</b>'
      + ' · 档案 ' + s.records + ' · 库房 ' + s.vault
      + ' <button class="ia-toggle">' + (s.enabled ? '关闭档案' : '开启档案（R18）') + '</button></div>'
      + '<div class="ia-exprbar"><span>表达尺度</span>' + exprBtns + '</div>'
      + '<p class="ia-notice">⚠ 露骨档移除关键词拦截，尺度由你配置的模型与你的判断决定；云境自身不生成露骨色情文本。关系会随时间/事件/性格自动演化，你可锁定任意维度阻止其被覆盖。</p>';

    var list = A.list(), cards = '';
    if (!list.length) {
      cards = '<p class="ia-muted">暂无关系档案。在故事中与角色互动后可建档。</p>';
    } else {
      list.forEach(function (r) {
        var v = A.view(r.name, '玩家');
        var stageNeg = v.stage <= 3;
        var axHtml = A.AXES.map(function (k) {
          return axisBar(v.axisLabel[k], v.axes[k], v.locks[k], k);
        }).join('');
        var memHtml = (v.memories || []).slice(-6).map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') || '<li class="ia-muted">（暂无可见记忆）</li>';
        var intHtml = (v.interactions || []).slice(-5).map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') || '<li class="ia-muted">（暂无互动记录）</li>';
        var histHtml = (v.history || []).slice(-6).reverse().map(function (h) {
          return '<li><b>' + esc(h.axis) + '</b> ' + h.from + '→' + h.to + ' <i>' + esc(h.reason) + '</i> <span>[' + esc(h.source) + ']</span></li>';
        }).join('') || '<li class="ia-muted">（暂无变动）</li>';
        cards += '<div class="ia-card">'
          + '<div class="ia-card-head"><b>' + esc(r.name) + '</b>'
          + '<span class="ia-stage' + (stageNeg ? ' neg' : '') + '">' + esc(v.stageLabel) + '</span>'
          + '<span class="ia-total">总评 ' + v.total + '</span>'
          + (r.petName ? '<span class="ia-pet">「' + esc(r.petName) + '」</span>' : '') + '</div>'
          + '<div class="ia-axes">' + axHtml + '</div>'
          + '<details><summary>变动轨迹（最近 6 条）</summary><ul class="ia-list ia-hist">' + histHtml + '</ul></details>'
          + '<details><summary>私密记忆（' + (v.memories || []).length + '）</summary><ul class="ia-list">' + memHtml + '</ul></details>'
          + '<details><summary>互动记录（' + (v.interactions || []).length + '）</summary><ul class="ia-list">' + intHtml + '</ul></details>'
          + '</div>';
      });
    }
    body.innerHTML = head + '<div class="ia-cards">' + cards + '</div>';

    var btn = body.querySelector('.ia-toggle');
    if (btn) btn.addEventListener('click', function () {
      A.toggle(); render();
      try { if (G.showToast) G.showToast(A.isEnabled() ? '关系档案已开启（R18）' : '关系档案已关闭', 'info'); } catch(e){console.warn("[swallowed] intimacy-ui",e)}
    });
    Array.prototype.forEach.call(body.querySelectorAll('.ia-expr'), function (b) {
      b.addEventListener('click', function () {
        A.setExpression(b.getAttribute('data-expr')); render();
        try { if (G.showToast) G.showToast('表达尺度已切换为「' + b.textContent + '」', 'info'); } catch(e){console.warn("[swallowed] intimacy-ui",e)}
      });
    });
    Array.prototype.forEach.call(body.querySelectorAll('.ia-lock'), function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var card = b.closest('.ia-card');
        var name = card.querySelector('.ia-card-head b').textContent;
        var axis = b.getAttribute('data-axis');
        var rec = A.get(name);
        A.lockAxis(name, axis, !rec.locks[axis]); render();
      });
    });
    ov.style.display = 'flex';
  }

  function open() { try { if (G.AIAugmentBridge) G.AIAugmentBridge.boot(); } catch(e){console.warn("[swallowed] intimacy-ui",e)} try { if (G.RelationCodexBridge) G.RelationCodexBridge.boot(); } catch(e){console.warn("[swallowed] intimacy-ui",e)} render(); }
  G.IntimacyUI = { open: open, close: close, render: render };
})();
