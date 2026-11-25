/* ============================================================
   云境 · 左侧功能栏（LeftRail）  v6.9.0
   ------------------------------------------------------------
   玩家原话（v6.9.0）：
   「云境结合了酒馆卡玩法和小说创作玩法，把两种玩法的功能分类区分开，
     玩卡就在功能列表全都是卡的功能，写小说就在一个列表里全是写小说的功能」
   「功能列表和工具箱里面的东西不要重合」

   设计：
   · 顶部两个模式按钮：🎴 玩卡 / ✒ 写小说。切换后左栏只显示该模式的功能组。
   · 每个模式内部仍按小类分组，图标 + 文字，可折叠。
   · 去重：左栏（主入口）保留功能；工具箱里相同的入口移除（见 studio.html）。
   · 太虚阁 12 模块并入「玩卡·沉浸」组，仍是直达入口。
   · 只在进入世界后显示。
   · 纯前端、零依赖、失败不影响主流程。
   ============================================================ */
(function (G) {
  "use strict";

  var VERSION = "6.9.0";
  var LS_KEY = "yunjingLeftRail";           // { mode:'card'|'novel', collapsed, groups:{} }

  function cfg() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function saveCfg(c) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(c)); } catch (e) {}
  }
  function mode() { return cfg().mode === "card" ? "card" : "novel"; }

  function entry(icon, name, tip, run, need) {
    return { icon: icon, name: name, tip: tip, run: run, need: need };
  }
  function has(obj, method) {
    return function () {
      var o = window[obj];
      if (!o) return false;
      return !method || typeof o[method] === "function";
    };
  }
  function call(obj, method, arg) {
    return function () {
      var o = window[obj];
      if (!o || typeof o[method] !== "function") return;
      try { o[method](arg); } catch (e) {}
    };
  }
  function call0(obj, method) {
    return function () {
      var o = window[obj];
      if (!o || typeof o[method] !== "function") return;
      try { o[method](); } catch (e) {}
    };
  }
  function immTab(id) {
    var im = window.ImmersiveSuite;
    if (!im) return;
    try { im.openTab(id); im.toggle(true); } catch (e) {
      try { im.toggle(true); im.openTab(id); } catch (e2) {}
    }
  }
  function toolbox(act) {
    return function () { try { if (window.Toolbox && Toolbox.act) Toolbox.act(act); } catch (e) {} };
  }

  /* 太虚阁 12 模块 → 并入玩卡·沉浸 */
  var IMMERSIVE = [
    entry("🎭", "众生相", "登场人物志", function () { immTab("gallery"); }, function () { return !!window.ImmersiveSuite; }),
    entry("🌌", "羁绊速览", "沉浸式关系一览（跟剧情走）", function () { immTab("bonds"); }, function () { return !!window.ImmersiveSuite; }),
    entry("⛩", "境界梯", "境界 / 等级天梯", function () { immTab("realms"); }, function () { return !!window.ImmersiveSuite; }),
    entry("💎", "藏宝阁", "物品 / 法宝 / 战利品", function () { immTab("treasury"); }, function () { return !!window.ImmersiveSuite; }),
    entry("📜", "章节大事记", "按回目串起剧情大事", function () { immTab("chronicle"); }, function () { return !!window.ImmersiveSuite; }),
    entry("✉", "传书", "书信 / 传讯", function () { immTab("letters"); }, function () { return !!window.ImmersiveSuite; }),
    entry("⏳", "倒计时", "事件倒计时", function () { immTab("events"); }, function () { return !!window.ImmersiveSuite; }),
    entry("⭐", "名场面", "高光时刻收藏", function () { immTab("highlights"); }, function () { return !!window.ImmersiveSuite; }),
    entry("⚔", "战报", "战斗记录", function () { immTab("battles"); }, function () { return !!window.ImmersiveSuite; }),
    entry("☯", "天道", "天道 / 成就", function () { immTab("dao"); }, function () { return !!window.ImmersiveSuite; }),
    entry("🌐", "世界线", "分支 / 世界线", function () { immTab("lines"); }, function () { return !!window.ImmersiveSuite; }),
    entry("🧬", "界专属", "本世界专属模块", function () { immTab("ext"); }, function () {
      return !!window.ImmersiveSuite && !!(window.WorldExt && window.WorldExt.hasModules && window.WorldExt.hasModules());
    })
  ];

  /* ===== 玩卡模式：全是「角色 / 卡牌 / 扮演」相关 ===== */
  var CARD_GROUPS = [
    {
      id: "cardrole", icon: "🎴", name: "角色与卡", items: [
        entry("🃏", "角色卡", "导出 / 导入 NPC 卡", call0("CardHub", "open"), has("CardHub", "open")),
        entry("🖼", "立绘本", "NPC 登场画像", call0("NpcPortrait", "open"), has("NpcPortrait", "open")),
        entry("🔗", "关系网·可拖拽", "完整人物关系图（可拖拽编辑）", call0("RelationGraph", "open"), has("RelationGraph", "open")),
        entry("🐾", "灵宠伙伴", "契约 / 养成", call0("BeastSystem", "openUI"), has("BeastSystem", "openUI")),
        entry("🛡", "小队编成", "同伴 / 灵宠入队", call0("SquadSystem", "openUI"), has("SquadSystem", "openUI"))
      ]
    },
    {
      id: "cardrole2", icon: "📇", name: "角色档案", items: [
        entry("🧬", "性格世界书", "全界人物性格设定", function () { try { if (window.PersonalityCodexUI) PersonalityCodexUI.open(); } catch (e) {} }, function () { return !!window.PersonalityCodexUI; }),
        entry("📅", "角色生平志", "单个 NPC 生平 / 态度 / 离场", function () { try { if (window.NPCChronicleUI) NPCChronicleUI.open(); } catch (e) {} }, function () { return !!window.NPCChronicleUI; }),
        entry("💞", "动态关系 R18", "五维关系 / 表达尺度", function () { try { if (window.IntimacyUI) IntimacyUI.open(); } catch (e) {} }, function () { return !!window.IntimacyUI; }),
        entry("🎯", "行动判定骰", "骰点 + 属性判成败", function () { try { if (window.ActionCheck) ActionCheck.open(); } catch (e) {} }, function () { return !!window.ActionCheck; }),
        entry("📈", "成长账本", "六维增减留痕", function () { try { if (window.GrowthLedger) GrowthLedger.open(); } catch (e) {} }, function () { return !!window.GrowthLedger; })
      ]
    },
    {
      id: "cardplay", icon: "🎭", name: "扮演设定", items: [
        entry("🌀", "玩家身份", "穿越者 / 本地人 · 点按切换", function () { try { if (window.StoryIdentity) { StoryIdentity.cycleIdentity(); LeftRail.say("玩家身份已切换"); } } catch (e) {} }, function () { return !!window.StoryIdentity; }),
        entry("👑", "叙事立场", "取代主角 / 同行 / 搅局", function () { try { if (window.StoryStance) { StoryStance.cycle(); LeftRail.say("叙事立场已切换"); } } catch (e) {} }, function () { return !!window.StoryStance; }),
        entry("📱", "手机分身", "聊天 / 朋友圈", call0("PhonePanel", "open"), function () { return !!window.PhonePanel; })
      ]
    },
    {
      id: "cardimmerse", icon: "🌌", name: "沉浸记录", items: IMMERSIVE
    }
  ];

  /* ===== 写小说模式：全是「创作 / 世界 / 叙事工具」相关 ===== */
  var NOVEL_GROUPS = [
    {
      id: "novelworld", icon: "🌍", name: "世界设定", items: [
        entry("🗺", "行旅图鉴", "动态地图 · 足迹点亮", call("StoryAtlas", "toggle", true), has("StoryAtlas", "toggle")),
        entry("📚", "本界资料库", "世界观 / 设定 lore", call0("WorldBook", "open"), has("WorldBook", "open")),
        entry("🌊", "大势演化", "原著大势 / 因果可改", call0("CanonTimeline", "open"), has("CanonTimeline", "open")),
        entry("🌍", "世界动态", "远方事件推演", call0("DynamicWorld", "openPanel"), has("DynamicWorld", "openPanel")),
        entry("📖", "剧情上下文", "人物 / 伏笔 / 大事记", call0("ContextPanel", "open"), has("ContextPanel", "open"))
      ]
    },
    {
      id: "novelwrite", icon: "✒", name: "创作工具", items: [
        entry("⌛", "时光轴", "回档 / 重写任意回合", call0("TimeAxis", "open"), has("TimeAxis", "open")),
        entry("📑", "前情提要", "长篇记忆 / 压缩", call0("SummaryManager", "open"), has("SummaryManager", "open")),
        entry("🔬", "质检中心", "文风 / 伏笔 / 自审", call0("QualitySuite", "open"), has("QualitySuite", "open")),
        entry("📖", "章节目录", "按章跳转 / 搜索", toolbox("toc"), function () { return !!(window.Toolbox && Toolbox.act); }),
        entry("📊", "质量仪表", "对话密度 / 三幕结构", toolbox("meter"), function () { return !!(window.Toolbox && Toolbox.act); })
      ]
    },
    {
      id: "novelread", icon: "📖", name: "阅读与外观", items: [
        entry("🔤", "字体设置", "换正文字体 · 即时生效", call0("FontSwitcher", "open"), has("FontSwitcher", "open")),
        entry("🎨", "主题工坊", "换阅读外观", call0("ThemeStudio", "open"), has("ThemeStudio", "open")),
        entry("🌙", "深夜护眼", "暖光低亮滤镜", toolbox("night"), function () { return !!(window.Toolbox && Toolbox.act); }),
        entry("⚡", "流畅模式", "低配设备提速", toolbox("perf"), function () { return !!(window.Toolbox && Toolbox.act); }),
        entry("🔊", "朗读正文", "朗读最近一章", toolbox("tts"), function () { return !!(window.Toolbox && Toolbox.act); })
      ]
    },
    {
      id: "novelcfg", icon: "⚙", name: "设置与调试", items: [
        entry("🔑", "接口设置", "配置大模型通道", toolbox("config"), function () { return !!(window.Toolbox && Toolbox.act); }),
        entry("🛡", "存档体检", "存储 / 存档完整性", toolbox("checkup"), function () { return !!(window.Toolbox && Toolbox.act); }),
        entry("🔍", "提示词调试", "看本轮模型收到什么", toolbox("promptlab"), function () { return !!(window.Toolbox && Toolbox.act); }),
        entry("📊", "调用与消耗", "token / 花费估算", toolbox("usage"), function () { return !!(window.Toolbox && Toolbox.act); }),
        entry("🧩", "二创版块", "浏览 / 发布二创", toolbox("creationhub"), function () { return !!(window.Toolbox && Toolbox.act); })
      ]
    },
    {
      id: "novelstore", icon: "💾", name: "存档与导出", items: [
        entry("📚", "多存档书架", "一个世界多本书", toolbox("slots"), function () { return !!(window.Toolbox && Toolbox.act); }),
        entry("📝", "导出 TXT", "纯文本正文", toolbox("txt"), function () { return !!(window.Toolbox && Toolbox.act); }),
        entry("📄", "导出 Markdown", "带书名 / 字数", toolbox("md"), function () { return !!(window.Toolbox && Toolbox.act); }),
        entry("🗂", "导出存档", "含进度与变量", toolbox("save"), function () { return !!(window.Toolbox && Toolbox.act); }),
        entry("📥", "导入存档", "读取 JSON 进度", toolbox("import"), function () { return !!(window.Toolbox && Toolbox.act); })
      ]
    }
  ];

  function groupsForCurrentMode() { return mode() === "card" ? CARD_GROUPS : NOVEL_GROUPS; }

  function started() {
    try {
      var fw = window.storyFramework;
      return !!(fw && fw.storyState && fw.storyState.isStoryStarted);
    } catch (e) { return false; }
  }
  function railEl() { return document.getElementById("leftRail"); }
  function itemHTML(it) {
    return '<button class="lr-item" data-name="' + esc(it.name) + '" title="' + esc(it.tip || it.name) + '">' +
             '<span class="lr-ico">' + it.icon + '</span><span class="lr-label">' + esc(it.name) + '</span>' +
           '</button>';
  }

  function render() {
    var rail = railEl();
    if (!rail) return;
    var c = cfg(), cg = c.groups || {};
    var m = mode();
    var html = '<div class="lr-head">' +
        '<button class="lr-toggle" id="lrToggle" title="折叠 / 展开功能栏">' +
          '<span class="lr-toggle-ico">' + (c.collapsed ? "»" : "«") + '</span>' +
          '<span class="lr-toggle-txt">功能</span></button></div>';
    /* 两种玩法模式切换 */
    html += '<div class="lr-modes" role="tablist">' +
        '<button class="lr-mode' + (m === "card" ? " on" : "") + '" data-mode="card" role="tab">🎴 玩卡</button>' +
        '<button class="lr-mode' + (m === "novel" ? " on" : "") + '" data-mode="novel" role="tab">✒ 写小说</button>' +
      '</div>';
    html += '<div class="lr-groups">';
    groupsForCurrentMode().forEach(function (g) {
      var visible = g.items.filter(function (it) { try { return !it.need || it.need(); } catch (e) { return false; } });
      if (!visible.length) return;
      var closed = !!cg[g.id];
      html += '<div class="lr-group' + (closed ? " closed" : "") + '" data-group="' + g.id + '">' +
          '<button class="lr-group-head" data-group="' + g.id + '"><span class="lr-gico">' + g.icon + '</span>' +
            '<span class="lr-gname">' + g.name + '</span><span class="lr-arrow">' + (closed ? "▸" : "▾") + '</span></button>' +
          '<div class="lr-items">' + visible.map(itemHTML).join("") + '</div></div>';
    });
    html += '</div>';
    if (c.collapsed) rail.classList.add("collapsed"); else rail.classList.remove("collapsed");
    rail.innerHTML = html;
    wire(rail);
    syncVisibility();
  }

  function wire(rail) {
    rail.querySelectorAll(".lr-toggle").forEach(function (b) {
      b.addEventListener("click", function () { var c = cfg(); c.collapsed = !c.collapsed; saveCfg(c); render(); });
    });
    rail.querySelectorAll(".lr-mode").forEach(function (b) {
      b.addEventListener("click", function () {
        var c = cfg(); c.mode = b.getAttribute("data-mode"); saveCfg(c); render();
        try { window.dispatchEvent(new CustomEvent("yj-mode-change", { detail: { mode: c.mode } })); } catch (e) {}
      });
    });
    rail.querySelectorAll(".lr-group-head").forEach(function (b) {
      b.addEventListener("click", function (e) {
        var id = b.getAttribute("data-group"), c = cfg();
        var el = rail.querySelector('.lr-group[data-group="' + id + '"]');
        var railNow = railEl();
        var slim = !!(railNow && railNow.classList.contains("collapsed")) ||
          !!(window.matchMedia && window.matchMedia("(max-width:900px)").matches);
        if (slim && el) {
          /* v7.0.0 组1-T03：折叠态/窄屏点图标弹临时浮层；再点收起，任意时刻只开一个。
             旧逻辑切 closed 状态，但 items 被 !important 隐藏，点了没有任何可见反馈。 */
          e.stopPropagation();
          var willOpen = !el.classList.contains("peek");
          rail.querySelectorAll(".lr-group.peek").forEach(function (g) { g.classList.remove("peek"); });
          if (willOpen) el.classList.add("peek");
          return;
        }
        c.groups = c.groups || {}; c.groups[id] = !c.groups[id]; saveCfg(c); render();
      });
    });
    rail.querySelectorAll(".lr-item").forEach(function (b) {
      b.addEventListener("click", function (e) {
        var name = b.getAttribute("data-name");
        var found = null;
        groupsForCurrentMode().some(function (g) { return g.items.some(function (it) { if (it.name === name) { found = it; return true; } }); });
        if (found && typeof found.run === "function") {
          try { found.run(); } catch (err) { console.warn("[LeftRail] " + name + " 打开失败:", err && err.message); }
        }
        /* v7.0.0 组1-T03：点过即高亮，并收起临时浮层 */
        e.stopPropagation();
        rail.querySelectorAll(".lr-item.active").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        var peeking = b.closest ? b.closest(".lr-group.peek") : null;
        if (peeking) peeking.classList.remove("peek");
      });
    });
  }

  function syncVisibility() {
    var rail = railEl();
    if (!rail) return;
    var show = started();
    rail.style.display = show ? "" : "none";
    document.body.classList.toggle("has-left-rail", show);
  }
  function say(msg) { try { if (window.showToast) showToast(msg, "success"); } catch (e) {} }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
    });
  }

  function boot() {
    if (booted) return;
    booted = true;
    var host = document.getElementById("leftRail");
    if (!host) {
      host = document.createElement("div");
      host.id = "leftRail";
      host.className = "left-rail";
      var layout = document.querySelector(".main-layout");
      if (layout) layout.insertBefore(host, layout.firstChild);
    }
    render();
    /* v7.0.0 组1-T03：点浮层外任意处收起临时浮层，避免浮层一直挂着吞点击 */
    document.addEventListener("click", function (e) {
      var railNow = railEl();
      if (!railNow) return;
      var peeks = railNow.querySelectorAll(".lr-group.peek");
      if (!peeks.length) return;
      var t = e.target;
      if (t && t.closest && t.closest(".lr-group.peek")) return;
      peeks.forEach(function (g) { g.classList.remove("peek"); });
    });
    var target = document.getElementById("chatArea");
    if (target && window.MutationObserver) {
      var mo = new MutationObserver(function () { syncVisibility(); });
      mo.observe(target, { attributes: true, attributeFilter: ["style"] });
    }
    window.addEventListener("hashchange", syncVisibility);
    [400, 1200, 2600, 5000].forEach(function (ms) { setTimeout(render, ms); });
    if (window.addEventListener) window.addEventListener("yj-lazy-ready", render);
  }
  var booted = false;

  G.LeftRail = {
    version: VERSION,
    boot: boot, render: render, sync: syncVisibility, say: say,
    mode: mode,
    setMode: function (m) { var c = cfg(); c.mode = m === "card" ? "card" : "novel"; saveCfg(c); render(); },
    entries: function () {
      var out = [];
      [["card", CARD_GROUPS], ["novel", NOVEL_GROUPS]].forEach(function (pair) {
        pair[1].forEach(function (g) {
          g.items.forEach(function (it) {
            var ok = false; try { ok = !it.need || it.need(); } catch (e) {}
            out.push({ mode: pair[0], group: g.id, name: it.name, enabled: ok });
          });
        });
      });
      return out;
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window);
