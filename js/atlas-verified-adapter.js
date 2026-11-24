/* 云境 v6.7.0 · 校对数据适配层（AtlasVerifiedAdapter）
 * 作用：把 38 世界校对数据 window.ATLAS_VERIFIED[genre] 转成深度舆图所需的 ATLAS_DRILL 树结构。
 *
 * v6.7.0 重写要点（实玩反馈：区域叫「北部中域/南部东域」、没有具体地名、逐层挤压重叠、三四级空白）：
 *  ① 分区不再按坐标网格，改为「按原著地标聚类」：以数据里已有的 region/country/sect/faction 作锚点，
 *     其余地点就近归属。于是每一层都带真实地名（天南、大晋、乱星海…），不再出现方位词。
 *  ② 每层数量封顶（GROUP_CAP），超出就自动再往下分一级，从数据层就杜绝「十几个名牌挤在一起」。
 *  ③ 层级由数据本身决定（有 region 才分区域，没有就直接列地点），最深处落在真实地点上。
 *  ④ 分组描述一律取自原著条目自身的 where/c 字段，不编造任何地名或设定。
 * 零侵入：不改 atlas-drilldown.js 的对外接口，仅在 show() 前把生成树挂到 ATLAS_DRILL.eras。
 * 回滚：删本文件 + 页面引用即恢复；斗罗仍优先用原生精细树（有手绘底图与人工分级）。
 */
