/* 云境 v5.9.0 · 原著地点上图（AtlasCanonLayer）· 三足鼎立 + 层级归位版
 * 零侵入：不改 atlas-panel.js / atlas-drilldown.js / atlas-faction-layer.js 静态逻辑。
 * v5.9（DR-027）：
 *   1) 三足鼎立——天斗(pole=1北)/武魂殿(pole=2中)/星罗(pole=3南) 强制在 L0 显示，
 *      统一「鼎」徽记 + 方位前缀；隐藏静态树同名 ad-mark 避免重叠；切层时恢复。
 *   2) 详情卡新增「三足鼎立」区块，武魂殿仍保留势力演变（→武魂帝国）。
 *   3) 层级归位——L0 显示 lv0(大陆级)、L1-L4 各按 lv 过滤；修复 v5.8 全 lv0 致下钻无地点的问题。
 *   4) 五类分组、类别图例与筛选、密度切换、碰撞避让沿用 v5.7/v5.8。
 * 数据源：js/atlas-canon-places.js（零依赖，不读懒加载的 ATLAS_ERAS，规避时序风险）。
 * 可回滚：删本文件 + atlas-canon-layer.css + atlas-canon-places.js + 页面引用即恢复。
 */
(function () {
  "use strict";
  var OVERLAY = "#atlasDrillOverlay";
  var LEVEL_NAMES = ["时代大图", "区域", "地点", "子区域", "场景"];
  var POLE_TXT = { 1: "北方帝国", 2: "中枢第三极", 3: "南方帝国" };
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
  function poleOf(p) { var v = p && p.pole; return (v === 1 || v === 2 || v === 3) ? v : 0; }

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
            // 三极不让位：鼎立核心保持原坐标，只推同级
            var pi = poleOf(arr[i].p), pj = poleOf(arr[j].p);
            if (pi && !pj) { arr[j].x += sx * ox; arr[j].y += sy * oy; }
            else if (!pi && pj) { arr[i].x -= sx * ox; arr[i].y -= sy * oy; }
            else if (pi && pj) { /* 三极之间保留间距，微调 */ arr[i].x -= sx*ox/2; arr[j].x += sx*ox/2; }
            else if (ox <= oy) { arr[i].x -= sx * ox / 2; arr[j].x += sx * ox / 2; }
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
    var dim = state.filter && state.filter !== catOf(p) && !poleOf(p);
    var pole = poleOf(p);
    var cls = "acp-mark acp-cat-" + catOf(p) + (pole ? " acp-pole acp-pole-" + pole : "") + (dim ? " acp-dim" : "");
    var dir = pole ? ({1:"北",2:"中",3:"南"}[pole] + "·") : "";
    var glyph = pole ? "鼎" : ci.glyph;
    return '<div class="' + cls + '" style="left:' + item.x.toFixed(2) + '%;top:' + item.y.toFixed(2) + '%;--ac:' + (pole ? "#f0c96a" : ci.color) + '" data-idx="' + idx + '" ' +
      'title="' + esc(p.n) + ' · ' + (pole ? POLE_TXT[pole] : ci.label) + '">' +
        '<span class="acp-glyph">' + glyph + "</span>" +
        '<span class="acp-name">' + dir + esc(p.n) + "</span>" +
      "</div>";
  }

  function showCard(p, level) {
    var old = document.querySelector("#acpCard");
    if (old) old.remove();
    var root = document.querySelector(OVERLAY);
    if (!root) return;
    var ci = catInfo(p);
    var pole = poleOf(p);
    var card = document.createElement("div");
    card.id = "acpCard";
    card.className = "acp-card";
    card.innerHTML =
      '<div class="acp-card-top"><span class="acp-card-kind" style="color:' + (pole ? "#f0c96a" : ci.color) + '">' +
        (pole ? "鼎 原著·三足鼎立" : ci.glyph + " 原著·" + ci.label) + "</span>" +
        '<button class="acp-card-x" title="关闭">✕</button></div>' +
      '<div class="acp-card-title">' + esc(p.n) + "</div>" +
      (pole ? '<div class="acp-card-tri"><span class="acp-tri-t">◈ 三足鼎立 · ' + POLE_TXT[pole] + "</span>" + esc(p.tri || "") + "</div>" : "") +
      '<div class="acp-card-row"><span>类别</span><b>' + ci.label + (pole ? " · 鼎立核心" : "") + "</b></div>" +
      '<div class="acp-card-row"><span>所属区域</span><b>' + esc(p.rg || "—") + "</b></div>" +
      (p.evo ? '<div class="acp-card-evo"><span class="acp-evo-t">◈ 势力演变</span>' + esc(p.evo) + "</div>" : "") +
      (level === 0 ? '<div class="acp-card-row"><span>方位依据</span><b>原著地理方位</b></div>' :
                     '<div class="acp-card-row"><span>所在层级</span><b>第 ' + (level + 1) + " 级 · " + LEVEL_NAMES[level] + "</b></div>") +
      '<div class="acp-card-desc">' + esc(p.desc || "") + "</div>" +
      (p.c ? '<div class="acp-card-src">✧ 方位/出处：' + esc(p.c) + "</div>" : "") +
      '<div class="acp-card-foot">五线深度舆图 · 原著权威归位（三足鼎立 / 五类 / 五级）</div>';
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

    // 层级归位：每一级只显示归属该级的地点（含 L0 只看大陆级 lv0），杜绝全层级平铺造成的拥挤
    var atLevel = all.filter(function (p) { return placeLv(p) === view.level; });
    var staticNames = {};
    view.root.querySelectorAll(".ad-marks .ad-mark .ad-name").forEach(function (n) { staticNames[norm(n.textContent)] = 1; });
    // 三极(pole) 强制显示、不被静态同名节点去重；其余仍去重
    var places = view.level === 0 ? atLevel.filter(function (p) {
      return poleOf(p) || !staticNames[norm(p.n)];
    }) : atLevel;
    // L3/L4 是细分场景层，实体本就少(4/8)且重要度偏低，不做精选过滤，直接全显
    var fullLayer = view.level >= 3;
    var visible = (state.dense || fullLayer) ? places : places.filter(function (p) { return imp(p) >= DENSE_MIN || poleOf(p); });
    if (!visible.length) { clear(); return; }
    injecting = true;
    try {
      view.root.querySelectorAll(".acp-layer,.acp-toggle,.acp-lvtag,.acp-legend,.acp-tri-banner").forEach(function (n) { n.remove(); });
      // 先恢复上一轮被隐藏的静态同名节点
      view.root.querySelectorAll(".ad-marks .ad-mark.acp-superseded").forEach(function (n) { n.classList.remove("acp-superseded"); });

      var tag = document.createElement("span");
      tag.className = "acp-lvtag";
      var lvCnt = view.level === 0 ? "三足鼎立 · " + (state.dense ? "完整" : "精选") : "第" + (view.level + 1) + "级 · " + LEVEL_NAMES[view.level];
      tag.textContent = "原著地点 · " + lvCnt + (state.filter ? " · " + (CAT_MAP[state.filter] ? CAT_MAP[state.filter].label : "") : "");
      crumbs.appendChild(tag);

      if (!fullLayer) {
        var toggle = document.createElement("button");
        toggle.className = "ad-btn acp-toggle";
        toggle.textContent = state.dense ? "◫ 完整 " + visible.length + "（点此精简）" : "◫ 精选 " + visible.length + "（点此看全 " + places.length + "）";
        toggle.title = "切换原著地点显示密度";
        toggle.addEventListener("click", function (e) { e.stopPropagation(); state.dense = !state.dense; inject(); });
        crumbs.appendChild(toggle);
      }

      // L0 三极说明横幅
      if (view.level === 0) {
        var poleCount = visible.filter(function (p) { return poleOf(p); }).length;
        if (poleCount) {
          var banner = document.createElement("div");
          banner.className = "acp-tri-banner";
          banner.innerHTML = '<b>鼎 · 三足鼎立</b>　北 天斗帝国　│　中 武魂殿（第三极，后期武魂帝国）　│　南 星罗帝国';
          marksHost.appendChild(banner);
        }
      }

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

      // 隐藏静态树中与三极同名的 ad-mark，避免两个标记重叠
      if (view.level === 0) {
        var poleNames = {};
        visible.forEach(function (p) { if (poleOf(p)) poleNames[norm(p.n)] = 1; });
        view.root.querySelectorAll(".ad-marks .ad-mark").forEach(function (m) {
          var nm = m.querySelector(".ad-name");
          if (nm && poleNames[norm(nm.textContent)]) m.classList.add("acp-superseded");
        });
      }

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
    root.querySelectorAll(".acp-layer,.acp-toggle,.acp-lvtag,.acp-legend,#acpCard,.acp-tri-banner").forEach(function (n) { n.remove(); });
    root.querySelectorAll(".ad-marks .ad-mark.acp-superseded").forEach(function (n) { n.classList.remove("acp-superseded"); });
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

  window.AtlasCanonLayer = { inject: inject, state: state, version: "5.9.0" };
})();
