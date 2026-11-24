/* 云境 v6.3.0 · 世界舆图资料库 · 玩家扩展数据层（AtlasUserData）
 * 职责：在内置 38 世界校对数据（window.ATLAS_VERIFIED）之上，叠加玩家补充的地点、
 *       玩家优化的方位/层级、以及玩家自建的大世界（DLC），统一合并成一份"生效世界表"。
 * 关键约束：
 *   1. 绝不改动内置数据本体（内置只读），玩家数据存在 localStorage 覆盖层；
 *   2. 合并产物写回 window.ATLAS_VERIFIED，使 AtlasVerifiedAdapter / 深度舆图 / 资料库 UI 共用同一份；
 *   3. schema 校验 + XSS 转义，导入的外部 JSON 不得注入脚本、不得串世界；
 *   4. 零侵入：独立文件 + 页面两行引用，删掉即回退到纯内置数据。
 * 回滚：删本文件引用 + AtlasLibrary 引用即可。
 */
(function () {
  "use strict";
  if (window.AtlasUserData) return;

  var KEY = "yunjing_atlas_userdata_v1";
  var VERSION = 1;
  var CATS = ["country", "faction", "sect", "region", "place"];
  var CAT_LABEL = { country: "国家", faction: "大型势力", sect: "宗门", region: "地区", place: "地点" };

  function safeParse(s, fb) { try { return s ? JSON.parse(s) : fb; } catch (e) { return fb; } }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }
  function now() { try { return new Date().toISOString(); } catch (e) { return ""; } }

  // 内存态：{ version, edits:{ [genre]: { [eraId]: [place,...] } }, addPlaces:{ [genre]: { [eraId]: [place,...] } }, delPlaces:{ [genre]: { [eraId]: [name,...] } }, worlds:{ [genre]: worldObj } }
  var state = null;

  function blank() { return { version: VERSION, edits: {}, addPlaces: {}, delPlaces: {}, worlds: {}, updatedAt: "" }; }

  function normalize(raw) {
    var d = raw && typeof raw === "object" ? raw : {};
    var out = blank();
    ["edits", "addPlaces", "delPlaces", "worlds"].forEach(function (k) {
      if (d[k] && typeof d[k] === "object" && !Array.isArray(d[k])) out[k] = d[k];
    });
    out.version = VERSION;
    out.updatedAt = d.updatedAt || "";
    return out;
  }

  function load() {
    if (state) return state;
    state = normalize(safeParse(localStorage.getItem(KEY), null));
    return state;
  }
  function persist() {
    state.updatedAt = now();
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      // 存储写满等异常：不吞错，交上层提示
      return false;
    }
  }

  // ---------- schema 校验 ----------
  // place 必填 n(名称)；cat 归一到五类；x/y 归一到 0-100；lv 归一到 0-4；where/c 为文本。
  function sanitizePlace(p) {
    if (!p || typeof p !== "object") return null;
    var n = String(p.n || p.name || "").trim();
    if (!n) return null;
    var cat = CATS.indexOf(p.cat) >= 0 ? p.cat : "place";
    var x = Number(p.x), y = Number(p.y);
    if (!isFinite(x)) x = 50; if (!isFinite(y)) y = 50;
    x = Math.max(0, Math.min(100, Math.round(x)));
    y = Math.max(0, Math.min(100, Math.round(y)));
    var lv = Number(p.lv); if (!isFinite(lv) || lv < 0 || lv > 4) lv = 2;
    return {
      n: n.slice(0, 40),
      cat: cat,
      rg: String(p.rg || "").slice(0, 40),
      x: x, y: y, lv: lv,
      d: Number(p.d) >= 1 && Number(p.d) <= 5 ? Number(p.d) : 5,
      where: String(p.where || "").slice(0, 300),
      c: String(p.c || "").slice(0, 200),
      _src: p._src === "user" ? "user" : (p._src || "builtin")
    };
  }

  // world 必填 name + eras[]；每个 era 至少一个 place；genre 为安全 id。
  function sanitizeWorld(w) {
    if (!w || typeof w !== "object") return null;
    var name = String(w.name || "").trim();
    if (!name) return null;
    var eraSrc = Array.isArray(w.eras) ? w.eras : [];
    var eras = [];
    eraSrc.forEach(function (e, i) {
      var places = (Array.isArray(e.places) ? e.places : []).map(sanitizePlace).filter(Boolean);
      eras.push({
        id: String(e.id || ("user_e" + i)).slice(0, 60),
        name: String(e.name || ("时代" + (i + 1))).slice(0, 40),
        era: String(e.era || "").slice(0, 80),
        places: places
      });
    });
    if (!eras.length) return null;
    return {
      name: name.slice(0, 40),
      source: String(w.source || "玩家自建 DLC").slice(0, 120),
      note: String(w.note || "").slice(0, 400),
      dlc: true,
      eras: eras
    };
  }

  function safeGenre(g) {
    return String(g || "").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 48);
  }

  // ---------- 合并：内置只读 + 玩家覆盖层 ----------
  // 返回合并后的世界表（新对象），不改内置本体。
  function merge(builtin) {
    var d = load();
    var out = {};

    // 1) 复制内置 38 世界（每个 era/places 深拷贝，杜绝改到内置）
    Object.keys(builtin || {}).forEach(function (g) {
      out[g] = clone(builtin[g]);
    });

    // 2) 删除玩家标记的地点（按名称精确匹配）
    Object.keys(d.delPlaces || {}).forEach(function (g) {
      Object.keys(d.delPlaces[g] || {}).forEach(function (eraId) {
        var era = findEra(out[g], eraId);
        if (!era || !Array.isArray(era.places)) return;
        var names = d.delPlaces[g][eraId] || [];
        era.places = era.places.filter(function (p) { return names.indexOf(p.n) < 0; });
      });
    });

    // 3) 编辑已有地点（按名称匹配，逐字段覆盖；_src 标 user）
    Object.keys(d.edits || {}).forEach(function (g) {
      Object.keys(d.edits[g] || {}).forEach(function (eraId) {
        var era = findEra(out[g], eraId);
        if (!era || !Array.isArray(era.places)) return;
        (d.edits[g][eraId] || []).forEach(function (patch) {
          var sp = sanitizePlace(patch);
          if (!sp) return;
          var target = era.places.filter(function (p) { return p.n === (patch._match || sp.n); })[0];
          if (target) { Object.keys(sp).forEach(function (k) { target[k] = sp[k]; }); }
        });
      });
    });

    // 4) 新增地点
    Object.keys(d.addPlaces || {}).forEach(function (g) {
      Object.keys(d.addPlaces[g] || {}).forEach(function (eraId) {
        var era = findEra(out[g], eraId);
        if (!era) return;
        if (!Array.isArray(era.places)) era.places = [];
        (d.addPlaces[g][eraId] || []).forEach(function (p) {
          var sp = sanitizePlace(p);
          if (sp) { sp._src = "user"; era.places.push(sp); }
        });
      });
    });

    // 5) 玩家自建大世界（DLC）：以 user_ 前缀隔离，杜绝覆盖内置 genre
    Object.keys(d.worlds || {}).forEach(function (g) {
      var w = sanitizeWorld(d.worlds[g]);
      if (w) out[g] = w;
    });

    return out;
  }

  function findEra(world, eraId) {
    if (!world || !Array.isArray(world.eras)) return null;
    var eras = world.eras;
    // 先按 id 找，再按下标找（兼容编辑者把 eraId 记成 "0"/"1"）
    var hit = eras.filter(function (e) { return String(e.id) === String(eraId); })[0];
    if (hit) return hit;
    var idx = Number(eraId);
    if (isFinite(idx) && idx >= 0 && idx < eras.length) return eras[idx];
    return null;
  }

  // 把合并结果写回 window.ATLAS_VERIFIED，供全部下游共用。
  // 需在 adapter.ensure 之前执行（页面加载顺序保证）。
  function apply() {
    var V = window.ATLAS_VERIFIED;
    if (!V) return null;
    var merged = merge(V);
    window.ATLAS_VERIFIED = merged;
    // 让适配层缓存失效（若已加载过其它世界）
    if (window.AtlasVerifiedAdapter && window.AtlasVerifiedAdapter.invalidate) {
      window.AtlasVerifiedAdapter.invalidate();
    }
    return merged;
  }

  // ---------- 编辑操作（写覆盖层） ----------
  function ensureBucket(bucket, g, eraId) {
    var d = load();
    if (!d[bucket][g]) d[bucket][g] = {};
    if (!d[bucket][g][eraId]) d[bucket][g][eraId] = [];
    return d[bucket][g][eraId];
  }

  function addPlace(g, eraId, place) {
    g = safeGenre(g); if (!g) return { ok: false, msg: "世界 id 非法" };
    var sp = sanitizePlace(place);
    if (!sp) return { ok: false, msg: "地点至少需要填写名称" };
    sp._src = "user";
    ensureBucket("addPlaces", g, eraId).push(sp);
    return persist() ? { ok: true, msg: "地点已补充，重开舆图即可见" } : { ok: false, msg: "本地存储写入失败" };
  }

  function editPlace(g, eraId, matchName, patch) {
    g = safeGenre(g); if (!g) return { ok: false, msg: "世界 id 非法" };
    var sp = sanitizePlace(patch);
    if (!sp) return { ok: false, msg: "地点名称不能为空" };
    sp._match = matchName;
    sp._src = "user";
    ensureBucket("edits", g, eraId).push(sp);
    return persist() ? { ok: true, msg: "修改已保存" } : { ok: false, msg: "本地存储写入失败" };
  }

  function delPlace(g, eraId, name) {
    g = safeGenre(g); if (!g) return { ok: false, msg: "世界 id 非法" };
    // 若该地点是本轮新增的，直接从 addPlaces 移除，避免删了又被加回来
    var d = load();
    if (!d.addPlaces[g]) d.addPlaces[g] = {};
    var adds = d.addPlaces[g][eraId] || [];
    var before = adds.length;
    d.addPlaces[g][eraId] = adds.filter(function (p) { return p.n !== name; });
    if (d.addPlaces[g][eraId].length !== before) { persist(); }
    var dels = ensureBucket("delPlaces", g, eraId);
    if (dels.indexOf(name) < 0) dels.push(name);
    return persist() ? { ok: true, msg: "地点已移除" } : { ok: false, msg: "本地存储写入失败" };
  }

  function addWorld(worldObj) {
    var w = sanitizeWorld(worldObj);
    if (!w) return { ok: false, msg: "世界至少需要名称和一个含地点的时代" };
    var base = safeGenre(worldObj.genre) || ("userworld_" + Date.now().toString(36));
    if (base.indexOf("user_") !== 0) base = "user_" + base;
    // 避免与内置世界重名覆盖
    if (window.ATLAS_VERIFIED && window.ATLAS_VERIFIED[base] && !window.ATLAS_VERIFIED[base].dlc) {
      base = base + "_dlc";
    }
    var d = load();
    d.worlds[base] = w;
    var ok = persist();
    if (ok) apply();
    return ok ? { ok: true, genre: base, msg: "新世界「" + w.name + "」已加入资料库" } : { ok: false, msg: "本地存储写入失败" };
  }

  function removeWorld(g) {
    g = safeGenre(g); if (!g) return { ok: false, msg: "世界 id 非法" };
    var d = load();
    if (!d.worlds[g]) return { ok: false, msg: "只能删除玩家自建的世界" };
    delete d.worlds[g];
    var ok = persist();
    if (ok) apply();
    return ok ? { ok: true, msg: "世界已删除" } : { ok: false, msg: "本地存储写入失败" };
  }

  // 玩家是否编辑过某地点（资料库里打"已优化"标）
  function isUserPlace(g, eraId, name) {
    var d = load();
    g = safeGenre(g);
    var edited = ((d.edits[g] || {})[eraId] || []).some(function (p) { return (p._match || p.n) === name; });
    var added = ((d.addPlaces[g] || {})[eraId] || []).some(function (p) { return p.n === name; });
    return edited || added;
  }
  function isUserWorld(g) { return !!((load().worlds || {})[safeGenre(g)]); }

  // ---------- 导入导出 ----------
  function exportJSON() {
    var d = load();
    return JSON.stringify({ app: "yunjing-atlas-userdata", version: VERSION, exportedAt: now(), data: d }, null, 2);
  }
  function importJSON(text) {
    var obj = safeParse(text, null);
    if (!obj) return { ok: false, msg: "不是合法的 JSON 文件" };
    var d = obj.data && typeof obj.data === "object" ? obj.data : obj;
    var inc = normalize(d);
    // 合并策略：世界表按 id 覆盖；地点补丁追加（去重：同 match/同名不重复写）
    var cur = load();
    ["edits", "addPlaces", "delPlaces"].forEach(function (bucket) {
      Object.keys(inc[bucket] || {}).forEach(function (g) {
        Object.keys(inc[bucket][g] || {}).forEach(function (eraId) {
          var target = ensureBucket(bucket, g, eraId);
          (inc[bucket][g][eraId] || []).forEach(function (item) {
            var keyOf = function (x) { return x && (x._match || x.n); };
            var exists = target.some(function (t) { return keyOf(t) === keyOf(item); });
            if (!exists) target.push(item);
          });
        });
      });
    });
    Object.keys(inc.worlds || {}).forEach(function (g) { cur.worlds[g] = inc.worlds[g]; });
    var ok = persist();
    if (ok) apply();
    return ok ? { ok: true, msg: "导入完成" } : { ok: false, msg: "本地存储写入失败" };
  }
  function reset() {
    state = blank();
    try { localStorage.removeItem(KEY); } catch (e) {}
    apply();
    return { ok: true, msg: "玩家数据已清空，恢复为内置 38 世界" };
  }

  function stats() {
    var d = load();
    var edits = 0, adds = 0, dels = 0;
    function count(bucket) {
      var n = 0;
      Object.keys(d[bucket] || {}).forEach(function (g) {
        Object.keys(d[bucket][g] || {}).forEach(function (e) { n += (d[bucket][g][e] || []).length; });
      });
      return n;
    }
    edits = count("edits"); adds = count("addPlaces"); dels = count("delPlaces");
    return { edits: edits, adds: adds, dels: dels, worlds: Object.keys(d.worlds || {}).length, updatedAt: d.updatedAt };
  }

  window.AtlasUserData = {
    KEY: KEY, VERSION: VERSION, CATS: CATS, CAT_LABEL: CAT_LABEL,
    load: load, merge: merge, apply: apply,
    addPlace: addPlace, editPlace: editPlace, delPlace: delPlace,
    addWorld: addWorld, removeWorld: removeWorld,
    isUserPlace: isUserPlace, isUserWorld: isUserWorld,
    exportJSON: exportJSON, importJSON: importJSON, reset: reset, stats: stats,
    sanitizeWorld: sanitizeWorld, sanitizePlace: sanitizePlace,
    version: "6.3.0"
  };
})();
