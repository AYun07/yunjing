/* 云境 · 成长账本 GrowthLedger v1.0.0（v4.36.0 · T06）
 * ---------------------------------------------------------------------------
 * 定位：给 AttributeEngine 的审计账本 v.statLog 一个统一查看入口。
 *       数值增减（gain/injury/heal/train/event）与行动判定（check）都落在
 *       同一本账上，带事由/章节/时间，刷新仍在（随存档持久化）。
 * 只读不改状态：本面板不做任何数值写入，仅分组回看 + 筛选。纯前端、无外发。
 */
(function () {
  'use strict';

  var TYPE_META = {
    gain:   { ico: '⬆', name: '增长', color: '#7fe0a8' },
    train:  { ico: '📚', name: '修行', color: '#7fc9e0' },
    heal:   { ico: '💚', name: '恢复', color: '#9fe0a8' },
    injury: { ico: '⚔', name: '受创', color: '#ff9e8e' },
    event:  { ico: '✦', name: '事件', color: '#d7b3ff' },
    check:  { ico: '🎯', name: '判定', color: '#ffd479' }
  };

  function log() {
    try { if (window.YJDebug) console.debug('[GrowthLedger]', ...arguments); } catch (e) {}
  }

  function readLog() {
    try {
      var st = window.storyFramework && window.storyFramework.storyState;
      var v = st && st.variables;
      return (v && Array.isArray(v.statLog)) ? v.statLog : [];
    } catch (e) { return []; }
  }

  function fmtTime(t) {
    try {
      var d = new Date(t);
      if (isNaN(d.getTime())) return '';
      return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
        + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    } catch (e) { return ''; }
  }

  function esc(x) {
    return String(x == null ? '' : x)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function rowsFor(filter) {
    var logArr = readLog().slice().reverse(); // 最新在前
    if (filter && filter !== 'all') logArr = logArr.filter(function (r) { return r.type === filter; });
    if (!logArr.length) return '<div class="gl-empty">账本里还没有记录。修炼、战斗、或掷一次行动判定，就会在这里留下带事由的痕迹。</div>';
    return logArr.map(function (r) {
      var m = TYPE_META[r.type] || TYPE_META.event;
      var d = Number(r.delta) || 0;
      var dTxt = r.type === 'check'
        ? ('判定 ' + esc(String(r.value)))
        : (d > 0 ? '+' + d : String(d));
      var dColor = r.type === 'check' ? '#ffd479' : (d > 0 ? '#7fe0a8' : d < 0 ? '#ff9e8e' : '#9fb6c4');
      return '<div class="gl-row">'
        + '<span class="gl-ico" style="color:' + m.color + '">' + m.ico + '</span>'
        + '<div class="gl-main"><div class="gl-l1"><b>' + esc(r.stat) + '</b>'
        + '<span class="gl-delta" style="color:' + dColor + '">' + dTxt + '</span></div>'
        + '<div class="gl-reason">' + esc(r.reason || '（无事由）') + '</div>'
        + '<div class="gl-meta">' + esc(fmtTime(r.t))
        + (r.chapter ? ' · 第' + esc(r.chapter) + '章' : '')
        + ' · ' + m.name + '</div></div></div>';
    }).join('');
  }

  function counts() {
    var c = { all: readLog().length };
    Object.keys(TYPE_META).forEach(function (k) { c[k] = 0; });
    readLog().forEach(function (r) { if (c[r.type] != null) c[r.type]++; });
    return c;
  }

  function render() {
    var box = document.getElementById('glBody');
    if (!box) return;
    var active = window.__glFilter || 'all';
    var c = counts();
    var chips = ['all'].concat(Object.keys(TYPE_META)).map(function (k) {
      var meta = k === 'all' ? { ico: '📖', name: '全部' } : TYPE_META[k];
      return '<button class="gl-chip' + (active === k ? ' on' : '') + '" onclick="GrowthLedger.filter(\'' + k + '\')">'
        + meta.ico + ' ' + meta.name + ' <span>' + (c[k] || 0) + '</span></button>';
    }).join('');
    var filterBar = document.getElementById('glFilters');
    if (filterBar) filterBar.innerHTML = chips;
    box.innerHTML = rowsFor(active);
  }

  function open() {
    var old = document.getElementById('growthLedgerPanel');
    if (old) old.remove();
    var w = document.createElement('div');
    w.id = 'growthLedgerPanel';
    w.innerHTML =
      '<div class="gl-overlay" onclick="if(event.target===this)GrowthLedger.close()">'
      + '<div class="gl-modal">'
      + '<div class="gl-top"><b>📈 成长账本</b>'
      + '<span class="gl-sub">数值增减与行动判定全程留痕 · 随存档持久化</span>'
      + '<button class="gl-x" onclick="GrowthLedger.close()">✕</button></div>'
      + '<div class="gl-filters" id="glFilters"></div>'
      + '<div class="gl-body" id="glBody"></div>'
      + '<div class="gl-note">账本由属性引擎自动记录：修炼/战斗/疗伤/剧情事件的属性增减，以及行动判定骰的每一次结果（成败都记）。最多保留最近 80 条。</div>'
      + '</div></div>';
    document.body.appendChild(w);
    _style();
    render();
  }

  function close() {
    var el = document.getElementById('growthLedgerPanel');
    if (el) el.remove();
  }

  function filter(k) { window.__glFilter = k; render(); }

  function _style() {
    if (document.getElementById('glStyle')) return;
    var st = document.createElement('style');
    st.id = 'glStyle';
    st.textContent =
      '.gl-overlay{position:fixed;inset:0;background:rgba(0,0,0,.62);backdrop-filter:blur(3px);z-index:9995;display:flex;align-items:center;justify-content:center;padding:18px}'
      + '.gl-modal{width:min(680px,95vw);max-height:88vh;display:flex;flex-direction:column;background:linear-gradient(160deg,#1b2029,#12161c);border:1px solid #7fc9e055;border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.6);overflow:hidden;animation:glIn .3s ease both}'
      + '@keyframes glIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}'
      + '.gl-top{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid #7fc9e025}'
      + '.gl-top b{color:#dcebf5;font-size:15px;letter-spacing:1px}.gl-sub{font-size:11px;color:#8fa6b5;margin-right:auto}.gl-x{background:none;border:none;color:#8fa6b5;font-size:16px;cursor:pointer;padding:4px 8px}'
      + '.gl-filters{display:flex;flex-wrap:wrap;gap:6px;padding:12px 18px 6px}'
      + '.gl-chip{background:#1d2a33;border:1px solid #7fc9e033;color:#b9cbd6;border-radius:20px;padding:5px 11px;font-size:11px;cursor:pointer;white-space:nowrap}'
      + '.gl-chip span{color:#6f8796;margin-left:3px}.gl-chip.on{background:linear-gradient(135deg,#2b6a78,#1d4d58);border-color:#7fc9e0aa;color:#eaf4fa}.gl-chip.on span{color:#cfeaf2}'
      + '.gl-body{padding:8px 18px 16px;overflow:auto;flex:1}'
      + '.gl-row{display:flex;gap:10px;padding:10px 2px;border-bottom:1px solid #7fc9e015}.gl-ico{font-size:18px;flex:0 0 22px;text-align:center;padding-top:2px}.gl-main{flex:1;min-width:0}'
      + '.gl-l1{display:flex;align-items:baseline;justify-content:space-between;gap:10px}.gl-l1 b{color:#dcebf5;font-size:13px}.gl-delta{font-weight:700;font-size:13px}'
      + '.gl-reason{font-size:12px;color:#a9becb;line-height:1.6;margin-top:3px;word-break:break-word}.gl-meta{font-size:10px;color:#637b8a;margin-top:4px}'
      + '.gl-empty{font-size:12px;color:#6f8796;text-align:center;padding:38px 10px;line-height:1.8}'
      + '.gl-note{font-size:11px;color:#6f8796;line-height:1.6;padding:10px 18px;border-top:1px solid #7fc9e015}';
    document.head.appendChild(st);
  }

  window.GrowthLedger = {
    open: open, close: close, filter: filter, render: render,
    readLog: readLog, TYPE_META: TYPE_META
  };
})();
