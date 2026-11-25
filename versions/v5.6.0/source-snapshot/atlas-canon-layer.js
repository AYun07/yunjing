/* 云境 v5.5.0 · 原著地点上图（AtlasCanonLayer）
 * 零侵入：不改 atlas-panel.js / atlas-drilldown.js / atlas-faction-layer.js 静态逻辑。
 * 在五线深度舆图的 L0 时代大图上，叠加「原著权威地点」美术地标——势力(sect/danger)用旗标、
 * 地点(city/relic/wild)用徽记，数据来自 window.ATLAS_CANON_PLACES（固化自 atlas-eras 权威坐标）。
 * 数据源：js/atlas-canon-places.js（零依赖，不读取懒加载的 ATLAS_ERAS，规避时序风险）。
 * 密度：精简（默认，只显示 d>=3 势力/重要地点）/ 完整（全部）切换。
 * 可回滚：删本文件 + atlas-canon-layer.css + atlas-canon-places.js + studio.html 引用即恢复。
 */
(function () {
  "use strict";
  var OVERLAY = "#atlasDrillOverlay";
  var state = { dense: false, eraId: "" }; // dense=false 精简；true 完整

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

  // 从当前 DOM 反推视图：是否 L0、当前时代 id
  function currentView() {
    var root = document.querySelector(OVERLAY);
    if (!root || root.style.display === "none") return null;
    var badge = root.querySelector(".ad-lvbadge");
    var text = badge ? badge.textContent : "";
    var isL0 = /1\/5/.test(text); // "时代大图 · 1/5"
    var art = root.querySelector(".ad-map");
    var artKey = art ? art.getAttribute("data-art") || "" : "";
    // artKey 形如 douluodalu__dou2 → 取最后一段为 eraId
    var eraId = artKey.split("__").pop() || "";
    // 用 tab 名兜底校验：tab 顺序 dou1..dou5，取 .on 的下标
    var tabs = root.querySelectorAll(".ad-era-tab");
    var onIdx = -1;
    for (var i = 0; i < tabs.length; i++) if (tabs[i].classList.contains("on")) { onIdx = i; break; }
    if (onIdx >= 0) eraId = "dou" + (onIdx + 1);
    return { isL0: isL0, eraId: eraId, root: root };
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
  function showCard(p) {
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
      '<div class="acp-card-row"><span>所属区域</span><b>' + esc(p.rg || "—") + "</b></div>" +
      '<div class="acp-card-desc">' + esc(p.desc || "") + "</div>" +
      (p.c ? '<div class="acp-card-src">✧ ' + esc(p.c) + "</div>" : "") +
      '<div class="acp-card-foot">五线深度舆图 · 原著权威地点（位置按该时代原著）</div>';
    root.appendChild(card);
    card.querySelector(".acp-card-x").addEventListener("click", function () { card.remove(); });
  }

  // 注入：只在 L0，先清旧层，再建密度切换按钮 + 地点层
  var injecting = false;
  function inject() {
    if (injecting) return;
    var view = currentView();
    if (!view || !view.isL0) { clear(); return; }
    var P = window.ATLAS_CANON_PLACES;
    var all = P && P[view.eraId] ? P[view.eraId].nodes : [];
    if (!all.length) { clear(); return; }
    var marksHost = view.root.querySelector(".ad-marks");
    var crumbs = view.root.querySelector(".ad-crumbs");
    if (!marksHost || !crumbs) return;

    // 去重：跳过与静态 L0 区域地标同名的原著地点（静态节点管下钻入口，本层管具体势力/地点）
    var staticNames = {};
    view.root.querySelectorAll(".ad-marks .ad-mark .ad-name").forEach(function (n) {
      staticNames[norm(n.textContent)] = 1;
    });
    var places = all.filter(function (p) { return !staticNames[norm(p.n)]; });
    if (!places.length) { clear(); return; }
    injecting = true;
    try {
      // 清理本层旧节点
      view.root.querySelectorAll(".acp-layer").forEach(function (n) { n.remove(); });
      view.root.querySelectorAll(".acp-toggle").forEach(function (n) { n.remove(); });

      // 密度切换按钮（放面包屑行尾）
      var toggle = document.createElement("button");
      toggle.className = "ad-btn acp-toggle";
      toggle.textContent = state.dense ? "◫ 完整 " + places.length : "◫ 精简 " + places.filter(function (p) { return (p.d || 3) >= 3; }).length;
      toggle.title = "切换原著地点显示密度";
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
          if (p) showCard(p);
        });
      });
      view.eraId && (state.eraId = view.eraId);
    } finally {
      injecting = false;
    }
  }

  function clear() {
    var root = document.querySelector(OVERLAY);
    if (!root) return;
    root.querySelectorAll(".acp-layer,.acp-toggle,#acpCard").forEach(function (n) { n.remove(); });
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

  window.AtlasCanonLayer = { inject: inject, state: state };
})();
