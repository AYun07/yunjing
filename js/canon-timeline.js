/* =========================================================================
 * 云境 · 大势演化账本（v3.55.23 · 世界活起来的另一半核心）
 * -------------------------------------------------------------------------
 * 解决的问题：原著大势是写死的剧本，还是会被因果改写的活历史？
 *
 *   旧行为：原著大事按剧本照演——就算玩家提前杀了魔道探子、救了该死的
 *           人、抢走了主角的女人，下一轮「血色试炼」照样爆发，南宫婉
 *           照样在既定章节与韩立定情。世界嘴上说是活的，命是死的。
 *
 *   新行为：三重因果铁律——
 *     ① 诱因铁律：每件原著大事都有诱因链。诱因被玩家终结/改变，
 *        该大事不发生或换形态，严禁照旧爆发。
 *     ② 蝴蝶铁律：机缘易主、人物生死、关系变化必生涟漪——允许诞生
 *        原著不存在的新事件，越滚越大。
 *     ③ 羁绊铁律：原著主角的感情线不写死。际遇改写归属——原著主角
 *        的女人可以成为玩家的女人，反之亦然；但须在正文里真实争取。
 *
 * 数据来源三条：
 *   ① 主笔在正文后输出 (world) 块显式登记；
 *   ② 玩家在「大势账本」面板手动登记/改判；
 *   ③ 与《机缘归属账本》联动（机缘易主即提示可登记大势涟漪）。
 *
 * 注入：主笔 / 动态世界推演，均按账本执行。
 * ========================================================================= */
