/* 云境 v5.6.0 · 原著地点上图（AtlasCanonLayer）· 分层方位版
 * 零侵入：不改 atlas-panel.js / atlas-drilldown.js / atlas-faction-layer.js 静态逻辑。
 * v5.6（DR-024）：从「只在 L0 堆叠」改为「按当前下钻层级显示对应原著地点」——
 *   每个地点带 lv(0-4)，只有 lv == 当前层级时才注入；坐标为该级地图相对方位。
 *   详情卡标注「所在层级 + 第几级地图」；同名静态节点按当前层去重；密度切换保留。
 * 数据源：js/atlas-canon-places.js（零依赖，不读懒加载的 ATLAS_ERAS，规避时序风险）。
 * 可回滚：删本文件 + atlas-canon-layer.css + atlas-canon-places.js + 页面引用即恢复。
 */
(function () {
  "use strict";
  var OVERLAY = "#atlasDrillOverlay";
  var LEVEL_NAMES = ["时代大图", "区域", "地点", "子区域", "场景"];
  var state = { dense: false, eraId: "", level: 0 }; // dense=false 精简 / true 完整

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
  function isSect(t) { return t === "sect" || t === "danger"; }
  function glyph(t) {
    return { sect: "⚑", danger: "☠", city: "✦", relic: "✧", wild: "❋" }[t] || "◈";
  }
  function typeLabel(t) {
    return { sect: "势力", danger: "险地/强敌", city: "城域", relic: "秘境传承", wild: "险地/灵境" }[t] || "地点";
  }
  function placeLv(p) { var lv = p && p.lv; return (lv == null || isNaN(Number(lv))) ? 0 : Math.max(0, Math.min(4, Number(lv))); }

  // 从当前 DOM 反推视图：当前层级 + 时代 id（注入层不访问内部闭包 state）
  function currentView() {
    var root = document.querySelector(OVERLAY);
    if (!root || root.style.display === "none") return null;
    var badge = root.querySelector(".ad-lvbadge");
    var text = badge ? String(badge.textContent) : "";
    var m = text.match(/(\d+)\s*\/\s*\d+/);
    var level = m ? Math.max(0, Math.min(4, Number(m[1]) - 1)) : 0;
    var art = root.querySelector(".ad-map");
    var artKey = art ? art.getAttribute("data-art") || "" : "";
    var eraId = artKey.split("__").pop() || "";
    var tabs = root.querySelectorAll(".ad-era-tab");
    var onIdx = -1;
    for (var i = 0; i < tabs.length; i++) if (tabs[i].classList.contains("on")) { onIdx = i; break; }
    if (onIdx >= 0) eraId = "dou" + (onIdx + 1);
    return { level: level, eraId: eraId, root: root };
  }

  // 渲染一个原著地点标记
  function placeMarkup(p, idx) {
    var sect = isSect(p.t);
    var cls = "acp-mark acp-t-" + esc(p.t) + (sect ? " acp-sect" : " acp-place") + ((!state.dense) && (p.d || 3) < 3 ? " acp-hidden" : "");
    return '<div class="' + cls + '" style="left:' + p.x + '%;top:' + p.y + '%" data-idx="' + idx + '" ' +
      'title="' + esc(p.n) + ' · ' + typeLabel(p.t) + '">' +
        '<span class="acp-glyph">' + glyph(p.t) + "</span>" +
        '<span class="acp-name">' + esc(p.n) + "</span>" +
      "</div>";
  }

  // 详情卡（复用 af-card 视觉语言，用独立 acp- 前缀避免冲突）
  function showCard(p, level) {
    var old = document.querySelector("#acpCard");
    if (old) old.remove();
    var root = document.querySelector(OVERLAY);
    if (!root) return;
    var card = document.createElement("div");
    card.id = "acpCard";
    card.className = "acp-card";
    card.innerHTML =
      '<div class="acp-card-top"><span class="acp-card-kind">原著地点 · ' + esc(typeLabel(p.t)) + "</span>" +
        '<button class="acp-card-x" title="关闭">✕</button></div>' +
      '<div class="acp-card-title">' + esc(p.n) + "</div>" +
      '<div class="acp-card-row"><span>所在层级</span><b>第 ' + (level + 1) + " 级 · " + LEVEL_NAMES[level] + "</b></div>" +
      '<div class="acp-card-row"><span>所属区域</span><b>' + esc(p.rg || "—") + "</b></div>" +
      '<div class="acp-card-desc">' + esc(p.desc || "") + "</div>" +
      (p.c ? '<div class="acp-card-src">✧ ' + esc(p.c) + "</div>" : "") +
      '<div class="acp-card-foot">五线深度舆图 · 原著权威地点（方位按该级地图）</div>';
    root.appendChild(card);
    card.querySelector(".acp-card-x").addEventListener("click", function () { card.remove(); });
  }

  // 注入：按当前层级过滤，先清旧层，再建层级提示 + 密度切换 + 地点层
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

    // 只取「应显示在当前层级」的地点
    var atLevel = all.filter(function (p) { return placeLv(p) === view.level; });
    // 去重：跳过与当前层静态地标同名的原著地点（静态节点管下钻入口，本层管具体势力/地点）
    var staticNames = {};
    view.root.querySelectorAll(".ad-marks .ad-mark .ad-name").forEach(function (n) {
      staticNames[norm(n.textContent)] = 1;
    });
    var places = atLevel.filter(function (p) { return !staticNames[norm(p.n)]; });
    if (!places.length) { clear(); return; }
    injecting = true;
    try {
      // 清理本层旧节点
      view.root.querySelectorAll(".acp-layer").forEach(function (n) { n.remove(); });
      view.root.querySelectorAll(".acp-toggle,.acp-lvtag").forEach(function (n) { n.remove(); });

      // 层级提示（放面包屑行尾，标明这一级地图显示的是哪一层原著地点）
      var tag = document.createElement("span");
      tag.className = "acp-lvtag";
      tag.textContent = "原著地点 · " + LEVEL_NAMES[view.level];
      crumbs.appendChild(tag);

      // 密度切换按钮
      var toggle = document.createElement("button");
      toggle.className = "ad-btn acp-toggle";
      toggle.textContent = state.dense ? "◫ 完整 " + places.length : "◫ 精简 " + places.filter(function (p) { return (p.d || 3) >= 3; }).length;
      toggle.title = "切换本层原著地点显示密度";
      toggle.addEventListener("click", function (e) {
        e.stopPropagation();
        state.dense = !state.dense;
        inject();
      });
      crumbs.appendChild(toggle);

      // 地点层容器（独立于 .ad-mark 与 af-flag，避免互相覆盖）
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
      view.eraId && (state.eraId = view.eraId);
      state.level = view.level;
    } finally {
      injecting = false;
    }
  }

  function clear() {
    var root = document.querySelector(OVERLAY);
    if (!root) return;
    root.querySelectorAll(".acp-layer,.acp-toggle,.acp-lvtag,#acpCard").forEach(function (n) { n.remove(); });
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

  window.AtlasCanonLayer = { inject: inject, state: state, version: "5.6.0" };
})();
