/* 云境 v6.0.0 · 原著地点美术增强层（AtlasCanonLayer）· 父子地理树 + 类别分清版
 * 零侵入：不改 atlas-panel.js / atlas-drilldown.js / atlas-faction-layer.js 静态逻辑。
 * v6.0（DR-028）架构级重构：
 *   【根因】旧版 canon 层自己按 lv 平铺一套 67 个平行标记，与静态树下钻骨架打架——
 *           下钻到「海神湖」场景层时把所有 lv4 地点（圣魂村/嘉陵关…）全倒出来。
 *   【新架构】canon 层退化为「美术增强层」：显示哪些点 100% 由静态树当前层 children 决定
 *           （父子从属天然正确），本层只给当前已渲染的 .ad-mark 上类别配色 + 详情强化。
 *   1) 旧版鼎徽记/三极标记/鼎立横幅全部取消——国家(country)/大型势力(faction)/宗门(sect)/地区(region)/地点(place) 五类分清；
 *   2) 武魂殿归 faction（大型势力，非国家），详情讲清「大型势力→大后期立国武魂帝国」演变；
 *   3) 详情卡按五类显示类别、所属区域、方位/出处、势力演变；
 *   4) 五类图例、点击筛选、精简/完整密度、碰撞避让沿用；
 *   5) 保留对动态势力层/acp-superseded 的兼容（本层不再隐藏静态节点）。
 * 数据源：atlas-drill-data.js（静态树，显示权威）+ atlas-canon-places.js（原著元数据，美术/详情）。
 * 可回滚：删本文件 + atlas-canon-layer.css + 页面引用即恢复；备份见 _bak_v600/。
 */
