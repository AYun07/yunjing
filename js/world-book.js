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
  var SEED_FLAG = "yunjingWorldBookSeeded:v2:";  /* v3.55.23 升版：8 界补地理/势力种子，老档也会补落新条目 */
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
  function key() { return PREFIX + genreKey(); }
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

  /* ---------- 主流世界种子词条（只写公认的设定级事实） ---------- */
  var SEEDS = {
    fanrenxiuxian: [
      { cat: "设定", name: "修炼体系", text: "炼气→筑基→结丹→元婴→化神→炼虚→合体→大乘→渡劫→真仙……仙凡之隔在筑基，元婴已是一方巨擘；越阶硬撼须有天大机缘，寿元是大限。" },
      { cat: "机缘", name: "掌天瓶", text: "可催熟灵草的神秘小瓶，主角早期核心机缘之一，具唯一性（谁先得即归谁）。" },
      { cat: "地理", name: "越国·七玄门", text: "主角出身的山门，故事早期舞台；墨大夫一脉藏有早期机缘与杀机。" },
      { cat: "地理", name: "越国·黄枫谷", text: "越国七大修仙门派之一，主角筑基后的宗门；掌门为结丹修士，门内机缘与倾轧并存。" },
      { cat: "地理", name: "太南谷", text: "太南会举行之地，各国修士云集的坊市盛会；珍稀灵草与仇杀同在。" },
      { cat: "地理", name: "乱星海", text: "域外修士与妖修混杂的广阔海域，无法无天，机缘与凶险皆倍于内陆。" },
      { cat: "地理", name: "天南", text: "人族修士疆域的总称，越国等诸国皆在其中；魔道六宗为共同大敌。" },
      { cat: "人物", name: "韩立", text: "本书主角，山村穷小子出身，性谨慎、隐忍、狠决，机缘多自底层一步步挣来。" }
    ],
    douluodalu: [
      { cat: "设定", name: "武魂体系", text: "人人生而具武魂，分器武魂/兽武魂/本体武魂；魂力等级从魂士到百级神祇，魂环颜色标识年限。" },
      { cat: "势力", name: "史莱克学院", text: "只收怪物不收庸才的顶级学院，主角团集结之地。" },
      { cat: "势力", name: "武魂殿", text: "大陆最强势力，教皇麾下供奉如云；猎杀十万年魂兽、统辖诸国魂师。" },
      { cat: "地理", name: "诺丁城", text: "主角幼年起点的小城，在此觉醒武魂、踏入魂师之路。" },
      { cat: "地理", name: "星斗大森林", text: "魂兽密布的最大原始森林，十万年魂兽潜藏深处，猎环圣地亦是绝地。" },
      { cat: "地理", name: "海神岛", text: "海神传承之岛，海神七圣柱守护；通过海神九考方可承其神位。" },
      { cat: "人物", name: "唐三", text: "本书主角，双生武魂蓝银草与昊天锤，外附暗器之术，前世唐门弟子。" }
    ],
    doupocangqiong: [
      { cat: "设定", name: "斗气体系", text: "以斗气为尊，等级从斗者一路到斗帝；异火是炼药与战力核心资源。" },
      { cat: "势力", name: "迦南学院", text: "黑角域中的最高学府，内藏天焚炼气塔与陨落心炎；主角求学与蜕变之地。" },
      { cat: "地理", name: "乌坦城", text: "萧家所在之城，主角从天才到废柴再崛起的起点；纳兰嫣然退婚在此。" },
      { cat: "地理", name: "黑角域", text: "无法无天的混乱之地，强者为尊；迦南学院便是乱域中的秩序孤岛。" },
      { cat: "地理", name: "中州", text: "大陆中心，魂殿、丹塔、星陨阁等顶级势力汇聚，斗尊遍地。" },
      { cat: "人物", name: "萧炎", text: "本书主角，天才陨落又崛起，得神秘老者（药尘）相助，踏上收复尊严与巅峰之路。" },
      { cat: "机缘", name: "异火", text: "天地间珍稀火焰，收服异火是炼药师与强者的关键跃升，具唯一性。" }
    ],
    shrouding: [
      { cat: "设定", name: "修行九秘", text: "源术与道则并重，荒古圣体一路多艰，成圣成帝是修行极致。" },
      { cat: "地理", name: "泰山", text: "九龙拉棺降临之地，五色祭坛自此揭开幕帘，一切故事从这里开始。" },
      { cat: "地理", name: "北斗星域", text: "主角修行主舞台，古华、燕地、中州等圣地林立，荒古禁地坐镇其间。" },
      { cat: "地理", name: "圣城", text: "北斗圣地汇聚之城，瑶池圣地所在；天骄论道、风波频起之地。" },
      { cat: "地理", name: "荒古禁地", text: "北斗星域神秘绝地，九龙拉棺启程之处，踏入者多有不测。" },
      { cat: "人物", name: "叶凡", text: "本书主角，因九龙拉棺从地球被带到北斗，以荒古圣体之姿踏上征途。" }
    ],
    swallowedstar: [
      { cat: "设定", name: "境界体系", text: "行星级→恒星级→宇宙级→域主→界主→不朽→宇宙尊者→宇宙之主→真神……维度跃升。" },
      { cat: "势力", name: "虚拟宇宙公司", text: "人类五大巨头势力之一，横跨宇宙的虚拟网络平台；任务、拍卖、传承皆在其中。" },
      { cat: "地理", name: "地球", text: "大涅槃之后武者与怪兽共存的世界，主角崛起的家园，也是诸多势力觊觎之地。" },
      { cat: "地理", name: "黑龙山星域", text: "主角早期纵横的星域，黑龙山帝国所在；宇宙级强者已可翻覆一方。" },
      { cat: "人物", name: "罗峰", text: "本书主角，地球崛起，以精神念师之姿纵横宇宙，守护家园。" }
    ],
    xianni: [
      { cat: "设定", name: "修真体系", text: "凝气→筑基→结丹→元婴→化神……逆修之路多轮回与执念，意境重于境界。" },
      { cat: "地理", name: "赵国", text: "主角故国，恒岳派所在；一段被灭门之仇自此埋下。" },
      { cat: "地理", name: "恒岳派", text: "赵国修真宗门，主角入门之处；铁柱峰下藏着他修行的起点。" },
      { cat: "地理", name: "朱雀星", text: "修真星域舞台，四大修真家族与罗天星域势力交织。" },
      { cat: "人物", name: "王林", text: "本书主角，资质平平却极执拗，以「逆」字证道，步步踏血而行。" }
    ],
    wanmeishijie: [
      { cat: "设定", name: "搬血境", text: "以淬炼血肉、搬动气血为始的修行起点，重宝与凶兽并存的上古荒域。" },
      { cat: "地理", name: "石村", text: "主角起点的小村落，族人淳朴凶悍；村后大山藏有上古遗迹与凶兽。" },
      { cat: "地理", name: "紫云郡", text: "下界起点郡地，火国与诸郡天骄争锋之地；补天阁等势力所在。" },
      { cat: "地理", name: "三千州", text: "上界广袤疆域，仙道势力林立；下界天骄飞升后的真正舞台。" },
      { cat: "人物", name: "石昊", text: "本书主角，天生至尊骨却遭夺，自石村走出，以无敌之姿闯荡八域。" }
    ],
    guzhenren: [
      { cat: "设定", name: "序列途径", text: "二十二条神之途径，由低到高序列 9→1，晋升需服食魔药并承受疯魔风险；非凡能力源于此。" },
      { cat: "势力", name: "值夜者", text: "各教会下属的非凡者小队，处理失控与神秘事件；主角早期身份所在。" },
      { cat: "地理", name: "廷根市", text: "鲁恩王国北部城市，明光教堂与值夜者小队驻地；主角非凡之路的起点。" },
      { cat: "地理", name: "贝克兰德", text: "鲁恩王国首都，工业雾都；人口千万、非凡者暗流最汹涌的城市。" },
      { cat: "地理", name: "神弃之地", text: "第二纪遗迹遍布的禁区，古神残留与疯狂滋生；踏入者九死一生。" },
      { cat: "人物", name: "克莱恩·莫雷蒂", text: "本书主角，穿越者，借「愚者」之名周旋于诸般隐秘与序列之上。" }
    ]
  };

  function ensureSeed() {
    var g = genreKey();
    if (!SEEDS[g]) return;
    var flag = SEED_FLAG + g;
    var done;
    try { done = localStorage.getItem(flag); } catch (e) { done = null; }
    if (done) return;
    var o = load();
    var have = {};
    (o.entries || []).forEach(function (e) { have[e.name] = 1; });
    SEEDS[g].forEach(function (s) {
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
