/* 云境 · SillyTavern 导入 v1.0.0
   支持:世界书/Lorebook(.json)、角色卡 v2/v3(.json)、对话预设(prompts)
   用法:知识库面板点「导入 SillyTavern」或控制台 STImport.pick() */
(function () {
  'use strict';
  function ent(title, content, category, tags, alwaysInclude, priority) {
    return { title: String(title).slice(0, 40), content: String(content).slice(0, 1500), category: category || '导入', tags: tags || ['导入'], alwaysInclude: !!alwaysInclude, priority: priority || 'medium' };
  }
  function parseST(text) {
    var data = JSON.parse(text);
    var out = [];
    if (!data || typeof data !== 'object') return out;
    // 角色卡 v2/v3(顶层或 data 包裹)
    var card = (data.spec && /^chara_card_v[23]$/.test(data.spec)) ? data : (data.data && data.data.spec && /^chara_card_v[23]$/.test(data.data.spec) ? data.data : (data.description ? data : null));
    if (card) {
      var nm = card.name || '角色卡';
      if (card.description) out.push(ent(nm + '·设定', card.description, '设定', ['ST导入'], false, 'high'));
      if (card.personality) out.push(ent(nm + '·性格', card.personality, '人物', ['ST导入'], false, 'medium'));
      if (card.scenario) out.push(ent(nm + '·处境', card.scenario, '规则', ['ST导入'], false, 'medium'));
      if (card.creator_notes) out.push(ent(nm + '·说明', String(card.creator_notes).slice(0, 600), '说明', ['ST导入'], false, 'low'));
    }
    // 世界书:顶层 entries / character_book.entries / data.character_book.entries
    var lore = data.entries || (data.character_book && data.character_book.entries) || (card && card.character_book && card.character_book.entries) || (data.data && data.data.character_book && data.data.character_book.entries);
    if (lore) {
      var arr = Array.isArray(lore) ? lore : Object.keys(lore).map(function (k) { return lore[k]; });
      arr.forEach(function (e) {
        if (!e || e.disable || e.enabled === false || e.disabled) return;
        var keys = e.key || e.keys || e.keysecondary || [];
        if (typeof keys === 'string') keys = [keys];
        keys = keys.filter(Boolean);
        var content = String(e.content || '').trim();
        if (!content) return;
        out.push({
          title: (keys[0] || e.comment || '世界书条目').slice(0, 30),
          content: content.slice(0, 1500),
          category: '世界书',
          tags: keys.slice(0, 6).length ? keys.slice(0, 6) : ['ST导入'],
          alwaysInclude: !!(e.constant || e.alwaysInclude || !keys.length),
          priority: (e.order || 0) >= 80 ? 'high' : (keys.length ? 'medium' : 'high')
        });
      });
    }
    // 对话预设:prompts 数组(openai 式)
    if (Array.isArray(data.prompts)) {
      data.prompts.forEach(function (p) {
        if (!p || !p.content) return;
        out.push(ent(p.name || '预设段落', p.content, '预设', ['ST导入'], !!p.enabled === false ? false : false, 'medium'));
      });
    }
    // 单条兼容
    if (!out.length && data.content) out.push(ent(data.title || data.comment || '导入条目', data.content, '导入', ['ST导入'], false, 'medium'));
    return out;
  }
  function genreNow() {
    try { return (window.WorldExt && WorldExt.genre) || (new URLSearchParams(location.search).get('genre')) || 'free'; } catch (e) { return 'free'; }
  }
  function importEntries(entries, asGlobal) {
    var key = asGlobal ? 'storyKBGlobal' : 'storyKnowledge_' + genreNow();
    var box = { knowledge: [] };
    try { box = JSON.parse(localStorage.getItem(key)) || box; } catch (e) {}
    var have = {};
    (box.knowledge || []).forEach(function (e) { have[e.title] = 1; });
    var added = 0;
    entries.forEach(function (e) { if (!have[e.title]) { (box.knowledge = box.knowledge || []).push(e); added++; } });
    localStorage.setItem(key, JSON.stringify(box));
    try {
      var KM = window.KnowledgeManager || window.KBMgr;
      if (KM && KM.load) { KM.load(); if (KM._loadGlobal) KM._loadGlobal(); if (KM.init) KM.init(); }
    } catch (e) {}
    return added;
  }
  function readFile(file, asGlobal) {
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var es = parseST(String(fr.result));
        if (!es.length) { alert('未识别到可导入内容:需要世界书 entries / 角色卡 description / 预设 prompts'); return; }
        var n = importEntries(es, asGlobal);
        alert('导入成功:共 ' + es.length + ' 条,新增 ' + n + ' 条(重名跳过)。重新打开知识库面板即可看到。');
      } catch (e) { alert('解析失败:' + e.message); }
    };
    fr.readAsText(file, 'utf-8');
  }
  function pick() {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.onchange = function () {
      if (inp.files && inp.files[0]) {
        var asGlobal = confirm('导入到【全局知识库】(所有世界可用)点确定;\n导入到【当前世界】点取消。');
        readFile(inp.files[0], asGlobal);
      }
    };
    inp.click();
  }
  // 知识库面板自动挂按钮
  function tryMount() {
    try {
      if (document.querySelector('[data-st-import]')) return;
      var anchor = null;
      var btns = document.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        if (/导入/.test(btns[i].textContent || '')) { anchor = btns[i]; break; }
      }
      if (!anchor) return;
      var row = anchor.parentElement;
      if (!row || row.querySelector('[data-st-import]')) return;
      var btn = document.createElement('button');
      btn.setAttribute('data-st-import', '1');
      btn.textContent = '📥 导入SillyTavern';
      btn.style.cssText = 'padding:8px 12px;border-radius:10px;border:1px solid rgba(224,168,76,.45);background:rgba(224,168,76,.14);color:#e0a84c;cursor:pointer;font-size:13px;min-height:38px';
      btn.onclick = function () { try { pick(); } catch (e) { alert('导入功能异常:' + e.message); } };
      if (anchor.nextSibling) row.insertBefore(btn, anchor.nextSibling); else row.appendChild(btn);
    } catch (e) {}
  }MoUtils.pollUntil(function () { try { tryMount(); } catch (e) {} }, { interval: 2500, max: 80 });
  window.STImport = { pick: pick, parse: parseST, importEntries: importEntries };
  console.log('[STImport] SillyTavern 导入就绪(世界书/角色卡/预设)');
})();

