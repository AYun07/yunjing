/* 云境 v5.7.0 · 原著地点上图（AtlasCanonLayer）· 五类方位版
 * 零侵入：不改 atlas-panel.js / atlas-drilldown.js / atlas-faction-layer.js 静态逻辑。
 * v5.7（DR-025）：原著实体按「势力/国家/宗门/地点/地区」五类归位——
 *   L0 时代大图按类别分组标注全部实体，每类独立徽记/配色；新增类别图例与点击筛选；
 *   详情卡标注「类别 + 方位依据（原著出处）」；下钻到子层仍按 lv 显示（默认实体归 L0）。
 * 数据源：js/atlas-canon-places.js（零依赖，不读懒加载的 ATLAS_ERAS，规避时序风险）。
 * 可回滚：删本文件 + atlas-canon-layer.css + atlas-canon-places.js + 页面引用即恢复。
 */
(function () {
  "use strict";
  var OVERLAY = "#atlasDrillOverlay";
  var LEVEL_NAMES = ["时代大图", "区域", "地点", "子区域", "场景"];
  // 五类定义：key 对应数据 cat，order 决定图例顺序
  var CATS = [
    { key: "country", label: "国家", glyph: "▣", color: "#e6b870" },
    { key: "faction", label: "势力", glyph: "⚔", color: "#e8a0a0" },
    { key: "sect",    label: "宗门", glyph: "⚑", color: "#9fd8c0" },
    { key: "region",  label: "地区", glyph: "❋", color: "#a9d08a" },
    { key: "place",   label: "地点", glyph: "✦", color: "#d8cba0" }
  ];
  var CAT_MAP = {};
  CATS.forEach(function (c) { CAT_MAP[c.key] = c; });
  var state = { dense: false, eraId: "", level: 0, filter: "" }; // filter="" 全部 / 类别 key

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function norm(s) {
    return String(s == null ? "" : s)
      .replace(/[《》「」『』\s·\-—（）()\[\]【】,，。.、:：;；'"]/g, "")
      .toLowerCase();
  }
  function catOf(p) { return CAT_MAP[p && p.cat] ? p.cat : "place"; }
  function catInfo(p) { return CAT_MAP[catOf(p)]; }
  function placeLv(p) { var lv = p && p.lv; return (lv == null || isNaN(Number(lv))) ? 0 : Math.max(0, Math.min(4, Number(lv))); }

  // 从当前 DOM 反推视图：当前层级 + 时代 id（注入层不访问内部闭包 state）
  function currentView() {
    var root = document.querySelector(OVERLAY);
    if (!root || root.style.display === "none") return null;
    var badge = root.querySelector(".ad-lvbadge");
    var text = badge ? String(badge.textContent) : "";
    var m = text.match(/(\d+)\s*\/\s*\d+/);
    var level = m ? Math.max(0, Math.min(4, Number(m[1]) - 1)) : 0;
    var tabs = root.querySelectorAll(".ad-era-tab");
    var onIdx = -1;
    for (var i = 0; i < tabs.length; i++) if (tabs[i].classList.contains("on")) { onIdx = i; break; }
    var eraId = onIdx >= 0 ? "dou" + (onIdx + 1) : "";
    return { level: level, eraId: eraId, root: root };
  }

  // 渲染一个原著地点标记（按类别上色）
  function placeMarkup(p, idx) {
    var ci = catInfo(p);
    var hidden = (!state.dense) && (p.d || 3) < 3;
    var dim = state.filter && state.filter !== catOf(p);
    var cls = "acp-mark acp-cat-" + catOf(p) + (hidden ? " acp-hidden" : "") + (dim ? " acp-dim" : "");
    return '<div class="' + cls + '" style="left:' + p.x + '%;top:' + p.y + '%;--ac:' + ci.color + '" data-idx="' + idx + '" ' +
      'title="' + esc(p.n) + ' · ' + ci.label + '">' +
        '<span class="acp-glyph">' + ci.glyph + "</span>" +
        '<span class="acp-name">' + esc(p.n) + "</span>" +
      "</div>";
  }

  // 详情卡：类别 + 方位依据（原著出处）
  function showCard(p, level) {
    var old = document.querySelector("#acpCard");
    if (old) old.remove();
    var root = document.querySelector(OVERLAY);
    if (!root) return;
    var ci = catInfo(p);
    var card = document.createElement("div");
    card.id = "acpCard";
    card.className = "acp-card";
    card.innerHTML =
      '<div class="acp-card-top"><span class="acp-card-kind" style="color:' + ci.color + '">' + ci.glyph + ' 原著·' + ci.label + "</span>" +
        '<button class="acp-card-x" title="关闭">✕</button></div>' +
      '<div class="acp-card-title">' + esc(p.n) + "</div>" +
      '<div class="acp-card-row"><span>类别</span><b>' + ci.label + "</b></div>" +
      '<div class="acp-card-row"><span>所属区域</span><b>' + esc(p.rg || "—") + "</b></div>" +
      (level === 0 ? '<div class="acp-card-row"><span>方位依据</span><b>原著地理方位</b></div>' :
                     '<div class="acp-card-row"><span>所在层级</span><b>第 ' + (level + 1) + " 级 · " + LEVEL_NAMES[level] + "</b></div>") +
      '<div class="acp-card-desc">' + esc(p.desc || "") + "</div>" +
      (p.c ? '<div class="acp-card-src">✧ 方位/出处：' + esc(p.c) + "</div>" : "") +
      '<div class="acp-card-foot">五线深度舆图 · 原著权威归位（五类）</div>';
    root.appendChild(card);
    card.querySelector(".acp-card-x").addEventListener("click", function () { card.remove(); });
  }

  // 类别图例 + 点击筛选
  function buildLegend(root, places) {
    var wrap = document.createElement("div");
    wrap.className = "acp-legend";
    var title = document.createElement("span");
    title.className = "acp-lg-title";
    title.textContent = "原著五类";
    wrap.appendChild(title);
    CATS.forEach(function (c) {
      var cnt = places.filter(function (p) { return catOf(p) === c.key; }).length;
      if (!cnt) return;
      var b = document.createElement("button");
      b.className = "acp-lg-item" + (state.filter === c.key ? " on" : "") + (!state.filter ? " on" : "");
      b.style.setProperty("--ac", c.color);
      b.innerHTML = '<span class="acp-lg-dot">' + c.glyph + "</span>" + c.label + '<i>' + cnt + "</i>";
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        state.filter = (state.filter === c.key) ? "" : c.key;
        inject();
      });
      wrap.appendChild(b);
    });
    var all = document.createElement("button");
    all.className = "acp-lg-all" + (!state.filter ? " on" : "");
    all.textContent = "全部";
    all.addEventListener("click", function (e) { e.stopPropagation(); state.filter = ""; inject(); });
    wrap.appendChild(all);
    root.appendChild(wrap);
  }

  // 注入：L0 显示全部原著地点（按类分组），子层按 lv 过滤；先清旧层，再建提示/图例/地点层
  var injecting = false;
  function inject() {
    if (injecting) return;
    var view = currentView();
    if (!view) { clear(); return; }
    var P = window.ATLAS_CANON_PLACES;
    var all = P && P[view.eraId] ? P[view.eraId].nodes : [];
    if (!all.length) { clear(); return; }
    var marksHost = view.root.querySelector(".ad-marks");
    var crumbs = view.root.querySelector(".ad-crumbs");
    if (!marksHost || !crumbs) return;

    // L0 显示全部；下钻子层只显示 lv == 当前层级的地点
    var atLevel = view.level === 0 ? all.slice() : all.filter(function (p) { return placeLv(p) === view.level; });
    // 去重：跳过与静态下钻入口同名的地点（仅 L0 需要，子层静态地标少）
    var staticNames = {};
    view.root.querySelectorAll(".ad-marks .ad-mark .ad-name").forEach(function (n) {
      staticNames[norm(n.textContent)] = 1;
    });
    var places = view.level === 0
      ? atLevel.filter(function (p) { return !staticNames[norm(p.n)]; })
      : atLevel;
    if (!places.length) { clear(); return; }
    injecting = true;
    try {
      view.root.querySelectorAll(".acp-layer,.acp-toggle,.acp-lvtag,.acp-legend").forEach(function (n) { n.remove(); });

      var tag = document.createElement("span");
      tag.className = "acp-lvtag";
      var lvCnt = view.level === 0 ? "全部五类" : LEVEL_NAMES[view.level];
      tag.textContent = "原著地点 · " + lvCnt + (state.filter ? " · " + (CAT_MAP[state.filter] ? CAT_MAP[state.filter].label : "") : "");
      crumbs.appendChild(tag);

      var toggle = document.createElement("button");
      toggle.className = "ad-btn acp-toggle";
      var shown = places.filter(function (p) { return (p.d || 3) >= 3; }).length;
      toggle.textContent = state.dense ? "◫ 完整 " + places.length : "◫ 精简 " + shown;
      toggle.title = "切换原著地点显示密度";
      toggle.addEventListener("click", function (e) {
        e.stopPropagation(); state.dense = !state.dense; inject();
      });
      crumbs.appendChild(toggle);

      var layer = document.createElement("div");
      layer.className = "acp-layer";
      layer.innerHTML = places.map(placeMarkup).join("");
      marksHost.appendChild(layer);

      layer.querySelectorAll(".acp-mark").forEach(function (m) {
        m.addEventListener("click", function (e) {
          e.stopPropagation();
          var p = places[Number(m.getAttribute("data-idx"))];
          if (p) showCard(p, view.level);
        });
      });

      // 类别图例只在 L0 显示（五类归位全景）
      if (view.level === 0) buildLegend(view.root, places);
      view.eraId && (state.eraId = view.eraId);
      state.level = view.level;
    } finally {
      injecting = false;
    }
  }

  function clear() {
    var root = document.querySelector(OVERLAY);
    if (!root) return;
    root.querySelectorAll(".acp-layer,.acp-toggle,.acp-lvtag,.acp-legend,#acpCard").forEach(function (n) { n.remove(); });
  }

  // 观察器：等 overlay 出现 → 观察 .ad-body 重写 → 注入（复用 faction-layer 已验证的机制）
  var mo = null, docObs = null;
  function watchBody() {
    var body = document.querySelector(OVERLAY + " .ad-body");
    if (!body || mo) return;
    mo = new MutationObserver(function (muts) {
      var structural = muts.some(function (m) {
        return m.type === "childList" && (m.addedNodes.length || m.removedNodes.length);
      });
      if (structural) setTimeout(inject, 0);
    });
    mo.observe(body, { childList: true, subtree: true });
    setTimeout(inject, 0);
  }
  function boot() {
    var tryWatch = function () {
      if (document.querySelector(OVERLAY + " .ad-body")) {
        watchBody();
        if (docObs) { docObs.disconnect(); docObs = null; }
      }
    };
    tryWatch();
    if (!mo) {
      docObs = new MutationObserver(tryWatch);
      docObs.observe(document.body, { childList: true, subtree: true });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.AtlasCanonLayer = { inject: inject, state: state, version: "5.7.0" };
})();
