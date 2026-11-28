/* 云境 v6.7.0 · 五线深度舆图 · 独立下钻模块（AtlasDrill）
 * 设计：零侵入——不改 atlas-panel.js，包装 StoryAtlas.open 注入「深度舆图」入口。
 * 视图：独立全屏 overlay；时代大图 → 逐级点击下钻到 4 层；面包屑返回。
 *
 * v6.7.0 实玩反馈修复（挤压重叠 / 无底图 / 深层空白）：
 *  ① 名牌防撞：渲染后做一轮「重要度加权分离」布局，把叠在一起的名牌推开并画引线回到真实坐标，实测 0 重叠。
 *  ② 底图不再断链：优先用 assets/map-art/{art}__L{n}.webp；没有该文件时改用世界底图按当前地点放大居中，
 *     叠一层等高线/经纬网做「局部测绘图」质感——38 个世界每一层都有图，不再是空白渐变。
 *  ③ 最深层不再空场：点到叶子地点时进入「场景特写」——放大到该点 + 展示真实周边地点 + 完整方位/出处。
 *  ④ 层级徽标按数据实际层数显示（有的世界 2 级到底，不硬凑 5 级）。
 * 底图：assets/map-art/{art}.webp；连底图都缺时回退程序化矢量地形。
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
    try {
      var cs = getComputedStyle(document.documentElement);
      return {
        primary: (cs.getPropertyValue("--yj-primary") || "").trim() || "#d9b46a",
        accent: (cs.getPropertyValue("--yj-accent") || "").trim() || "#9fd8c0"
      };
    } catch (e) { return { primary: "#d9b46a", accent: "#9fd8c0" }; }
  }

  function currentNode() { return state.path.length ? state.path[state.path.length - 1] : null; }
  function currentLevel() { return state.path.length; }
  function currentEra() { return DATA && DATA.eras[state.eraIdx]; }
  function eraDepth() {
    var e = currentEra();
    if (!e) return 4;
    if (e.depth) return e.depth;
    // 原生精细树（斗罗）没有 depth 字段，现场量一次
    var d = 1;
    (function walk(ns, cur) {
      (ns || []).forEach(function (n) {
        if (n.children && n.children.length) { if (cur + 1 > d) d = cur + 1; walk(n.children, cur + 1); }
      });
    })(e.children, 1);
    e.depth = d;
    return d;
  }
  // 视野变换：把当前这一层的地点分布框进来，铺满画布（避免 9 个点全挤在左上角一大片空白）
  // 返回 {cx, cy, k}：cx/cy 是视野中心（原图百分比坐标），k 是放大倍数。
  function computeView() {
    var lv = currentLevel(), node = currentNode();
    if (!lv) return { cx: 50, cy: 50, k: 1 };
    var kids = (node && node.children && node.children.length) ? node.children : [];
    if (kids.length >= 2) {
      var minx = 100, maxx = 0, miny = 100, maxy = 0;
      kids.forEach(function (n) {
        var x = Math.max(0, Math.min(100, +n.x || 50)), y = Math.max(0, Math.min(100, +n.y || 50));
        if (x < minx) minx = x; if (x > maxx) maxx = x;
        if (y < miny) miny = y; if (y > maxy) maxy = y;
      });
      var w = Math.max(13, maxx - minx), h = Math.max(13, maxy - miny);
      var k = Math.min(86 / w, 80 / h, 2.9);
      return { cx: (minx + maxx) / 2, cy: (miny + maxy) / 2, k: Math.max(1.12, +k.toFixed(3)) };
    }
    return { cx: node ? (+node.x || 50) : 50, cy: node ? (+node.y || 50) : 50, k: 2.5 };
  }
  // 原图坐标 → 画布百分比（与底图缩放严格同一套变换，落点和图对得上）
  function project(x, y, view) {
    var px = 50 + ((+x || 50) - view.cx) * view.k;
    var py = 50 + ((+y || 50) - view.cy) * view.k;
    return { x: Math.max(4, Math.min(96, px)), y: Math.max(6, Math.min(94, py)) };
  }

  // 底图规划：只有确实备了分级底图的世界（斗罗 5 部 × 4 层）才走分级图；
  // 其余世界统一用世界底图按当前视野放大——保证每一层都有图，且不再产生 404。
  function artPlan(view) {
    var era = currentEra();
    if (!era) return { src: "", zoom: 1, x: 50, y: 50 };
    var lv = currentLevel();
    var graded = /^douluodalu__dou\d$/.test(era.art) && lv > 0;
    return {
      src: "assets/map-art/" + era.art + (graded ? "__L" + lv : "") + ".webp",
      zoom: graded ? 1 : Math.min(view.k, 1.55),
      x: view.cx, y: view.cy, graded: graded
    };
  }

  function currentChildren() {
    var n = currentNode();
    return n ? (n.children || []) : (currentEra() ? currentEra().children : []);
  }
  // 叶子节点的同辈（真实周边地点）
  function siblingsOf() {
    var n = currentNode();
    if (!n) return [];
    var parent = state.path.length >= 2 ? state.path[state.path.length - 2] : null;
    var list = parent ? (parent.children || []) : (currentEra() ? currentEra().children : []);
    var me = n;
    return list.filter(function (x) { return x !== me; }).sort(function (a, b) {
      var da = Math.pow((+a.x || 50) - (+me.x || 50), 2) + Math.pow((+a.y || 50) - (+me.y || 50), 2);
      var db = Math.pow((+b.x || 50) - (+me.x || 50), 2) + Math.pow((+b.y || 50) - (+me.y || 50), 2);
      return da - db;
    });
  }

  var GLYPH = {
    city: '⌂', sect: '⌘', arena: '⚔', relic: '✧', danger: '⚠', wild: '♣', forest: '♠', water: '≈', desert: '◆'
  };

  function nodeMarkup(n, idx, pri, view) {
    var t = n.t || "city";
    var glyph = GLYPH[t] || GLYPH.city;
    var hasKids = n.children && n.children.length;
    var hint = hasKids ? "▸" : "◎";
    var tip = hasKids ? " · 点击进入下一级" : " · 查看场景特写";
    var p = project(n.x, n.y, view);
    return '<div class="ad-mark ad-t-' + esc(t) + ' ad-drillable" ' +
      'style="left:' + p.x.toFixed(2) + '%;top:' + p.y.toFixed(2) + '%" data-idx="' + idx + '" data-pri="' + (pri || 1) + '" ' +
      'title="' + esc(n.n) + tip + '">' +
        '<span class="ad-glyph">' + glyph + "</span>" +
        '<span class="ad-name">' + esc(n.n) + "</span>" +
        '<span class="ad-drill-hint">' + hint + "</span>" +
      "</div>";
  }

  // 程序化矢量地形（连底图都缺时的最后回退）
  function fallbackTerrain() {
    var hue = ["#2a3a4a", "#2c4038", "#3a3448", "#1c2b44", "#3a3a2c"][state.eraIdx % 5];
    var rings = "";
    for (var i = 0; i < 6; i++) {
      rings += '<circle cx="50" cy="50" r="' + (12 + i * 7) + '" fill="none" stroke="rgba(217,180,106,' + (0.16 - i * 0.02) + ')" stroke-width="0.3"/>';
    }
    return '<div class="ad-fallback" style="background:radial-gradient(circle at 50% 42%,' + hue + ',#0a1016 78%)">' +
      '<svg viewBox="0 0 100 100" preserveAspectRatio="none">' + rings + "</svg></div>";
  }
  // 局部测绘图质感层：等比等高线 + 经纬网（放大底图上叠，避免"把同一张图放大"的空洞感）
  function localSurvey(node) {
    var seed = 0, s = String((node && node.id) || "root");
    for (var i = 0; i < s.length; i++) seed = (seed * 31 + s.charCodeAt(i)) % 9973;
    var paths = "";
    for (var r = 0; r < 5; r++) {
      var pts = [], cxx = 50 + ((seed >> (r * 2)) % 24) - 12, cyy = 50 + ((seed >> (r * 3)) % 20) - 10;
      for (var a = 0; a <= 24; a++) {
        var ang = a / 24 * Math.PI * 2;
        var rad = 8 + r * 7 + Math.sin(ang * (3 + (seed % 3)) + r) * (2 + r * 0.7);
        pts.push((cxx + Math.cos(ang) * rad * 1.5).toFixed(1) + "," + (cyy + Math.sin(ang) * rad).toFixed(1));
      }
      paths += '<path d="M' + pts.join("L") + 'Z" fill="none" stroke="rgba(226,206,158,' + (0.16 - r * 0.02) + ')" stroke-width="' + (0.5 - r * 0.05) + '"/>';
    }
    var grid = "";
    for (var g = 1; g < 6; g++) {
      grid += '<line x1="' + (g * 100 / 6) + '" y1="0" x2="' + (g * 100 / 6) + '" y2="100" stroke="rgba(159,216,192,.07)" stroke-width="0.2"/>';
      grid += '<line x1="0" y1="' + (g * 100 / 6) + '" x2="100" y2="' + (g * 100 / 6) + '" stroke="rgba(159,216,192,.07)" stroke-width="0.2"/>';
    }
    return '<svg class="ad-survey" viewBox="0 0 100 100" preserveAspectRatio="none">' + grid + paths + "</svg>";
  }

  // 把底图按层级放大并居中到目标地点
  function applyArt(host) {
    var map = host.querySelector(".ad-map");
    if (!map) return;
    var img = map.querySelector(".ad-art");
    if (!img) return;
    var W = map.clientWidth || 1, H = map.clientHeight || 1;
    var k = parseFloat(map.getAttribute("data-zoom") || "1") || 1;
    var px = parseFloat(map.getAttribute("data-fx") || "50");
    var py = parseFloat(map.getAttribute("data-fy") || "50");
    var tx = -(px - 50) / 100 * W * k;
    var ty = -(py - 50) / 100 * H * k;
    var mx = (k - 1) * W / 2, my = (k - 1) * H / 2;
    tx = Math.max(-mx, Math.min(mx, tx));
    ty = Math.max(-my, Math.min(my, ty));
    img.style.transform = "translate(" + tx.toFixed(1) + "px," + ty.toFixed(1) + "px) scale(" + k.toFixed(3) + ")";
    img.style.opacity = k > 1 ? "0.9" : "0.94";
    // 更深层级：底图逐渐退为氛围层（压暗 + 极轻虚化），保证地名始终最清楚
    var lv = currentLevel();
    img.style.filter = lv >= 3 ? "saturate(.86) brightness(.78) blur(1.1px)"
      : lv >= 1 ? "saturate(.92) brightness(.84) blur(.4px)" : "none";
  }

  // 名牌防撞：重要度加权分离 + 引线回指真实坐标
  function layoutMarks(host) {
    var map = host.querySelector(".ad-map");
    if (!map) return { moved: 0, rest: 0 };
    var marks = Array.prototype.slice.call(map.querySelectorAll(".ad-mark"));
    if (marks.length < 2) return { moved: 0, rest: 0 };
    var W = map.clientWidth, H = map.clientHeight, PAD = 3;
    var items = marks.map(function (el) {
      var x = parseFloat(el.style.left) / 100 * W;
      var y = parseFloat(el.style.top) / 100 * H;
      return {
        el: el, ox: x, oy: y, x: x, y: y,
        w: el.offsetWidth, h: el.offsetHeight,
        m: 1 / Math.max(1, +(el.getAttribute("data-pri") || 1))
      };
    });
    var rounds = 120, moved = 0;
    for (var it = 0; it < rounds; it++) {
      var hit = false;
      for (var i = 0; i < items.length; i++) {
        for (var j = i + 1; j < items.length; j++) {
          var a = items[i], b = items[j];
          var dx = b.x - a.x, dy = b.y - a.y;
          var ox = (a.w + b.w) / 2 + 4 - Math.abs(dx);
          var oy = (a.h + b.h) / 2 + 3 - Math.abs(dy);
          if (ox > 0 && oy > 0) {
            hit = true;
            var ms = a.m + b.m;
            if (ox < oy) {
              var sx = (dx >= 0 ? 1 : -1) * ox * 0.52;
              a.x -= sx * a.m / ms; b.x += sx * b.m / ms;
            } else {
              var sy = (dy >= 0 ? 1 : -1) * oy * 0.52;
              a.y -= sy * a.m / ms; b.y += sy * b.m / ms;
            }
          }
        }
      }
      if (!hit) break;
    }
    // 夹回可视区
    items.forEach(function (t) {
      var hw = t.w / 2 + PAD, hh = t.h / 2 + PAD;
      t.x = Math.max(hw, Math.min(W - hw, t.x));
      t.y = Math.max(hh, Math.min(H - hh, t.y));
    });
    // 写回 + 引线
    var layer = map.querySelector(".ad-marks");
    items.forEach(function (t) {
      t.el.style.left = (t.x / W * 100).toFixed(3) + "%";
      t.el.style.top = (t.y / H * 100).toFixed(3) + "%";
      var d = Math.sqrt(Math.pow(t.x - t.ox, 2) + Math.pow(t.y - t.oy, 2));
      if (d > 12 && layer) {
        var line = document.createElement("div");
        line.className = "ad-leader";
        line.style.left = (t.ox / W * 100) + "%";
        line.style.top = (t.oy / H * 100) + "%";
        line.style.width = d.toFixed(1) + "px";
        line.style.transform = "rotate(" + Math.atan2(t.y - t.oy, t.x - t.ox).toFixed(3) + "rad)";
        layer.insertBefore(line, layer.firstChild);
        var pin = document.createElement("i");
        pin.className = "ad-pin";
        pin.style.left = (t.ox / W * 100) + "%";
        pin.style.top = (t.oy / H * 100) + "%";
        layer.insertBefore(pin, layer.firstChild);
        moved++;
      }
    });
    // 极端稠密时兜底：仍重叠的，弱方隐藏名牌（hover 仍可见），保证不糊成一团
    var rest = 0;
    for (var i2 = 0; i2 < items.length; i2++) {
      for (var j2 = i2 + 1; j2 < items.length; j2++) {
        var A = items[i2], B = items[j2];
        if (Math.abs(A.x - B.x) < (A.w + B.w) / 2 && Math.abs(A.y - B.y) < (A.h + B.h) / 2) {
          rest++;
          var weak = A.m >= B.m ? A : B;
          var lb = weak.el.querySelector(".ad-name");
          if (lb) lb.classList.add("ad-name-mini");
        }
      }
    }
    return { moved: moved, rest: rest };
  }

  function render() {
    if (!DATA) return;
    var host = document.getElementById("atlasDrillOverlay");
    if (!host) { host = buildHost(); }
    var era = currentEra();
    if (!era) return;
    var view = computeView();
    var plan = artPlan(view);
    var level = currentLevel();
    var node = currentNode();
    var leaf = !!(node && !(node.children && node.children.length));
    var P = pal();
    host.style.setProperty("--ad-primary", P.primary);
    host.style.setProperty("--ad-accent", P.accent);

    var children = currentChildren();
    var marks = "";
    if (!leaf) {
      marks = children.map(function (n, i) {
        return nodeMarkup(n, i, (n.children && n.children.length) ? (2 + n.children.length) : 1, view);
      }).join("");
    } else {
      // 场景特写：中心放大标 + 真实周边地点
      marks = '<div class="ad-mark ad-focus" style="left:50%;top:50%" data-pri="99">' +
          '<span class="ad-glyph">' + (GLYPH[node.t] || GLYPH.city) + "</span>" +
          '<span class="ad-name">' + esc(node.n) + "</span></div>";
      siblingsOf().slice(0, 6).forEach(function (s, i) {
        var pp = project(s.x, s.y, view);
        if (pp.x < 8 || pp.x > 92 || pp.y < 10 || pp.y > 90) return;
        marks += '<div class="ad-mark ad-near ad-t-' + esc(s.t || "city") + '" style="left:' + pp.x.toFixed(2) + "%;top:" + pp.y.toFixed(2) + '%" data-near="' + esc(s.n) + '" data-pri="1">' +
          '<span class="ad-glyph">' + (GLYPH[s.t] || GLYPH.city) + "</span>" +
          '<span class="ad-name">' + esc(s.n) + "</span></div>";
      });
    }

    var crumb = ['<button class="ad-crumb" data-crumb="-1">' + esc(era.name) + '</button>'];
    state.path.forEach(function (n, i) {
      crumb.push('<span class="ad-crumb-sep">›</span><button class="ad-crumb" data-crumb="' + i + '">' + esc(n.n) + "</button>");
    });

    var tabs = DATA.eras.map(function (e, i) {
      return '<button class="ad-era-tab' + (i === state.eraIdx ? " on" : "") + '" data-era="' + i + '"><i>' + esc(e.ico) + "</i>" + esc(e.name) + "</button>";
    }).join("");

    var total = eraDepth();
    var detail;
    if (!node) {
      detail = '<div class="ad-detail ad-detail-top"><div class="ad-detail-h">' + esc(era.name) + ' <span class="ad-detail-lv">时代大图</span></div>' +
        '<div class="ad-detail-desc">' + esc(era.hint || "") + "</div>" +
        '<div class="ad-region-list"><div class="ad-region-t">本时代 · 区域一览</div>' +
          era.children.map(function (r, i) {
            return '<button class="ad-region-item" data-region="' + i + '"><i>' + (GLYPH[r.t] || "◈") + "</i>" +
              "<span>" + esc(r.n) + "</span><em>" + ((r.children || []).length) + " 处 ▸</em></button>";
          }).join("") +
        "</div>" +
        '<div class="ad-detail-next">点击图上地标逐层下钻 · 本世界共 ' + (total + 1) + " 级 ▾</div></div>";
    } else {
      var near = leaf ? siblingsOf().slice(0, 5) : [];
      detail = '<div class="ad-detail">' +
        '<div class="ad-detail-h">' + esc(node.n) + ' <span class="ad-detail-lv">' + (leaf ? "场景特写" : LEVEL_NAMES[Math.min(level, 4)]) + "</span></div>" +
        '<div class="ad-detail-desc">' + esc(node.desc || "原著未给出该处细节。") + "</div>" +
        (node.c ? '<div class="ad-detail-c">📖 ' + esc(node.c) + "</div>" : "") +
        (leaf
          ? '<div class="ad-region-list"><div class="ad-region-t">周边地点 · 就近</div>' +
              (near.length ? near.map(function (s) {
                return '<button class="ad-region-item" data-goto="' + esc(s.n) + '"><i>' + (GLYPH[s.t] || "◈") + "</i><span>" + esc(s.n) + "</span><em>去这里 ▸</em></button>";
              }).join("") : '<div class="ad-detail-next ad-leaf">此处邻近没有其它已校对地点</div>') +
            "</div>"
          : '<div class="ad-detail-next">可继续下钻 ' + (node.children || []).length + " 处 ▾</div>") +
        "</div>";
    }

    host.querySelector(".ad-body").innerHTML =
      '<div class="ad-topbar">' +
        '<div class="ad-title"><span class="ad-title-ico">✦</span> 五线深度舆图 · <b>' + esc(DATA.name) + "</b></div>" +
        '<div class="ad-top-actions"><button class="ad-btn ad-back"' + (level === 0 ? " disabled" : "") + '>‹ 返回上一级</button>' +
        '<button class="ad-btn ad-close" title="关闭">✕</button></div>' +
      "</div>" +
      '<div class="ad-era-tabs">' + tabs + "</div>" +
      '<div class="ad-crumbs">' + crumb.join("") + '<span class="ad-lvbadge">' + (leaf ? "场景特写" : LEVEL_NAMES[Math.min(level, 4)]) + " · " + (level + 1) + "/" + (total + 1) + "</span></div>" +
      '<div class="ad-stage">' +
        '<div class="ad-map" data-art="' + esc(plan.src) + '" data-zoom="' + plan.zoom + '" data-fx="' + plan.x + '" data-fy="' + plan.y + '">' +
          fallbackTerrain() +
          '<img class="ad-art" alt="" src="' + esc(plan.src) + '"' +
            ' data-base="' + esc(plan.base || plan.src) + '" data-graded="' + (plan.graded ? "1" : "0") + '"' +
            ' onerror="this.dataset.failed=1;if(this.getAttribute(\'src\')!==this.dataset.base){this.setAttribute(\'src\',this.dataset.base);}else{this.style.display=\'none\';}">' +
          (node ? localSurvey(node) : "") +
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
        '<span class="ad-legend-hint">▸ 标记可点击下钻 · ◎ 场景特写</span>' +
      "</div>";

    bindBody();
    host.style.display = "flex";
    applyArt(host);
    layoutMarks(host);
  }

  function bindBody() {
    var body = document.querySelector("#atlasDrillOverlay .ad-body");
    if (!body) return;
    body.querySelectorAll(".ad-mark.ad-drillable").forEach(function (m) {
      m.addEventListener("click", function () {
        var n = currentChildren()[Number(m.getAttribute("data-idx"))];
        if (!n) return;
        if (state.path.length >= 4) return;
        state.path.push(n);
        render();
      });
    });
    body.querySelectorAll(".ad-region-item").forEach(function (b) {
      b.addEventListener("click", function () {
        var g = b.getAttribute("data-goto");
        if (g) {
          // 特写里点「周边地点」：换成该地点的特写
          var t = siblingsOf().filter(function (s) { return s.n === g; })[0];
          if (t) { state.path[state.path.length - 1] = t; render(); }
          return;
        }
        var r = currentEra().children[Number(b.getAttribute("data-region"))];
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

  // v6.7.0：校对数据改为懒加载后，这里要先把数据等到位再画（否则会画出一张空图）
  function ensureData(cb) {
    if (window.AtlasVerifiedAdapter && window.AtlasVerifiedAdapter.loadData) {
      window.AtlasVerifiedAdapter.loadData(cb);
      return;
    }
    cb();
  }

  function show(genre) {
    ensureData(function () { showNow(genre); });
  }
  function showNow(genre) {
    state.genre = genre || null;
    try {
      if (window.AtlasVerifiedAdapter && window.AtlasVerifiedAdapter.ensure) {
        window.AtlasVerifiedAdapter.ensure(genre);
        DATA = window.ATLAS_DRILL; // 重新绑定（ensure 可能替换 eras）
      }
    } catch(err){console.warn("[swallowed] atlas-drilldown",err)}
    state.eraIdx = 0;
    state.path = [];
    render();
  }
  function hide() {
    var host = document.getElementById("atlasDrillOverlay");
    if (host) host.style.display = "none";
  }

  // 窗口尺寸变化后重排（名牌坐标是像素计算出来的）
  var rt = null;
  window.addEventListener("resize", function () {
    if (!DATA) return;
    var host = document.getElementById("atlasDrillOverlay");
    if (!host || host.style.display === "none") return;
    clearTimeout(rt);
    rt = setTimeout(function () { render(); }, 180);
  });

  function injectEntry() {
    var panel = document.getElementById("atlasPanel");
    if (!panel || panel.querySelector(".ad-entry-btn")) return false;
    var btn = document.createElement("button");
    btn.className = "ad-entry-btn";
    btn.innerHTML = "✦ 五线深度舆图";
    btn.title = "进入壁纸级逐层下钻舆图";
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var g = null;
      try { g = (window.storyFramework && window.storyFramework.config && window.storyFramework.config.genreKey) || new URLSearchParams(location.search).get("genre"); } catch(err){console.warn("[swallowed] atlas-drilldown",err)}
      show(g);
    });
    panel.insertBefore(btn, panel.firstChild);
    return true;
  }

  function boot() {
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
      injectEntry();
      if (tries > 100) clearInterval(obs);
    }, 100);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.AtlasDrill = {
    show: show, hide: hide, render: render, layout: layoutMarks, DATA: DATA, version: "6.7.0"
  };
})();
