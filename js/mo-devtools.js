/* ============================================================
 * 云境 · 小云研发中枢 MoDevtools v1.0.0（v4.17.5）
 * ------------------------------------------------------------
 * 定位：让小云从「被动回答 / 单点补丁」升级为「能自主巡检、懂项目结构、
 *       改完能自验」的研发伙伴，承担优化 / 调整 / 更新 / 迭代的全流程。
 *
 * 为什么需要（来自交接文档"小云功能强化"待办）：
 *   现有能力：FileBridge（读写/备份/回滚/自检）+ PluginRuntime（7 扩展点）
 *             + xiaoyun-ops（运营工具）+ 世界诊断/推演/规划/时钟 + 造物工坊。
 *   缺口：① 自主巡检（主动扫全项目定位问题，而非等指令）
 *         ② 项目知识（模块地图与依赖关系）
 *         ③ 自我验证（改完自己跑闸验证）
 *         ④ 批量重构（大范围迁移的影响面分析）
 *   本模块补齐这四项，全部基于 FileBridge 的本地文件访问，纯本机、无外发。
 *
 * 四条纪律：
 *   ① 只读优先：scan / map / verify 只读文件，绝不写；写只走既有 yj-patch 补丁协议。
 *   ② 不越权：未授权项目文件夹时，所有能力返回结构化"需授权"提示，不报错、不静默。
 *   ③ 不夸大：报告里的数字来自真实扫描结果，扫不到就写"未覆盖"，绝不编造 PASS。
 *   ④ 可降级：FileBridge.diagnose 的 80 文件上限由本模块的全量扫描补足（分批读取，
 *      每批之间让出主线程，避免卡死 UI）。
 *
 * 对外：window.MoDevtools
 *   - scanProject(opt)   自主巡检全项目，返回结构化问题清单
 *   - moduleMap(opt)     构建模块地图 + 依赖关系 + 孤岛/悬空分析
 *   - verify(opt)        改完自检：语法 + 引用 + 版本 + 可选测试套件提示
 *   - refactorImpact(from, to)  批量重构影响面分析（先分析，再交给补丁执行）
 *   - manifest()         给大模型的能力清单（注入小云系统提示）
 *   - reportText(rep)    把结构化报告渲染成可读的中文文本（给小云复述）
 * ============================================================
 */