(function () {
  "use strict";
  if (window.AtlasVerifiedAdapter) return;

  var CAT_GLYPH = { country: "▣", faction: "⚔", sect: "⚑", region: "❋", place: "✦" };
  var CAT_T = { country: "city", faction: "sect", sect: "sect", region: "wild", place: "city" };
  // 层级权重：越"大"的条目越适合当分区锚点
  var CAT_W = { region: 100, country: 80, sect: 55, faction: 50, place: 20 };

  var LEAF_CAP = 11;   // 一层最多放 11 个「不再下钻」的地名，超了就再分一级
  var GROUP_CAP = 9;   // 一层最多 9 个分区，保证名牌不挤
  var MAX_DEPTH = 4;   // 与 atlas-drilldown.js 的层级上限一致（时代大图算第 0 级）

  function w(p) {
    return (CAT_W[p.cat] || 20) + (+p.lv || 0) * 3 + (+p.d || 0) * 2;
  }
  function dist(a, b) {
    var dx = (+a.x || 50) - (+b.x || 50), dy = (+a.y || 50) - (+b.y || 50);
    return Math.sqrt(dx * dx + dy * dy);
  }
  function valid(p) {
    return p && p.n && typeof p.n === "string" && p.n.length < 40;
  }

  // 锚点挑选：重要度 × 空间分散度（加权最远点采样），保证既不选到边角小地名，也不全挤在一角
  function pickAnchors(list, cap) {
    var pool = list.slice().sort(function (a, b) {
      return (w(b) - w(a)) || ((+a.y || 50) - (+b.y || 50)) || ((+a.x || 50) - (+b.x || 50));
    });
    var chosen = [pool[0]];
    while (chosen.length < cap && chosen.length < pool.length) {
      var best = null, bestScore = -1;
      for (var i = 0; i < pool.length; i++) {
        var c = pool[i];
        if (chosen.indexOf(c) >= 0) continue;
        var dmin = Infinity;
        for (var j = 0; j < chosen.length; j++) {
          var d = dist(c, chosen[j]);
          if (d < dmin) dmin = d;
        }
        // 分数 = 重要度 ×（基础分 + 与已选锚点的最近距离），距离权重略低于重要度
        var s = w(c) * (0.55 + dmin / 34);
        if (s > bestScore) { bestScore = s; best = c; }
      }
      if (!best) break;
      chosen.push(best);
    }
    return chosen;
  }

  function descOf(p) {
    var lines = [];
    if (p.where) lines.push("【方位】" + p.where);
    if (p.c) lines.push("【出处】" + p.c);
    return lines.join("\n");
  }

  function leafNode(p, idBase, era) {
    return {
      id: idBase,
      n: p.n,
      t: CAT_T[p.cat] || "city",
      x: +p.x || 50, y: +p.y || 50,
      desc: descOf(p) || (p.c || ""),
      c: p.c || "",
      cat: p.cat, lv: p.lv, d: p.d,
      children: []
    };
  }

  // 递归建树：layer = 距离 era 根的第几层（1 起）
  function buildNode(list, layer, genre, eraIdx, seq) {
    var kids = list.filter(valid);
    if (!kids.length) return [];
    if (kids.length <= LEAF_CAP || layer >= MAX_DEPTH) {
      return kids.map(function (p, i) {
        return leafNode(p, genre + "_e" + eraIdx + "_" + seq + "_" + i, null);
      });
    }
    var anchors = pickAnchors(kids, GROUP_CAP);
    var groups = anchors.map(function (a) { return { a: a, kids: [] }; });
    kids.forEach(function (p) {
      if (anchors.indexOf(p) >= 0) return;
      var bi = 0, bd = Infinity;
      for (var i = 0; i < groups.length; i++) {
        var d = dist(p, groups[i].a);
        if (d < bd) { bd = d; bi = i; }
      }
      groups[bi].kids.push(p);
    });
    var out = [];
    groups.forEach(function (g, gi) {
      var a = g.a;
      var sub = g.kids.slice().sort(function (p, q) { return w(q) - w(p); });
      var children = buildNode(sub, layer + 1, genre, eraIdx, seq + "_g" + gi);
      var cnt = children.length;
      var head = descOf(a);
      out.push({
        id: genre + "_e" + eraIdx + "_" + seq + "_g" + gi,
        n: a.n,
        t: CAT_T[a.cat] || "city",
        x: +a.x || 50, y: +a.y || 50,
        desc: head || (a.n + " · 原著区域"),
        c: a.c || "",
        cat: a.cat, lv: a.lv, d: a.d,
        cnt: cnt,
        children: children
      });
    });
    return out;
  }

  function buildTree(era, eraIdx, genre) {
    var raw = (era.places || []).filter(valid).filter(function (p) {
      // 与时代同名的条目（「人界」时代里的「人界」）是范围说明，不是可下钻的地点，剃掉避免自我嵌套
      return !(era.name && (p.n === era.name || (p.cat === "region" && era.name.indexOf(p.n) === 0 && p.n.length >= era.name.length)));
    });
    // 同名去重：保留信息量最大的一条
    var at = {}, uniq = [];
    raw.forEach(function (p) {
      var i = at[p.n];
      if (i == null) { at[p.n] = uniq.length; uniq.push(p); }
      else if (w(p) > w(uniq[i])) uniq[i] = p;
    });
    return buildNode(uniq, 1, genre, eraIdx, "r");
  }

  // 统计整棵树的层数（用于界面显示「第 N 级 / 共 M 级」）
  function depthOf(nodes, cur) {
    var max = cur;
    (nodes || []).forEach(function (n) {
      if (n.children && n.children.length) max = Math.max(max, depthOf(n.children, cur + 1));
    });
    return max;
  }

  // 为某 genre 生成完整 eras 树；若原生 ATLAS_DRILL 已有该世界精细树则不覆盖（斗罗）
  function ensure(genre) {
    var V = window.ATLAS_VERIFIED;
    if (!V || !V[genre]) return false;
    var native = window.ATLAS_DRILL;
    if (genre === "douluodalu" && native && native.genre === "douluodalu") return false;
    var eras = (V[genre].eras || []).map(function (era, i) {
      var children = buildTree(era, i, genre);
      return {
        id: era.id || (genre + "_e" + i),
        name: era.name || ("时代" + (i + 1)),
        ico: "舆",
        era: era.era || "",
        hint: V[genre].note || ("原著地点按方位校对 · " + (V[genre].source || "")),
        // 斗罗用原生精细底图；玩家 DLC 回退通用壁纸；其余世界用各自专属壁纸底图
        art: genre === "douluodalu" ? "douluodalu__dou1" : (V[genre] && V[genre].dlc ? "freeworld" : genre),
        children: children,
        depth: depthOf(children, 1)
      };
    });
    if (!native) { window.ATLAS_DRILL = { genre: genre, name: (V[genre].name || genre), eras: eras }; }
    else {
      if (!native.__nativeDouluo && native.genre === "douluodalu") native.__nativeDouluo = { genre: native.genre, name: native.name, eras: native.eras };
      if (genre === "douluodalu" && native.__nativeDouluo) {
        native.genre = native.__nativeDouluo.genre;
        native.name = native.__nativeDouluo.name;
        native.eras = native.__nativeDouluo.eras;
      } else {
        native.genre = genre;
        native.name = V[genre].name || genre;
        native.eras = eras;
      }
    }
    return true;
  }

  /* 校对数据 1.19MB，按需加载：懒加载器按文件名取；没有懒加载器（独立页）就直接插 script。
     注意不能给数据对象挂懒加载器的「函数桩」——桩对所有属性都返回真，适配层会读出一棵空树。 */
  var dataP = null;
  function loadData(cb) {
    function ready() {
      return !!(window.ATLAS_VERIFIED && Object.keys(window.ATLAS_VERIFIED).length);
    }
    if (ready()) { cb(); return; }
    if (dataP) { dataP.then(cb, cb); return; }
    dataP = new Promise(function (resolve) {
      var done = function () { resolve(true); };
      try {
        if (window.YJLazy && window.YJLazy.ensure) {
          window.YJLazy.ensure("atlas-verified-all").then(done, done);
          return;
        }
        var sc = document.createElement("script");
        sc.src = "js/atlas-verified-all.js" + (window.YJ_ASSET_V || "");
        sc.onload = done; sc.onerror = done;
        document.body.appendChild(sc);
      } catch (e) { resolve(false); }
    });
    dataP.then(cb, cb);
  }

  function invalidate() {
    var native = window.ATLAS_DRILL;
    if (native) { native.genre = null; native.eras = native.eras || []; }
  }

  window.AtlasVerifiedAdapter = {
    ensure: ensure, buildTree: buildTree, invalidate: invalidate, loadData: loadData,
    depthOf: depthOf, version: "6.7.0"
  };
})();
