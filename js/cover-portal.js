/* 云境 · 封面世界选择器 CoverPortal v1.0.0
 * 封面「踏云/开始新游戏」弹出的分类世界选择器，替代旧大厅（无跳转、无开屏动画）。
 * 数据：window.WorldCatalog（内置 38 界）+ 玩家自建 DLC（ATLAS_VERIFIED 中 dlc:true）。
 * 预览：资料库 = AtlasLibrary.open()+openWorld()；地图 = AtlasDrill.show()；编辑 = AtlasLibrary 补充地点。
 * 零侵入：独立 overlay，只挂本 JS + cover-portal.css，并接管封面「踏云」按钮。
 */
(function () {
  "use strict";
  if (window.CoverPortal) return;

  var OVERLAY = "coverPortalOverlay";
  var DETAIL = "coverDetailOverlay";
  var currentCat = null;
  var lastFocus = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }
  function toast(msg, kind) { try { window.showToast && window.showToast(msg, kind || "info"); } catch (e) {} }
  function catGlyph(cat) { return { canon: "原", earth: "寰", free: "笔", wangyou: "游" }[cat] || "界"; }
  function catHue(cat) { return { canon: "#c9a86a", earth: "#5a9e7f", free: "#e3a9c2", wangyou: "#6fc9d8" }[cat] || "#c9a86a"; }

  // 内建目录 + 玩家 DLC 合并成一个展示用的分类结构（不修改任何源数据）
  function catalog() {
    var W = window.WorldCatalog;
    var cats = [];
    if (W && W.categories) {
      W.categories.forEach(function (c) {
        cats.push({
          key: c.key, name: c.name, desc: c.desc,
          groups: c.groups.map(function (g) {
            return { name: g.name, worlds: g.worlds.slice() };
          })
        });
      });
    }
    // 玩家自建 DLC 并入一个「自建世界」分类（或并入自由创作）
    try {
      var V = window.ATLAS_VERIFIED || {};
      var dlc = [];
      Object.keys(V).forEach(function (g) {
        var d = V[g];
        if (d && d.dlc) {
          dlc.push({
            g: g, n: d.name || g, d: d.note || "玩家自建的大世界（DLC）",
            y: d.glyph || "创", h: d.hue || "#b98fd8"
          });
        }
      });
      if (dlc.length) {
        var target = null;
        cats.forEach(function (c) { if (c.key === "free") target = c; });
        if (target) {
          target.groups.push({ name: "自建世界（DLC）", worlds: dlc });
          target.total = (target.total || 0) + dlc.length;
        } else {
          cats.push({ key: "dlc", name: "自建世界", desc: "玩家自建的大世界", groups: [{ name: "自建世界", worlds: dlc }], total: dlc.length });
        }
      }
    } catch (e) {}
    return cats;
  }

  function ensureOverlay() {
    var host = document.getElementById(OVERLAY);
    if (host) return host;
    host = document.createElement("div");
    host.id = OVERLAY;
    host.className = "cp-overlay";
    host.innerHTML =
      '<div class="cp-bg" aria-hidden="true"></div>' +
      '<div class="cp-top">' +
        '<button class="cp-back" data-act="back">‹ 返回封面</button>' +
        '<h2 class="cp-title">择一方世界</h2>' +
        '<span class="cp-sub">万象入云 · 一念一世界</span>' +
        '<span class="cp-top-spacer"></span>' +
        '<span class="cp-count" id="cpCount"></span>' +
        '<button class="cp-close" data-act="close" title="关闭">✕</button>' +
      '</div>' +
      '<div class="cp-cats" id="cpCats"></div>' +
      '<div class="cp-main" id="cpMain"></div>';
    document.body.appendChild(host);
    host.addEventListener("click", function (e) {
      var act = e.target.closest("[data-act]");
      if (act) {
        var a = act.getAttribute("data-act");
        if (a === "back" || a === "close") { close(); return; }
        if (a === "cat") { selectCat(act.getAttribute("data-cat")); return; }
        if (a === "world") { openDetail(act.getAttribute("data-genre")); return; }
      }
    });
    return host;
  }

  function open() {
    lastFocus = document.activeElement;
    var cats = catalog();
    if (!cats.length) { toast("世界目录未就绪，请刷新页面", "error"); return; }
    ensureOverlay();
    if (currentCat == null || !cats.some(function (c) { return c.key === currentCat; })) {
      currentCat = cats[0].key;
    }
    var host = document.getElementById(OVERLAY);
    host.classList.add("cp-open");
    renderCats(cats);
    selectCat(currentCat);
  }
  function close() {
    var host = document.getElementById(OVERLAY);
    if (host) host.classList.remove("cp-open");
    closeDetail();
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }

  function renderCats(cats) {
    var box = document.getElementById("cpCats");
    box.innerHTML = cats.map(function (c) {
      var total = c.groups.reduce(function (s, g) { return s + g.worlds.length; }, 0);
      return '<div class="cp-cat-tab' + (c.key === currentCat ? " cp-active" : "") + '" data-act="cat" data-cat="' + esc(c.key) + '"' +
        ' style="--cat-hue:' + catHue(c.key) + '">' +
        '<span class="cp-cg">' + catGlyph(c.key) + '</span>' +
        '<span class="cp-cn">' + esc(c.name) + '</span>' +
        '<span class="cp-cc">' + total + ' 界</span></div>';
    }).join("");
  }

  function selectCat(key) {
    var cats = catalog();
    var cat = null;
    cats.forEach(function (c) { if (c.key === key) cat = c; });
    if (!cat) return;
    currentCat = key;
    renderCats(cats);
    var total = cat.groups.reduce(function (s, g) { return s + g.worlds.length; }, 0);
    document.getElementById("cpCount").textContent = cat.name + " · " + total + " 界";
    var main = document.getElementById("cpMain");
    var html = '<p class="cp-cat-desc">' + esc(cat.desc || "") + "</p>";
    cat.groups.forEach(function (g) {
      if (!g.worlds || !g.worlds.length) return;
      if (g.name) html += '<div class="cp-group-name">' + esc(g.name) + "</div>";
      html += '<div class="cp-grid">' + g.worlds.map(function (w) {
        return '<div class="cp-card" data-act="world" data-genre="' + esc(w.g) + '" style="--card-hue:' + esc(w.h || "#c9a86a") + '">' +
          '<div class="cp-card-top">' +
            '<div class="cp-card-glyph">' + esc(w.y || "界") + "</div>" +
            '<div><div class="cp-card-name">' + esc(w.n) + "</div>" +
            (g.name ? '<div class="cp-card-group">' + esc(g.name) + "</div>" : "") + "</div>" +
          "</div>" +
          '<div class="cp-card-desc">' + esc(w.d || "暂无简介") + "</div>" +
          '<div class="cp-card-enter">预览此界 →</div>' +
          "</div>";
      }).join("") + "</div>";
    });
    main.innerHTML = html;
    main.scrollTop = 0;
  }

  /* ---------- 世界详情抽屉 ---------- */
  function worldInfo(g) {
    var meta = null;
    try { meta = window.WorldCatalog && window.WorldCatalog.get(g); } catch (e) {}
    var V = window.ATLAS_VERIFIED || {};
    var d = V[g];
    var eraCount = d && d.eras ? d.eras.length : 0;
    var placeCount = 0;
    if (d && d.eras) d.eras.forEach(function (e) { placeCount += (e.places || []).length; });
    return {
      name: (meta && meta.name) || (d && d.name) || g,
      desc: (meta && meta.desc) || (d && d.note) || "暂无简介",
      glyph: (meta && meta.glyph) || (d && d.glyph) || "界",
      hue: (meta && meta.hue) || (d && d.hue) || "#c9a86a",
      catName: (meta && meta.catName) || (d && d.dlc ? "自建世界" : "云境世界"),
      group: (meta && meta.group) || "",
      eraCount: eraCount, placeCount: placeCount
    };
  }

  function openDetail(g) {
    var info = worldInfo(g);
    var host = document.getElementById(DETAIL);
    if (!host) {
      host = document.createElement("div");
      host.id = DETAIL;
      host.className = "cp-detail";
      document.body.appendChild(host);
      host.addEventListener("click", function (e) {
        if (e.target === host || e.target.closest("[data-dclose]")) closeDetail();
        var act = e.target.closest("[data-dact]");
        if (act) detailAction(act.getAttribute("data-dact"), act.getAttribute("data-genre"));
      });
    }
    var art = "assets/map-art/" + ((window.ATLAS_VERIFIED && window.ATLAS_VERIFIED[g] && window.ATLAS_VERIFIED[g].dlc) ? "freeworld" : g) + ".webp";
    host.innerHTML =
      '<div class="cp-dlg" style="--card-hue:' + esc(info.hue) + '">' +
        '<div class="cp-dlg-head">' +
          '<div class="cp-dlg-glyph">' + esc(info.glyph) + "</div>" +
          '<div class="cp-dlg-tt"><h3 class="cp-dlg-name">' + esc(info.name) + "</h3>" +
          '<div class="cp-dlg-meta">' + esc(info.catName) + (info.group ? " · " + esc(info.group) : "") +
          " · " + info.eraCount + " 时代层 · " + info.placeCount + " 处地点</div></div>" +
          '<button class="cp-dlg-x" data-dclose title="关闭">✕</button>' +
        "</div>" +
        '<img class="cp-dlg-art" src="' + esc(art) + '" alt="" onerror="this.style.display=\'none\'">' +
        '<p class="cp-dlg-desc">' + esc(info.desc) + "</p>" +
        '<div class="cp-dlg-actions">' +
          '<button class="cp-act cp-act-primary" data-dact="enter" data-genre="' + esc(g) + '">进入世界</button>' +
          '<button class="cp-act" data-dact="library" data-genre="' + esc(g) + '">资料库 · 地点对照</button>' +
          '<button class="cp-act" data-dact="map" data-genre="' + esc(g) + '">查看地图</button>' +
          '<button class="cp-act" data-dact="edit" data-genre="' + esc(g) + '">编辑 / 补充地点</button>' +
        "</div>" +
        '<div class="cp-dlg-hint">资料库与地图可持续补充优化；玩家也可在工具箱「世界舆图·资料库」中新建大世界（DLC），它会并列出现在此选择器中。</div>' +
      "</div>";
    host.classList.add("cp-open");
  }
  function closeDetail() {
    var host = document.getElementById(DETAIL);
    if (host) host.classList.remove("cp-open");
  }

  function detailAction(act, g) {
    if (act === "enter") {
      location.href = "studio.html?genre=" + encodeURIComponent(g);
      return;
    }
    if (act === "library" || act === "edit") {
      closeDetail(); close();
      try {
        if (window.AtlasLibrary && window.AtlasLibrary.open) {
          window.AtlasLibrary.open();          // 先建 overlay（openWorld 依赖 alRoot）
          setTimeout(function () { window.AtlasLibrary.openWorld(g); }, 60);
          if (act === "edit") setTimeout(function () { window.AtlasLibrary.addPlace(g); }, 180);
        } else { toast("资料库模块未就绪，请刷新页面", "error"); }
      } catch (e) { toast("打开资料库失败：" + e.message, "error"); }
      return;
    }
    if (act === "map") {
      closeDetail(); close();
      try {
        if (window.AtlasDrill && window.AtlasDrill.show) window.AtlasDrill.show(g);
        else { location.href = "studio.html?genre=" + encodeURIComponent(g) + "&view=atlas"; }
      } catch (e) { toast("打开地图失败：" + e.message, "error"); }
      return;
    }
  }

  /* v6.6.1 封面瘦身：atlas 数据层(1.16MB 脚本 + 4 份地图 CSS)只在玩家点「踏云」打开世界选择器时
     才按需加载，封面首屏不再解析这些重型资源。实测封面进程内存因此从净增约 112MB 下降。
     依赖：catalog()/openDetail() 读 window.ATLAS_VERIFIED 合并玩家 DLC，必须在打开前加载完。 */
  var ATLAS_JS = [
    "js/atlas-drill-data.js", "js/atlas-drilldown.js", "js/atlas-verified-all.js",
    "js/atlas-userdata.js", "js/atlas-verified-adapter.js", "js/atlas-library.js"
  ];
  var ATLAS_CSS = [
    "css/atlas-drilldown.css", "css/atlas-faction-layer.css",
    "css/atlas-canon-layer.css", "css/atlas-library.css"
  ];
  var V = "?v=7.0.0";
  var atlasPromise = null;
  function ensureAtlas() {
    if (atlasPromise) return atlasPromise;
    atlasPromise = new Promise(function (resolve) {
      try {
        var done = 0, total = ATLAS_JS.length + ATLAS_CSS.length;
        function tick() { if (++done >= total) resolve(); }
        ATLAS_CSS.forEach(function (href) {
          if (document.querySelector('link[data-atlas-lazy="' + href + '"]')) { tick(); return; }
          var l = document.createElement("link");
          l.rel = "stylesheet"; l.href = href + V; l.setAttribute("data-atlas-lazy", href);
          l.onload = tick; l.onerror = tick; document.head.appendChild(l);
        });
        ATLAS_JS.forEach(function (src) {
          if (document.querySelector('script[data-atlas-lazy="' + src + '"]')) { tick(); return; }
          var s = document.createElement("script");
          s.src = src + V; s.setAttribute("data-atlas-lazy", src);
          s.onload = tick; s.onerror = tick; document.body.appendChild(s);
        });
      } catch (e) { resolve(); }
      // 兜底：3.5 秒后无论如何放行，绝不把玩家卡在选择器外
      setTimeout(resolve, 3500);
    });
    return atlasPromise;
  }
  function openWithAtlas() { ensureAtlas().then(function () { open(); }); }

  // 接管封面「踏云」按钮（data-go="new"），其余三入口保持原样
  function wireCover() {
    var menu = document.getElementById("menu");
    if (!menu) return;
    menu.addEventListener("click", function (e) {
      var btn = e.target.closest('.entry[data-go="new"]');
      if (!btn) return;
      e.preventDefault(); e.stopPropagation();
      openWithAtlas();
    }, true); // 捕获阶段，先于封面原有跳转监听
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" || !document.getElementById(OVERLAY)) return;
      var active = document.querySelector("#menu .entry[data-active='1']");
      if (active && active.getAttribute("data-go") === "new" &&
          !document.getElementById(OVERLAY).classList.contains("cp-open")) {
        e.preventDefault(); e.stopPropagation(); openWithAtlas();
      }
    }, true);
  }

  function boot() {
    wireCover();
    // 首启引导由 first-run-guide.js 自动处理（首启一次、可跳过、localStorage 记忆）。
    // 封面页加载该脚本即可，本模块不重复触发，避免双重弹窗。
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.CoverPortal = { open: openWithAtlas, close: close, version: "1.0.1" };
})();
