/* 云境 v5.3.0 · 五线深度舆图 · 独立下钻模块（AtlasDrill）
 * 设计：零侵入——不改 atlas-panel.js，包装 StoryAtlas.open 注入「深度舆图」入口。
 * 视图：独立全屏 overlay；时代大图 → 逐级点击下钻到 4 层；面包屑返回。
 * 底图：assets/map-art/{art}.webp，缺图 onerror 回退到程序化矢量地形。
 * 回滚：删本文件 + atlas-drill-data.js + atlas-drilldown.css + 页面 3 行引用即恢复。
 */
(function () {
  "use strict";
  if (window.AtlasDrill) return;

  var DATA = window.ATLAS_DRILL;
  var LEVEL_NAMES = ["时代大图", "区域", "地点", "子区域", "场景"];
  var state = { eraIdx: 0, path: [], genre: null }; // path: 从 level1 起的节点数组；path.length = 当前层级深度

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }
  function pal() {
    // 沿用舆图配色，取当前界主色；兜底金
    try {
      var g = (window.storyFramework && window.storyFramework.config && window.storyFramework.config.genreKey) || new URLSearchParams(location.search).get("genre");
      var cs = getComputedStyle(document.documentElement);
      return {
        primary: (cs.getPropertyValue("--yj-primary") || "").trim() || "#d9b46a",
        accent: (cs.getPropertyValue("--yj-accent") || "").trim() || "#9fd8c0"
      };
    } catch (e) { return { primary: "#d9b46a", accent: "#9fd8c0" }; }
  }

  // 当前节点：path 为空=时代大图(level0)；否则 path[last] 是 level N 节点
  function currentNode() { return state.path.length ? state.path[state.path.length - 1] : null; }
  function currentLevel() { return state.path.length; }
  function currentArt() {
    // 底图严格由路径深度决定，杜绝节点手填字段跳级：
    // path0=时代大图(无后缀) / path1..4 = __L1..L4
    var era = DATA.eras[state.eraIdx];
    if (!state.path.length) return era.art;
    return era.art + "__L" + state.path.length;
  }
  function currentChildren() {
    var n = currentNode();
    return n ? n.children : DATA.eras[state.eraIdx].children;
  }

  // 生成一层里地标的落点与徽记（美术化，不用 pill+细线）
  function nodeMarkup(n, idx, total) {
    var t = n.t || "city";
    var glyph = GLYPH[t] || GLYPH.city;
    var hasKids = n.children && n.children.length;
    // 有子节点→「▸进入下一级」；叶子→「◎场景特写」（点击进入最深层 L4）
    var hint = hasKids ? "▸" : "◎";
    var tip = hasKids ? " · 点击进入下一级" : " · 查看场景特写";
    return '<div class="ad-mark ad-t-' + esc(t) + ' ad-drillable" ' +
      'style="left:' + n.x + '%;top:' + n.y + '%" data-idx="' + idx + '" title="' + esc(n.n) + tip + '">' +
        '<span class="ad-glyph">' + glyph + "</span>" +
        '<span class="ad-name">' + esc(n.n) + "</span>" +
        '<span class="ad-drill-hint">' + hint + "</span>" +
      "</div>";
  }

  // 装饰性 SVG 徽记（内联 path，美术化、无文字）
  var GLYPH = {
    city: '⌂', sect: '⌘', arena: '⚔', relic: '✧', danger: '⚠', wild: '♣', forest: '♠', water: '≈', desert: '◆'
  };

  // 程序化矢量地形（底图缺图时的回退），按层级主题给不同纹理
  function fallbackTerrain(level, era) {
    var hue = ["#2a3a4a", "#2c4038", "#3a3448", "#1c2b44", "#3a3a2c"][state.eraIdx % 5];
    var rings = "";
    for (var i = 0; i < 6; i++) {
      rings += '<circle cx="50" cy="50" r="' + (12 + i * 7) + '" fill="none" stroke="rgba(217,180,106,' + (0.16 - i * 0.02) + ')" stroke-width="0.3"/>';
    }
    return '<div class="ad-fallback" style="background:radial-gradient(circle at 50% 42%,' + hue + ',#0a1016 78%)">' +
      '<svg viewBox="0 0 100 100" preserveAspectRatio="none">' + rings + "</svg></div>";
  }

  function render() {
    if (!DATA) return;
    var host = document.getElementById("atlasDrillOverlay");
    if (!host) { host = buildHost(); }
    var era = DATA.eras[state.eraIdx];
    var art = currentArt();
    var level = currentLevel();
    var P = pal();
    host.style.setProperty("--ad-primary", P.primary);
    host.style.setProperty("--ad-accent", P.accent);

    var children = currentChildren();
    var marks = children.map(function (n, i) { return nodeMarkup(n, i, children.length); }).join("");

    // 面包屑
    var crumb = ['<button class="ad-crumb" data-crumb="-1">' + esc(era.name) + '</button>'];
    state.path.forEach(function (n, i) {
      crumb.push('<span class="ad-crumb-sep">›</span><button class="ad-crumb" data-crumb="' + i + '">' + esc(n.n) + "</button>");
    });

    // 时代切换 tab
    var tabs = DATA.eras.map(function (e, i) {
      return '<button class="ad-era-tab' + (i === state.eraIdx ? " on" : "") + '" data-era="' + i + '"><i>' + esc(e.ico) + "</i>" + esc(e.name) + "</button>";
    }).join("");

    var node = currentNode();
    var detail = node
      ? '<div class="ad-detail"><div class="ad-detail-h">' + esc(node.n) + ' <span class="ad-detail-lv">' + LEVEL_NAMES[level] + "</span></div>" +
        '<div class="ad-detail-desc">' + esc(node.desc || "") + "</div>" +
        (node.c ? '<div class="ad-detail-c">📖 ' + esc(node.c) + "</div>" : "") +
        (node.children && node.children.length ? '<div class="ad-detail-next">可继续下钻 ' + node.children.length + " 处 ▾</div>" : '<div class="ad-detail-next ad-leaf">已至最深层</div>') +
        "</div>"
      : '<div class="ad-detail ad-detail-top"><div class="ad-detail-h">' + esc(era.name) + ' <span class="ad-detail-lv">时代大图</span></div>' +
        '<div class="ad-detail-desc">' + esc(era.hint || "") + "</div>" +
        '<div class="ad-region-list"><div class="ad-region-t">本时代 · 区域一览</div>' +
          era.children.map(function (r, i) {
            return '<button class="ad-region-item" data-region="' + i + '"><i>' + (GLYPH[r.t] || "◈") + "</i>" +
              "<span>" + esc(r.n) + "</span><em>" + ((r.children || []).length) + " 处 ▸</em></button>";
          }).join("") +
        "</div>" +
        '<div class="ad-detail-next">点击图上地标逐层下钻 · 共 ' + LEVEL_NAMES.length + " 级 ▾</div></div>";

    host.querySelector(".ad-body").innerHTML =
      '<div class="ad-topbar">' +
        '<div class="ad-title"><span class="ad-title-ico">✦</span> 五线深度舆图 · <b>' + esc(DATA.name) + "</b></div>" +
        '<div class="ad-top-actions"><button class="ad-btn ad-back"' + (level === 0 ? " disabled" : "") + '>‹ 返回上一级</button>' +
        '<button class="ad-btn ad-close" title="关闭">✕</button></div>' +
      "</div>" +
      '<div class="ad-era-tabs">' + tabs + "</div>" +
      '<div class="ad-crumbs">' + crumb.join("") + '<span class="ad-lvbadge">' + LEVEL_NAMES[level] + " · " + (level + 1) + "/" + LEVEL_NAMES.length + "</span></div>" +
      '<div class="ad-stage">' +
        '<div class="ad-map" data-art="' + esc(art) + '">' +
          fallbackTerrain(level, era) +
          '<img class="ad-art" src="assets/map-art/' + esc(art) + '.webp" alt="" onerror="this.style.display=\'none\'">' +
          '<div class="ad-ornament ad-orn-tl"></div><div class="ad-ornament ad-orn-tr"></div>' +
          '<div class="ad-ornament ad-orn-bl"></div><div class="ad-ornament ad-orn-br"></div>' +
          '<div class="ad-marks">' + marks + "</div>" +
          '<div class="ad-map-label">' + esc(era.name) + (node ? " · " + esc(node.n) : "") + "</div>" +
        "</div>" +
        detail +
      "</div>" +
      '<div class="ad-legend">' +
        '<span><i class="ad-lg ad-lg-city"></i>城域</span><span><i class="ad-lg ad-lg-sect"></i>宗门学府</span>' +
        '<span><i class="ad-lg ad-lg-relic"></i>秘境传承</span><span><i class="ad-lg ad-lg-danger"></i>险地</span>' +
        '<span class="ad-legend-hint">▸ 标记可点击下钻</span>' +
      "</div>";

    bindBody();
    host.style.display = "flex";
  }

  function bindBody() {
    var body = document.querySelector("#atlasDrillOverlay .ad-body");
    if (!body) return;
    body.querySelectorAll(".ad-mark").forEach(function (m) {
      m.addEventListener("click", function () {
        var n = currentChildren()[Number(m.getAttribute("data-idx"))];
        if (!n) return;
        // 避免超过最深层：path 已达 4（场景层）不再下钻
        if (state.path.length >= 4) return;
        state.path.push(n);
        render();
      });
    });
    body.querySelectorAll(".ad-region-item").forEach(function (b) {
      b.addEventListener("click", function () {
        var r = DATA.eras[state.eraIdx].children[Number(b.getAttribute("data-region"))];
        if (r) { state.path = [r]; render(); }
      });
    });
    body.querySelectorAll(".ad-era-tab").forEach(function (b) {
      b.addEventListener("click", function () {
        state.eraIdx = Number(b.getAttribute("data-era")); state.path = []; render();
      });
    });
    body.querySelectorAll(".ad-crumb").forEach(function (b) {
      b.addEventListener("click", function () {
        var k = Number(b.getAttribute("data-crumb"));
        state.path = k < 0 ? [] : state.path.slice(0, k + 1); render();
      });
    });
    var back = body.querySelector(".ad-back");
    if (back) back.addEventListener("click", function () { if (state.path.length) { state.path.pop(); render(); } });
    var close = body.querySelector(".ad-close");
    if (close) close.addEventListener("click", hide);
  }

  function buildHost() {
    var host = document.createElement("div");
    host.id = "atlasDrillOverlay";
    host.className = "ad-overlay";
    host.innerHTML = '<div class="ad-body"></div>';
    host.addEventListener("click", function (e) { if (e.target === host) hide(); });
    document.body.appendChild(host);
    return host;
  }

  function show(genre) {
    state.genre = genre || null;
    // v6.2：按 genre 把校对数据转成当前世界的舆图树（斗罗走原生精细树）；
    // 适配层会更新 window.ATLAS_DRILL.eras，故 DATA 需重新取值。
    try {
      if (window.AtlasVerifiedAdapter && window.AtlasVerifiedAdapter.ensure) {
        window.AtlasVerifiedAdapter.ensure(genre);
        DATA = window.ATLAS_DRILL; // 重新绑定（ensure 可能替换 eras）
      }
    } catch (err) {}
    state.eraIdx = 0;
    state.path = [];
    render();
  }
  function hide() {
    var host = document.getElementById("atlasDrillOverlay");
    if (host) host.style.display = "none";
  }

  // 入口注入：在舆图面板顶部加一个「深度舆图」按钮；用 MutationObserver 观察面板出现
  function injectEntry() {
    var panel = document.getElementById("atlasPanel");
    if (!panel || panel.querySelector(".ad-entry-btn")) return false;
    var btn = document.createElement("button");
    btn.className = "ad-entry-btn";
    btn.innerHTML = "✦ 五线深度舆图";
    btn.title = "进入壁纸级五级下钻舆图";
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var g = null;
      try { g = (window.storyFramework && window.storyFramework.config && window.storyFramework.config.genreKey) || new URLSearchParams(location.search).get("genre"); } catch (err) {}
      show(g);
    });
    panel.insertBefore(btn, panel.firstChild);
    return true;
  }

  function boot() {
    // 入口留不住的根因：StoryAtlas.render() 每次 innerHTML 重写面板，会冲掉注入的按钮。
    // 方案：包装 toggle，面板打开后多次补注入（覆盖 render 的异步重写）。
    function tryHook() {
      var SA = window.StoryAtlas;
      if (!SA || SA.__drillHooked) return false;
      SA.__drillHooked = true;
      if (typeof SA.toggle === "function") {
        var orig = SA.toggle;
        SA.toggle = function () {
          var ret = orig.apply(this, arguments);
          var open = arguments[0] !== false;
          if (open) {
            injectEntry();
            setTimeout(injectEntry, 120);
            setTimeout(injectEntry, 400);
          }
          return ret;
        };
      }
      return true;
    }
    var tries = 0;
    var obs = setInterval(function () {
      tries++;
      tryHook();
      injectEntry(); // 兜底：面板已在 DOM 时直接注入
      if (tries > 100) clearInterval(obs); // 10 秒观察窗，覆盖懒加载
    }, 100);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.AtlasDrill = { show: show, hide: hide, render: render, DATA: DATA, version: "5.3.0" };
})();
