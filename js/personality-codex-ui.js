/* ============================================================================
 * 人物性格世界书面板 · personality-codex-ui.js（云境自有视觉）v4.46.0
 * ----------------------------------------------------------------------------
 * 三段结构：
 *   ① 角色档案：世界→角色→每人≥10条性格（逐条标来源：原著/辞典/玩家）
 *   ② 性格辞典：6 大类 60+ 种性格类型，逐条查特征/特色/行为/说话/雷区
 *   ③ 玩家调性格：给玩家角色增删性格，即时生效
 * 原著角色显示"原著"徽标与 configs 概括，按本色行事。
 * ========================================================================== */
(function () {
  'use strict';
  var G = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function C() { return G.PersonalityCodex || null; }
  var currentWorld = '', currentRole = '', tab = 'role';

  function ensureOverlay() {
    var ov = document.getElementById('codex-overlay');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'codex-overlay';
    ov.className = 'codex-overlay';
    ov.innerHTML = '<div class="codex-panel" role="dialog" aria-label="人物性格世界书">'
      + '<div class="codex-head"><h3>📖 人物性格世界书 <span class="codex-sub">性格辞典 · 原著性格 · 每人≥10条</span></h3>'
      + '<button class="codex-close" aria-label="关闭">✕</button></div>'
      + '<div class="codex-tabs"><button data-tab="role" class="on">角色档案</button>'
      + '<button data-tab="dict">性格辞典</button><button data-tab="player">调我的性格</button></div>'
      + '<div class="codex-body"></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('.codex-close').addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    Array.prototype.forEach.call(ov.querySelectorAll('.codex-tabs button'), function (b) {
      b.addEventListener('click', function () {
        tab = b.getAttribute('data-tab');
        Array.prototype.forEach.call(ov.querySelectorAll('.codex-tabs button'), function (x) { x.classList.toggle('on', x === b); });
        render();
      });
    });
    return ov;
  }
  function close() { var ov = document.getElementById('codex-overlay'); if (ov) ov.style.display = 'none'; }

  function catClass(o) { return 'cat-' + String(o || 'complex'); }
  function srcLabel(s) { return s === 'canon' ? '原著' : (s === 'player' ? '玩家' : '辞典'); }

  function renderRole(api, body) {
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
      + '<p class="codex-muted">索引 ' + st.indexedRoles + ' 位 / ' + st.indexedWorlds + ' 界；原著角色 ' + st.canonRoles + ' 位（来自 configs）。'
      + (note ? '（本界：' + esc(note) + '）' : '') + '</p>';

    if (!currentRole && roster.length) currentRole = roster[0];
    var profileHtml = '';
    if (currentRole) {
      var p = api.forRole(currentRole, currentWorld);
      var cc = catClass(p.primaryCat);
      // 原著锚点区
      var canonFaces = p.faces.filter(function (f) { return f.source === 'canon'; });
      var canonBlock = canonFaces.length
        ? '<div class="codex-canon"><i>📜 原著性格锚点（逐字来自 configs，按本色行事）</i><p>' + esc(canonFaces.map(function (f) { return f.text; }).join(' · ')) + '</p>'
          + (p.canonNote ? '<small>' + esc(p.canonNote) + '</small>' : '') + '</div>'
        : '';
      // ≥10 条性格（带来源）
      var faceRows = p.faces.map(function (f) {
        return '<span class="codex-face ' + catClass(f.cat) + '"><b>' + esc(f.text) + '</b><i class="src-' + f.source + '">' + srcLabel(f.source) + '</i></span>';
      }).join('');
      var biasRows = api.REL_AXES.map(function (k) {
        var m = p.relBias[k]; var pct = Math.round((m - 1) * 100);
        var col = pct >= 0 ? '#c05a55' : '#4b8a6a';
        return '<div class="codex-ax"><span>' + esc((G.IntimacyArchive && G.IntimacyArchive.AXIS_LABEL && G.IntimacyArchive.AXIS_LABEL[k]) || k) + '</span>'
          + '<b style="color:' + col + '">' + (pct >= 0 ? '+' : '') + pct + '%</b></div>';
      }).join('');
      profileHtml = '<div class="codex-profile ' + cc + '">'
        + '<div class="codex-phead"><b class="codex-name">' + esc(p.name) + '</b>'
        + (p.isCanon ? '<span class="codex-canon-badge">原著</span>' : '')
        + '<span class="codex-orient ' + cc + '">' + esc(p.primaryLabel) + '</span>'
        + '<span class="codex-arch">' + esc(p.archetype) + '型</span>'
        + '<span class="codex-count">' + p.traits.length + ' 条性格</span></div>'
        + canonBlock
        + '<div class="codex-faces"><i>性格构成（' + p.traits.length + ' 条）</i><div class="codex-face-grid">' + faceRows + '</div></div>'
        + '<div class="codex-grid">'
        + '<div class="codex-cell"><i>特色</i><p>' + esc(p.feature) + '</p></div>'
        + '<div class="codex-cell"><i>说话方式</i><p>' + esc(p.speech) + '</p></div>'
        + '<div class="codex-cell"><i>行为倾向</i><p>' + esc(p.behavior) + '</p></div>'
        + '<div class="codex-cell codex-line"><i>底线 / 雷区</i><p>' + esc(p.taboo) + '</p></div>'
        + '</div>'
        + '<div class="codex-bias"><i>对关系演化的影响</i><div class="codex-axes">' + biasRows + '</div></div>'
        + '<div class="codex-brief"><i>AI 提示速写（注入原著性格）</i><p>' + esc(api.brief(p.name, p.world)) + '</p></div>'
        + '</div>';
    }
    var rosterChips = roster.map(function (n) {
      return '<button class="codex-chip' + (n === currentRole ? ' on' : '') + '" data-role="' + esc(n) + '">' + esc(n) + '</button>';
    }).join('') || '<span class="codex-muted">本界暂无预置索引，可直接输入名字查档。</span>';
    body.innerHTML = selectors + '<div class="codex-roster">' + rosterChips + '</div>' + profileHtml;
    body.querySelector('.codex-world').addEventListener('change', function (e) { currentWorld = e.target.value; currentRole = ''; render(); });
    body.querySelector('.codex-query').addEventListener('click', function () { currentRole = body.querySelector('.codex-role').value.trim(); render(); });
    body.querySelector('.codex-role').addEventListener('keydown', function (e) { if (e.key === 'Enter') { currentRole = e.target.value.trim(); render(); } });
    Array.prototype.forEach.call(body.querySelectorAll('.codex-chip'), function (b) {
      b.addEventListener('click', function () { currentRole = b.getAttribute('data-role'); render(); });
    });
  }

  function renderDict(api, body) {
    var cats = api.CAT_KEYS.map(function (k) {
      var c = api.CATEGORIES[k];
      var items = api.TRAIT_CODEX.filter(function (t) { return t.cat === k; });
      return '<div class="codex-dict-cat ' + catClass(k) + '"><h4><span style="color:' + c.hue + '">●</span> ' + esc(c.label) + ' <small>' + esc(c.desc) + '（' + items.length + ' 种）</small></h4>'
        + '<div class="codex-dict-grid">' + items.map(function (t) {
          return '<div class="codex-dict-item" title="' + esc(t.feature) + '"><b>' + esc(t.name) + '</b>'
            + '<span>' + esc(t.face.join('·')) + '</span></div>';
        }).join('') + '</div></div>';
    }).join('');
    body.innerHTML = '<p class="codex-muted">世界书收录全部 ' + api.TRAIT_CODEX.length + ' 种性格类型，分 '
      + api.CAT_KEYS.length + ' 大类。悬停查看特色；原著角色的锚点优先于辞典。</p>' + cats;
  }

  function renderPlayer(api, body) {
    var worlds = api.worlds();
    if (!currentWorld) currentWorld = worlds.indexOf('fanrenxiuxian') >= 0 ? 'fanrenxiuxian' : worlds[0];
    if (!currentRole) currentRole = '我';
    var worldOpts = worlds.map(function (w) {
      return '<option value="' + esc(w) + '"' + (w === currentWorld ? ' selected' : '') + '>' + esc(w) + '</option>';
    }).join('');
    var p = api.forRole(currentRole, currentWorld);
    var faceRows = p.faces.map(function (f) {
      var canRemove = f.source !== 'canon' || true; // 玩家可移除任意条（含原著锚点，玩家设定优先）
      return '<span class="codex-face ' + catClass(f.cat) + '"><b>' + esc(f.text) + '</b><i class="src-' + f.source + '">' + srcLabel(f.source) + '</i>'
        + (canRemove ? '<button class="codex-face-del" data-face="' + esc(f.text) + '" title="移除">×</button>' : '') + '</span>';
    }).join('');
    var pv = api.getPlayer(currentWorld, currentRole);
    body.innerHTML = '<div class="codex-player-hint">为你自己的角色增删性格——玩家设定优先级高于原著锚点与算法，改动即时生效并随存档保存。</div>'
      + '<div class="codex-selectors"><label>世界 <select class="codex-world">' + worldOpts + '</select></label>'
      + '<label>你的角色名 <input class="codex-role" value="' + esc(currentRole) + '"></label>'
      + '<button class="codex-query">切换</button></div>'
      + '<div class="codex-player-add"><input class="codex-newface" placeholder="输入性格词，如：谨慎、傲娇、阴暗…">'
      + '<button class="codex-addface">＋ 添加</button><button class="codex-reset">重置为默认</button></div>'
      + '<div class="codex-faces"><i>当前性格（' + p.traits.length + ' 条）</i><div class="codex-face-grid">' + faceRows + '</div></div>'
      + (pv ? '<p class="codex-muted">已有自定义覆盖：新增 ' + pv.faces.length + ' 条 / 移除 ' + pv.removed.length + ' 条。</p>' : '');
    body.querySelector('.codex-world').addEventListener('change', function (e) { currentWorld = e.target.value; currentRole = '我'; render(); });
    body.querySelector('.codex-query').addEventListener('click', function () { currentRole = body.querySelector('.codex-role').value.trim() || '我'; render(); });
    body.querySelector('.codex-addface').addEventListener('click', function () {
      var inp = body.querySelector('.codex-newface'); var v = inp.value.trim();
      if (v) { api.addPlayerTrait(currentWorld, currentRole, v); render(); }
    });
    body.querySelector('.codex-newface').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { var v = e.target.value.trim(); if (v) { api.addPlayerTrait(currentWorld, currentRole, v); render(); } }
    });
    body.querySelector('.codex-reset').addEventListener('click', function () { api.resetPlayer(currentWorld, currentRole); render(); });
    Array.prototype.forEach.call(body.querySelectorAll('.codex-face-del'), function (b) {
      b.addEventListener('click', function () { api.removePlayerTrait(currentWorld, currentRole, b.getAttribute('data-face')); render(); });
    });
  }

  function render() {
    var api = C();
    var ov = ensureOverlay(), body = ov.querySelector('.codex-body');
    if (!api) { body.innerHTML = '<p class="codex-muted">性格世界书模块未加载。</p>'; ov.style.display = 'flex'; return; }
    if (tab === 'dict') renderDict(api, body);
    else if (tab === 'player') renderPlayer(api, body);
    else renderRole(api, body);
    ov.style.display = 'flex';
  }

  function open() { render(); }
  G.PersonalityCodexUI = { open: open, close: close, render: render };
})();
