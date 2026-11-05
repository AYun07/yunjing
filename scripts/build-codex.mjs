#!/usr/bin/env node
/**
 * 云境 · 资料库扩充（幂等，可反复跑）
 *
 * 目的：玩家用便宜的小参数模型时，模型自身记不住原著设定。云境自带资料库必须细粒度、
 *       可按剧情检索。本脚本把 configs/<界>-config.js 的「境界 / 势力 / 地理 / 人物 / 事件 /
 *       铁律」章节逐行拆成可检索条目，追加到 js/kb/<界>.ext.js（用 YJ_CODEX 标记包裹，
 *       重跑只替换不叠加），并同步刷新 js/kb/_index.json 的真实条目统计。
 *
 * 用法：node scripts/build-codex.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KB_DIR = path.join(ROOT, 'js', 'kb');
const CFG_DIR = path.join(ROOT, 'configs');
const START = '/* YJ_CODEX_START */';
const END = '/* YJ_CODEX_END */';

const SECTION_CAT = [
  [/境界|修行|修炼|等级|力量体系/, '境界体系'],
  [/势力|组织|阵营|谱系|宗门|文明|种族|格局/, '势力组织'],
  [/地理|地图|锚点|区域|版图|疆域/, '地理'],
  [/人物|角色|志|主角|配角/, '人物'],
  [/事件|时代|年表|时序|历史|大事/, '事件年表'],
  [/铁律|禁忌|规则|设定|背景|世界观/, '世界观铁律'],
];
const catOf = (s) => (SECTION_CAT.find(([re]) => re.test(s)) || [null, '世界观设定'])[1];

/* 这些是提示词工程/变量协议，不是世界观事实，不该进资料库占位 */
const NOISE = /(?:variable_update|world_update|一章完整正文|无系统字样|小说排版|0-100|\bcharacters\b|characters\[|\.impression|\.relationship|emotionGauge|输出格式|变量块|\bJSON\b|\bprompt\b|\btrue\b|\bfalse\b)/i;
const STOP_HEAD = /^(?:另有|其余|其他|补充|说明|备注|其中|此外|注意|例如|如|总之|共计|本|该|一章|输出|格式)$/;
const SUFFIX = '(?:宗|门|派|教|殿|盟|会|阁|府|军|国|族|帮|寺|观|城|谷|山|海|域|洲|镇|村|岛|峰|岭|塔|楼|庄|堡|营|寨|港|关|司|局|廷|宫|学院|集团|家族|帝国|王朝|世家|议会|组织|圣地|遗迹)';
const PROPER_RE = new RegExp(`(?:^|[：:｜|，,；;（(\\[\\s])([\\u4e00-\\u9fa5A-Za-z0-9]{2,6}${SUFFIX})`, 'g');

/** 把一行原文压成一个可检索条目 */
function makeItem(genre, sec, raw, idx) {
  let line = raw.replace(/^\s*(?:\d+[.、)]\s*|[-•*]\s*|#+\s*)/, '').trim();
  if (line.length < 12 || NOISE.test(line)) return null;
  if (line.length > 1500) line = line.slice(0, 1500) + '…';
  /* 行首专名：到第一个分隔符为止，限 18 字 */
  let head = line.split(/[：:｜|，,；;（(【\[]/)[0].trim();
  if (head.length > 18) head = head.slice(0, 18);
  const proper = [...line.matchAll(PROPER_RE)].map((m) => m[1]);
  if (!head || head.length < 2 || STOP_HEAD.test(head) || /[.\[\]]/.test(head)) {
    head = proper[0] || `条目${idx}`;
  }
  const cat = catOf(sec);
  const title = `${cat} · ${head}`;
  /* tags：界名 + 类别 + 行首专名 + 行内完整专名（带边界，避免切碎） */
  const tags = [genre, cat, head];
  proper.slice(0, 3).forEach((t) => { if (!tags.includes(t)) tags.push(t); });
  return {
    title,
    content: line,
    category: cat,
    tags,
    alwaysInclude: false,
    priority: '',
  };
}

const genres = fs.readdirSync(CFG_DIR).filter((f) => f.endsWith('-config.js')).map((f) => f.replace('-config.js', '')).sort();
let grand = 0;
const index = { version: 2, genres: {}, total: 0, note: '由 scripts/build-codex.mjs 统计：每界 core + ext（含原著设定速查）条目数' };

for (const g of genres) {
  const cfg = fs.readFileSync(path.join(CFG_DIR, `${g}-config.js`), 'utf8');
  /* 按二级标题分节；config 是 JS 文件，标题以 markdown 形式出现在模板字符串/注释里 */
  const parts = cfg.split(/(?=^##\s)/m);
  const items = [];
  const seen = new Set();
  for (const part of parts) {
    const hm = part.match(/^##\s+([^\n]+)\n/);
    if (!hm) continue;
    const sec = hm[1].trim();
    const body = part.slice(hm[0].length);
    /* 逐行：编号行 / 短横行 / 较长的独立段落行都收 */
    const lines = body.split('\n').filter((l) => /^\s*(?:\d+[.、)]\s*|[-•*]\s*)/.test(l) || (l.trim().length >= 24 && !/^\s*[`'\"]/.test(l)));
    lines.forEach((raw, i) => {
      const it = makeItem(g, sec, raw, i + 1);
      if (!it || seen.has(it.title)) return;
      seen.add(it.title);
      items.push(it);
    });
  }
  if (!items.length) { console.log(`  ${g}: 0 条（跳过）`); continue; }

  const extPath = path.join(KB_DIR, `${g}.ext.js`);
  if (!fs.existsSync(extPath)) { console.log(`  ${g}: ext 不存在（跳过）`); continue; }
  let ext = fs.readFileSync(extPath, 'utf8');
  const payload = `${START}\n/* 云境 v3.95.0 · 原著设定逐行速查（由 scripts/build-codex.mjs 从 configs/${g}-config.js 抽取，${items.length} 条）\n * 目的：小参数模型自身记不住原著时，按剧情检索注入本界事实，不依赖模型记忆。 */\n(function(){\n  var KB = window.KB_PRESETS || (window.KB_PRESETS = {});\n  var a = KB[${JSON.stringify(g)}] || (KB[${JSON.stringify(g)}] = []);\n  var add = ${JSON.stringify(items)};\n  var have = {}; a.forEach(function(x){ have[String(x&&x.title||'').trim()] = 1; });\n  add.forEach(function(x){ var t=String(x&&x.title||'').trim(); if(!have[t]){ have[t]=1; a.push(x); } });\n  window.__KB_CODEX_OK__ = true;\n})();\n${END}`;
  const a = ext.indexOf(START), b = ext.indexOf(END);
  if (a !== -1 && b !== -1 && b > a) ext = ext.slice(0, a) + payload + ext.slice(b + END.length);
  else ext = ext.replace(/\s*$/, '') + '\n\n' + payload + '\n';
  fs.writeFileSync(extPath, ext);

  const corePath = path.join(KB_DIR, `${g}.core.js`);
  const count = (p) => (fs.readFileSync(p, 'utf8').match(/"title"\s*:/g) || []).length;
  const n = count(corePath) + count(extPath);
  index.genres[g] = n;
  index.total += n;
  grand += items.length;
  console.log(`  ${g.padEnd(18)} +${String(items.length).padStart(3)} 条设定  分包合计 ${n}`);
}

fs.writeFileSync(path.join(KB_DIR, '_index.json'), JSON.stringify(index));
console.log(`\n新增设定速查 ${grand} 条 · 33 界知识库合计 ${index.total} 条 · _index.json 已刷新`);
