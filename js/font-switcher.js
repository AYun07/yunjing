/* ============================================================
   云境 · 字体切换（FontSwitcher）  v6.8.0
   ------------------------------------------------------------
   玩家反馈「字体也要可以换」。纯前端：切换 CSS 字体栈，不下载字体文件，
   零流量、离线可用。覆盖 Windows / macOS / 安卓 / Linux 常见中文字体。
   即时生效 + localStorage 持久化；不覆盖字号倍率（--font-scale 独立）。
   ============================================================ */
(function (G) {
  "use strict";

  var LS_KEY = "yunjingFontFamily";
  var STYLE_ID = "yj-font-override";

  /* 每项是一套完整的正文字体栈（含西文回退），第一项为中文主力。 */
  var FONTS = [
    { id: "serif", name: "宋体 · 书卷", desc: "默认衬线，最像纸质小说",
      stack: "'Noto Serif SC','Source Han Serif SC','Songti SC','STSong','SimSun','Noto Serif CJK SC',serif" },
    { id: "sans", name: "黑体 · 清爽", desc: "无衬线，屏幕最清晰",
      stack: "'PingFang SC','Microsoft YaHei','Noto Sans CJK SC','Source Han Sans SC','Heiti SC',sans-serif" },
    { id: "kai", name: "楷体 · 手写", desc: "楷体，温润有笔意",
      stack: "'Kaiti SC','STKaiti','KaiTi','楷体','Noto Serif CJK SC',serif" },
    { id: "fangsong", name: "仿宋 · 公文", desc: "仿宋，端正清瘦",
      stack: "'FangSong','STFangsong','仿宋','Noto Serif CJK SC',serif" },
    { id: "round", name: "圆体 · 柔和", desc: "圆体，柔和易读（有则生效）",
      stack: "'Yuanti SC','STYuanti','幼圆','YouYuan','PingFang SC','Microsoft YaHei',sans-serif" },
    { id: "mono", name: "等宽 · 整齐", desc: "等宽，字字对齐",
      stack: "'Noto Sans Mono CJK SC','Sarasa Mono SC','Courier New','Consolas',monospace" }
  ];

  function currentId() {
    try { return localStorage.getItem(LS_KEY) || "serif"; } catch (e) { return "serif"; }
  }
  function find(id) {
    return FONTS.filter(function (f) { return f.id === id; })[0] || FONTS[0];
  }

  function apply() {
    var f = find(currentId());
    var style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    /* 用 body/正文/输入框一起覆盖，!important 保证压过主题工坊与世界皮肤；
       但不动 --font-scale，字号倍率仍由 StoryInput 独立控制。 */
    style.textContent =
      "body, .story-body, #chatMessages, .message-card .story-body, " +
      "#userInput, .wiz-input, textarea, input {" +
      "font-family:" + f.stack + " !important;}";
    /* 主题工坊注入的变量也同步，避免它下次 apply 时把 body 字体改回去 */
    try {
      document.documentElement.style.setProperty("--yj-font-body", f.stack);
    } catch(e){console.warn("[swallowed] font-switcher",e)}
  }

  function panelHTML() {
    var cur = currentId();
    var rows = FONTS.map(function (f) {
      var on = f.id === cur;
      return '<button class="fs-opt' + (on ? " active" : "") + '" data-font="' + f.id + '">' +
        '<span class="fs-name" style="font-family:' + f.stack + '">' + f.name + '</span>' +
        '<span class="fs-desc">' + f.desc + '</span>' +
        (on ? '<span class="fs-check">✓</span>' : '') +
        '</button>';
    }).join("");
    return '<div class="fs-mask" id="fsMask"></div>' +
      '<div class="fs-panel" id="fsPanel" role="dialog" aria-label="字体设置">' +
        '<div class="fs-head"><span>🔤 字体设置</span><button class="fs-close" id="fsClose" title="关闭">✕</button></div>' +
        '<div class="fs-hint">点一下即时生效，自动保存。只换字体，不影响字号（字号在工具箱里调）。</div>' +
        '<div class="fs-list">' + rows + '</div>' +
      '</div>';
  }

  function open() {
    if (document.getElementById("fsPanel")) { close(); return; }
    var wrap = document.createElement("div");
    wrap.id = "fsWrap";
    wrap.innerHTML = panelHTML();
    document.body.appendChild(wrap);
    // v7.0.1：面板节点可能在其它逻辑里被重建，裸绑定抛 null → 全局哨兵弹「脚本运行错误」
    var _mask = document.getElementById("fsMask"), _close = document.getElementById("fsClose");
    if (_mask) _mask.addEventListener("click", close);
    if (_close) _close.addEventListener("click", close);
    wrap.querySelectorAll(".fs-opt").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-font");
        try { localStorage.setItem(LS_KEY, id); } catch(e){console.warn("[swallowed] font-switcher",e)}
        apply();
        close();
        try { window.showToast && window.showToast("字体已切换为「" + find(id).name + "」", "success"); } catch(e){console.warn("[swallowed] font-switcher",e)}
      });
    });
  }
  function close() {
    var w = document.getElementById("fsWrap");
    if (w) w.remove();
  }

  G.FontSwitcher = {
    version: "6.8.0",
    fonts: function () { return FONTS.map(function (f) { return { id: f.id, name: f.name }; }); },
    current: currentId,
    set: function (id) { try { localStorage.setItem(LS_KEY, id); } catch(e){console.warn("[swallowed] font-switcher",e)} apply(); },
    apply: apply,
    open: open,
    close: close
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
  else apply();
})(window);
