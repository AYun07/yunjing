/* 云境 · 开场入口分派（v4.34.0）
   由 opening.html 的「踏云 / 续梦 / 观星」入口通过 index.html?entry=xxx 触发。
   职责：读取 entry 参数，等待对应全局接口就绪后打开面板；接口未加载则回退到大厅并给出提示。
   不改动任何现有脚本逻辑，纯增量。 */
(function () {
  var params = new URLSearchParams(location.search);
  var entry = params.get('entry');
  if (!entry) return;

  function whenReady(test, run, timeoutMs) {
    var waited = 0, step = 80, max = timeoutMs || 6000;
    (function tick() {
      if (test()) { try { run(); } catch (e) { console.warn('[opening-entry]', e); } return; }
      waited += step;
      if (waited >= max) return; // 超时静默回退到大厅
      setTimeout(tick, step);
    })();
  }

  function toast(msg) {
    try {
      var d = document.createElement('div');
      d.textContent = msg;
      d.style.cssText = 'position:fixed;left:50%;top:24px;transform:translateX(-50%);z-index:99999;' +
        'background:rgba(14,11,30,.92);color:#f4d896;border:1px solid rgba(244,216,150,.4);' +
        'padding:10px 18px;border-radius:10px;font:14px system-ui;box-shadow:0 6px 24px rgba(0,0,0,.5)';
      document.body.appendChild(d);
      setTimeout(function () { d.remove(); }, 3600);
    } catch (e) { }
  }

  if (entry === 'settings') {
    whenReady(function () { return !!(window.ConfigModal && window.ConfigModal.open); },
      function () { window.ConfigModal.open(); });
    // 老版本兜底：ModuleSettings
    whenReady(function () { return !!(window.ModuleSettings && window.ModuleSettings.open); },
      function () { if (!(window.ConfigModal && window.ConfigModal._opened)) window.ModuleSettings.open(); }, 800);
  } else if (entry === 'continue') {
    whenReady(function () { return !!(window.SaveSlots && window.SaveSlots.open); },
      function () { window.SaveSlots.open(); }, 8000);
    whenReady(function () { return !!window.XYBuddy && !!(window.XiaoyunOps); },
      function () { toast('存档管理已打开。若未出现，请点右下角小云说「存档」。'); }, 8000);
  } else if (entry === 'new') {
    // 踏云即进入大厅选世界；首次用时引导脚本会给出提示，这里不重复打扰
  }

  // 触发后清理地址栏参数，避免刷新重复弹窗
  try {
    var clean = location.pathname;
    history.replaceState(null, '', clean);
  } catch (e) { }
})();
