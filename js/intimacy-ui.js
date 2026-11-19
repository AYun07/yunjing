/* ============================================================================
 * 亲密关系档案面板 · intimacy-ui.js（云境自有视觉）
 * ----------------------------------------------------------------------------
 * 读取 IntimacyArchive 真实数据渲染：关系阶段、亲密度、专属称呼、边界偏好、
 * 私密记忆、含蓄互动记录、只增不删库房。默认关闭，开启时明示 R18 提示。
 * 仅调用自有模块公开接口，不改核心运行时。版权：本项目独立编写。
 * ========================================================================== */
(function () {
  "use strict";
  var G = (typeof window !== "undefined") ? window : (typeof globalThis !== "undefined" ? globalThis : {});

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function IA() { return G.IntimacyArchive || null; }

  function ensureOverlay() {
    var ov = document.getElementById('intimacy-overlay');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'intimacy-overlay';
    ov.className = 'ia-overlay';
    ov.innerHTML = '<div class="ia-panel" role="dialog" aria-label="亲密关系档案">'
      + '<div class="ia-head"><h3>💞 亲密关系档案 <span class="ia-r18">R18</span></h3>'
      + '<button class="ia-close" aria-label="关闭">✕</button></div>'
      + '<div class="ia-body"></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('.ia-close').addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    return ov;
  }

  function close() {
    var ov = document.getElementById('intimacy-overlay');
    if (ov) ov.style.display = 'none';
  }

  function bar(label, v, color) {
    var w = Math.max(0, Math.min(100, Number(v) || 0));
    return '<div class="ia-ax"><span>' + esc(label) + '</span>'
      + '<div class="ia-ax-track"><i style="width:' + w + '%;background:' + color + '"></i></div>'
      + '<b>' + w + '</b></div>';
  }

  function render() {
    var A = IA();
    var ov = ensureOverlay();
    var body = ov.querySelector('.ia-body');
    if (!A) {
      body.innerHTML = '<p class="ia-muted">亲密关系档案模块未加载。</p>';
      ov.style.display = 'flex';
      return;
    }
    var s = A.stats();
    var head = '<div class="ia-status">'
      + '状态：<b class="' + (s.enabled ? 'ia-on' : 'ia-off') + '">' + (s.enabled ? '已开启' : '已关闭（默认）') + '</b>'
      + ' · 档案 ' + s.records + ' · 库房 ' + s.vault
      + ' <button class="ia-toggle">' + (s.enabled ? '关闭档案' : '开启档案（R18）') + '</button></div>'
      + (s.enabled ? '' : '<p class="ia-notice">⚠ 该功能默认关闭。亲密档案记录角色间的关系阶段与私密互动；所有文本保持文学化、含蓄的情感层面。开启后由你自行掌控。</p>');

    var list = A.list();
    var cards = '';
    if (!list.length) {
      cards = '<p class="ia-muted">暂无亲密档案。在故事中与角色建立关系后可建档。</p>';
    } else {
      list.forEach(function (r) {
        var stageLabel = (A.STAGES[r.stage] || {}).label || '陌生';
        var v = A.view(r.name, '玩家');
        var memHtml = (v.memories || []).slice(-8).map(function (m) {
          return '<li>' + esc(m) + '</li>';
        }).join('') || '<li class="ia-muted">（暂无可见记忆）</li>';
        var intHtml = (v.interactions || []).slice(-6).map(function (m) {
          return '<li>' + esc(m) + '</li>';
        }).join('') || '<li class="ia-muted">（暂无互动记录）</li>';
        var b = r.boundaries || {};
        cards += '<div class="ia-card">'
          + '<div class="ia-card-head"><b>' + esc(r.name) + '</b>'
          + '<span class="ia-stage">' + stageLabel + '</span>'
          + (r.petName ? '<span class="ia-pet">「' + esc(r.petName) + '」</span>' : '')
          + '</div>'
          + bar('亲密度', r.closeness, '#c9a86a')
          + '<div class="ia-bounds">边界偏好：展示=' + esc(b.display || '谨慎')
          + ' · 肢体=' + esc(b.touch || '需同意') + ' · 私密空间=' + esc(b.privateSpace || '尊重') + '</div>'
          + '<details><summary>私密记忆（' + (v.memories || []).length + '）</summary><ul class="ia-list">' + memHtml + '</ul></details>'
          + '<details><summary>含蓄互动（' + (v.interactions || []).length + '）</summary><ul class="ia-list">' + intHtml + '</ul></details>'
          + '</div>';
      });
    }
    body.innerHTML = head + '<div class="ia-cards">' + cards + '</div>';
    var btn = body.querySelector('.ia-toggle');
    if (btn) btn.addEventListener('click', function () {
      A.toggle();
      render();
      try { if (G.showToast) G.showToast(A.isEnabled() ? '亲密关系档案已开启（R18）' : '亲密关系档案已关闭', 'info'); } catch (e) {}
    });
    ov.style.display = 'flex';
  }

  function open() { try { bootBridge(); } catch (e) {} render(); }
  function bootBridge() { try { if (G.AIAugmentBridge) G.AIAugmentBridge.boot(); } catch (e) {} }

  G.IntimacyUI = { open: open, close: close, render: render };
})();
