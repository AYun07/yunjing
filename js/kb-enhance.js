/* 云境 · KB Enhance v1.3.0(#7 知识库面板增强)
   统计条(启用 x/y · 常驻 z · 已关 w) + 条目序号 + 回收站(删除可恢复) */
(function () {
  'use strict';
  function genreNow() {
    try { return (window.WorldExt && WorldExt.genre) || new URLSearchParams(location.search).get('genre') || 'free'; } catch (e) { return 'free'; }
  }
  function readKB(g) {
    var box = { knowledge: [] };
    try { box = JSON.parse(localStorage.getItem('storyKnowledge_' + g)) || box; } catch (e) {}
    var gl = { knowledge: [] };
    try { gl = JSON.parse(localStorage.getItem('storyKBGlobal')) || gl; } catch (e) {}
    return (box.knowledge || []).concat(gl.knowledge || []);
  }
  function readTrash(g) {
    try { return JSON.parse(localStorage.getItem('storyKBTrash_' + g)) || []; } catch (e) { return []; }
  }
  function writeTrash(g, arr) {
    try { localStorage.setItem('storyKBTrash_' + g, JSON.stringify(arr.slice(-50))); } catch (e) {}
  }

  /* ---- 回收站:包裹 deleteItem ---- */
  function hookDelete() {
    var KM = window.StoryKnowledge || window.KnowledgeManager;
    if (!KM || KM.__trashHooked) return false;
    if (typeof KM.deleteItem !== 'function') return false;
    var orig = KM.deleteItem;
    KM.deleteItem = function (id) {
      var e = null;
      try { e = KM.getById(id); } catch (e0) {}
      if (e) {
        var arr = readTrash(genreNow());
        arr.push({ entry: e, at: Date.now() });
        writeTrash(genreNow(), arr);
      }
      return orig.apply(this, arguments);
    };
    KM.__trashHooked = true;
    return true;
  }
  window.KBTrash = {
    list: function () { return readTrash(genreNow()); },
    restore: function (idx) {
      var arr = readTrash(genreNow());
      var it = arr.splice(idx, 1)[0];
      if (!it) return '条目不存在';
      writeTrash(genreNow(), arr);
      var KM = window.StoryKnowledge || window.KnowledgeManager;
      if (KM && KM.importData) { KM.importData([it.entry]); return '已恢复:' + it.entry.title; }
      return '恢复失败(管理器不可用)';
    },
    clear: function () { writeTrash(genreNow(), []); return '已清空回收站'; }
  };

  /* ---- 统计条 + 回收站按钮 挂载 ---- */
  function buildStats() {
    var g = genreNow();
    var all = readKB(g);
    var on = all.filter(function (e) { return e && e.enabled !== false; });
    var always = on.filter(function (e) { return e.alwaysInclude === true; });
    var trash = readTrash(g).length;
    return '条目 <b>' + on.length + '</b>/' + all.length + ' 启用 · 常驻 ' + always.length + ' · 已关 ' + (all.length - on.length) + (trash ? ' · <span style="color:#e0a84c">回收站 ' + trash + '</span>' : '');
  }
  function openTrash() {
    var arr = KBTrash.list();
    if (!arr.length) { alert('回收站是空的(本界)'); return; }
    var html = arr.map(function (it, i) {
      return i + '. ' + (it.entry.title || '无题') + ' <button data-tr="' + i + '" style="margin:2px 4px;padding:2px 10px">恢复</button>';
    }).join('<br>') + '<br><br><button id="trClear" style="padding:2px 10px">清空回收站</button>';
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:20px';
    d.innerHTML = '<div style="background:#1c2030;border:1px solid rgba(224,168,76,.4);border-radius:12px;padding:16px;max-width:420px;width:100%;max-height:70vh;overflow:auto;font:13px/1.8 sans-serif;color:#e8e4d8"><b style="color:#e0a84c">♻ 回收站(本界,最多留50条)</b><br><br>' + html + '</div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (ev) {
      var t = ev.target;
      if (t.id === 'trClear') { KBTrash.clear(); d.remove(); return; }
      if (t.dataset && t.dataset.tr != null) {
        alert(KBTrash.restore(parseInt(t.dataset.tr, 10)));
        var bar = document.querySelector('[data-kbstats]');
        if (bar) bar.innerHTML = buildStats();
      }
      if (t === d) d.remove();
    });
  }
  function mountUI() {
    try {
      hookDelete();
      var stBtn = document.querySelector('[data-st-import]');
      if (!stBtn) return;
      var row = stBtn.parentElement;
      if (!row) return;
      var bar = row.parentElement && row.parentElement.querySelector('[data-kbstats]');
      if (!bar) {
        bar = document.createElement('div');
        bar.setAttribute('data-kbstats', '1');
        bar.style.cssText = 'width:100%;margin:4px 0;padding:5px 10px;border-radius:8px;background:rgba(138,180,200,.08);color:#a8c5d4;font-size:12px';
        if (row.parentElement) row.parentElement.insertBefore(bar, row);
      }
      bar.innerHTML = buildStats();
      if (!row.querySelector('[data-kbtrash]')) {
        var b = document.createElement('button');
        b.setAttribute('data-kbtrash', '1');
        b.textContent = '♻回收站';
        b.style.cssText = 'padding:8px 12px;border-radius:10px;border:1px solid rgba(138,180,200,.4);background:rgba(138,180,200,.12);color:#8ab4c8;cursor:pointer;font-size:13px;min-height:38px';
        b.onclick = openTrash;
        row.appendChild(b);
      }
    } catch (e) {}
  }
  MoUtils.pollUntil(mountUI, { interval: 2500, max: 80 });
  console.log('[KBEnhance] 统计条+序号+回收站 就绪');
})();

