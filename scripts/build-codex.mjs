#!/usr/bin/env node
/**
 * 云境 v3.96.0 · 资料库完备化（幂等，可反复跑）
 *
 * 目的：玩家用便宜的小参数模型时，模型自身记不住原著设定。云境自带资料库必须细粒度、
 *       可按剧情检索。本脚本把 configs/<界>-config.js 的设定逐行拆成可检索条目，
 *       追加到 js/kb/<界>.ext.js（用 YJ_CODEX 标记包裹，重跑只替换不叠加），
 *       并同步刷新 js/kb/_index.json 的真实条目统计。
 *
 * v3.96.0 升级：v3.95 只按 `##` 分节，漏掉了全部 `【】` 章节（408 个行首章节），
 *       这些恰恰是「原著骨架速查表 / 势力谱系 / 外神名录 / 铁律」等设定最密的地方。
 *       现在两类章节都收，并用「章节级跳过 + 行级去噪」把提示词工程挡在外面：
 *       输出规范、入场指令、检查清单、档案示例、正文风格等整节不入库。
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
  [/境界|修行|修炼|等级|力量体系|基因|序列|阶位|等级/, '境界体系'],
  [/势力|组织|阵营|谱系|宗门|文明|种族|格局|外神|旧日|神系|种族/, '势力组织'],
  [/地理|地图|锚点|区域|版图|疆域|山海|地名|城邦|星域/, '地理'],
  [/人物|角色|志|主角|配角|众生|名录|档案/, '人物'],
  [/事件|时代|年表|时序|历史|大事|纪年|沿革/, '事件年表'],
  [/铁律|禁忌|规则|设定|背景|世界观|骨架|法则|器物|道具|功法|术语/, '世界观铁律'],
];
const catOf = (s) => (SECTION_CAT.find(([re]) => re.test(s)) || [null, '世界观设定'])[1];

/* 章节级跳过：这些是给模型看的提示词工程 / 输出规范，不是世界观事实，整节不入库 */
const SECTION_SKIP = /(?:输出规范|扮演输出|入场指令|开篇剧情指令|开场指令|完整检查|检查清单|档案示例|示例|界面与反馈|正文风格|叙事风格|创作六维|反八股|负面清单|术语过滤器|开篇锚点|开场锚点|输出格式|变量(?:块|表|协议)?|字段|模板|排版|字数|禁词|对白规范|文风|节奏与|结构要求|套路|指令|清单|反馈规范|系统规则清单)/;