(function () {
  "use strict";
  var OVERLAY = "#atlasDrillOverlay";
  var LEVEL_NAMES = ["时代大图", "区域", "地点", "子区域", "场景"];
  var DENSE_MIN = 4; // 精简模式只显示重要度 >=4 的实体
  var CATS = [
    { key: "country", label: "国家",     glyph: "▣", color: "#e6b870" },
    { key: "faction", label: "大型势力", glyph: "⚔", color: "#e8a0a0" },
    { key: "sect",    label: "宗门",     glyph: "⚑", color: "#9fd8c0" },
    { key: "region",  label: "地区",     glyph: "❋", color: "#a9d08a" },
    { key: "place",   label: "地点",     glyph: "✦", color: "#d8cba0" }
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
  function catOf(p) { return p && CAT_MAP[p.cat] ? p.cat : "place"; }
  function catInfo(p) { return CAT_MAP[catOf(p)]; }
  function imp(p) { return p && !isNaN(Number(p.d)) ? Number(p.d) : 3; }

  // 读当前视图：层级 + 时代 + 面包屑路径
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
    // 面包屑路径（节点名，跳过时代名第一个）
    var crumbs = root.querySelectorAll(".ad-crumbs .ad-crumb");
    var path = [];
    for (var j = 1; j < crumbs.length; j++) { var t = String(crumbs[j].textContent || "").trim(); if (t) path.push(t); }
    return { level: level, eraId: eraId, path: path, root: root };
  }

  // 按名字从 canon 元数据取原著信息（没匹配到则用静态树节点自身兜底）
  function metaFor(node, eraId) {
    var P = window.ATLAS_CANON_PLACES;
    var list = P && P[eraId] ? P[eraId].nodes : [];
    var nm = norm(node.n);
    for (var i = 0; i < list.length; i++) if (norm(list[i].n) === nm) return list[i];
    return null;
  }

  // 合并静态节点 + 原著元数据为一个显示项
  function mergeItem(node, idx, eraId) {
    var meta = metaFor(node, eraId);
    return {
      idx: idx,
      n: node.n,
      cat: meta ? catOf(meta) : "place",
      d: meta ? imp(meta) : 3,
      rg: meta ? meta.rg : (node.rg || ""),
      c: meta ? meta.c : node.c,
      desc: meta ? meta.desc : node.desc,
      evo: meta ? meta.evo : null,
      x: node.x, y: node.y,
      hasKids: !!(node.children && node.children.length)
    };
  }

  // 取静态树当前层 children（显示权威）
  function currentNodes(eraId, path) {
    var D = window.ATLAS_DRILL;
    if (!D) return [];
    var era = null;
    for (var i = 0; i < D.eras.length; i++) if (D.eras[i].id === eraId) { era = D.eras[i]; break; }
    if (!era) return [];
    var kids = era.children;
    for (var p = 0; p < path.length; p++) {
      var found = null;
      for (var k = 0; k < kids.length; k++) if (norm(kids[k].n) === norm(path[p])) { found = kids[k]; break; }
      if (!found) return [];
      kids = found.children || [];
    }
    return kids;
  }

  function showCard(item, level) {
    var old = document.querySelector("#acpCard");
    if (old) old.remove();
    var root = document.querySelector(OVERLAY);
    if (!root) return;
    var ci = CAT_MAP[item.cat] || CAT_MAP.place;
    var card = document.createElement("div");
    card.id = "acpCard";
    card.className = "acp-card";
    card.innerHTML =
      '<div class="acp-card-top"><span class="acp-card-kind" style="color:' + ci.color + '">' +
        ci.glyph + " 原著·" + ci.label + "</span>" +
        '<button class="acp-card-x" title="关闭">✕</button></div>' +
      '<div class="acp-card-title">' + esc(item.n) + "</div>" +
      '<div class="acp-card-row"><span>类别</span><b>' + ci.label + "</b></div>" +
      '<div class="acp-card-row"><span>所属区域</span><b>' + esc(item.rg || "—") + "</b></div>" +
      '<div class="acp-card-row"><span>所在层级</span><b>第 ' + (level + 1) + " 级 · " + LEVEL_NAMES[level] + "</b></div>" +
      (item.evo ? '<div class="acp-card-evo"><span class="acp-evo-t">◈ 势力演变</span>' + esc(item.evo) + "</div>" : "") +
      '<div class="acp-card-desc">' + esc(item.desc || "") + "</div>" +
      (item.c ? '<div class="acp-card-src">✧ 方位/出处：' + esc(item.c) + "</div>" : "") +
      (item.hasKids ? '<div class="acp-card-foot">▸ 点击图上此地标可继续下钻</div>' : '<div class="acp-card-foot">五线深度舆图 · 原著权威归位（五类 / 父子地理树）</div>');
    root.appendChild(card);
    card.querySelector(".acp-card-x").addEventListener("click", function () { card.remove(); });
  }

  function buildLegend(root, items) {
    if (state.level !== 0) return; // 只在时代大图显示五类图例
    var wrap = document.createElement("div");
    wrap.className = "acp-legend";
    var title = document.createElement("span");
    title.className = "acp-lg-title";
    title.textContent = "原著五类";
    wrap.appendChild(title);
    CATS.forEach(function (c) {
      var cnt = items.filter(function (it) { return it.cat === c.key && (state.dense || it.d >= DENSE_MIN); }).length;
      if (!cnt) return;
      var b = document.createElement("button");
      b.className = "acp-lg-item" + ((state.filter === c.key || (!state.filter)) ? " on" : "");
      b.style.setProperty("--ac", c.color);
      b.innerHTML = '<span class="acp-lg-dot">' + c.glyph + "</span>" + c.label + "<i>" + cnt + "</i>";
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

    var nodes = currentNodes(view.eraId, view.path);
    if (!nodes.length) { clear(); return; }
    var items = nodes.map(function (n, i) { return mergeItem(n, i, view.eraId); });

    // 精简/完整：低层级(L3/L4)实体少，直接全显；顶层按重要度
    var fullLayer = view.level >= 3;
    var visible = (state.dense || fullLayer) ? items.slice() : items.filter(function (it) { return it.d >= DENSE_MIN; });
    if (!visible.length) { clear(); return; }

    injecting = true;
    try {
      var marksHost = view.root.querySelector(".ad-marks");
      var crumbs = view.root.querySelector(".ad-crumbs");
      if (!marksHost || !crumbs) return;

      // 清理上一轮注入物（含右侧详情面板增强行）
      view.root.querySelectorAll(".acp-lvtag,.acp-toggle,.acp-legend,.acp-card,.acp-detail-cat,.acp-detail-evo").forEach(function (n) { n.remove(); });

      // 右侧静态详情面板增强：显示当前节点（或时代大图）的原著类别
      var detail = view.root.querySelector(".ad-detail");
      if (detail) {
        var curItem = null;
        if (view.path.length) {
          // 当前节点 = 它自己那条记录。走静态树到「倒数第二层」，在其 children 里按最后一段名字找。
          var D = window.ATLAS_DRILL;
          var era = null;
          for (var z = 0; z < D.eras.length; z++) if (D.eras[z].id === view.eraId) { era = D.eras[z]; break; }
          var sibs = era ? era.children : [];
          for (var s = 0; s < view.path.length - 1; s++) {
            var par = null;
            for (var t = 0; t < sibs.length; t++) if (norm(sibs[t].n) === norm(view.path[s])) { par = sibs[t]; break; }
            if (!par) { sibs = []; break; }
            sibs = par.children || [];
          }
          var last = norm(view.path[view.path.length - 1]);
          var nodeObj = null;
          for (var u = 0; u < sibs.length; u++) if (norm(sibs[u].n) === last) { nodeObj = sibs[u]; break; }
          if (nodeObj) curItem = mergeItem(nodeObj, -1, view.eraId);
        }
        if (curItem && curItem.cat) {
          var ci = CAT_MAP[curItem.cat] || CAT_MAP.place;
          var catLine = document.createElement("div");
          catLine.className = "acp-detail-cat";
          catLine.style.setProperty("--ac", ci.color);
          catLine.innerHTML = '<span>原著类别</span><b>' + ci.glyph + " " + ci.label + "</b>" +
            (curItem.rg ? '<em>所属 · ' + esc(curItem.rg) + "</em>" : "");
          var descEl = detail.querySelector(".ad-detail-desc");
          if (descEl && descEl.parentNode) descEl.parentNode.insertBefore(catLine, descEl.nextSibling);
          else detail.appendChild(catLine);
          // 势力演变（武魂殿 → 武魂帝国）注入右侧，父节点也能看到
          if (curItem.evo) {
            var evoLine = document.createElement("div");
            evoLine.className = "acp-detail-evo";
            evoLine.innerHTML = "<b>◈ 势力演变</b>" + esc(curItem.evo);
            detail.appendChild(evoLine);
          }
        }
      }

      // 层级标签
      var tag = document.createElement("span");
      tag.className = "acp-lvtag";
      var lvCnt = view.level === 0 ? (state.dense ? "完整" : "精选") : "第" + (view.level + 1) + "级 · " + LEVEL_NAMES[view.level];
      tag.textContent = "原著地理 · " + lvCnt +
        (view.path.length ? " · " + esc(view.path[view.path.length - 1]) : "") +
        (state.filter ? " · " + (CAT_MAP[state.filter] ? CAT_MAP[state.filter].label : "") : "");
      crumbs.appendChild(tag);

      // 密度切换（仅顶层有意义）
      if (view.level === 0) {
        var toggle = document.createElement("button");
        toggle.className = "ad-btn acp-toggle";
        toggle.textContent = state.dense ? "◫ 完整 " + visible.length + "（点此精简）" : "◫ 精选 " + visible.length + "（点此看全 " + items.length + "）";
        toggle.title = "切换原著地点显示密度";
        toggle.addEventListener("click", function (e) { e.stopPropagation(); state.dense = !state.dense; inject(); });
        crumbs.appendChild(toggle);
      }

      // 给当前层每个静态 .ad-mark 上类别配色 + 挂详情
      var markEls = marksHost.querySelectorAll(".ad-mark");
      var visByIdx = {};
      visible.forEach(function (it) { visByIdx[it.idx] = it; });
      markEls.forEach(function (m) {
        var idx = Number(m.getAttribute("data-idx"));
        var it = visByIdx[idx];
        // 精简模式下未入选的标记淡出；筛选不匹配的淡出
        var dim = !it || (state.filter && it.cat !== state.filter);
        m.classList.toggle("acp-dim", !!dim);
        m.classList.remove("acp-cat-country", "acp-cat-faction", "acp-cat-sect", "acp-cat-region", "acp-cat-place");
        if (it) {
          var ci = CAT_MAP[it.cat] || CAT_MAP.place;
          m.classList.add("acp-cat-" + it.cat);
          m.style.setProperty("--ac", ci.color);
          m.setAttribute("title", it.n + " · 原著" + ci.label + (it.hasKids ? "（点击进入下一级）" : "（点击看详情）"));
          // 详情卡只绑叶子节点：有子节点的标记点击是下钻，详情卡会被 render 冲掉，无意义。
          if (!it.hasKids) {
            m.classList.add("acp-leaf");
            m.addEventListener("click", function () { showCard(it, view.level); });
          }
        }
      });

      // 五类图例（仅时代大图）
      if (view.level === 0) buildLegend(view.root, items);
      view.eraId && (state.eraId = view.eraId);
      state.level = view.level;
    } finally {
      injecting = false;
    }
  }

  function clear() {
    var root = document.querySelector(OVERLAY);
    if (!root) return;
    root.querySelectorAll(".acp-lvtag,.acp-toggle,.acp-legend,#acpCard").forEach(function (n) { n.remove(); });
    root.querySelectorAll(".ad-marks .ad-mark.acp-dim").forEach(function (n) { n.classList.remove("acp-dim"); });
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

  window.AtlasCanonLayer = { inject: inject, state: state, version: "6.0.0" };
})();
