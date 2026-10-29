/**
 * 启动错误哨兵（v3.38.1 · 安卓兼容版）
 * ─────────────────────────────────────
 * 背景：部分安卓机 WebView 内核老旧（Chrome<80），遇到 `?.`/`??` 等新语法
 * 会整脚本解析失败，表现为「页面能显示但点了没反应」。本版已全量转译为
 * 老语法；此哨兵为长期保险——任何脚本加载失败/运行异常都在屏幕上显示
 * 出错文件与原因，玩家可截图反馈，不再无声失灵。
 * 注意：本文件必须保持 ES5 写法（无箭头函数/模板串/可选链），确保任何
 * 内核都能解析它自身。
 */
(function () {
    'use strict';
    var seen = 0;
    function report(tag, msg) {
        try {
            console.error('[云境·异常哨兵]', tag, msg);
            if (++seen > 3) return;   /* 限流：最多弹 3 条，避免错误风暴糊屏 */
            var host = document.body || document.documentElement;
            if (!host) { document.addEventListener('DOMContentLoaded', function () { report(tag, msg); }); return; }
            var d = document.createElement('div');
            d.style.cssText = 'position:fixed;left:12px;right:12px;bottom:96px;z-index:2147483647;'
                + 'background:rgba(96,28,28,0.96);color:#ffe8e8;padding:10px 13px;border-radius:10px;'
                + 'font-size:12px;line-height:1.55;box-shadow:0 4px 18px rgba(0,0,0,.5);'
                + 'border:1px solid rgba(255,180,180,.25);word-break:break-all;';
            d.textContent = '\u26A0 ' + tag + '\uFF1A' + msg + '\uFF08\u8BF7\u622A\u56FE\u53CD\u9988\u7ED9\u5F00\u53D1\u8005\uFF09';
            d.onclick = function () { if (d.parentNode) d.parentNode.removeChild(d); };
            host.appendChild(d);
            setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 10000);
        } catch (e) { /* 哨兵自身永不抛错 */ }
    }
    /* 捕获阶段监听：同时抓到 <script> 加载失败（旧内核解析失败也走这里） */
    window.addEventListener('error', function (e) {
        var t = e.target && e.target.tagName;
        if (t === 'SCRIPT') {
            var src = String(e.target.src || '').split('/').pop() || '(内联)';
            report('\u811A\u672C\u52A0\u8F7D\u5931\u8D25\uFF08\u53EF\u80FD\u662F\u6D4F\u89C8\u5668\u5185\u6838\u8FC7\u65E7\uFF09', src);
            return;
        }
        if (t === 'LINK') {
            report('\u6837\u5F0F\u52A0\u8F7D\u5931\u8D25', String(e.target.href || '').split('/').pop());
            return;
        }
        var m = String(e.message || '\u672A\u77E5\u9519\u8BEF');
        if (e.filename) m += ' @' + String(e.filename).split('/').pop() + ':' + (e.lineno || 0);
        report('\u811A\u672C\u8FD0\u884C\u9519\u8BEF', m);
    }, true);
    window.addEventListener('unhandledrejection', function (e) {
        var r = e.reason;
        report('\u5F02\u6B65\u5F02\u5E38', (r && r.message) ? String(r.message) : String(r));
    });
})();
