/**
 * Android WebView 专用桥（v3.27.0）
 * 仅在检测到原生 AndroidBridge 时激活，浏览器环境零副作用。
 * 职责：
 *   1. 拦截 <a download> 的 blob 下载 → 转 base64 交原生落盘到「下载」目录
 *      （浏览器里 anchor 下载原生可用；WebView 里必须走此桥）
 *   2. window.open 替身 → http(s) 链接交系统浏览器打开
 */
(function () {
    'use strict';
    if (!window.AndroidBridge) return;

    /* ── ① blob 下载拦截（捕获阶段，抢在默认导航之前） ── */
    document.addEventListener('click', function (e) {
        try {
            var t = e.target;
            var a = (t && t.closest) ? t.closest('a[download]') : null;
            if (!a) return;
            var href = a.href || '';
            if (href.indexOf('blob:') !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            var name = a.getAttribute('download') || ('yunjing-' + Date.now() + '.bin');
            fetch(href).then(function (r) { return r.blob(); }).then(function (blob) {
                return new Promise(function (res, rej) {
                    var fr = new FileReader();
                    fr.onload = function () { res(fr.result); };
                    fr.onerror = rej;
                    fr.readAsDataURL(blob);
                });
            }).then(function (dataUrl) {
                var m = dataUrl.match(/^data:([^;]+)/);
                var mime = m ? m[1] : 'application/octet-stream';
                var b64 = dataUrl.split(',')[1] || '';
                window.AndroidBridge.saveFile(name, mime, b64);
            }).catch(function () { });
        } catch (ignored) { }
    }, true);

    /* ── ② window.open 替身：外链交系统浏览器 ── */
    try {
        var rawOpen = window.open.bind(window);
        window.open = function (url) {
            if (url && (/^https?:\/\//.test(url))) {
                window.AndroidBridge.openUrl(url);
                return null;
            }
            return rawOpen.apply(null, arguments);
        };
    } catch (ignored) { }

    /* 标记：控制台与设置页可识别运行环境 */
    window.__MOSHU_ANDROID__ = true;
})();