/* 行级噪声：变量协议 / 输出格式 / 代码 / AI 元指令，一律不占资料库 */
const NOISE = /(?:variable_update|world_update|一章完整正文|无系统字样|小说排版|0-100|\bcharacters\b|characters\[|\.impression|\.relationship|emotionGauge|输出格式|变量块|\bJSON\b|\bprompt\b|\btrue\b|\bfalse\b|每轮回复|请输出|请以|不得输出|禁止出现|作为AI|根据设定|user:|assistant:|system:|<\|im_start\|>|\{["a-zA-Z_]|\[\{|按以下格式|回复包含)/i;
const STOP_HEAD = /^(?:另有|其余|其他|补充|说明|备注|其中|此外|注意|例如|如|总之|共计|本|该|一章|输出|格式|每一轮|本轮|上一轮|下一轮|禁止|必须|不得|应当|应|须|请|不要|严禁)$/;
const SUFFIX = '(?:宗|门|派|教|殿|盟|会|阁|府|军|国|族|帮|寺|观|城|谷|山|海|域|洲|镇|村|岛|峰|岭|塔|楼|庄|堡|营|寨|港|关|司|局|廷|宫|学院|集团|家族|帝国|王朝|世家|议会|组织|圣地|遗迹)';
const PROPER_RE = new RegExp(`(?:^|[：:｜|，,；;（(\\[\\s])([\\u4e00-\\u9fa5A-Za-z0-9]{2,6}${SUFFIX})`, 'g');

/** 把一行原文压成一个可检索条目 */
function makeItem(genre, sec, raw) {
  let line = raw.replace(/^\s*(?:\d+[.、)]\s*|[-•*]\s*|#+\s*)/, '').trim();
  if (line.length < 12 || NOISE.test(line)) return null;
  if (line.length > 1500) line = line.slice(0, 1500) + '…';
  let head = line.split(/[：:｜|，,；;（(【\[]/)[0].trim();
  if (head.length > 18) head = head.slice(0, 18);
  const proper = [...line.matchAll(PROPER_RE)].map((m) => m[1]);
  if (!head || head.length < 2 || STOP_HEAD.test(head) || /[.\[\]]/.test(head)) {
    head = proper[0] || line.slice(0, 12);
  }
  const cat = catOf(sec);
  const tags = [genre, cat, head, sec.replace(/[（(].*$/, '').slice(0, 12)];
  proper.slice(0, 3).forEach((t) => { if (!tags.includes(t)) tags.push(t); });
  return {
    title: `${cat} · ${head}`,
    content: line,
    category: cat,
    tags: [...new Set(tags)],
    alwaysInclude: false,
    priority: '',
  };
}

const genres = fs.readdirSync(CFG_DIR).filter((f) => f.endsWith('-config.js')).map((f) => f.replace('-config.js', '')).sort();
let grand = 0, skippedSec = 0;
const index = { version: 3, genres: {}, total: 0, note: '由 scripts/build-codex.mjs 统计：每界 core + ext（含 ## 与 【】 两类章节的设定速查）条目数' };

for (const g of genres) {
  const cfg = fs.readFileSync(path.join(CFG_DIR, `${g}-config.js`), 'utf8');
  /* 分节：行首 ## 或 行首【】。v3.96 起两类都收。 */
  const parts = cfg.split(/(?=^##\s)|(?=^【)/m);
  const items = [];
  const seen = new Set();
  for (const part of parts) {
    const h2 = part.match(/^##\s+([^\n]+)\n/);
    const br = part.match(/^【([^】]+)】/);
    let sec, body;
    if (h2) { sec = h2[1].trim(); body = part.slice(h2[0].length); }
    else if (br) { sec = br[1].trim(); body = part.slice(br[0].length); }
    else continue;
    if (SECTION_SKIP.test(sec)) { skippedSec++; continue; }
    const lines = body.split('\n').filter((l) =>
      /^\s*(?:\d+[.、)]\s*|[-•*]\s*)/.test(l) ||
      (l.trim().length >= 24 && !/^\s*[`'"]/.test(l))
    );
    lines.forEach((raw) => {
      const it = makeItem(g, sec, raw);
      if (!it) return;
      /* title 必须唯一：运行时 ext.js 用 title 去重，同名会被丢掉，故冲突时加「·补N」后缀 */
      let title = it.title, k = 1;
      while (seen.has(title)) { k++; title = `${it.title} · 补${k}`; }
      seen.add(title);
      it.title = title;
      items.push(it);
    });
  }
  if (!items.length) { console.log(`  ${g}: 0 条（跳过）`); continue; }

  const extPath = path.join(KB_DIR, `${g}.ext.js`);
  if (!fs.existsSync(extPath)) {
    const stub = `/* ${g} 扩展知识库（由 scripts/build-codex.mjs 生成，请勿手改本段以外内容） */\n${START}\n${END}\n`;
    fs.writeFileSync(extPath, stub);
  }
  let ext = fs.readFileSync(extPath, 'utf8');
  /* v3.96.0 幂等累加：把本文件里已有的 YJ_CODEX 条目读回来，净化掉提示词工程行，
     再与本次从 ##/【】 章节抽到的新条目合并（按 标题+内容 去重）。
     分节规则升级不会冲掉历史资料，每次重跑只增不减。 */
  const a0 = ext.indexOf(START), b0 = ext.indexOf(END);
  let oldItems = [];
  if (a0 !== -1 && b0 !== -1 && b0 > a0) {
    const m = ext.slice(a0, b0).match(/var add = (\[[\s\S]*?\]);\n/);
    if (m) { try { oldItems = JSON.parse(m[1]); } catch (e) { /* 段损坏则忽略 */ } }
  }
  oldItems = oldItems.filter((it) => it && it.content && !NOISE.test(it.content));
  const merged = [], keys = new Set();
  for (const it of oldItems.concat(items)) {
    const key = String(it.title || '') + '|' + String(it.content || '').slice(0, 70);
    if (keys.has(key)) continue;
    keys.add(key);
    merged.push(it);
  }
  const payload = `${START}\n/* 云境 v3.96.0 · 原著设定逐行速查（由 scripts/build-codex.mjs 从 configs/${g}-config.js 的 ## 与 【】 章节抽取，${merged.length} 条）\n * 目的：小参数模型自身记不住原著时，按剧情检索注入本界事实，不依赖模型记忆。 */\n(function(){\n  var KB = window.KB_PRESETS || (window.KB_PRESETS = {});\n  var a = KB[${JSON.stringify(g)}] || (KB[${JSON.stringify(g)}] = []);\n  var add = ${JSON.stringify(merged)};\n  var have = {}; a.forEach(function(x){ have[String(x&&x.title||'').trim()] = 1; });\n  add.forEach(function(x){ var t=String(x&&x.title||'').trim(); if(!have[t]){ have[t]=1; a.push(x); } });\n  window.__KB_CODEX_OK__ = true;\n})();\n${END}`;
  if (a0 !== -1 && b0 !== -1 && b0 > a0) ext = ext.slice(0, a0) + payload + ext.slice(b0 + END.length);
  else ext = ext.replace(/\s*$/, '') + '\n\n' + payload + '\n';
  fs.writeFileSync(extPath, ext);

  const corePath = path.join(KB_DIR, `${g}.core.js`);
  const count = (p) => fs.existsSync(p) ? ((fs.readFileSync(p, 'utf8').match(/"title"\s*:/g) || []).length) : 0;
  const n = count(corePath) + count(extPath);
  index.genres[g] = n;
  index.total += n;
  grand += merged.length;
  console.log(`  ${g.padEnd(18)} +${String(items.length).padStart(4)} 条设定  分包合计 ${n}`);
}

fs.writeFileSync(path.join(KB_DIR, '_index.json'), JSON.stringify(index));
console.log(`\n新增设定速查 ${grand} 条 · 跳过提示词工程章节 ${skippedSec} 个 · ${genres.length} 界知识库合计 ${index.total} 条 · _index.json 已刷新`);
