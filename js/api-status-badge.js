/* 云境 · 游玩中模型配置引导徽标 v1.0.0（v4.19.2）
 *
 * 用户要求：「玩家在进行游玩时要明确告知玩家如何配置模型」。
 * 现状：配置能力都在「⚙ 接口设置」弹窗里，但玩家在创作区游玩时，
 *       顶栏没有任何「模型配没配 / 怎么配」的显性提示——没配的人不知道去哪配，
 *       配了的人不知道当前用的是哪个模型。
 * 本模块在顶栏加一个常驻状态徽标：
 *   · 未配置 → 琥珀色「⚠ 点此配置模型」，缓慢呼吸，点击直达配置弹窗；
 *   · 已配置 → 绿色「✓ 模型名」，点击可改。
 * 并在首次未配置、玩家已在创作区时，于正文顶部插一条一次性引导条（可关）。
 * 全程只读配置状态 + 调 ConfigModal.open()，不改任何核心逻辑。
 */
(function () {
  'use strict';

  var K_HINT_DISMISSED = 'yunjingApiHintDismissed';
  var badge = null;

  function fw() { return window.storyFramework || {}; }
  function configured() {
    try { return typeof fw().isApiConfigured === 'function' ? !!fw().isApiConfigured() : false; }
    catch (e) { return false; }
  }
  function modelName() {
    try {
      var c = fw().apiConfig || {};
      if (c.model) return c.model;
      var raw = localStorage.getItem('storyApiConfig');
      if (raw) { var j = JSON.parse(raw); return (j && j.model) || ''; }
    } catch(e){console.warn("[swallowed] api-status-badge",e)}
    return '';
  }
  function shortModel(m) {
    if (!m) return '模型';
    // 去掉常见的 :latest / 版本尾缀里过长部分，保留可读性
    return String(m).replace(/:latest$/, '').split('/').pop().slice(0, 18);
  }

  function style() {
    if (document.getElementById('apiBadgeStyle')) return;
    var s = document.createElement('style');
    s.id = 'apiBadgeStyle';
    s.textContent = `
      #apiStatusBadge{display:inline-flex;align-items:center;gap:5px;margin-left:8px;padding:4px 11px;
        border-radius:99px;font-size:11px;letter-spacing:.3px;cursor:pointer;white-space:nowrap;
        border:1px solid transparent;transition:.2s;font-family:inherit;vertical-align:middle;user-select:none;}
      #apiStatusBadge.off{color:#f0b45c;border-color:rgba(240,180,92,.4);background:rgba(240,180,92,.1);
        animation:apiBadgePulse 2.4s ease-in-out infinite;}
      #apiStatusBadge.on{color:#7fd6a8;border-color:rgba(127,214,168,.32);background:rgba(127,214,168,.08);}
      #apiStatusBadge:hover{filter:brightness(1.25);transform:translateY(-1px);}
      @keyframes apiBadgePulse{0%,100%{box-shadow:0 0 0 0 rgba(240,180,92,.32);}50%{box-shadow:0 0 0 5px rgba(240,180,92,0);}}
      .apiHintBar{display:flex;align-items:center;gap:10px;margin:0 0 12px;padding:10px 14px;border-radius:11px;
        font-size:12.5px;line-height:1.6;color:var(--text,#e8e4d8);
        background:linear-gradient(120deg,rgba(240,180,92,.12),rgba(240,180,92,.03));
        border:1px solid rgba(240,180,92,.32);}
      .apiHintBar .ah-ico{font-size:18px;flex:none;}
      .apiHintBar .ah-body{flex:1;min-width:0;}
      .apiHintBar b{color:#f0c878;}
      .apiHintBar .ah-btn{flex:none;padding:5px 13px;border-radius:8px;cursor:pointer;font-family:inherit;font-size:12px;
        border:1px solid rgba(240,180,92,.5);background:rgba(240,180,92,.16);color:#f4cd86;transition:.2s;}
      .apiHintBar .ah-btn:hover{background:rgba(240,180,92,.3);}
      .apiHintBar .ah-x{flex:none;cursor:pointer;color:var(--text-muted,#a8a290);font-size:15px;padding:0 3px;}
      @media(max-width:640px){#apiStatusBadge .ab-txt{display:none;}#apiStatusBadge{padding:4px 9px;}}
    `;
    document.head.appendChild(s);
  }

  function openConfig() {
    try {
      if (window.ConfigModal && ConfigModal.open) ConfigModal.open();
      else if (window.showToast) showToast('接口设置模块未就绪，请刷新页面', 'error');
    } catch(e){console.warn("[swallowed] api-status-badge",e)}
  }

  function refresh() {
    /* BUGFIX(audit): 配置成功后主动移除一次性引导条。旧实现只在 inject 时判断一次，
       配置完成后提示条仍留在布局里（且曾误插进 .main-layout 成为 flex 兄弟挤爆聊天区）。 */
    try {
      if (configured()) {
        var stale = document.querySelector('.apiHintBar');
        if (stale) stale.remove();
      }
    } catch(e){console.warn("[swallowed] api-status-badge",e)}
    if (!badge) return;
    var ok = configured();
    badge.className = ok ? 'on' : 'off';
    badge.innerHTML = ok
      ? '✓ <span class="ab-txt">' + esc(shortModel(modelName())) + '</span>'
      : '⚠ <span class="ab-txt">点此配置模型</span>';
    badge.title = ok ? ('当前模型：' + (modelName() || '未命名') + ' · 点击修改') : '尚未配置模型 · 点击前往接口设置（填 API 地址 / 密钥 / 模型）';
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function mount() {
    if (badge) { refresh(); return; }
    style();
    var anchor = document.getElementById('gameTitle');
    if (!anchor) return;
    badge = document.createElement('span');
    badge.id = 'apiStatusBadge';
    badge.addEventListener('click', openConfig);
    anchor.parentNode.insertBefore(badge, anchor.nextSibling);
    refresh();
  }

  /** 未配置时，在创作区顶部插一次性引导条（玩家关掉后不再出现） */
  function injectHint() {
    try {
      if (configured()) return;
      if (localStorage.getItem(K_HINT_DISMISSED) === '1') return;
      if (document.querySelector('.apiHintBar')) return;
      /* BUGFIX(audit): 绝不插入 .main-layout 作为直接 flex 子元素——旧兜底把提示条
         变成布局兄弟（宽 ~1060px），把 flex:1 的聊天区挤到 ~48px，正文被压成竖排、
         撑出 25 万像素高度而完全不可见。只插入到聊天区/向导区这类 flex:1 容器内部；
         找不到就不插（顶栏徽标已是足够的引导）。 */
      var host = document.querySelector('#chatArea')
        || document.querySelector('#setupWrap')
        || document.querySelector('#chatMessages');
      if (!host) return;
      var bar = document.createElement('div');
      bar.className = 'apiHintBar';
      bar.innerHTML = '<span class="ah-ico">🔑</span>'
        + '<span class="ah-body">还没配置模型？点右上角 <b>⚠ 点此配置模型</b>，'
        + '填入你的 API 地址 / 密钥 / 模型名并「测试连通」，即可开始创作。'
        + '云境支持各家厂商与本地模型，不限制模型来源。</span>'
        + '<button class="ah-btn" type="button">去配置</button>'
        + '<span class="ah-x" title="不再提示">✕</span>';
      bar.querySelector('.ah-btn').addEventListener('click', openConfig);
      bar.querySelector('.ah-x').addEventListener('click', function () {
        try { localStorage.setItem(K_HINT_DISMISSED, '1'); } catch(e){console.warn("[swallowed] api-status-badge",e)}
        bar.remove();
      });
      host.insertBefore(bar, host.firstChild);
    } catch(e){console.warn("[swallowed] api-status-badge",e)}
  }

  function init() {
    mount();
    injectHint();
    /* 配置保存 / 通道变化后刷新徽标 */
    window.addEventListener('yj:config-saved', refresh);
    window.addEventListener('yj:channel-changed', refresh);
    /* 兜底：定时刷新（配置弹窗保存未必派发事件） */
    setInterval(refresh, 4000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 400); });
  else setTimeout(init, 400);

  window.ApiStatusBadge = { mount: mount, refresh: refresh, openConfig: openConfig, injectHint: injectHint };
})();
