/* ============================================================
 * 云境 · 小云技能中枢 xiaoyun-ops.js（v3.83.0）
 * ------------------------------------------------------------
 * 目标：云境有的，小云都要知道并且能做到；云境没有的，小云可以造出来。
 *
 * 结构：
 *   · TOOLS   —— 能力注册表：每个工具 {desc, args, fn}；
 *                fn(args) 统一返回 {ok:bool, msg:可读结果, data?}。
 *   · manifest() —— 给大模型的工具清单（系统提示用）。
 *   · call(name, args) —— 统一执行入口（LLM 工具循环与快捷按钮共用）。
 *   · repairText(text) —— 正文格式修复（去围栏/去开场白/标点归一/引号纠正/变量残留清理）。
 *
 * 原则：
 *   · 只在本机执行：所有工具操作 localStorage / 页面内存，无任何外发；
 *   · 每个工具返回可读结果，小云据此向玩家汇报；
 *   · 工具执行失败绝不静默覆盖数据。
 * ============================================================ */
(function () {
  "use strict";

  /* ---------------- 正文格式修复（纯函数，UI 与工具共用） ---------------- */
  function repairText(text) {
    var t = String(text == null ? "" : text);
    var changes = [];
    var before = t;
    /* 1. 去代码围栏与 markdown 残留 */
    if (/```/.test(t)) { t = t.replace(/```[a-zA-Z]*\n?/g, ""); changes.push("剥离代码围栏"); }
    if (/^#{1,6}\s/m.test(t)) { t = t.replace(/^#{1,6}\s+/gm, ""); changes.push("去除markdown标题符"); }
    if (/^\s*[-*]{3,}\s*$/m.test(t)) { t = t.replace(/^\s*[-*]{3,}\s*$/gm, ""); changes.push("去除分隔线"); }
    /* 2. 去 AI 开场白 / 收尾白 */
    var META = /^\s*(好的|当然|以下是|下面是|这是|为您|我来|当然可以|明白了|收到)[，,：:].{0,30}$/gm;
    if (META.test(t)) { t = t.replace(META, ""); changes.push("去除AI开场白"); }
    t = t.replace(/^\s*[（(]\s*(?:本章完|本段完|未完待续|待续|全文完)\s*[)）]\s*$/gm, function (m) { changes.push("去除收尾标注"); return ""; });
    /* 3. 变量/宏残留检测与清理 */
    var varLeft = t.match(/\{\{[^}]{1,60}\}\}/g);
    if (varLeft) { t = t.replace(/\{\{[^}]{1,60}\}\}/g, ""); changes.push("清理变量宏残留×" + varLeft.length + "（" + varLeft[0].slice(0, 18) + "…）"); }
    /* 4. 半角标点 → 全角（数字与小数点除外） */
    var p = t;
    t = t.replace(/([^\d0-9.])\.(\s|$|[\u4e00-\u9fff])/g, "$1。$2")
         .replace(/([^\d0-9]),([^\d0-9])/g, "$1，$2")
         .replace(/([^\d])\?(?!\d)/g, "$1？")
         .replace(/([^\d])!(?!\d)/g, "$1！")
         .replace(/([^\d]);/g, "$1；")
         .replace(/([^\d]):(?![\/\d])/g, "$1：");
    if (t !== p) changes.push("标点全角归一");
    /* 5. 直角引号：成对英文引号 → 中文引号 */
    var q = t;
    t = t.replace(/"([^"\n]{1,40})"/g, "「$1」").replace(/'([^'\n]{1,40})'/g, "「$1」");
    if (t !== q) changes.push("引号纠正");
    /* 6. 空行与首尾清理 */
    var b2 = t;
    t = t.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n").trim();
    if (t !== b2) changes.push("空行规整");
    if (!changes.length && t === before) return { ok: true, text: t, changes: [], msg: "正文格式本来就干净，没有需要修复的地方。" };
    if (!changes.length) changes.push("轻微清理");
    return { ok: true, text: t, changes: changes, msg: "已修复 " + changes.length + " 处：" + changes.join("、") + "。" };
  }

  /* ---------------- 变量体检 ---------------- */
  function walkVars(v, path, out, depth) {
    if (depth > 2 || v == null) return;
    if (typeof v === "number" && (!isFinite(v) || isNaN(v))) { out.push(path + " = " + String(v)); return; }
    if (typeof v === "string" && /\{\{|\}\}/.test(v)) { out.push(path + " 含宏残留"); return; }
    if (typeof v === "object") {
      for (var k in v) {
        if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
        if (String(v[k]) === "[object Object]" && typeof v[k] !== "object") { out.push(path + "." + k + " 异常序列化"); continue; }
        walkVars(v[k], path ? path + "." + k : k, out, depth + 1);
      }
    }
  }

  function fw() { return window.storyFramework || null; }
  function genreKey() {
    var c = fw() && fw().config;
    return (c && (c.genreKey || c.genre || c.id)) || (fw() && fw().genre) || "default";
  }

  /* ---------------- 能力注册表 ---------------- */
  var TOOLS = {
    /* —— 世界书 —— */
    "worldbook.list": {
      desc: "列出当前世界的世界书（本界资料库）条目", args: "可选 {cat:人物|势力|机缘|地理|设定|事件}",
      fn: function (a) {
        if (!window.WorldBook) return { ok: false, msg: "世界书系统未加载。" };
        var list = a && a.cat ? window.WorldBook.byCat(a.cat) : window.WorldBook.all();
        if (!list.length) return { ok: true, msg: "本界资料库还是空的，可以让我来补条目。", data: [] };
        var cats = {};
        list.forEach(function (e) { cats[e.cat] = (cats[e.cat] || 0) + 1; });
        var names = list.slice(0, 40).map(function (e) { return e.cat + "「" + e.name + "」"; });
        return { ok: true, msg: "共 " + list.length + " 条（" + Object.keys(cats).map(function (k) { return k + cats[k]; }).join("/") + "）：" + names.join("、") + (list.length > 40 ? " 等" : ""), data: list.map(function (e) { return { cat: e.cat, name: e.name }; }) };
      }
    },
    "worldbook.add": {
      desc: "向当前世界的世界书新增或更新一条条目（玩家也可以随时让我加）", args: "{cat, name, text}",
      fn: function (a) {
        if (!window.WorldBook) return { ok: false, msg: "世界书系统未加载。" };
        if (!a || !a.name || !a.text) return { ok: false, msg: "缺条目名或内容。" };
        var r = window.WorldBook.addEntry(a.cat || "设定", a.name, a.text, "user");
        return r ? { ok: true, msg: "已写入世界书：" + (a.cat || "设定") + "「" + a.name + "」。" }
                 : { ok: false, msg: "写入失败：条目名不能为空。" };
      }
    },
    "worldbook.remove": {
      desc: "从世界书删除一条条目", args: "{name}",
      fn: function (a) {
        if (!window.WorldBook) return { ok: false, msg: "世界书系统未加载。" };
        var hit = window.WorldBook.all().filter(function (e) { return e.name === (a && a.name); })[0];
        if (!hit) return { ok: false, msg: "没找到条目「" + ((a && a.name) || "?") + "」。" };
        window.WorldBook.removeEntry(hit.id);
        return { ok: true, msg: "已删除条目「" + hit.name + "」。" };
      }
    },
    "worldbook.harvest": {
      desc: "把当前故事里已登场的人物/机缘/大事记一键归档进世界书", args: "{}",
      fn: function () {
        if (!window.WorldBook) return { ok: false, msg: "世界书系统未加载。" };
        var n = window.WorldBook.harvestFromStory();
        return { ok: true, msg: n ? "已从当前故事归档 " + n + " 条进世界书。" : "故事里暂无可归档的新内容。" };
      }
    },
    /* —— 预设与正则 —— */
    "preset.info": {
      desc: "查看当前生效的主笔预设（内置云起 / 玩家导入的第三方酒馆预设）", args: "{}",
      fn: function () {
        if (!window.YunjingPresetIO) return { ok: false, msg: "预设系统未加载。" };
        var i = window.YunjingPresetIO.info();
        return { ok: true, msg: "当前预设：" + i.name + (i.version ? " v" + i.version : "") + "（" + (i.source === "custom" ? "玩家导入" : "内置云起") + "，" + i.blocks + " 块 / " + i.chars + " 字）" + (i.file ? "，来自文件 " + i.file : ""), data: i };
      }
    },
    "preset.restoreBuiltin": {
      desc: "放弃导入的第三方预设，一键还原内置云起预设", args: "{}",
      fn: function () {
        if (!window.YunjingPresetIO) return { ok: false, msg: "预设系统未加载。" };
        var i = window.YunjingPresetIO.useBuiltin();
        return { ok: true, msg: "已还原内置云起预设（" + i.blocks + " 块）。" };
      }
    },
    "preset.importText": {
      desc: "导入一份第三方（酒馆/SillyTavern 格式）预设 JSON 文本并整份替换当前预设", args: "{json}",
      fn: function (a) {
        if (!window.YunjingPresetIO) return { ok: false, msg: "预设系统未加载。" };
        if (!a || !a.json) return { ok: false, msg: "缺少预设 JSON 文本。" };
        try {
          var i = window.YunjingPresetIO.importText(a.json, (a.name || "小云导入的预设") + ".json");
          return { ok: true, msg: "第三方预设导入成功并已适配：" + i.name + "（" + i.blocks + " 块 / " + i.chars + " 字）" + (i.regexes ? "，配套正则 " + i.regexes + " 条已自动装载。" : "。引擎宏适配层已保障不掉格式。"), data: i };
        } catch (e) { return { ok: false, msg: "导入失败：" + e.message + "（原预设未被覆盖，可放心重试）。" }; }
      }
    },
    "regex.info": {
      desc: "查看当前装载的正文渲染正则数量", args: "{}",
      fn: function () {
        var n = 0;
        try { var raw = localStorage.getItem("yunjingRegexCustom"); n = raw ? (JSON.parse(raw) || []).length : 0; } catch (e) {}
        return { ok: true, msg: "当前玩家自定义正则 " + n + " 条（第三方预设的配套正则导入预设时会自动带上）。" };
      }
    },
    "regex.importText": {
      desc: "导入一段酒馆格式正则 JSON 文本", args: "{json}",
      fn: function (a) {
        if (!window.YunjingRegexIO) return { ok: false, msg: "正则系统未加载。" };
        if (!a || !a.json) return { ok: false, msg: "缺少正则 JSON 文本。" };
        try {
          var r = window.YunjingRegexIO.importText(a.json, a.name || "小云导入的正则");
          return { ok: true, msg: "正则导入成功。", data: r };
        } catch (e) { return { ok: false, msg: "导入失败：" + e.message }; }
      }
    },
    /* —— 存档 —— */
    "saves.list": {
      desc: "列出本世界所有存档槽（书档）及其进度", args: "{}",
      fn: function () {
        if (!window.SaveSlots) return { ok: false, msg: "存档系统未加载。" };
        var rows = window.SaveSlots.list();
        var act = window.SaveSlots.activeId();
        var s = rows.map(function (r) {
          return (r.id === act ? "▶ " : "　") + r.name + (r.title ? "《" + r.title + "》" : "") + (r.chapter ? " 第" + r.chapter + "章" : "") + (r.wordCount ? " " + r.wordCount + "字" : "") + (window.SaveSlots.hasSave(r.id) ? "" : "（空）");
        });
        return { ok: true, msg: "本界共 " + rows.length + " 个书档：\n" + s.join("\n"), data: rows };
      }
    },
    "saves.ui": {
      desc: "打开存档管理界面（切换/新建/导出/导入）", args: "{}",
      fn: function () {
        if (!window.SaveSlots) return { ok: false, msg: "存档系统未加载。" };
        try { window.SaveSlots.open(); return { ok: true, msg: "已打开存档管理面板。" }; }
        catch (e) { return { ok: false, msg: "打开失败：" + e.message }; }
      }
    },
    /* —— 变量与正文 —— */
    "vars.check": {
      desc: "体检当前故事变量（NaN/宏残留/异常序列化）", args: "{}",
      fn: function () {
        var f = fw();
        if (!f || !f.storyState) return { ok: false, msg: "当前没有打开的故事。" };
        var out = [];
        walkVars(f.storyState.variables || {}, "", out, 0);
        var v = f.storyState.variables || {};
        var head = "书名《" + (v.title || "未命名") + "》 第" + (v.chapter || 0) + "章 · " + (v.wordCount || 0) + " 字。";
        return { ok: true, msg: out.length ? head + "发现 " + out.length + " 处变量异常：" + out.slice(0, 8).join("；") : head + "变量体检全部正常。", data: out };
      }
    },
    "format.repair": {
      desc: "修复一段正文的格式（去AI腔/去围栏/标点归一/清宏残留）；不传 text 则修复最近一条AI正文", args: "可选 {text}",
      fn: function (a) {
        var text = a && a.text;
        if (!text) {
          var f = fw();
          var msgs = f && f.storyState && f.storyState.messages;
          if (Array.isArray(msgs)) { for (var i = msgs.length - 1; i >= 0; i--) { if (msgs[i] && msgs[i].role !== "user" && msgs[i].content) { text = msgs[i].content; break; } } }
        }
        if (!text) return { ok: false, msg: "没有可修复的正文：当前没有打开的故事，也没有传入文本。" };
        var r = repairText(text);
        if (a && a.text) r.applied = true;
        return r;
      }
    },
    /* —— 系统 —— */
    "system.status": {
      desc: "工坊全面体检：各系统加载状态 + 小云开发接口状态", args: "{}",
      fn: function () {
        var ck = function (n) { return window[n] ? "✅" : "—"; };
        var api = "未接入（可在造物工坊里接入大模型 API 解锁我的全部开发力）";
        try { var c = JSON.parse(localStorage.getItem("xy_dev_cfg") || "{}"); if (c.k && c.u) api = "已接入 " + (c.m || "自定义模型"); } catch (e) {}
        return { ok: true, msg: "工坊体检：世界书 " + ck("WorldBook") + " · 存档 " + ck("SaveSlots") + " · 预设 " + ck("YunjingPresetIO") + " · 正则 " + ck("YunjingRegexIO") + " · 机缘账本 " + ck("CanonLedger") + " · 造物工坊 " + ck("XYDev") + "。\n我的开发接口：" + api + "。" };
      }
    },
    "ui.worldbook": {
      desc: "打开世界书面板（玩家可手动增补条目）", args: "{}",
      fn: function () { if (!window.WorldBook) return { ok: false, msg: "世界书系统未加载。" }; window.WorldBook.open(); return { ok: true, msg: "已打开世界书面板。" }; }
    },
    "ui.devforge": {
      desc: "打开造物工坊（小云独立开发新模块 / 写入项目源码）", args: "{}",
      fn: function () { if (window.XYDev) { window.XYDev.open(); return { ok: true, msg: "造物工坊已打开。" }; } return { ok: false, msg: "造物工坊未加载。" }; }
    }
  };

  /* ---------------- 对外接口 ---------------- */
  function manifest() {
    return Object.keys(TOOLS).map(function (k) { return k + "：" + TOOLS[k].desc + (TOOLS[k].args && TOOLS[k].args !== "{}" ? "（参数 " + TOOLS[k].args + "）" : ""); });
  }
  function call(name, args) {
    var t = TOOLS[name];
    if (!t) return { ok: false, msg: "没有这个能力：" + name };
    try { return t.fn(args || {}); }
    catch (e) { return { ok: false, msg: "执行出错：" + (e && e.message || e) }; }
  }
  function names() { return Object.keys(TOOLS); }

  window.XiaoyunOps = {
    call: call,
    manifest: manifest,
    names: names,
    repairText: repairText,
    genreKey: genreKey
  };
})();
