/* 云境 v3.97.0 · 刷新资料库静态索引 js/kb/_index.json
 *
 * 与 build-codex.mjs 完全同口径：统计每界 core.js + ext.js 里 "title": 的出现次数。
 * 本脚本只读不写任何 KB 分包，因此能安全地把 v3.97.0 追加的 YJ_SEQUEL 续作段
 * （以及 YJ_GENRE_INDEX / YJ_EARTH_FACTS 等其它幂等段）一并计入总数，
 * 避免为了刷新索引而重跑抽取器、扰动已经净化过的 YJ_CODEX 段。
 *
 * 用法：node scripts/refresh-kb-index.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KB = path.join(ROOT, 'js', 'kb');
const CFG = path.join(ROOT, 'configs');
const genres = fs.readdirSync(CFG)
  .filter((f) => f.endsWith('-config.js'))
  .map((f) => f.replace('-config.js', ''))
  .sort();

const countTitles = (p) => {
  if (!fs.existsSync(p)) return 0;
  return (fs.readFileSync(p, 'utf8').match(/"title"\s*:/g) || []).length;
};
const countSegment = (src, start, end) => {
  const i = src.indexOf(start), j = src.indexOf(end);
  if (i === -1 || j === -1 || j <= i) return 0;
  return (src.slice(i, j).match(/"title"\s*:/g) || []).length;
};

const before = fs.existsSync(path.join(KB, '_index.json'))
  ? JSON.parse(fs.readFileSync(path.join(KB, '_index.json'), 'utf8')) : null;

const index = {
  version: 4,
  genres: {},
  total: 0,
  sequel: { worlds: 0, entries: 0 },
  note: '由 scripts/refresh-kb-index.mjs 统计：每界 core + ext 的 "title": 条目数，含 YJ_CODEX 设定速查、YJ_GENRE_INDEX 专名索引、YJ_EARTH_FACTS 地球事实与 v3.97.0 YJ_SEQUEL 续作设定段'
};
const deltas = [];
for (const g of genres) {
  const ext = fs.readFileSync(path.join(KB, `${g}.ext.js`), 'utf8');
  const n = countTitles(path.join(KB, `${g}.core.js`)) + countTitles(path.join(KB, `${g}.ext.js`));
  index.genres[g] = n;
  index.total += n;
  const seq = countSegment(ext, '/* YJ_SEQUEL_START */', '/* YJ_SEQUEL_END */');
  if (seq > 0) { index.sequel.worlds++; index.sequel.entries += seq; }
  const old = before && before.genres ? (before.genres[g] || 0) : 0;
  if (n !== old) deltas.push({ genre: g, before: old, after: n, delta: n - old });
}
fs.writeFileSync(path.join(KB, '_index.json'), JSON.stringify(index));

const diff = index.total - (before ? before.total : 0);
console.log(`静态索引：${before ? `v${before.version} ${before.total} 条` : '无旧索引'} → v${index.version} ${index.total} 条（${diff >= 0 ? '+' : ''}${diff}）`);
console.log(`续作段：${index.sequel.worlds} 界 / ${index.sequel.entries} 条`);
console.log(`逐界变化 ${deltas.length} 处：`);
deltas.forEach((d) => console.log(`  ${d.genre.padEnd(18)} ${String(d.before).padStart(5)} → ${String(d.after).padStart(5)}  (${d.delta >= 0 ? '+' : ''}${d.delta})`));
