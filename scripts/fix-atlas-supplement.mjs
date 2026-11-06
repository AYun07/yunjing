#!/usr/bin/env node
/* 云境 v3.97.0 · 舆图补录清洗（幂等，可反复跑）
 *
 * 背景：v3.95 的 gen-atlas-supplement-3.mjs 从 configs 章节抽专名时，
 *       把「坐落圣丹城」「下辖五大家族」「情报遍布大陆」一类描述性短语
 *       误当成地名上图，且 814 条里 799 条无锚点。这些是「和原著对不上」的直接来源。
 *
 * 本脚本做两件事（只改名称与剔除，不改层、不改落点算法，避免破坏势力动态链路）：
 *   1) DROP：删除明显不是专名的描述性片段；
 *   2) RENAME：把「下辖 X」「坐落 X」「守护 X 圣地」还原为原著专名 X。
 * 重跑前会读回现有 ATLAS_SUPPLEMENT，已清洗过的条目不会重复处理。
 *
 * 用法：node scripts/fix-atlas-supplement.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'js', 'atlas-supplement.js');
const require = createRequire(import.meta.url);

/* 明显不是地名的描述性片段 → 删除 */
const DROP = new Set([
  '骨斗罗护宗', '情报遍布大陆', '天下第一宗门',
  '炼药师圣地', '下辖五大家族',
  '遍布五域', '情报组织', '辖诸郡',
]);

/* 描述性前缀误抽 → 还原为原著专名 */
const RENAME = {
  '坐落圣丹城': '圣丹城',
  '下辖神庙学院': '神庙学院',
  '下辖昆虚星域': '昆虚星域',
  '下辖罗天星域': '罗天星域',
  '下辖云海星域': '云海星域',
  '下辖召河星域': '召河星域',
  '守护幻梦境圣地': '幻梦境',
};

global.window = {};
require(FILE);
const S = global.window.ATLAS_SUPPLEMENT || {};

let dropped = 0, renamed = 0, dedup = 0, total = 0;
const report = [];
for (const [g, arr] of Object.entries(S)) {
  if (!Array.isArray(arr)) continue;
  const seen = new Set();
  const out = [];
  for (const it of arr) {
    if (!it || !it.n) continue;
    let n = String(it.n).trim();
    if (DROP.has(n)) { dropped++; report.push(`${g}: 删除「${n}」`); continue; }
    if (RENAME[n]) { const old = n; n = RENAME[n]; renamed++; report.push(`${g}: 「${old}」→「${n}」`); }
    if (seen.has(n)) { dedup++; report.push(`${g}: 去重「${n}」`); continue; }
    seen.add(n);
    out.push(Object.assign({}, it, { n }));
    total++;
  }
  S[g] = out;
}

const header = [
  '/* 云境 v3.97.0 · 33 界舆图补录（原 814 条，清洗后 ' + total + ' 条）',
  ' * 每条含：n 名称 / t 类型 / anchor 锚定到的本界已有地标 / desc 原著出处摘录 / c 来源；',
  ' * earth 条目含 lon / lat 真实经纬度，由 atlas-panel.js 的 injectSupplement() 走 geoXY() 落点。',
  ' * 生成链：gen-atlas-supplement-3.mjs（审定抽取）→ fix-atlas-supplement.mjs（本脚本，名称清洗）。',
  ' * v3.97.0 清洗：删除 8 条描述性短语误抽、还原 7 条「下辖/坐落/守护」前缀为原著专名；',
  ' *   只改名称与剔除，不改层、不改锚点与落点算法，避免影响 v3.93 势力动态舆图链路。',
  ' * 运行时按锚点避让追加到对应层，不改动原始 ATLAS_DATA，可整体回滚。',
  ' * 抽象/类型世界（free / freeworld / mystery / scifi / shenmifusu / lunhuileyuan）无原著专名，不补录。',
  ' */',
].join('\n');

const body = header + '\n(function () {\n  "use strict";\n  window.ATLAS_SUPPLEMENT = ' +
  JSON.stringify(S) + ';\n})();\n';
fs.writeFileSync(FILE, body);

const stat = { version: 'v3.97.0', total, dropped, renamed, dedup, changes: report };
fs.writeFileSync(path.join(ROOT, 'scripts', '_atlas_fix_stats.json'), JSON.stringify(stat, null, 2));
console.log(`清洗完成：${total} 条（删除 ${dropped} / 改名 ${renamed} / 去重 ${dedup}）`);
report.forEach((r) => console.log('  ' + r));
console.log('明细写入 scripts/_atlas_fix_stats.json');