/* ---- v1.1 知识库条目独立开/关(关闭=不进检索不进常驻,条目保留) ---- */
(function () {
  function boot() {
    var KM = window.StoryKnowledge || window.KnowledgeManager;
    if (!KM || !KM.knowledgeBase) { setTimeout(boot, 800); return; }
    var disL = [], disG = [];
    function split() { if (1) return;
      try {
        disL = (KM.knowledgeBase || []).filter(function (e) { return e && e.enabled === false; });
        KM.knowledgeBase = (KM.knowledgeBase || []).filter(function (e) { return !e || e.enabled !== false; });
        disG = (KM._globalKB || []).filter(function (e) { return e && e.enabled === false; });
        KM._globalKB = (KM._globalKB || []).filter(function (e) { return !e || e.enabled !== false; });
      } catch (e) {}
    }
    ['load', 'init', '_loadGlobal'].forEach(function (fn) {
      var o = KM[fn];
      if (typeof o === 'function') { KM[fn] = function () { var r = o.apply(this, arguments); split(); return r; }; }
    });
    ['save', '_saveGlobal', 'persist'].forEach(function (fn) {
      var o = KM[fn];
      if (typeof o === 'function') {
        KM[fn] = function () {
          var mL = disL.splice(0), mG = disG.splice(0);
          (this.knowledgeBase = this.knowledgeBase || []).push.apply(this.knowledgeBase, mL);
          (this._globalKB = this._globalKB || []).push.apply(this._globalKB, mG);
          try { return o.apply(this, arguments); } finally { split(); }
        };
      }
    });
    split();
    window.KBToggle = function (id) {
      var e = null;
      (KM.knowledgeBase || []).concat(KM._globalKB || []).forEach(function (x) { if (x && x.id === id) e = x; });
      if (!e) return;
      e.enabled = e.enabled === false;
      try { KM.save && KM.save(); KM._saveGlobal && KM._saveGlobal(); } catch (e3) {}
      try {
        var bar = document.querySelector('[data-kbstats]');
        if (bar) {
          var g2 = (window.WorldExt && WorldExt.genre) || 'free';
          var all = [];
          try { all = (JSON.parse(localStorage.getItem('storyKnowledge_' + g2)) || {}).knowledge || []; } catch (e5) {}
          try { all = all.concat((JSON.parse(localStorage.getItem('storyKBGlobal')) || {}).knowledge || []); } catch (e6) {}
          var on = all.filter(function (x) { return x && x.enabled !== false; });
          var alw = on.filter(function (x) { return x.alwaysInclude === true; });
          bar.innerHTML = '条目 <b>' + on.length + '</b>/' + all.length + ' 启用 · 常驻 ' + alw.length + ' · 已关 ' + (all.length - on.length);
        }
      } catch (e7) {}Array.prototype.forEach.call(document.querySelectorAll('.kb-item'), function (row) {
        var m = (row.getAttribute('onclick') || '').match(/'([^']+)'/);
        if (m && m[1] === id) row.classList.toggle("kb-off");
      });
    };
    // 每行挂开关按钮
    function mount() {
      Array.prototype.forEach.call(document.querySelectorAll('.kb-item'), function (row) {
        if (row.querySelector('[data-kbtoggle]')) return;
        var m = (row.getAttribute('onclick') || '').match(/'([^']+)'/);
        if (!m) return;
        var b = document.createElement('button');
        b.setAttribute('data-kbtoggle', '1');
        b.textContent = '⏻';
        b.title = '开/关此条目(关闭后不参与 AI 检索)';
        b.style.cssText = 'border:none;background:rgba(138,180,200,.15);color:#8ab4c8;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:12px;margin-left:4px';
        b.onclick = function (ev) { ev.stopPropagation(); window.KBToggle(m[1]); };
        row.appendChild(b);
      });
    }
    MoUtils.pollUntil(mount, { interval: 2500, max: 80 });
    console.log('[KB] 条目开关就绪');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
/* ---- v1.3 PNG角色卡导入 + 导出为ST世界书 ---- */
(function () {
  'use strict';
  function pngCard(buf) {
    var d = new Uint8Array(buf);
    if (d[0] !== 0x89 || d[1] !== 0x50) return null;
    var p = 8, b64 = null;
    while (p + 8 < d.length) {
      var len = ((d[p] << 24) | (d[p+1] << 16) | (d[p+2] << 8) | d[p+3]) >>> 0;
      var type = String.fromCharCode(d[p+4], d[p+5], d[p+6], d[p+7]);
      if (type === 'tEXt') {
        var s = '';
        for (var i = p + 8; i < p + 8 + len; i++) s += String.fromCharCode(d[i]);
        var nul = s.indexOf(String.fromCharCode(0));
        var kw = s.slice(0, nul), val = s.slice(nul + 1);
        if (kw === 'chara' || kw === 'ccv3') b64 = val;
      }
      if (type === 'IEND') break;
      p += 12 + len;
    }
    if (!b64) return null;
    try { return JSON.parse(decodeURIComponent(escape(atob(b64)))); } catch (e) { return null; }
  }
  function pickAny() {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json,image/png';
    inp.onchange = function () {
      var f = inp.files && inp.files[0];
      if (!f) return;
      var asGlobal = confirm('导入到【全局知识库】点确定;仅【当前世界】点取消。');
      if (/png$/i.test(f.name)) {
        var fr = new FileReader();
        fr.onload = function () {
          var card = pngCard(fr.result);
          if (!card) { alert('这张 PNG 里没有角色卡数据(需要 SillyTavern 导出的卡)'); return; }
          var core = card.data || card;
          var es = window.STImport.parse(JSON.stringify(core));
          if (!es.length) { alert('卡内无可导入字段'); return; }
          var n = STImport.importEntries(es, asGlobal);
          alert('PNG 角色卡导入成功:新增 ' + n + '/' + es.length + ' 条');
        };
        fr.readAsArrayBuffer(f);
      } else {
        var fr2 = new FileReader();
        fr2.onload = function () {
          try {
            var es = STImport.parse(String(fr2.result));
            if (!es.length) { alert('未识别到可导入内容'); return; }
            var n = STImport.importEntries(es, asGlobal);
            alert('导入成功:新增 ' + n + '/' + es.length + ' 条');
          } catch (e) { alert('解析失败:' + e.message); }
        };
        fr2.readAsText(f, 'utf-8');
      }
    };
    inp.click();
  }
  function exportST() {
    var g = (window.WorldExt && WorldExt.genre) || 'free';
    var box = {};
    try { box = JSON.parse(localStorage.getItem('storyKnowledge_' + g)) || {}; } catch (e) {}
    var entries = {}, n = 0;
    (box.knowledge || []).forEach(function (e, ix) {
      if (!e || e.enabled === false) return;
      var o = 90; if (e.priority === 'top') o = 100; else if (e.priority === 'medium') o = 60; else if (e.priority === 'low') o = 40;
      entries['k' + ix] = {
        uid: ix, key: e.tags || [], keysecondary: [],
        content: (e.title ? '【' + e.title + '】' : '') + (e.content || ''),
        constant: e.alwaysInclude === true, selective: !!(e.tags && e.tags.length),
        order: o, position: 0, disable: false,
        comment: e.title || ('条目' + ix)
      };
      n++;
    });
    var out = JSON.stringify({ entries: entries }, null, 1);
    var blob = new Blob([out], { type: 'application/json' });
    var aEl = document.createElement('a');
    aEl.href = URL.createObjectURL(blob);
    aEl.download = 'yunjing-' + g + '-worldbook.json';
    document.body.appendChild(aEl); aEl.click();
    setTimeout(function () { URL.revokeObjectURL(aEl.href); aEl.remove(); }, 800);
    return '已导出 ' + n + ' 条为 ST 世界书';
  }
  window.STPngCard = pngCard;
  window.STExportWB = exportST;
  function mount() {
    try {
      var st = document.querySelector('[data-st-import]');
      if (!st || !st.parentElement) return;
      var row = st.parentElement;
      if (!row.querySelector('[data-st-png]')) {
        var b = document.createElement('button');
        b.setAttribute('data-st-png', '1');
        b.textContent = '🖼 PNG卡';
        b.style.cssText = 'padding:8px 12px;border-radius:10px;border:1px solid rgba(224,168,76,.4);background:rgba(224,168,76,.1);color:#e0a84c;cursor:pointer;font-size:13px;min-height:38px';
        b.onclick = pickAny;
        if (st.nextSibling) row.insertBefore(b, st.nextSibling); else row.appendChild(b);
      }
      if (!row.querySelector('[data-st-exp]')) {
        var b2 = document.createElement('button');
        b2.setAttribute('data-st-exp', '1');
        b2.textContent = '📤 导出ST';
        b2.style.cssText = 'padding:8px 12px;border-radius:10px;border:1px solid rgba(138,180,200,.4);background:rgba(138,180,200,.1);color:#8ab4c8;cursor:pointer;font-size:13px;min-height:38px';
        b2.onclick = function () { alert(exportST()); };
        row.appendChild(b2);
      }
    } catch (e) {}
  }
  /* v3.55.3 性能：轮询改「页面可见才跑 + 挂上即降频」——低配设备不再每 2.5s 白扫一遍 DOM */
  var mountTick = 0;
  setInterval(function () {
    if (document.hidden) return;               /* 后台标签页零开销 */
    mountTick++;
    if (mountTick > 3 && mountTick % 4 !== 0) return; /* 挂上后降到 10s 一巡 */
    try { mount(); } catch (e) {}
  }, 2500);
  console.log('[STImport] PNG卡+ST导出 就绪');
})();
/* ---- v1.4 UI看门狗:清理关闭失败残留的幽灵遮罩 ----
   v3.55.3 性能：3s 强制布局巡检（getComputedStyle + getBoundingClientRect）是低配机
   隐形负担 → 页面可见才跑、10s 一巡；流畅模式（low-spec）放宽到 30s，功能不少只降频 */
setInterval(function () {
  if (document.hidden) return;
  var lowSpec = document.documentElement.classList.contains('low-spec');
  if (lowSpec && (window.__yjJanitorTick = (window.__yjJanitorTick || 0) + 1) % 3 !== 0) return;
  try {
    Array.prototype.forEach.call(document.querySelectorAll('.modal-overlay, [class*="overlay"]'), function (ov) {
      var cs = getComputedStyle(ov);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none') return;
      var bg = cs.backgroundColor || '';
      var m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      var alpha = m ? (m[4] == null ? 1 : parseFloat(m[4])) : 0;
      if (alpha < 0.05) return;
      var hasVisible = false;
      Array.prototype.forEach.call(ov.children, function (ch) {
        var r = ch.getBoundingClientRect();
        if (r.width > 40 && r.height > 40) hasVisible = true;
      });
      if (!hasVisible) { ov.style.display = 'none'; console.warn('[Janitor] 清理幽灵遮罩'); }
    });
  } catch (e) {}
}, 10000);