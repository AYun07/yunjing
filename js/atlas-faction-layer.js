/* 云境 v5.4.0 · 动态势力上图（AtlasFactionLayer）
 * 零侵入：不改 atlas-panel.js / atlas-drilldown.js 静态树。
 * 通过 MutationObserver 监听深度舆图 .ad-body 重写，每次渲染后把动态势力旗标叠加到对应层级。
 * 数据源：window.storyFramework.storyState.variables.entities.factions（玩家 + 原著同一份）。
 * 分档：influence ≥68→L4场景层、≥38→L3子区域层、其余→L0/L1（DR-019，沿用旧舆图口径）。
 * 可回滚：删本文件 + atlas-faction-layer.css + studio.html 2 行引用即恢复 v5.3.0。
 */
(function () {
  "use strict";
  var LEVELS = 5; // 0 时代大图 / 1 区域 / 2 地点 / 3 子区域 / 4 场景

  // 归一化：去标点/书名号/空白，用于势力名与地名匹配（沿用旧舆图 norm 思路）
  function norm(s) {
    return String(s == null ? "" : s)
      .replace(/[《》「」『』\s·\-—（）()\[\]【】,，。.、:：;；'"]/g, "")
      .toLowerCase();
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // 从权威表查势力在指定世界/时代的锚点（含别名匹配）
  // 返回 {x,y,node,rg,c,era} 或 null
  function anchorOf(f, worldId, eraId) {
    var A = window.FACTION_ANCHORS;
    if (!A || !A[worldId]) return null;
    var name = norm(f && f.name);
    var table = A[worldId];
    var names = Object.keys(table);
    for (var i = 0; i < names.length; i++) {
      var key = names[i];
      var entries = table[key];
      var aliasHit = norm(key) === name || (f && (f.alias || []).some(function (a) { return norm(a) === name; }));
      if (!aliasHit) {
        for (var k = 0; k < entries.length; k++) {
          var als = entries[k].alias || [];
          for (var j = 0; j < als.length; j++) if (norm(als[j]) === name) { aliasHit = true; break; }
          if (aliasHit) break;
        }
      }
      if (!aliasHit) continue;
      // 优先取当前时代的锚点；没有则该势力在此时代不存在 → 返回标记
      var pick = null;
      for (var m = 0; m < entries.length; m++) if (entries[m].era === eraId) { pick = entries[m]; break; }
      if (pick) return { x: pick.x, y: pick.y, node: pick.node, nodeId: pick.nodeId, rg: pick.rg, c: pick.c, era: pick.era, known: true };
      return { known: false, name: f.name }; // 势力存在但此时代无权威位置
    }
    return null; // 该世界无此势力
  }

  // 在静态树里按 nodeId 找节点，返回 {node, parentNames:[祖先节点名...], nodeName}
  // parentNames 即"要看到该节点作为地标，玩家需要下钻到的路径"（不含时代名）
  function findNodePath(era, nodeId) {
    if (!era || !nodeId) return null;
    function walk(node, parents) {
      if (!node) return null;
      if (node.id === nodeId) return { node: node, parents: parents.slice(), nodeName: node.n };
      var kids = node.children || [];
      for (var i = 0; i < kids.length; i++) {
        var r = walk(kids[i], parents.concat([node.n]));
        if (r) return r;
      }
      return null;
    }
    // era 本身是根，其 children 是区域层
    var kids = era.children || [];
    for (var i = 0; i < kids.length; i++) {
      var r = walk(kids[i], []);
      if (r) return r;
    }
    return null;
  }

  // 查某 nodeId 属于哪个时代（用于玩家势力跨时代校验）
  function eraOwningNode(nodeId) {
    var D = window.ATLAS_DRILL;
    if (!D || !D.eras) return null;
    function has(n) {
      if (!n) return false;
      if (n.id === nodeId) return true;
      return (n.children || []).some(has);
    }
    for (var i = 0; i < D.eras.length; i++) {
      if ((D.eras[i].children || []).some(has)) return D.eras[i].id;
    }
    return null;
  }

  // 从面包屑读当前下钻路径（节点名数组，不含时代名）
  function currentPathNames() {
    var crumbs = document.querySelectorAll("#atlasDrillOverlay .ad-crumb");
    var out = [];
    // 第一个 crumb 是时代名，跳过
    for (var i = 1; i < crumbs.length; i++) {
      var t = String(crumbs[i].textContent || "").trim();
      if (t) out.push(t);
    }
    return out;
  }

  // 判断当前路径是否等于目标路径（允许 era 大图层：目标 parents 为空）
  function pathEquals(cur, target) {
    if (cur.length !== target.length) return false;
    for (var i = 0; i < cur.length; i++) if (norm(cur[i]) !== norm(target[i])) return false;
    return true;
  }

  // 势力目标层级（DR-019 §3，沿用旧舆图 infDepth 口径：≥68→3 →此处映射 L4；≥38→2→L3）
  function factionLevel(f) {
    var inf = Number(f && f.influence) || 0;
    if (inf >= 68) return 4;   // 场景层
    if (inf >= 38) return 3;   // 子区域层
    return 0;                  // 顶层/区域层
  }
  function isDestroyed(f) {
    return !!(f && (f.collapsed || f.status === "destroyed" || (Number(f.influence) || 0) <= 12));
  }
  function isRevived(f) {
    return !!(f && (f.status === "revived" || f.revived === true));
  }
  function factionKind(f) {
    return f && String(f.origin || "") === "player" ? "player" : "world";
  }

  // 读动态势力列表（单一数据源）
  function readFactions() {
    try {
      var fw = window.storyFramework;
      var v = fw && fw.storyState && fw.storyState.variables;
      var facs = v && v.entities && v.entities.factions;
      if (!facs) return [];
      return Object.keys(facs).map(function (k) {
        var f = facs[k];
        return f && f.name ? f : null;
      }).filter(Boolean);
    } catch (e) { return []; }
  }

  // 在静态树里查找势力归属的时代 index + 是否命中同名节点（用于去重/锚定）
  // 返回 { eraIdx, hitName } —— eraIdx 为 -1 表示未匹配到任何时代
  function locateInTree(name, territory) {
    var D = window.ATLAS_DRILL;
    if (!D || !D.eras) return { eraIdx: -1, hitName: null };
    var nk = norm(name), tk = norm(territory);
    var hitName = null, hitEra = -1;
    function walk(node, ei) {
      if (!node) return;
      var nkn = norm(node.n);
      if (nk && (nkn === nk || nkn.indexOf(nk) >= 0 || nk.indexOf(nkn) >= 0)) {
        if (hitEra < 0) { hitEra = ei; hitName = node.n; }
      }
      (node.children || []).forEach(function (c) { walk(c, ei); });
    }
    D.eras.forEach(function (era, i) { walk(era, i); });
    // 名字没命中，用地名再找一次
    if (hitEra < 0 && tk) {
      D.eras.forEach(function (era, i) {
        if (hitEra >= 0) return;
        walk2(era, i);
      });
    }
    function walk2(node, ei) {
      if (!node || hitEra >= 0) return;
      var nkn = norm(node.n);
      if (tk && (nkn === tk || nkn.indexOf(tk) >= 0 || tk.indexOf(nkn) >= 0)) { hitEra = ei; hitName = node.n; return; }
      (node.children || []).forEach(function (c) { walk2(c, ei); });
    }
    return { eraIdx: hitEra, hitName: hitName };
  }

  // 当前深度舆图状态：从 DOM 反推（注入层不访问内部闭包 state）
  function currentView() {
    var badge = document.querySelector("#atlasDrillOverlay .ad-lvbadge");
    var lv = 0;
    if (badge) {
      var m = String(badge.textContent).match(/(\d+)\s*\/\s*\d+/);
      if (m) lv = Math.max(0, Math.min(LEVELS - 1, Number(m[1]) - 1));
    }
    var onTab = document.querySelector("#atlasDrillOverlay .ad-era-tab.on");
    var eraIdx = onTab ? Number(onTab.getAttribute("data-era")) : 0;
    var map = document.querySelector("#atlasDrillOverlay .ad-map");
    return { level: lv, eraIdx: isNaN(eraIdx) ? 0 : eraIdx, map: map };
  }

  // 势力旗标落点：只在"权威节点所在的地图"显示，坐标取该节点在静态树的真实坐标。
  // 原著势力：查权威表 → 找静态树节点 → 校验当前下钻路径 == 节点父路径。
  // 玩家势力：点选坐标(territoryX/Y) + 所属地图节点(territoryNode)校验；无则地名匹配当前层节点。
  // 都不满足 → 不显示（绝不随机散点）。返回 {x,y,source,anchor} 或 null。
  function factionPos(f, map, view) {
    var kind = factionKind(f);
    var D = window.ATLAS_DRILL;
    var worldId = (D && D.genre) || "";
    var era = D && D.eras && D.eras[view.eraIdx];
    var eraId = era ? era.id : "";
    var curPath = currentPathNames();

    // 原著势力：权威表 + 静态树路径校验
    if (kind === "world") {
      var anch = anchorOf(f, worldId, eraId);
      if (anch && anch.known === false) return null; // 此时代不存在该势力
      if (anch && anch.known) {
        var np = findNodePath(era, anch.nodeId);
        var parents = np ? np.parents : [];
        if (!pathEquals(curPath, parents)) return null; // 不在势力所在的地图 → 不显示
        var x = np ? (np.node.x != null ? np.node.x : anch.x) : anch.x;
        var y = np ? (np.node.y != null ? np.node.y : anch.y) : anch.y;
        return { x: x, y: y, source: "canon", anchor: anch };
      }
      // 权威表无此势力 → 不显示（原著势力不应落到随机位置）
      return null;
    }

    // 玩家势力：点选坐标 + 所属地图节点校验
    if (kind === "player") {
      if (Number.isFinite(f.territoryX) && Number.isFinite(f.territoryY)) {
        if (f.territoryNodeId) {
          // 校验该驻地节点是否属于当前时代；不属于则不显示（玩家势力不跨时代乱跑）
          var ownerEra = eraOwningNode(f.territoryNodeId);
          if (ownerEra && ownerEra !== eraId) return null;
          var pp = findNodePath(era, f.territoryNodeId);
          if (!pp) return null; // 当前时代无此节点
          if (!pathEquals(curPath, pp.parents)) return null; // 不在驻地所在地图
        }
        return { x: f.territoryX, y: f.territoryY, source: "picked", anchor: null };
      }
      // 无点选坐标：按地名匹配当前层节点（仅当前层，不跨图）
      var target = norm(f.territory || "");
      var marks = map ? map.querySelectorAll(".ad-mark") : [];
      for (var i = 0; i < marks.length; i++) {
        var nm = marks[i].querySelector(".ad-name");
        var nk = nm ? norm(nm.textContent) : "";
        if (nk && target && (nk === target || nk.indexOf(target) >= 0 || target.indexOf(nk) >= 0)) {
          return { x: parseFloat(marks[i].style.left) || 50, y: parseFloat(marks[i].style.top) || 50, source: "territory", anchor: null };
        }
      }
      // 仍未定位：在时代大图顶层给一个「待设定驻地」虚位旗标，点击后进入点选模式
      if (view.level === 0) return { x: 12, y: 12, source: "pending", anchor: null };
      return null;
    }
    return null;
  }

  // 生成旗标 DOM
  function flagMarkup(f, pos, idx, infLv) {
    var dead = isDestroyed(f), revived = isRevived(f), kind = factionKind(f);
    var pending = pos.source === "pending";
    var sizeCls = infLv >= 4 ? " af-big" : infLv >= 3 ? " af-mid" : " af-small";
    var cls = "af-flag af-kind-" + kind + sizeCls + (dead ? " af-dead" : "") + (revived ? " af-revived" : "") + (pending ? " af-pending" : "");
    var ico = pending ? "⚐" : kind === "player" ? "⚑" : "⚔";
    var stat = pending ? "点击设定驻地" : dead ? "🏚 已覆灭" : revived ? "↗ 复兴" : "";
    return '<div class="' + cls + '" style="left:' + pos.x + '%;top:' + pos.y + '%" data-fidx="' + idx + '" ' +
      'title="' + esc(f.name) + (stat ? " · " + stat : "") + '">' +
        '<span class="af-banner">' + ico + "</span>" +
        '<span class="af-name">' + esc(f.name) + "</span>" +
        (stat ? '<span class="af-stat">' + stat + "</span>" : "") +
      "</div>";
  }

  var injected = 0;
  var injecting = false;
  function inject() {
    if (injecting) return;
    var view = currentView();
    if (!view.map) return;
    var marksHost = view.map.querySelector(".ad-marks");
    if (!marksHost) return;

    injecting = true;
    // 清掉旧注入（本层自己的旗标），避免累积
    marksHost.querySelectorAll(".af-flag").forEach(function (n) { n.remove(); });

    var facs = readFactions();
    var seen = {}; // 去重：同名势力只显示一次
    facs.forEach(function (f) {
      var key = norm(f.name);
      if (seen[key]) return;
      var pos = factionPos(f, view.map, view);
      if (!pos) return; // 权威位置/路径不匹配 → 不显示，杜绝随机散点
      seen[key] = 1;
      var wrap = document.createElement("div");
      wrap.innerHTML = flagMarkup(f, pos, facs.indexOf(f), factionLevel(f));
      var flag = wrap.firstChild;
      if (pos.anchor && pos.anchor.c) flag.setAttribute("data-src", pos.anchor.c);
      if (pos.anchor && pos.anchor.rg) flag.setAttribute("data-rg", pos.anchor.rg);
      flag.addEventListener("click", function (e) {
        e.stopPropagation();
        if (pos.source === "pending") { startPickSeat(f); }
        else showCard(f, flag);
      });
      marksHost.appendChild(flag);
      injected++;
    });
    injecting = false;
  }

  // ===== 玩家势力点选驻地 =====
  var picking = null;
  function startPickSeat(f) {
    if (picking) cancelPickSeat();
    picking = f;
    var tip = document.createElement("div");
    tip.id = "afPickTip";
    tip.innerHTML = "⚐ 正在为「" + esc(f.name) + "」设定驻地：点击地图上任意位置落脚 · <button id='afPickCancel'>取消</button>";
    document.body.appendChild(tip);
    var map = document.querySelector("#atlasDrillOverlay .ad-map");
    if (map) map.classList.add("af-picking");
    document.getElementById("afPickCancel").addEventListener("click", function (e) { e.stopPropagation(); cancelPickSeat(); });
    // 地图点击 → 存坐标
    if (map) map.addEventListener("click", onPickClick, { once: true, capture: true });
  }
  function onPickClick(e) {
    if (!picking) return;
    e.stopPropagation(); e.preventDefault();
    var map = document.querySelector("#atlasDrillOverlay .ad-map");
    var r = map.getBoundingClientRect();
    var x = Math.max(4, Math.min(96, (e.clientX - r.left) / r.width * 100));
    var y = Math.max(6, Math.min(94, (e.clientY - r.top) / r.height * 100));
    // 记录当前所属节点（当前路径最深节点的 id）
    var nodeId = currentDeepestNodeId();
    persistSeat(picking, x, y, nodeId);
    var nm = picking.name;
    cancelPickSeat();
    inject(); // 立即刷新，旗标落到新位置
    toastSeat(nm, x, y);
  }
  function currentDeepestNodeId() {
    // 从静态树按当前面包屑路径找到对应节点 id
    var D = window.ATLAS_DRILL, view = currentView();
    var era = D && D.eras && D.eras[view.eraIdx];
    if (!era) return null;
    var path = currentPathNames();
    var node = null, kids = era.children;
    for (var i = 0; i < path.length; i++) {
      node = null;
      for (var j = 0; j < kids.length; j++) if (norm(kids[j].n) === norm(path[i])) { node = kids[j]; break; }
      if (!node) return null;
      kids = node.children || [];
    }
    return node ? node.id : null; // 顶层时 node=null → 存 null，表示挂在时代大图
  }
  function persistSeat(f, x, y, nodeId) {
    try {
      f.territoryX = Math.round(x * 10) / 10;
      f.territoryY = Math.round(y * 10) / 10;
      f.territoryNodeId = nodeId || null;
    } catch (e) {}
    // 尝试持久化到存档（若世界实体对象是从 storyState 取的真实引用，改它即可随存档保存）
    try {
      var fw = window.storyFramework;
      if (fw && window.saveGame) { /* 存档由宿主线统一落盘，实体引用已被修改 */ }
    } catch (e) {}
  }
  function cancelPickSeat() {
    picking = null;
    var tip = document.getElementById("afPickTip"); if (tip) tip.remove();
    var map = document.querySelector("#atlasDrillOverlay .ad-map"); if (map) map.classList.remove("af-picking");
  }
  function toastSeat(name, x, y) {
    var t = document.createElement("div");
    t.className = "af-seat-toast";
    t.textContent = "⚑ 「" + name + "」驻地已设定（" + Math.round(x) + "%," + Math.round(y) + "%）";
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }

  // 势力详情浮层（独立，不碰现有 .ad-detail）
  function showCard(f, anchorEl) {
    var old = document.getElementById("afCard");
    if (old) old.remove();
    var dead = isDestroyed(f), revived = isRevived(f), kind = factionKind(f);
    var inf = Math.max(0, Math.min(100, Number(f.influence) || 0));
    var members = Number(f.members) || 0;
    var statLabel = dead ? "已覆灭" : revived ? "复兴" : "存续";
    var statCls = dead ? "af-s-dead" : revived ? "af-s-revived" : "af-s-active";
    var src = anchorEl.getAttribute("data-src") || "";
    var rg = anchorEl.getAttribute("data-rg") || "";
    var card = document.createElement("div");
    card.id = "afCard";
    card.className = "af-card";
    card.innerHTML =
      '<div class="af-card-top"><span class="af-card-kind">' + (kind === "player" ? "🏴 玩家自建" : "⚔ 世界实体") + "</span>" +
        '<button class="af-card-x" title="关闭">✕</button></div>' +
      '<div class="af-card-title">' + esc(f.name) + '</div>' +
      '<div class="af-card-status ' + statCls + '">' + statLabel + (revived ? " · 卷土重来" : "") + "</div>" +
      (rg ? '<div class="af-card-row"><span>所在区域</span><b>' + esc(rg) + "</b></div>" : "") +
      '<div class="af-card-row"><span>成员</span><b>' + members + " 人</b></div>" +
      '<div class="af-card-row"><span>影响力</span><b>' + inf + "/100</b></div>" +
      '<div class="af-bar"><i style="width:' + inf + '%"></i></div>' +
      (f.territory ? '<div class="af-card-row"><span>据点</span><b>' + esc(f.territory) + "</b></div>" : "") +
      (f.desc ? '<div class="af-card-desc">' + esc(f.desc) + "</div>" : "") +
      (src ? '<div class="af-card-src">📖 ' + esc(src) + "</div>" : "") +
      '<div class="af-card-foot">影响力 ' + (inf >= 68 ? "≥68 · 场景层(4)" : inf >= 38 ? "≥38 · 子区域层(3)" : "<38 · 顶层/区域层") + "</div>";
    document.body.appendChild(card);
    // 定位：优先贴着旗标，超出视口则居中
    var r = anchorEl.getBoundingClientRect();
    var cw = 260, ch = 300;
    var left = Math.min(window.innerWidth - cw - 16, Math.max(16, r.right + 12));
    var top = Math.min(window.innerHeight - ch - 16, Math.max(16, r.top - 40));
    card.style.left = left + "px";
    card.style.top = top + "px";
    card.querySelector(".af-card-x").addEventListener("click", function () { card.remove(); });
  }

  // 监听 .ad-body 重写（render 每次 innerHTML 覆盖），注入势力旗标
  var curBody = null, mo = null, injectQueued = false;
  function scheduleInject() {
    if (injectQueued) return;
    injectQueued = true;
    setTimeout(function () { injectQueued = false; inject(); }, 0);
  }
  function watch() {
    var body = document.querySelector("#atlasDrillOverlay .ad-body");
    if (!body) return false;
    if (body === curBody && mo) { inject(); return true; } // body 未变，补注一次即可
    if (mo) mo.disconnect();
    curBody = body;
    window.__afObsCount = window.__afObsCount || 0;
    mo = new MutationObserver(function (muts) {
      window.__afObsCount++;
      // 只关心 .ad-body 的直接子节点被替换（render 的 innerHTML= 会触发 childList）
      var structural = muts.some(function (m) {
        return (m.type === "childList" && (m.addedNodes.length || m.removedNodes.length));
      });
      if (structural) scheduleInject();
    });
    mo.observe(body, { childList: true });
    scheduleInject(); // 首次补注
    return true;
  }

  function boot() {
    // 直接观察 document，等 #atlasDrillOverlay .ad-body 一出现就 watch 它。
    // 不依赖 hook show 的时机——show 可能在 hook 装上前就被调用。
    var docObs = new MutationObserver(function () {
      if (watch()) { docObs.disconnect(); }
    });
    docObs.observe(document.documentElement, { childList: true, subtree: true });
    if (watch()) docObs.disconnect(); // overlay 已在 DOM 的情况

    // hook show 兜底：每次打开舆图都补注一次（下钻走内部 render，由 body observer 负责）
    var tries = 0;
    var h = setInterval(function () {
      tries++;
      var AD = window.AtlasDrill;
      if (AD && !AD.__factionHooked) {
        AD.__factionHooked = true;
        if (typeof AD.show === "function") {
          var origShow = AD.show;
          AD.show = function () {
            var ret = origShow.apply(this, arguments);
            setTimeout(function () { watch(); inject(); }, 60);
            return ret;
          };
        }
        clearInterval(h);
      }
      if (tries > 150) clearInterval(h);
    }, 100);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  // 全局监听：点地图空白处关闭详情卡
  document.addEventListener("click", function (e) {
    var card = document.getElementById("afCard");
    if (card && !e.target.closest(".af-card") && !e.target.closest(".af-flag")) card.remove();
  });

  window.AtlasFactionLayer = {
    inject: inject,
    readFactions: readFactions,
    factionLevel: factionLevel,
    getCount: function () { return injected; },
    version: "5.4.0"
  };
})();
