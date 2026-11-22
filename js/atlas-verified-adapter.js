/* 云境 v6.2.0 · 校对数据适配层（AtlasVerifiedAdapter）
 * 作用：把 38 世界校对数据 window.ATLAS_VERIFIED[genre] 转成深度舆图所需的 ATLAS_DRILL 树结构，
 *       让每个世界都能用「五线深度舆图」按原著方位展示校对过的地点。
 * 策略：era.places(扁平) 按 rg 聚合成 L1 区域节点，地点作 L2 叶子；x/y 直接采用校对方位坐标。
 * 零侵入：不改 atlas-drilldown.js / atlas-drill-data.js；仅在 show() 前把生成树挂到 ATLAS_DRILL.eras。
 * 回滚：删本文件 + 页面引用即恢复；斗罗仍优先用原生精细树（有 children 的走原生）。
 */
(function () {
  "use strict";
  if (window.AtlasVerifiedAdapter) return;

  var CAT_GLYPH = { country: "▣", faction: "⚔", sect: "⚑", region: "❋", place: "✦" };
  var CAT_T = { country: "city", faction: "sect", sect: "sect", region: "wild", place: "city" };

  function esc(s) { return String(s == null ? "" : s); }

  // 把一个 era 的扁平 places 转成 drill 的 children 树
  // 用坐标网格聚类（4×4）：L0 最多 16 个区域节点，地点作 L1 叶子——保证 L0 清爽、方位天然正确。
  // 智能体的 rg 字段粒度不一（有的填 43 种），不能直接当分组键。
  function buildTree(era, eraIdx, genre) {
    var GRID = 4; // 4×4 网格
    var groups = {};
    (era.places || []).forEach(function (p) {
      var x = Math.max(0, Math.min(99, +p.x || 50));
      var y = Math.max(0, Math.min(99, +p.y || 50));
      var gx = Math.floor(x / (100 / GRID));
      var gy = Math.floor(y / (100 / GRID));
      var key = gy + "_" + gx;
      (groups[key] = groups[key] || []).push(p);
    });
    // 区域命名：按方位（北/中/南 × 西/中/东）
    var ROW = ["北", "中北", "中南", "南"];
    var COL = ["西", "中", "中", "东"];
    var keys = Object.keys(groups).sort();
    return keys.map(function (key, gi) {
      var parts = key.split("_");
      var gy = +parts[0], gx = +parts[1];
      var items = groups[key];
      var ax = 0, ay = 0;
      items.forEach(function (p) { ax += (+p.x || 50); ay += (+p.y || 50); });
      ax = +(ax / items.length).toFixed(1);
      ay = +(ay / items.length).toFixed(1);
      var areaName = (ROW[gy] || "") + "部" + (COL[gx] || "") + "域";
      var kids = items.map(function (p, pi) {
        var glyph = CAT_GLYPH[p.cat] || "✦";
        return {
          id: genre + "_e" + eraIdx + "_g" + gi + "_p" + pi,
          n: glyph + " " + p.n,
          t: CAT_T[p.cat] || "city",
          x: +p.x || 50, y: +p.y || 50,
          desc: (p.where ? "【方位】" + p.where + "\n" : "") + (p.c ? "【出处】" + p.c : ""),
          c: p.c || "",
          cat: p.cat, lv: p.lv, d: p.d,
          children: []
        };
      });
      return {
        id: genre + "_e" + eraIdx + "_g" + gi,
        n: areaName, t: "city", x: ax, y: ay,
        desc: areaName + " · 含 " + kids.length + " 处原著地点（点击下钻查看）",
        c: "原著地点按方位网格聚合",
        children: kids
      };
    });
  }

  // 为某 genre 生成完整 eras 树；若原生 ATLAS_DRILL 已有该世界精细树则不覆盖（斗罗）
  function ensure(genre) {
    var V = window.ATLAS_VERIFIED;
    if (!V || !V[genre]) return false;
    var native = window.ATLAS_DRILL;
    // 斗罗有原生精细父子树，交给原生
    if (genre === "douluodalu" && native && native.genre === "douluodalu") return false;
    var eras = (V[genre].eras || []).map(function (era, i) {
      return {
        id: era.id || (genre + "_e" + i),
        name: era.name || ("时代" + (i + 1)),
        ico: "舆",
        era: era.era || "",
        hint: V[genre].note || ("原著地点按方位校对 · " + (V[genre].source || "")),
        // 斗罗用原生精细底图；玩家 DLC 回退通用壁纸；其余世界用各自专属壁纸底图
        art: genre === "douluodalu" ? "douluodalu__dou1" : (V[genre] && V[genre].dlc ? "freeworld" : genre),
        children: buildTree(era, i, genre)
      };
    });
    // 挂到 ATLAS_DRILL：其它世界替换 eras，genre 记当前
    if (!native) { window.ATLAS_DRILL = { genre: genre, name: (V[genre].name || genre), eras: eras }; }
    else {
      // 保存斗罗原生树，避免被覆盖
      if (!native.__nativeDouluo && native.genre === "douluodalu") native.__nativeDouluo = { genre: native.genre, name: native.name, eras: native.eras };
      if (genre === "douluodalu" && native.__nativeDouluo) {
        native.genre = native.__nativeDouluo.genre;
        native.name = native.__nativeDouluo.name;
        native.eras = native.__nativeDouluo.eras;
      } else {
        native.genre = genre;
        native.name = V[genre].name || genre; // 标题按世界名动态显示
        native.eras = eras;
      }
    }
    return true;
  }

  // v6.3：玩家数据层合并写回后调用，清掉可能的世界树残留（斗罗 __nativeDouluo 快照保留）
  function invalidate() {
    var native = window.ATLAS_DRILL;
    if (native) { native.genre = null; native.eras = native.eras || []; }
  }

  window.AtlasVerifiedAdapter = { ensure: ensure, buildTree: buildTree, invalidate: invalidate, version: "6.3.0" };
})();