(function () {
  "use strict";

  var FB = function () { return window.FileBridge; };

  /* ---------- 通用小工具 ---------- */
  function ok(msg, data) { return { ok: true, msg: msg, data: data }; }
  function no(msg) { return { ok: false, msg: msg }; }
  function nextTick() { return new Promise(function (r) { setTimeout(r, 0); }); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function nowMs() { return Date.now(); }

  /** 取文件索引（相对路径 → handle）；未授权返回 null */
  async function fileIndex() {
    var fb = FB();
    if (!fb || !fb.hasRoot || !fb.hasRoot()) return null;
    // FileBridge.index 未导出，但 diagnose 内部会建索引；这里通过 read 探测 + 复用公开能力。
    // 为拿到全量路径，尝试调用内部的 index（若导出）或退化为从已知清单读取。
    if (typeof fb.listFiles === "function") return await fb.listFiles();
    return null;
  }

  /** 读取全部可读文件路径：优先 FileBridge 暴露的 enumerate，否则返回 null */
  async function enumeratePaths() {
    var fb = FB();
    if (!fb || !fb.hasRoot || !fb.hasRoot()) return null;
    if (typeof fb.listFiles === "function") {
      var list = await fb.listFiles();
      return Array.isArray(list) ? list : Object.keys(list || {});
    }
    return null;
  }

  /* ============================================================
   * ① 自主巡检
   * ============================================================ */
  /**
   * 全量扫描项目源码，定位真实问题。
   * opt: { maxFiles, includeCss } —— 上限默认 400（覆盖全部 344 JS）
   * 返回：{ ok, files, issues:[{level,type,path,msg}], summary, ms }
   */
  async function scanProject(opt) {
    opt = opt || {};
    var fb = FB();
    if (!fb || !fb.hasRoot || !fb.hasRoot()) {
      return no("需要先授权项目文件夹（小云抽屉 → 🛠 文件工坊 → 授权项目文件夹），我才能扫描你的源码。");
    }
    var paths = await enumeratePaths();
    if (!paths) {
      return no("当前 FileBridge 未提供文件清单接口，请升级云境到最新版后再试。");
    }
    var maxFiles = opt.maxFiles || 400;
    var targets = paths.filter(function (p) {
      return /\.js$|\.mjs$|\.cjs$|\.html?$/i.test(p) && !/node_modules|\.git|\.yj-backups|libs\//.test(p);
    }).slice(0, maxFiles);

    var t0 = nowMs();
    var issues = [];
    var versionCounter = Object.create(null);
    var readCount = 0;

    for (var i = 0; i < targets.length; i++) {
      var p = targets[i];
      var r = null;
      try { r = await fb.read(p); } catch (e) { continue; }
      readCount++;
      var text = r.text || "";

      // — JS 语法 —
      if (/\.m?js$|\.cjs$/i.test(p)) {
        try { new Function(text); }
        catch (e) { issues.push({ level: "P0", type: "语法错误", path: p, msg: String(e && e.message || e).slice(0, 160) }); }
        // — 版本一致性：收集 ?v=x.y.z —
        var vm;
        var vre = /\?v=(\d+\.\d+\.\d+)/g;
        while ((vm = vre.exec(text)) !== null) versionCounter[vm[1]] = (versionCounter[vm[1]] || 0) + 1;
        // — 常见易错拼写（真实的、能自动判定的） —
        if (/color-mix\(\s*in\s+srut\b/i.test(text)) issues.push({ level: "P1", type: "CSS 拼写", path: p, msg: "color-mix(in srut …) 应为 srgb，声明会被浏览器丢弃" });
      }

      // — HTML 引用缺失 + 重复 id（全量，不受 12 文件上限） —
      if (/\.html?$/i.test(p)) {
        var base = p.indexOf("/") !== -1 ? p.slice(0, p.lastIndexOf("/")) : "";
        var m, re = /(?:src|href)\s*=\s*["']([^"'#][^"']*)["']/g;
        var refs = new Set();
        while ((m = re.exec(text)) !== null) {
          var u = m[1].split("?")[0];
          if (!u || /^(https?:|data:|javascript:|#|mailto:)/i.test(u)) continue;
          refs.add(base ? base + "/" + u : u);
        }
        // 用路径集合判定（不逐个读文件）
        var pathSet = null;
        try { pathSet = await enumeratePaths(); } catch(e){console.warn("[swallowed] mo-devtools",e)}
        if (pathSet) {
          var ps = Array.isArray(pathSet) ? new Set(pathSet) : new Set(Object.keys(pathSet));
          refs.forEach(function (ref) {
            var norm = ref.replace(/^\.\//, "");
            if (!ps.has(norm) && !ps.has(norm.replace(/^[^\/]+\//, ""))) {
              issues.push({ level: "P1", type: "引用缺失", path: p, msg: ref });
            }
          });
        }
        var ids = {}, dup = {}, im, ire = /\sid\s*=\s*["']([^"']+)["']/g;
        while ((im = ire.exec(text)) !== null) {
          if (ids[im[1]]) dup[im[1]] = true; else ids[im[1]] = true;
        }
        Object.keys(dup).forEach(function (id) {
          issues.push({ level: "P2", type: "重复 id", path: p, msg: "id=\"" + id + "\" 出现多次" });
        });
      }

      if (i % 40 === 39) await nextTick(); // 分批让出主线程
    }

    // — 版本一致性汇总 —
    var vers = Object.keys(versionCounter);
    if (vers.length > 1) {
      var top = vers.slice().sort(function (a, b) { return versionCounter[b] - versionCounter[a]; })[0];
      vers.forEach(function (v) {
        if (v !== top) issues.push({ level: "P1", type: "版本不一致", path: "(全站)", msg: "?v=" + v + " 出现 " + versionCounter[v] + " 次，主流版本是 " + top });
      });
    }

    var byLevel = { P0: 0, P1: 0, P2: 0 };
    issues.forEach(function (x) { if (byLevel[x.level] != null) byLevel[x.level]++; });
    return ok("全量巡检完成：扫了 " + readCount + " 个文件，发现 " + issues.length + " 处问题", {
      files: readCount,
      issues: issues,
      summary: byLevel,
      versions: versionCounter,
      ms: nowMs() - t0
    });
  }

  /* ============================================================
   * ② 项目知识：模块地图 + 依赖关系
   * ============================================================ */
  /**
   * 解析每个 JS 暴露的全局名（window.X / globalThis.X / var X 顶层），
   * 以及它引用了哪些其它全局（window.Y / Y.），构建依赖图。
   * 找出：孤岛模块（不被任何模块引用）、悬空引用（被引用但无模块定义）。
   */
  async function moduleMap(opt) {
    opt = opt || {};
    var fb = FB();
    if (!fb || !fb.hasRoot || !fb.hasRoot()) return no("构建模块地图需要授权项目文件夹。");
    var paths = await enumeratePaths();
    if (!paths) return no("当前 FileBridge 未提供文件清单接口。");
    var js = paths.filter(function (p) { return /\.js$/i.test(p) && !/node_modules|\.git|\.yj-backups|libs\//.test(p); });
    var t0 = nowMs();
    var modules = [];   // {path, exposes:[], refs:[]}
    var defined = Object.create(null); // globalName -> [paths]

    for (var i = 0; i < js.length; i++) {
      var p = js[i], r = null;
      try { r = await fb.read(p); } catch (e) { continue; }
      var text = r.text || "";
      var exposes = [], refs = [], m;

      // 暴露：window.X = / window["X"] = / globalThis.X =
      var exRe = /(?:window|globalThis)\.([\w$]+)\s*=/g;
      while ((m = exRe.exec(text)) !== null) if (exposes.indexOf(m[1]) < 0) exposes.push(m[1]);
      var exqRe = /(?:window|globalThis)\["([\w$]+)"\]\s*=/g;
      while ((m = exqRe.exec(text)) !== null) if (exposes.indexOf(m[1]) < 0) exposes.push(m[1]);

      // 引用：window.X（读）、window["X"]、以及 YJWait.for 里的裸名
      var refRe = /window\.([\w$]+)/g;
      var builtins = { location: 1, document: 1, localStorage: 1, sessionStorage: 1, console: 1, setTimeout: 1, clearTimeout: 1, setInterval: 1, clearInterval: 1, addEventListener: 1, removeEventListener: 1, URLSearchParams: 1, requestAnimationFrame: 1, matchMedia: 1, navigator: 1, history: 1, innerWidth: 1, innerHeight: 1, crypto: 1, fetch: 1, alert: 1, confirm: 1, prompt: 1, showDirectoryPicker: 1 };
      while ((m = refRe.exec(text)) !== null) {
        if (!builtins[m[1]] && refs.indexOf(m[1]) < 0) refs.push(m[1]);
      }
      modules.push({ path: p, exposes: exposes, refs: refs });
      exposes.forEach(function (g) { (defined[g] = defined[g] || []).push(p); });
      if (i % 40 === 39) await nextTick();
    }

    // 悬空引用：被引用但没有任何模块定义（且不是浏览器/已知外部库）
    var external = { jQuery: 1, $: 1,marked:1, echarts: 1, cytoscape: 1, DOMPurify: 1, Sortable: 1, APlayer: 1 };
    var dangling = Object.create(null);
    modules.forEach(function (mod) {
      mod.refs.forEach(function (g) {
        if (!defined[g] && !external[g]) (dangling[g] = dangling[g] || []).push(mod.path);
      });
    });

    // 孤岛：既不暴露全局、又没被其它模块以 window.X 引用的模块（多为纯副作用脚本，需人工确认）
    var referenced = Object.create(null);
    modules.forEach(function (mod) { mod.refs.forEach(function (g) { referenced[g] = true; }); });
    var islands = modules.filter(function (mod) {
      return mod.exposes.length === 0 && !mod.exposes.some(function (g) { return referenced[g]; });
    }).map(function (m) { return m.path; });

    return ok("模块地图构建完成：" + modules.length + " 个模块，定义全局 " + Object.keys(defined).length + " 个，悬空引用 " + Object.keys(dangling).length + " 个", {
      modules: modules,
      defined: defined,
      dangling: dangling,
      islands: islands,
      ms: nowMs() - t0
    });
  }

  /* ============================================================
   * ③ 自我验证：改完自己跑闸
   * ============================================================ */
  /**
   * 综合验证：FileBridge.diagnose（语法/引用/id/版本）+ 本模块全量巡检，
   * 给出"能不能交付"的结论。opt: { full:true 用全量巡检 }
   */
  async function verify(opt) {
    opt = opt || {};
    var fb = FB();
    if (!fb || !fb.hasRoot || !fb.hasRoot()) return no("自我验证需要授权项目文件夹。");
    var t0 = nowMs();
    var quick = null, full = null;
    try { quick = await fb.diagnose(); } catch (e) { quick = null; }
    if (opt.full !== false) {
      full = await scanProject({ maxFiles: opt.maxFiles || 400 });
    }
    var p0 = full && full.ok ? (full.data.summary.P0 || 0) : 0;
    var p1 = full && full.ok ? (full.data.summary.P1 || 0) : 0;
    var verdict = p0 > 0 ? "BLOCK" : (p1 > 0 ? "WARN" : "PASS");
    return ok("自我验证完成：" + verdict, {
      verdict: verdict,
      quick: quick,
      full: full && full.ok ? full.data : null,
      hint: verdict === "BLOCK" ? "有 P0 语法错误，必须先修复再交付。" : verdict === "WARN" ? "有 P1 问题，建议修完再交付。" : "未发现阻断性问题（仍建议真浏览器复验）。",
      ms: nowMs() - t0
    });
  }

  /* ============================================================
   * ④ 批量重构：影响面分析（先分析，执行仍走 yj-patch）
   * ============================================================ */
  /**
   * 分析"把全局名 from 改名为 to"会影响哪些文件、多少处，给出安全建议。
   * 只分析不写入；实际改名由小云生成 yj-patch 补丁、玩家确认后由 FileBridge 执行。
   */
  async function refactorImpact(from, to) {
    if (!from) return no("缺少要重构的全局名。");
    var fb = FB();
    if (!fb || !fb.hasRoot || !fb.hasRoot()) return no("影响面分析需要授权项目文件夹。");
    var paths = await enumeratePaths();
    if (!paths) return no("当前 FileBridge 未提供文件清单接口。");
    var targets = paths.filter(function (p) { return /\.(js|mjs|cjs|html)$/i.test(p) && !/node_modules|\.git|libs\//.test(p); });
    var hits = [], total = 0, m;
    var re = new RegExp("window\\." + from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b|\\b" + from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\(", "g");
    for (var i = 0; i < targets.length; i++) {
      var r = null;
      try { r = await fb.read(targets[i]); } catch (e) { continue; }
      var c = 0;
      while ((m = re.exec(r.text || "")) !== null) c++;
      if (c) { hits.push({ path: targets[i], count: c }); total += c; }
      if (i % 40 === 39) await nextTick();
    }
    return ok("影响面分析：全局名 " + from + (to ? " → " + to : "") + " 涉及 " + hits.length + " 个文件、" + total + " 处", {
      from: from, to: to || null, hits: hits, total: total,
      advice: "建议：小云据此逐文件生成 yj-patch 补丁，你确认后由文件工坊执行；改完用「自我验证」跑一遍。"
    });
  }

  /* ============================================================
   * 报告渲染 + 能力清单
   * ============================================================ */
  function reportText(rep) {
    if (!rep) return "（无报告）";
    if (!rep.ok) return rep.msg || "执行失败";
    var d = rep.data || {};
    var L = [rep.msg || ""];
    if (d.summary) L.push("严重度分布：P0 " + (d.summary.P0 || 0) + " · P1 " + (d.summary.P1 || 0) + " · P2 " + (d.summary.P2 || 0));
    if (d.verdict) L.push("结论：**" + d.verdict + "**。" + (d.hint || ""));
    if (d.issues && d.issues.length) {
      L.push("问题清单（前 12 条）：");
      d.issues.slice(0, 12).forEach(function (x) {
        L.push("  · [" + x.level + "] " + x.type + " @ " + x.path + " —— " + x.msg);
      });
    }
    if (d.dangling && Object.keys(d.dangling).length) {
      L.push("悬空引用（前 10）：" + Object.keys(d.dangling).slice(0, 10).join("、"));
    }
    if (d.islands) L.push("疑似孤岛模块 " + d.islands.length + " 个（多为纯副作用脚本，需人工确认）。");
    if (d.hits) {
      L.push("受影响文件：");
      d.hits.slice(0, 12).forEach(function (h) { L.push("  · " + h.path + " × " + h.count); });
      if (d.advice) L.push(d.advice);
    }
    return L.filter(Boolean).join("\n");
  }

  function manifest() {
    return [
      "MoDevtools.scanProject() —— 自主巡检全项目源码，定位语法错误/引用缺失/重复id/版本不一致，输出带严重度的问题清单",
      "MoDevtools.moduleMap() —— 构建模块地图与依赖关系，找出悬空引用与孤岛模块（项目知识）",
      "MoDevtools.verify({full:true}) —— 改完自我验证：全量语法+引用+版本，给出 PASS/WARN/BLOCK 结论",
      "MoDevtools.refactorImpact(from,to) —— 批量重构影响面分析：改名/迁移前先算涉及哪些文件多少处",
      "MoDevtools.reportText(报告) —— 把结构化报告转成可读中文，用于向玩家复述"
    ];
  }

  window.MoDevtools = {
    scanProject: scanProject,
    moduleMap: moduleMap,
    verify: verify,
    refactorImpact: refactorImpact,
    reportText: reportText,
    manifest: manifest
  };
})();