(function () {
  "use strict";

  var PREFIX = "yunjingCanonTL:";
  var listeners = [];

  function genreKey() {
    try {
      var fw = window.storyFramework;
      var c = fw && fw.config;
      return (c && (c.genreKey || c.genre || c.id)) || "default";
    } catch (e) { return "default"; }
  }

  function key() { return PREFIX + genreKey(); }

  function load() {
    try {
      var raw = localStorage.getItem(key());
      var o = raw ? JSON.parse(raw) : {};
      return (o && typeof o === "object" && o.events && o.bonds) ? o : { events: {}, bonds: {} };
    } catch (e) { return { events: {}, bonds: {} }; }
  }

  function save(o) {
    try { localStorage.setItem(key(), JSON.stringify(o)); } catch (e) {}
    emit();
  }

  function emit() {
    listeners.forEach(function (fn) { try { fn(); } catch (e) {} });
  }

  function heroName() {
    try {
      var fw = window.storyFramework;
      return (fw && fw.storyState && fw.storyState.setup && fw.storyState.setup.playerName) || "";
    } catch (e) { return ""; }
  }

  function canonName() {
    if (window.StoryStance && window.StoryStance.canonHeroName) return window.StoryStance.canonHeroName();
    try {
      var fw = window.storyFramework;
      return (fw && fw.config && fw.config.canonProtagonist) || "原著主角";
    } catch (e) { return "原著主角"; }
  }

  /** 状态：pending 悬置 / prevented 诱因已断 / changed 已改变 / occurred 照旧发生 / new 新生事件 */
  var STATUS = {
    pending:   { ico: "⏳", name: "悬置", hint: "诱因仍在，按原著轨道酝酿" },
    prevented: { ico: "🚫", name: "未发生", hint: "诱因已被终结，此事件从时间线上抹去" },
    changed:   { ico: "🌊", name: "已改变", hint: "诱因被改写，事件换了形态/对象/规模" },
    occurred:  { ico: "🔥", name: "照旧爆发", hint: "虽经波折仍按原著爆发（须有可信因果）" },
    new:       { ico: "✨", name: "新生事件", hint: "原著不存在——蝴蝶效应催生的新大事" }
  };

  function classifyWho(who) {
    var w = String(who || "").trim();
    if (!w) return "other";
    if (/^(玩家|我|本人)$/.test(w)) return "player";
    if (heroName() && w === heroName()) return "player";
    if (w === canonName()) return "canon";
    if (w.indexOf(canonName()) >= 0) return "canon";
    return "other";
  }

  var CanonTimeline = {
    PREFIX: PREFIX,
    STATUS: STATUS,

    onChange(fn) { if (typeof fn === "function") listeners.push(fn); },

    all() {
      var o = load();
      return Object.keys(o.events).map(function (k) { return o.events[k]; });
    },
    allBonds() {
      var o = load();
      return Object.keys(o.bonds).map(function (k) { return o.bonds[k]; });
    },
    pending() {
      return this.all().filter(function (x) { return x.status === "pending"; });
    },

    /**
     * 登记/更新一件大事
     * @param {string} name   事件名（血色试炼、七玄门之战…）
     * @param {string} status pending|prevented|changed|occurred|new
     * @param {object} opt    { canon(原著走向), trigger(诱因), now(现状), note, round, kind }
     */
    event(name, status, opt) {
      name = String(name || "").trim();
      if (!name) return null;
      status = STATUS[status] ? status : "pending";
      opt = opt || {};
      var o = load();
      var prev = o.events[name];
      o.events[name] = {
        name: name,
        status: status,
        kind: opt.kind || (prev && prev.kind) || (status === "new" ? "new" : "canon"),
        canon: opt.canon || (prev && prev.canon) || "",
        trigger: opt.trigger || (prev && prev.trigger) || "",
        now: opt.now || (prev && prev.now) || "",
        note: opt.note || (prev && prev.note) || "",
        round: opt.round || (prev && prev.round) || "",
        at: prev && prev.at ? prev.at : Date.now(),
        updatedAt: Date.now()
      };
      save(o);
      return o.events[name];
    },

    /** 登记/改判一段羁绊归属（谁与谁的情缘/师承/同盟） */
    bond(name, who, opt) {
      name = String(name || "").trim();
      if (!name) return null;
      opt = opt || {};
      var o = load();
      var prev = o.bonds[name];
      o.bonds[name] = {
        name: name,
        who: String(who || "").trim(),
        holder: classifyWho(who),
        canonWith: opt.canonWith || (prev && prev.canonWith) || canonName(),
        note: opt.note || (prev && prev.note) || "",
        round: opt.round || (prev && prev.round) || "",
        at: prev && prev.at ? prev.at : Date.now(),
        updatedAt: Date.now()
      };
      save(o);
      return o.bonds[name];
    },

    removeEvent(name) { var o = load(); if (!o.events[name]) return false; delete o.events[name]; save(o); return true; },
    removeBond(name)  { var o = load(); if (!o.bonds[name]) return false; delete o.bonds[name]; save(o); return true; },
    clear() { save({ events: {}, bonds: {} }); },

    /**
     * 解析正文里的 (world) 块并登记。
     * 语法：
     *   (world)
     *   事件·血色试炼=未发生（诱因·墨大夫已被玩家终结）
     *   大势·七玄门之战=已改变（无掌天瓶，韩立走谈判路线）
     *   羁绊·南宫婉=玩家（黄枫谷初遇结缘）
     *   新势·魔道提前探查越国（掌天瓶易主引来注视）
     *   (/world)
     * 状态字：未发生/已断→prevented；已改变/换形态→changed；
     *        照旧/爆发/发生→occurred；新势/新事→new；悬置/酝酿→pending
     */
    parse(text) {
      if (!text) return [];
      var got = [];
      var re = /\(world\)\s*([\s\S]*?)\s*\(\/world\)/gi;
      var m;
      while ((m = re.exec(text)) !== null) {
        var lines = String(m[1] || "").split(/\n+/);
        for (var i = 0; i < lines.length; i++) {
          var ln = lines[i].trim();
          if (!ln || ln.charAt(0) === "#") continue;
          var noteM = ln.match(/[（(]([^）)]*)[）)]\s*$/);
          var note = noteM ? noteM[1] : "";
          var body = noteM ? ln.replace(/[（(][^）)]*[）)]\s*$/, "").trim() : ln;

          var bm = body.match(/^[羁bB]绊[·•:：]\s*(.+?)\s*[=＝]\s*(.+)$/);
          if (bm) {
            got.push(this.bond(bm[1].trim(), bm[2].trim(), { note: note }));
            continue;
          }
          var nm = body.match(/^新[势事][·•:：]?\s*(.+)$/);
          if (nm) {
            got.push(this.event(nm[1].trim(), "new", { note: note, now: note }));
            continue;
          }
          var em = body.match(/^(?:事件|大势|悬置|新事)[·•:：]\s*(.+?)\s*[=＝]\s*(.+)$/);
          if (em) {
            var st = em[2].trim();
            var status =
              /未发生|已断|终结|不发生|消弭/.test(st) ? "prevented" :
              /已改变|换形态|转向|改道/.test(st) ? "changed" :
              /照旧|爆发|如期|发生/.test(st) ? "occurred" :
              /悬置|酝酿|将启/.test(st) ? "pending" :
              /新生|新起|凭空/.test(st) ? "new" : "changed";
            /* 括号说明按状态落进正确字段：prevented→诱因，changed→现状，其余→备注 */
            var slot = status === "prevented" ? { trigger: note, now: st, note: "" }
              : status === "changed" ? { trigger: "", now: st + (note ? "：" + note : ""), note: "" }
              : { trigger: "", now: st, note: note };
            got.push(this.event(em[1].trim(), status, slot));
            continue;
          }
        }
      }
      return got.filter(Boolean);
    },

    /** 注入主笔/动态世界的《大势演化账本》条款 */
    buildPromptBlock() {
      var evs = this.all();
      var bds = this.allBonds();
      if (!evs.length && !bds.length) return "";
      var canon = canonName();
      var lines = [];
      lines.push("【大势演化账本（世界因果铁律——大势可改，因果必严）】");
      lines.push("每件原著大事都有诱因链。诱因被终结或改变，该大事就不得照旧发生或须换形态；因果的涟漪会催生原著不存在的新事件。以下已登记的走向具有约束力：");
      var groups = { prevented: [], changed: [], occurred: [], pending: [], new: [] };
      evs.forEach(function (x) { (groups[x.status] || groups.pending).push(x); });
      if (groups.prevented.length) {
        lines.push("· 诱因已断·不得发生（严禁让这些事件照旧爆发、严禁无中生有补出等价事件强行走完原剧本）：");
        groups.prevented.forEach(function (x) {
          lines.push("    - " + x.name + (x.trigger ? "（诱因已终：" + x.trigger + "）" : "") + (x.note ? " · " + x.note : ""));
        });
      }
      if (groups.changed.length) {
        lines.push("· 已改变·按新走向推演（事件还在，但形态/对象/规模/时序已变，须按「now」执行）：");
        groups.changed.forEach(function (x) {
          lines.push("    - " + x.name + " → " + (x.now || "形态已变") + (x.trigger ? "（诱因被改：" + x.trigger + "）" : "") + (x.note ? " · " + x.note : ""));
        });
      }
      if (groups.occurred.length) {
        lines.push("· 虽经波折仍爆发（已有可信因果支撑，可如期发生）：");
        groups.occurred.forEach(function (x) {
          lines.push("    - " + x.name + (x.note ? "（" + x.note + "）" : ""));
        });
      }
      if (groups.new.length) {
        lines.push("· 新生事件（原著没有——蝴蝶效应催生，须认真推演其连锁后果，不得当没发生）：");
        groups.new.forEach(function (x) {
          lines.push("    - " + x.name + (x.note ? "（" + x.note + "）" : ""));
        });
      }
      if (groups.pending.length) {
        lines.push("· 悬置中（诱因仍在，按原著轨道酝酿，但走向可被玩家继续改写）：");
        groups.pending.forEach(function (x) {
          lines.push("    - " + x.name + (x.trigger ? "（诱因：" + x.trigger + "）" : ""));
        });
      }
      if (bds.length) {
        lines.push("· 羁绊归属（感情线/师承/同盟不写死，按账本执行——" + canon + "已失去的羁绊不得凭空复联，须有真实过程）：");
        bds.forEach(function (b) {
          var who = b.holder === "player" ? "玩家" : (b.holder === "canon" ? canon : (b.who || "他人"));
          lines.push("    - " + b.name + " → " + who + (b.canonWith && b.holder !== "canon" ? "（原著属" + b.canonWith + "，已因际遇改写）" : "") + (b.note ? " · " + b.note : ""));
        });
      }
      lines.push("· 未列入此账本的原著大事仍按原著轨道酝酿；一旦玩家终结其诱因或改写其走向，由你用 (world) 块登记，账本即刻生效。");
      return "\n" + lines.join("\n");
    },

    /** 主笔侧输出协议（教模型怎么登记） */
    buildProtocol() {
      return (
        "\n【大势登记协议】当玩家终结了某件原著大事的诱因、或事件形态被改写、或蝴蝶效应催生了原著没有的新大事、或感情线/羁绊易主时，" +
        "正文写完后另起一行输出登记块，供世界账本永久记录：\n" +
        "(world)\n" +
        "事件·血色试炼=未发生（诱因·墨大夫已被玩家终结）\n" +
        "大势·七玄门之战=已改变（掌天瓶易主，韩立走谈判路线）\n" +
        "羁绊·南宫婉=玩家（黄枫谷初遇结缘）\n" +
        "新势·魔道提前探查越国（掌天瓶易主引来注视）\n" +
        "(/world)\n" +
        "登记后按账本执行——诱因亡则事亡，涟漪必生新事，羁绊随际遇改写；无实质变化则不输出此块，不要为凑格式而登记。"
      );
    }
  };

  /* ---------------- 面板 ---------------- */
  var el = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function renderPanel() {
    if (!el) return;
    var o = load();
    var evs = CanonTimeline.all();
    var bds = CanonTimeline.allBonds();
    var html = "";
    html += '<div class="ctl-sec"><div class="ctl-sec-t">因果三铁律</div>' +
      '<div class="ctl-law">① 诱因铁律——诱因被终结，大事不发生或换形态；</div>' +
      '<div class="ctl-law">② 蝴蝶铁律——机缘易主/人物生死必生涟漪，允许原著外新事件；</div>' +
      '<div class="ctl-law">③ 羁绊铁律——感情线不写死，际遇改写归属，须正文真实争取。</div></div>';
    html += '<div class="ctl-sec"><div class="ctl-sec-t">大事走势（' + evs.length + '）</div>';
    if (!evs.length) html += '<div class="ctl-empty">暂无登记——原著大事按轨道酝酿；主笔会在诱因被改写时用 (world) 块上报。</div>';
    evs.forEach(function (x) {
      var st = STATUS[x.status] || STATUS.pending;
      html += '<div class="ctl-card"><span class="ctl-ico">' + st.ico + '</span>' +
        '<div class="ctl-main"><b>' + esc(x.name) + '</b><i>' + st.name + "</i>" +
        (x.trigger ? '<em>诱因：' + esc(x.trigger) + "</em>" : "") +
        (x.now ? '<em>现状：' + esc(x.now) + "</em>" : "") +
        (x.note ? '<em>' + esc(x.note) + "</em>" : "") + "</div>" +
        '<button class="ctl-del" data-del-ev="' + esc(x.name) + '" title="删除">✕</button></div>';
    });
    html += "</div>";
    html += '<div class="ctl-sec"><div class="ctl-sec-t">羁绊归属（' + bds.length + '）</div>';
    if (!bds.length) html += '<div class="ctl-empty">暂无改判——原著主角的感情线仍按原著；一旦易主，此处会记下。</div>';
    bds.forEach(function (b) {
      var who = b.holder === "player" ? "玩家" : (b.holder === "canon" ? canonName() : (b.who || "他人"));
      html += '<div class="ctl-card"><span class="ctl-ico">💞</span>' +
        '<div class="ctl-main"><b>' + esc(b.name) + "</b><i>→ " + esc(who) + "</i>" +
        (b.canonWith && b.holder !== "canon" ? '<em>原著属' + esc(b.canonWith) + "，已因际遇改写</em>" : "") +
        (b.note ? "<em>" + esc(b.note) + "</em>" : "") + "</div>" +
        '<button class="ctl-del" data-del-bd="' + esc(b.name) + '" title="删除">✕</button></div>';
    });
    html += "</div>";
    html += '<div class="ctl-foot">按世界隔离存储；大势可改，因果必严——这正是世界活着的证据</div>';
    el.querySelector(".ctl-body").innerHTML = html;
  }

  function buildPanel() {
    if (el) return el;
    injectStyle();
    el = document.createElement("div");
    el.className = "ctl-panel";
    el.innerHTML =
      '<div class="ctl-mask" data-close="1"></div>' +
      '<div class="ctl-wrap">' +
        '<div class="ctl-head"><b>🌊 大势演化账本</b>' +
          '<button class="ctl-x" data-close="1" title="关闭">✕</button></div>' +
        '<div class="ctl-add">' +
          '<select id="ctlKind" class="ctl-sel"><option value="ev">大事</option><option value="bond">羁绊</option></select>' +
          '<select id="ctlSt" class="ctl-sel">' +
            '<option value="pending">悬置</option><option value="prevented">未发生</option>' +
            '<option value="changed">已改变</option><option value="occurred">照旧爆发</option>' +
            '<option value="new">新生事件</option></select>' +
          '<input id="ctlName" class="ctl-in" maxlength="20" placeholder="名称（血色试炼 / 南宫婉）">' +
          '<input id="ctlNote" class="ctl-in grow" maxlength="80" placeholder="诱因 / 现状 / 归属（如：墨大夫已亡 / 玩家）">' +
          '<button class="ctl-addbtn" data-act="add">＋ 登记</button>' +
        "</div>" +
        '<div class="ctl-body"></div>' +
      "</div>";
    el.addEventListener("click", function (e) {
      var t = e.target;
      if (t && t.dataset && t.dataset.close) { close(); return; }
      if (t && t.dataset && t.dataset.delEv) { CanonTimeline.removeEvent(t.dataset.delEv); renderPanel(); return; }
      if (t && t.dataset && t.dataset.delBd) { CanonTimeline.removeBond(t.dataset.delBd); renderPanel(); return; }
      if (!t || !t.dataset || !t.dataset.act) return;
      if (t.dataset.act === "add") {
        var kind = document.getElementById("ctlKind").value;
        var name = document.getElementById("ctlName").value.trim();
        var note = document.getElementById("ctlNote").value.trim();
        if (!name) { alert("请先填名称"); return; }
        if (kind === "bond") {
          CanonTimeline.bond(name, note || "玩家", { note: "" });
        } else {
          CanonTimeline.event(name, document.getElementById("ctlSt").value, { trigger: note, now: note });
        }
        document.getElementById("ctlName").value = "";
        document.getElementById("ctlNote").value = "";
        renderPanel();
      }
    });
    document.body.appendChild(el);
    return el;
  }

  function injectStyle() {
    if (document.getElementById("ctlStyle")) return;
    var st = document.createElement("style");
    st.id = "ctlStyle";
    st.textContent =
      ".ctl-panel{position:fixed;inset:0;z-index:2140;visibility:hidden;pointer-events:none;}" +
      ".ctl-panel.show{visibility:visible;pointer-events:auto;}" +
      ".ctl-mask{position:absolute;inset:0;background:rgba(0,0,0,.45);opacity:0;transition:.2s;}" +
      ".ctl-panel.show .ctl-mask{opacity:1;}" +
      ".ctl-wrap{position:absolute;right:0;top:0;bottom:0;width:min(430px,100vw);background:linear-gradient(168deg,#141a2a,#0d1018);" +
        "border-left:1px solid rgba(200,170,110,.25);display:flex;flex-direction:column;transform:translateX(102%);transition:transform .24s ease;}" +
      ".ctl-panel.show .ctl-wrap{transform:none;}" +
      ".ctl-head{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid rgba(200,170,110,.18);color:#e9dfc8;font-size:14px;}" +
      ".ctl-head b{flex:1;}" +
      ".ctl-x{background:none;border:1px solid rgba(200,170,110,.25);color:#a8a290;width:28px;height:28px;border-radius:8px;cursor:pointer;}" +
      ".ctl-add{display:flex;gap:6px;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid rgba(200,170,110,.12);}" +
      ".ctl-sel,.ctl-in{background:rgba(127,127,127,.08);border:1px solid rgba(200,170,110,.2);color:#e9dfc8;border-radius:8px;padding:6px 8px;font-size:12px;}" +
      ".ctl-in{flex:1 1 120px;min-width:0;}.ctl-in.grow{flex:2 1 160px;}" +
      ".ctl-addbtn{background:rgba(200,170,110,.16);border:1px solid rgba(200,170,110,.35);color:#e9dfc8;border-radius:8px;padding:6px 12px;cursor:pointer;}" +
      ".ctl-body{flex:1;overflow-y:auto;padding:10px 12px;}" +
      ".ctl-sec{margin-bottom:14px;}.ctl-sec-t{font-size:12px;color:#c9a86a;letter-spacing:1px;margin-bottom:6px;}" +
      ".ctl-law{font-size:11.5px;color:#a89c88;line-height:1.7;}" +
      ".ctl-empty{font-size:12px;color:#8a8272;line-height:1.7;padding:8px;border:1px dashed rgba(200,170,110,.2);border-radius:10px;}" +
      ".ctl-card{display:flex;gap:8px;align-items:flex-start;background:rgba(127,127,127,.06);border:1px solid rgba(200,170,110,.15);border-radius:10px;padding:8px 10px;margin-bottom:6px;}" +
      ".ctl-ico{font-size:15px;line-height:1.4;}" +
      ".ctl-main{flex:1;min-width:0;font-size:12.5px;color:#e9dfc8;line-height:1.6;}" +
      ".ctl-main b{margin-right:6px;}.ctl-main i{font-style:normal;font-size:11px;color:#c9a86a;border:1px solid rgba(201,168,106,.3);border-radius:99px;padding:0 7px;}" +
      ".ctl-main em{display:block;font-style:normal;font-size:11.5px;color:#a89c88;margin-top:2px;}" +
      ".ctl-del{background:none;border:none;color:#8a8272;cursor:pointer;font-size:12px;padding:2px 4px;}" +
      ".ctl-del:hover{color:#e0703c;}" +
      ".ctl-foot{padding:10px 14px;border-top:1px solid rgba(200,170,110,.12);font-size:11px;color:#8a8272;}";
    document.head.appendChild(st);
  }

  function open() { buildPanel(); el.classList.add("show"); renderPanel(); }
  function close() { if (el) el.classList.remove("show"); }

  CanonTimeline.open = open;
  CanonTimeline.close = close;

  window.CanonTimeline = CanonTimeline;
})();
