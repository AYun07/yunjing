/* 云境 v6.3.0 · 世界舆图资料库（AtlasLibrary）
 * 全屏 overlay：38 内置世界 + 玩家新建 DLC 世界的卡片墙；逐世界地点对照表（方位/坐标/层级/出处）。
 * 玩家可：补充地点 / 优化已有地点 / 删除地点 / 新建大世界 / 导入导出 / 重置 / 跳深度舆图。
 * 数据全部经 AtlasUserData 覆盖层，内置数据只读。
 * 零侵入：独立 overlay + 两行引用；工具箱加一个入口。
 */
(function () {
  "use strict";
  if (window.AtlasLibrary) return;

  var OVERLAY_ID = "atlasLibraryOverlay";
  var CAT = { country: ["国家", "#e8c96a"], faction: ["大型势力", "#e07a9c"], sect: ["宗门", "#6fc9b8"], region: ["地区", "#8fbf7a"], place: ["地点", "#d8cbb0"] };
  var LVN = ["L0·时代大图", "L1·区域", "L2·地点", "L3·子区域", "L4·场景"];
  var current = null; // 当前查看的 genre
  var fileInput = null;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }
  function U() { return window.AtlasUserData; }
  function V() { return window.ATLAS_VERIFIED || {}; }
  function art(worldId) {
    // 玩家自建 DLC 世界没有专属底图，回退到通用壁纸，避免 404
    var d = V()[worldId];
    var id = (d && d.dlc) ? "freeworld" : worldId;
    return "assets/map-art/" + id + ".webp";
  }

  function toast(msg, kind) { try { window.showToast && window.showToast(msg, kind || "info"); } catch (e) {} }

  function ensureOverlay() {
    var host = document.getElementById(OVERLAY_ID);
    if (host) return host;
    host = document.createElement("div");
    host.id = OVERLAY_ID;
    host.innerHTML = '<div class="al-wrap" id="alRoot"></div>' +
      '<div id="alEditModal"></div>';
    document.body.appendChild(host);
    return host;
  }

  function worldList() {
    var V0 = V();
    return Object.keys(V0).sort(function (a, b) {
      var da = V0[a].dlc ? 1 : 0, db = V0[b].dlc ? 1 : 0;
      if (da !== db) return da - db; // 内置在前，玩家 DLC 在后
      var pa = (V0[a].eras || []).reduce(function (s, e) { return s + (e.places || []).length; }, 0);
      var pb = (V0[b].eras || []).reduce(function (s, e) { return s + (e.places || []).length; }, 0);
      return pb - pa;
    });
  }

  function renderOverview() {
    current = null;
    var root = document.getElementById("alRoot");
    var V0 = V();
    var list = worldList();
    var builtin = list.filter(function (g) { return !V0[g].dlc; }).length;
    var dlc = list.length - builtin;
    var st = U().stats();
    var cards = list.map(function (g) {
      var d = V0[g];
      var total = (d.eras || []).reduce(function (s, e) { return s + (e.places || []).length; }, 0);
      var dlcTag = d.dlc ? '<span class="al-dlctag">DLC</span>' : "";
      return '<div class="al-card' + (d.dlc ? " dlc" : "") + '" onclick="AtlasLibrary.openWorld(\'' + esc(g) + '\')">' +
        '<div class="al-thumb" style="background-image:url(\'' + art(g) + '\')"></div>' +
        '<div class="al-cinfo"><b>' + esc(d.name || g) + dlcTag + '</b><span>' + (d.eras || []).length + ' 时代 · ' + total + ' 地点</span></div></div>';
    }).join("");

    root.innerHTML =
      '<h1>世界舆图 · 资料库</h1>' +
      '<div class="al-sub">云境 v6.3.0 · 内置 ' + builtin + ' 世界' + (dlc ? ' · 玩家 DLC ' + dlc + ' 世界' : '') + ' · 逐地点标注类别 / 原著方位 / 坐标 / 层级 / 出处 · 玩家可持续补充优化</div>' +
      '<div class="al-bar">' +
        '<button class="al-btn primary" onclick="AtlasLibrary.newWorld()">＋ 新建大世界（DLC）</button>' +
        '<button class="al-btn" onclick="AtlasLibrary.exportData()">⇩ 导出玩家数据</button>' +
        '<button class="al-btn" onclick="AtlasLibrary.importData()">⇧ 导入数据</button>' +
        '<button class="al-btn danger" onclick="AtlasLibrary.resetData()">↺ 重置</button>' +
        '<span class="al-spacer"></span>' +
        '<span class="al-stat">已补充 ' + st.adds + ' · 已优化 ' + st.edits + ' · 自建世界 ' + st.worlds + '</span>' +
        '<button class="al-btn" onclick="AtlasLibrary.close()">✕ 返回云境</button>' +
      '</div>' +
      '<div class="al-tip"><b style="color:#9fd8c0">用法：</b>点世界卡片查看逐地点对照。每个地点可「优化」方位/坐标/层级或「删除」；也能「＋补充地点」；内置世界之上叠加你的修改，新建的大世界与内置 38 界并列，还能直接进深度舆图查看。所有玩家数据存在本机，可随时导出备份。</div>' +
      '<div class="al-sec-title">' + (builtin + dlc) + ' 世界一览（点击查看详情）</div>' +
      '<div class="al-grid">' + cards + '</div>';
  }

  function openWorld(g) {
    var d = V()[g];
    if (!d) { toast("世界不存在", "error"); return; }
    current = g;
    var root = document.getElementById("alRoot");
    var total = (d.eras || []).reduce(function (s, e) { return s + (e.places || []).length; }, 0);
    var isDlc = !!d.dlc;

    var eraBlocks = (d.eras || []).map(function (e, ei) {
      var eraId = e.id || (g + "_e" + ei);
      var rows = (e.places || []).map(function (p, pi) {
        var c = CAT[p.cat] || ["?", "#ccc"];
        var usr = U().isUserPlace(g, eraId, p.n) ? '<span class="al-usr">已改</span>' : "";
        return '<tr>' +
          '<td class="al-nm">' + esc(p.n) + usr + '</td>' +
          '<td><span class="al-cat" style="--c:' + c[1] + '">' + c[0] + '</span></td>' +
          '<td class="al-where">' + esc(p.where || "") + '</td>' +
          '<td class="al-xy">' + esc(p.x) + ',' + esc(p.y) + '</td>' +
          '<td class="al-lv">' + (LVN[p.lv] || ("L" + p.lv)) + '</td>' +
          '<td class="al-src">' + esc(p.c || "") + '</td>' +
          '<td class="al-ops">' +
            '<button class="al-btn mini" onclick="AtlasLibrary.editPlace(\'' + esc(g) + '\',\'' + esc(eraId) + '\',' + pi + ')">优化</button> ' +
            '<button class="al-btn mini danger" onclick="AtlasLibrary.delPlace(\'' + esc(g) + '\',\'' + esc(eraId) + '\',\'' + esc(p.n).replace(/'/g, "\\'") + '\')">删</button>' +
          '</td></tr>';
      }).join("");
      return '<div class="al-era"><h3>' + esc(e.name || ("时代" + (ei + 1))) + ' <small>' + (e.places || []).length + ' 地点</small></h3>' +
        '<table><thead><tr><th>地点</th><th>类别</th><th>原著方位</th><th>坐标 x,y</th><th>层级</th><th>出处</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    }).join("");

    root.innerHTML =
      '<div class="al-bar">' +
        '<button class="al-btn" onclick="AtlasLibrary.renderOverview()">◧ 返回世界一览</button>' +
        '<button class="al-btn primary" onclick="AtlasLibrary.addPlace(\'' + esc(g) + '\')">＋ 补充地点</button>' +
        '<button class="al-btn" onclick="AtlasLibrary.viewAtlas(\'' + esc(g) + '\')">✦ 在深度舆图中查看</button>' +
        (isDlc ? '<button class="al-btn danger" onclick="AtlasLibrary.removeDlc(\'' + esc(g) + '\')">删除此 DLC 世界</button>' : '') +
        '<span class="al-spacer"></span>' +
        '<button class="al-btn" onclick="AtlasLibrary.close()">✕ 返回云境</button>' +
      '</div>' +
      '<div class="al-detail">' +
        '<h2>' + esc(d.name || g) + (isDlc ? '<span class="al-dlctag">DLC</span>' : '') + '</h2>' +
        '<div class="al-meta">出处：' + esc(d.source || "") + '　|　' + (d.eras || []).length + ' 时代/位面 · ' + total + ' 地点</div>' +
        '<div class="al-note">' + esc(d.note || "") + '</div>' +
        (eraBlocks || '<div class="al-empty">此世界暂无地点，点「＋补充地点」开始</div>') +
      '</div>';
  }

  // ---------- 编辑弹窗 ----------
  function placeForm(g, eraId, place, pi) {
    var isEdit = place != null;
    var p = place || { n: "", cat: "place", rg: "", x: 50, y: 50, lv: 2, where: "", c: "" };
    var cats = U().CATS.map(function (k) {
      return '<option value="' + k + '"' + (p.cat === k ? " selected" : "") + '>' + U().CAT_LABEL[k] + '</option>';
    }).join("");
    var lvs = LVN.map(function (n, i) { return '<option value="' + i + '"' + (Number(p.lv) === i ? " selected" : "") + '>' + n + '</option>'; }).join("");
    var modal = document.getElementById("alEditModal");
    modal.innerHTML = '<div class="al-modal"><h3>' + (isEdit ? "优化地点" : "补充地点") + '</h3>' +
      '<label for="alF_n">地点名称 *</label><input id="alF_n" value="' + esc(p.n) + '" placeholder="如：史莱克学院">' +
      '<div class="al-row"><div><label>类别</label><select id="alF_cat">' + cats + '</select></div>' +
      '<div><label>层级</label><select id="alF_lv">' + lvs + '</select></div></div>' +
      '<label for="alF_rg">所属区域（可选）</label><input id="alF_rg" value="' + esc(p.rg || "") + '" placeholder="如：天斗帝国">' +
      '<div class="al-row"><div><label for="alF_x">坐标 X（0-100，左西右东）</label><input id="alF_x" type="number" min="0" max="100" value="' + esc(p.x) + '"></div>' +
      '<div><label for="alF_y">坐标 Y（0-100，上北下南）</label><input id="alF_y" type="number" min="0" max="100" value="' + esc(p.y) + '"></div></div>' +
      '<label>原著方位描述</label><textarea id="alF_where" placeholder="原著里这个地点在哪、与谁相邻…">' + esc(p.where || "") + '</textarea>' +
      '<label for="alF_c">出处</label><input id="alF_c" value="' + esc(p.c || "") + '" placeholder="如：《斗罗大陆》第一部·第X章">' +
      '<div class="al-hint">坐标决定地图落点，层级决定它出现在哪级地图；类别影响地标颜色。带 * 为必填。</div>' +
      '<div class="al-mfoot"><button class="al-btn" onclick="AtlasLibrary.closeModal()">取消</button>' +
      '<button class="al-btn primary" onclick="AtlasLibrary.savePlace(\'' + esc(g) + '\',\'' + esc(eraId) + '\',' + (isEdit ? pi : -1) + ',' + (isEdit ? 'true' : 'false') + ')">保存</button></div>' +
      '</div>';
    modal.classList.add("al-open");
  }

  function collectForm() {
    return {
      n: document.getElementById("alF_n").value.trim(),
      cat: document.getElementById("alF_cat").value,
      lv: Number(document.getElementById("alF_lv").value),
      rg: document.getElementById("alF_rg").value.trim(),
      x: Number(document.getElementById("alF_x").value),
      y: Number(document.getElementById("alF_y").value),
      where: document.getElementById("alF_where").value.trim(),
      c: document.getElementById("alF_c").value.trim()
    };
  }

  function editPlace(g, eraId, pi) {
    var d = V()[g];
    var e = null;
    (d.eras || []).some(function (x, i) { var id = x.id || (g + "_e" + i); if (String(id) === String(eraId)) { e = x; return true; } return false; });
    if (!e || !e.places[pi]) { toast("地点不存在", "error"); return; }
    placeForm(g, eraId, e.places[pi], pi);
  }

  function savePlace(g, eraId, pi, isEdit) {
    var f = collectForm();
    var r;
    if (isEdit && pi >= 0) {
      // 取出原始名称作为匹配键（用户可能改了名字）
      var d = V()[g], e = null;
      (d.eras || []).some(function (x, i) { var id = x.id || (g + "_e" + i); if (String(id) === String(eraId)) { e = x; return true; } return false; });
      var match = (e && e.places[pi]) ? e.places[pi].n : f.n;
      r = U().editPlace(g, eraId, match, f);
    } else {
      r = U().addPlace(g, eraId, f);
    }
    closeModal();
    toast(r.msg, r.ok ? "success" : "error");
    if (r.ok) openWorld(g);
  }

  function delPlace(g, eraId, name) {
    if (!confirm("确定删除地点「" + name + "」？（仅移除你本机的这一条，不影响内置数据）")) return;
    var r = U().delPlace(g, eraId, name);
    toast(r.msg, r.ok ? "success" : "error");
    if (r.ok) openWorld(g);
  }

  // ---------- 新建 DLC 世界 ----------
  function newWorld() {
    var modal = document.getElementById("alEditModal");
    modal.innerHTML = '<div class="al-modal"><h3>新建大世界（DLC）</h3>' +
      '<label for="alW_name">世界名称 *</label><input id="alW_name" placeholder="如：我的玄幻大陆">' +
      '<label for="alW_genre">世界 id（英文/数字，留空自动生成）</label><input id="alW_genre" placeholder="如：myworld">' +
      '<label for="alW_source">资料来源</label><input id="alW_source" value="玩家自建 DLC">' +
      '<label>世界观简介</label><textarea id="alW_note" placeholder="这个世界的地理与势力格局…"></textarea>' +
      '<label for="alW_era">首个时代名称</label><input id="alW_era" value="创世纪元">' +
      '<div class="al-hint">先建好世界框架与第一个时代，进入后即可逐条补充地点。新世界会出现在世界一览里，可直接进深度舆图。</div>' +
      '<div class="al-mfoot"><button class="al-btn" onclick="AtlasLibrary.closeModal()">取消</button>' +
      '<button class="al-btn primary" onclick="AtlasLibrary.saveWorld()">创建世界</button></div></div>';
    modal.classList.add("al-open");
  }

  function saveWorld() {
    var name = document.getElementById("alW_name").value.trim();
    var genre = document.getElementById("alW_genre").value.trim();
    var source = document.getElementById("alW_source").value.trim();
    var note = document.getElementById("alW_note").value.trim();
    var eraName = document.getElementById("alW_era").value.trim() || "创世纪元";
    var r = U().addWorld({
      genre: genre, name: name, source: source, note: note,
      eras: [{ id: "user_e0", name: eraName, era: "", places: [] }]
    });
    closeModal();
    toast(r.msg, r.ok ? "success" : "error");
    if (r.ok) openWorld(r.genre);
  }

  function removeDlc(g) {
    if (!confirm("确定删除这个玩家自建世界？此操作不可撤销。")) return;
    var r = U().removeWorld(g);
    toast(r.msg, r.ok ? "success" : "error");
    if (r.ok) renderOverview();
  }

  // ---------- 导入导出 / 重置 ----------
  function exportData() {
    var json = U().exportJSON();
    try {
      var blob = new Blob([json], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "云境-世界舆图-玩家数据-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
      toast("玩家数据已导出", "success");
    } catch (e) { toast("导出失败：" + e.message, "error"); }
  }
  function importData() {
    if (!fileInput) {
      fileInput = document.createElement("input");
      fileInput.type = "file"; fileInput.accept = ".json,application/json";
      fileInput.style.display = "none";
      document.body.appendChild(fileInput);
      fileInput.addEventListener("change", function () {
        var f = fileInput.files && fileInput.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function () {
          var r = U().importJSON(String(reader.result));
          toast(r.msg, r.ok ? "success" : "error");
          if (r.ok) { U().apply(); renderOverview(); }
        };
        reader.readAsText(f);
        fileInput.value = "";
      });
    }
    fileInput.click();
  }
  function resetData() {
    if (!confirm("确定重置所有玩家补充数据？内置 38 世界不受影响，但你补充的地点和优化将全部清除。")) return;
    var r = U().reset();
    toast(r.msg, r.ok ? "success" : "error");
    if (r.ok) renderOverview();
  }

  // ---------- 跳深度舆图 ----------
  function viewAtlas(g) {
    // 先确保玩家数据已合并生效，再让适配层按该世界切树
    U().apply();
    close();
    try {
      if (window.AtlasDrill && window.AtlasDrill.show) {
        window.AtlasDrill.show(g);
      } else {
        toast("深度舆图模块未就绪，请刷新页面", "error");
      }
    } catch (e) { toast("打开舆图失败：" + e.message, "error"); }
  }

  function closeModal() { document.getElementById("alEditModal").classList.remove("al-open"); }

  /* v6.7.0：38 世界校对数据改为按需加载，打开资料库时先把数据等到位，再渲染 */
  function open() {
    if (window.AtlasVerifiedAdapter && window.AtlasVerifiedAdapter.loadData) {
      window.AtlasVerifiedAdapter.loadData(openNow);
      return;
    }
    openNow();
  }

  function openNow() {
    var host = ensureOverlay();
    if (!window.AtlasUserData) { toast("玩家数据层未就绪，请刷新页面", "error"); return; }
    // 打开前把玩家数据合并写回，保证资料库与舆图看到同一份
    U().apply();
    host.classList.add("al-open");
    renderOverview();
  }
  function close() {
    var host = document.getElementById(OVERLAY_ID);
    if (host) host.classList.remove("al-open");
    closeModal();
  }

  window.AtlasLibrary = {
    open: open, close: close, renderOverview: renderOverview,
    openWorld: openWorld, editPlace: editPlace, savePlace: savePlace, delPlace: delPlace,
    addPlace: function (g) {
      var d = V()[g]; if (!d) return;
      var eraId = (d.eras && d.eras[0] && d.eras[0].id) || (g + "_e0");
      placeForm(g, eraId, null, -1);
    },
    newWorld: newWorld, saveWorld: saveWorld, removeDlc: removeDlc,
    exportData: exportData, importData: importData, resetData: resetData,
    viewAtlas: viewAtlas, closeModal: closeModal,
    version: "6.3.0"
  };
})();
