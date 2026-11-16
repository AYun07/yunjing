/**
 * 移动端深度适配层 MobileFit（v3.36.0）
 * ---------------------------------------------------------------------------
 * 手机端（视口 ≤640px）对本轮新增功能模块的深度 UI 适配，一处注入、全局生效：
 *   ① 通讯浮层 → 全屏聊天页：顶部刘海安全区、输入 16px 防聚焦缩放、气泡加大、
 *      底部 Home 条安全区；通讯录行加高成触屏尺寸
 *   ② 模块设置弹窗 → 底部抽屉样式（拇指热区），行距/勾选框/按钮触屏化
 *   ③ 界专属模块组件触屏化：按钮 ≥38px、进度阶梯可换行、表格不横向溢出、
 *      装备格单列/双列自适应、状态板紧凑排版
 *   ④ 浮层打开时锁定 body 滚动（MutationObserver 监听，开屏即锁、关屏即解锁）
 *   ⑤ 100dvh 动态视口（地址栏收展不跳版）+ 100vh 兜底
 * 纯 CSS/DOM 层，零业务逻辑侵入；所有规则打 !important 以压过各模块运行期注入的样式。
 */
(function () {
    'use strict';

    const VERSION = 'v3.36.1';
    const MQ = '(max-width: 640px)';

    function isMobile() { try { return window.matchMedia(MQ).matches; } catch (e) { return false; } }
    function applyClass() {
        try { document.body.classList.toggle('yunjing-mobile', isMobile()); } catch (e) { }
    }

    /* ==================== 样式注入 ==================== */
    function injectStyle() {
        if (document.getElementById('mobileFitStyle')) return;
        const st = document.createElement('style');
        st.id = 'mobileFitStyle';
        st.textContent = `
/* ===== 触屏基础（手机断点内） ===== */
@media (max-width: 640px) {
  body.yunjing-mobile button, body.yunjing-mobile .wx-btn, body.yunjing-mobile .cm-row,
  body.moshu-mobile button, body.moshu-mobile .wx-btn, body.moshu-mobile .cm-row,
  body.yunjing-mobile .wx-step, body.yunjing-mobile .ms-row, body.yunjing-mobile select,
  body.yunjing-mobile .ms-btn,
  body.moshu-mobile .wx-step, body.moshu-mobile .ms-row, body.moshu-mobile select,
  body.moshu-mobile .ms-btn { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
  /* 旧 DOM（历史页面/已缓存片段）仍带 moshu-* 类，样式一并匹配，不破相 */

  /* ===== ① 通讯浮层 → 全屏聊天页 ===== */
  .comm-ov { align-items: stretch; justify-content: stretch; padding: 0 !important; }
  .comm-box, .comm-ov.show .comm-box {
    width: 100vw !important; max-width: none !important;
    height: 100vh !important; height: 100dvh !important; max-height: none !important;
    border-radius: 0 !important; border-left: none !important; border-right: none !important;
    border-bottom: none !important; transform: none !important; box-shadow: none !important;
  }
  .comm-head { padding: calc(10px + env(safe-area-inset-top, 0px)) 13px 10px !important; }
  .cm-tt b { font-size: 16px !important; }
  .cm-off { font-size: 10.5px !important; padding: 2px 7px !important; }
  .comm-flow { padding: 12px 11px !important; }
  .cmsg { max-width: 92% !important; }
  .cmsg .cm-b { font-size: 14.5px !important; line-height: 1.7 !important; padding: 9px 13px !important; }
  .cm-ava { flex: 0 0 38px !important; width: 38px !important; height: 38px !important; font-size: 15px !important; }
  .cm-ava.big { flex-basis: 44px !important; width: 44px !important; height: 44px !important; font-size: 18px !important; }
  .comm-input { padding: 10px 11px calc(10px + env(safe-area-inset-bottom, 0px)) !important; gap: 8px; }
  .comm-input input { font-size: 16px !important; padding: 11px 12px !important; min-height: 44px !important; }
  .comm-input button { min-width: 66px !important; min-height: 44px !important; font-size: 14px !important; }
  .comm-carrier { padding: 0 0 calc(7px + env(safe-area-inset-bottom, 0px)) !important; }

  /* ===== 通讯录（抽屉内）触屏行 ===== */
  .cm-row { padding: 12px 11px !important; }
  .cm-mid b { font-size: 14.5px !important; }
  .cm-mid em { font-size: 12px !important; }
  .cm-temp { width: 54px !important; height: 5px !important; }
  .cm-badge { min-width: 20px !important; height: 20px !important; font-size: 11px !important; }
  .cm-note { font-size: 12px !important; }

  /* ===== ② 模块设置弹窗 → 底部抽屉 ===== */
  .ms-ov { align-items: flex-end !important; }
  .ms-box { width: 100vw !important; max-height: 88vh !important; max-height: 88dvh !important;
    border-radius: 18px 18px 0 0 !important; border-bottom: none !important;
    transform: translateY(24px) !important; }
  .ms-ov.show .ms-box { transform: translateY(0) !important; }
  .ms-hd { padding: 14px 16px !important; }
  .ms-bd { padding: 8px 16px calc(8px + env(safe-area-inset-bottom, 0px)) !important; }
  .ms-ft { padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px)) !important; }
  .ms-row { padding: 12px 0 !important; font-size: 13.5px !important; }
  .ms-row input[type="checkbox"] { width: 18px !important; height: 18px !important; }
  .ms-txt { max-width: 58% !important; font-size: 14px !important; padding: 7px 9px !important; }
  .ms-num { font-size: 14px !important; padding: 7px 9px !important; }
  .ms-ft button { padding: 12px 0 !important; font-size: 13.5px !important; }
  .ms-btn { width: 27px !important; height: 25px !important; font-size: 13px !important; }

  /* ===== ③ 界专属模块组件触屏化 ===== */
  .wx-btn { min-height: 40px !important; padding: 8px 14px !important; font-size: 12.5px !important; }
  .wx-slot { flex-wrap: wrap !important; }
  .wx-slot input, .wx-slot select { font-size: 14px !important; padding: 8px 10px !important; min-height: 40px !important; }
  .wx-stepper { flex-wrap: wrap !important; row-gap: 5px; }
  .wx-step { min-width: 52px !important; padding: 8px 6px !important; font-size: 12px !important; }
  .wx-kv { font-size: 13px !important; }
  .wx-kv span { flex: 0 0 74px !important; }
  .wx-task { padding: 9px 2px !important; font-size: 13px !important; flex-wrap: wrap !important; }
  .wx-task .st { font-size: 11px !important; }
  .wx-del { width: 30px !important; height: 30px !important; font-size: 15px !important; }
  .wx-banner { font-size: 12px !important; padding: 10px 12px !important; }
  .wx-tip { font-size: 12px !important; }
  .wx-sec-hd { flex-wrap: wrap !important; row-gap: 3px !important; }
  .wx-sec-hd b { font-size: 14px !important; }
  .wx-sec-hd > span { font-size: 11px !important; flex: 1 1 100% !important; order: 3 !important; }
  .wx-card { padding: 11px 12px !important; }
  table.wx-matrix { min-width: 0 !important; width: 100% !important; font-size: 11.5px !important; }

  /* ===== 装备格 ===== */
  .gr-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)) !important; gap: 8px !important; }
  .gr-fit { flex-wrap: wrap !important; row-gap: 6px; }
  .gr-sel { font-size: 12.5px !important; min-height: 38px !important; flex: 1 1 100% !important; }
  .gr-fit .wx-btn { flex: 1 1 auto !important; }
  .gr-on b { font-size: 13px !important; }
  .gr-slot { padding: 10px !important; }
  .gr-mgr { flex-wrap: wrap !important; }

  /* ===== 主界面常驻状态板（紧凑） ===== */
  #wxStrip { margin: 0 0 6px !important; }
  .ws-board { padding: 9px 11px !important; border-radius: 12px !important; }
  .ws-mods { gap: 8px !important; }
  .ws-gi { font-size: 13px !important; }
  .ws-gv { font-size: 12.5px !important; }
  .ws-gl { max-width: 92px !important; font-size: 10px !important; }
  .ws-more { display: none !important; }
  .ws-res b { font-size: 12px !important; }

  /* ===== 浮层期间锁定底层滚动 ===== */
  body.yunjing-lock, body.moshu-lock { overflow: hidden !important; }

  /* ===== v3.44.0 世界运行时全家桶手机适配 ===== */
  .wx-nav{flex-wrap:nowrap!important;overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;padding:8px 6px 10px!important;gap:7px!important;scrollbar-width:none!important}
  .wx-nav::-webkit-scrollbar{display:none!important}
  .wx-nav-dot{flex:0 0 auto!important;min-width:38px!important;height:34px!important;font-size:14px!important}
  .wx-sec{padding:13px 11px!important;margin-bottom:12px!important}
  .wr-status{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important}
  .wr-stat{display:flex!important;align-items:center!important;gap:6px!important;padding:8px 9px!important;background:rgba(255,255,255,.035)!important;border-radius:10px!important;flex:initial!important}
  .wr-stat>span{flex:1 1 auto!important;font-size:11px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  .wr-stat>b{font-size:14px!important;flex:0 0 auto!important}
  .wr-actions{display:grid!important;grid-template-columns:1fr!important;gap:9px!important}
  .wr-btn{min-height:44px!important;font-size:14px!important;padding:10px 14px!important}
  .wr-btn.sm{min-height:38px!important;font-size:12.5px!important}
  .wr-act .wr-btn,.wr-act .wr-btn.sm{width:100%!important;margin-top:8px!important}
  .wr-text input,.wr-select select{font-size:16px!important;min-height:42px!important}
  .wr-kv{flex-wrap:wrap!important}
  .wr-kv b{font-size:12.5px!important;word-break:break-all!important}
  .wr-log-row b{font-size:12px!important;word-break:break-all!important}
  .wr-hud-row{flex-wrap:nowrap!important;overflow-x:auto!important;scrollbar-width:none!important}
  .wr-hud-row::-webkit-scrollbar{display:none!important}
  .wr-chip{flex:0 0 auto!important;max-width:46vw!important}
  .ee-resbar{flex-wrap:nowrap!important;overflow-x:auto!important;scrollbar-width:none!important}
  .ee-tabs{flex-wrap:nowrap!important;overflow-x:auto!important;scrollbar-width:none!important}
}
`;
        document.head.appendChild(st);
    }

    /* ==================== 滚动锁（通讯/设置浮层开合） ==================== */
    function watchOverlays() {
        const apply = () => {
            const lock = !!(document.getElementById('commOv') || document.getElementById('msOv'));
            try { document.body.classList.toggle('yunjing-lock', lock && isMobile()); } catch (e) { }
        };
        try {
            new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true });
        } catch (e) { /* 老内核降级：不锁滚动也不碍事 */ }
    }

    /* ==================== 开局向导期间隐藏遮挡表单的浮层 ==================== */
    function watchSetup() {
        var wrap = document.getElementById('setupWrap');
        if (!wrap) return;
        var sync = function () {
            var on = false;
            try { on = getComputedStyle(wrap).display !== 'none'; } catch (e) { }
            document.body.classList.toggle('in-setup', on);
        };
        sync();
        try { new MutationObserver(sync).observe(wrap, { attributes: true, attributeFilter: ['style', 'class'] }); } catch (e) { }
    }

    /* ==================== 启动 ==================== */
    injectStyle();
    /* v3.36.1 修复:脚本在 head 解析期运行时 body 尚不存在,手机端 class 永远打不上
       (此前真机不生效、测试却通过,是因为测试手动改了视口尺寸触发了 resize) */
    if (document.body) { applyClass(); watchSetup(); }
    else { document.addEventListener('DOMContentLoaded', function () { applyClass(); watchSetup(); }); }
    try { window.matchMedia(MQ).addEventListener ? window.matchMedia(MQ).addEventListener('change', applyClass)
        : window.matchMedia(MQ).addListener(applyClass); } catch (e) { }
    /* v3.55.4 resize 防抖：低配机拖拽窗口时 resize 每帧触发，applyClass 含
       getComputedStyle 测量——150ms 静默后只算一次 */
    var _rsT = 0;
    window.addEventListener('resize', function () {
      clearTimeout(_rsT);
      _rsT = setTimeout(applyClass, 150);
    });
    watchOverlays();

    window.MobileFit = { version: VERSION, isMobile };
})();
