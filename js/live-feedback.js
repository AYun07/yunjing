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
      el.style.cssText = 'position:fixed;right:18px;bottom:190px;z-index:9950;display:flex;flex-direction:column;gap:6px;align-items:flex-end;pointer-events:none;font-family:"Noto Sans SC",sans-serif;';
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
    } catch (e) {}
  }
  window.addEventListener('yj:stat-change', function (e) { floatStat(e && e.detail); });

  /* ---------- ② 世界动态常驻面板 ---------- */
  var LOG_KEY = 'yjWorldFeed';
  var feed = [];
  try { feed = JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); if (!Array.isArray(feed)) feed = []; } catch (e) { feed = []; }
  function saveFeed() { try { localStorage.setItem(LOG_KEY, JSON.stringify(feed.slice(-30))); } catch (e) {} }
  function ensureFeedPanel() {
    var el = document.getElementById('yjWorldFeed');
    if (!el) {
      el = document.createElement('div');
      el.id = 'yjWorldFeed';
      el.style.cssText = 'position:fixed;left:18px;bottom:18px;z-index:9940;width:250px;max-height:230px;overflow:hidden;border-radius:14px;background:rgba(14,16,30,.92);border:1px solid rgba(201,168,106,.3);color:#e8e2d0;font-family:"Noto Sans SC",sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.45);font-size:12px;';
      el.innerHTML = '<div data-head style="display:flex;align-items:center;gap:6px;padding:8px 12px;cursor:pointer;border-bottom:1px solid rgba(201,168,106,.18);"><b style="font-size:12px;">⏱ 世界动态</b><span data-dot style="width:7px;height:7px;border-radius:50%;background:#c94b4b;display:none;"></span><span data-caret style="margin-left:auto;opacity:.6;">▾</span></div><div data-body style="max-height:170px;overflow:auto;padding:6px 12px;"></div>';
      document.body.appendChild(el);
      var head = el.querySelector('[data-head]'), body = el.querySelector('[data-body]');
      head.onclick = function () { var open = body.style.display !== 'none'; body.style.display = open ? 'none' : ''; head.querySelector('[data-caret]').textContent = open ? '▸' : '▾'; if (!open) head.querySelector('[data-dot]').style.display = 'none'; };
      renderFeed();
    }
    return el;
  }
  function renderFeed() {
    var el = document.getElementById('yjWorldFeed');
    if (!el) return;
    var body = el.querySelector('[data-body]');
    if (!feed.length) { body.innerHTML = '<div style="opacity:.55;padding:6px 0;">世界还没开始自转。开启「世界时钟」后，这里会记下发生的事件。</div>'; return; }
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
    if (major) { var dot = document.querySelector('#yjWorldFeed [data-dot]'); if (dot) dot.style.display = 'block'; }
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
          try { window.showToast && window.showToast('🌤 连续回归第 ' + streak + ' 天 · 世界一直在这里等你', 'info'); } catch (e) {}
        }, 2600);
      }
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', checkStreak);
  else checkStreak();

  window.LiveFeedback = { pushWorldEvent: pushWorldEvent, floatStat: floatStat, getFeed: function () { return feed.slice(); } };
})();
