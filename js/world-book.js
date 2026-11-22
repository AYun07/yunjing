/* =========================================================================
 * 云境 · 本界资料库（v3.55.21 · 世界动态性的另一支柱）
 * -------------------------------------------------------------------------
 * 用户诉求：对应世界的「世界书」条目若有缺失或不够，要能补；或者干脆每个
 *          世界都装配一个属于自己的资料库。
 *
 * 做法：
 *   · 每个世界（按 genreKey 隔离）一份 lore 库，落 localStorage（MoStore 兜底）。
 *   · 内置主流世界的种子词条（只写公认的设定级事实，绝不臆造人名与细节），
 *     其余世界给空库 + 一键「从当前故事抽取」，所以「每个世界都有自己的资料库」。
 *   · 玩家 / 编辑可随时增补缺失条目（小云模块面板或剧情上下文里点开）。
 *   · 关键时把相关词条注入主笔提示词，提升设定一致性、减少 AI 前后矛盾。
 *
 * 类别：人物 / 势力 / 机缘 / 地理 / 设定 / 事件
 * ========================================================================= */
(function () {
  "use strict";

  var PREFIX = "yunjingWorldBook:";
  /* v3.83.0 升版：种子库外置为 js/worldbook-seeds.js（29 界 418 条，原著公认设定级还原；
     earth 为真实地球多维条目；freeworld 为「让世界活过来」条目）。老档打开也会自动补落新条目。 */
  var SEED_FLAG = "yunjingWorldBookSeeded:v3:";
  var CATS = ["人物", "势力", "机缘", "地理", "设定", "事件"];

  /* ---------- 存储 ---------- */
  function genreKey() {
    try {
      var c = window.storyFramework && window.storyFramework.config;
      /* 关键：各界的 config 以 genreKey 字段登记（如 'fanrenxiuxian'），
         而非常见的 genre/id；读错字段会导致本界资料库永远落到 "default"，
         种子词条不注入、buildPromptBlock() 返回空串。这里优先取 genreKey。 */
      return (c && (c.genreKey || c.genre || c.id)) || "default";
    } catch (e) { return "default"; }
  }
  function key() { return PREFIX + genreKey() + slotSuffix(); }
  /* v3.68.0 串档修复：资料库按存档槽隔离（主档裸键零迁移，副档 ~slotId） */
  function slotSuffix() {
    try {
      var fw = window.storyFramework;
      var sid = (fw && fw.slotId)
        || localStorage.getItem("storyActiveSlot_" + ((fw && fw.genre) || genreKey()))
        || "main";
      return sid && sid !== "main" ? "~" + sid : "";
    } catch (e) { return ""; }
  }
  function load() {
    try {
      var raw = localStorage.getItem(key());
      var o = raw ? JSON.parse(raw) : null;
      return o && typeof o === "object" ? o : { entries: [] };
    } catch (e) { return { entries: [] }; }
  }
  function save(o) {
    try { localStorage.setItem(key(), JSON.stringify(o)); }
    catch (e) { try { window.MoStore && window.MoStore.setItem(key(), JSON.stringify(o)); } catch (e2) {} }
    _emit();
  }
  var _listeners = [];
  function _emit() { _listeners.forEach(function (fn) { try { fn(); } catch (e) {} }); }
  function onChange(fn) { if (typeof fn === "function") _listeners.push(fn); }
  function uid() { return "wb" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }

  /* ---------- 种子词条：外置种子库（js/worldbook-seeds.js）优先 ---------- */
  function seedsOf(g) {
    if (window.WORLDBOOK_SEEDS && window.WORLDBOOK_SEEDS[g]) return window.WORLDBOOK_SEEDS[g];
    return (typeof LEGACY_SEEDS !== "undefined" && LEGACY_SEEDS[g]) || null;
  }
  var LEGACY_SEEDS = null; /* 兼容兜底：种子库未载入时无种子（面板仍可手动增补/抽取） */

  function ensureSeed() {
    var g = genreKey();
    if (!seedsOf(g)) return;
    /* v4.08.0 修复（D8）：播种标记原本是 `yunjingWorldBookSeeded:v3:{genre}`，
       **不带槽位后缀** → 主档播种后写入标记，副档进来直接被标记挡住 → 副档永远是空库。
       现在标记也按槽隔离。 */
    var flag = SEED_FLAG + g + slotSuffix();
    var done;
    try { done = localStorage.getItem(flag); } catch (e) { done = null; }
    if (done) return;
    var o = load();
    var have = {};
    (o.entries || []).forEach(function (e) { have[e.name] = 1; });
    seedsOf(g).forEach(function (s) {
      if (!have[s.name]) o.entries.push({ id: uid(), cat: s.cat, name: s.name, text: s.text, src: "seed" });
    });
    save(o);
    try { localStorage.setItem(flag, "1"); } catch (e) {}
  }

  /* ---------- 增删查 ---------- */
  function addEntry(cat, name, text, src) {
    cat = CATS.indexOf(cat) >= 0 ? cat : "设定";
    name = String(name || "").trim();
    text = String(text || "").trim();
    if (!name) return null;
    var o = load();
    o.entries = o.entries || [];
    var hit = o.entries.filter(function (e) { return e.name === name; })[0];
    if (hit) { hit.cat = cat; hit.text = text; hit.src = src || "user"; hit.updatedAt = Date.now(); }
    else o.entries.push({ id: uid(), cat: cat, name: name, text: text, src: src || "user", at: Date.now(), updatedAt: Date.now() });
    save(o);
    return true;
  }
  function removeEntry(id) {
    var o = load();
    var n = (o.entries || []).length;
    o.entries = (o.entries || []).filter(function (e) { return e.id !== id; });
    save(o);
    return o.entries.length < n;
  }
  function all() { return (load().entries || []).slice(); }
  function byCat(cat) { return all().filter(function (e) { return e.cat === cat; }); }

  /* ---------- 从当前故事抽取（防 AI 前后矛盾的本界事实备份） ---------- */
  function harvestFromStory() {
    var added = 0;
    try {
      var fw = window.storyFramework;
      var v = (fw && fw.storyState && fw.storyState.variables) || {};
      var o = load();
      o.entries = o.entries || [];
      var have = {};
      o.entries.forEach(function (e) { have[e.name] = 1; });
      var push = function (cat, name, text) {
        if (!name || have[name]) return;
        have[name] = 1;
        o.entries.push({ id: uid(), cat: cat, name: name, text: text || (cat + "（本界已登场）"), src: "harvest", at: Date.now(), updatedAt: Date.now() });
        added++;
      };
      /* 人物 */
      var chars = v.characters || v.人物 || v.众生相;
      if (chars && typeof chars === "object") {
        Object.keys(chars).forEach(function (k) { push("人物", k, ""); });
      }
      /* 机缘 / 物品 */
      var items = v.items || v.道具 || v.物品 || v.持有;
      if (Array.isArray(items)) items.forEach(function (it) { push("机缘", typeof it === "string" ? it : (it && (it.name || it.名)) || "", ""); });
      else if (items && typeof items === "object") Object.keys(items).forEach(function (k) { push("机缘", k, ""); });
      /* 机缘账本（已确权的归属） */
      if (window.CanonLedger) {
        window.CanonLedger.all().forEach(function (x) { push("机缘", x.name, "归属：" + (x.who || "他人") + (x.note ? "（" + x.note + "）" : "")); });
      }
      /* 大事记 */
      var ch = v.大事记 || v.chronicle;
      if (Array.isArray(ch)) ch.slice(-20).forEach(function (c) { var t = typeof c === "string" ? c : (c && (c.text || c.event || c.内容)); if (t) push("事件", String(t).slice(0, 18), String(t)); });
      save(o);
    } catch (e) {}
    return added;
  }

  /* ---------- 注入主笔：挑相关词条，受字数上限约束 ---------- */
  function buildPromptBlock(maxChars, keywords) {
    var list = all();
    if (!list.length) return "";
    if (keywords && keywords.length) {
      var kws = keywords.map(function (k) { return String(k).toLowerCase(); });
      var scored = list.map(function (e) {
        var hay = (e.name + " " + e.text + " " + e.cat).toLowerCase();
        var s = 0; kws.forEach(function (k) { if (hay.indexOf(k) >= 0) s++; });
        return { e: e, s: s };
      }).filter(function (x) { return x.s > 0; }).sort(function (a, b) { return b.s - a.s; }).map(function (x) { return x.e; });
      if (scored.length) list = scored;
    }
    var max = maxChars || 1400;
    var lines = ["【本界资料库（设定一致性参考——仅作事实锚点，不得整段照搬为剧情，不得与正文已发生事实冲突）】"];
    var used = lines[0].length;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      var line = "· " + e.cat + "「" + e.name + "」：" + e.text;
      if (used + line.length + 1 > max) break;
      lines.push(line); used += line.length + 1;
    }
    return "\n" + lines.join("\n");
  }

  /* ---------- 面板（小云模块 / 上下文面板入口） ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  var el = null;
  function renderPanel() {
    if (!el) return;
    var body = el.querySelector(".wb-body");
    if (!body) return;
    ensureSeed();
    var list = all();
    var html = "";
    if (!list.length) {
      html = '<div class="wb-empty">本界还没有资料库条目。点下方「＋ 增补条目」补上缺失的世界书；或先「从当前故事抽取」把已登场的人物 / 机缘 / 大事记归档。</div>';
    } else {
      CATS.forEach(function (cat) {
        var items = list.filter(function (e) { return e.cat === cat; });
        if (!items.length) return;
        html += '<div class="wb-sec"><div class="wb-sec-h">' + esc(cat) + " · " + items.length + "</div>";
        items.forEach(function (e) {
          var tag = e.src === "seed" ? '<i class="wb-tag seed">内置</i>' : e.src === "harvest" ? '<i class="wb-tag harv">已抽取</i>' : '<i class="wb-tag user">增补</i>';
          html += '<div class="wb-card"><div class="wb-card-h"><b>' + esc(e.name) + "</b>" + tag +
            '<button class="wb-del" data-id="' + esc(e.id) + '" title="删除">✕</button></div>' +
            '<div class="wb-card-t">' + esc(e.text) + "</div></div>";
        });
        html += "</div>";
      });
    }
    body.innerHTML = html;
    body.querySelectorAll(".wb-del").forEach(function (b) {
      b.onclick = function () {
        removeEntry(b.dataset.id);
        renderPanel();
      };
    });
  }
  function buildPanel() {
    if (el) return el;
    el = document.createElement("div");
    el.className = "wb-panel";
    el.innerHTML =
      '<div class="wb-mask" data-close="1"></div>' +
      '<div class="wb-wrap">' +
        '<div class="wb-head"><b>📚 本界资料库</b>' +
          '<button class="wb-harvest" data-act="harvest">⟳ 从当前故事抽取</button>' +
          '<button class="wb-x" data-close="1" title="关闭">✕</button></div>' +
        '<div class="wb-add">' +
          '<select id="wbCat" class="wb-sel">' + CATS.map(function (c) { return '<option value="' + c + '">' + c + "</option>"; }).join("") + "</select>" +
          '<input id="wbName" class="wb-in" maxlength="16" placeholder="条目名（如：掌天瓶）">' +
          '<input id="wbText" class="wb-in grow" maxlength="120" placeholder="设定说明（公认事实，不臆造）">' +
          '<button class="wb-addbtn" data-act="add">＋ 增补</button>' +
        '</div>' +
        '<div class="wb-body"></div>' +
        '<div class="wb-foot">按世界隔离存储；可补缺失条目，也可一键归档已登场内容——每个世界都有自己的资料库</div>' +
      "</div>";
    el.addEventListener("click", function (e) {
      var t = e.target;
      if (t && t.dataset && t.dataset.close) { close(); return; }
      if (!t || !t.dataset || !t.dataset.act) return;
      if (t.dataset.act === "add") {
        var cat = document.getElementById("wbCat").value;
        var name = document.getElementById("wbName").value.trim();
        var text = document.getElementById("wbText").value.trim();
        if (!name) { alert("请先填条目名"); return; }
        addEntry(cat, name, text, "user");
        document.getElementById("wbName").value = "";
        document.getElementById("wbText").value = "";
        renderPanel();
      } else if (t.dataset.act === "harvest") {
        var n = harvestFromStory();
        renderPanel();
        var b = el.querySelector(".wb-harvest");
        var old = b.textContent;
        b.textContent = "✓ 已归档 " + n + " 条";
        setTimeout(function () { b.textContent = old; }, 1800);
      }
    });
    document.body.appendChild(el);
    return el;
  }
  function open() {
    buildPanel();
    ensureSeed();
    el.classList.add("show");
    renderPanel();
  }
  function close() { if (el) el.classList.remove("show"); }

  window.WorldBook = {
    CATS: CATS,
    ensureSeed: ensureSeed,
    addEntry: addEntry,
    removeEntry: removeEntry,
    all: all,
    byCat: byCat,
    onChange: onChange,
    harvestFromStory: harvestFromStory,
    buildPromptBlock: buildPromptBlock,
    open: open,
    close: close
  };
})();
