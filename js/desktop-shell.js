/**
 * 云境桌面客户端 · 视觉外壳层 v7.0.0
 * 仅 Electron（YunJingDesktop.isDesktop === true）注入自绘标题栏与游戏化边框；
 * PWA 浏览器版首行 return，不建 DOM、不挂监听。
 * 窗口控制方法由架构师在 preload 暴露；方法缺失时按钮安全空操作。
 */
(function () {
  'use strict';

  var D = window.YunJingDesktop;
  if (!D || D.isDesktop !== true) return;
  if (window.__yjDesktopShellInstalled) return;

  function install() {
    // 幂等：脚本重复引用、或页面已有同名节点时都不重复建
    if (window.__yjDesktopShellInstalled || document.getElementById('yjTitleBar')) return;
    if (!document.body) return;
    window.__yjDesktopShellInstalled = true;

    var bar = document.createElement('div');
    bar.id = 'yjTitleBar';
    bar.className = 'yj-titlebar';
    bar.innerHTML =
      '<div class="yj-brand">' +
        '<span class="yj-mark" aria-hidden="true"></span>' +
        '<span class="yj-name">云境</span>' +
        '<span class="yj-sub">万象入云 · 一念一世界</span>' +
      '</div>' +
      '<div class="yj-wins">' +
        '<button type="button" class="yj-win-btn" id="yjMinBtn" aria-label="最小化窗口" title="最小化">─</button>' +
        '<button type="button" class="yj-win-btn" id="yjMaxBtn" aria-label="最大化窗口" title="最大化">□</button>' +
        '<button type="button" class="yj-win-btn yj-close" id="yjCloseBtn" aria-label="关闭窗口" title="关闭">✕</button>' +
      '</div>';

    var fx = document.createElement('div');
    fx.id = 'yjShellFx';
    fx.setAttribute('aria-hidden', 'true');

    document.body.insertBefore(bar, document.body.firstChild);
    document.body.insertBefore(fx, bar.nextSibling);
    // v7.0.0：给 html 打标记，供 CSS 精准补偿自绘标题栏占去的顶部 40px，避免盖住各页顶栏按钮
    document.documentElement.classList.add('yj-shell-on');

    // 能力探测：preload 尚未暴露的方法不调用，避免渲染进程报错
    function call(method) {
      if (typeof D[method] !== 'function') return;
      try { D[method](); } catch (e) { /* 窗口控制失败不影响页面交互 */ }
    }

    var maxBtn = document.getElementById('yjMaxBtn');

    function syncMax() {
      if (!maxBtn || typeof D.isMaximized !== 'function') return;
      try {
        var r = D.isMaximized();
        function apply(v) {
          var on = !!v;
          maxBtn.textContent = on ? '❐' : '□';
          maxBtn.setAttribute('aria-label', on ? '还原窗口' : '最大化窗口');
          maxBtn.title = on ? '还原' : '最大化';
          maxBtn.setAttribute('data-maximized', on ? '1' : '0');
        }
        // invoke 返回 Promise，同时兼容架构师可能给出的同步布尔值
        if (r && typeof r.then === 'function') { r.then(apply, function () {}); }
        else { apply(r); }
      } catch (e) { /* 状态查询失败时保留当前图标 */ }
    }

    // v7.0.1：标题栏节点可能被页面脚本重建/移除，裸 .addEventListener 会抛
    // "Cannot read properties of null"，全局哨兵就弹红色「脚本运行错误」。统一判空。
    var minBtn = document.getElementById('yjMinBtn');
    var closeBtn = document.getElementById('yjCloseBtn');
    if (minBtn) minBtn.addEventListener('click', function () { call('minimizeWindow'); });
    if (maxBtn) maxBtn.addEventListener('click', function () { call('maximizeWindow'); });
    if (closeBtn) closeBtn.addEventListener('click', function () { call('closeWindow'); });

    bar.addEventListener('dblclick', function (e) {
      if (e.target.closest && e.target.closest('.yj-win-btn')) return;
      call('maximizeWindow');
    });

    window.addEventListener('resize', syncMax);
    syncMax();
  }

  // head 内同步脚本执行时 body 尚未创建，等 DOM 就绪再补建
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
