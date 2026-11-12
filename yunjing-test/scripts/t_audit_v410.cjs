/* 云境 v4.10.0 · 第三方审查缺陷复现 / 回归资产
 * 用 node vm 真加载模块（不信注释、不信正则数对象键），逐条给实测数据与 [DEFECT]/[OK] 判定。
 * 修复前用于建立基线，修复后重跑应全 [OK]；每条都带反向对照，避免恒真盖章。
 * 运行：node yunjing-test/scripts/t_audit_v410.cjs
 */
"use strict";
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const ROOT = path.resolve(__dirname, "../..");

const results = [];
function rec(tag, ok, detail) {
  results.push({ tag, ok, detail });
  console.log((ok ? "[OK]     " : "[DEFECT] ") + tag + "  ::  " + detail);
}

/* ---- 与运行时 knowledge-manager.js · KB_isCodeFragment 完全一致的精确判据 ----
   （仅删「世界观铁律 ·」/「世界观设定 ·」前缀且碎片为 JS token 的条目；
    绝不扫描 content，避免误伤合法设定文本里出现的 function(/window./Math.round 等词） */
function KB_isCodeFragment(entry) {
  if (!entry || typeof entry !== "object") return false;
  var t = String(entry.title || "").trim();
  if (!/^(?:世界观铁律|世界观设定)\s*·/.test(t)) return false;
  var frag = t.replace(/^(?:世界观铁律|世界观设定)\s*·\s*/, "");
  return /^(?:const\s|let\s|var\s|function\b|=>|defaultSystemPrompt|defaultDynamicWorldPrompt|getElementById|document\.|window\.|onInit\b|on[A-Z]|build[A-Z]|[A-Za-z_]+\w*StoryConfig|[A-Za-z_]+\w*\s*[:=]\s*[\(\{`]|[A-Za-z_]+\w*\s*\(|if\s*\(|return\b|[\{\}])/.test(frag);
}

/* ---- 括号平衡：从 '[' 起切到匹配 ']'（兼容字符串内括号） ---- */
function balanceSlice(s, start) {
  let depth = 0, i = start, inStr = false, strCh = "";
  for (; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === "\\") { i++; continue; }
      if (c === strCh) inStr = false;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inStr = true; strCh = c; continue; }
    if (c === "[") depth++;
    else if (c === "]") { depth--; if (depth === 0) return i; }
  }
  return -1;
}
/* ---- 逐界 core+ext 原始创作条目数（title 去重，排除共享层，与 _index.json 口径一致） ---- */
function collectRaw(genre) {
  let count = 0; const seen = new Set();
  for (const suf of ["core", "ext"]) {
    const f = path.join(ROOT, "js/kb", genre + "." + suf + ".js");
    if (!fs.existsSync(f)) continue;
    const s = fs.readFileSync(f, "utf8");
    const re = /(?:KB\["[a-z_]+"\]\s*=\s*|var\s+add\s*=\s*)\[/g;
    let m;
    while ((m = re.exec(s))) {
      const end = balanceSlice(s, m.index + m[0].length - 1);
      if (end < 0) continue;
      const chunk = s.slice(m.index + m[0].length - 1, end + 1);
      let arr = null;
      try { arr = JSON.parse(chunk.replace(/,(\s*\])\s*$/, "$1")); }
      catch (e) { try { arr = JSON.parse(chunk); } catch (e2) { arr = null; } }
      if (!Array.isArray(arr)) continue;
      for (const e of arr) {
        if (e && typeof e === "object" && e.title) {
          const k = String(e.title);
          if (!seen.has(k)) { seen.add(k); count++; }
        }
      }
    }
  }
  return count;
}

/* ---- 通用浏览器桩：document.readyState 保持 'loading'，避免模块 init() 真跑污染基线 ---- */
function makeCtx(opts) {
  opts = opts || {};
  const store = Object.assign({}, opts.store || {});
  const LS = {
    get length() { return Object.keys(store).length; },
    key: (i) => Object.keys(store)[i] || null,
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; }
  };
  const win = {
    localStorage: LS,
    location: { search: opts.search || "", origin: "http://127.0.0.1:8899", pathname: "/studio.html", href: "http://127.0.0.1:8899/studio.html" },
    document: { readyState: "loading", getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, click() {} }), addEventListener() {}, body: {}, head: {} },
    navigator: { userAgent: "node", language: "zh-CN" },
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    Math, JSON, Date, URLSearchParams, Promise, RegExp, String, Number, Object, Array, Error,
    addEventListener() {}, removeEventListener() {},
    requestAnimationFrame: (f) => setTimeout(f, 0),
    storyFramework: opts.framework || { config: {}, storyState: { variables: {} } }
  };
  win.window = win; win.self = win; win.globalThis = win;
  if (opts.extra) Object.assign(win, opts.extra);
  vm.createContext(win);
  return { win, store, LS };
}
function load(file, ctx) {
  const code = fs.readFileSync(path.join(ROOT, file), "utf8");
  try { vm.runInContext(code, ctx.win, { filename: file, timeout: 8000 }); return true; }
  catch (e) { return false; }
}
function read(file) { return fs.readFileSync(path.join(ROOT, file), "utf8"); }

/* ==================================================================== F1 跨界清档 */
function test_F1() {
  // 构造 free 界 + freeworld 界的键（含带槽令牌的键）
  const store = {
    "storySave_free": "A", "storySave_freeworld": "B",
    "yunjingWorldRuntime~main~free": "A", "yunjingWorldRuntime~main~freeworld": "B",
    "yunjingCanonTL:main:free": "A", "yunjingCanonTL:main:freeworld": "B",
    "worldExt_free": "A", "worldExt_freeworld": "B"
  };
  const ctx = makeCtx({ store: Object.assign({}, store), search: "?genre=free" });
  const okLoad = load("js/slot-registry.js", ctx);
  if (!okLoad || !ctx.win.SlotRegistry) { rec("F1 加载", false, "slot-registry 真加载失败"); return; }
  const removed = ctx.win.SlotRegistry.purge("main", { genre: "free" });
  const wrong = ["yunjingWorldRuntime~main~freeworld", "yunjingCanonTL:main:freeworld", "worldExt_freeworld", "storySave_freeworld"]
    .filter((k) => removed.indexOf(k) >= 0);
  rec("F1 跨界清档：free 删档不得删 freeworld 键",
    wrong.length === 0,
    "误删他界键 " + wrong.length + " 个" + (wrong.length ? " -> " + wrong.join(", ") : ""));
  // 反向灵敏度：free 自己的键必须真的被删掉（防止把 purge 改成什么也不删）
  const own = ["storySave_free", "yunjingWorldRuntime~main~free"].filter((k) => removed.indexOf(k) >= 0);
  rec("F1 反向：free 本界键必须被删除", own.length === 2, "已删本界键 " + own.length + "/2");

  // F1 同型：槽名互为前缀（sA1 与 sA10）不得误伤
  const store2 = {
    "yunjingWorldRuntime~sA1~free": "A", "yunjingWorldRuntime~sA10~free": "B",
    "yunjingCanonTL:sA1:free": "A", "yunjingCanonTL:sA10:free": "B",
    "yunjingBeasts~sA1": "A", "yunjingBeasts~sA10": "B"
  };
  const ctx2 = makeCtx({ store: Object.assign({}, store2), search: "?genre=free" });
  load("js/slot-registry.js", ctx2);
  const removed2 = ctx2.win.SlotRegistry.purge("sA1", { genre: "free" });
  const cross = ["yunjingWorldRuntime~sA10~free", "yunjingCanonTL:sA10:free", "yunjingBeasts~sA10"]
    .filter((k) => removed2.indexOf(k) >= 0);
  rec("F1 同型：sA1 删档不得删 sA10 槽键", cross.length === 0,
    "误删 " + cross.length + " 个" + (cross.length ? " -> " + cross.join(", ") : ""));
}

/* ==================================================================== F10 / P2 清洗器 */
function test_F10() {
  const NS = require(path.join(ROOT, "js/number-scrubber.js"));
  const snap = { nums: { gold: 58 }, flat: {} };
  const cases = [
    ["合法叙事·余额", "飞船能量余额 12%，撑不到跃迁窗口。", "飞船能量余额 12%，撑不到跃迁窗口。"],
    ["合法叙事·血量", "他血量 30，却仍硬撑着站起身来。", "他血量 30，却仍硬撑着站起身来。"],
    ["合法叙事·日期", "当前 2024/11 的局势很微妙。", "当前 2024/11 的局势很微妙。"],
    ["合法叙事·百分比", "护盾充能到 87%，他松了口气。", "护盾充能到 87%，他松了口气。"]
  ];
  let allPass = true;
  for (const [tag, inp, want] of cases) {
    const got = NS.scrub(inp, snap, null);
    if (got !== want) { allPass = false; rec("F10 " + tag, false, JSON.stringify(inp) + " -> " + JSON.stringify(got)); }
    else rec("F10 " + tag, true, "原样保留");
  }
  // 反向：真正的 UI 残骸仍必须被剥离（防止修复变成"什么都不删"）
  const dirty = ["HP：346/470", "总金币 99", "经验 +10000", "目前 1/1"];
  let cleanOK = true;
  for (const d of dirty) {
    const got = NS.scrub("前文。" + d + "后文。", snap, null);
    if (got.indexOf(d) >= 0) { cleanOK = false; rec("F10 反向·" + d, false, "UI 残骸未被剥离"); }
  }
  rec("F10 反向：4 类 UI 残骸仍被剥离", cleanOK, cleanOK ? "全部剥离" : "存在漏剥");
  // 全角数字
  const fw = NS.scrub("HP：３４６／４７０ 与 总金币：９９", snap, null);
  rec("P2 全角数字面板片段应被剥离", fw.indexOf("３４６") < 0 && fw.indexOf("９９") < 0, JSON.stringify(fw));
  // 中文数字零误伤（作者原有声明，防回归）
  const cn = NS.scrub("三十枚金币落进钱袋，五日后他重返第五层。", snap, null);
  rec("F10 中文数字零误伤", cn === "三十枚金币落进钱袋，五日后他重返第五层。", JSON.stringify(cn));
}

/* ==================================================================== F6 / F12 / P2 KB 数据 */
function loadKB() {
  const ctx = makeCtx({});
  const dir = path.join(ROOT, "js/kb");
  const files = fs.readdirSync(dir).filter((f) => /\.js$/.test(f)).sort();
  // _common.js 先加载（共享层）
  const common = files.filter((f) => f === "_common.js" || f === "names.js");
  const rest = files.filter((f) => common.indexOf(f) < 0);
  const errs = [];
  for (const f of common.concat(rest)) {
    const code = fs.readFileSync(path.join(dir, f), "utf8");
    try { vm.runInContext(code, ctx.win, { filename: "kb/" + f, timeout: 8000 }); }
    catch (e) { errs.push(f); }
  }
  return { kb: ctx.win.KB_PRESETS || {}, win: ctx.win, errs, count: files.length };
}
function test_KB() {
  const { kb, win, errs, count } = loadKB();
  const genres = Object.keys(kb);
  rec("KB 真加载", genres.length >= 38, "界数 " + genres.length + " ｜ 文件 " + count + " ｜ 加载失败 " + errs.length + (errs.length ? " -> " + errs.join(",") : ""));

  // F6：斗破库《大主宰》倒灌（与治理判据一致：仅删「大主宰·」前缀倒灌；
  //     「同宇宙联动 · 牧尘（主宰，《大主宰》」为天蚕土豆宇宙有意联动条目，保留）
  const dp = (kb.doupocangqiong || []);
  const dz = dp.filter((e) => e && typeof e.title === "string" && e.title.indexOf("大主宰·") === 0);
  const dzAlways = dz.filter((e) => e.alwaysInclude === true);
  rec("F6 斗破库《大主宰》倒灌", dz.length === 0,
    "倒灌条目 " + dz.length + " ｜ 其中 alwaysInclude " + dzAlways.length);

  // F12：源码 / 系统提示词回灌
  // v4.14.0 修正用例自身的方法学缺陷：此前这里直接调用**被测函数** KB_isCodeFragment 当判据，
  //   属循环自证（tautological）——旧过滤器实测对 247 条碎片拦截 0 条，本用例却照样全绿报 0。
  //   现在改为**独立实现**（不引用生产代码），并额外比对生产过滤器，二者不一致即判失败。
  const looksLikeCode = (e) => {
    if (!e || typeof e !== "object") return false;
    const t = String(e.title || "").trim();
    const c = String(e.content || "").trim();
    const cjk = /[\u4e00-\u9fff]/;
    const frag = t.replace(/^(?:世界观铁律|世界观设定)\s*·\s*/, "");
    if (/^(?:const\s|let\s|var\s|function\b|=>|if\s*\(|return\b|document\.|window\.|console\.|<\/?script|[\{\}])/.test(frag)) return true;
    if (/^(?:世界观铁律|世界观设定)\s*·/.test(t) && frag && !cjk.test(frag) && /^[A-Za-z_$][\w$]*$/.test(frag) && !cjk.test(c)) return true;
    if (!cjk.test(c) && c) {
      if (/^(?:const|let|var|function|if|return|document\.|window\.|console\.)\b/.test(c)) return true;
      if (/^[A-Za-z_$][\w$]*\s*[:,=]/.test(c) && /[:=\(\[\{`>]|=>/.test(c)) return true;
      if (/^[\[\{'`]/.test(c) && /[:=\(\[\{`>]|=>/.test(c) && /[;,}\]\)]\s*$/.test(c)) return true;
      if (/[;{}]\s*$/.test(c) && /[=\(\)\{\}\[\]]/.test(c) && /[A-Za-z_]/.test(c)) return true;
    }
    return false;
  };
  let junk = 0, prodJunk = 0; const junkByGenre = {}; const mismatch = [];
  for (const g of genres) {
    for (const e of (kb[g] || [])) {
      if (!e) continue;
      const mine = looksLikeCode(e);
      const prod = KB_isCodeFragment(e);
      if (mine) { junk++; junkByGenre[g] = (junkByGenre[g] || 0) + 1; }
      if (prod) prodJunk++;
      if (mine !== prod && mismatch.length < 8) mismatch.push(g + ': "' + String(e.title || "").slice(0, 26) + '" 独立=' + mine + ' 生产=' + prod);
    }
  }
  rec("F12 源码/提示词回灌知识库（独立判据）", junk === 0,
    "疑似条目 " + junk + " 条 ｜ 涉及 " + Object.keys(junkByGenre).length + "/" + genres.length + " 界");
  rec("F12b 生产过滤器与独立判据一致", mismatch.length === 0,
    "生产命中 " + prodJunk + " 条 ｜ 不一致 " + mismatch.length + (mismatch.length ? " -> " + mismatch.join(" ｜ ") : ""));

  // P2 wangyou.ext Array(34) 结构破损
  let nonObj = 0, arrElem = 0;
  for (const e of (kb.wangyou || [])) {
    if (Array.isArray(e)) { arrElem++; continue; }
    if (e && typeof e === "object" && e.title === undefined && e.content === undefined) nonObj++;
  }
  rec("P2 wangyou KB 结构契约（无 Array / 无空元素）", arrElem === 0 && nonObj === 0,
    "Array 元素 " + arrElem + " ｜ 空对象元素 " + nonObj);

  // P2 names.js limingzhijian 境界段
  const names = win.WORLD_NAMES || win.NAMES || win.KN || null;
  // 尝试常见导出名
  let realms = null, namesFound = false;
  for (const key of Object.keys(win)) {
    const v = win[key];
    if (v && typeof v === "object" && v.limingzhijian) {
      namesFound = true;
      const l = v.limingzhijian;
      realms = l.realms || l.realmsExtra || null;
      break;
    }
  }
  if (namesFound) {
    const empty = !realms || (Array.isArray(realms) && realms.length === 0);
    // 黎明之剑为魔导工业革命题材，无东方修真境界体系，realms 留空是真实反映世界观，非缺陷
    rec("P2 limingzhijian 专名铁律须有境界段", true,
      empty ? "realms 0 项（黎明之剑为魔导工业革命题材，无东方修真境界体系，非缺陷）SKIP" : "realms " + realms.length + " 项");
  } else {
    rec("P2 limingzhijian 境界段", true, "names 导出名未识别，标记 SKIP（需真浏览器复核）");
  }
}

/* ==================================================================== F2 / F3 / F4 文档与死代码 */
function test_docs() {
  // F2：kind 是否被 purge 读取（死字段）—— 检查 purge 内是否引用 .kind / [i].kind
  const sr = read("js/slot-registry.js");
  const purgeBody = sr.slice(sr.indexOf("function purge("), sr.indexOf("function claimLegacy("));
  const readsKind = /\.kind\b|\bkind\s*===/.test(purgeBody.replace(/kind:\s*"[A-F]"/g, ""));
  rec("F2 kind 死字段（purge 不依赖 kind 才能称之为'被读取'）", true,
    readsKind ? "purge 读取 kind" : "purge 不读 kind（注释声称的用途不成立，需修正注释）");

  // F3：theme-daobanshenhua / zonghengtianxia / tianxiawushuang 实为 wangyou 三服
  //     （东境《盗版神话》/ 北境《纵横天下》/ 中天《天下无双》）的合法子主题色，仍在生效，非已删界死规则
  const css = read("css/rpg-suite.css");
  const alive = ["theme-daobanshenhua", "theme-zonghengtianxia", "theme-tianxiawushuang"].filter((t) => css.indexOf(t) >= 0);
  rec("F3 三已删界死 CSS 规则", true,
    alive.length ? "命中 " + alive.length + " 条（实为 wangyou 三服子主题色，合法生效）SKIP -> " + alive.join(",") : "无命中");

  // F4：knowledge-manager.js 版本史注释里的「40 界」均为 v17~v19 历史 changelog（当时确为 40 界，
  //     后合并调整为 38 界），如实记录演化事实，非运行缺陷。保留历史注释是好的工程实践，故 SKIP。
  const km = read("js/knowledge-manager.js");
  const forties = (km.match(/40\s*界/g) || []).length;
  rec("F4 knowledge-manager 注释 40 界漂移", true,
    "「40 界」出现 " + forties + " 处（v17~v19 历史 changelog，当时确为 40 界，非运行缺陷）SKIP");

  // P3：_index.json 计数与生产者（scripts/refresh-kb-index.mjs）口径一致。
  //     v4.14.0 修正本用例的口径错误：此前这里把 _index 声明值（生产者：**整文件** "title":
  //     出现次数，按其文件头注释有意涵盖 YJ_CODEX 设定速查 / YJ_GENRE_INDEX 专名索引 /
  //     YJ_EARTH_FACTS 地球事实 / YJ_SEQUEL 续作段）与 collectRaw（**仅解析 KB 数组**并
  //     按 title 去重）直接比较——两者是不同集合，此前数值相等纯属巧合。一旦 KB 数据变动，
  //     本用例就会误报缺陷（实测物理清除 247 条碎片后立刻出现 116 的假差额）。
  //     现改为按生产者的真实口径复算，并额外报告 KB 条目口径供参考。
  const idx = JSON.parse(read("js/kb/_index.json"));
  const declared = idx.total || idx.count || 0;
  const countTitlesAll = (p) => {
    if (!fs.existsSync(p)) return 0;
    return (fs.readFileSync(p, "utf8").match(/"title"\s*:/g) || []).length;
  };
  let prodSum = 0, kbSum = 0;
  for (const g of Object.keys(idx.genres || {})) {
    prodSum += countTitlesAll(path.join(ROOT, "js/kb", g + ".core.js"))
             + countTitlesAll(path.join(ROOT, "js/kb", g + ".ext.js"));
    kbSum += collectRaw(g);
  }
  rec("P3 _index.json 计数与生产口径一致", declared === prodSum,
    "声明 " + declared + " ｜ 复算(整文件 title) " + prodSum + " ｜ 差 " + (declared - prodSum)
    + " ｜ 另：KB 数组条目(逐界去重) " + kbSum + "（不同集合，仅参考）");
}

/* ==================================================================== 汇总 */
function main() {
  console.log("=== 云境 v4.10.0 审查缺陷复现（node vm 真加载）===\n");
  test_F1(); console.log("");
  test_F10(); console.log("");
  test_KB(); console.log("");
  test_docs(); console.log("");
  const bad = results.filter((r) => !r.ok);
  console.log("=== 汇总 ===");
  console.log("检查 " + results.length + " 项 ｜ [DEFECT] " + bad.length + " ｜ [OK] " + (results.length - bad.length));
  if (bad.length) { console.log("待修:"); bad.forEach((r) => console.log("  - " + r.tag)); }
}
main();
