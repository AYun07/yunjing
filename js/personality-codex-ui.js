/* ============================================================================
 * 人物性格世界书面板 · personality-codex-ui.js（云境自有视觉）v4.45.0
 * ----------------------------------------------------------------------------
 * 读取 PersonalityCodex 真实数据渲染：世界选择 → 角色列表 → 性格档案
 * （取向/原型/特质/说话/习惯/喜恶/底线/独特癖好/关系倾向）。
 * 支持对任意自定义角色即时生成档案。版权：本项目独立编写。
 * ========================================================================== */
(function () {
  'use strict';
  var G = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function C() { return G.PersonalityCodex || null; }
  var currentWorld = '', currentRole = '';

  function ensureOverlay() {
    var ov = document.getElementById('codex-overlay');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'codex-overlay';
    ov.className = 'codex-overlay';
    ov.innerHTML = '<div class="codex-panel" role="dialog" aria-label="人物性格世界书">'
      + '<div class="codex-head"><h3>📖 人物性格世界书 <span class="codex-sub">全 38 界 · 每人独特</span></h3>'
      + '<button class="codex-close" aria-label="关闭">✕</button></div>'
      + '<div class="codex-body"></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('.codex-close').addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    return ov;
  }
  function close() { var ov = document.getElementById('codex-overlay'); if (ov) ov.style.display = 'none'; }

  function orientClass(o) { return o === 'positive' ? 'pos' : (o === 'negative' ? 'neg' : 'ecc'); }

  function render() {
    var api = C();
    var ov = ensureOverlay(), body = ov.querySelector('.codex-body');
    if (!api) { body.innerHTML = '<p class="codex-muted">性格世界书模块未加载。</p>'; ov.style.display = 'flex'; return; }
    var worlds = api.worlds();
    if (!currentWorld) currentWorld = worlds.indexOf('fanrenxiuxian') >= 0 ? 'fanrenxiuxian' : worlds[0];
    var roster = api.roster(currentWorld) || [];
    var note = api.rosterNote(currentWorld);
    var st = api.stats();

    var worldOpts = worlds.map(function (w) {
      return '<option value="' + esc(w) + '"' + (w === currentWorld ? ' selected' : '') + '>' + esc(w) + '</option>';
    }).join('');

    var selectors = '<div class="codex-selectors">'
      + '<label>世界 <select class="codex-world">' + worldOpts + '</select></label>'
      + '<label>角色 <input class="codex-role" list="codex-rolelist" placeholder="输入或选择角色名" value="' + esc(currentRole) + '">'
      + '<datalist id="codex-rolelist">' + roster.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist></label>'
      + '<button class="codex-query">查档</button></div>'
      + '<p class="codex-muted">索引角色 ' + st.indexedRoles + ' 位 / 世界 ' + st.indexedWorlds + ' 个；任意名字都可即时生成档案。'
      + (note ? '（本界：' + esc(note) + '）' : '') + '</p>';

    if (!currentRole && roster.length) currentRole = roster[0];
    var profileHtml = '';
    if (currentRole) {
      var p = api.forRole(currentRole, currentWorld);
      var oc = orientClass(p.orientation);
      var biasRows = api.REL_AXES.map(function (k) {
        var m = p.relBias[k];
        var pct = Math.round((m - 1) * 100);
        var col = pct >= 0 ? '#c05a55' : '#4b8a6a';
        return '<div class="codex-ax"><span>' + esc((G.IntimacyArchive && G.IntimacyArchive.AXIS_LABEL[k]) || k) + '</span>'
          + '<b style="color:' + col + '">' + (pct >= 0 ? '+' : '') + pct + '%</b></div>';
      }).join('');
      profileHtml = '<div class="codex-profile ' + oc + '">'
        + '<div class="codex-phead"><b class="codex-name">' + esc(p.name) + '</b>'
        + '<span class="codex-orient ' + oc + '">' + esc(p.orientationLabel) + '</span>'
        + '<span class="codex-arch">' + esc(p.archetype) + '</span></div>'
        + '<div class="codex-grid">'
        + '<div class="codex-cell"><i>核心特质</i><div class="codex-tags">' + p.traits.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div></div>'
        + '<div class="codex-cell"><i>说话方式</i><p>' + esc(p.speech) + '</p></div>'
        + '<div class="codex-cell"><i>行为习惯</i><p>' + esc(p.habit) + '</p></div>'
        + '<div class="codex-cell"><i>喜好</i><p>' + esc(p.likes.join('、')) + '</p></div>'
        + '<div class="codex-cell"><i>厌恶</i><p>' + esc(p.dislikes.join('、')) + '</p></div>'
        + '<div class="codex-cell codex-line"><i>底线 / 雷区</i><p>' + esc(p.bottomLine) + '</p></div>'
        + '<div class="codex-cell codex-quirk"><i>独特癖好</i><p>' + esc(p.quirk) + '</p></div>'
        + '</div>'
        + '<div class="codex-bias"><i>对关系演化的影响倾向</i><div class="codex-axes">' + biasRows + '</div></div>'
        + '<div class="codex-brief"><i>AI 提示速写</i><p>' + esc(api.brief(p.name, p.world)) + '</p></div>'
        + '</div>';
    }

    var rosterChips = roster.map(function (n) {
      return '<button class="codex-chip' + (n === currentRole ? ' on' : '') + '" data-role="' + esc(n) + '">' + esc(n) + '</button>';
    }).join('') || '<span class="codex-muted">本界暂无预置角色索引，可直接输入名字查档。</span>';

    body.innerHTML = selectors + '<div class="codex-roster">' + rosterChips + '</div>' + profileHtml;
    ov.style.display = 'flex';

    body.querySelector('.codex-world').addEventListener('change', function (e) {
      currentWorld = e.target.value; currentRole = ''; render();
    });
    body.querySelector('.codex-query').addEventListener('click', function () {
      currentRole = body.querySelector('.codex-role').value.trim(); render();
    });
    body.querySelector('.codex-role').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { currentRole = e.target.value.trim(); render(); }
    });
    Array.prototype.forEach.call(body.querySelectorAll('.codex-chip'), function (b) {
      b.addEventListener('click', function () { currentRole = b.getAttribute('data-role'); render(); });
    });
  }

  function open() { render(); }
  G.PersonalityCodexUI = { open: open, close: close, render: render };
})();
