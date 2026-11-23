/* ============================================================
   云境 · 左侧功能栏（LeftRail）  v6.8.0
   ------------------------------------------------------------
   目标（玩家原话）：「进入世界后正文左边是个大功能列表，一目了然，
   分组图标菜单并且可折叠」「太虚阁删掉，里面的功能列在正文界面那里」。

   设计：
   · 三栏时占据正文左侧一条窄栏；分组图标菜单，点击整组展开/折叠。
   · 数据来自运行期实际存在的全局模块（feature-detect），没有的条目自动隐藏，
     所以换世界 / 关掉某模块都不会出现点不动的死按钮。
   · 太虚阁 12 个模块不再经二级面板，直接在「沉浸」分组里一项一个入口，
     点击调 ImmersiveSuite.openTab(id)。
   · 只在进入世界后显示；身份设定台阶段隐藏。
   · 纯前端、零依赖、失败不影响主流程。
   ============================================================ */
(function (G) {
  "use strict";

  var VERSION = "6.8.0";
  var LS_KEY = "yunjingLeftRail";           // { collapsed:bool, groups:{g:bool} }
  var booted = false;

  function cfg() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function saveCfg(c) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(c)); } catch (e) {}
  }

  /* 一个入口＝{ icon, name, tip, run(), [need:()=>bool] }
     need 缺省为「对应全局对象存在」。 */
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

  /* 太虚阁 12 模块：直接 list 出来，点到哪开哪 */
  var IMMERSIVE = [
    entry("🎭", "众生相", "登场人物志", function () { immTab("gallery"); }, function () { return !!window.ImmersiveSuite; }),
    entry("🌌", "羁绊图", "人物关系网", function () { immTab("bonds"); }, function () { return !!window.ImmersiveSuite; }),
    entry("⛩", "境界梯", "境界 / 等级天梯", function () { immTab("realms"); }, function () { return !!window.ImmersiveSuite; }),
    entry("💎", "藏宝阁", "物品 / 法宝 / 战利品", function () { immTab("treasury"); }, function () { return !!window.ImmersiveSuite; }),
    entry("📜", "编年史", "按回目记大事", function () { immTab("chronicle"); }, function () { return !!window.ImmersiveSuite; }),
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
  function immTab(id) {
    var im = window.ImmersiveSuite;
    if (!im) return;
    try { im.openTab(id); im.toggle(true); } catch (e) {
      try { im.toggle(true); im.openTab(id); } catch (e2) {}
    }
  }

  /* 分组清单（去重后）：世界 / 角色 / 创作 / 沉浸 / 设置 */
  var GROUPS = [
    {
      id: "world", icon: "🌍", name: "世界", items: [
        entry("🗺", "行旅图鉴", "动态地图 · 足迹点亮", call("StoryAtlas", "toggle", true), has("StoryAtlas", "toggle")),
        entry("📚", "本界资料库", "世界观 / 设定 lore", call0("WorldBook", "open"), has("WorldBook", "open")),
        entry("🌊", "大势演化", "原著大势 / 因果可改", call0("CanonTimeline", "open"), has("CanonTimeline", "open")),
        entry("🌍", "世界动态", "远方事件推演", call0("DynamicWorld", "openPanel"), has("DynamicWorld", "openPanel")),
        entry("📖", "剧情上下文", "人物 / 伏笔 / 大事记", call0("ContextPanel", "open"), has("ContextPanel", "open"))
      ]
    },
    {
      id: "role", icon: "🎭", name: "角色", items: [
        entry("🐾", "灵宠伙伴", "契约 / 养成", call0("BeastSystem", "openUI"), has("BeastSystem", "openUI")),
        entry("🛡", "小队编成", "同伴 / 灵宠入队", call0("SquadSystem", "openUI"), has("SquadSystem", "openUI")),
        entry("🃏", "角色卡", "导出 / 导入 NPC 卡", call0("CardHub", "open"), has("CardHub", "open")),
        entry("🖼", "立绘本", "NPC 登场画像", call0("NpcPortrait", "open"), has("NpcPortrait", "open")),
        entry("🔗", "关系网", "可拖拽人物关系图", call0("RelationGraph", "open"), has("RelationGraph", "open"))
      ]
    },
    {
      id: "create", icon: "✒", name: "创作", items: [
        entry("⌛", "时光轴", "回档 / 重写任意回合", call0("TimeAxis", "open"), has("TimeAxis", "open")),
        entry("📑", "前情提要", "长篇记忆 / 压缩", call0("SummaryManager", "open"), has("SummaryManager", "open")),
        entry("🔬", "质检中心", "文风 / 伏笔 / 自审", call0("QualitySuite", "open"), has("QualitySuite", "open")),
        entry("🎲", "灵感骰子", "仙侠名词抽取", function () { try { window.Toolbox && Toolbox.act("dice"); } catch (e) {} }, function () { return !!(window.Toolbox && window.Toolbox.act); }),
        entry("📊", "状态面板", "章节 / 仪表盘总览", call0("StoryFramework", "updateStatusPanel"), function () { return !!window.StoryFramework; })
      ]
    },
    {
      id: "immerse", icon: "🎭", name: "沉浸", items: IMMERSIVE
    },
    {
      id: "tool", icon: "🧰", name: "工具", items: [
        entry("🎨", "主题工坊", "换阅读外观", call0("ThemeStudio", "open"), has("ThemeStudio", "open")),
        entry("🔤", "字体设置", "换正文字体 · 即时生效", call0("FontSwitcher", "open"), has("FontSwitcher", "open")),
        entry("🛡", "存档体检", "清理本地存储空间", function () { try { window.Toolbox && Toolbox.act("vault"); } catch (e) {} }, function () { return !!(window.Toolbox && window.Toolbox.act); }),
        entry("☰", "全部工具", "打开完整工具箱", call0("Toolbox", "open"), has("Toolbox", "open")),
        entry("⚙", "接口设置", "配置大模型通道", call0("ConfigModal", "open"), has("ConfigModal", "open"))
      ]
    }
  ];

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
    var html = '<div class="lr-head">' +
        '<button class="lr-toggle" id="lrToggle" title="折叠 / 展开功能栏">' +
          '<span class="lr-toggle-ico">' + (c.collapsed ? "»" : "«") + '</span>' +
          '<span class="lr-toggle-txt">功能</span>' +
        '</button></div>';
    html += '<div class="lr-groups">';
    GROUPS.forEach(function (g) {
      var visible = g.items.filter(function (it) { try { return !it.need || it.need(); } catch (e) { return false; } });
      if (!visible.length) return;
      var closed = !!cg[g.id];
      html += '<div class="lr-group' + (closed ? " closed" : "") + '" data-group="' + g.id + '">' +
          '<button class="lr-group-head" data-group="' + g.id + '"><span class="lr-gico">' + g.icon + '</span>' +
            '<span class="lr-gname">' + g.name + '</span><span class="lr-arrow">' + (closed ? "▸" : "▾") + '</span></button>' +
          '<div class="lr-items">' + visible.map(itemHTML).join("") + '</div></div>';
    });
    html += '</div>';
    if (c.collapsed) rail.classList.add("collapsed");
    else rail.classList.remove("collapsed");
    rail.innerHTML = html;
    wire(rail);
    syncVisibility();
  }

  function wire(rail) {
    rail.querySelectorAll(".lr-toggle").forEach(function (b) {
      b.addEventListener("click", function () {
        var c = cfg(); c.collapsed = !c.collapsed; saveCfg(c); render();
      });
    });
    rail.querySelectorAll(".lr-group-head").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-group"), c = cfg();
        c.groups = c.groups || {}; c.groups[id] = !c.groups[id]; saveCfg(c); render();
      });
    });
    rail.querySelectorAll(".lr-item").forEach(function (b) {
      b.addEventListener("click", function () {
        var name = b.getAttribute("data-name");
        var found = null;
        GROUPS.some(function (g) { return g.items.some(function (it) { if (it.name === name) { found = it; return true; } }); });
        if (found && typeof found.run === "function") {
          try { found.run(); } catch (e) { console.warn("[LeftRail] " + name + " 打开失败:", e && e.message); }
        }
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
    /* 观察 setupWrap / chatArea 的 display 变化，开局后自动显示左栏 */
    var target = document.getElementById("chatArea");
    if (target && window.MutationObserver) {
      var mo = new MutationObserver(function () { syncVisibility(); });
      mo.observe(target, { attributes: true, attributeFilter: ["style"] });
    }
    window.addEventListener("hashchange", syncVisibility);
    /* 懒加载模块（StoryAtlas / WorldBook / CanonTimeline / ImmersiveSuite / QualitySuite 等）
       在首屏之后才陆续就绪。刚 boot 时 need() 会误判为「模块不存在」而把条目过滤掉，
       于是左栏缺项。这里在若干时间点补渲染，确保模块到位后条目自动补齐。 */
    [400, 1200, 2600, 5000].forEach(function (ms) { setTimeout(render, ms); });
    /* 懒加载器每次装配一个全局后，也主动补一次 */
    if (window.addEventListener) {
      window.addEventListener("yj-lazy-ready", render);
    }
  }

  G.LeftRail = {
    version: VERSION,
    boot: boot,
    render: render,
    sync: syncVisibility,
    /* 供测试用的入口清单快照 */
    entries: function () {
      var out = [];
      GROUPS.forEach(function (g) {
        g.items.forEach(function (it) {
          var ok = false; try { ok = !it.need || it.need(); } catch (e) {}
          out.push({ group: g.id, name: it.name, enabled: ok });
        });
      });
      return out;
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window);