/* ---- v1.4 预设多份管理:整库快照/一键切换/删除 ---- */
(function () {
  function g() { try { return (window.WorldExt && WorldExt.genre) || new URLSearchParams(location.search).get('genre') || 'free'; } catch (e) { return 'free'; } }
  function key(n) { return 'storyKBProfile_' + g() + '_' + n; }
  function names() {
    var out = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k.indexOf('storyKBProfile_' + g() + '_') === 0) out.push(k.split('_').pop());
    }
    return out;
  }
  window.KBProfiles = {
    names: names,
    save: function (n) {
      var box = '{}';
      try { box = localStorage.getItem('storyKnowledge_' + g()) || '{}'; } catch (e) {}
      localStorage.setItem(key(n), box);
      return '已保存预设「' + n + '」(' + ((JSON.parse(box).knowledge || []).length) + ' 条)';
    },
    load: function (n) {
      var raw = localStorage.getItem(key(n));
      if (!raw) return '预设不存在';
      localStorage.setItem('storyKnowledge_' + g(), raw);
      try {
        var KM = window.StoryKnowledge || window.KnowledgeManager;
        if (KM && KM.load) { KM.load(); }
      } catch (e) {}
      return '已切换到「' + n + '」,重新打开面板生效';
    },
    del: function (n) { localStorage.removeItem(key(n)); return '已删除「' + n + '」'; }
  };
  function mount() {
    try {
      var row = document.querySelector('[data-st-import]');
      if (!row || !row.parentElement) return;
      var parent = row.parentElement;
      if (parent.querySelector('[data-kbprofile]')) return;
      var b = document.createElement('button');
      b.setAttribute('data-kbprofile', '1');
      b.textContent = '💾 预设';
      b.style.cssText = 'padding:8px 12px;border-radius:10px;border:1px solid rgba(111,191,115,.4);background:rgba(111,191,115,.12);color:#6fbf73;cursor:pointer;font-size:13px;min-height:38px';
      b.onclick = function () {
        var list = names();
        var html = '<b style="color:#6fbf73">💾 知识库预设(本界)</b><br>当前整库存为快照,可随时一键切换。<br><br>' +
          '<input id="pName" placeholder="新预设名…" style="width:60%;padding:6px;border-radius:6px;border:1px solid #555;background:#12141d;color:#eee">' +
          ' <button id="pSave" style="padding:6px 12px">保存当前</button><br><br>';
        html += list.length ? '已存预设:<br>' + list.map(function (n) {
          return '「' + n + '」 <button data-pload="' + n + '" style="padding:2px 10px;margin:2px">切换</button> <button data-pdel="' + n + '" style="padding:2px 8px;margin:2px;color:#e05c5c">删</button>';
        }).join('<br>') : '(还没有保存过预设)';
        var d = document.createElement('div');
        d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:20px';
        d.innerHTML = '<div style="background:#1c2030;border:1px solid rgba(111,191,115,.4);border-radius:12px;padding:16px;max-width:420px;width:100%;max-height:70vh;overflow:auto;font:13px/1.8 sans-serif;color:#e8e4d8">' + html + '</div>';
        document.body.appendChild(d);
        d.addEventListener('click', function (ev) {
          var t = ev.target;
          if (t.id === 'pSave') {
            var n = (d.querySelector('#pName').value || '').trim() || ('快照' + new Date().toLocaleDateString());
            alert(KBProfiles.save(n)); d.remove(); return;
          }
          if (t.dataset && t.dataset.pload) { alert(KBProfiles.load(t.dataset.pload)); d.remove(); return; }
          if (t.dataset && t.dataset.pdel) { alert(KBProfiles.del(t.dataset.pdel)); d.remove(); return; }
          if (t === d) d.remove();
        });
      };
      if (row.nextSibling) parent.insertBefore(b, row.nextSibling); else parent.appendChild(b);
    } catch (e) {}
  }
  MoUtils.pollUntil(mount, { interval: 2500, max: 80 });
})();
/* ---- v1.5 HUD 底条可收起:点「▾」收成细条,信息进太虚阁抽屉看 ---- */
(function () {
  var KEY = 'wrHudCollapsed';
  function apply() {
    var hud = document.querySelector('.wr-hud');
    if (!hud) return;
    if (localStorage.getItem(KEY) === '1') hud.classList.add('wr-hud-min'); else hud.classList.remove('wr-hud-min');
    var tg = hud.querySelector('.wr-hud-toggle');
    if (tg) tg.textContent = hud.classList.contains('wr-hud-min') ? '▸' : '▾';
  }
  function mount() {
    try {
      var hud = document.querySelector('.wr-hud');
      if (!hud || hud.querySelector('.wr-hud-toggle')) { apply(); return; }
      var b = document.createElement('button');
      b.className = 'wr-hud-toggle';
      b.textContent = localStorage.getItem(KEY) === '1' ? '▸' : '▾';
      b.title = '收起/展开状态条(信息在太虚阁-玩家面板常驻可见)';
      b.style.cssText = 'flex:0 0 auto;border:none;background:rgba(232,228,216,.08);color:#a8a290;border-radius:6px;width:22px;height:22px;font-size:11px;cursor:pointer;margin-right:4px';
      b.onclick = function () {
        var next = localStorage.getItem(KEY) === '1' ? '0' : '1';
        localStorage.setItem(KEY, next);
        apply();
      };
      hud.insertBefore(b, hud.firstChild);
      apply();
    } catch (e) {}
  }
  window.hudToggle = mount;
  MoUtils.pollUntil(mount, { interval: 2500, max: 80 });
})();