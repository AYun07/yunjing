/* 云境 · 轻提示桥（v5.1.1）
 * ---------------------------------------------------------------------------
 * 为什么有它：项目里原本有 35 处原生弹窗调用（alert）。
 * 原生弹窗的问题很实际：阻塞事件循环、样式与全站 toast 体系割裂、
 * 在移动端还顶掉半个屏幕；而且作者自订的体验口径就是「任何操作都要有反馈」。
 *
 * 现在统一走 yjAlert()：
 *   · 有 showToast（story-framework.js 提供）就用 toast，不阻塞、可叠加；
 *   · 独立页面（如 xiaoyun.html 不加载 story-framework）退回原生弹窗，行为不丢。
 * （注意：window.UIDialog.alert 是项目自己的模态框，不属于原生弹窗，保持原样。）
 * 调用：yjAlert('提示文字') / yjAlert('提示文字', 'error')
 */
(function () {
  if (window.yjAlert) return;
  window.yjAlert = function (msg, type) {
    var text = (msg == null ? '' : String(msg));
    try {
      if (typeof window.showToast === 'function') { window.showToast(text, type || 'info'); return; }
    } catch (e) { }
    try { window.alert(text); } catch (e) { }
  };
})();
