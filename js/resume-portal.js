/* 云境 · 续梦读档浮层 ResumePortal v1.0.0（v6.3.3）
 * 封面「续梦」入口：跨世界扫描 localStorage 中真实存在的存档，玩家选一档 →
 * 写入 storyActiveSlot_<genre> 并跳 studio.html?genre=X（storyFramework.init→loadSave 自动载入）。
 * 零侵入：独立 overlay + 独立 CSS，捕获阶段接管封面 data-go="continue" 按钮与 Enter 键。
 */
(function () {
  "use strict";
  if (window.ResumePortal) return;

  var OVERLAY = "resumePortalOverlay";
  var lastFocus = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }
  function meta(g) {
    try { return (window.WorldCatalog && window.WorldCatalog.get(g)) || null; } catch (e) { return null; }
  }

  /* 扫描所有世界的所有档位。返回 [{genre, worldName, glyph, hue, slot, name, title, chapter, wordCount, updatedAt}]
     判据：注册表 storySlots_<g> 中每个 slot，正文键 storySave_<g>[~slot] 真实存在才算有档。 */
  function scan() {
    var out = [];
    var LS = window.localStorage;
    if (!LS) return out;
    var prefix = "storySlots_";
    var genres = [];
    try {
      for (var i = 0; i < LS.length; i++) {
        var k = LS.key(i);
        if (k && k.indexOf(prefix) === 0) genres.push(k.slice(prefix.length));
      }
    } catch (e) { return out; }

    genres.forEach(function (g) {
      if (!g) return;
      var rows = [];
      try { rows = JSON.parse(LS.getItem(prefix + g) || "[]"); } catch (e) { rows = []; }
      if (!Array.isArray(rows)) rows = [];

      rows.forEach(function (r) {
        if (!r || !r.id) return;
        var suffix = r.id === "main" ? "" : "~" + r.id;
        var body = LS.getItem("storySave_" + g + suffix) || LS.getItem("storySave_" + g + suffix + ".bak");
        if (!body) return; // 无正文 = 空档，不作为可读项（假设 A3）
        var m = meta(g) || {};
        var title = r.title || "";
        if (!title) {
          try {
            var pkg = JSON.parse(body);
            title = (pkg.save && pkg.save.title) || (pkg.title) || "";
          } catch(e){console.warn("[swallowed] resume-portal",e)}
        }
        out.push({
          genre: g,
          worldName: m.name || g,
          glyph: m.glyph || "界",
          hue: m.hue || "#c9a86a",
          slot: r.id,
          slotName: r.name || (r.id === "main" ? "主档" : r.id),
          title: title || "未命名书稿",
          chapter: r.chapter || 0,
          wordCount: r.wordCount || 0,
          updatedAt: r.updatedAt || 0
        });
      });
    });
    out.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    return out;
  }

  function ensureOverlay() {
    var host = document.getElementById(OVERLAY);
    if (host) return host;
    host = document.createElement("div");
    host.id = OVERLAY;
    host.className = "rp-overlay";
    host.innerHTML =
      '<div class="rp-bg" aria-hidden="true"></div>' +
      '<div class="rp-top">' +
        '<button class="rp-back" data-act="back">‹ 返回封面</button>' +
        '<h2 class="rp-title">续梦</h2>' +
        '<span class="rp-sub">再续前尘 · 从存档处接着写</span>' +
        '<span class="rp-spacer"></span>' +
        '<button class="rp-close" data-act="close" title="关闭">✕</button>' +
      '</div>' +
      '<div class="rp-main" id="rpMain"></div>';
    document.body.appendChild(host);
    host.addEventListener("click", function (e) {
      var act = e.target.closest("[data-act]");
      if (!act) return;
      var a = act.getAttribute("data-act");
      if (a === "back" || a === "close") { close(); return; }
      if (a === "load") { load(act.getAttribute("data-genre"), act.getAttribute("data-slot")); return; }
      if (a === "new") { close(); try { window.CoverPortal && window.CoverPortal.open(); } catch(e){console.warn("[swallowed] resume-portal",e)} return; }
    });
    return host;
  }

  function render() {
    var host = ensureOverlay();
    var list = scan();
    var main = document.getElementById("rpMain");
    if (!list.length) {
      main.innerHTML =
        '<div class="rp-empty">' +
          '<div class="rp-empty-mark">◌</div>' +
          '<h3>尚无存档可续</h3>' +
          '<p>你在各个世界里写下的故事会留在这台设备上。现在还没有可读取的存档——先去踏云，选一个世界开新篇吧。</p>' +
          '<button class="rp-cta" data-act="new">去踏云 · 开新篇 →</button>' +
        '</div>';
      return;
    }
    var html = '<p class="rp-lead">共 ' + list.length + ' 份存档 · 点「进入」从该处接着写（进度只保存在这台设备）</p><div class="rp-list">';
    list.forEach(function (s) {
      var when = s.updatedAt ? new Date(s.updatedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
      html +=
        '<div class="rp-card" style="--rp-hue:' + esc(s.hue) + '">' +
          '<div class="rp-glyph">' + esc(s.glyph) + "</div>" +
          '<div class="rp-info">' +
            '<div class="rp-world">' + esc(s.worldName) + ' <span class="rp-slot">· ' + esc(s.slotName) + "</span></div>" +
            '<div class="rp-book">' + esc(s.title) + "</div>" +
            '<div class="rp-meta">第 ' + (s.chapter || 0) + " 章 · " + (s.wordCount || 0).toLocaleString() + " 字 · " + when + "</div>" +
          "</div>" +
          '<button class="rp-enter" data-act="load" data-genre="' + esc(s.genre) + '" data-slot="' + esc(s.slot) + '">进入 →</button>' +
        "</div>";
    });
    html += "</div>";
    main.innerHTML = html;
    main.scrollTop = 0;
  }

  function open() {
    lastFocus = document.activeElement;
    render();
    document.getElementById(OVERLAY).classList.add("rp-open");
  }
  function close() {
    var host = document.getElementById(OVERLAY);
    if (host) host.classList.remove("rp-open");
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch(e){console.warn("[swallowed] resume-portal",e)} }
  }

  function load(genre, slot) {
    if (!genre) return;
    try {
      // 与 SaveSlots.switchTo 同机制：先设当前档，storyFramework.init()→loadSave() 会据此载入
      window.localStorage.setItem("storyActiveSlot_" + genre, slot || "main");
    } catch(e){console.warn("[swallowed] resume-portal",e)}
    location.href = "studio.html?genre=" + encodeURIComponent(genre);
  }

  // 捕获阶段接管封面「续梦」按钮（data-go="continue"），先于封面原有跳转监听
  function wireCover() {
    var menu = document.getElementById("menu");
    if (!menu) return;
    menu.addEventListener("click", function (e) {
      var btn = e.target.closest('.entry[data-go="continue"]');
      if (!btn) return;
      e.preventDefault(); e.stopPropagation();
      open();
    }, true);
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      var active = document.querySelector('#menu .entry[data-active="1"]');
      if (!active || active.getAttribute("data-go") !== "continue") return;
      e.preventDefault(); e.stopPropagation(); open();
    }, true);
  }

  function boot() { wireCover(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.ResumePortal = { open: open, close: close, scan: scan, version: "1.0.0" };
})();
