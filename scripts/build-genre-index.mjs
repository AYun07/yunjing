#!/usr/bin/env node
/**
 * 云境 v3.96.0 · 逐界专名索引与章节速查（幂等，可反复跑）
 *
 * 背景：build-codex.mjs 把设定「逐行」拆条，一行里往往含多个专名；小参数模型
 *       在剧情里提到「比比东」「七宝琉璃塔」这类名字时，BM25 未必能命中那一行。
 *       本脚本为每个设定章节生成一张「速查总览卡」，并把章节里出现的专名逐个
 *       提成独立索引条目（汇聚含该专名的原文行），让名字本身成为可检索入口。
 *
 * 输出：追加到 js/kb/<界>.ext.js 的 YJ_GENRE_INDEX 段，与 YJ_CODEX /
 *       YJ_EARTH_FACTS 段互不干扰；运行时由 knowledge-manager.js 随 ext.js 加载。
 *
 * 用法：node scripts/build-genre-index.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KB_DIR = path.join(ROOT, 'js', 'kb');
const CFG_DIR = path.join(ROOT, 'configs');
const START = '/* YJ_GENRE_INDEX_START */';
const END = '/* YJ_GENRE_INDEX_END */';

/* 与 build-codex.mjs 保持同一套口径：设定章节收，提示词工程章节不收 */
const SECTION_SKIP = /(?:输出规范|扮演输出|入场指令|开篇剧情指令|开场指令|完整检查|检查清单|档案示例|示例|界面与反馈|正文风格|叙事风格|创作六维|反八股|负面清单|术语过滤器|开篇锚点|开场锚点|输出格式|变量(?:块|表|协议)?|字段|模板|排版|字数|禁词|对白规范|文风|节奏与|结构要求|套路|指令|清单|反馈规范|系统规则清单)/;
const NOISE = /(?:variable_update|world_update|一章完整正文|无系统字样|小说排版|0-100|\bcharacters\b|characters\[|\.impression|\.relationship|emotionGauge|输出格式|变量块|\bJSON\b|\bprompt\b|\btrue\b|\bfalse\b|每轮回复|请输出|请以|不得输出|禁止出现|作为AI|根据设定|user:|assistant:|system:|<\|im_start\|>|\{["a-zA-Z_]|\[\{|按以下格式|回复包含)/i;
const SECTION_CAT = [
  [/境界|修行|修炼|等级|力量体系|基因|序列|阶位/, '境界体系'],
  [/势力|组织|阵营|谱系|宗门|文明|种族|格局|外神|旧日|神系/, '势力组织'],
  [/地理|地图|锚点|区域|版图|疆域|山海|地名|城邦|星域/, '地理'],
  [/人物|角色|志|主角|配角|众生|名录|档案/, '人物'],
  [/事件|时代|年表|时序|历史|大事|纪年|沿革|锚点/, '事件年表'],
  [/铁律|禁忌|规则|设定|背景|世界观|骨架|法则|器物|道具|功法|术语/, '世界观铁律'],
];
const catOf = (s) => (SECTION_CAT.find(([re]) => re.test(s)) || [null, '世界观设定'])[1];

const SUFFIX = '(?:宗|门|派|教|殿|盟|会|阁|府|军|国|族|帮|寺|观|城|谷|山|海|域|洲|镇|村|岛|峰|岭|塔|楼|庄|堡|营|寨|港|关|司|局|廷|宫|学院|集团|家族|帝国|王朝|世家|议会|组织|圣地|遗迹|魂环|魂骨|武魂|功法|法宝|神器|灵器|丹药|阵法|异能|序列|阶|境)';
const PROPER_RE = new RegExp(`(?:^|[：:｜|，,；;（(\\[\\s])([\\u4e00-\\u9fa5A-Za-z0-9]{2,7}${SUFFIX})`, 'g');
/* 通用词不做索引，否则索引卡全是「宗门」「帝国」这类空词 */
const STOP_PROPER = /^(?:宗门|门派|势力|组织|帝国|王朝|家族|学院|城池|城镇|山谷|海域|地区|区域|世界|大陆|境界|等级|功法|法宝|丹药|阵法|人物|主角|配角|事件|时代|历史|规则|设定|背景|系统|玩家|模型|正文|输出|格式|本轮|每轮|变量|字段|清单|模板|示例|检查)$/;

const genres = fs.readdirSync(CFG_DIR).filter((f) => f.endsWith('-config.js')).map((f) => f.replace('-config.js', '')).sort();
let grand = 0;

for (const g of genres) {
  const cfg = fs.readFileSync(path.join(CFG_DIR, `${g}-config.js`), 'utf8');
  const parts = cfg.split(/(?=^##\s)|(?=^【)/m);
  const items = [];
  const properLines = new Map();   // 专名 -> 命中的原文行
  const seenTitle = new Set();

  const push = (it) => {
    let t = it.title, k = 1;
    while (seenTitle.has(t)) { k++; t = `${it.title} · ${k}`; }
    seenTitle.add(t);
    it.title = t;
    items.push(it);
  };

  for (const part of parts) {
    const h2 = part.match(/^##\s+([^\n]+)\n/);
    const br = part.match(/^【([^】]+)】/);
    let sec, body;
    if (h2) { sec = h2[1].trim(); body = part.slice(h2[0].length); }
    else if (br) { sec = br[1].trim(); body = part.slice(br[0].length); }
    else continue;
    if (SECTION_SKIP.test(sec)) continue;
    const lines = body.split('\n').map((l) => l.replace(/^\s*(?:\d+[.、)]\s*|[-•*]\s*|#+\s*)/, '').trim())
      .filter((l) => l.length >= 12 && !NOISE.test(l) && !/^[`'"{]/.test(l));
    if (!lines.length) continue;
    const cat = catOf(sec);
    const secName = sec.replace(/[（(].*$/, '').replace(/^[一二三四五六七八九十]+、/, '').trim().slice(0, 20);

    /* 章节速查总览卡：把该章最要紧的几行压成一条可检索条目 */
    const overview = lines.slice(0, 6).join(' / ').slice(0, 620);
    push({
      title: `速查·${secName}·总览`,
      content: `【${secName}】${overview}`,
      category: `速查·${cat}`,
      tags: [g, '速查', cat, secName],
      alwaysInclude: false, priority: '',
    });

    /* 专名索引：逐行抽出带后缀的专名，汇聚含该名的原文行 */
    lines.forEach((line) => {
      const names = [...line.matchAll(PROPER_RE)].map((m) => m[1]);
      names.forEach((n) => {
        if (!n || n.length < 2 || STOP_PROPER.test(n) || /[.\[\]{}]/.test(n)) return;
        if (!properLines.has(n)) properLines.set(n, []);
        const arr = properLines.get(n);
        if (arr.length < 3 && !arr.includes(line)) arr.push(line);
      });
    });
  }

  /* 按命中行数排序，取每界前 200 个专名，避免索引爆炸 */
  const ranked = [...properLines.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).slice(0, 200);
  ranked.forEach(([name, lines]) => {
    push({
      title: `索引·${name}`,
      content: `【${name}】${lines.join(' / ').slice(0, 700)}`,
      category: '专名索引',
      tags: [g, '专名索引', name],
      alwaysInclude: false, priority: '',
    });
  });

  const extPath = path.join(KB_DIR, `${g}.ext.js`);
  if (!fs.existsSync(extPath)) continue;
  let ext = fs.readFileSync(extPath, 'utf8');
  const payload = `${START}\n/* 云境 v3.96.0 · 逐界专名索引与章节速查（由 scripts/build-genre-index.mjs 生成，${items.length} 条）\n * 目的：小模型在剧情里提到一个名字就能检索到对应设定，不必依赖模型自身记忆。 */\n(function(){\n  var KB = window.KB_PRESETS || (window.KB_PRESETS = {});\n  var a = KB[${JSON.stringify(g)}] || (KB[${JSON.stringify(g)}] = []);\n  var add = ${JSON.stringify(items)};\n  var have = {}; a.forEach(function(x){ have[String(x&&x.title||'').trim()] = 1; });\n  add.forEach(function(x){ var t=String(x&&x.title||'').trim(); if(!have[t]){ have[t]=1; a.push(x); } });\n  window.__KB_GENRE_INDEX_OK__ = true;\n})();\n${END}`;
  const a = ext.indexOf(START), b = ext.indexOf(END);
  if (a !== -1 && b !== -1 && b > a) ext = ext.slice(0, a) + payload + ext.slice(b + END.length);
  else ext = ext.replace(/\s*$/, '') + '\n\n' + payload + '\n';
  fs.writeFileSync(extPath, ext);
  grand += items.length;
  console.log(`  ${g.padEnd(18)} +${String(items.length).padStart(3)} 条索引/速查`);
}
console.log(`\n逐界专名索引与章节速查合计 ${grand} 条`);
