#!/usr/bin/env node
/* 云境 · 续作 / 同一世界观资料库生成器（v3.97.0，幂等，可反复跑）
 *
 * 读 scripts/sequel-data.mjs，把每个世界的续作条目写进 js/kb/<genre>.ext.js 的
 *   YJ_SEQUEL_START 与 YJ_SEQUEL_END 两个标记之间的独立段。
 * 格式与既有 YJ_CODEX / YJ_GENRE_INDEX 段完全一致：
 * IIFE 往 window.KB_PRESETS[genre] push，按 title 去重，零接线改动。
 *
 * 幂等：已有段整段替换，没有段则追加到文件末尾；重跑只覆盖本段，不动其它段。
 * 用法：node scripts/build-sequel-codex.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEQUEL_ENTRIES, SEQUEL_META } from './sequel-data.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const START = '/* YJ_SEQUEL_START */';
const END = '/* YJ_SEQUEL_END */';
const VER = 'v3.97.0';

const stats = { version: VER, worlds: 0, entries: 0, files: [], perWorld: {} };

for (const [genre, entries] of Object.entries(SEQUEL_ENTRIES)) {
  const rel = `js/kb/${genre}.ext.js`;
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    console.warn(`跳过（无 ext 文件）: ${rel}`);
    continue;
  }
  const meta = SEQUEL_META[genre] || { label: genre, works: [] };
  const payload = entries.map((e) => ({
    title: String(e.title || '').trim(),
    content: String(e.content || '').trim(),
    category: String(e.category || '续作设定').trim(),
    tags: Array.from(new Set([...(Array.isArray(e.tags) ? e.tags : []), genre, '续作设定'])),
  })).filter((e) => e.title && e.content);

  const block = [
    START,
    `/* 云境 ${VER} · ${meta.label}（由 scripts/build-sequel-codex.mjs 从 scripts/sequel-data.mjs 生成，${payload.length} 条）`,
    ` * 作品：${meta.works.join(' / ')}`,
    ' * 目的：补齐本界原著续作 / 后传 / 同一世界观系列 / 本作后期阶段，便宜小模型按专名即可检索，不依赖自身记忆。 */',
    '(function(){',
    '  var KB = window.KB_PRESETS || (window.KB_PRESETS = {});',
    `  var a = KB[${JSON.stringify(genre)}] || (KB[${JSON.stringify(genre)}] = []);`,
    `  var add = ${JSON.stringify(payload)};`,
    '  var have = {}; a.forEach(function(x){ have[String(x&&x.title||\'\').trim()] = 1; });',
    '  add.forEach(function(x){ var t=String(x&&x.title||\'\').trim(); if(!have[t]){ have[t]=1; a.push(x); } });',
    '  window.__KB_SEQUEL_OK__ = true;',
    '})();',
    END,
    '',
  ].join('\n');

  let src = fs.readFileSync(file, 'utf8');
  const i = src.indexOf(START), j = src.indexOf(END);
  if (i !== -1 && j !== -1 && j > i) {
    src = src.slice(0, i) + block + src.slice(j + END.length).replace(/^\r?\n/, '');
  } else {
    src = src.replace(/\s*$/, '\n\n') + block;
  }
  fs.writeFileSync(file, src);
  stats.worlds += 1;
  stats.entries += payload.length;
  stats.perWorld[genre] = payload.length;
  stats.files.push(rel);
  console.log(`  ${genre.padEnd(20)} +${String(payload.length).padStart(3)} 条  ${meta.label}`);
}

const out = path.join(ROOT, 'scripts', '_sequel_stats.json');
fs.writeFileSync(out, JSON.stringify(stats, null, 2));
console.log(`\n完成：${stats.worlds} 个世界，新增 ${stats.entries} 条续作资料；统计写入 ${path.relative(ROOT, out)}`);
