/* =========================================================================
 * 云境 · 剧情上下文面板（v3.55.19）
 * -------------------------------------------------------------------------
 * 把散在各处的世界记忆聚成一屏：人物、机缘与物品、地点、伏笔与事件、大事记。
 *
 * 两种视图，可随时互切（切换状态记忆在 localStorage）：
 *   ① 分门别类 —— 按类别分栏，找人找物最快；
 *   ② 时间线   —— 按回合倒序铺开，看世界是怎么一步步走到今天的。
 *
 * 数据来源（全部本地已有，不额外消耗任何 API）：
 *   storyState.variables（人物/道具/伏笔/大事记/平铺状态）
 *   storyState.conversationHistory（每回合正文首句 → 时间线）
 *   CanonLedger（机缘归属账本）
 * ========================================================================= */
(function () {
  "use strict";

  var KEY_VIEW = "yunjingCtxPanelView";
  var el = null;
  var curView = "cat";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function vars() {
    try {
      var fw = window.storyFramework;
      return (fw && fw.storyState && fw.storyState.variables) || {};
    } catch (e) {
      return {};
    }
  }
  function setup() {
    try {
      var fw = window.storyFramework;
      return (fw && fw.storyState && fw.storyState.setup) || {};
    } catch (e) {
      return {};
    }
  }
  function genreName() {
    try {
      var fw = window.storyFramework;
      return (fw && fw.config && fw.config.genreName) || "本界";
    } catch (e) {
      return "本界";
    }
  }

  /** 把容器（对象或数组）摊平成 [{name, ...fields}] */
  function flatten(container, nameKeys) {
    var out = [];
    if (!container) return out;
    if (Array.isArray(container)) {
      container.forEach(function (it) {
        if (it == null) return;
        if (typeof it === "string") {
          out.push({ name: it });
        } else if (typeof it === "object") {
          var nm = "";
          nameKeys.forEach(function (k) {
            if (!nm && it[k]) nm = String(it[k]);
          });
          out.push({ name: nm || "", fields: it });
        }
      });
      return out;
    }
    if (typeof container === "object") {
      Object.keys(container).forEach(function (k) {
        var val = container[k];
        if (val && typeof val === "object" && !Array.isArray(val)) {
          var f = { name: k };
          Object.keys(val).forEach(function (fk) {
            f[fk] = val[fk];
          });
          out.push(f);
        } else {
          out.push({ name: k, value: val == null ? "" : String(val) });
        }
      });
    }
    return out;
  }

  /** 人物：优先 characters 容器，其次平铺的「人物名.xxx」键 */
  function collectCharacters(v) {
    var list = flatten(v.characters || v.人物 || v.众生相 || v.characters, ["name", "姓名", "名"]);
    var seen = {};
    list.forEach(function (c) {
      if (c.name) seen[c.name] = true;
    });
    Object.keys(v).forEach(function (k) {
      var m = k.match(/^(.+?)[.．](.+)$/);
      if (!m) return;
      var nm = m[1];
      if (/(道具|物品|机缘|资源|持有)/.test(nm)) return;
      if (!seen[nm]) {
        seen[nm] = true;
        list.push({ name: nm, fields: {} });
      }
      var target = list.filter(function (x) {
        return x.name === nm;
      })[0];
      if (target) {
        target.fields = target.fields || {};
        target.fields[m[2]] = v[k];
      }
    });
    return list.filter(function (c) {
      return c.name;
    });
  }

  function collectItems(v) {
    var list = flatten(v.items || v.道具 || v.物品 || v.持有 || v.行囊, ["name", "名称", "名"]);
    Object.keys(v).forEach(function (k) {
      if (/^(道具|物品|机缘|收获|所得)[.．]/.test(k)) {
        var m = k.match(/^(.+?)[.．](.+)$/);
        if (m) list.push({ name: m[2], value: String(v[k]) });
      }
    });
    return list;
  }

  function collectForeshadow(v) {
    var list = flatten(v.foreshadowings || v.伏笔 || v.悬念, ["content", "内容", "name"]);
    if (!list.length && Array.isArray(v.foreshadowings)) {
      v.foreshadowings.forEach(function (f) {
        if (typeof f === "string") list.push({ name: f });
      });
    }
    return list;
  }

  function collectChronicle(v) {
    var raw = v.大事记 || v.chronicle || v.timeline || [];
    if (typeof raw === "string") {
      return raw.split(/\n+/).filter(Boolean).map(function (s) {
        return { name: s.replace(/^[-•>\s]+/, "") };
      });
    }
    return flatten(raw, ["text", "event", "内容", "name"]);
  }

  function fieldLine(f) {
    if (!f || typeof f !== "object") return "";
    var skip = { name: 1, 姓名: 1, 名: 1, content: 1, 内容: 1 };
    var parts = [];
    Object.keys(f).forEach(function (k) {
      if (skip[k]) return;
      var val = f[k];
      if (val == null || val === "") return;
      if (typeof val === "object") return;
      parts.push(esc(k) + "：" + esc(val));
    });
    return parts.join(" · ");
  }

  /* ---------------- 视图①：分门别类 ---------------- */
  function renderCategory(v) {
    var chars = collectCharacters(v);
    var items = collectItems(v);
    var fs = collectForeshadow(v);
    var ch = collectChronicle(v);
    var led = window.CanonLedger ? CanonLedger.all() : [];
    var hero = setup().playerName || "";
    var canon = window.StoryStance ? StoryStance.canonHeroName() : "原著主角";
    var stance = window.StoryStance ? StoryStance.info() : null;

    var html = "";
    html += '<div class="ctx-cat-hero">';
    html += '<div class="ctx-cat-line"><b>世界</b>' + esc(genreName()) + "</div>";
    html += '<div class="ctx-cat-line"><b>你的角色</b>' + esc(hero || "（未命名）") + "</div>";
    html += '<div class="ctx-cat-line"><b>原著主角</b>' + esc(canon) + "</div>";
    if (stance) html += '<div class="ctx-cat-line"><b>叙事立场</b>' + esc(stance.ico + " " + stance.name) + "</div>";
    if (window.StoryIdentity) {
      var idn = window.StoryIdentity.infoIdentity();
      if (idn) html += '<div class="ctx-cat-line"><b>玩家身份</b>' + esc(idn.ico + " " + idn.name) + "</div>";
      var rel = window.StoryIdentity.infoRelation();
      html += '<div class="ctx-cat-line"><b>主角关系</b>' + esc(rel ? rel.ico + " " + rel.name : "（取代主角立场·你即主角）") + "</div>";
    }
    html += "</div>";

    /* 机缘归属：世界动态性的那一栏 */
    html += section("🔑 机缘归属（唯一性）", led.length ? led.map(function (x) {
      var tag = x.holder === "player" ? '<i class="ctx-tag mine">已归玩家</i>' : '<i class="ctx-tag other">归' + esc(x.who || "他人") + "</i>";
      return card(esc(x.name), tag + (x.note ? '<span class="ctx-sub">' + esc(x.note) + "</span>" : "") + (x.round ? '<span class="ctx-sub">第' + esc(x.round) + "回合</span>" : ""));
    }).join("") : empty("尚无易主机缘。玩家从原著主角手里夺走什么，这里会永久记下——世界不会把它还回去。"), led.length);

    html += section("👥 人物", chars.length ? chars.slice(0, 60).map(function (c) {
      var sub = fieldLine(c.fields) || c.value || "";
      return card(esc(c.name), sub ? '<span class="ctx-sub">' + sub + "</span>" : "");
    }).join("") : empty("尚无人物登记。"), chars.length);

    html += section("🎒 机缘与物品", items.length ? items.slice(0, 60).map(function (c) {
      var sub = fieldLine(c.fields) || c.value || "";
      return card(esc(c.name), sub ? '<span class="ctx-sub">' + sub + "</span>" : "");
    }).join("") : empty("尚无物品登记。"), items.length);

    html += section("🪝 伏笔与悬念", fs.length ? fs.slice(0, 40).map(function (c) {
      var sub = fieldLine(c.fields) || c.value || "";
      return card(esc(c.name), sub ? '<span class="ctx-sub">' + sub + "</span>" : "");
    }).join("") : empty("尚无伏笔。"), fs.length);

    html += section("📜 世界大事记", ch.length ? ch.slice(-40).reverse().map(function (c) {
      var sub = fieldLine(c.fields) || c.value || "";
      return card(esc(c.name), sub ? '<span class="ctx-sub">' + sub + "</span>" : "");
    }).join("") : empty("尚无大事记。"), ch.length);

    return html;
  }

  /* ---------------- 视图②：时间线 ---------------- */
  function renderTimeline(v) {
    var hist = [];
    try {
      var fw = window.storyFramework;
      hist = (fw && fw.storyState && fw.storyState.conversationHistory) || [];
    } catch (e) {}
    var rounds = [];
    var idx = 0;
    for (var i = 0; i < hist.length; i++) {
      var m = hist[i];
      if (!m) continue;
      if (m.role === "assistant") {
        idx++;
        var txt = String(m.content || "");
        txt = txt.replace(/<think[\s\S]*?<\/think>/gi, "");
        txt = txt.replace(/\(variable_update\)[\s\S]*?\(\/variable_update\)/gi, "");
        txt = txt.replace(/\(claimed\)[\s\S]*?\(\/claimed\)/gi, "");
        txt = txt.replace(/【(?:行动选项|情节走向|后续走向)】[\s\S]*$/i, "");
        txt = txt.trim();
        if (!txt) continue;
        rounds.push({ n: idx, text: txt.slice(0, 220) });
      }
    }
    var ch = collectChronicle(v);
    var html = "";
    if (ch.length) {
      html += section("📜 世界大事记（正序）", ch.map(function (c) {
        return card(esc(c.name), fieldLine(c.fields) ? '<span class="ctx-sub">' + fieldLine(c.fields) + "</span>" : "");
      }).join(""), ch.length);
    }
    html += section("🕰 回合轨迹（倒序）", rounds.length ? rounds.reverse().map(function (r) {
      return card("第 " + r.n + " 回合", '<span class="ctx-sub">' + esc(r.text) + "…</span>");
    }).join("") : empty("尚未开始。"), rounds.length);
    return html;
  }

  function section(title, inner, count) {
    return '<div class="ctx-sec"><div class="ctx-sec-h">' + title + (count ? '<i class="ctx-count">' + count + "</i>" : "") + "</div>" + inner + "</div>";
  }
  function card(name, sub) {
    return '<div class="ctx-card"><b>' + name + "</b>" + (sub || "") + "</div>";
  }
  function empty(msg) {
    return '<div class="ctx-empty">' + esc(msg) + "</div>";
  }

  function render() {
    if (!el) return;
    var v = vars();
    var body = el.querySelector(".ctx-body");
    if (!body) return;
    body.innerHTML = curView === "cat" ? renderCategory(v) : renderTimeline(v);
    el.querySelectorAll(".ctx-tab").forEach(function (t) {
      t.classList.toggle("on", t.dataset.view === curView);
    });
  }

  function build() {
    if (el) return el;
    el = document.createElement("div");
    el.className = "ctx-panel";
    el.innerHTML =
      '<div class="ctx-mask" data-close="1"></div>' +
      '<div class="ctx-card-wrap">' +
      '<div class="ctx-head">' +
      '<b>📖 剧情上下文</b>' +
      '<div class="ctx-tabs">' +
      '<button class="ctx-tab" data-view="cat">分门别类</button>' +
      '<button class="ctx-tab" data-view="time">时间线</button>' +
      "</div>" +
      '<button class="ctx-x" data-close="1" title="关闭">✕</button>' +
      "</div>" +
      '<div class="ctx-body"></div>' +
      '<div class="ctx-foot">数据全部来自本地存档，不调用接口、不消耗额度</div>' +
      "</div>";
    el.addEventListener("click", function (e) {
      var t = e.target;
      if (t && t.dataset && t.dataset.close) {
        close();
        return;
      }
      if (t && t.classList && t.classList.contains("ctx-tab")) {
        curView = t.dataset.view || "cat";
        try {
          localStorage.setItem(KEY_VIEW, curView);
        } catch (err) {}
        render();
      }
    });
    document.body.appendChild(el);
    return el;
  }

  function open(view) {
    build();
    if (view) curView = view;
    try {
      curView = localStorage.getItem(KEY_VIEW) || curView || "cat";
    } catch (e) {}
    el.classList.add("show");
    render();
  }
  function close() {
    if (el) el.classList.remove("show");
  }
  function toggle() {
    if (el && el.classList.contains("show")) close();
    else open();
  }

  window.ContextPanel = { open: open, close: close, toggle: toggle, render: render };
})();
