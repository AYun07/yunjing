/* 云境 v5.8.0 · 原著地点上图（AtlasCanonLayer）· 五类方位优化版
 * 零侵入：不改 atlas-panel.js / atlas-drilldown.js / atlas-faction-layer.js 静态逻辑。
 * v5.8（DR-026）：
 *   1) 武魂殿时序演变——与原「武魂帝国」合并为单一实体，详情卡写明「前期武魂殿→大后期立国武魂帝国」。
 *   2) 补齐原著遗漏地名（地狱路/天使殿/海神殿/嘉陵关/力之一族/死亡峡谷/西鲁城/云罗学院/异兽学院等）。
 *   3) 去乱——默认精简只显 d>=4 高重要度实体；坐标碰撞避让，密集处自动错开；名牌更紧凑。
 *   4) 五类分组、类别图例与筛选、下钻层级显示逻辑沿用 v5.7。
 * 数据源：js/atlas-canon-places.js（零依赖，不读懒加载的 ATLAS_ERAS，规避时序风险）。
 * 可回滚：删本文件 + atlas-canon-layer.css + atlas-canon-places.js + 页面引用即恢复。
 */
(function () {
  "use strict";
  var OVERLAY = "#atlasDrillOverlay";
  var LEVEL_NAMES = ["时代大图", "区域", "地点", "子区域", "场景"];
  var DENSE_MIN = 4; // 精简模式只显示重要度 >=4 的实体
  var CATS = [
    { key: "country", label: "国家", glyph: "▣", color: "#e6b870" },
    { key: "faction", label: "势力", glyph: "⚔", color: "#e8a0a0" },
    { key: "sect",    label: "宗门", glyph: "⚑", color: "#9fd8c0" },
    { key: "region",  label: "地区", glyph: "❋", color: "#a9d08a" },
    { key: "place",   label: "地点", glyph: "✦", color: "#d8cba0" }
  ];
  var CAT_MAP = {};
  CATS.forEach(function (c) { CAT_MAP[c.key] = c; });
  var state = { dense: false, eraId: "", level: 0, filter: "" };

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
  function imp(p) { return p && !isNaN(Number(p.d)) ? Number(p.d) : 3; }
  function placeLv(p) { var lv = p && p.lv; return (lv == null || isNaN(Number(lv))) ? 0 : Math.max(0, Math.min(4, Number(lv))); }

  // 坐标碰撞避让：密集处按最小间距互斥推开，保留大致方位（只影响渲染坐标，不改数据）
  function layout(places) {
    var arr = places.map(function (p) { return { p: p, x: p.x, y: p.y }; });
    var MINX = 7.5, MINY = 6.5;
    for (var pass = 0; pass < 14; pass++) {
      var moved = false;
      for (var i = 0; i < arr.length; i++) {
        for (var j = i + 1; j < arr.length; j++) {
          var dx = arr[j].x - arr[i].x, dy = arr[j].y - arr[i].y;
          if (Math.abs(dx) < MINX && Math.abs(dy) < MINY) {
            var ox = MINX - Math.abs(dx), oy = MINY - Math.abs(dy);
            var sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1;
            if (ox <= oy) { arr[i].x -= sx * ox / 2; arr[j].x += sx * ox / 2; }
            else { arr[i].y -= sy * oy / 2; arr[j].y += sy * oy / 2; }
            moved = true;
          }
        }
      }
      if (!moved) break;
    }
    arr.forEach(function (o) { o.x = Math.max(4, Math.min(96, o.x)); o.y = Math.max(5, Math.min(94, o.y)); });
    return arr;
  }

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

  function placeMarkup(item, idx) {
    var p = item.p, ci = catInfo(p);
    var dim = state.filter && state.filter !== catOf(p);
    var cls = "acp-mark acp-cat-" + catOf(p) + (dim ? " acp-dim" : "");
    return '<div class="' + cls + '" style="left:' + item.x.toFixed(2) + '%;top:' + item.y.toFixed(2) + '%;--ac:' + ci.color + '" data-idx="' + idx + '" ' +
      'title="' + esc(p.n) + ' · ' + ci.label + '">' +
        '<span class="acp-glyph">' + ci.glyph + "</span>" +
        '<span class="acp-name">' + esc(p.n) + "</span>" +
      "</div>";
  }

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
      (p.evo ? '<div class="acp-card-evo"><span class="acp-evo-t">◈ 势力演变</span>' + esc(p.evo) + "</div>" : "") +
      (level === 0 ? '<div class="acp-card-row"><span>方位依据</span><b>原著地理方位</b></div>' :
                     '<div class="acp-card-row"><span>所在层级</span><b>第 ' + (level + 1) + " 级 · " + LEVEL_NAMES[level] + "</b></div>") +
      '<div class="acp-card-desc">' + esc(p.desc || "") + "</div>" +
      (p.c ? '<div class="acp-card-src">✧ 方位/出处：' + esc(p.c) + "</div>" : "") +
      '<div class="acp-card-foot">五线深度舆图 · 原著权威归位（五类）</div>';
    root.appendChild(card);
    card.querySelector(".acp-card-x").addEventListener("click", function () { card.remove(); });
  }

  function buildLegend(root, places) {
    var wrap = document.createElement("div");
    wrap.className = "acp-legend";
    var title = document.createElement("span");
    title.className = "acp-lg-title";
    title.textContent = "原著五类";
    wrap.appendChild(title);
    CATS.forEach(function (c) {
      var cnt = places.filter(function (p) { return catOf(p) === c.key && imp(p) >= (state.dense ? 0 : DENSE_MIN); }).length;
      if (!cnt) return;
      var b = document.createElement("button");
      b.className = "acp-lg-item" + ((state.filter === c.key || (!state.filter)) ? " on" : "");
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

    var atLevel = view.level === 0 ? all.slice() : all.filter(function (p) { return placeLv(p) === view.level; });
    var staticNames = {};
    view.root.querySelectorAll(".ad-marks .ad-mark .ad-name").forEach(function (n) { staticNames[norm(n.textContent)] = 1; });
    var places = view.level === 0 ? atLevel.filter(function (p) { return !staticNames[norm(p.n)]; }) : atLevel;
    var visible = state.dense ? places : places.filter(function (p) { return imp(p) >= DENSE_MIN; });
    if (!visible.length) { clear(); return; }
    injecting = true;
    try {
      view.root.querySelectorAll(".acp-layer,.acp-toggle,.acp-lvtag,.acp-legend").forEach(function (n) { n.remove(); });

      var tag = document.createElement("span");
      tag.className = "acp-lvtag";
      var lvCnt = view.level === 0 ? (state.dense ? "完整" : "精选") : LEVEL_NAMES[view.level];
      tag.textContent = "原著地点 · " + lvCnt + (state.filter ? " · " + (CAT_MAP[state.filter] ? CAT_MAP[state.filter].label : "") : "");
      crumbs.appendChild(tag);

      var toggle = document.createElement("button");
      toggle.className = "ad-btn acp-toggle";
      toggle.textContent = state.dense ? "◫ 完整 " + visible.length + "（点此精简）" : "◫ 精选 " + visible.length + "（点此看全 " + places.length + "）";
      toggle.title = "切换原著地点显示密度";
      toggle.addEventListener("click", function (e) { e.stopPropagation(); state.dense = !state.dense; inject(); });
      crumbs.appendChild(toggle);

      var laid = layout(visible);
      var layer = document.createElement("div");
      layer.className = "acp-layer";
      layer.innerHTML = laid.map(placeMarkup).join("");
      marksHost.appendChild(layer);

      layer.querySelectorAll(".acp-mark").forEach(function (m) {
        m.addEventListener("click", function (e) {
          e.stopPropagation();
          var item = laid[Number(m.getAttribute("data-idx"))];
          if (item) showCard(item.p, view.level);
        });
      });

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

  var mo = null, docObs = null;
  function watchBody() {
    var body = document.querySelector(OVERLAY + " .ad-body");
    if (!body || mo) return;
    mo = new MutationObserver(function (muts) {
      var structural = muts.some(function (m) { return m.type === "childList" && (m.addedNodes.length || m.removedNodes.length); });
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
    if (!mo) { docObs = new MutationObserver(tryWatch); docObs.observe(document.body, { childList: true, subtree: true }); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.AtlasCanonLayer = { inject: inject, state: state, version: "5.8.0" };
})();
