/* 云境 · 即时反馈层 LiveFeedback v1.0.0（v4.18.0）
 * 让玩家"看得见"世界的呼吸：
 *   ① 数值变动 → 角落浮字（属性名 +Δ，带原因），不再只有整块面板无声重绘；
 *   ② 世界时钟自转 → 常驻「世界动态」折叠小面板（最近若干条），重大事件红点；
 *   ③ 连续回归 → 记录每日首次进入，连续天数里程碑给一句轻提示。
 * 纪律：纯增量、自包含 DOM，不改动任何现有面板结构；所有监听有空值防御；
 *       偏好与记录存 localStorage，不随存档导出，不涉及隐私。 */
(function () {
  'use strict';

  /* ---------- ① 数值浮字 ---------- */
  var LABELS = {
    health: '气血', injury: '伤势', mana: '法力', stamina: '气力', mood: '心境',
    money: '钱财', realm: '境界', fame: '声望', karma: '因果', sanity: '理智'
  };
  function labelOf(k) { return LABELS[k] || String(k || '数值'); }
  function ensureLayer() {
    var el = document.getElementById('yjFeedbackLayer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'yjFeedbackLayer';
      /* v5.2.1（全量视觉审阅）：数值浮字原在 right:18px，正好压在右侧 330px 状态面板上
         （遮挡身份/姓名字段）。宽屏(≥1100px)改到状态栏左缘之外(right:356px)，浮在正文区右侧；
         窄屏状态面板不常驻右侧，仍回 right:18px，避免浮字跑出屏外。 */
      var wide = window.matchMedia && window.matchMedia('(min-width:1100px)').matches;
      el.style.cssText = 'position:fixed;right:' + (wide ? 356 : 18) + 'px;bottom:190px;z-index:9950;display:flex;flex-direction:column;gap:6px;align-items:flex-end;pointer-events:none;font-family:"Noto Sans SC",sans-serif;';
      document.body.appendChild(el);
    }
    return el;
  }
  function floatStat(detail) {
    try {
      var d = detail || {};
      var delta = Number(d.delta) || 0;
      if (!delta) return;
      var name = labelOf(d.stat);
      var up = delta > 0;
      // 游戏属性：增加用青绿、减少用暖红（非股票语境，按"增益/损耗"直觉配色）
      var color = up ? '#6fe0a8' : '#f08a7a';
      var item = document.createElement('div');
      item.textContent = name + ' ' + (up ? '+' : '') + delta + (d.reason ? ' · ' + String(d.reason).slice(0, 12) : '');
      item.style.cssText = 'padding:6px 12px;border-radius:10px;background:rgba(12,20,28,.9);border:1px solid ' + color + '80;color:' + color + ';font-size:12.5px;font-weight:700;box-shadow:0 6px 20px rgba(0,0,0,.4);opacity:0;transform:translateY(8px);transition:.35s;';
      var layer = ensureLayer();
      layer.appendChild(item);
      requestAnimationFrame(function () { item.style.opacity = '1'; item.style.transform = 'translateY(0)'; });
      setTimeout(function () { item.style.opacity = '0'; item.style.transform = 'translateY(-8px)'; setTimeout(function () { item.remove(); }, 420); }, 2600);
      while (layer.children.length > 6) layer.removeChild(layer.firstChild);
    } catch(e){console.warn("[swallowed] live-feedback",e)}
  }
  window.addEventListener('yj:stat-change', function (e) { floatStat(e && e.detail); });

  /* ---------- ② 世界动态常驻面板 ---------- */
  var LOG_KEY = 'yjWorldFeed';
  var feed = [];
  try { feed = JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); if (!Array.isArray(feed)) feed = []; } catch (e) { feed = []; }
  function saveFeed() { try { localStorage.setItem(LOG_KEY, JSON.stringify(feed.slice(-30))); } catch(e){console.warn("[swallowed] live-feedback",e)} }
  var FEED_HIDE_KEY = 'yjWorldFeedHidden';
  /* v5.2.1：默认收起，且「收起/展开」只在本会话内有效——刷新后总是回到干净的收起态。
     不用 localStorage 记忆展开态，否则老玩家历史残留的「展开」会继续遮挡正文。
     FEED_HIDE_KEY 保留仅为兼容旧调用，不再参与默认态判定。 */
  var _feedHidden = true; /* 会话级：默认收起 */
  function feedHidden() { return _feedHidden; }
  function setFeedHidden(v) { _feedHidden = !!v; try { localStorage.setItem(FEED_HIDE_KEY, v ? '1' : '0'); } catch(e){console.warn("[swallowed] live-feedback",e)} }

  /* v4.38.0 修 P1-4：世界动态面板常驻左下、遮挡内容且不能整体收起。
     加一个「×」关闭按钮 → 隐藏面板并在左下留一个极小的「⏱」重开圆点（不再是碍眼大卡片）。
     关闭状态记忆到 localStorage，刷新后保持；点重开圆点恢复。
     v5.2.1（全量视觉审阅 P0）：改为「默认收起」——世界动态是大卡片，常驻必然压住正文左下角
     与快捷指令区（1003 张截图逐屏证实）。现默认只显示极小的 ⏱ 圆点，玩家主动点开才展开大面板，
     不自动遮挡任何正文。玩家点开后本次会话内保持展开，点 × 或刷新后回到收起态。 */
  /* v7.3.0：世界动态图标与面板可用鼠标拖动，位置持久化。
     统一入口，makeDraggable 内部按 _moDraggable 防重、并抑制拖拽后的误触 click。 */
  function makeFeedDraggable(el, key) {
    if (!el) return;
    var tries = 0;
    (function bind() {
      if (el._moDraggable) return; // 已绑，停止
      if (window.MoChibi && typeof window.MoChibi.makeDraggable === 'function') {
        window.MoChibi.makeDraggable(el, { storageKey: key });
      } else if (++tries < 40) {
        setTimeout(bind, 300); // mo-chibi.js 懒加载，最多等约 12 秒
      }
    })();
  }
  function ensureReopenDot() {
    if (document.getElementById('yjWorldFeedReopen')) return;
    var dot = document.createElement('button');
    dot.id = 'yjWorldFeedReopen';
    dot.title = '显示世界动态';
    dot.setAttribute('aria-label', '显示世界动态');
    dot.style.cssText = 'position:fixed;left:18px;bottom:18px;z-index:9941;width:34px;height:34px;border-radius:50%;border:1px solid rgba(201,168,106,.4);background:rgba(14,16,30,.9);color:#e8c47a;font-size:15px;cursor:pointer;display:none;box-shadow:0 4px 14px rgba(0,0,0,.4)';
    dot.textContent = '⏱';
    makeFeedDraggable(dot, 'storyWorldFeedDotPos');
    dot.onclick = function () {
      setFeedHidden(false); dot.style.display = 'none';
      var rd = dot.querySelector('i'); if (rd) rd.remove(); /* 打开后清掉未读红点 */
      var el = ensureFeedPanel(); if (el) el.style.display = '';
    };
    (document.body || document.documentElement).appendChild(dot);
  }
  function ensureFeedPanel() {
    ensureReopenDot();
    var el = document.getElementById('yjWorldFeed');
    if (!el) {
      el = document.createElement('div');
      el.id = 'yjWorldFeed';
      el.style.cssText = 'position:fixed;left:18px;bottom:18px;z-index:9940;width:250px;max-height:230px;overflow:hidden;border-radius:14px;background:rgba(14,16,30,.92);border:1px solid rgba(201,168,106,.3);color:#e8e2d0;font-family:"Noto Sans SC",sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.45);font-size:12px;';
      el.innerHTML = '<div data-head style="display:flex;align-items:center;gap:6px;padding:8px 12px;border-bottom:1px solid rgba(201,168,106,.18);"><span data-toggle style="display:flex;align-items:center;gap:6px;cursor:pointer;flex:1;"><b style="font-size:12px;">⏱ 世界动态</b><span data-dot style="width:7px;height:7px;border-radius:50%;background:#c94b4b;display:none;"></span></span><span data-caret style="cursor:pointer;opacity:.6;padding:0 4px;">▾</span><button data-close title="收起世界动态" aria-label="收起世界动态" style="cursor:pointer;background:transparent;border:none;color:#c9b78f;font-size:15px;line-height:1;padding:2px 4px;">×</button></div><div data-body style="max-height:170px;overflow:auto;padding:6px 12px;"></div>';
      document.body.appendChild(el);
      makeFeedDraggable(el, 'storyWorldFeedPanelPos');
      var head = el.querySelector('[data-toggle]'), body = el.querySelector('[data-body]'), caret = el.querySelector('[data-caret]');
      function toggleBody() { var open = body.style.display !== 'none'; body.style.display = open ? 'none' : ''; caret.textContent = open ? '▸' : '▾'; if (!open) el.querySelector('[data-dot]').style.display = 'none'; }
      head.onclick = toggleBody;
      caret.onclick = toggleBody;
      el.querySelector('[data-close]').onclick = function (ev) {
        ev.stopPropagation();
        setFeedHidden(true);
        el.style.display = 'none';
        var dot = document.getElementById('yjWorldFeedReopen');
        if (dot) dot.style.display = 'block';
      };
      renderFeed();
    }
    if (feedHidden()) {
      el.style.display = 'none';
      var dot = document.getElementById('yjWorldFeedReopen');
      if (dot) dot.style.display = 'block';
    }
    return el;
  }
  function renderFeed() {
    var el = document.getElementById('yjWorldFeed');
    if (!el) return;
    var body = el.querySelector('[data-body]');
    if (!feed.length) { body.innerHTML = '<div style="opacity:.62;padding:6px 0;line-height:1.6;">天地初开，万物静候。随着故事推进，此处的风物人事会自行流转、一一记下。</div>'; return; }
    body.innerHTML = feed.slice(-12).reverse().map(function (x) {
      return '<div style="padding:6px 0;border-bottom:1px dashed rgba(255,255,255,.08);line-height:1.5;"><span style="opacity:.55;margin-right:6px;">' + (x.t || '') + '</span>' + String(x.e || '') + '</div>';
    }).join('');
  }
  function pushWorldEvent(text, major) {
    if (!text) return;
    var d = new Date();
    var stamp = (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    feed.push({ t: stamp, e: String(text).slice(0, 80) });
    if (feed.length > 30) feed = feed.slice(-30);
    saveFeed();
    ensureFeedPanel();
    renderFeed();
    if (major) {
      /* v5.2.1：面板默认收起，新重大事件要在「重开圆点」上给红点提示，否则玩家收起状态看不到任何动静 */
      var dot = document.querySelector('#yjWorldFeed [data-dot]');
      if (dot && dot.offsetParent !== null) dot.style.display = 'block';
      var rd = document.createElement('i');
      rd.style.cssText = 'position:absolute;top:-2px;right:-2px;width:8px;height:8px;border-radius:50%;background:#e05252;border:1px solid #fff;';
      var reopen = document.getElementById('yjWorldFeedReopen');
      if (reopen && !reopen.querySelector('i')) { reopen.style.position = 'relative'; reopen.appendChild(rd); }
    }
  }
  window.addEventListener('yj:world-tick', function (e) {
    var d = (e && e.detail) || {};
    pushWorldEvent(d.text || d.ev || d.event || '', !!d.major);
  });
  // 世界面板只在创作室需要；大厅不显示
  if (document.body && document.body.classList.contains('page-studio')) setTimeout(ensureFeedPanel, 1200);

  /* ---------- ③ 连续回归轻奖励 ---------- */
  function todayKey() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function checkStreak() {
    try {
      var last = localStorage.getItem('yjLastVisit');
      var streak = parseInt(localStorage.getItem('yjVisitStreak') || '0', 10) || 0;
      var today = todayKey();
      if (last === today) return;
      var yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      var yk = yesterday.getFullYear() + '-' + (yesterday.getMonth() + 1) + '-' + yesterday.getDate();
      streak = (last === yk) ? streak + 1 : 1;
      localStorage.setItem('yjLastVisit', today);
      localStorage.setItem('yjVisitStreak', String(streak));
      if (streak >= 2 && streak <= 30) {
        setTimeout(function () {
          try { window.showToast && window.showToast('🌤 连续回归第 ' + streak + ' 天 · 世界一直在这里等你', 'info'); } catch(e){console.warn("[swallowed] live-feedback",e)}
        }, 2600);
      }
    } catch(e){console.warn("[swallowed] live-feedback",e)}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', checkStreak);
  else checkStreak();

  window.LiveFeedback = { pushWorldEvent: pushWorldEvent, floatStat: floatStat, getFeed: function () { return feed.slice(); } };
})();
